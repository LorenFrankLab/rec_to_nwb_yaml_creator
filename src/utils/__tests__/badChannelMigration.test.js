/**
 * Tests for the one-time, idempotent, load-time migration that moves
 * animal-level (config-snapshot) bad-channel marks DOWN into each day's
 * `deviceOverrides`, making bad channels day-owned WITHOUT changing the
 * exported YAML for any existing data (when fed through the UNCHANGED merge).
 *
 * The ultimate arbiter is the byte-identity gate: for every day, the encoded
 * `mergeDayMetadata` output must be byte-for-byte identical before and after
 * the migration.
 */

import { describe, it, expect } from 'vitest';
import {
  migrateBadChannelsToDays,
  normalizeWorkspaceDevices,
} from '../deviceNormalization';
import { mergeDayMetadata, resolveDayConfig } from '../../state/workspaceUtils';
import { encodeYaml } from '../../io/yaml';
import { buildRealisticWorkspace } from '../../__tests__/fixtures/workspaceBuilders';

/**
 * Wrap the `buildRealisticWorkspace()` animal+day into a full workspace shape
 * (animals keyed by id, days keyed by id), matching what the load-time
 * normalizer iterates.
 *
 * @returns {{ workspace: object, animalId: string, dayId: string }}
 */
function realisticWorkspace() {
  const { animal, day } = buildRealisticWorkspace();
  return {
    workspace: {
      animals: { [animal.id]: animal },
      days: { [day.id]: day },
    },
    animalId: animal.id,
    dayId: day.id,
  };
}

/**
 * Encode the merge output of every day in a workspace, keyed by day id.
 *
 * @param {object} ws - Workspace.
 * @returns {Record<string, string>} day id → encoded YAML.
 */
function encodeAllDays(ws) {
  const out = {};
  Object.values(ws.days || {}).forEach((day) => {
    const animal = ws.animals[day.animalId];
    out[day.id] = encodeYaml(mergeDayMetadata(animal, day));
  });
  return out;
}

describe('current merge semantics (characterization)', () => {
  it('resolveDayConfig REPLACES per-ntrode bad_channels (override wins; else base; NOT union)', () => {
    // Build an animal whose snapshot carries a base mark on ntrode A (id 1) and
    // ALSO on a ntrode (id 3) that the day will override with a DIFFERENT value.
    const animal = {
      id: 'a',
      configurationHistory: [
        {
          version: 1,
          devices: {
            electrode_groups: [
              { id: 0, location: 'CA1', device_type: 'tetrode_12.5' },
              { id: 1, location: 'CA1', device_type: 'tetrode_12.5' },
              { id: 2, location: 'CA1', device_type: 'tetrode_12.5' },
            ],
            ntrode_electrode_group_channel_map: [
              { ntrode_id: 1, electrode_group_id: 0, bad_channels: [2], map: { 0: 0, 1: 1, 2: 2, 3: 3 } },
              { ntrode_id: 2, electrode_group_id: 1, bad_channels: [], map: { 0: 0, 1: 1, 2: 2, 3: 3 } },
              { ntrode_id: 3, electrode_group_id: 2, bad_channels: [0, 1], map: { 0: 0, 1: 1, 2: 2, 3: 3 } },
            ],
          },
        },
      ],
    };
    const day = {
      id: 'd',
      animalId: 'a',
      configurationVersion: 1,
      // Day override on ntrode B (id 2: a fresh mark) AND on ntrode 3 (differs
      // from base [0,1] → proves REPLACE, not union).
      deviceOverrides: { bad_channels: { 2: [3], 3: [1] } },
    };

    const resolved = resolveDayConfig(animal, day);
    const byId = Object.fromEntries(
      resolved.ntrode_electrode_group_channel_map.map((n) => [n.ntrode_id, n.bad_channels])
    );

    // ntrode 1: no override → base [2] survives.
    expect(byId[1]).toEqual([2]);
    // ntrode 2: override [3] (base was []) → override.
    expect(byId[2]).toEqual([3]);
    // ntrode 3: override [1] REPLACES base [0,1] — union would be [0,1] (or [0,1]
    // de-duped), so [1] proves REPLACE semantics.
    expect(byId[3]).toEqual([1]);
  });
});

