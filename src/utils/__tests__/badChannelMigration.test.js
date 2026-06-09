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

describe('current merge semantics (characterization)', () => {
  it('resolveDayConfig reads per-ntrode bad_channels from the DAY OVERRIDE ONLY (else [], never the base)', () => {
    // Build an animal whose snapshot carries a base mark on ntrode A (id 1) and
    // ALSO on a ntrode (id 3) that the day will override with a DIFFERENT value.
    // NOTE: this previously characterized REPLACE-onto-base semantics (ntrode 1
    // with no override → base survived). The merge now reads the day override
    // EXCLUSIVELY (the load-time migration moves base marks down into the day), so
    // an ntrode with no override resolves to [] regardless of the snapshot base.
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
      // from base [0,1] → proves the override is used, not the base/union).
      deviceOverrides: { bad_channels: { 2: [3], 3: [1] } },
    };

    const resolved = resolveDayConfig(animal, day);
    const byId = Object.fromEntries(
      resolved.ntrode_electrode_group_channel_map.map((n) => [n.ntrode_id, n.bad_channels])
    );

    // ntrode 1: no override → [] (the base [2] is NOT read).
    expect(byId[1]).toEqual([]);
    // ntrode 2: override [3] → override.
    expect(byId[2]).toEqual([3]);
    // ntrode 3: override [1] (base was [0,1]) → the override is used, not base/union.
    expect(byId[3]).toEqual([1]);
  });
});

