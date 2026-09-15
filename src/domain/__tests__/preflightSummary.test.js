/**
 * Unit tests for buildPreflightSummary.
 *
 * The preflight summary is the user's confidence checkpoint at the point of download. These tests
 * pin the human-facing row VALUES (camera calibration identity, singular/plural grammar) so a
 * recalibrated camera or a one-of-something day can't render misleadingly.
 */
import { describe, it, expect } from 'vitest';
import { buildPreflightSummary } from '../preflightSummary';

/**
 *
 * @param rows
 * @param label
 */
function rowValue(rows, label) {
  return rows.find((r) => r.label === label)?.value;
}

describe('buildPreflightSummary — row order', () => {
  it('orders rows to match the scientist export-readiness scan (config version near the top, subject near the end)', () => {
    const rows = buildPreflightSummary({}, {});
    expect(rows.map((r) => r.label)).toEqual([
      'Animal & day',
      'Weight & team',
      'Configuration version',
      'Probes & failed channels',
      'Cameras / calibration',
      'Data acquisition',
      'Tasks & videos',
      'Optogenetics',
      'Subject & session',
      'Non-blocking warnings',
    ]);
  });
});

describe('buildPreflightSummary — weight & team row', () => {
  it('shows the weight the day recorded, in grams, beside the experimenters who ran it', () => {
    const merged = {
      subject: { subject_id: 'remy', weight: 485 },
      experimenter_name: ['Guidera, Jennifer', 'Comrie, Alison'],
    };
    const value = rowValue(buildPreflightSummary(merged, {}), 'Weight & team');
    // Separated with '; ' — a "Last, First" name already contains a comma, so ', ' would read as four people.
    expect(value).toBe('485 g — Guidera, Jennifer; Comrie, Alison');
  });

  it('says "not recorded" rather than inventing a weight when the day measured none', () => {
    const merged = { subject: { subject_id: 'remy' }, experimenter_name: ['Comrie, Alison'] };
    const value = rowValue(buildPreflightSummary(merged, {}), 'Weight & team');
    expect(value).toBe('not recorded — Comrie, Alison');
  });

  it('says the team is not recorded instead of rendering a blank or a bare dash', () => {
    const value = rowValue(buildPreflightSummary({ subject: { weight: 500 } }, {}), 'Weight & team');
    expect(value).toBe('500 g — team not recorded');
  });
});

describe('buildPreflightSummary — tasks & videos row', () => {
  it('names each task with its epochs and the room it ran in', () => {
    const merged = {
      tasks: [
        { task_name: 'sleep', task_environment: 'home cage', task_epochs: [1, 3] },
        { task_name: 'w_alternation', task_environment: 'elevated W-track', task_epochs: [2] },
      ],
      associated_video_files: [{ name: 'a.h264' }, { name: 'b.h264' }],
    };
    const value = rowValue(buildPreflightSummary(merged, {}), 'Tasks & videos');
    expect(value).toBe('sleep (1, 3) — home cage; w_alternation (2) — elevated W-track · 2 videos');
  });

  it('says a task environment is not recorded instead of leaving the room blank', () => {
    const merged = { tasks: [{ task_name: 'sleep', task_epochs: [1] }] };
    const value = rowValue(buildPreflightSummary(merged, {}), 'Tasks & videos');
    expect(value).toBe('sleep (1) — environment not recorded · 0 videos');
  });

  it('falls back to counts when there are too many tasks to read inline', () => {
    const tasks = Array.from({ length: 7 }, (_, i) => ({
      task_name: `task${i}`,
      task_environment: 'room',
      task_epochs: [i],
    }));
    const value = rowValue(buildPreflightSummary({ tasks }, {}), 'Tasks & videos');
    expect(value).toBe('7 tasks, 0 videos');
  });

  it('falls back to counts when the day has no tasks at all', () => {
    const value = rowValue(buildPreflightSummary({ associated_video_files: [{}, {}] }, {}), 'Tasks & videos');
    expect(value).toBe('0 tasks, 2 videos');
  });
});

describe('buildPreflightSummary — camera calibration row', () => {
  it('renders each day-used camera name with its meters_per_pixel', () => {
    const merged = {
      cameras: [
        { id: 0, camera_name: 'overhead_camera', meters_per_pixel: 0.00085 },
        { id: 1, camera_name: 'side_camera', meters_per_pixel: 0.0009 },
      ],
    };
    const value = rowValue(buildPreflightSummary(merged, {}), 'Cameras / calibration');
    expect(value).toContain('overhead_camera');
    expect(value).toContain('0.00085 m/px');
    expect(value).toContain('side_camera');
    expect(value).toContain('0.0009 m/px');
  });

  it('falls back to a count when there are no cameras', () => {
    const value = rowValue(buildPreflightSummary({ cameras: [] }, {}), 'Cameras / calibration');
    expect(value).toBe('0 cameras');
  });

  it('truncates gracefully when there are many cameras', () => {
    const cameras = Array.from({ length: 6 }, (_, i) => ({
      id: i,
      camera_name: `cam${i}`,
      meters_per_pixel: 0.001 * (i + 1),
    }));
    const value = rowValue(buildPreflightSummary({ cameras }, {}), 'Cameras / calibration');
    expect(value).toContain('cam0');
    expect(value).toMatch(/\+\d+ more/);
    // Does not dump every camera inline.
    expect(value).not.toContain('cam5');
  });

  it('handles a camera missing a name/calibration without crashing', () => {
    const merged = { cameras: [{ id: 0 }] };
    const value = rowValue(buildPreflightSummary(merged, {}), 'Cameras / calibration');
    expect(typeof value).toBe('string');
    expect(value.length).toBeGreaterThan(0);
  });
});

describe('buildPreflightSummary — probes/failed-channels grammar', () => {
  it('uses singular nouns for exactly one group and one failed channel', () => {
    const merged = {
      electrode_groups: [{ id: 0 }],
      ntrode_electrode_group_channel_map: [{ bad_channels: [2] }],
    };
    const value = rowValue(buildPreflightSummary(merged, {}), 'Probes & failed channels');
    expect(value).toBe('1 electrode group, 1 failed channel');
  });

  it('uses plural nouns for multiple groups and channels', () => {
    const merged = {
      electrode_groups: [{ id: 0 }, { id: 1 }],
      ntrode_electrode_group_channel_map: [{ bad_channels: [1, 2] }],
    };
    const value = rowValue(buildPreflightSummary(merged, {}), 'Probes & failed channels');
    expect(value).toBe('2 electrode groups, 2 failed channels');
  });

  it('uses plural for zero (no groups, no failed channels)', () => {
    const value = rowValue(buildPreflightSummary({}, {}), 'Probes & failed channels');
    expect(value).toBe('0 electrode groups, 0 failed channels');
  });
});
