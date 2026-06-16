/**
 * Tests for buildEpochGrid — the pure join-view over a day's tasks + files + videos + fs_gui.
 *
 * The grid is a PRESENTATION join: one row per distinct epoch, joining the day's existing arrays. It
 * must NOT reshape the stored arrays (byte-identity is downstream of the merge, but the grid is the
 * editing surface over the SAME arrays), must read `task_epoch(s)` tolerantly (Number-normalized,
 * never rewriting the stored key spelling), and must handle both the catalog (`taskInstances`) and
 * legacy inline (`tasks`) day shapes identically.
 */
import { describe, it, expect } from 'vitest';
import { buildEpochGrid } from '../epochGridViewModel';
import { migrateTasksToCatalogV2ToV3 } from '../../state/taskCatalogMigration';

/** The golden-shaped tasks/files/videos/fs_gui as a legacy INLINE workspace day + opto animal. */
function goldenInlineWorkspace() {
  const animal = {
    id: 'sample',
    subject: { subject_id: '54321' },
    optogenetics: { opto_excitation_source: [{ name: 'laser' }] },
  };
  const day = {
    id: 'sample-2023-06-22',
    animalId: 'sample',
    date: '2023-06-22',
    experimentDate: '06222023',
    tasks: [
      { task_name: 'Sleep', task_description: 'sleeping', task_environment: 'sleep box', camera_id: [0], task_epochs: [1, 3, 5] },
      { task_name: 'wtrack', task_description: 'reward finding', task_environment: 'wtrack arena', camera_id: [1], task_epochs: [2, 4] },
    ],
    associated_files: [
      { name: 'associated1.txt', description: 'good file', path: 'path/', task_epochs: 1 },
      { name: 'associated2.txt', description: 'good file', path: 'path/', task_epochs: 2 },
    ],
    associated_video_files: [
      { name: '20230622_sample_01_a1.1.h264', camera_id: 0, task_epochs: 1 },
      { name: '20230622_sample_02_a1.1.h264', camera_id: 0, task_epochs: 2 },
    ],
    fs_gui_yamls: [
      { name: 'fsgui_theta_trigger.yaml', epochs: [1], power_in_mW: 77, dio_output_name: 'Light_1', camera_id: 0 },
      { name: 'fsgui_ripple_trigger.yaml', epochs: [2], power_in_mW: 77, dio_output_name: 'Light_1', camera_id: 0 },
    ],
    state: { draft: true, validated: false, exported: false },
  };
  return { animal, day };
}

describe('buildEpochGrid — join shape', () => {
  it('builds one row per distinct epoch, ascending', () => {
    const { animal, day } = goldenInlineWorkspace();
    const grid = buildEpochGrid(animal, day);
    expect(grid.rows.map((r) => r.epoch)).toEqual([1, 2, 3, 4, 5]);
  });

  it('attributes each epoch to the task whose task_epochs contains it', () => {
    const { animal, day } = goldenInlineWorkspace();
    const grid = buildEpochGrid(animal, day);
    const byEpoch = Object.fromEntries(grid.rows.map((r) => [r.epoch, r.taskName]));
    expect(byEpoch).toEqual({ 1: 'Sleep', 2: 'wtrack', 3: 'Sleep', 4: 'wtrack', 5: 'Sleep' });
  });

  it('derives a per-occurrence tag (short code + 1-based occurrence within the task)', () => {
    const { animal, day } = goldenInlineWorkspace();
    const grid = buildEpochGrid(animal, day);
    const byEpoch = Object.fromEntries(grid.rows.map((r) => [r.epoch, r.tag]));
    // Sleep owns 1,3,5 → s1,s2,s3; wtrack owns 2,4 → w1,w2.
    expect(byEpoch).toEqual({ 1: 's1', 2: 'w1', 3: 's2', 4: 'w2', 5: 's3' });
  });

  it('carries the task cameras onto each row', () => {
    const { animal, day } = goldenInlineWorkspace();
    const grid = buildEpochGrid(animal, day);
    expect(grid.rows.find((r) => r.epoch === 1)?.cameras).toEqual([0]);
    expect(grid.rows.find((r) => r.epoch === 2)?.cameras).toEqual([1]);
  });
});

describe('buildEpochGrid — file/video/opto join (no reshaping)', () => {
  it('joins the matching statescript file by scalar task_epochs, by reference', () => {
    const { animal, day } = goldenInlineWorkspace();
    const grid = buildEpochGrid(animal, day);
    const e1 = grid.rows.find((r) => r.epoch === 1)!;
    // The SAME stored object — never reshaped (round-trip safety).
    expect(e1.statescript?.entry).toBe(day.associated_files[0]);
    expect(e1.statescript?.index).toBe(0);
    expect(grid.rows.find((r) => r.epoch === 3)?.statescript).toBeNull();
  });

  it('joins all videos for an epoch by reference', () => {
    const { animal, day } = goldenInlineWorkspace();
    const grid = buildEpochGrid(animal, day);
    const e1 = grid.rows.find((r) => r.epoch === 1)!;
    expect(e1.videos.map((v) => v.entry)).toEqual([day.associated_video_files[0]]);
    expect(e1.videos[0].index).toBe(0);
    expect(grid.rows.find((r) => r.epoch === 4)?.videos).toEqual([]);
  });

  it('joins the matching fs_gui row by its `epochs` array', () => {
    const { animal, day } = goldenInlineWorkspace();
    const grid = buildEpochGrid(animal, day);
    expect(grid.rows.find((r) => r.epoch === 1)?.opto?.entry).toBe(day.fs_gui_yamls[0]);
    expect(grid.rows.find((r) => r.epoch === 2)?.opto?.entry).toBe(day.fs_gui_yamls[1]);
    expect(grid.rows.find((r) => r.epoch === 3)?.opto).toBeNull();
  });

  it('does not mutate or reshape the day arrays', () => {
    const { animal, day } = goldenInlineWorkspace();
    const before = structuredClone(day);
    buildEpochGrid(animal, day);
    expect(day).toEqual(before);
  });
});

