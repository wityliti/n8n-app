import {
	NodeApiError,
	NodeConnectionTypes,
	type IDataObject,
	type INodeExecutionData,
	type INodeType,
	type INodeTypeDescription,
	type IPollFunctions,
	type JsonObject,
} from 'n8n-workflow';
import {
	apiErrorMessage,
	flattenStats,
	mapImpactEntry,
	normalizeBaseUrl,
	type ImpactEntryRaw,
	type StatsResponse,
} from '../shared/api';
import { selectNewEntries, statsKey } from '../shared/poll';

const PAGE_SIZE = 100;
const MAX_PAGES = 10;

type TriggerState = { lastId?: number; since?: string; statsKey?: string };
type ImpactPage = { data: ImpactEntryRaw[]; meta: { totalPages: number } };

async function apiGet(this: IPollFunctions, path: string, qs?: IDataObject): Promise<unknown> {
	const credentials = await this.getCredentials('afforestationApi');
	const response = (await this.helpers.httpRequestWithAuthentication.call(
		this,
		'afforestationApi',
		{
			method: 'GET',
			url: `${normalizeBaseUrl(credentials.baseUrl as string | undefined)}${path}`,
			qs,
			json: true,
			returnFullResponse: true,
			ignoreHttpStatusErrors: true,
		},
	)) as { statusCode: number; body: JsonObject };
	const body = response.body ?? {};
	if (response.statusCode >= 400) {
		const apiMessage = typeof body.message === 'string' ? body.message : undefined;
		throw new NodeApiError(this.getNode(), body, {
			message:
				apiErrorMessage(response.statusCode) ??
				apiMessage ??
				`Afforestation API returned ${response.statusCode}`,
			httpCode: String(response.statusCode),
		});
	}
	return body;
}

function toItems(this: IPollFunctions, rows: IDataObject[]): INodeExecutionData[][] | null {
	return rows.length ? [this.helpers.returnJsonArray(rows)] : null;
}

async function pollImpact(this: IPollFunctions, state: TriggerState) {
	if (this.getMode() === 'manual' || state.lastId === undefined) {
		const latest = (await apiGet.call(this, '/api/v1/impact', { limit: 1, page: 1 })) as ImpactPage;
		const newest = latest.data[0];
		if (this.getMode() === 'manual') {
			return toItems.call(this, newest ? [mapImpactEntry(newest) as unknown as IDataObject] : []);
		}
		state.lastId = newest?.id ?? 0;
		state.since = newest?.created_at;
		return null;
	}

	const lastId = state.lastId;
	const collected: ImpactEntryRaw[] = [];
	let totalPages = 1;
	for (let page = 1; page <= Math.min(totalPages, MAX_PAGES); page++) {
		const qs: IDataObject = { limit: PAGE_SIZE, page };
		if (state.since) qs.since = state.since;
		const result = (await apiGet.call(this, '/api/v1/impact', qs)) as ImpactPage;
		collected.push(...result.data);
		totalPages = result.meta.totalPages;
	}

	const { emit, nextLastId, nextSince } = selectNewEntries(collected, lastId);
	state.lastId = nextLastId;
	if (nextSince) state.since = nextSince;
	return toItems.call(
		this,
		emit.map((e) => mapImpactEntry(e) as unknown as IDataObject),
	);
}

async function pollStats(this: IPollFunctions, state: TriggerState) {
	const result = (await apiGet.call(this, '/api/v1/stats')) as { data: StatsResponse };
	const stats = result.data;
	const flat = flattenStats(stats) as unknown as IDataObject;
	if (this.getMode() === 'manual') return toItems.call(this, [flat]);

	const key = statsKey(stats);
	const previous = state.statsKey;
	state.statsKey = key;
	if (previous === undefined || previous === key) return null;
	return toItems.call(this, [flat]);
}

export class AfforestationTrigger implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Afforestation Trigger',
		name: 'afforestationTrigger',
		icon: {
			light: 'file:../../icons/afforestation.svg',
			dark: 'file:../../icons/afforestation.dark.svg',
		},
		group: ['trigger'],
		version: 1,
		subtitle: '={{$parameter["event"]}}',
		description: 'Starts a workflow when new impact is recorded on Afforestation.org',
		defaults: { name: 'Afforestation Trigger' },
		polling: true,
		inputs: [],
		outputs: [NodeConnectionTypes.Main],
		credentials: [{ name: 'afforestationApi', required: true }],
		properties: [
			{
				displayName: 'Event',
				name: 'event',
				type: 'options',
				default: 'newImpactEntry',
				options: [
					{
						name: 'New Impact Entry',
						value: 'newImpactEntry',
						description:
							'Triggers once for each new tree planting or carbon offset entry, from any source',
					},
					{
						name: 'Stats Changed',
						value: 'statsChanged',
						description: "Triggers when your company's total trees or CO₂ offset change",
					},
				],
			},
		],
	};

	async poll(this: IPollFunctions): Promise<INodeExecutionData[][] | null> {
		const state = this.getWorkflowStaticData('node') as TriggerState;
		const event = this.getNodeParameter('event') as string;
		return event === 'statsChanged' ? pollStats.call(this, state) : pollImpact.call(this, state);
	}
}
