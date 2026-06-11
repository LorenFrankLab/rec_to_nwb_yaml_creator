/**
 * Characterization net for the shared device-override merge.
 *
 * `resolveDayConfig` (state/workspaceUtils.js) applies a day's `deviceOverrides` over its
 * pinned configuration snapshot, and `dayOverrideIssues` (domain/validation.js) surfaces every
 * override shape the merge cannot honor cleanly. The two were coupled "by comment only": the
 * merge silently fails open on a malformed override, and the validator must surface exactly
 * those cases. This test pins the CURRENT, observable output of BOTH functions across the day
 * shapes that exercise the override merge (valid, bad-channel override, and the corrupt shapes),
 * so factoring the shared resolution + honor-ability decision into one module cannot change a
 * single byte of either function's behavior. A diff here is a real behavior change, not a
 * refactor side effect.
 */
import { describe, it, expect } from 'vitest';
import { resolveDayConfig, mergeDayMetadata } from '../../state/workspaceUtils';
import { dayOverrideIssues } from '../validation';
import { buildRealisticWorkspace } from '../../__tests__/fixtures/workspaceBuilders';

/**
 * Project a `resolveDayConfig` result to the parts the override merge decides: which
 * geometry source won (group ids), each ntrode's resolved `bad_channels`, and the resolved
 * configuration version. (Full normalization byte-identity of the exported devices is covered
 * by the golden baselines; this projection isolates the override-merge outputs.)
 *
 * @param {{ electrode_groups: object[], ntrode_electrode_group_channel_map: object[], configurationVersion: number }} resolved
 * @returns {{ electrodeGroupIds: number[], badChannelsByNtrode: Record<string, number[]>, configurationVersion: number }}
 */
function projectResolved(resolved) {
  return {
    electrodeGroupIds: resolved.electrode_groups.map((g) => g.id),
    badChannelsByNtrode: Object.fromEntries(
      resolved.ntrode_electrode_group_channel_map.map((n) => [String(n.ntrode_id), n.bad_channels])
    ),
    configurationVersion: resolved.configurationVersion,
  };
}

describe('resolveDayConfig — device-override resolution is pinned', () => {
  it('a valid day (no overrides) resolves the snapshot geometry with every ntrode failed-channel set EMPTY', () => {
    // The merge reads bad_channels from the day override ONLY; with no override every ntrode
    // resolves to [] even though the snapshot bases carry [2]/[3] (the load-time migration is
    // what moves a base mark down onto a day).
    const { animal, day } = buildRealisticWorkspace();
    expect(projectResolved(resolveDayConfig(animal, day))).toEqual({
      electrodeGroupIds: [0, 1, 2, 3, 4, 5, 6, 7],
      badChannelsByNtrode: { 1: [], 2: [], 3: [], 4: [], 5: [], 6: [], 7: [], 8: [] },
      configurationVersion: 1,
    });
  });

  it('a bad-channel override replaces ONLY the targeted ntrode, leaving the rest empty', () => {
    const { animal, day } = buildRealisticWorkspace();
    day.deviceOverrides = { bad_channels: { 1: [1, 2] } };
    expect(projectResolved(resolveDayConfig(animal, day))).toEqual({
      electrodeGroupIds: [0, 1, 2, 3, 4, 5, 6, 7],
      badChannelsByNtrode: { 1: [1, 2], 2: [], 3: [], 4: [], 5: [], 6: [], 7: [], 8: [] },
      configurationVersion: 1,
    });
  });

  it('a stale bad-channel override (no matching ntrode) is dropped — every ntrode stays empty', () => {
    const { animal, day } = buildRealisticWorkspace();
    day.deviceOverrides = { bad_channels: { 999: [0] } };
    expect(projectResolved(resolveDayConfig(animal, day))).toEqual({
      electrodeGroupIds: [0, 1, 2, 3, 4, 5, 6, 7],
      badChannelsByNtrode: { 1: [], 2: [], 3: [], 4: [], 5: [], 6: [], 7: [], 8: [] },
      configurationVersion: 1,
    });
  });

  it('a non-array bad-channel value under a valid key resolves to [] (not smeared onto the row)', () => {
    const { animal, day } = buildRealisticWorkspace();
    day.deviceOverrides = { bad_channels: { 1: '23' } };
    const resolved = resolveDayConfig(animal, day);
    expect(resolved.ntrode_electrode_group_channel_map.find((n) => n.ntrode_id === 1).bad_channels).toEqual([]);
  });

  it('a whole-container-corrupt override fails open to the snapshot geometry, all failed channels empty', () => {
    const { animal, day } = buildRealisticWorkspace();
    day.deviceOverrides = 'corrupt';
    expect(projectResolved(resolveDayConfig(animal, day))).toEqual({
      electrodeGroupIds: [0, 1, 2, 3, 4, 5, 6, 7],
      badChannelsByNtrode: { 1: [], 2: [], 3: [], 4: [], 5: [], 6: [], 7: [], 8: [] },
      configurationVersion: 1,
    });
  });

  it('a non-array geometry override falls back to the snapshot geometry', () => {
    const { animal, day } = buildRealisticWorkspace();
    day.deviceOverrides = { electrode_groups: 'corrupt' };
    expect(resolveDayConfig(animal, day).electrode_groups.map((g) => g.id)).toEqual([0, 1, 2, 3, 4, 5, 6, 7]);
  });

  it('a well-formed array geometry override SHADOWS the snapshot (override ids win, not the snapshot)', () => {
    // The consequential direction: a day-level array override must REPLACE the snapshot
    // geometry at export. If it silently stopped shadowing, the day would export the wrong
    // probe geometry. Pin the resolved ids/bad-channels through resolveDayConfig.
    const { animal, day } = buildRealisticWorkspace();
    day.deviceOverrides = {
      electrode_groups: [{ id: 42, location: 'PFC', device_type: 'tetrode_12.5' }],
      ntrode_electrode_group_channel_map: [
        { ntrode_id: 9, electrode_group_id: 42, map: { 0: 0, 1: 1, 2: 2, 3: 3 } },
      ],
      bad_channels: { 9: [1] },
    };
    expect(projectResolved(resolveDayConfig(animal, day))).toEqual({
      electrodeGroupIds: [42],
      badChannelsByNtrode: { 9: [1] },
      configurationVersion: 1,
    });
  });

  it('does not mutate the snapshot it resolved from', () => {
    const { animal, day } = buildRealisticWorkspace();
    day.deviceOverrides = { bad_channels: { 1: [0] } };
    resolveDayConfig(animal, day);
    // Snapshot ntrode 3's base [2] is untouched by the resolution.
    const snap = animal.configurationHistory[0].devices.ntrode_electrode_group_channel_map;
    expect(snap.find((n) => n.ntrode_id === 3).bad_channels).toEqual([2]);
  });
});

