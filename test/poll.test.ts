import { describe, expect, it } from 'vitest';
import type { ImpactEntryRaw } from '../nodes/shared/api';
import { selectNewEntries, statsKey } from '../nodes/shared/poll';

const entry = (id: number): ImpactEntryRaw => ({
	id,
	source_type: 'api',
	trees_planted: 1,
	co2_offset_kg: '21.77',
	reference_id: null,
	reference_type: null,
	metadata: {},
	created_at: `2026-11-18T10:00:${String(id).padStart(2, '0')}Z`,
});

describe('selectNewEntries', () => {
	it('emits new entries oldest first', () => {
		const out = selectNewEntries([entry(5), entry(4), entry(3)], 3);
		expect(out.emit.map((e) => e.id)).toEqual([4, 5]);
		expect(out.nextLastId).toBe(5);
		expect(out.nextSince).toBe(entry(5).created_at);
	});

	it('emits nothing when everything was seen', () => {
		const out = selectNewEntries([entry(3), entry(2)], 3);
		expect(out.emit).toEqual([]);
		expect(out.nextLastId).toBe(3);
		expect(out.nextSince).toBeUndefined();
	});
});

describe('statsKey', () => {
	it('combines trees and rounded CO₂', () =>
		expect(
			statsKey({
				total: { treesPlanted: 1250, co2OffsetKg: 27211.6 },
				thisMonth: { treesPlanted: 0, co2OffsetKg: 0 },
				activeGoal: null,
			}),
		).toBe('1250_27212'));
});
