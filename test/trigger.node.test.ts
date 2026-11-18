import type { IDataObject, IHttpRequestOptions, IPollFunctions } from 'n8n-workflow';
import { describe, expect, it } from 'vitest';
import { AfforestationTrigger } from '../nodes/AfforestationTrigger/AfforestationTrigger.node';
import type { ImpactEntryRaw, StatsResponse } from '../nodes/shared/api';

const entry = (id: number): ImpactEntryRaw => ({
	id,
	source_type: 'api',
	trees_planted: 1,
	co2_offset_kg: '21.77',
	reference_id: null,
	reference_type: null,
	metadata: {},
	created_at: new Date(Date.UTC(2026, 10, 18, 0, 0, id)).toISOString(),
});

const range = (from: number, to: number) => {
	const out: ImpactEntryRaw[] = [];
	for (let id = from; id >= to; id--) out.push(entry(id));
	return out;
};

type Handler = (req: IHttpRequestOptions) => { statusCode: number; body: unknown };

function harness(opts: { event: string; mode?: string; state?: IDataObject; handler: Handler }) {
	const state: IDataObject = opts.state ?? {};
	const requests: IHttpRequestOptions[] = [];
	const ctx = {
		getMode: () => opts.mode ?? 'trigger',
		getNodeParameter: (name: string) => (name === 'event' ? opts.event : undefined),
		getWorkflowStaticData: () => state,
		getCredentials: async () => ({ apiKey: 'afor_test', baseUrl: 'http://localhost:4000/' }),
		getNode: () => ({
			id: '1',
			name: 'Afforestation Trigger',
			type: 'n8n-nodes-afforestation.afforestationTrigger',
			typeVersion: 1,
			position: [0, 0],
			parameters: {},
		}),
		helpers: {
			httpRequestWithAuthentication: async (_cred: string, req: IHttpRequestOptions) => {
				requests.push(req);
				return opts.handler(req);
			},
			returnJsonArray: (items: IDataObject[]) => items.map((json) => ({ json })),
		},
	} as unknown as IPollFunctions;
	const poll = () => new AfforestationTrigger().poll.call(ctx);
	return { poll, state, requests };
}

const impactPage = (data: ImpactEntryRaw[], page = 1, totalPages = 1) => ({
	statusCode: 200,
	body: { success: true, data, meta: { page, limit: 100, total: data.length, totalPages } },
});

const ids = (out: Awaited<ReturnType<AfforestationTrigger['poll']>>) =>
	(out?.[0] ?? []).map((i) => i.json.id);

describe('New Impact Entry', () => {
	it('first activation stores lastId and emits nothing', async () => {
		const h = harness({ event: 'newImpactEntry', handler: () => impactPage([entry(7)]) });
		expect(await h.poll()).toBeNull();
		expect(h.state.lastId).toBe(7);
		expect(h.state.since).toBe(entry(7).created_at);
	});

	it('emits only new entries oldest first', async () => {
		const h = harness({
			event: 'newImpactEntry',
			state: { lastId: 3, since: entry(3).created_at },
			handler: () => impactPage([entry(5), entry(4), entry(3)]),
		});
		expect(ids(await h.poll())).toEqual([4, 5]);
		expect(h.state.lastId).toBe(5);
		expect(h.requests[0]!.qs).toMatchObject({ since: entry(3).created_at, limit: 100, page: 1 });
	});

	it('paginates past the first page', async () => {
		const h = harness({
			event: 'newImpactEntry',
			state: { lastId: 100, since: entry(100).created_at },
			handler: (req) =>
				(req.qs as IDataObject).page === 1
					? impactPage(range(250, 151), 1, 2)
					: impactPage(range(150, 101), 2, 2),
		});
		const out = ids(await h.poll());
		expect(out).toHaveLength(150);
		expect(out[0]).toBe(101);
		expect(out[149]).toBe(250);
		for (const r of h.requests)
			expect(r.url.startsWith('http://localhost:4000/api/v1/impact')).toBe(true);
	});

	it('manual mode returns latest without changing state', async () => {
		const h = harness({
			event: 'newImpactEntry',
			mode: 'manual',
			state: { lastId: 2 },
			handler: () => impactPage([entry(9)]),
		});
		expect(ids(await h.poll())).toEqual([9]);
		expect(h.state.lastId).toBe(2);
	});

	it('explains an invalid key', async () => {
		const h = harness({
			event: 'newImpactEntry',
			state: { lastId: 1 },
			handler: () => ({ statusCode: 401, body: { success: false } }),
		});
		await expect(h.poll()).rejects.toThrow('Invalid API key.');
	});
});

describe('Stats Changed', () => {
	const stats = (trees: number): StatsResponse => ({
		total: { treesPlanted: trees, co2OffsetKg: trees * 21.77 },
		thisMonth: { treesPlanted: trees, co2OffsetKg: trees * 21.77 },
		activeGoal: null,
	});

	it('stats emits only when totals change', async () => {
		let trees = 10;
		const h = harness({
			event: 'statsChanged',
			handler: () => ({ statusCode: 200, body: { success: true, data: stats(trees) } }),
		});
		expect(await h.poll()).toBeNull();
		expect(await h.poll()).toBeNull();
		trees = 11;
		const out = await h.poll();
		expect(out?.[0]?.[0]?.json).toMatchObject({ totalTreesPlanted: 11 });
		expect(await h.poll()).toBeNull();
	});
});
