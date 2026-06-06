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
  nextConfigurationVersion,
  createSnapshotAndApplyForward,
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

  it('applies a devices edit to animal.devices even with no configuration history (no mirror)', () => {
    const animal = { id: 'remy', devices: emptyDevices(), configurationHistory: [] };
    const updated = applyAnimalUpdates(
      animal,
      { devices: { ...emptyDevices(), electrode_groups: [{ id: 0 }] } },
      NOW
    );
    expect(updated.devices.electrode_groups).toHaveLength(1);
    expect(updated.configurationHistory).toEqual([]); // nothing to mirror into
  });

  it('routes a data_acq_device edit onto animal.devices (the export read location)', () => {
    const animal = { id: 'remy', devices: emptyDevices(), configurationHistory: [] };
    const acq = [{ name: 'SpikeGadgets', system: 'MCU', amplifier: 'Intan', adc_circuit: 'Intan' }];
    const updated = applyAnimalUpdates(animal, { data_acq_device: acq }, NOW);
    expect(updated.devices.data_acq_device).toEqual(acq);
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

  it('preserves snapshot metadata and normalizes the probe device payload', () => {
    const animal = { configurationHistory: [{ version: 1, appliedToDays: [] }] };
    const updated = addConfigurationSnapshotToAnimal(
      animal,
      {
        date: '2023-06-15',
        description: 'Lowered CA1 tetrodes by 40um',
        devices: {
          electrode_groups: [
            {
              id: '0',
              location: ' CA1 ',
              device_type: 'tetrode_12.5',
              description: 'CA1 tetrode',
              targeted_location: ' CA1 ',
              targeted_z: '1.96',
              units: ' mm ',
            },
          ],
          ntrode_electrode_group_channel_map: [
            {
              ntrode_id: '0',
              electrode_group_id: '0',
              map: { 0: '0', 1: '1', 2: '2', 3: '3' },
              bad_channels: ['2', 2, '3'],
            },
          ],
        },
      },
      NOW
    );

    const snapshot = updated.configurationHistory[1];
    expect(snapshot.date).toBe('2023-06-15');
    expect(snapshot.description).toBe('Lowered CA1 tetrodes by 40um');
    expect(snapshot.devices.electrode_groups[0]).toEqual({
      id: 0,
      location: 'CA1',
      device_type: 'tetrode_12.5',
      description: 'CA1 tetrode',
      targeted_location: 'CA1',
      targeted_z: 1.96,
      units: 'mm',
    });
    expect(snapshot.devices.ntrode_electrode_group_channel_map[0]).toEqual({
      ntrode_id: 0,
      electrode_group_id: 0,
      map: { 0: 0, 1: 1, 2: 2, 3: 3 },
      bad_channels: [2, 3],
    });
  });

  it('numbers version 1 when the prior history is corrupt/missing', () => {
    const updated = addConfigurationSnapshotToAnimal(
      { configurationHistory: 'corrupt' },
      { date: '2023-07-01', description: 'rebuild', devices: emptyDevices() },
      NOW
    );
    expect(updated.configurationHistory).toHaveLength(1);
    expect(updated.configurationHistory[0].version).toBe(1);
  });

  it('allocates max(version)+1 so a non-contiguous history never duplicates a version', () => {
    // [1, 3] must append 4, not another 3 — a duplicate would let first-match resolution
    // (applyConfigurationForwardToAnimal / resolveDayConfig) target the wrong snapshot.
    const updated = addConfigurationSnapshotToAnimal(
      { configurationHistory: [{ version: 1, appliedToDays: [] }, { version: 3, appliedToDays: [] }] },
      { date: '2023-07-01', description: 'reconfig', devices: emptyDevices() },
      NOW
    );
    expect(updated.configurationHistory.map((s) => s.version)).toEqual([1, 3, 4]);
  });
});

