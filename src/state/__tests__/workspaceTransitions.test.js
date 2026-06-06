/**
 * Pure workspace transitions preserve the configuration invariants the store relied on when
 * this logic lived inline in `useWorkspace`: a device edit mirrors ONLY the latest snapshot,
 * reconfiguration pins days and keeps `appliedToDays` a partition, history rebuild clears the
 * raw-shape corruption without pretending stale pins are re-applied, and a day update writes a
 * clean record over a malformed nested session.
 */
import { describe, it, expect } from 'vitest';
import {
  applyAnimalUpdates,
  addConfigurationSnapshotToAnimal,
  applyConfigurationForwardToAnimal,
  rebuildConfigurationHistoryForAnimal,
  createDayRecord,
  applyDayUpdates,
} from '../workspaceTransitions';

const NOW = '2026-06-05T00:00:00.000Z';
const TODAY = '2026-06-05';

const emptyDevices = () => ({
  electrode_groups: [],
  ntrode_electrode_group_channel_map: [],
  data_acq_device: [],
});

describe('applyAnimalUpdates', () => {
  it('mirrors a devices edit into the LATEST snapshot only, never a historical one', () => {
    const animal = {
      id: 'remy',
      devices: emptyDevices(),
      configurationHistory: [
        { version: 1, devices: { electrode_groups: [{ id: 0, historical: true }], ntrode_electrode_group_channel_map: [] }, appliedToDays: [] },
        { version: 2, devices: { electrode_groups: [], ntrode_electrode_group_channel_map: [] }, appliedToDays: [] },
      ],
    };

    const updated = applyAnimalUpdates(
      animal,
      { devices: { ...emptyDevices(), electrode_groups: [{ id: 0 }, { id: 1 }] } },
      NOW
    );

    // Latest (v2) snapshot mirrors the new electrode geometry…
    expect(updated.configurationHistory[1].devices.electrode_groups)
      .toEqual(updated.devices.electrode_groups);
    expect(updated.devices.electrode_groups).toHaveLength(2);
    // …the historical (v1) snapshot is frozen…
    expect(updated.configurationHistory[0].devices.electrode_groups)
      .toEqual([{ id: 0, historical: true }]);
    // …and the input is not mutated.
    expect(animal.configurationHistory[1].devices.electrode_groups).toEqual([]);
    expect(updated.lastModified).toBe(NOW);
  });

  it('clears optogenetics on an explicit null (editor disable)', () => {
    const animal = { id: 'remy', optogenetics: { foo: 1 }, configurationHistory: [] };
    expect(applyAnimalUpdates(animal, { optogenetics: null }, NOW).optogenetics).toBeNull();
  });
});

describe('addConfigurationSnapshotToAnimal', () => {
  it('appends a sequentially-numbered snapshot', () => {
    const animal = { configurationHistory: [{ version: 1, appliedToDays: [] }] };
    const updated = addConfigurationSnapshotToAnimal(
      animal,
      { date: '2023-07-01', description: 'reconfig', devices: emptyDevices() },
      NOW
    );
    expect(updated.configurationHistory).toHaveLength(2);
    expect(updated.configurationHistory[1].version).toBe(2);
    expect(animal.configurationHistory).toHaveLength(1); // input untouched
  });
});

describe('applyConfigurationForwardToAnimal', () => {
  const base = () => ({
    id: 'remy',
    configurationHistory: [
      { version: 1, appliedToDays: ['d1', 'd2'] },
      { version: 2, appliedToDays: [] },
    ],
  });
  const days = () => ({ d1: { id: 'd1' }, d2: { id: 'd2' } });

  it('pins the moved days and keeps appliedToDays a clean partition', () => {
    const { animal, days: nextDays } = applyConfigurationForwardToAnimal(base(), days(), 2, ['d2'], NOW);
    expect(nextDays.d2.configurationVersion).toBe(2);
    expect(animal.configurationHistory[1].appliedToDays).toEqual(['d2']);
    expect(animal.configurationHistory[0].appliedToDays).toEqual(['d1']); // d2 removed from v1
  });

  it('drops day ids that do not exist in the workspace', () => {
    const { animal } = applyConfigurationForwardToAnimal(base(), days(), 2, ['nope'], NOW);
    expect(animal.configurationHistory[1].appliedToDays).toEqual([]);
  });

  it('throws on a non-existent snapshot version', () => {
    expect(() => applyConfigurationForwardToAnimal(base(), days(), 99, ['d2'], NOW))
      .toThrow(/Configuration version "99" not found/);
  });
});

describe('rebuildConfigurationHistoryForAnimal', () => {
  it('rebuilds a corrupt history to a single v1 from current devices, re-pinning nothing', () => {
    const animal = {
      id: 'remy',
      devices: { ...emptyDevices(), electrode_groups: [{ id: 0 }] },
      configurationHistory: 'corrupt',
    };
    const updated = rebuildConfigurationHistoryForAnimal(animal, NOW, TODAY);
    // Only version 1 exists; there is no mechanism here to re-pin a day to a gone version.
    expect(updated.configurationHistory.map((s) => s.version)).toEqual([1]);
    expect(updated.configurationHistory[0].devices.electrode_groups).toEqual([{ id: 0 }]);
    expect(updated.configurationHistory[0].appliedToDays).toEqual([]);
  });

  it('tolerates missing devices (empty arrays)', () => {
    const updated = rebuildConfigurationHistoryForAnimal({ id: 'x' }, NOW, TODAY);
    expect(updated.configurationHistory[0].devices.electrode_groups).toEqual([]);
    expect(updated.configurationHistory[0].devices.ntrode_electrode_group_channel_map).toEqual([]);
  });
});

describe('createDayRecord', () => {
  it('pins the day to the latest configuration version and seeds technical defaults', () => {
    const animal = {
      technicalDefaults: { raw_data_to_volts: 0.3, times_period_multiplier: 2 },
      configurationHistory: [{ version: 1 }, { version: 2 }],
    };
    const day = createDayRecord(animal, 'remy', 'remy-2023-06-22', '2023-06-22', { session_id: 's' }, NOW);
    expect(day.configurationVersion).toBe(2); // latest = history length
    expect(day.technical.raw_data_to_volts).toBe(0.3);
    expect(day.technical.times_period_multiplier).toBe(2);
    expect(day.state).toEqual({ draft: true, validated: false, exported: false });
  });

  it('falls back to standard technical values when no defaults are set', () => {
    const day = createDayRecord({ configurationHistory: [] }, 'remy', 'd', '2023-06-22', {}, NOW);
    expect(day.technical.raw_data_to_volts).toBe(0.195);
    expect(day.technical.times_period_multiplier).toBe(1.5);
    expect(day.configurationVersion).toBe(0);
  });
});

describe('applyDayUpdates', () => {
  it('writes a clean session over a malformed (scalar) one without char-indexed keys', () => {
    const updated = applyDayUpdates({ id: 'd1', session: 'corrupt' }, { session: { session_id: 'x' } }, NOW);
    expect(updated.session).toEqual({ session_id: 'x' });
  });

  it('deep-merges a well-formed session', () => {
    const day = { id: 'd1', session: { session_id: 'a', session_description: 'd' } };
    const updated = applyDayUpdates(day, { session: { session_description: 'new' } }, NOW);
    expect(updated.session).toEqual({ session_id: 'a', session_description: 'new' });
    expect(day.session.session_description).toBe('d'); // input untouched
  });
});