describe('buildEpochGrid — collapsed cell states', () => {
  it('classifies golden videos as present and missing ones by absence of a bound video', () => {
    const { animal, day } = goldenInlineWorkspace();
    const grid = buildEpochGrid(animal, day);
    const presence = Object.fromEntries(grid.rows.map((r) => [r.epoch, r.videoPresence]));
    expect(presence).toEqual({ 1: 'present', 2: 'present', 3: 'missing', 4: 'missing', 5: 'missing' });
  });

  it('treats a declared-videoless epoch as absent (not missing)', () => {
    const { animal, day } = goldenInlineWorkspace();
    day.state.videolessEpochs = [3, 5];
    const grid = buildEpochGrid(animal, day);
    const presence = Object.fromEntries(grid.rows.map((r) => [r.epoch, r.videoPresence]));
    expect(presence[3]).toBe('absent');
    expect(presence[5]).toBe('absent');
    expect(presence[4]).toBe('missing');
  });

  it('row status: needs_video for missing, complete for present/absent', () => {
    const { animal, day } = goldenInlineWorkspace();
    day.state.videolessEpochs = [3];
    const grid = buildEpochGrid(animal, day);
    const status = Object.fromEntries(grid.rows.map((r) => [r.epoch, r.status]));
    expect(status[1]).toBe('complete'); // present
    expect(status[3]).toBe('complete'); // absent (declared)
    expect(status[4]).toBe('needs_video'); // missing
  });

  it('statescript naming: manual when stored path is not derived (golden has no dataFolder), none when no file', () => {
    const { animal, day } = goldenInlineWorkspace();
    const grid = buildEpochGrid(animal, day);
    const naming = Object.fromEntries(grid.rows.map((r) => [r.epoch, r.statescriptNaming]));
    expect(naming[1]).toBe('manual');
    expect(naming[3]).toBe('none');
  });

  it('statescript naming: generated when the stored path matches the derived value', () => {
    const { animal, day } = goldenInlineWorkspace();
    day.dataFolder = '/data/sample/20230622';
    // Point epoch-1's statescript at the convention-following derived path (subject 54321, tag s1).
    day.associated_files[0].path = '/data/sample/20230622/20230622_54321_01_s1.stateScriptLog';
    const grid = buildEpochGrid(animal, day);
    expect(grid.rows.find((r) => r.epoch === 1)?.statescriptNaming).toBe('generated');
  });
});

describe('buildEpochGrid — tolerant epoch reads', () => {
  it('matches a string task_epochs ("1") to numeric epoch 1 without rewriting it', () => {
    const { animal, day } = goldenInlineWorkspace();
    day.associated_video_files[0].task_epochs = '1';
    const grid = buildEpochGrid(animal, day);
    const e1 = grid.rows.find((r) => r.epoch === 1)!;
    expect(e1.videos.map((v) => v.entry)).toEqual([day.associated_video_files[0]]);
    // The stored key spelling is preserved (still the string '1').
    expect(day.associated_video_files[0].task_epochs).toBe('1');
  });

  it('flags duplicate epochs claimed by more than one task', () => {
    const { animal, day } = goldenInlineWorkspace();
    day.tasks[1].task_epochs = [1, 4]; // wtrack now also claims epoch 1 (Sleep already owns it)
    const grid = buildEpochGrid(animal, day);
    expect(grid.duplicateEpochs).toContain(1);
    expect(grid.rows.find((r) => r.epoch === 1)?.duplicate).toBe(true);
    expect(grid.rows.find((r) => r.epoch === 4)?.duplicate).toBe(false);
  });
});

describe('buildEpochGrid — catalog and inline days agree', () => {
  it('builds the same epoch join from a migrated catalog (taskInstances) day', () => {
    const { animal, day } = goldenInlineWorkspace();
    const inlineGrid = buildEpochGrid(animal, day);

    const ws = migrateTasksToCatalogV2ToV3({
      animals: { [animal.id]: { ...animal, days: [day.id] } },
      days: { [day.id]: { ...day } },
    });
    const catalogGrid = buildEpochGrid(ws.animals[animal.id], ws.days[day.id]);

    expect(catalogGrid.rows.map((r) => r.epoch)).toEqual(inlineGrid.rows.map((r) => r.epoch));
    expect(catalogGrid.rows.map((r) => r.taskName)).toEqual(inlineGrid.rows.map((r) => r.taskName));
    expect(catalogGrid.rows.map((r) => r.tag)).toEqual(inlineGrid.rows.map((r) => r.tag));
  });
});

describe('buildEpochGrid — grid metadata', () => {
  it('exposes the opto flag, data folder, and derivation tokens', () => {
    const { animal, day } = goldenInlineWorkspace();
    day.dataFolder = '/data/sample/20230622';
    const grid = buildEpochGrid(animal, day);
    expect(grid.isOpto).toBe(true);
    expect(grid.dataFolder).toBe('/data/sample/20230622');
    expect(grid.date).toBe('20230622'); // YYYYMMDD form for derivation
    expect(grid.subjectId).toBe('54321');
  });

  it('is empty (no rows) for a behavior-free day with no tasks', () => {
    const grid = buildEpochGrid({ id: 'a', subject: {} }, { id: 'd', tasks: [], state: {} });
    expect(grid.rows).toEqual([]);
    expect(grid.isOpto).toBe(false);
  });
});