describe('migrateBadChannelsToDays — byte-identity gate', () => {
  it('keeps every day export byte-identical (realistic workspace carries base bad_channels)', () => {
    const { workspace, animalId } = realisticWorkspace();

    // Sanity: confirm the realistic snapshot genuinely carries base bad_channels
    // (otherwise this gate would be vacuous).
    const snap = workspace.animals[animalId].configurationHistory[0];
    const hasBase = snap.devices.ntrode_electrode_group_channel_map.some(
      (n) => Array.isArray(n.bad_channels) && n.bad_channels.length > 0
    );
    expect(hasBase).toBe(true);

    const before = encodeAllDays(workspace);
    const migrated = migrateBadChannelsToDays(workspace);
    const after = encodeAllDays(migrated);

    Object.keys(before).forEach((dayId) => {
      expect(after[dayId]).toBe(before[dayId]);
    });
  });

  it('moves the base marks onto the day override and strips the snapshot base', () => {
    const { workspace, animalId, dayId } = realisticWorkspace();
    const migrated = migrateBadChannelsToDays(workspace);

    const snap = migrated.animals[animalId].configurationHistory[0];
    snap.devices.ntrode_electrode_group_channel_map.forEach((n) => {
      expect(n.bad_channels).toEqual([]);
    });

    // The day now owns the previously-base marks (ntrode 3 → [2], ntrode 6 → [3]).
    const overrides = migrated.days[dayId].deviceOverrides.bad_channels;
    expect(overrides['3']).toEqual([2]);
    expect(overrides['6']).toEqual([3]);
  });
});

describe('migrateBadChannelsToDays — replace-precedence preserved', () => {
  it('a day with a base mark on A and an override on B (and an override that differs from base) stays byte-identical', () => {
    const animal = {
      id: 'a',
      subject: { subject_id: 'a', species: 'Rattus norvegicus', sex: 'M' },
      devices: { data_acq_device: [{ name: 'SpikeGadgets' }], device: { name: ['Trodes'] } },
      experimenters: { experimenter_name: ['X, Y'], lab: 'Frank', institution: 'UCSF' },
      cameras: [],
      configurationHistory: [
        {
          version: 1,
          devices: {
            electrode_groups: [
              { id: 0, location: 'CA1', device_type: 'tetrode_12.5' },
              { id: 1, location: 'CA1', device_type: 'tetrode_12.5' },
              { id: 2, location: 'CA1', device_type: 'tetrode_12.5' },
            ],
            ntrode_electrode_group_channel_map: [
              { ntrode_id: 1, electrode_group_id: 0, bad_channels: [2], map: { 0: 0, 1: 1, 2: 2, 3: 3 } },
              { ntrode_id: 2, electrode_group_id: 1, bad_channels: [], map: { 0: 0, 1: 1, 2: 2, 3: 3 } },
              { ntrode_id: 3, electrode_group_id: 2, bad_channels: [0, 1], map: { 0: 0, 1: 1, 2: 2, 3: 3 } },
            ],
          },
        },
      ],
    };
    const day = {
      id: 'd',
      animalId: 'a',
      configurationVersion: 1,
      session: { session_id: 's', session_description: 'd', experiment_description: 'e' },
      deviceOverrides: { bad_channels: { 2: [3], 3: [1] } },
    };
    const workspace = { animals: { a: animal }, days: { d: day } };

    const before = encodeYaml(mergeDayMetadata(animal, day));
    const migrated = migrateBadChannelsToDays(workspace);
    const after = encodeYaml(
      mergeDayMetadata(migrated.animals.a, migrated.days.d)
    );
    expect(after).toBe(before);
  });
});

