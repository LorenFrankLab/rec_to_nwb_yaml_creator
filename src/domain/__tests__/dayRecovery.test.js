/**
 * Day recovery-status model (Phase 8.6). The single domain classifier every surface consumes
 * so "safe to render" and "safe to trust" stop being decided per-surface. Each day reference /
 * record carries ONE explicit status with ONE export policy:
 *   - ok                  → in the animal's index AND a real record → exportable
 *   - dangling_reference  → indexed id with no record → not exportable (repair: remove reference)
 *   - recovered_unlinked  → real record, owner present, NOT in the index → must relink before export
 *   - orphan_no_owner     → real record whose owning animal is gone → not exportable
 */
import { describe, it, expect } from 'vitest';
import {
  DAY_STATUS,
  isExportableDayStatus,
  classifyAnimalDays,
  classifyWorkspaceDays,
} from '../dayRecovery';

const dayRecord = (id, animalId, date) => ({ id, animalId, date, session: { session_id: id } });

describe('isExportableDayStatus', () => {
  it('permits ONLY ok days (recovered/dangling/no-owner are not auto-exportable)', () => {
    expect(isExportableDayStatus(DAY_STATUS.OK)).toBe(true);
    expect(isExportableDayStatus(DAY_STATUS.RECOVERED_UNLINKED)).toBe(false);
    expect(isExportableDayStatus(DAY_STATUS.DANGLING_REFERENCE)).toBe(false);
    expect(isExportableDayStatus(DAY_STATUS.ORPHAN_NO_OWNER)).toBe(false);
  });
});

describe('classifyAnimalDays', () => {
  it('classifies indexed-present as ok and indexed-missing as dangling', () => {
    const animal = { id: 'remy', days: ['remy-1', 'remy-2'] };
    const days = { 'remy-1': dayRecord('remy-1', 'remy', '2023-06-22') };
    const result = classifyAnimalDays('remy', animal, days);
    expect(result).toEqual([
      { dayId: 'remy-1', record: days['remy-1'], status: DAY_STATUS.OK },
      { dayId: 'remy-2', record: null, status: DAY_STATUS.DANGLING_REFERENCE },
    ]);
  });

  it('classifies a record that belongs to the animal but is not in the index as recovered_unlinked', () => {
    const animal = { id: 'remy', days: [] };
    const days = { 'remy-1': dayRecord('remy-1', 'remy', '2023-06-22') };
    const result = classifyAnimalDays('remy', animal, days);
    expect(result).toEqual([
      { dayId: 'remy-1', record: days['remy-1'], status: DAY_STATUS.RECOVERED_UNLINKED },
    ]);
  });

  it('recovers records even when the index is corrupt (non-array) or missing', () => {
    const days = { 'remy-1': dayRecord('remy-1', 'remy', '2023-06-22') };
    expect(classifyAnimalDays('remy', { id: 'remy', days: 'corrupt' }, days)).toEqual([
      { dayId: 'remy-1', record: days['remy-1'], status: DAY_STATUS.RECOVERED_UNLINKED },
    ]);
    expect(classifyAnimalDays('remy', { id: 'remy' }, days)).toEqual([
      { dayId: 'remy-1', record: days['remy-1'], status: DAY_STATUS.RECOVERED_UNLINKED },
    ]);
  });

  it('does not claim a record owned by a different animal', () => {
    const days = { 'other-1': dayRecord('other-1', 'other', '2023-06-22') };
    expect(classifyAnimalDays('remy', { id: 'remy', days: [] }, days)).toEqual([]);
  });
});

describe('classifyWorkspaceDays', () => {
  it('flattens all animals (indexed first) then sweeps orphans, classifying owner presence', () => {
    const workspace = {
      animals: {
        remy: { id: 'remy', days: ['remy-1'] },
      },
      days: {
        'remy-1': dayRecord('remy-1', 'remy', '2023-06-22'),
        'remy-2': dayRecord('remy-2', 'remy', '2023-06-23'), // record exists, not indexed
        'ghost-1': dayRecord('ghost-1', 'ghost', '2023-06-24'), // owner missing
      },
    };
    const result = classifyWorkspaceDays(workspace);
    const byId = Object.fromEntries(result.map((r) => [r.dayId, r]));
    expect(byId['remy-1'].status).toBe(DAY_STATUS.OK);
    expect(byId['remy-2'].status).toBe(DAY_STATUS.RECOVERED_UNLINKED);
    expect(byId['remy-2'].animalKey).toBe('remy');
    expect(byId['ghost-1'].status).toBe(DAY_STATUS.ORPHAN_NO_OWNER);
    expect(byId['ghost-1'].ownerPresent).toBe(false);
    // Indexed rows come before the orphan sweep.
    expect(result[0].dayId).toBe('remy-1');
  });

  it('tolerates a corrupt animals/days shape without throwing', () => {
    expect(() => classifyWorkspaceDays({})).not.toThrow();
    expect(classifyWorkspaceDays({ animals: {}, days: 'nope' })).toEqual([]);
  });
});
