import type {
	IExecuteSingleFunctions,
	IHttpRequestOptions,
	INode,
	INodeProperties,
} from 'n8n-workflow';
import { describe, expect, it } from 'vitest';
import { Afforestation } from '../nodes/Afforestation/Afforestation.node';
import {
	flattenStatsItems,
	plantTreesPreSend,
	recordImpactPreSend,
	throwOnApiError,
} from '../nodes/Afforestation/hooks';

const RETRY_WARNING =
	'Turn off "Retry On Fail" for this node: the API does not de-duplicate requests, so a retry can plant trees twice.';

const node: INode = {
	id: '1',
	name: 'Afforestation',
	type: 'n8n-nodes-afforestation.afforestation',
	typeVersion: 1,
	position: [0, 0],
	parameters: {},
};

function fakeThis(params: Record<string, unknown> = {}) {
	return {
		getNode: () => node,
		getNodeParameter: (name: string, fallback?: unknown) =>
			name in params ? params[name] : fallback,
	} as unknown as IExecuteSingleFunctions;
}

const description = new Afforestation().description;
const operation = description.properties.find((p) => p.name === 'operation') as INodeProperties;
const option = (value: string) =>
	(
		operation.options as Array<{
			value: string;
			description?: string;
			routing: { request: unknown };
		}>
	).find((o) => o.value === value)!;

describe('Afforestation node description', () => {
	it('lists exactly three operations', () =>
		expect((operation.options as Array<{ value: string }>).map((o) => o.value).sort()).toEqual([
			'getStats',
			'plantTrees',
			'recordImpact',
		]));

	it('routes plantTrees', () =>
		expect(option('plantTrees').routing.request).toMatchObject({
			method: 'POST',
			url: '/api/v1/trees',
		}));
	it('routes recordImpact', () =>
		expect(option('recordImpact').routing.request).toMatchObject({
			method: 'POST',
			url: '/api/v1/impact',
		}));
	it('routes getStats', () =>
		expect(option('getStats').routing.request).toMatchObject({
			method: 'GET',
			url: '/api/v1/stats',
		}));

	it('warns about retries on write operations', () => {
		expect(option('plantTrees').description).toContain(RETRY_WARNING);
		expect(option('recordImpact').description).toContain(RETRY_WARNING);
	});

	it('requires the afforestationApi credential', () =>
		expect(description.credentials).toEqual([{ name: 'afforestationApi', required: true }]));
});

describe('throwOnApiError', () => {
	const items = [{ json: { ok: true } }];
	it('rejects 401 with the friendly message', async () =>
		await expect(
			throwOnApiError.call(fakeThis(), items, { statusCode: 401, body: {}, headers: {} }),
		).rejects.toThrow('Invalid API key.'));
	it('rejects other errors with the API message', async () =>
		await expect(
			throwOnApiError.call(fakeThis(), items, {
				statusCode: 400,
				body: { success: false, message: 'count must be a number between 1 and 10,000' },
				headers: {},
			}),
		).rejects.toThrow('count must be a number between 1 and 10,000'));
	it('passes successful responses through', async () =>
		expect(
			await throwOnApiError.call(fakeThis(), items, {
				statusCode: 200,
				body: { data: {} },
				headers: {},
			}),
		).toBe(items));
});

describe('preSend hooks', () => {
	const req = (): IHttpRequestOptions => ({ url: '/api/v1/trees', method: 'POST' });

	it('builds the plant trees body', async () => {
		const out = await plantTreesPreSend.call(
			fakeThis({
				count: 3,
				additionalFields: {
					referenceId: 'o_9',
					referenceType: 'shopify_order',
					metadata: '{"a":1}',
				},
			}),
			req(),
		);
		expect(out.body).toEqual({
			count: 3,
			referenceId: 'o_9',
			referenceType: 'shopify_order',
			metadata: { a: 1 },
		});
	});

	it('rejects a bad count before sending', async () =>
		await expect(plantTreesPreSend.call(fakeThis({ count: 0 }), req())).rejects.toThrow(
			'Number of Trees must be a whole number between 1 and 10,000',
		));

	it('rejects record impact with no values', async () =>
		await expect(recordImpactPreSend.call(fakeThis({ impact: {} }), req())).rejects.toThrow(
			'Enter Trees Planted, CO₂ Offset (Kilograms), or both',
		));

	it('keeps zero trees in record impact', async () => {
		const out = await recordImpactPreSend.call(
			fakeThis({ impact: { treesPlanted: 0, co2OffsetKg: 500 } }),
			req(),
		);
		expect(out.body).toEqual({ treesPlanted: 0, co2OffsetKg: 500 });
	});
});

describe('flattenStatsItems', () => {
	it('flattens the stats payload', async () => {
		const out = await flattenStatsItems.call(
			fakeThis(),
			[
				{
					json: {
						total: { treesPlanted: 10, co2OffsetKg: 217.7 },
						thisMonth: { treesPlanted: 2, co2OffsetKg: 43.54 },
						activeGoal: null,
					},
				},
			],
			{ statusCode: 200, body: {}, headers: {} },
		);
		expect(out[0]!.json).toMatchObject({
			totalTreesPlanted: 10,
			monthlyTreesPlanted: 2,
			activeGoalType: null,
		});
	});
});