describe('migrateBadChannelsToDays — multi-config animal', () => {
  it('each day pinned to its own config version stays byte-identical', () => {
    const makeNtrodes = (badForOne) => [
      { ntrode_id: 1, electrode_group_id: 0, bad_channels: badForOne, map: { 0: 0, 1: 1, 2: 2, 3: 3 } },
      { ntrode_id: 2, electrode_group_id: 1, bad_channels: [], map: { 0: 0, 1: 1, 2: 2, 3: 3 } },
    ];
    const makeDevices = (badForOne) => ({
      electrode_groups: [
        { id: 0, location: 'CA1', device_type: 'tetrode_12.5' },
        { id: 1, location: 'CA1', device_type: 'tetrode_12.5' },
      ],
      ntrode_electrode_group_channel_map: makeNtrodes(badForOne),
    });
    const animal = {
      id: 'a',
      subject: { subject_id: 'a', species: 'Rattus norvegicus', sex: 'M' },
      devices: { data_acq_device: [{ name: 'SpikeGadgets' }], device: { name: ['Trodes'] } },
      experimenters: { experimenter_name: ['X, Y'], lab: 'Frank', institution: 'UCSF' },
      cameras: [],
      configurationHistory: [
        { version: 1, devices: makeDevices([1]) },
        { version: 2, devices: makeDevices([3]) },
      ],
    };
    const dayV1 = {
      id: 'd1',
      animalId: 'a',
      configurationVersion: 1,
      session: { session_id: 's1', session_description: 'd1', experiment_description: 'e' },
    };
    const dayV2 = {
      id: 'd2',
      animalId: 'a',
      configurationVersion: 2,
      session: { session_id: 's2', session_description: 'd2', experiment_description: 'e' },
    };
    const workspace = { animals: { a: animal }, days: { d1: dayV1, d2: dayV2 } };

    const before = encodeAllDays(workspace);
    const migrated = migrateBadChannelsToDays(workspace);
    const after = encodeAllDays(migrated);

    expect(after.d1).toBe(before.d1);
    expect(after.d2).toBe(before.d2);

    // Each day owns its own snapshot's base mark.
    expect(migrated.days.d1.deviceOverrides.bad_channels['1']).toEqual([1]);
    expect(migrated.days.d2.deviceOverrides.bad_channels['1']).toEqual([3]);
  });

  it('an UNPINNED day resolves the latest snapshot (mirrors resolveDayConfig) and stays byte-identical', () => {
    const animal = {
      id: 'a',
      subject: { subject_id: 'a', species: 'Rattus norvegicus', sex: 'M' },
      devices: { data_acq_device: [{ name: 'SpikeGadgets' }], device: { name: ['Trodes'] } },
      experimenters: { experimenter_name: ['X, Y'], lab: 'Frank', institution: 'UCSF' },
      cameras: [],
      configurationHistory: [
        {
          version: 1,
          devices: {
            electrode_groups: [{ id: 0, location: 'CA1', device_type: 'tetrode_12.5' }],
            ntrode_electrode_group_channel_map: [
              { ntrode_id: 1, electrode_group_id: 0, bad_channels: [0], map: { 0: 0, 1: 1, 2: 2, 3: 3 } },
            ],
          },
        },
        {
          version: 2,
          devices: {
            electrode_groups: [{ id: 0, location: 'CA1', device_type: 'tetrode_12.5' }],
            ntrode_electrode_group_channel_map: [
              { ntrode_id: 1, electrode_group_id: 0, bad_channels: [2], map: { 0: 0, 1: 1, 2: 2, 3: 3 } },
            ],
          },
        },
      ],
    };
    const day = {
      id: 'd',
      animalId: 'a',
      // No configurationVersion → unpinned → latest (version 2, base [2]).
      session: { session_id: 's', session_description: 'd', experiment_description: 'e' },
    };
    const workspace = { animals: { a: animal }, days: { d: day } };

    const before = encodeYaml(mergeDayMetadata(animal, day));
    const migrated = migrateBadChannelsToDays(workspace);
    const after = encodeYaml(mergeDayMetadata(migrated.animals.a, migrated.days.d));
    expect(after).toBe(before);
    // The migration must move the LATEST snapshot's base ([2]), not version 1's.
    expect(migrated.days.d.deviceOverrides.bad_channels['1']).toEqual([2]);
  });
});

describe('migrateBadChannelsToDays — idempotent', () => {
  it('running twice equals running once', () => {
    const { workspace } = realisticWorkspace();
    const once = migrateBadChannelsToDays(workspace);
    const twice = migrateBadChannelsToDays(once);
    expect(twice).toEqual(once);
  });
});

describe('migrateBadChannelsToDays — no-op when base-free', () => {
  it('returns a base-free workspace deep-equal (existing fixtures unaffected)', () => {
    const animal = {
      id: 'a',
      configurationHistory: [
        {
          version: 1,
          devices: {
            electrode_groups: [{ id: 0, location: 'CA1', device_type: 'tetrode_12.5' }],
            ntrode_electrode_group_channel_map: [
              { ntrode_id: 1, electrode_group_id: 0, bad_channels: [], map: { 0: 0, 1: 1, 2: 2, 3: 3 } },
            ],
          },
        },
      ],
    };
    const day = { id: 'd', animalId: 'a', configurationVersion: 1 };
    const workspace = { animals: { a: animal }, days: { d: day } };

    const migrated = migrateBadChannelsToDays(workspace);
    expect(migrated).toEqual(workspace);
  });

  it('a snapshot with ABSENT bad_channels keys is a no-op', () => {
    const animal = {
      id: 'a',
      configurationHistory: [
        {
          version: 1,
          devices: {
            electrode_groups: [{ id: 0, location: 'CA1', device_type: 'tetrode_12.5' }],
            ntrode_electrode_group_channel_map: [
              { ntrode_id: 1, electrode_group_id: 0, map: { 0: 0, 1: 1, 2: 2, 3: 3 } },
            ],
          },
        },
      ],
    };
    const day = { id: 'd', animalId: 'a', configurationVersion: 1 };
    const workspace = { animals: { a: animal }, days: { d: day } };
    expect(migrateBadChannelsToDays(workspace)).toEqual(workspace);
  });
});

