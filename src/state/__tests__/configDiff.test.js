import { describe, it, expect } from 'vitest';
import { diffProbeConfigs, reconcileAppliedToDays } from '../configDiff';
import { resolveDayConfig } from '../workspaceUtils';
import { makeReconfigWorkspace } from './fixtures/reconfigWorkspace';

const group = (id, over = {}) => ({
  id,
  location: 'CA1',
  device_type: 'tetrode_12.5',
  description: `tetrode ${id}`,
  targeted_location: 'CA1',
  targeted_x: 3,
  targeted_y: 2.5,
  targeted_z: 2,
  units: 'mm',
  ...over,
});

const ntrode = (ntrode_id, over = {}) => ({
  ntrode_id,
  electrode_group_id: ntrode_id - 1,
  bad_channels: [],
  map: { 0: 0, 1: 1, 2: 2, 3: 3 },
  ...over,
});

const config = (electrode_groups, ntrode_electrode_group_channel_map) => ({
  electrode_groups,
  ntrode_electrode_group_channel_map,
});

describe('diffProbeConfigs', () => {
  it('detects a group added', () => {
    const prev = config([group(0)], [ntrode(1)]);
    const next = config([group(0), group(1)], [ntrode(1)]);

    const diff = diffProbeConfigs(prev, next);

    expect(diff.electrodeGroups.added.map((g) => g.id)).toEqual([1]);
    expect(diff.electrodeGroups.removed).toEqual([]);
    expect(diff.hasChanges).toBe(true);
  });

  it('detects a group removed', () => {
    const prev = config([group(0), group(1)], [ntrode(1)]);
    const next = config([group(0)], [ntrode(1)]);

    const diff = diffProbeConfigs(prev, next);

    expect(diff.electrodeGroups.removed.map((g) => g.id)).toEqual([1]);
    expect(diff.electrodeGroups.added).toEqual([]);
    expect(diff.hasChanges).toBe(true);
  });

  it('detects a group changed and names the differing fields', () => {
    const prev = config([group(0, { location: 'CA1', device_type: 'tetrode_12.5' })], [ntrode(1)]);
    const next = config([group(0, { location: 'CA3', device_type: 'A1x32-6mm-50-177-H32_21mm' })], [ntrode(1)]);

    const diff = diffProbeConfigs(prev, next);

    expect(diff.electrodeGroups.changed).toHaveLength(1);
    const changed = diff.electrodeGroups.changed[0];
    expect(changed.id).toBe(0);
    expect(changed.fields.sort()).toEqual(['device_type', 'location']);
    expect(changed.before.location).toBe('CA1');
    expect(changed.after.location).toBe('CA3');
    expect(diff.hasChanges).toBe(true);
  });

  it('detects a channel-map map change (map only, not bad_channels)', () => {
    const prev = config([group(0)], [ntrode(1, { map: { 0: 0, 1: 1, 2: 2, 3: 3 } })]);
    const next = config([group(0)], [ntrode(1, { map: { 0: 4, 1: 5, 2: 6, 3: 7 } })]);

    const diff = diffProbeConfigs(prev, next);

    expect(diff.channelMaps.changed).toHaveLength(1);
    expect(diff.channelMaps.changed[0]).toMatchObject({
      ntrode_id: 1,
      mapChanged: true,
      badChannelsChanged: false,
    });
  });

  it('detects a bad-channels change set-wise (order-independent)', () => {
    const prev = config([group(0)], [ntrode(1, { bad_channels: [1, 2] })]);
    const next = config([group(0)], [ntrode(1, { bad_channels: [2, 1, 3] })]);

    const diff = diffProbeConfigs(prev, next);

    expect(diff.channelMaps.changed).toHaveLength(1);
    expect(diff.channelMaps.changed[0]).toMatchObject({
      ntrode_id: 1,
      mapChanged: false,
      badChannelsChanged: true,
    });
  });

  it('reports no changes for identical configs (any key order)', () => {
    const prev = config([group(0), group(1)], [ntrode(1), ntrode(2)]);
    const next = config(
      [group(1), group(0)],
      [ntrode(2), ntrode(1, { map: { 3: 3, 2: 2, 1: 1, 0: 0 } })]
    );

    const diff = diffProbeConfigs(prev, next);

    expect(diff.electrodeGroups.added).toEqual([]);
    expect(diff.electrodeGroups.removed).toEqual([]);
    expect(diff.electrodeGroups.changed).toEqual([]);
    expect(diff.channelMaps.added).toEqual([]);
    expect(diff.channelMaps.removed).toEqual([]);
    expect(diff.channelMaps.changed).toEqual([]);
    expect(diff.hasChanges).toBe(false);
  });

  it('produces deterministic (sorted) output regardless of input array order', () => {
    const a = config([group(2), group(0), group(1)], [ntrode(3), ntrode(1), ntrode(2)]);
    const b = config([group(0)], [ntrode(1)]);

    const diff1 = diffProbeConfigs(b, a);
    const diff2 = diffProbeConfigs(b, config([group(1), group(2), group(0)], [ntrode(2), ntrode(3), ntrode(1)]));

    expect(diff1.electrodeGroups.added.map((g) => g.id)).toEqual([1, 2]);
    expect(diff1.channelMaps.added.map((n) => n.ntrode_id)).toEqual([2, 3]);
    expect(diff1).toEqual(diff2);
  });
});

describe('resolveDayConfig', () => {
  it('selects the snapshot matching configurationVersion; falls back to latest when unmatched', () => {
    const { workspace, animalId, dayIds, v1, v2 } = makeReconfigWorkspace();
    const animal = workspace.animals[animalId];

    const day1 = workspace.days[dayIds.day1]; // version 1
    const day3 = workspace.days[dayIds.day3]; // version 2
    expect(resolveDayConfig(animal, day1).electrode_groups.map((g) => g.id)).toEqual(
      v1.electrode_groups.map((g) => g.id)
    );
    expect(resolveDayConfig(animal, day3).electrode_groups.map((g) => g.id)).toEqual(
      v2.electrode_groups.map((g) => g.id)
    );

    // Unmatched version → falls back to the latest snapshot (v2), matching mergeDayMetadata.
    const orphan = { ...day1, configurationVersion: 99 };
    expect(resolveDayConfig(animal, orphan).electrode_groups.map((g) => g.id)).toEqual(
      v2.electrode_groups.map((g) => g.id)
    );
  });

  it('lets day deviceOverrides take precedence over the snapshot', () => {
    const { workspace, animalId, dayIds } = makeReconfigWorkspace();
    const animal = workspace.animals[animalId];
    const overrideGroups = [group(7, { location: 'PFC' })];
    const day = {
      ...workspace.days[dayIds.day1],
      deviceOverrides: { electrode_groups: overrideGroups },
    };

    expect(resolveDayConfig(animal, day).electrode_groups).toEqual(overrideGroups);
  });
});

describe('reconcileAppliedToDays', () => {
  it('derives each snapshot day list purely from days’ configurationVersion', () => {
    const { workspace, animalId, dayIds } = makeReconfigWorkspace();
    const animal = workspace.animals[animalId];
    // Corrupt the stored lists; the derived view must ignore them.
    animal.configurationHistory[0].appliedToDays = ['bogus'];
    animal.configurationHistory[1].appliedToDays = [];

    const byVersion = reconcileAppliedToDays(animal, workspace.days);

    expect(byVersion[1].sort()).toEqual([dayIds.day1, dayIds.day2].sort());
    expect(byVersion[2].sort()).toEqual([dayIds.day3, dayIds.day4].sort());
  });
});
