export const DEFAULT_BASE_URL = 'https://afforestation.org';

const ERROR_MESSAGES: Record<number, string> = {
	401: 'Invalid API key. Go to your Afforestation.org dashboard > API Keys to create or check your key.',
	403: 'Your API key does not have permission for this action. Check the scopes on your key in the dashboard.',
	429: 'Rate limit exceeded. Please wait a moment and try again.',
};

export function normalizeBaseUrl(raw?: string): string {
	const trimmed = (raw ?? '').trim().replace(/\/+$/, '');
	return trimmed || DEFAULT_BASE_URL;
}

export function apiErrorMessage(status: number): string | undefined {
	return ERROR_MESSAGES[status];
}

const INVALID = Symbol('invalid');

function tryParseJson(raw: string): unknown {
	try {
		return JSON.parse(raw);
	} catch {
		return INVALID;
	}
}

export function parseMetadata(raw: unknown): Record<string, unknown> | undefined {
	if (raw === undefined || raw === null || raw === '') return undefined;
	if (typeof raw === 'object') return raw as Record<string, unknown>;
	if (typeof raw !== 'string') throw new Error('Metadata must be valid JSON');
	const parsed = tryParseJson(raw);
	if (
		parsed === INVALID ||
		parsed === null ||
		typeof parsed !== 'object' ||
		Array.isArray(parsed)
	) {
		throw new Error('Metadata must be valid JSON');
	}
	return parsed as Record<string, unknown>;
}

interface References {
	referenceId?: string;
	referenceType?: string;
	metadata?: Record<string, unknown>;
}

function withReferences<T extends object>(
	body: T,
	i: { referenceId?: string; referenceType?: string; metadata?: unknown },
): T & References {
	const out: T & References = { ...body };
	if (i.referenceId) out.referenceId = i.referenceId;
	if (i.referenceType) out.referenceType = i.referenceType;
	const metadata = parseMetadata(i.metadata);
	if (metadata) out.metadata = metadata;
	return out;
}

export function buildPlantTreesBody(i: {
	count: number;
	referenceId?: string;
	referenceType?: string;
	metadata?: unknown;
}): { count: number } & References {
	const { count } = i;
	if (!Number.isInteger(count) || count < 1 || count > 10000) {
		throw new Error('Number of Trees must be a whole number between 1 and 10,000');
	}
	return withReferences({ count }, i);
}

const isSet = (v: unknown): v is number => v !== undefined && v !== null && v !== '';

export function buildImpactBody(i: {
	treesPlanted?: number | '';
	co2OffsetKg?: number | '';
	referenceId?: string;
	referenceType?: string;
	metadata?: unknown;
}): { treesPlanted?: number; co2OffsetKg?: number } & References {
	const body: { treesPlanted?: number; co2OffsetKg?: number } = {};
	if (isSet(i.treesPlanted)) body.treesPlanted = Number(i.treesPlanted);
	if (isSet(i.co2OffsetKg)) body.co2OffsetKg = Number(i.co2OffsetKg);
	if (body.treesPlanted === undefined && body.co2OffsetKg === undefined) {
		throw new Error('Enter Trees Planted, CO₂ Offset (Kilograms), or both');
	}
	return withReferences(body, i);
}

export type StatsResponse = {
	total: { treesPlanted: number; co2OffsetKg: number };
	thisMonth: { treesPlanted: number; co2OffsetKg: number };
	activeGoal: {
		goal_type: string;
		target_value: number;
		current_value: number;
		end_date?: string;
	} | null;
};

export type FlatStats = {
	totalTreesPlanted: number;
	totalCo2OffsetKg: number;
	monthlyTreesPlanted: number;
	monthlyCo2OffsetKg: number;
	activeGoalType: string | null;
	activeGoalTarget: number | null;
	activeGoalCurrent: number | null;
	activeGoalEndDate: string | null;
};

export function flattenStats(s: StatsResponse): FlatStats {
	const goal = s.activeGoal;
	return {
		totalTreesPlanted: s.total.treesPlanted,
		totalCo2OffsetKg: s.total.co2OffsetKg,
		monthlyTreesPlanted: s.thisMonth.treesPlanted,
		monthlyCo2OffsetKg: s.thisMonth.co2OffsetKg,
		activeGoalType: goal?.goal_type ?? null,
		activeGoalTarget: goal?.target_value ?? null,
		activeGoalCurrent: goal?.current_value ?? null,
		activeGoalEndDate: goal?.end_date ?? null,
	};
}

export type ImpactEntryRaw = {
	id: number;
	source_type: string;
	trees_planted: number;
	co2_offset_kg: string | number | null;
	reference_id: string | null;
	reference_type: string | null;
	metadata: unknown;
	created_at: string;
};

export type ImpactEntry = {
	id: number;
	sourceType: string;
	treesPlanted: number;
	co2OffsetKg: number;
	referenceId: string | null;
	referenceType: string | null;
	metadata: unknown;
	createdAt: string;
};

export function mapImpactEntry(e: ImpactEntryRaw): ImpactEntry {
	return {
		id: e.id,
		sourceType: e.source_type,
		treesPlanted: e.trees_planted,
		co2OffsetKg: parseFloat(String(e.co2_offset_kg || 0)),
		referenceId: e.reference_id,
		referenceType: e.reference_type,
		metadata: e.metadata,
		createdAt: e.created_at,
	};
}