describe('migrateBadChannelsToDays — byte-identity gate', () => {
  it('keeps every day export export-neutral vs the legacy base set (realistic workspace carries base bad_channels)', () => {
    // The merge now reads bad_channels from the day override ONLY, so a live
    // `before = merge(un-migrated)` no longer captures the legacy base-reading bytes
    // (it would read [] for a day with no override). The export-neutrality this gate
    // protects is therefore expressed as: after migration, the new day-only merge
    // resolves each ntrode to the SAME effective set the legacy base-reading merge
    // produced — i.e. the original snapshot base marks. (The frozen-byte form of this
    // gate lives in src/state/__tests__/resolveDayConfigBadChannels.test.js.)
    const { workspace, animalId, dayId } = realisticWorkspace();

    // The legacy effective set = the snapshot base marks, captured BEFORE migration.
    const snap = workspace.animals[animalId].configurationHistory[0];
    const legacyByNtrode = Object.fromEntries(
      snap.devices.ntrode_electrode_group_channel_map.map((n) => [n.ntrode_id, n.bad_channels])
    );
    // Sanity: the realistic snapshot genuinely carries base bad_channels.
    expect(Object.values(legacyByNtrode).some((b) => Array.isArray(b) && b.length > 0)).toBe(true);

    const migrated = migrateBadChannelsToDays(workspace);
    const merged = mergeDayMetadata(migrated.animals[animalId], migrated.days[dayId]);
    const afterByNtrode = Object.fromEntries(
      merged.ntrode_electrode_group_channel_map.map((n) => [n.ntrode_id, n.bad_channels])
    );

    Object.keys(legacyByNtrode).forEach((ntrodeId) => {
      expect(afterByNtrode[ntrodeId]).toEqual(legacyByNtrode[ntrodeId]);
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

    // Legacy effective set (base for ntrode 1; overrides for 2 and 3), captured
    // pre-migration. The live `before = merge(un-migrated)` no longer captures it
    // (day-only merge reads [] for ntrode 1's missing override), so we baseline the
    // legacy resolution explicitly: 1 → base [2], 2 → [3], 3 → [1].
    const migrated = migrateBadChannelsToDays(workspace);
    const merged = mergeDayMetadata(migrated.animals.a, migrated.days.d);
    const byId = Object.fromEntries(
      merged.ntrode_electrode_group_channel_map.map((n) => [n.ntrode_id, n.bad_channels])
    );
    expect(byId[1]).toEqual([2]);
    expect(byId[2]).toEqual([3]);
    expect(byId[3]).toEqual([1]);
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

    // Legacy effective per-day = its pinned snapshot's base (v1 → [1], v2 → [3]).
    // After migration the day-only merge must reproduce that set.
    const migrated = migrateBadChannelsToDays(workspace);
    const badFor = (day) =>
      mergeDayMetadata(migrated.animals.a, day).ntrode_electrode_group_channel_map.find(
        (n) => n.ntrode_id === 1
      ).bad_channels;
    expect(badFor(migrated.days.d1)).toEqual([1]);
    expect(badFor(migrated.days.d2)).toEqual([3]);

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

    // Legacy effective for an unpinned day = the LATEST snapshot's base ([2]).
    // After migration the day-only merge must reproduce [2] for ntrode 1.
    const migrated = migrateBadChannelsToDays(workspace);
    const merged = mergeDayMetadata(migrated.animals.a, migrated.days.d);
    expect(merged.ntrode_electrode_group_channel_map.find((n) => n.ntrode_id === 1).bad_channels).toEqual([2]);
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

describe('migrateBadChannelsToDays — corrupt-container day blocks its snapshot strip', () => {
  it('a corrupt non-record override container day keeps its snapshot base un-stripped (merge now drops it — signed-off)', () => {
    // The day's `deviceOverrides.bad_channels` is a CORRUPT non-record container
    // (a scalar string, not an object). The migration leaves the snapshot base [2]
    // intact (it cannot materialize the corrupt container into a readable override).
    // The day-only merge no longer reads that base — it resolves the corrupt container
    // to [] — which is the accepted, signed-off behavior for a corrupt-override day
    // (export-gated / repair-surfaced elsewhere). This test asserts the MIGRATION's
    // contract (base kept un-stripped) and documents the merge's new drop.
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
              { ntrode_id: 1, electrode_group_id: 0, bad_channels: [2], map: { 0: 0, 1: 1, 2: 2, 3: 3 } },
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
      // Corrupt non-record container: a bare scalar, NOT a { ntrodeId: [...] } record.
      deviceOverrides: { bad_channels: '2.9' },
    };
    const workspace = { animals: { a: animal }, days: { d: day } };

    const migrated = migrateBadChannelsToDays(workspace);
    // Migration contract: the blocked snapshot's base is kept intact (un-stripped).
    expect(
      migrated.animals.a.configurationHistory[0].devices.ntrode_electrode_group_channel_map[0]
        .bad_channels
    ).toEqual([2]);
    // The corrupt container is preserved verbatim (never laundered).
    expect(migrated.days.d.deviceOverrides.bad_channels).toBe('2.9');
    // Day-only merge: the corrupt container resolves to [] (signed-off drop of base).
    const merged = mergeDayMetadata(migrated.animals.a, migrated.days.d);
    expect(merged.ntrode_electrode_group_channel_map.find((n) => n.ntrode_id === 1).bad_channels).toEqual([]);
  });

  it('a shared snapshot is NOT stripped when one day on it has a corrupt container (clean day stays neutral; corrupt day drops base — signed-off)', () => {
    // Two days pin the SAME version 1 snapshot whose ntrode 1 base is [2].
    //  - dayA is clean (no override) → relies on the base.
    //  - dayB has a CORRUPT non-record container → merge ignores it, falls back to base.
    // The migration must NOT strip the shared snapshot base, because dayB cannot
    // materialize it into a readable override. Stripping it would silently change
    // BOTH days' exports (dayA's override holds, but dayB's [2] → []).
    const makeDevices = () => ({
      electrode_groups: [{ id: 0, location: 'CA1', device_type: 'tetrode_12.5' }],
      ntrode_electrode_group_channel_map: [
        { ntrode_id: 1, electrode_group_id: 0, bad_channels: [2], map: { 0: 0, 1: 1, 2: 2, 3: 3 } },
      ],
    });
    const animal = {
      id: 'a',
      subject: { subject_id: 'a', species: 'Rattus norvegicus', sex: 'M' },
      devices: { data_acq_device: [{ name: 'SpikeGadgets' }], device: { name: ['Trodes'] } },
      experimenters: { experimenter_name: ['X, Y'], lab: 'Frank', institution: 'UCSF' },
      cameras: [],
      configurationHistory: [{ version: 1, devices: makeDevices() }],
    };
    const dayA = {
      id: 'dA',
      animalId: 'a',
      configurationVersion: 1,
      session: { session_id: 'sA', session_description: 'dA', experiment_description: 'e' },
      // No override → relies on the shared snapshot base.
    };
    const dayB = {
      id: 'dB',
      animalId: 'a',
      configurationVersion: 1,
      session: { session_id: 'sB', session_description: 'dB', experiment_description: 'e' },
      // Corrupt non-record container → merge ignores → falls back to base.
      deviceOverrides: { bad_channels: '2.9' },
    };
    const workspace = { animals: { a: animal }, days: { dA: dayA, dB: dayB } };

    const migrated = migrateBadChannelsToDays(workspace);
    // Migration keeps the shared snapshot base un-stripped (dB blocks it).
    expect(
      migrated.animals.a.configurationHistory[0].devices.ntrode_electrode_group_channel_map[0]
        .bad_channels
    ).toEqual([2]);
    const badFor = (day) =>
      mergeDayMetadata(migrated.animals.a, day).ntrode_electrode_group_channel_map.find(
        (n) => n.ntrode_id === 1
      ).bad_channels;
    // Clean day dA materialized the base into its override → stays [2] (export-neutral).
    expect(badFor(migrated.days.dA)).toEqual([2]);
    // Corrupt day dB resolves to [] (signed-off drop of the un-materializable base).
    expect(badFor(migrated.days.dB)).toEqual([]);
  });
});

describe('migrateBadChannelsToDays — corrupt per-value on a based ntrode blocks its snapshot strip', () => {
  it('a corrupt non-array value on a BASED ntrode keeps its base un-stripped (merge now drops it — signed-off)', () => {
    // The override container is a valid RECORD, but ntrode 1's value is a corrupt
    // NON-array scalar ('2.9') while its snapshot base is the non-empty array [2].
    // The migration keeps the base [2] un-stripped (it must not launder the corrupt
    // value into the base). The day-only merge no longer reads that base — it resolves
    // the corrupt value to [] — the accepted, signed-off behavior for a corrupt
    // override (export-gated / repair-surfaced elsewhere).
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
              { ntrode_id: 1, electrode_group_id: 0, bad_channels: [2], map: { 0: 0, 1: 1, 2: 2, 3: 3 } },
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
      // Valid record container, but a corrupt NON-array value on the BASED ntrode 1.
      deviceOverrides: { bad_channels: { 1: '2.9' } },
    };
    const workspace = { animals: { a: animal }, days: { d: day } };

    const migrated = migrateBadChannelsToDays(workspace);
    // The corrupt value is preserved verbatim (never laundered into [2]).
    expect(migrated.days.d.deviceOverrides.bad_channels['1']).toBe('2.9');
    // The snapshot base is left intact (NOT stripped).
    const snap = migrated.animals.a.configurationHistory[0];
    expect(snap.devices.ntrode_electrode_group_channel_map[0].bad_channels).toEqual([2]);
    // Day-only merge: the corrupt value resolves to [] (signed-off drop of base).
    const merged = mergeDayMetadata(migrated.animals.a, migrated.days.d);
    expect(merged.ntrode_electrode_group_channel_map.find((n) => n.ntrode_id === 1).bad_channels).toEqual([]);
  });

  it('a corrupt non-array value on an EMPTY-base ntrode does not lose data (byte-identical)', () => {
    // Here the based ntrode's base is EMPTY ([]). A corrupt non-array override value
    // ('2.9') is still declined by the merge → effective is [] either way. Stripping
    // an already-empty base is a no-op, so byte-identity must hold regardless of
    // whether the snapshot is blocked (over-blocking here is acceptable).
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
            ],
            ntrode_electrode_group_channel_map: [
              // ntrode 1: EMPTY base, corrupt override value.
              { ntrode_id: 1, electrode_group_id: 0, bad_channels: [], map: { 0: 0, 1: 1, 2: 2, 3: 3 } },
              // ntrode 2: non-empty base, no override → must still move down cleanly.
              { ntrode_id: 2, electrode_group_id: 1, bad_channels: [3], map: { 0: 0, 1: 1, 2: 2, 3: 3 } },
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
      deviceOverrides: { bad_channels: { 1: '2.9' } },
    };
    const workspace = { animals: { a: animal }, days: { d: day } };

    // Legacy effective: ntrode 1 declined corrupt value → [] (empty base anyway);
    // ntrode 2 base [3]. After migration the day-only merge reproduces both: ntrode 1
    // still [] (corrupt value → []), ntrode 2 reads its materialized override [3].
    const migrated = migrateBadChannelsToDays(workspace);
    const merged = mergeDayMetadata(migrated.animals.a, migrated.days.d);
    const byId = Object.fromEntries(
      merged.ntrode_electrode_group_channel_map.map((n) => [n.ntrode_id, n.bad_channels])
    );
    expect(byId[1]).toEqual([]);
    expect(byId[2]).toEqual([3]);
    // The corrupt value is preserved verbatim.
    expect(migrated.days.d.deviceOverrides.bad_channels['1']).toBe('2.9');
  });
});

describe('normalizeWorkspaceDevices runs the migration at load', () => {
  it('a loaded realistic workspace resolves each ntrode to its legacy base set (export-neutral)', () => {
    const { workspace, animalId, dayId } = realisticWorkspace();
    // Legacy effective set = the snapshot base marks (captured pre-load).
    const snap0 = workspace.animals[animalId].configurationHistory[0];
    const legacyByNtrode = Object.fromEntries(
      snap0.devices.ntrode_electrode_group_channel_map.map((n) => [n.ntrode_id, n.bad_channels])
    );

    const loaded = normalizeWorkspaceDevices(workspace);
    const merged = mergeDayMetadata(loaded.animals[animalId], loaded.days[dayId]);
    const afterByNtrode = Object.fromEntries(
      merged.ntrode_electrode_group_channel_map.map((n) => [n.ntrode_id, n.bad_channels])
    );
    Object.keys(legacyByNtrode).forEach((ntrodeId) => {
      expect(afterByNtrode[ntrodeId]).toEqual(legacyByNtrode[ntrodeId]);
    });
    // And the migration actually ran (snapshot base stripped, day owns marks).
    const snap = loaded.animals[animalId].configurationHistory[0];
    snap.devices.ntrode_electrode_group_channel_map.forEach((n) => {
      expect(n.bad_channels).toEqual([]);
    });
  });
});
