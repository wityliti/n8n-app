import { describe, expect, it } from 'vitest';
import {
	apiErrorMessage,
	buildImpactBody,
	buildPlantTreesBody,
	DEFAULT_BASE_URL,
	flattenStats,
	mapImpactEntry,
	normalizeBaseUrl,
	parseMetadata,
	type StatsResponse,
} from '../nodes/shared/api';

describe('normalizeBaseUrl', () => {
	it('strips a trailing slash', () =>
		expect(normalizeBaseUrl('https://afforestation.org/')).toBe('https://afforestation.org'));
	it('defaults when empty', () => expect(normalizeBaseUrl('')).toBe(DEFAULT_BASE_URL));
	it('defaults when undefined', () => expect(normalizeBaseUrl(undefined)).toBe(DEFAULT_BASE_URL));
	it('strips several trailing slashes', () =>
		expect(normalizeBaseUrl('http://localhost:4000//')).toBe('http://localhost:4000'));
});

describe('apiErrorMessage', () => {
	it('explains 401', () =>
		expect(apiErrorMessage(401)).toBe(
			'Invalid API key. Go to your Afforestation.org dashboard > API Keys to create or check your key.',
		));
	it('explains 403', () =>
		expect(apiErrorMessage(403)).toBe(
			'Your API key does not have permission for this action. Check the scopes on your key in the dashboard.',
		));
	it('explains 429', () =>
		expect(apiErrorMessage(429)).toBe('Rate limit exceeded. Please wait a moment and try again.'));
	it('leaves other statuses alone', () => expect(apiErrorMessage(500)).toBeUndefined());
});

describe('parseMetadata', () => {
	it('parses a JSON string', () => expect(parseMetadata('{"a":1}')).toEqual({ a: 1 }));
	it('passes an object through', () => expect(parseMetadata({ a: 1 })).toEqual({ a: 1 }));
	it('treats empty as absent', () => expect(parseMetadata('')).toBeUndefined());
	it('rejects invalid JSON', () =>
		expect(() => parseMetadata('{oops')).toThrow('Metadata must be valid JSON'));
});

describe('buildPlantTreesBody', () => {
	const msg = 'Number of Trees must be a whole number between 1 and 10,000';
	it('rejects bad counts', () => {
		for (const count of [0, 10001, 2.5, NaN]) {
			expect(() => buildPlantTreesBody({ count })).toThrow(msg);
		}
	});
	it('accepts the bounds', () => {
		expect(buildPlantTreesBody({ count: 1 })).toEqual({ count: 1 });
		expect(buildPlantTreesBody({ count: 10000 })).toEqual({ count: 10000 });
	});
	it('omits empty references', () =>
		expect(buildPlantTreesBody({ count: 3, referenceId: '', referenceType: '' })).toEqual({
			count: 3,
		}));
	it('includes references and parsed metadata', () =>
		expect(
			buildPlantTreesBody({
				count: 2,
				referenceId: 'o_1',
				referenceType: 'shopify_order',
				metadata: '{"c":"x"}',
			}),
		).toEqual({
			count: 2,
			referenceId: 'o_1',
			referenceType: 'shopify_order',
			metadata: { c: 'x' },
		}));
});

describe('buildImpactBody', () => {
	it('keeps zero', () =>
		expect(buildImpactBody({ treesPlanted: 0, co2OffsetKg: 500 })).toEqual({
			treesPlanted: 0,
			co2OffsetKg: 500,
		}));
	it('requires one value', () =>
		expect(() => buildImpactBody({ treesPlanted: '', co2OffsetKg: '' })).toThrow(
			'Enter Trees Planted, CO₂ Offset (Kilograms), or both',
		));
	it('drops an empty side', () =>
		expect(buildImpactBody({ treesPlanted: '', co2OffsetKg: 12.5 })).toEqual({
			co2OffsetKg: 12.5,
		}));
});

describe('flattenStats', () => {
	const base: StatsResponse = {
		total: { treesPlanted: 1250, co2OffsetKg: 27212 },
		thisMonth: { treesPlanted: 150, co2OffsetKg: 3265.5 },
		activeGoal: null,
	};
	it('nulls goal fields without a goal', () =>
		expect(flattenStats(base)).toEqual({
			totalTreesPlanted: 1250,
			totalCo2OffsetKg: 27212,
			monthlyTreesPlanted: 150,
			monthlyCo2OffsetKg: 3265.5,
			activeGoalType: null,
			activeGoalTarget: null,
			activeGoalCurrent: null,
			activeGoalEndDate: null,
		}));
	it('maps an active goal', () =>
		expect(
			flattenStats({
				...base,
				activeGoal: {
					goal_type: 'trees',
					target_value: 5000,
					current_value: 1250,
					end_date: '2026-12-31',
				},
			}),
		).toMatchObject({
			activeGoalType: 'trees',
			activeGoalTarget: 5000,
			activeGoalCurrent: 1250,
			activeGoalEndDate: '2026-12-31',
		}));
});

describe('mapImpactEntry', () => {
	const raw = {
		id: 42,
		source_type: 'api',
		trees_planted: 5,
		co2_offset_kg: '108.85',
		reference_id: 'order_1',
		reference_type: 'shopify_order',
		metadata: {},
		created_at: '2026-02-17T10:30:00Z',
	};
	it('camelCases and parses CO₂', () =>
		expect(mapImpactEntry(raw)).toEqual({
			id: 42,
			sourceType: 'api',
			treesPlanted: 5,
			co2OffsetKg: 108.85,
			referenceId: 'order_1',
			referenceType: 'shopify_order',
			metadata: {},
			createdAt: '2026-02-17T10:30:00Z',
		}));
	it('treats null CO₂ as 0', () =>
		expect(mapImpactEntry({ ...raw, co2_offset_kg: null }).co2OffsetKg).toBe(0));
});
