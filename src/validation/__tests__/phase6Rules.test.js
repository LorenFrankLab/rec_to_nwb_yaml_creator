/**
 * Phase 6 — Validation completeness rules.
 *
 * Unit tests for the cross-reference / channel-bound / identity rules added to
 * {@link rulesValidation}. Each rule has both a failing (invalid) and a passing
 * (valid) case. Reference bounds come from the real device helpers
 * (getChannelCount / deviceTypeMap), never hardcoded.
 *
 * Model shape: these rules see the *merged day metadata* (flat YAML), so tests
 * construct flat models directly.
 *
 * TDD: tests written FIRST, then implementation.
 */

import { describe, it, expect } from 'vitest';
import { rulesValidation } from '../rulesValidation';
import { getChannelCount } from '../../utils/deviceTypeUtils';
import { deviceTypeMap } from '../../ntrode/deviceTypes';

const codes = (issues) => issues.map((i) => i.code);

describe('Phase 6: dangling camera references (Task 1)', () => {
  it('errors when a task camera_id (array) references a missing camera', () => {
    const model = {
      cameras: [{ id: 0, camera_name: 'overhead' }],
      tasks: [{ task_name: 'run', camera_id: [99], task_epochs: [1] }],
    };
    const issues = rulesValidation(model);
    const ref = issues.filter((i) => i.code === 'dangling_camera_ref');
    expect(ref).toHaveLength(1);
    expect(ref[0].severity).toBe('error');
    expect(ref[0].message).toContain('99');
  });

  it('passes when a task camera_id references an existing camera', () => {
    const model = {
      cameras: [{ id: 0, camera_name: 'overhead' }],
      tasks: [{ task_name: 'run', camera_id: [0], task_epochs: [1] }],
    };
    expect(codes(rulesValidation(model))).not.toContain('dangling_camera_ref');
  });

  it('errors when a video camera_id (scalar) references a missing camera', () => {
    const model = {
      cameras: [{ id: 0, camera_name: 'overhead' }],
      tasks: [{ task_name: 'run', camera_id: [0], task_epochs: [2] }],
      associated_video_files: [{ name: 'v', camera_id: 99, task_epochs: 2 }],
    };
    const ref = rulesValidation(model).filter((i) => i.code === 'dangling_camera_ref');
    expect(ref).toHaveLength(1);
    expect(ref[0].path).toContain('associated_video_files');
  });

  it('passes when a video camera_id (scalar) references an existing camera', () => {
    const model = {
      cameras: [{ id: 0, camera_name: 'overhead' }],
      tasks: [{ task_name: 'run', camera_id: [0], task_epochs: [2] }],
      associated_video_files: [{ name: 'v', camera_id: 0, task_epochs: 2 }],
    };
    expect(codes(rulesValidation(model))).not.toContain('dangling_camera_ref');
  });

  it('treats scalar 0 as a real reference (not falsy-empty)', () => {
    // camera_id: 0 is a valid reference; must not be skipped as "empty".
    const model = {
      cameras: [{ id: 5, camera_name: 'overhead' }],
      associated_video_files: [{ name: 'v', camera_id: 0, task_epochs: 1 }],
      tasks: [{ task_name: 'run', camera_id: [5], task_epochs: [1] }],
    };
    const ref = rulesValidation(model).filter((i) => i.code === 'dangling_camera_ref');
    expect(ref).toHaveLength(1); // id 0 is dangling (only camera id is 5)
  });
});

describe('Phase 6: dangling electrode-group references (Task 2)', () => {
  it('errors when an ntrode electrode_group_id has no matching group', () => {
    const model = {
      electrode_groups: [{ id: 0, device_type: 'tetrode_12.5', location: 'CA1', targeted_location: 'CA1' }],
      ntrode_electrode_group_channel_map: [
        { ntrode_id: 1, electrode_group_id: 7, bad_channels: [], map: { 0: 0, 1: 1, 2: 2, 3: 3 } },
      ],
    };
    const ref = rulesValidation(model).filter((i) => i.code === 'dangling_electrode_group_ref');
    expect(ref).toHaveLength(1);
    expect(ref[0].severity).toBe('error');
  });

  it('passes when every ntrode electrode_group_id matches a group', () => {
    const model = {
      electrode_groups: [{ id: 0, device_type: 'tetrode_12.5', location: 'CA1', targeted_location: 'CA1' }],
      ntrode_electrode_group_channel_map: [
        { ntrode_id: 1, electrode_group_id: 0, bad_channels: [], map: { 0: 0, 1: 1, 2: 2, 3: 3 } },
      ],
    };
    expect(codes(rulesValidation(model))).not.toContain('dangling_electrode_group_ref');
  });
});

// Helpers for channel-bound fixtures — bounds come from the real device helpers.
const tetrodeGroup = (id, location = 'CA1') => ({
  id,
  device_type: 'tetrode_12.5',
  location,
  targeted_location: location,
});
const fourShankGroup = (id) => ({
  id,
  device_type: '128c-4s8mm6cm-20um-40um-sl',
  location: 'CA1',
  targeted_location: 'CA1',
});
// Build a per-shank ntrode for a multi-shank probe at shank index `shank`.
const shankNtrode = (ntrodeId, groupId, deviceType, shank) => {
  const perShank = deviceTypeMap(deviceType); // e.g. [0..31]
  const map = {};
  perShank.forEach((electrodeId, localKey) => {
    map[localKey] = shank * perShank.length + electrodeId;
  });
  return { ntrode_id: ntrodeId, electrode_group_id: groupId, bad_channels: [], map };
};

