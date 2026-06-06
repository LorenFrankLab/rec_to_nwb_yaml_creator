import { describe, it, expect, vi } from 'vitest';
import { applyRepairCommand, REPAIR_COMMAND_TYPES } from '../repairCommands';

/**
 * The executor maps a serializable repairCommand to a store write. These tests use a mock
 * `actions` object (the store's real surface) and assert each command type lands the exact
 * mutation the repairability contract documents — the same one the matrix proves clears the
 * issue. Unknown / malformed commands are no-ops (never throw, never write).
 */

const makeActions = () => ({
  updateDay: vi.fn(),
  updateAnimal: vi.fn(),
  rebuildConfigurationHistory: vi.fn(),
});

const ctx = (overrides = {}) => ({
  actions: makeActions(),
  animalId: 'remy',
  dayId: 'remy-2023-06-22',
  day: {},
  animal: {},
  ...overrides,
});

describe('applyRepairCommand — day-collection resets', () => {
  it('resetDayCollection writes an empty array to the named day field', () => {
    const c = ctx();
    applyRepairCommand({ type: 'resetDayCollection', field: 'tasks' }, c);
    expect(c.actions.updateDay).toHaveBeenCalledWith('remy-2023-06-22', { tasks: [] });
  });

  it('resetDayCollection works for every raw day collection field (incl. fs_gui_yamls/keywords)', () => {
    for (const field of ['tasks', 'associated_files', 'associated_video_files', 'behavioral_events', 'fs_gui_yamls', 'keywords']) {
      const c = ctx();
      applyRepairCommand({ type: 'resetDayCollection', field }, c);
      expect(c.actions.updateDay).toHaveBeenCalledWith('remy-2023-06-22', { [field]: [] });
    }
  });

  it('resetDayCollection with a missing field is a no-op', () => {
    const c = ctx();
    applyRepairCommand({ type: 'resetDayCollection' }, c);
    expect(c.actions.updateDay).not.toHaveBeenCalled();
  });
});

describe('applyRepairCommand — animal-collection resets', () => {
  it('resetAnimalCameras resets the animal cameras to []', () => {
    const c = ctx();
    applyRepairCommand({ type: 'resetAnimalCameras' }, c);
    expect(c.actions.updateAnimal).toHaveBeenCalledWith('remy', { cameras: [] });
  });

  it('resetDataAcqDevice resets the animal data_acq_device to []', () => {
    const c = ctx();
    applyRepairCommand({ type: 'resetDataAcqDevice' }, c);
    expect(c.actions.updateAnimal).toHaveBeenCalledWith('remy', { data_acq_device: [] });
  });

  it('rebuildConfigurationHistory delegates to the store action', () => {
    const c = ctx();
    applyRepairCommand({ type: 'rebuildConfigurationHistory' }, c);
    expect(c.actions.rebuildConfigurationHistory).toHaveBeenCalledWith('remy');
  });
});

describe('applyRepairCommand — device-override resets (partial, read current day)', () => {
  it('resetDeviceOverrides clears all overrides to an empty record', () => {
    const c = ctx({ day: { deviceOverrides: 'corrupt' } });
    applyRepairCommand({ type: 'resetDeviceOverrides' }, c);
    expect(c.actions.updateDay).toHaveBeenCalledWith('remy-2023-06-22', { deviceOverrides: {} });
  });

  it('removeDeviceOverrideKey drops just the named geometry key, preserving siblings', () => {
    const c = ctx({
      day: { deviceOverrides: { electrode_groups: 'corrupt', bad_channels: { 1: [0] } } },
    });
    applyRepairCommand({ type: 'removeDeviceOverrideKey', key: 'electrode_groups' }, c);
    expect(c.actions.updateDay).toHaveBeenCalledWith('remy-2023-06-22', {
      deviceOverrides: { bad_channels: { 1: [0] } },
    });
  });

  it('resetBadChannelOverrides drops the whole bad_channels container, preserving geometry', () => {
    const c = ctx({
      day: { deviceOverrides: { electrode_groups: [{ id: 0 }], bad_channels: '2.9' } },
    });
    applyRepairCommand({ type: 'resetBadChannelOverrides' }, c);
    expect(c.actions.updateDay).toHaveBeenCalledWith('remy-2023-06-22', {
      deviceOverrides: { electrode_groups: [{ id: 0 }] },
    });
  });

  it('removeBadChannelOverrideKey drops just the named ntrode key', () => {
    const c = ctx({
      day: { deviceOverrides: { bad_channels: { 1: [0], 999: [3] } } },
    });
    applyRepairCommand({ type: 'removeBadChannelOverrideKey', key: '999' }, c);
    expect(c.actions.updateDay).toHaveBeenCalledWith('remy-2023-06-22', {
      deviceOverrides: { bad_channels: { 1: [0] } },
    });
  });

  it('override resets tolerate a non-record deviceOverrides start (no throw)', () => {
    const c = ctx({ day: { deviceOverrides: 'corrupt' } });
    expect(() => applyRepairCommand({ type: 'removeDeviceOverrideKey', key: 'electrode_groups' }, c)).not.toThrow();
    // Nothing left to remove → an empty overrides record.
    expect(c.actions.updateDay).toHaveBeenCalledWith('remy-2023-06-22', { deviceOverrides: {} });
  });
});

