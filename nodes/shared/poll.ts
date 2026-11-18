import type { ImpactEntryRaw, StatsResponse } from './api';

export function selectNewEntries(
	entries: ImpactEntryRaw[],
	lastId: number,
): { emit: ImpactEntryRaw[]; nextLastId: number; nextSince?: string } {
	const unique = new Map<number, ImpactEntryRaw>();
	for (const e of entries) if (e.id > lastId) unique.set(e.id, e);
	const emit = [...unique.values()].sort((a, b) => a.id - b.id);
	const newest = emit[emit.length - 1];
	return newest
		? { emit, nextLastId: newest.id, nextSince: newest.created_at }
		: { emit, nextLastId: lastId };
}

export function statsKey(s: StatsResponse): string {
	return `${s.total.treesPlanted}_${Math.round(s.total.co2OffsetKg)}`;
}
