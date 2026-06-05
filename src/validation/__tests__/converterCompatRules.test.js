/**
 * Converter-compatibility validation rules (verified against trodes_to_nwb).
 *
 * - Duplicate behavioral_events[].description → hard ValueError in convert_dios
 *   (DIO channels are keyed by description, raising on duplicates).
 * - Duplicate cameras[].id → the converter names NWB devices `camera_device {id}`
 *   and videos dereference that exact name, so duplicate ids collide.
 * - Multi-shank bad_channels: the converter uses ONLY the first ntrode row for an
 *   electrode group's bad_channels (convert_yaml.add_electrode_groups), so marks on
 *   later rows of a multi-row group are silently ignored.
 * - Malformed shapes must not throw: validation is fail-closed, returning issues.
 *
 * TDD: tests written FIRST.
 */
import { describe, it, expect } from 'vitest';
import { rulesValidation } from '../rulesValidation';

const codes = (issues) => issues.map((i) => i.code);

describe('duplicate DIO description', () => {
  it('errors when two behavioral_events share a description', () => {
    const issues = rulesValidation({
      behavioral_events: [
        { name: 'reward_left', description: 'Din1' },
        { name: 'reward_right', description: 'Din1' },
      ],
    });
    const dup = issues.find((i) => i.code === 'duplicate_behavioral_event_description');
    expect(dup).toBeDefined();
    expect(dup.severity).toBe('error');
    expect(dup.message).toContain('Din1');
  });

  it('passes when descriptions are unique even if names repeat differently', () => {
    expect(codes(rulesValidation({
      behavioral_events: [
        { name: 'reward_left', description: 'Din1' },
        { name: 'reward_right', description: 'Din2' },
      ],
    }))).not.toContain('duplicate_behavioral_event_description');
  });
});

describe('duplicate camera id', () => {
  it('errors when two cameras share an id', () => {
    const issues = rulesValidation({
      cameras: [
        { id: 0, camera_name: 'overhead' },
        { id: 0, camera_name: 'side' },
      ],
    });
    const dup = issues.find((i) => i.code === 'duplicate_camera_id');
    expect(dup).toBeDefined();
    expect(dup.severity).toBe('error');
  });

  it('passes when camera ids are unique', () => {
    expect(codes(rulesValidation({
      cameras: [
        { id: 0, camera_name: 'overhead' },
        { id: 1, camera_name: 'side' },
      ],
    }))).not.toContain('duplicate_camera_id');
  });
});

describe('multi-shank bad_channels first-row semantics', () => {
  const fourShankGroup = (id) => ({
    id,
    device_type: '128c-4s8mm6cm-20um-40um-sl',
    location: 'CA1',
    targeted_location: 'CA1',
  });

  it('errors when a non-first ntrode row of a multi-row group has bad_channels', () => {
    const issues = rulesValidation({
      electrode_groups: [fourShankGroup(0)],
      ntrode_electrode_group_channel_map: [
        { ntrode_id: 1, electrode_group_id: 0, bad_channels: [], map: {} },
        { ntrode_id: 2, electrode_group_id: 0, bad_channels: [3], map: {} }, // ignored downstream
      ],
    });
    const issue = issues.find((i) => i.code === 'multishank_bad_channels_ignored');
    expect(issue).toBeDefined();
    expect(issue.severity).toBe('error');
  });

  it('passes when bad_channels live only on the group first ntrode row', () => {
    expect(codes(rulesValidation({
      electrode_groups: [fourShankGroup(0)],
      ntrode_electrode_group_channel_map: [
        { ntrode_id: 1, electrode_group_id: 0, bad_channels: [5], map: {} },
        { ntrode_id: 2, electrode_group_id: 0, bad_channels: [], map: {} },
      ],
    }))).not.toContain('multishank_bad_channels_ignored');
  });

  it('does not flag a single-row (single-shank) group with bad_channels', () => {
    expect(codes(rulesValidation({
      electrode_groups: [{ id: 0, device_type: 'tetrode_12.5', location: 'CA1', targeted_location: 'CA1' }],
      ntrode_electrode_group_channel_map: [
        { ntrode_id: 1, electrode_group_id: 0, bad_channels: [2], map: { 0: 0, 1: 1, 2: 2, 3: 3 } },
      ],
    }))).not.toContain('multishank_bad_channels_ignored');
  });
});

describe('fail-closed on malformed shapes', () => {
  it('does not throw and returns an array for grossly malformed input', () => {
    const malformed = {
      cameras: 'not-an-array',
      tasks: 5,
      associated_video_files: { not: 'array' },
      electrode_groups: { also: 'not array' },
      ntrode_electrode_group_channel_map: 'nope',
      behavioral_events: 42,
      data_acq_device: 'string',
      subject: 'string',
    };
    let result;
    expect(() => {
      result = rulesValidation(malformed);
    }).not.toThrow();
    expect(Array.isArray(result)).toBe(true);
  });

  it('does not throw when one array field is valid but a sibling is a non-array (cross-array guard)', () => {
    // The camera-ref rule guards `cameras` but iterates `tasks`; the channel rules
    // read `electrode_groups`, etc. A malformed sibling (truthy non-array) must not
    // crash the iteration after AJV has already flagged the schema error.
    expect(() => rulesValidation({ cameras: [{ id: 0, camera_name: 'c' }], tasks: 'not-an-array' })).not.toThrow();
    expect(() => rulesValidation({ cameras: [{ id: 0, camera_name: 'c' }], associated_video_files: 'nope' })).not.toThrow();
    expect(() => rulesValidation({ ntrode_electrode_group_channel_map: [{ ntrode_id: 1, electrode_group_id: 0, map: {} }], electrode_groups: 'bad' })).not.toThrow();
    expect(() => rulesValidation({ associated_files: [{ name: 'f', task_epochs: 1 }], tasks: 5 })).not.toThrow();
  });

  it('handles null/array entries inside arrays without throwing', () => {
    const model = {
      cameras: [null, { id: 0, camera_name: 'c' }],
      tasks: [null, { task_name: 'a', task_description: 'd', camera_id: [0], task_epochs: [1] }],
      electrode_groups: [null],
      behavioral_events: [null, { name: 'x', description: 'y' }],
    };
    expect(() => rulesValidation(model)).not.toThrow();
  });
});
