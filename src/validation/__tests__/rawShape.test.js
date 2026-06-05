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

  it('carries an executable resetDayCollection repairCommand naming the corrupt field', () => {
    const issue = validateRawDay({ tasks: {} }).find((i) => i.field === 'tasks');
    expect(issue.repairCommand).toEqual({ type: 'resetDayCollection', field: 'tasks' });
  });

  it('every malformed day collection carries a resetDayCollection command for its field', () => {
    const day = {
      tasks: {},
      associated_files: 'x',
      associated_video_files: 42,
      behavioral_events: { 0: 'a' },
      keywords: 'kw',
    };
    for (const issue of validateRawDay(day)) {
      expect(issue.repairCommand).toEqual({ type: 'resetDayCollection', field: issue.field });
    }
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

  it('attaches a resetAnimalCameras command to corrupt cameras', () => {
    const issue = validateRawAnimal({ cameras: 'nope' }).find((i) => i.field === 'cameras');
    expect(issue.repairCommand).toEqual({ type: 'resetAnimalCameras' });
  });

  it('attaches a rebuildConfigurationHistory command to a corrupt configurationHistory', () => {
    const issue = validateRawAnimal({ configurationHistory: 'corrupt' }).find(
      (i) => i.field === 'configurationHistory'
    );
    expect(issue.repairCommand).toEqual({ type: 'rebuildConfigurationHistory' });
  });

  it('attaches a resetDataAcqDevice command to a corrupt nested data_acq_device', () => {
    const issue = validateRawAnimal({
      configurationHistory: [{ version: 1 }],
      devices: { data_acq_device: 'nope' },
    }).find((i) => i.field === 'data_acq_device');
    expect(issue.repairCommand).toEqual({ type: 'resetDataAcqDevice' });
  });

  it('does not flag well-formed animal collections', () => {
    expect(
      validateRawAnimal({ cameras: [], configurationHistory: [{ version: 1 }], devices: { electrode_groups: [] } })
        .length
    ).toBe(0);
  });

  it('a non-record animal returns no issues', () => {
    expect(validateRawAnimal(undefined)).toEqual([]);
  });

  it('does NOT flag a MISSING configurationHistory (it fails closed via the merge throw, not laundering)', () => {
    // Per the raw-shape contract, this path guards only laundering shapes; an absent
    // configurationHistory is handled by the merge-throw tolerance + ValidationSummary chip,
    // and flagging it here would false-fire on minimal animal stubs.
    expect(validateRawAnimal({ cameras: [] }).some((i) => i.code === 'missing_configuration_history')).toBe(false);
  });

  it('flags a corrupt nested devices.data_acq_device with a precise animal-routed message', () => {
    const issue = validateRawAnimal({ configurationHistory: [{ version: 1 }], devices: { data_acq_device: 'nope' } })
      .find((i) => i.field === 'data_acq_device');
    expect(issue).toBeTruthy();
    expect(issue.code).toBe('malformed_animal_collection');
    expect(issue.ownerSurface).toBe('animal');
  });

});
