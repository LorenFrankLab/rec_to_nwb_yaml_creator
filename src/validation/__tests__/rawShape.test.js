import { describe, it, expect } from 'vitest';
import { validateRawDay, validateRawAnimal, RAW_DAY_ARRAY_FIELDS } from '../rawShape';

/**
 * Boundary 1 — raw persisted shape is validated BEFORE merge/normalization, so
 * corruption can't dissolve into export defaults (`[]` / snapshot fallback). Every
 * day-owned array field, when present but not an array, is a blocking, day-routed,
 * repairable issue carrying the explicit ownership contract (ownerSurface / repairStep /
 * focusPath).
 */
describe('validateRawDay — malformed day-owned collections', () => {
  it('flags every day-owned array field when it is a non-array (the laundering class)', () => {
    const day = {
      tasks: {},
      associated_files: 'x',
      associated_video_files: 42,
      behavioral_events: { 0: 'a' },
      keywords: 'kw',
    };
    const codes = validateRawDay(day);
    const flagged = codes.filter((i) => i.code === 'malformed_day_collection').map((i) => i.field);
    expect(flagged.sort()).toEqual(
      ['associated_files', 'associated_video_files', 'behavioral_events', 'keywords', 'tasks'].sort()
    );
  });

  it('every issue carries the explicit ownership contract (ownerSurface / repairStep / focusPath)', () => {
    const issue = validateRawDay({ tasks: {} })[0];
    expect(issue.ownerSurface).toBe('day');
    expect(issue.repairStep).toBe('epochs');
    expect(issue.focusPath).toBe('tasks');
    expect(issue.severity).toBe('error');
    // Legacy mirror fields kept until Boundary 2 migrates consumers.
    expect(issue.repairSurface).toBe('day');
    expect(issue.step).toBe('epochs');
    expect(issue.path).toBe('tasks');
  });

  it('routes keywords to the overview step', () => {
    const issue = validateRawDay({ keywords: 'oops' }).find((i) => i.field === 'keywords');
    expect(issue.repairStep).toBe('overview');
  });

  it('does NOT flag a well-formed (array) collection, nor an absent one', () => {
    const day = { tasks: [], associated_files: [{ name: 'f' }], keywords: undefined };
    expect(validateRawDay(day).some((i) => i.code === 'malformed_day_collection')).toBe(false);
  });

  it('treats null/undefined as "no collection" (not corrupt)', () => {
    expect(validateRawDay({ tasks: null, behavioral_events: undefined })).toEqual([]);
  });

  it('a non-record day returns no raw-shape issues (store-level corruption handled elsewhere)', () => {
    expect(validateRawDay('corrupt')).toEqual([]);
    expect(validateRawDay(null)).toEqual([]);
  });

  it('exposes the field spec list so consumers (UI reset controls) share one source', () => {
    expect(RAW_DAY_ARRAY_FIELDS.map((f) => f.key)).toContain('tasks');
    expect(RAW_DAY_ARRAY_FIELDS.every((f) => f.key && f.repairStep && f.label)).toBe(true);
  });
});

describe('validateRawAnimal — malformed animal-owned collections', () => {
  it('flags a non-array cameras / experimenters corruption as animal-routed', () => {
    const issue = validateRawAnimal({ cameras: 'nope' }).find((i) => i.field === 'cameras');
    expect(issue.code).toBe('malformed_animal_collection');
    expect(issue.ownerSurface).toBe('animal');
    expect(issue.severity).toBe('error');
  });

  it('does not flag well-formed animal collections', () => {
    expect(validateRawAnimal({ cameras: [], devices: { electrode_groups: [] } }).length).toBe(0);
  });

  it('a non-record animal returns no issues', () => {
    expect(validateRawAnimal(undefined)).toEqual([]);
  });
});