describe('applyRepairCommand — reset day session', () => {
  it('resetDaySession writes a fresh session with the canonical derived session_id', () => {
    const c = ctx({ animal: { id: 'remy' }, day: { date: '2023-06-22', session: 'corrupt' } });
    applyRepairCommand({ type: 'resetDaySession' }, c);
    expect(c.actions.updateDay).toHaveBeenCalledWith('remy-2023-06-22', {
      session: { session_id: 'remy_20230622' },
    });
  });

  it('resetDaySession derives the session_id from the day\'s own animalId, not a corrupt animal.id', () => {
    // The day's `animalId` is the reliable owner; a corrupt animal.id (and ctx animalId) must
    // NOT poison the session prefix (which would produce e.g. `WRONG_…`).
    const c = ctx({
      animal: { id: 'WRONG' },
      animalId: 'WRONG',
      day: { animalId: 'remy', date: '2023-06-22', session: 'corrupt' },
      dayId: 'remy-2023-06-22',
    });
    applyRepairCommand({ type: 'resetDaySession' }, c);
    expect(c.actions.updateDay).toHaveBeenCalledWith('remy-2023-06-22', {
      session: { session_id: 'remy_20230622' },
    });
  });

  it('resetDaySession recovers the canonical session_id from ctx.animalId/dayId alone', () => {
    // The executor's documented ctx carries animalId/dayId; animal/day are conveniences.
    // With no animal/day objects it must still derive the canonical session_id from the ids
    // (dayId is `<animalId>-<YYYY-MM-DD>`), not a degraded "_".
    const c = ctx({ animal: undefined, day: undefined, animalId: 'remy', dayId: 'remy-2023-06-22' });
    expect(() => applyRepairCommand({ type: 'resetDaySession' }, c)).not.toThrow();
    expect(c.actions.updateDay).toHaveBeenCalledWith('remy-2023-06-22', {
      session: { session_id: 'remy_20230622' },
    });
  });
});

describe('applyRepairCommand — surface-id guards (missing id → no-op, never a throw)', () => {
  it('a DAY command with no dayId is a no-op (does not call updateDay(undefined) which would throw)', () => {
    const c = ctx({ dayId: undefined });
    expect(() => applyRepairCommand({ type: 'resetDayCollection', field: 'tasks' }, c)).not.toThrow();
    expect(c.actions.updateDay).not.toHaveBeenCalled();
  });

  it('a bad-channel DAY command with no dayId is a no-op', () => {
    const c = ctx({ dayId: undefined, day: { deviceOverrides: { bad_channels: { 1: [0] } } } });
    expect(() => applyRepairCommand({ type: 'resetBadChannelOverrides' }, c)).not.toThrow();
    expect(c.actions.updateDay).not.toHaveBeenCalled();
  });

  it('an ANIMAL command with no animalId is a no-op', () => {
    const c = ctx({ animalId: undefined });
    expect(() => applyRepairCommand({ type: 'resetAnimalCameras' }, c)).not.toThrow();
    expect(c.actions.updateAnimal).not.toHaveBeenCalled();
  });
});

describe('applyRepairCommand — robustness', () => {
  it('an unknown command type is a no-op (no write, no throw)', () => {
    const c = ctx();
    expect(() => applyRepairCommand({ type: 'nonsense' }, c)).not.toThrow();
    expect(c.actions.updateDay).not.toHaveBeenCalled();
    expect(c.actions.updateAnimal).not.toHaveBeenCalled();
    expect(c.actions.rebuildConfigurationHistory).not.toHaveBeenCalled();
  });

  it('a null / missing command is a no-op', () => {
    const c = ctx();
    expect(() => applyRepairCommand(null, c)).not.toThrow();
    expect(() => applyRepairCommand(undefined, c)).not.toThrow();
    expect(c.actions.updateDay).not.toHaveBeenCalled();
  });

  it('every declared command type has a handler that performs a write', () => {
    // Structural guard: REPAIR_COMMAND_TYPES is the canonical set, and each must do
    // something (so a new type can never be added without an executor branch).
    const writeFields = {
      resetDayCollection: { field: 'tasks' },
      removeDeviceOverrideKey: { key: 'electrode_groups' },
      removeBadChannelOverrideKey: { key: '1' },
    };
    for (const type of REPAIR_COMMAND_TYPES) {
      const c = ctx({ day: { deviceOverrides: { electrode_groups: 'x', bad_channels: { 1: [0] } } } });
      applyRepairCommand({ type, ...(writeFields[type] || {}) }, c);
      const wrote =
        c.actions.updateDay.mock.calls.length +
        c.actions.updateAnimal.mock.calls.length +
        c.actions.rebuildConfigurationHistory.mock.calls.length;
      expect(wrote, `command "${type}" performed no store write`).toBeGreaterThan(0);
    }
  });

  it('every declared command type has a surface-id guard wired (day/animal), so a missing id no-ops', () => {
    // Structural guard: a new command type can't be added without declaring its owning
    // surface, so the "missing id → no-op, never updateDay(undefined)" contract holds for it.
    const writeFields = {
      resetDayCollection: { field: 'tasks' },
      removeDeviceOverrideKey: { key: 'electrode_groups' },
      removeBadChannelOverrideKey: { key: '1' },
    };
    for (const type of REPAIR_COMMAND_TYPES) {
      const c = ctx({ animalId: undefined, dayId: undefined, day: undefined, animal: undefined });
      expect(() => applyRepairCommand({ type, ...(writeFields[type] || {}) }, c)).not.toThrow();
      const wrote =
        c.actions.updateDay.mock.calls.length +
        c.actions.updateAnimal.mock.calls.length +
        c.actions.rebuildConfigurationHistory.mock.calls.length;
      expect(wrote, `command "${type}" wrote despite a missing surface id (no guard?)`).toBe(0);
    }
  });
});