describe('migrateBadChannelsToDays — shape-safe', () => {
  it('does not throw and does not launder a corrupt (scalar) day override', () => {
    const animal = {
      id: 'a',
      configurationHistory: [
        {
          version: 1,
          devices: {
            electrode_groups: [
              { id: 0, location: 'CA1', device_type: 'tetrode_12.5' },
              { id: 1, location: 'CA1', device_type: 'tetrode_12.5' },
            ],
            ntrode_electrode_group_channel_map: [
              { ntrode_id: 1, electrode_group_id: 0, bad_channels: [2], map: { 0: 0, 1: 1, 2: 2, 3: 3 } },
              { ntrode_id: 2, electrode_group_id: 1, bad_channels: [1], map: { 0: 0, 1: 1, 2: 2, 3: 3 } },
            ],
          },
        },
      ],
    };
    const day = {
      id: 'd',
      animalId: 'a',
      configurationVersion: 1,
      // ntrode 1 override is a corrupt scalar — must be preserved verbatim (NOT
      // overwritten by base, NOT laundered). ntrode 2 has no override → base [1]
      // should still be moved down.
      deviceOverrides: { bad_channels: { 1: '2.9' } },
    };
    const workspace = { animals: { a: animal }, days: { d: day } };

    let migrated;
    expect(() => {
      migrated = migrateBadChannelsToDays(workspace);
    }).not.toThrow();

    // Corrupt scalar preserved verbatim — the key already existed, so REPLACE
    // precedence means the migration must NOT touch it.
    expect(migrated.days.d.deviceOverrides.bad_channels['1']).toBe('2.9');
    // ntrode 2 had no override → its base [1] is moved down.
    expect(migrated.days.d.deviceOverrides.bad_channels['2']).toEqual([1]);
  });

  it('does not throw when a day references a missing animal', () => {
    const day = { id: 'd', animalId: 'ghost', configurationVersion: 1 };
    const workspace = { animals: {}, days: { d: day } };
    let migrated;
    expect(() => {
      migrated = migrateBadChannelsToDays(workspace);
    }).not.toThrow();
    expect(migrated.days.d).toEqual(day);
  });

  it('does not throw when a day pins a missing snapshot version', () => {
    const animal = {
      id: 'a',
      configurationHistory: [
        {
          version: 1,
          devices: {
            electrode_groups: [{ id: 0, location: 'CA1', device_type: 'tetrode_12.5' }],
            ntrode_electrode_group_channel_map: [
              { ntrode_id: 1, electrode_group_id: 0, bad_channels: [2], map: { 0: 0, 1: 1, 2: 2, 3: 3 } },
            ],
          },
        },
      ],
    };
    const day = { id: 'd', animalId: 'a', configurationVersion: 99 };
    const workspace = { animals: { a: animal }, days: { d: day } };
    let migrated;
    expect(() => {
      migrated = migrateBadChannelsToDays(workspace);
    }).not.toThrow();
    // No snapshot matched → day left untouched (the base is left to the repair path).
    expect(migrated.days.d).toEqual(day);
  });

  it('does not throw when a snapshot has a corrupt (non-array) ntrode map', () => {
    const animal = {
      id: 'a',
      configurationHistory: [
        { version: 1, devices: { ntrode_electrode_group_channel_map: 'corrupt' } },
      ],
    };
    const day = { id: 'd', animalId: 'a', configurationVersion: 1 };
    const workspace = { animals: { a: animal }, days: { d: day } };
    expect(() => migrateBadChannelsToDays(workspace)).not.toThrow();
  });

  it('does not mutate the input workspace', () => {
    const { workspace, animalId } = realisticWorkspace();
    const beforeJSON = JSON.stringify(workspace);
    migrateBadChannelsToDays(workspace);
    expect(JSON.stringify(workspace)).toBe(beforeJSON);
    // The original snapshot still carries its base marks.
    const snap = workspace.animals[animalId].configurationHistory[0];
    const stillHasBase = snap.devices.ntrode_electrode_group_channel_map.some(
      (n) => Array.isArray(n.bad_channels) && n.bad_channels.length > 0
    );
    expect(stillHasBase).toBe(true);
  });
});

describe('normalizeWorkspaceDevices runs the migration at load', () => {
  it('a loaded realistic workspace exports byte-identical to its pre-load merge', () => {
    const { workspace } = realisticWorkspace();
    const before = encodeAllDays(workspace);
    const loaded = normalizeWorkspaceDevices(workspace);
    const after = encodeAllDays(loaded);
    Object.keys(before).forEach((dayId) => {
      expect(after[dayId]).toBe(before[dayId]);
    });
    // And the migration actually ran (snapshot base stripped, day owns marks).
    const snap = Object.values(loaded.animals)[0].configurationHistory[0];
    snap.devices.ntrode_electrode_group_channel_map.forEach((n) => {
      expect(n.bad_channels).toEqual([]);
    });
  });
});