describe('nextConfigurationVersion', () => {
  it('returns max(version)+1, and 1 for an empty/corrupt history', () => {
    expect(nextConfigurationVersion([{ version: 1 }, { version: 3 }])).toBe(4);
    expect(nextConfigurationVersion([{ version: 1 }, { version: 2 }])).toBe(3);
    expect(nextConfigurationVersion([])).toBe(1);
    expect(nextConfigurationVersion('corrupt')).toBe(1);
  });
});

describe('createSnapshotAndApplyForward', () => {
  const animal = () => ({
    id: 'remy',
    configurationHistory: [{ version: 1, appliedToDays: ['d1', 'd2'] }],
  });
  const days = () => ({ d1: { id: 'd1' }, d2: { id: 'd2' } });

  it('appends a new version AND pins the given days to it in one transition', () => {
    const result = createSnapshotAndApplyForward(
      animal(),
      days(),
      { date: '2023-07-01', description: 'reconfig', devices: emptyDevices() },
      ['d2'],
      NOW
    );
    expect(result.version).toBe(2);
    expect(result.animal.configurationHistory.map((s) => s.version)).toEqual([1, 2]);
    // The new version owns the moved day; v1 keeps the rest (clean partition).
    expect(result.animal.configurationHistory[1].appliedToDays).toEqual(['d2']);
    expect(result.animal.configurationHistory[0].appliedToDays).toEqual(['d1']);
    expect(result.days.d2.configurationVersion).toBe(2);
  });

  it('allocates a UNIQUE version for a non-contiguous history ([1,3] -> 4) and pins to it', () => {
    const result = createSnapshotAndApplyForward(
      { id: 'remy', configurationHistory: [{ version: 1, appliedToDays: [] }, { version: 3, appliedToDays: [] }] },
      days(),
      { date: '2023-07-01', description: 'reconfig', devices: emptyDevices() },
      ['d1', 'd2'],
      NOW
    );
    expect(result.version).toBe(4);
    expect(result.animal.configurationHistory.map((s) => s.version)).toEqual([1, 3, 4]);
    expect(result.days.d1.configurationVersion).toBe(4);
    expect(result.days.d2.configurationVersion).toBe(4);
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

  it('de-duplicates repeated day ids so the usage view is not polluted', () => {
    const { animal } = applyConfigurationForwardToAnimal(base(), days(), 2, ['d2', 'd2'], NOW);
    expect(animal.configurationHistory[1].appliedToDays).toEqual(['d2']);
  });

  it('throws on a non-existent snapshot version', () => {
    expect(() => applyConfigurationForwardToAnimal(base(), days(), 99, ['d2'], NOW))
      .toThrow(/Configuration version "99" not found/);
  });

  it('never moves a day whose record belongs to a DIFFERENT animal (wrong-owner guard)', () => {
    // d2's record explicitly belongs to another animal — reconfiguration of "remy" must not
    // rewrite its configurationVersion or list it under remy's snapshot.
    const wrongOwnerDays = { d1: { id: 'd1' }, d2: { id: 'd2', animalId: 'someoneelse' } };
    const { animal, days: nextDays } = applyConfigurationForwardToAnimal(
      base(),
      wrongOwnerDays,
      2,
      ['d2'],
      NOW
    );
    expect(nextDays.d2.configurationVersion).toBeUndefined();
    expect(animal.configurationHistory[1].appliedToDays).toEqual([]);
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
    expect(day.configurationVersion).toBe(2); // latest snapshot's version
    expect(day.technical.raw_data_to_volts).toBe(0.3);
    expect(day.technical.times_period_multiplier).toBe(2);
    expect(day.state).toEqual({ draft: true, validated: false, exported: false });
  });

  it('pins to the latest snapshot VERSION, not the count, for a non-contiguous history', () => {
    // An imported/repaired history can skip a version. The count (2) names no real
    // snapshot; the latest version (3) is the one resolveDayConfig can resolve.
    const animal = { configurationHistory: [{ version: 1 }, { version: 3 }] };
    const day = createDayRecord(animal, 'remy', 'd', '2023-06-22', {}, NOW);
    expect(day.configurationVersion).toBe(3);
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
