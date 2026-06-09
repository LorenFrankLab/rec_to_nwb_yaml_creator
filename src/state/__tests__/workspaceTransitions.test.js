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

  it('never moves a day whose record animalId is a non-string (object) — treated as not this animal', () => {
    // A corrupt object animalId is `!= null` and `!== owner`, so the ownership guard must exclude
    // it from the reconfiguration just like an explicit different-owner id.
    const objOwnerDays = { d1: { id: 'd1' }, d2: { id: 'd2', animalId: { not: 'a string' } } };
    const { animal, days: nextDays } = applyConfigurationForwardToAnimal(
      base(),
      objOwnerDays,
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

  it('with no carryFrom: tasks/keywords/behavioral_events empty, no experiment_description (back-compat)', () => {
    const animal = { configurationHistory: [] };
    const day = createDayRecord(animal, 'remy', 'd', '2023-06-22', { session_id: 's' }, NOW);
    expect(day.tasks).toEqual([]);
    expect(day.keywords).toEqual([]);
    expect(day.behavioral_events).toEqual([]);
    expect(day.session.experiment_description).toBeUndefined();
    expect(day.technical.times_period_multiplier).toBe(1.5);
  });

  describe('carry-forward from a prior day', () => {
    const carryFrom = {
      session: { experiment_description: 'Chronic recording', weight: 485 },
      keywords: ['hippocampus', 'spatial'],
      tasks: [{ task_name: 'W-track', task_epochs: [1, 3] }],
      behavioral_events: [{ description: 'Poke1', name: 'poke1' }],
      technical: { raw_data_to_volts: 0.42, times_period_multiplier: 3, units: { analog: 'unit' } },
    };
    const animal = { configurationHistory: [{ version: 2 }] };
    const session = { session_id: 'remy_20230623', session_description: 'Day 2' };

    it('seeds tasks/behavioral_events/keywords/technical from the source', () => {
      const day = createDayRecord(animal, 'remy', 'd', '2023-06-23', session, NOW, carryFrom);
      expect(day.tasks).toEqual(carryFrom.tasks);
      expect(day.behavioral_events).toEqual(carryFrom.behavioral_events);
      expect(day.keywords).toEqual(carryFrom.keywords);
      expect(day.technical).toEqual(carryFrom.technical);
    });

    it('deep-clones carried fields (no shared reference with the source)', () => {
      const day = createDayRecord(animal, 'remy', 'd', '2023-06-23', session, NOW, carryFrom);
      expect(day.tasks).not.toBe(carryFrom.tasks);
      expect(day.technical).not.toBe(carryFrom.technical);
      // Mutating the result must not affect the source.
      day.tasks[0].task_name = 'changed';
      day.technical.raw_data_to_volts = 0;
      expect(carryFrom.tasks[0].task_name).toBe('W-track');
      expect(carryFrom.technical.raw_data_to_volts).toBe(0.42);
    });

    it('carries experiment_description and weight from the source when the caller omits them', () => {
      const day = createDayRecord(animal, 'remy', 'd', '2023-06-23', session, NOW, carryFrom);
      expect(day.session.experiment_description).toBe('Chronic recording');
      expect(day.session.weight).toBe(485);
    });

    it('prefers the caller experiment_description/weight over the source when provided', () => {
      const day = createDayRecord(
        animal,
        'remy',
        'd',
        '2023-06-23',
        { ...session, experiment_description: 'Override', weight: 500 },
        NOW,
        carryFrom
      );
      expect(day.session.experiment_description).toBe('Override');
      expect(day.session.weight).toBe(500);
    });

    it('ALWAYS takes session_id/session_description from the caller, never the source', () => {
      const day = createDayRecord(animal, 'remy', 'd', '2023-06-23', session, NOW, carryFrom);
      expect(day.session.session_id).toBe('remy_20230623');
      expect(day.session.session_description).toBe('Day 2');
    });

    it('never carries associated_files / associated_video_files (always empty)', () => {
      const withFiles = {
        ...carryFrom,
        associated_files: [{ name: 'f1' }],
        associated_video_files: [{ name: 'v1' }],
      };
      const day = createDayRecord(animal, 'remy', 'd', '2023-06-23', session, NOW, withFiles);
      expect(day.associated_files).toEqual([]);
      expect(day.associated_video_files).toEqual([]);
    });

    it('falls back to the animal-defaults technical when the source has no technical record', () => {
      const noTech = { ...carryFrom, technical: undefined };
      const day = createDayRecord(animal, 'remy', 'd', '2023-06-23', session, NOW, noTech);
      expect(day.technical.times_period_multiplier).toBe(1.5);
      expect(day.technical.raw_data_to_volts).toBe(0.195);
    });
  });

  describe('bad-channel carry-forward (config-version-guarded)', () => {
    const session = { session_id: 'remy_20230623', session_description: 'Day 2' };

    it('carries bad_channels (cloned, not aliased) when the source pins the SAME (latest) config version', () => {
      // The new day pins the animal's latest version (3); the source already pins 3, so its
      // ntrode-id-keyed marks still target the right electrodes → carried.
      const animal = { configurationHistory: [{ version: 1 }, { version: 3 }] };
      const carryFrom = {
        configurationVersion: 3,
        deviceOverrides: { bad_channels: { 1: [2] } },
      };
      const day = createDayRecord(animal, 'remy', 'd', '2023-06-23', session, NOW, carryFrom);
      expect(day.configurationVersion).toBe(3);
      expect(day.deviceOverrides.bad_channels).toEqual({ 1: [2] });
      // Cloned, not aliased: the new day must never share the source's override object.
      expect(day.deviceOverrides.bad_channels).not.toBe(carryFrom.deviceOverrides.bad_channels);
      day.deviceOverrides.bad_channels[1].push(99);
      expect(carryFrom.deviceOverrides.bad_channels[1]).toEqual([2]);
    });

    it('does NOT carry bad_channels when the source pins an OLDER config version (stale after reconfiguration)', () => {
      // The probe was reconfigured (latest is 3); the source pins 1, so its marks would target
      // the WRONG electrodes on the new config → the guard drops them.
      const animal = { configurationHistory: [{ version: 1 }, { version: 3 }] };
      const carryFrom = {
        configurationVersion: 1,
        deviceOverrides: { bad_channels: { 1: [2] } },
      };
      const day = createDayRecord(animal, 'remy', 'd', '2023-06-23', session, NOW, carryFrom);
      expect(day.configurationVersion).toBe(3);
      // No stale marks: either no deviceOverrides at all, or empty bad_channels.
      const carried = day.deviceOverrides?.bad_channels ?? {};
      expect(carried).toEqual({});
    });

    it('adds NO deviceOverrides container when the source has no bad channels (byte-identical to no-carry)', () => {
      const animal = { configurationHistory: [{ version: 2 }] };
      const noBad = createDayRecord(
        animal,
        'remy',
        'd',
        '2023-06-23',
        session,
        NOW,
        { configurationVersion: 2, deviceOverrides: { bad_channels: {} } }
      );
      const absent = createDayRecord(
        animal,
        'remy',
        'd',
        '2023-06-23',
        session,
        NOW,
        { configurationVersion: 2 }
      );
      const blank = createDayRecord(animal, 'remy', 'd', '2023-06-23', session, NOW);
      expect(noBad.deviceOverrides).toBeUndefined();
      expect(absent.deviceOverrides).toBeUndefined();
      expect(blank.deviceOverrides).toBeUndefined();
    });

    it('carries ONLY bad_channels, never a whole-map electrode_groups override', () => {
      const animal = { configurationHistory: [{ version: 2 }] };
      const carryFrom = {
        configurationVersion: 2,
        deviceOverrides: {
          bad_channels: { 0: [1] },
          electrode_groups: [{ id: 0, location: 'CA1' }],
        },
      };
      const day = createDayRecord(animal, 'remy', 'd', '2023-06-23', session, NOW, carryFrom);
      expect(day.deviceOverrides.bad_channels).toEqual({ 0: [1] });
      expect(day.deviceOverrides.electrode_groups).toBeUndefined();
      expect(Object.keys(day.deviceOverrides)).toEqual(['bad_channels']);
    });
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

  it('writes flags over a malformed (scalar) state without scattering char-indexed keys', () => {
    // A corrupt import can persist `state` as a string; spreading it would scatter `{0:'c',1:'o',…}`.
    // The update must normalize to a clean record carrying only the written flags.
    const updated = applyDayUpdates({ id: 'd1', state: 'corrupt' }, { state: { validated: true } }, NOW);
    expect(updated.state).toEqual({ validated: true });
  });

  it('writes flags over a malformed (array) state without spreading array indices', () => {
    const updated = applyDayUpdates({ id: 'd1', state: ['x', 'y'] }, { state: { exported: true } }, NOW);
    expect(updated.state).toEqual({ exported: true });
  });

  it('preserves existing flags on a well-formed state', () => {
    const updated = applyDayUpdates(
      { id: 'd1', state: { draft: true } },
      { state: { validated: true } },
      NOW
    );
    expect(updated.state).toEqual({ draft: true, validated: true });
  });

  it('persists data_acq_device_name (per-day recording-system selection)', () => {
    const updated = applyDayUpdates({ id: 'd1' }, { data_acq_device_name: 'SpikeGadgets' }, NOW);
    expect(updated.data_acq_device_name).toBe('SpikeGadgets');
  });

  it('clears data_acq_device_name to undefined (back to the animal default)', () => {
    // Uses a PRESENCE check, not `!== undefined`, so the "Default" option's clear persists.
    const updated = applyDayUpdates(
      { id: 'd1', data_acq_device_name: 'B' },
      { data_acq_device_name: undefined },
      NOW
    );
    expect(updated.data_acq_device_name).toBeUndefined();
  });

  it('persists cameras_used (the explicit per-day cameras-used checklist)', () => {
    const updated = applyDayUpdates({ id: 'd1' }, { cameras_used: [1] }, NOW);
    expect(updated.cameras_used).toEqual([1]);
  });
});
