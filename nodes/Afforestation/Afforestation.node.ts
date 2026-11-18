import {
	NodeConnectionTypes,
	type INodeProperties,
	type INodeType,
	type INodeTypeDescription,
} from 'n8n-workflow';
import {
	flattenStatsItems,
	plantTreesPreSend,
	recordImpactPreSend,
	throwOnApiError,
} from './hooks';

const BASE_URL_EXPRESSION =
	'={{ ($credentials.baseUrl || "https://afforestation.org").replace(/\\/+$/, "") }}';

const unwrapData = { type: 'rootProperty' as const, properties: { property: 'data' } };

const additionalFields: INodeProperties = {
	displayName: 'Additional Fields',
	name: 'additionalFields',
	type: 'collection',
	placeholder: 'Add Field',
	default: {},
	displayOptions: { show: { operation: ['plantTrees', 'recordImpact'] } },
	options: [
		{
			displayName: 'Metadata (JSON)',
			name: 'metadata',
			type: 'json',
			default: '{}',
			description: 'Extra details to store with the entry, such as a customer email or campaign',
		},
		{
			displayName: 'Reference ID',
			name: 'referenceId',
			type: 'string',
			default: '',
			description:
				'An ID from another system to link this entry to, such as an order or payment ID',
		},
		{
			displayName: 'Reference Type',
			name: 'referenceType',
			type: 'options',
			default: 'custom',
			description: 'What kind of thing the Reference ID points to',
			options: [
				{ name: 'Custom', value: 'custom' },
				{ name: 'Referral', value: 'referral' },
				{ name: 'Review', value: 'review' },
				{ name: 'Shopify Order', value: 'shopify_order' },
				{ name: 'Signup', value: 'signup' },
				{ name: 'Stripe Payment', value: 'stripe_payment' },
				{ name: 'Subscription', value: 'subscription' },
				{ name: 'WooCommerce Order', value: 'woocommerce_order' },
			],
		},
	],
};

export class Afforestation implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Afforestation',
		name: 'afforestation',
		icon: {
			light: 'file:../../icons/afforestation.svg',
			dark: 'file:../../icons/afforestation.dark.svg',
		},
		group: ['output'],
		version: 1,
		subtitle: '={{$parameter["operation"]}}',
		description: 'Plant trees and record climate impact on Afforestation.org',
		defaults: { name: 'Afforestation' },
		usableAsTool: true,
		inputs: [NodeConnectionTypes.Main],
		outputs: [NodeConnectionTypes.Main],
		credentials: [{ name: 'afforestationApi', required: true }],
		requestDefaults: {
			baseURL: BASE_URL_EXPRESSION,
			headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
		},
		properties: [
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				default: 'plantTrees',
				options: [
					{
						name: 'Get Stats',
						value: 'getStats',
						action: 'Get impact stats',
						description: "Get your company's total and monthly trees, CO₂ offset and goal progress",
						routing: {
							request: { method: 'GET', url: '/api/v1/stats', ignoreHttpStatusErrors: true },
							output: { postReceive: [throwOnApiError, unwrapData, flattenStatsItems] },
						},
					},
					{
						name: 'Plant Trees',
						value: 'plantTrees',
						action: 'Plant trees',
						description:
							'Plant trees and record the impact for your company. Turn off "Retry On Fail" for this node: the API does not de-duplicate requests, so a retry can plant trees twice.',
						routing: {
							request: { method: 'POST', url: '/api/v1/trees', ignoreHttpStatusErrors: true },
							send: { preSend: [plantTreesPreSend] },
							output: { postReceive: [throwOnApiError, unwrapData] },
						},
					},
					{
						name: 'Record Impact',
						value: 'recordImpact',
						action: 'Record impact',
						description:
							'Record trees planted and/or CO₂ offset from another source. Turn off "Retry On Fail" for this node: the API does not de-duplicate requests, so a retry can plant trees twice.',
						routing: {
							request: { method: 'POST', url: '/api/v1/impact', ignoreHttpStatusErrors: true },
							send: { preSend: [recordImpactPreSend] },
							output: { postReceive: [throwOnApiError, unwrapData] },
						},
					},
				],
			},
			{
				displayName: 'Number of Trees',
				name: 'count',
				type: 'number',
				required: true,
				default: 1,
				typeOptions: { minValue: 1, maxValue: 10000, numberPrecision: 0 },
				description: 'How many trees to plant (1 to 10,000)',
				displayOptions: { show: { operation: ['plantTrees'] } },
			},
			{
				displayName: 'Impact',
				name: 'impact',
				type: 'collection',
				placeholder: 'Add Value',
				default: {},
				description: 'Add Trees Planted, CO₂ Offset (Kilograms), or both',
				displayOptions: { show: { operation: ['recordImpact'] } },
				options: [
					{
						displayName: 'CO₂ Offset (Kilograms)',
						name: 'co2OffsetKg',
						type: 'number',
						default: 0,
						typeOptions: { minValue: 0 },
						description: 'Carbon dioxide offset, in kilograms',
					},
					{
						displayName: 'Trees Planted',
						name: 'treesPlanted',
						type: 'number',
						default: 0,
						typeOptions: { minValue: 0, numberPrecision: 0 },
						description: 'Number of trees to record',
					},
				],
			},
			additionalFields,
		],
	};
}
