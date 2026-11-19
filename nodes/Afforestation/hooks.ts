import {
	NodeApiError,
	NodeOperationError,
	type IDataObject,
	type IExecuteSingleFunctions,
	type IHttpRequestOptions,
	type IN8nHttpFullResponse,
	type INodeExecutionData,
	type JsonObject,
} from 'n8n-workflow';
import {
	apiErrorMessage,
	buildImpactBody,
	buildPlantTreesBody,
	flattenStats,
	type StatsResponse,
} from '../shared/api';

export async function throwOnApiError(
	this: IExecuteSingleFunctions,
	items: INodeExecutionData[],
	response: IN8nHttpFullResponse,
): Promise<INodeExecutionData[]> {
	const status = response.statusCode;
	if (status < 400) return items;
	const body = (response.body ?? {}) as JsonObject;
	const apiMessage = typeof body.message === 'string' ? body.message : undefined;
	throw new NodeApiError(this.getNode(), body, {
		message: apiErrorMessage(status) ?? apiMessage ?? `Afforestation API returned ${status}`,
		httpCode: String(status),
	});
}

function build<T>(this: IExecuteSingleFunctions, fn: () => T): T {
	try {
		return fn();
	} catch (error) {
		throw new NodeOperationError(this.getNode(), error as Error);
	}
}

function references(this: IExecuteSingleFunctions) {
	const extra = this.getNodeParameter('additionalFields', {}) as {
		referenceId?: string;
		referenceType?: string;
		metadata?: unknown;
	};
	return {
		referenceId: extra.referenceId,
		referenceType: extra.referenceType,
		metadata: extra.metadata,
	};
}

export async function plantTreesPreSend(
	this: IExecuteSingleFunctions,
	requestOptions: IHttpRequestOptions,
): Promise<IHttpRequestOptions> {
	const count = this.getNodeParameter('count', 1) as number;
	const refs = references.call(this);
	requestOptions.body = build.call(this, () =>
		buildPlantTreesBody({ count, ...refs }),
	) as IDataObject;
	return requestOptions;
}

export async function recordImpactPreSend(
	this: IExecuteSingleFunctions,
	requestOptions: IHttpRequestOptions,
): Promise<IHttpRequestOptions> {
	const impact = this.getNodeParameter('impact', {}) as {
		treesPlanted?: number;
		co2OffsetKg?: number;
	};
	const { treesPlanted, co2OffsetKg } = impact;
	const refs = references.call(this);
	requestOptions.body = build.call(this, () =>
		buildImpactBody({ treesPlanted, co2OffsetKg, ...refs }),
	) as IDataObject;
	return requestOptions;
}

export async function flattenStatsItems(
	this: IExecuteSingleFunctions,
	items: INodeExecutionData[],
): Promise<INodeExecutionData[]> {
	return items.map((item) => ({
		...item,
		json: flattenStats(item.json as unknown as StatsResponse),
	}));
}

export async function mapRecordedImpactItems(
	this: IExecuteSingleFunctions,
	items: INodeExecutionData[],
): Promise<INodeExecutionData[]> {
	return items.map((item) => {
		const row = item.json as {
			id: number;
			trees_planted: number;
			co2_offset_kg: string | number | null;
			created_at: string;
		};
		return {
			...item,
			json: {
				id: row.id,
				treesPlanted: row.trees_planted,
				co2OffsetKg: parseFloat(String(row.co2_offset_kg ?? 0)),
				createdAt: row.created_at,
			},
		};
	});
}