describe('dayOverrideIssues — the honor-ability check is pinned', () => {
  // A merged model with the realistic ntrode id set (1..8), used for stale-key resolution.
  const { animal, day: baseDay } = buildRealisticWorkspace();
  const merged = mergeDayMetadata(animal, baseDay);

  it('a valid day with no overrides surfaces no issues', () => {
    expect(dayOverrideIssues(baseDay, merged, [])).toEqual([]);
  });

  it('a well-formed bad-channel override surfaces no issues', () => {
    const day = { ...baseDay, deviceOverrides: { bad_channels: { 1: [1, 2] } } };
    expect(dayOverrideIssues(day, merged, [])).toEqual([]);
  });

  it('a stale bad-channel override is surfaced exactly', () => {
    const day = { ...baseDay, deviceOverrides: { bad_channels: { 999: [0] } } };
    expect(dayOverrideIssues(day, merged, [])).toMatchInlineSnapshot(`
      [
        {
          "actionLabel": "Remove stale failed-channel override",
          "code": "stale_bad_channel_override",
          "field": "bad_channels",
          "message": "A day-level bad-channel override targets ntrode "999", which no longer exists in this day's channel map. Remove the stale override or restore the ntrode.",
          "path": "deviceOverrides.bad_channels.999",
          "repairCommand": {
            "key": "999",
            "type": "removeBadChannelOverrideKey",
          },
          "repairSurface": "day",
          "severity": "error",
          "step": "devices",
        },
      ]
    `);
  });

  it('a non-array bad-channel value under a valid key is surfaced exactly', () => {
    const day = { ...baseDay, deviceOverrides: { bad_channels: { 1: '23' } } };
    expect(dayOverrideIssues(day, merged, [])).toMatchInlineSnapshot(`
      [
        {
          "actionLabel": "Remove failed-channel override",
          "code": "malformed_bad_channel_override",
          "field": "bad_channels",
          "message": "A day-level failed-channel override for ntrode "1" is corrupt (expected a list of channel numbers). Remove the stale override to clear this error.",
          "path": "deviceOverrides.bad_channels.1",
          "repairCommand": {
            "key": "1",
            "type": "removeBadChannelOverrideKey",
          },
          "repairSurface": "day",
          "severity": "error",
          "step": "devices",
        },
      ]
    `);
  });

  it('a whole-container-corrupt override is surfaced exactly', () => {
    const day = { ...baseDay, deviceOverrides: 'corrupt' };
    expect(dayOverrideIssues(day, merged, [])).toMatchInlineSnapshot(`
      [
        {
          "actionLabel": "Remove device overrides",
          "code": "malformed_device_override",
          "field": "deviceOverrides",
          "message": "This day's device overrides are corrupt (expected an object). They are being ignored in favor of the saved configuration — remove them to clear this error.",
          "path": "deviceOverrides",
          "repairCommand": {
            "type": "resetDeviceOverrides",
          },
          "repairSurface": "day",
          "severity": "error",
          "step": "devices",
        },
      ]
    `);
  });

  it('a non-array geometry override is surfaced exactly', () => {
    const day = { ...baseDay, deviceOverrides: { electrode_groups: 'corrupt' } };
    expect(dayOverrideIssues(day, merged, [])).toMatchInlineSnapshot(`
      [
        {
          "actionLabel": "Remove device override",
          "code": "malformed_device_override",
          "field": "electrode_groups",
          "message": "This day's "electrode_groups" device override is corrupt (expected a list of devices). It is being ignored in favor of the saved configuration — remove the override to clear this error.",
          "path": "deviceOverrides.electrode_groups",
          "repairCommand": {
            "key": "electrode_groups",
            "type": "removeDeviceOverrideKey",
          },
          "repairSurface": "day",
          "severity": "error",
          "step": "devices",
        },
      ]
    `);
  });

  it('a scalar bad-channel CONTAINER is surfaced exactly', () => {
    const day = { ...baseDay, deviceOverrides: { bad_channels: '2.9' } };
    expect(dayOverrideIssues(day, merged, [])).toMatchInlineSnapshot(`
      [
        {
          "actionLabel": "Remove failed-channel override",
          "code": "malformed_bad_channel_override",
          "field": "bad_channels",
          "message": "This day's failed-channel override is corrupt (expected a map of ntrode id → failed-channel list). It is being ignored — remove the override to clear this error.",
          "path": "deviceOverrides.bad_channels",
          "repairCommand": {
            "type": "resetBadChannelOverrides",
          },
          "repairSurface": "day",
          "severity": "error",
          "step": "devices",
        },
      ]
    `);
  });

  it('a clean array geometry override whose CONTENTS error surfaces a shadowed-override escape', () => {
    const erroringMerged = { electrode_groups: [{ id: 0 }], ntrode_electrode_group_channel_map: [] };
    const day = { ...baseDay, deviceOverrides: { electrode_groups: [{ id: 0 }] } };
    expect(
      dayOverrideIssues(day, erroringMerged, [{ severity: 'error', path: 'electrode_groups[0].location' }])
    ).toMatchInlineSnapshot(`
      [
        {
          "actionLabel": "Remove device override",
          "code": "shadowed_geometry_override",
          "field": "electrode_groups",
          "message": "This day overrides the saved device electrode groups and the override has validation errors. Those errors can't be fixed in Animal Setup (which edits the saved configuration, not this day's override). Remove the day override to use the saved configuration.",
          "path": "deviceOverrides.electrode_groups",
          "repairSurface": "day",
          "severity": "error",
          "step": "devices",
        },
      ]
    `);
  });

  it('an override ROW carrying bad_channels not covered by the bad_channels map is surfaced exactly', () => {
    const day = {
      ...baseDay,
      deviceOverrides: {
        ntrode_electrode_group_channel_map: [
          { ntrode_id: 1, electrode_group_id: 0, map: { 0: 0, 1: 1, 2: 2, 3: 3 }, bad_channels: [3] },
        ],
      },
    };
    expect(dayOverrideIssues(day, merged, [])).toMatchInlineSnapshot(`
      [
        {
          "actionLabel": "Move failed channels to day overrides",
          "code": "bad_channels_on_override_row_ignored",
          "field": "bad_channels",
          "message": "This day's channel-map override carries failed channels on ntrode "1", but failed channels on an override row are IGNORED at export (they are resolved only from the day's failed-channel overrides). Move them into this day's failed-channel overrides so they are not silently lost.",
          "path": "deviceOverrides.bad_channels.1",
          "repairSurface": "day",
          "severity": "error",
          "step": "devices",
        },
      ]
    `);
  });
});
