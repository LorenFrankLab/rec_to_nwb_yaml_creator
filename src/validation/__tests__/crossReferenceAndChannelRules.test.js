/**
 * Cross-reference and channel-bound validation rules.
 *
 * Unit tests for the cross-reference / channel-bound / identity rules added to
 * {@link rulesValidation}. Each rule has both a failing (invalid) and a passing
 * (valid) case. Reference bounds come from the real device helpers
 * (getChannelCount / probe catalog), never hardcoded.
 *
 * Model shape: these rules see the *merged day metadata* (flat YAML), so tests
 * construct flat models directly.
 *
 * TDD: tests written FIRST, then implementation.
 */

import { describe, it, expect } from 'vitest';
import { rulesValidation } from '../rulesValidation';
import { getChannelCount } from '../../utils/deviceTypeUtils';
import { getProbeShanks } from '../../ntrode/probeCatalog';

const codes = (issues) => issues.map((i) => i.code);

describe('dangling camera references', () => {
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

describe('dangling electrode-group references', () => {
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
// Build a per-shank ntrode for a multi-shank probe at shank index `shank`,
// using the VERIFIED probe catalog (converter truth). Local keys are
// 0..(shankLen-1); values are that shank's actual electrode ids — which is
// byte-identical to the old even-offset math for evenly-partitioned probes and
// CORRECT for the uneven 64c-3s probe (21/21/22).
const shankNtrode = (ntrodeId, groupId, deviceType, shank) => {
  const shanks = getProbeShanks(deviceType);
  const ids = shanks[shank].electrodeIds;
  const map = {};
  ids.forEach((electrodeId, localKey) => {
    map[localKey] = electrodeId;
  });
  return { ntrode_id: ntrodeId, electrode_group_id: groupId, bad_channels: [], map };
};
// Build ALL per-shank ntrodes for a group from the catalog (a correct, complete map).
const catalogNtrodes = (groupId, deviceType, startId = 1) =>
  getProbeShanks(deviceType).map((_, shank) =>
    shankNtrode(startId + shank, groupId, deviceType, shank)
  );

describe('channel bounds', () => {
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
    // One mistake, one error: out-of-range (but unique) values must NOT also
    // trip the cross-ntrode collision rule.
    expect(codes(issues)).not.toContain('channel_partition_invalid');
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

  it('passes for a catalog-correct 64c-3s map (uneven 21/21/22 covering ids 0..63)', () => {
    // The converter indexes hw_channel_map[group][str(electrode_id)] for EVERY
    // probe electrode 0..getChannelCount-1. 64c-3s partitions 64 electrodes
    // UNEVENLY (21/21/22). A catalog-correct map covers ids 0..63 exactly once
    // and is converter-valid, so it must NOT be flagged.
    const dt = '64c-3s6mm6cm-20um-40um-sl';
    expect(getChannelCount(dt)).toBe(64);
    const model = {
      electrode_groups: [{ id: 0, device_type: dt, location: 'CA1', targeted_location: 'CA1' }],
      ntrode_electrode_group_channel_map: catalogNtrodes(0, dt),
    };
    const c = codes(rulesValidation(model));
    expect(c).not.toContain('channel_partition_invalid');
    expect(c).not.toContain('channel_value_out_of_range');
    expect(c).not.toContain('channel_key_out_of_range');
  });

  it('errors when a 64c-3s map under-generates and drops electrode ids 60..63', () => {
    // A stale/old 64c-3s map that assumed 20/20/20 covers only ids 0..59 — the
    // converter looks up 60..63 and fails. It must be flagged (not accepted).
    const dt = '64c-3s6mm6cm-20um-40um-sl';
    const twenty = (offset) =>
      Object.fromEntries(Array.from({ length: 20 }, (_, i) => [i, offset + i]));
    const model = {
      electrode_groups: [{ id: 0, device_type: dt, location: 'CA1', targeted_location: 'CA1' }],
      ntrode_electrode_group_channel_map: [
        { ntrode_id: 1, electrode_group_id: 0, bad_channels: [], map: twenty(0) },
        { ntrode_id: 2, electrode_group_id: 0, bad_channels: [], map: twenty(20) },
        { ntrode_id: 3, electrode_group_id: 0, bad_channels: [], map: twenty(40) },
      ],
    };
    expect(codes(rulesValidation(model))).toContain('channel_partition_invalid');
  });

  it('errors when a group map duplicates an electrode id across shanks', () => {
    // A repeated electrode id (and the consequent missing id) breaks the
    // complete-coverage contract the converter relies on.
    const dt = '128c-4s8mm6cm-20um-40um-sl';
    const model = {
      electrode_groups: [fourShankGroup(0)],
      ntrode_electrode_group_channel_map: [
        shankNtrode(1, 0, dt, 0),
        shankNtrode(2, 0, dt, 1),
        shankNtrode(3, 0, dt, 2),
        // Shank 3 wrongly repeats shank 2's ids (64..95) instead of 96..127.
        shankNtrode(4, 0, dt, 2),
      ],
    };
    expect(codes(rulesValidation(model))).toContain('channel_partition_invalid');
  });

  it('errors when a multi-shank ROW has the wrong key count for its shank', () => {
    // Row count must equal num_shanks, and matched by order, row i's keys must be
    // 0..(shank_i.length-1). 64c-3s shank 2 has 22 keys; a 21-key row there is wrong.
    const dt = '64c-3s6mm6cm-20um-40um-sl';
    const rows = catalogNtrodes(0, dt);
    // Truncate the third (22-key) row to 21 keys (drop key 21 -> electrode id 63).
    const broken = { ...rows[2], map: { ...rows[2].map } };
    delete broken.map[21];
    const model = {
      electrode_groups: [{ id: 0, device_type: dt, location: 'CA1', targeted_location: 'CA1' }],
      ntrode_electrode_group_channel_map: [rows[0], rows[1], broken],
    };
    expect(codes(rulesValidation(model))).toContain('channel_key_out_of_range');
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

  it('errors on an extra (empty) ntrode row beyond the probe shank count', () => {
    // A tetrode is single-shank → exactly one ntrode row. An extra empty row
    // contributes no values (so coverage still passes) but the converter expects
    // one row per shank, so the row-count mismatch must be flagged.
    const model = {
      electrode_groups: [tetrodeGroup(0)],
      ntrode_electrode_group_channel_map: [
        { ntrode_id: 1, electrode_group_id: 0, bad_channels: [], map: { 0: 0, 1: 1, 2: 2, 3: 3 } },
        { ntrode_id: 2, electrode_group_id: 0, bad_channels: [], map: {} }, // excess empty row
      ],
    };
    expect(codes(rulesValidation(model))).toContain('channel_row_count_mismatch');
  });

  it('errors when a partially configured day has zero channel-map rows for one group', () => {
    const model = {
      electrode_groups: [tetrodeGroup(0), tetrodeGroup(1)],
      ntrode_electrode_group_channel_map: [
        { ntrode_id: 1, electrode_group_id: 0, bad_channels: [], map: { 0: 0, 1: 1, 2: 2, 3: 3 } },
      ],
    };
    const issues = rulesValidation(model).filter((issue) => issue.code === 'channel_row_count_mismatch');

    expect(issues).toHaveLength(1);
    expect(issues[0]).toMatchObject({
      path: 'electrode_groups[1]',
      field: 'map',
      step: 'devices',
      repairSurface: 'animal',
      severity: 'error',
    });
    expect(issues[0].message).toContain('no channel-map rows');
  });

  it('passes when row count equals the shank count', () => {
    const model = {
      electrode_groups: [tetrodeGroup(0)],
      ntrode_electrode_group_channel_map: [
        { ntrode_id: 1, electrode_group_id: 0, bad_channels: [], map: { 0: 0, 1: 1, 2: 2, 3: 3 } },
      ],
    };
    expect(codes(rulesValidation(model))).not.toContain('channel_row_count_mismatch');
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

  it('passes when map keys are exactly 0..(count-1)', () => {
    const model = {
      electrode_groups: [tetrodeGroup(0)],
      ntrode_electrode_group_channel_map: [
        { ntrode_id: 1, electrode_group_id: 0, bad_channels: [], map: { 0: 0, 1: 1, 2: 2, 3: 3 } },
      ],
    };
    expect(codes(rulesValidation(model))).not.toContain('channel_key_out_of_range');
  });

});

describe('location + targeted_location', () => {
  const group = (over) => ({
    id: 0,
    device_type: 'tetrode_12.5',
    location: 'CA1',
    targeted_location: 'CA1',
    ...over,
  });

  it('errors when location is empty or whitespace', () => {
    expect(codes(rulesValidation({ electrode_groups: [group({ location: '' })] }))).toContain('empty_location');
    expect(codes(rulesValidation({ electrode_groups: [group({ location: '   ' })] }))).toContain('empty_location');
  });

  it('errors when targeted_location is empty or whitespace', () => {
    expect(codes(rulesValidation({ electrode_groups: [group({ targeted_location: '' })] }))).toContain('empty_targeted_location');
  });

  it('passes when both location and targeted_location are non-empty', () => {
    const c = codes(rulesValidation({ electrode_groups: [group()] }));
    expect(c).not.toContain('empty_location');
    expect(c).not.toContain('empty_targeted_location');
  });

  it('warns (not errors) on mixed-case duplicate location across groups', () => {
    const issues = rulesValidation({
      electrode_groups: [group({ id: 0, location: 'CA1' }), group({ id: 1, location: 'ca1' })],
    });
    const warn = issues.find((i) => i.code === 'inconsistent_location_case');
    expect(warn).toBeDefined();
    expect(warn.severity).toBe('warning');
  });
});

describe('device_type known probe', () => {
  it('errors on an unknown device_type', () => {
    const issues = rulesValidation({
      electrode_groups: [{ id: 0, device_type: 'made_up_probe', location: 'CA1', targeted_location: 'CA1' }],
    });
    const unknown = issues.find((i) => i.code === 'unknown_device_type');
    expect(unknown).toBeDefined();
    expect(unknown.severity).toBe('error');
  });

  it('passes for a known device_type', () => {
    expect(codes(rulesValidation({
      electrode_groups: [{ id: 0, device_type: 'tetrode_12.5', location: 'CA1', targeted_location: 'CA1' }],
    }))).not.toContain('unknown_device_type');
  });
});

describe('behavioral-event name uniqueness', () => {
  it('errors on duplicate behavioral_events name', () => {
    const issues = rulesValidation({
      behavioral_events: [
        { name: 'reward', description: 'a' },
        { name: 'reward', description: 'b' },
      ],
    });
    const dup = issues.find((i) => i.code === 'duplicate_behavioral_event_name');
    expect(dup).toBeDefined();
    expect(dup.severity).toBe('error');
  });

  it('passes for unique behavioral_events names', () => {
    expect(codes(rulesValidation({
      behavioral_events: [
        { name: 'reward_left', description: 'a' },
        { name: 'reward_right', description: 'b' },
      ],
    }))).not.toContain('duplicate_behavioral_event_name');
  });

  it('reports a duplicate name exactly once (not once per offending row)', () => {
    const codeList = codes(rulesValidation({
      behavioral_events: [
        { name: 'Poke1', description: 'Din1' },
        { name: 'Poke1', description: 'Din2' },
        { name: 'Poke1', description: 'Din3' },
      ],
    }));
    expect(codeList.filter((c) => c === 'duplicate_behavioral_event_name')).toHaveLength(1);
  });

  it('does NOT flag two blank/whitespace-only names as a duplicate (blank channels are unused)', () => {
    expect(codes(rulesValidation({
      behavioral_events: [
        { name: '', description: 'Din1' },
        { name: '   ', description: 'Din2' },
      ],
    }))).not.toContain('duplicate_behavioral_event_name');
  });
});

describe('task/video dependency + camera refs', () => {
  it('errors on duplicate task epochs across task rows', () => {
    const issues = rulesValidation({
      cameras: [{ id: 0, camera_name: 'c' }],
      tasks: [
        { task_name: 'a', task_description: 'd1', camera_id: [0], task_epochs: [1, 2] },
        { task_name: 'b', task_description: 'd2', camera_id: [0], task_epochs: [2, 3] },
      ],
    });
    const dup = issues.find((i) => i.code === 'duplicate_task_epoch');
    expect(dup).toBeDefined();
    expect(dup.severity).toBe('error');
    expect(dup.message).toContain('2');
  });

  it('passes when task epochs are unique across tasks', () => {
    expect(codes(rulesValidation({
      cameras: [{ id: 0, camera_name: 'c' }],
      tasks: [
        { task_name: 'a', task_description: 'd1', camera_id: [0], task_epochs: [1] },
        { task_name: 'b', task_description: 'd2', camera_id: [0], task_epochs: [2, 3] },
      ],
    }))).not.toContain('duplicate_task_epoch');
  });

  it('allows a task with epochs and no camera (explicitly-allowed no-camera path)', () => {
    // A camera-less epoch (e.g. a sleep box with no video) is valid: Spyglass only
    // skips a VIDEO that lacks a backing epoch+camera, not a camera-less epoch.
    const issues = rulesValidation({
      cameras: [{ id: 0, camera_name: 'c' }],
      tasks: [{ task_name: 'sleep', task_description: 'rest', camera_id: [], task_epochs: [1] }],
    });
    expect(codes(issues)).not.toContain('duplicate_task_epoch');
    expect(codes(issues)).not.toContain('orphaned_video');
  });

  it('errors on an orphaned associated_video_file (task_epochs matches no task)', () => {
    const issues = rulesValidation({
      cameras: [{ id: 0, camera_name: 'c' }],
      tasks: [{ task_name: 'a', task_description: 'd', camera_id: [0], task_epochs: [2] }],
      associated_video_files: [{ name: 'v', camera_id: 0, task_epochs: 9 }],
    });
    const orphan = issues.find((i) => i.code === 'orphaned_video');
    expect(orphan).toBeDefined();
    expect(orphan.severity).toBe('error');
  });

  it('accepts a legacy one-item video task_epochs list when it matches a task epoch', () => {
    const issues = rulesValidation({
      cameras: [{ id: 0, camera_name: 'c' }],
      tasks: [{ task_name: 'a', task_description: 'd', camera_id: [0], task_epochs: [2] }],
      associated_video_files: [{ name: 'v', camera_id: 0, task_epochs: [2] }],
    });
    expect(codes(issues)).not.toContain('orphaned_video');
  });

  it('flags only the orphaned entries from a legacy video task_epochs list', () => {
    const issues = rulesValidation({
      cameras: [{ id: 0, camera_name: 'c' }],
      tasks: [{ task_name: 'a', task_description: 'd', camera_id: [0], task_epochs: [2] }],
      associated_video_files: [{ name: 'v', camera_id: 0, task_epochs: [2, 9] }],
    });
    const orphans = issues.filter((i) => i.code === 'orphaned_video');
    expect(orphans).toHaveLength(1);
    expect(orphans[0].message).toContain('9');
  });

  it('errors on an orphaned associated_file (task_epochs matches no task)', () => {
    const issues = rulesValidation({
      tasks: [{ task_name: 'a', task_description: 'd', task_epochs: [2] }],
      associated_files: [{ name: 'f.dat', task_epochs: 9 }],
    });
    const orphan = issues.find((i) => i.code === 'orphaned_file');
    expect(orphan).toBeDefined();
    expect(orphan.severity).toBe('error');
    expect(orphan.message).toContain('9');
  });

  it('accepts a legacy one-item associated_file task_epochs list when it matches a task epoch', () => {
    expect(codes(rulesValidation({
      tasks: [{ task_name: 'a', task_description: 'd', task_epochs: [2] }],
      associated_files: [{ name: 'f.dat', task_epochs: [2] }],
    }))).not.toContain('orphaned_file');
  });

  it('flags only the orphaned entries from a legacy associated_file task_epochs list', () => {
    const issues = rulesValidation({
      tasks: [{ task_name: 'a', task_description: 'd', task_epochs: [2] }],
      associated_files: [{ name: 'f.dat', task_epochs: [2, 9] }],
    });
    const orphans = issues.filter((i) => i.code === 'orphaned_file');
    expect(orphans).toHaveLength(1);
    expect(orphans[0].message).toContain('9');
  });

  it('passes an associated_file with a matching task epoch', () => {
    expect(codes(rulesValidation({
      tasks: [{ task_name: 'a', task_description: 'd', task_epochs: [2] }],
      associated_files: [{ name: 'f.dat', task_epochs: 2 }],
    }))).not.toContain('orphaned_file');
  });

  it('passes a video with a matching task epoch and valid scalar camera_id', () => {
    const issues = rulesValidation({
      cameras: [{ id: 0, camera_name: 'c' }],
      tasks: [{ task_name: 'a', task_description: 'd', camera_id: [0], task_epochs: [2] }],
      associated_video_files: [{ name: 'v', camera_id: 0, task_epochs: 2 }],
    });
    expect(codes(issues)).not.toContain('orphaned_video');
    expect(codes(issues)).not.toContain('dangling_camera_ref');
  });
});

describe('workspace/dataset identity consistency', () => {
  it('errors on reused camera_name with divergent calibration/id', () => {
    const issues = rulesValidation({
      cameras: [
        { id: 0, camera_name: 'overhead', meters_per_pixel: 0.001, lens: 'A', model: 'M', manufacturer: 'X' },
        { id: 1, camera_name: 'overhead', meters_per_pixel: 0.002, lens: 'A', model: 'M', manufacturer: 'X' },
      ],
    });
    const div = issues.find((i) => i.code === 'divergent_camera_identity');
    expect(div).toBeDefined();
    expect(div.severity).toBe('error');
  });

  it('passes reused camera_name with identical dependent fields', () => {
    expect(codes(rulesValidation({
      cameras: [
        { id: 0, camera_name: 'overhead', meters_per_pixel: 0.001, lens: 'A', model: 'M', manufacturer: 'X' },
        { id: 0, camera_name: 'overhead', meters_per_pixel: 0.001, lens: 'A', model: 'M', manufacturer: 'X' },
      ],
    }))).not.toContain('divergent_camera_identity');
  });

  it('errors when meters_per_pixel is missing, blank, zero, or negative', () => {
    const issues = rulesValidation({
      cameras: [
        { id: 0, camera_name: 'missing', lens: 'A', model: 'M', manufacturer: 'X' },
        { id: 1, camera_name: 'blank', meters_per_pixel: '', lens: 'A', model: 'M', manufacturer: 'X' },
        { id: 2, camera_name: 'zero', meters_per_pixel: 0, lens: 'A', model: 'M', manufacturer: 'X' },
        { id: 3, camera_name: 'negative', meters_per_pixel: -0.001, lens: 'A', model: 'M', manufacturer: 'X' },
      ],
    });

    expect(codes(issues).filter((code) => code === 'camera_meters_per_pixel_missing')).toHaveLength(2);
    expect(codes(issues).filter((code) => code === 'camera_meters_per_pixel_nonpositive')).toHaveLength(2);
    expect(
      issues.filter((issue) =>
        issue.code === 'camera_meters_per_pixel_missing' ||
        issue.code === 'camera_meters_per_pixel_nonpositive'
      ).every((issue) => issue.severity === 'error' && issue.repairSurface === 'animal')
    ).toBe(true);
  });

  it('warns on implausible positive meters_per_pixel without blocking export', () => {
    const issues = rulesValidation({
      cameras: [
        { id: 0, camera_name: 'tiny', meters_per_pixel: 0.0001, lens: 'A', model: 'M', manufacturer: 'X' },
        { id: 1, camera_name: 'huge', meters_per_pixel: 5, lens: 'A', model: 'M', manufacturer: 'X' },
        { id: 2, camera_name: 'typical', meters_per_pixel: 0.002, lens: 'A', model: 'M', manufacturer: 'X' },
      ],
    });
    const warnings = issues.filter((issue) => issue.code === 'camera_meters_per_pixel_implausible');

    expect(warnings).toHaveLength(2);
    expect(warnings.every((issue) => issue.severity === 'warning')).toBe(true);
    expect(codes(issues.filter((issue) => issue.path === 'cameras[2].meters_per_pixel'))).not.toContain(
      'camera_meters_per_pixel_implausible'
    );
  });

  it('errors on placeholder camera names', () => {
    const issues = rulesValidation({
      cameras: [
        { id: 0, camera_name: '1', meters_per_pixel: 0.001, lens: 'A', model: 'M', manufacturer: 'X' },
        { id: 1, camera_name: 'camera', meters_per_pixel: 0.001, lens: 'A', model: 'M', manufacturer: 'X' },
        { id: 2, camera_name: 'XXX', meters_per_pixel: 0.001, lens: 'A', model: 'M', manufacturer: 'X' },
        { id: 3, camera_name: '', meters_per_pixel: 0.001, lens: 'A', model: 'M', manufacturer: 'X' },
        { id: 4, camera_name: 'maze_camera', meters_per_pixel: 0.001, lens: 'A', model: 'M', manufacturer: 'X' },
      ],
    });
    const placeholders = issues.filter((issue) => issue.code === 'placeholder_camera_name');

    expect(placeholders).toHaveLength(4);
    expect(placeholders.every((issue) => issue.severity === 'error')).toBe(true);
    expect(codes(issues.filter((issue) => issue.path === 'cameras[4].camera_name'))).not.toContain(
      'placeholder_camera_name'
    );
  });

  it('errors on reused data_acq_device name with divergent technical fields', () => {
    const issues = rulesValidation({
      data_acq_device: [
        { name: 'acq', system: 'S1', amplifier: 'A', adc_circuit: 'C' },
        { name: 'acq', system: 'S2', amplifier: 'A', adc_circuit: 'C' },
      ],
    });
    const div = issues.find((i) => i.code === 'divergent_data_acq_identity');
    expect(div).toBeDefined();
    expect(div.severity).toBe('error');
  });

  it('passes reused data_acq_device name with identical technical fields', () => {
    expect(codes(rulesValidation({
      data_acq_device: [
        { name: 'acq', system: 'S1', amplifier: 'A', adc_circuit: 'C' },
        { name: 'acq', system: 'S1', amplifier: 'A', adc_circuit: 'C' },
      ],
    }))).not.toContain('divergent_data_acq_identity');
  });

  it('errors on reused task_name with divergent task_description', () => {
    const issues = rulesValidation({
      cameras: [{ id: 0, camera_name: 'c' }],
      tasks: [
        { task_name: 'sleep', task_description: 'pre', camera_id: [0], task_epochs: [1] },
        { task_name: 'sleep', task_description: 'post', camera_id: [0], task_epochs: [2] },
      ],
    });
    const div = issues.find((i) => i.code === 'divergent_task_identity');
    expect(div).toBeDefined();
    expect(div.severity).toBe('error');
  });

  it('passes reused task_name with the same task_description', () => {
    expect(codes(rulesValidation({
      cameras: [{ id: 0, camera_name: 'c' }],
      tasks: [
        { task_name: 'sleep', task_description: 'rest', camera_id: [0], task_epochs: [1] },
        { task_name: 'sleep', task_description: 'rest', camera_id: [0], task_epochs: [2] },
      ],
    }))).not.toContain('divergent_task_identity');
  });
});

describe('repair metadata on new error rules', () => {
  // A single model that trips every new error-severity rule at once, so we can
  // assert each emitted issue carries the repair metadata the Export/Validation
  // UI needs: step, an actionable path/field, and a short actionLabel.
  const VALID_STEPS = ['overview', 'devices', 'epochs', 'behavioral', 'validation'];
  const NEW_CODES = [
    'dangling_camera_ref',
    'dangling_electrode_group_ref',
    'channel_value_out_of_range',
    'channel_key_out_of_range',
    'bad_channel_out_of_range',
    'channel_partition_invalid',
    'channel_row_count_mismatch',
    'empty_location',
    'empty_targeted_location',
    'unknown_device_type',
    'duplicate_behavioral_event_name',
    'duplicate_task_epoch',
    'orphaned_video',
    'camera_meters_per_pixel_missing',
    'camera_meters_per_pixel_nonpositive',
    'placeholder_camera_name',
    'divergent_camera_identity',
    'divergent_data_acq_identity',
    'divergent_task_identity',
  ];

  const brokenModel = () => ({
    cameras: [
      { id: 0, camera_name: 'overhead', meters_per_pixel: 0.001, lens: 'A', model: 'M', manufacturer: 'X' },
      { id: 0, camera_name: 'overhead', meters_per_pixel: 0.002, lens: 'A', model: 'M', manufacturer: 'X' },
      { id: 2, camera_name: 'XXX', meters_per_pixel: 0, lens: 'A', model: 'M', manufacturer: 'X' },
      { id: 3, camera_name: 'arena_side', lens: 'A', model: 'M', manufacturer: 'X' },
    ],
    data_acq_device: [
      { name: 'acq', system: 'S1', amplifier: 'A', adc_circuit: 'C' },
      { name: 'acq', system: 'S2', amplifier: 'A', adc_circuit: 'C' },
    ],
    electrode_groups: [
      { id: 0, device_type: 'made_up_probe', location: '', targeted_location: '' },
      { id: 1, device_type: 'tetrode_12.5', location: 'CA1', targeted_location: 'CA1' },
      { id: 2, device_type: '128c-4s8mm6cm-20um-40um-sl', location: 'CA3', targeted_location: 'CA3' },
      { id: 3, device_type: 'tetrode_12.5', location: 'PFC', targeted_location: 'PFC' },
    ],
    ntrode_electrode_group_channel_map: [
      // group 1: out-of-range value (7), bad_channel (99), wrong key set (missing 1)
      { ntrode_id: 1, electrode_group_id: 1, bad_channels: [99], map: { 0: 7, 2: 2, 3: 3 } },
      // group 2 (4-shank, correct row count 4): shanks 0 and 0 collide (missing
      // offset) and shank 1 is absent → coverage collision → channel_partition_invalid
      shankNtrode(2, 2, '128c-4s8mm6cm-20um-40um-sl', 0),
      shankNtrode(3, 2, '128c-4s8mm6cm-20um-40um-sl', 0),
      shankNtrode(8, 2, '128c-4s8mm6cm-20um-40um-sl', 2),
      shankNtrode(9, 2, '128c-4s8mm6cm-20um-40um-sl', 3),
      // group 3 (tetrode, 1 shank) with an extra row → row-count mismatch
      { ntrode_id: 5, electrode_group_id: 3, bad_channels: [], map: { 0: 0, 1: 1, 2: 2, 3: 3 } },
      { ntrode_id: 6, electrode_group_id: 3, bad_channels: [], map: {} },
      // dangling electrode_group_id
      { ntrode_id: 4, electrode_group_id: 42, bad_channels: [], map: { 0: 0, 1: 1, 2: 2, 3: 3 } },
    ],
    behavioral_events: [
      { name: 'reward', description: 'a' },
      { name: 'reward', description: 'b' },
    ],
    tasks: [
      { task_name: 'sleep', task_description: 'pre', camera_id: [99], task_epochs: [1] },
      { task_name: 'sleep', task_description: 'post', camera_id: [0], task_epochs: [1] },
    ],
    associated_video_files: [{ name: 'v', camera_id: 0, task_epochs: 77 }],
  });

  it('every new error-severity rule emits step, a path/field target, and an actionLabel', () => {
    const issues = rulesValidation(brokenModel());
    const newIssues = issues.filter((i) => NEW_CODES.includes(i.code));
    expect(newIssues.length).toBeGreaterThan(0);
    newIssues.forEach((issue) => {
      expect(VALID_STEPS, `${issue.code} step`).toContain(issue.step);
      expect(typeof issue.actionLabel, `${issue.code} actionLabel`).toBe('string');
      expect(issue.actionLabel.length, `${issue.code} actionLabel`).toBeGreaterThan(0);
      expect(typeof (issue.path || issue.field), `${issue.code} path/field`).toBe('string');
    });
  });

  it('triggers all new error codes (each rule reachable)', () => {
    const present = new Set(rulesValidation(brokenModel()).map((i) => i.code));
    NEW_CODES.forEach((code) => {
      expect(present.has(code), `expected code ${code} to fire`).toBe(true);
    });
  });
});

describe('channel bounds skipped for unknown device', () => {
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
