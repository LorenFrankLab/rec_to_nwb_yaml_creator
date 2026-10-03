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
import { validate } from '../index';

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

// trodes_to_nwb adds the excitation source and every optical fiber to the NWB file as devices
// named after them, and keys the virus injections by name: a repeated name raises a ValueError.
describe('optogenetics device names', () => {
  const opto = (overrides) => ({
    opto_excitation_source: [{ name: 'Laser' }],
    optical_fiber: [{ name: 'Fiber 1', reference: 'Bregma' }, { name: 'Fiber 2', reference: 'Bregma' }],
    virus_injection: [{ name: 'Injection 1', reference: 'Bregma' }],
    optogenetic_stimulation_software: 'fsgui',
    ...overrides,
  });
  const nameIssues = (model) =>
    rulesValidation(model).filter((i) => i.code === 'duplicate_opto_device_name');

  it('errors when two optical fibers share a name', () => {
    const issues = nameIssues(opto({
      optical_fiber: [{ name: 'Fiber 1', reference: 'Bregma' }, { name: 'Fiber 1', reference: 'Bregma' }],
    }));
    expect(issues).toEqual([expect.objectContaining({
      path: 'optical_fiber',
      severity: 'error',
      repairSurface: 'animal',
      message: expect.stringContaining('"Fiber 1"'),
    })]);
  });

  it('errors when two virus injections share a name', () => {
    const issues = nameIssues(opto({
      virus_injection: [
        { name: 'Injection 1', reference: 'Bregma' },
        { name: 'Injection 1', reference: 'Bregma' },
      ],
    }));
    expect(issues).toEqual([expect.objectContaining({
      path: 'virus_injection',
      severity: 'error',
      message: expect.stringContaining('"Injection 1"'),
    })]);
  });

  it('errors when a fiber has the excitation source name (one device namespace)', () => {
    const issues = nameIssues(opto({
      optical_fiber: [{ name: 'Fiber 1', reference: 'Bregma' }, { name: 'Laser', reference: 'Bregma' }],
    }));
    expect(issues).toEqual([expect.objectContaining({
      path: 'optical_fiber[1].name',
      severity: 'error',
      message: expect.stringContaining('"Laser"'),
    })]);
  });

  it('passes distinct names, compares them exactly, and leaves blank names to the schema', () => {
    expect(nameIssues(opto())).toEqual([]);
    // "Fiber 1" and "Fiber 1 " are different NWB names; the converter does not trim.
    expect(nameIssues(opto({
      optical_fiber: [{ name: 'Fiber 1', reference: 'Bregma' }, { name: 'Fiber 1 ', reference: 'Bregma' }],
    }))).toEqual([]);
    // The schema requires a non-blank name; blank ones are reported there, not as duplicates.
    expect(nameIssues(opto({
      optical_fiber: [{ name: '', reference: 'Bregma' }, { name: '', reference: 'Bregma' }],
    }))).toEqual([]);
  });

  it('is a schema error, not a duplicate, for blank names in the full validation', () => {
    const issues = validate(opto({
      optical_fiber: [{ name: '', reference: 'Bregma' }, { name: '', reference: 'Bregma' }],
    }));
    expect(issues).toContainEqual(expect.objectContaining({ path: 'optical_fiber[0].name', code: 'pattern' }));
  });
});

// The current trodes_to_nwb release always adds the video files and fails (UnboundLocalError) on
// an empty list, even for a session without video. A converter bug, so a warning.
describe('empty video list', () => {
  it('warns when no video files are listed', () => {
    expect(rulesValidation({ associated_video_files: [] })).toEqual([
      expect.objectContaining({
        path: 'associated_video_files',
        code: 'no_associated_videos',
        severity: 'warning',
        repairSurface: 'day',
      }),
    ]);
  });

  it('does not warn when a video is listed, or when the list is not there to check', () => {
    expect(codes(rulesValidation({
      associated_video_files: [{ name: 'a.h264', camera_id: 0, task_epochs: 1 }],
    }))).not.toContain('no_associated_videos');
    expect(codes(rulesValidation({}))).not.toContain('no_associated_videos');
  });
});

// trodes_to_nwb links every optical fiber to the first virus injection, and records each virus once
// with the titer of its first injection: the file converts, but the NWB file misstates the setup.
describe('several virus injections', () => {
  const injection = (name, virus, titer) => ({
    name, virus_name: virus, titer_in_vg_per_ml: titer, reference: 'Bregma', hemisphere: 'left',
  });
  const opto = (injections) => ({
    opto_excitation_source: [{ name: 'Laser' }],
    optical_fiber: [{ name: 'Fiber 1', reference: 'Bregma' }],
    virus_injection: injections,
    optogenetic_stimulation_software: 'fsgui',
  });

  it('does not warn for a single injection', () => {
    expect(rulesValidation(opto([injection('Injection 1', 'AAV-ChR2', 1e12)]))).toEqual([]);
  });

  it('warns that every fiber will be linked to the first injection', () => {
    const issues = rulesValidation(opto([
      injection('Left CA1', 'AAV-ChR2', 1e12),
      injection('Right CA1', 'AAV-ChR2', 1e12),
    ]));
    expect(issues).toEqual([expect.objectContaining({
      path: 'virus_injection',
      code: 'multiple_virus_injections',
      severity: 'warning',
      repairSurface: 'animal',
      message: expect.stringContaining('"Left CA1"'),
    })]);
  });

  it('also warns when the same virus has different titers (only the first is kept)', () => {
    const issues = rulesValidation(opto([
      injection('Left CA1', 'AAV-ChR2', 1e12),
      injection('Right CA1', 'AAV-ChR2', 5e12),
      injection('PFC', 'AAV-ArchT', 2e12),
    ]));
    expect(issues.map((i) => i.code)).toEqual(['multiple_virus_injections', 'conflicting_virus_titers']);
    expect(issues[1]).toMatchObject({ path: 'virus_injection', severity: 'warning' });
    expect(issues[1].message).toContain('"AAV-ChR2"');
    expect(issues[1].message).toContain('1000000000000');
    expect(issues[1].message).toContain('5000000000000');
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