describe('Phase 6: channel bounds (Task 3)', () => {
  it('errors when a second tetrode group maps values 4..7 (must reset 0..3)', () => {
    // Each tetrode is its own probe; values are probe electrode ids reset per
    // group. getChannelCount('tetrode_12.5') === 4, so 4..7 are out of range.
    expect(getChannelCount('tetrode_12.5')).toBe(4);
    const model = {
      electrode_groups: [tetrodeGroup(0), tetrodeGroup(1)],
      ntrode_electrode_group_channel_map: [
        { ntrode_id: 1, electrode_group_id: 0, bad_channels: [], map: { 0: 0, 1: 1, 2: 2, 3: 3 } },
        { ntrode_id: 2, electrode_group_id: 1, bad_channels: [], map: { 0: 4, 1: 5, 2: 6, 3: 7 } },
      ],
    };
    const issues = rulesValidation(model);
    expect(codes(issues)).toContain('channel_value_out_of_range');
    expect(issues.find((i) => i.code === 'channel_value_out_of_range').severity).toBe('error');
  });

  it('passes when each tetrode group resets values to 0..3', () => {
    const model = {
      electrode_groups: [tetrodeGroup(0), tetrodeGroup(1)],
      ntrode_electrode_group_channel_map: [
        { ntrode_id: 1, electrode_group_id: 0, bad_channels: [], map: { 0: 0, 1: 1, 2: 2, 3: 3 } },
        { ntrode_id: 2, electrode_group_id: 1, bad_channels: [], map: { 0: 0, 1: 1, 2: 2, 3: 3 } },
      ],
    };
    const issues = rulesValidation(model);
    expect(codes(issues)).not.toContain('channel_value_out_of_range');
    expect(codes(issues)).not.toContain('channel_partition_invalid');
  });

  it('passes when a 4-shank probe partitions 0..127 across shanks', () => {
    const dt = '128c-4s8mm6cm-20um-40um-sl';
    const model = {
      electrode_groups: [fourShankGroup(0)],
      ntrode_electrode_group_channel_map: [
        shankNtrode(1, 0, dt, 0),
        shankNtrode(2, 0, dt, 1),
        shankNtrode(3, 0, dt, 2),
        shankNtrode(4, 0, dt, 3),
      ],
    };
    const issues = rulesValidation(model);
    expect(codes(issues)).not.toContain('channel_value_out_of_range');
    expect(codes(issues)).not.toContain('channel_partition_invalid');
  });

  it('errors when two shanks of a multi-shank probe share 0..31 (missing offset)', () => {
    const dt = '128c-4s8mm6cm-20um-40um-sl';
    const model = {
      electrode_groups: [fourShankGroup(0)],
      ntrode_electrode_group_channel_map: [
        shankNtrode(1, 0, dt, 0), // 0..31
        shankNtrode(2, 0, dt, 0), // 0..31 again — collision, no offset
        shankNtrode(3, 0, dt, 2), // 64..95
        shankNtrode(4, 0, dt, 3), // 96..127
      ],
    };
    expect(codes(rulesValidation(model))).toContain('channel_partition_invalid');
  });

  it('errors on out-of-range bad_channels index; passes for in-range', () => {
    const bad = {
      electrode_groups: [tetrodeGroup(0)],
      ntrode_electrode_group_channel_map: [
        { ntrode_id: 1, electrode_group_id: 0, bad_channels: [99], map: { 0: 0, 1: 1, 2: 2, 3: 3 } },
      ],
    };
    expect(codes(rulesValidation(bad))).toContain('bad_channel_out_of_range');

    const ok = {
      electrode_groups: [tetrodeGroup(0)],
      ntrode_electrode_group_channel_map: [
        { ntrode_id: 1, electrode_group_id: 0, bad_channels: [2], map: { 0: 0, 1: 1, 2: 2, 3: 3 } },
      ],
    };
    expect(codes(rulesValidation(ok))).not.toContain('bad_channel_out_of_range');
  });

  it('errors when map keys are not 0..(count-1) (missing key 1)', () => {
    const model = {
      electrode_groups: [tetrodeGroup(0)],
      ntrode_electrode_group_channel_map: [
        { ntrode_id: 1, electrode_group_id: 0, bad_channels: [], map: { 0: 0, 2: 2, 3: 3 } },
      ],
    };
    expect(codes(rulesValidation(model))).toContain('channel_key_out_of_range');
  });

  it('does not run channel-bound checks for an unknown device_type', () => {
    // Unknown device → getChannelCount 0; Task 5 reports the unknown device,
    // channel bounds are skipped (no spurious out-of-range noise).
    const model = {
      electrode_groups: [{ id: 0, device_type: 'made_up_probe', location: 'CA1', targeted_location: 'CA1' }],
      ntrode_electrode_group_channel_map: [
        { ntrode_id: 1, electrode_group_id: 0, bad_channels: [5], map: { 0: 9, 1: 9 } },
      ],
    };
    const c = codes(rulesValidation(model));
    expect(c).not.toContain('channel_value_out_of_range');
    expect(c).not.toContain('bad_channel_out_of_range');
  });
});
