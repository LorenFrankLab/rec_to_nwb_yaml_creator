/**
 * Tests for epochVideoUndeclared — the ONE authorized new validation rule (Phase 4).
 *
 * An epoch that has a task but neither a bound video NOR an explicit `videolessEpochs` ("no video")
 * declaration is a blocking `missing` readiness issue. The rule reads the day's arrays + the
 * off-export `videolessEpochs` set ONLY — it never reads the merged YAML, so it cannot move a
 * baseline (asserted here against `mergeDayMetadata`).
 */
import { describe, it, expect } from 'vitest';
import { epochVideoUndeclared } from '../epochVideoValidation';
import { insertAfterRemap, remapEpochRefs, remapVideolessEpochs } from '../epochOperations';
import { mergeDayMetadata } from '../../state/workspaceUtils';
import { encodeYaml } from '../../io/yaml';
import { buildRealisticWorkspace, buildCatalogWorkspace } from '../../__tests__/fixtures/workspaceBuilders';

interface MissingEpochDay {
  id: string;
  tasks: Array<{ task_name: string; task_description: string; task_epochs: number[] }>;
  associated_video_files: Array<{ name: string; camera_id: number; task_epochs: number | string }>;
  state: { draft: boolean; validated: boolean; exported: boolean; videolessEpochs?: number[] };
}

/** A small inline day with task epochs 1,2,3 and videos for 1,2 only (epoch 3 has none). */
function dayWithMissingEpoch(): MissingEpochDay {
  return {
    id: 'd',
    tasks: [{ task_name: 'w', task_description: 'run', task_epochs: [1, 2, 3] }],
    associated_video_files: [
      { name: 'v1', camera_id: 0, task_epochs: 1 },
      { name: 'v2', camera_id: 0, task_epochs: 2 },
    ],
    state: { draft: true, validated: false, exported: false },
  };
}

describe('epochVideoUndeclared — missing vs declared', () => {
  it('flags a task epoch with no bound video and no absent declaration', () => {
    const issues = epochVideoUndeclared(dayWithMissingEpoch());
    expect(issues).toHaveLength(1);
    expect(issues[0]).toMatchObject({
      code: 'epoch_video_undeclared',
      severity: 'error',
      repairSurface: 'day',
      step: 'epochs',
    });
    expect(issues[0].message).toContain('3');
  });

  it('does not flag an epoch that has a bound video', () => {
    const day = dayWithMissingEpoch();
    day.associated_video_files.push({ name: 'v3', camera_id: 0, task_epochs: 3 });
    expect(epochVideoUndeclared(day)).toHaveLength(0);
  });

  it('does not flag an epoch declared video-less (in the off-export videolessEpochs set)', () => {
    const day = dayWithMissingEpoch();
    day.state.videolessEpochs = [3];
    expect(epochVideoUndeclared(day)).toHaveLength(0);
  });

  it('reads the remapped videoless number after an epoch insert', () => {
    const day = {
      id: 'd',
      tasks: [{ task_name: 'w', task_description: 'run', task_epochs: [1, 2, 3] }],
      associated_video_files: [
        { name: 'v1', camera_id: 0, task_epochs: 1 },
        { name: 'v3', camera_id: 0, task_epochs: 3 },
      ],
      state: { draft: true, validated: false, exported: false, videolessEpochs: [2] },
    };
    const remap = insertAfterRemap([{ taskTypeId: 'tasktype-0', task_epochs: [1, 2, 3] }], 1);
    const refs = remapEpochRefs(day, remap);
    const after = {
      ...day,
      tasks: [{ ...day.tasks[0], task_epochs: [1, 2, 3, 4] }],
      associated_video_files: refs.associated_video_files,
      state: { ...day.state, videolessEpochs: remapVideolessEpochs(day.state.videolessEpochs, remap) },
    };

    expect(after.state.videolessEpochs).toEqual([3]);
    expect(epochVideoUndeclared(after).map((issue) => issue.focusPath)).toEqual(['epoch-2-video']);

    const stale = { ...after, state: { ...after.state, videolessEpochs: [2] } };
    expect(epochVideoUndeclared(stale).map((issue) => issue.focusPath)).toEqual(['epoch-3-video']);
  });

  it('reads a string task_epochs ("3") on a video tolerantly as binding epoch 3', () => {
    const day = dayWithMissingEpoch();
    day.associated_video_files.push({ name: 'v3', camera_id: 0, task_epochs: '3' });
    expect(epochVideoUndeclared(day)).toHaveLength(0);
  });

  it('returns no issues for a behavior-free day with no task epochs', () => {
    expect(epochVideoUndeclared({ id: 'd', tasks: [], state: {} })).toEqual([]);
  });

  it('produces a per-epoch focusPath for the "Fix in Epoch N" repair landing', () => {
    const day = dayWithMissingEpoch();
    day.tasks[0].task_epochs = [1, 2, 3, 4]; // epochs 3 and 4 now missing
    const issues = epochVideoUndeclared(day);
    expect(issues.map((i) => i.focusPath).sort()).toEqual(['epoch-3-video', 'epoch-4-video']);
  });
});

describe('epochVideoUndeclared — catalog (taskInstances) days', () => {
  it('reads epochs from taskInstances when the day is catalog-shaped (no inline tasks)', () => {
    const day = {
      id: 'd',
      taskInstances: [{ taskTypeId: 'tasktype-0', task_epochs: [1, 2] }],
      associated_video_files: [{ name: 'v1', camera_id: 0, task_epochs: 1 }],
      state: {},
    };
    const issues = epochVideoUndeclared(day);
    expect(issues).toHaveLength(1);
    expect(issues[0].message).toContain('2');
  });
});

describe('epochVideoUndeclared — off-export, cannot move a baseline', () => {
  it('does not mutate the day', () => {
    const day = dayWithMissingEpoch();
    const before = structuredClone(day);
    epochVideoUndeclared(day);
    expect(day).toEqual(before);
  });

  it('the merged YAML is byte-identical with and without the absent declaration', () => {
    // The realistic fixture's sleep epochs (1,3,5) have no video. Toggling the off-export
    // `videolessEpochs` declaration must NOT change the exported YAML at all.
    const { animal, day } = buildRealisticWorkspace() as {
      animal: Parameters<typeof mergeDayMetadata>[0];
      day: Record<string, unknown>;
    };
    const dayState = day.state as Record<string, unknown>;
    const missing = { ...day, state: { ...dayState, videolessEpochs: [] } } as unknown as Parameters<typeof mergeDayMetadata>[1];
    const declared = { ...day, state: { ...dayState, videolessEpochs: [1, 3, 5] } } as unknown as Parameters<typeof mergeDayMetadata>[1];

    expect(encodeYaml(mergeDayMetadata(animal, declared))).toBe(encodeYaml(mergeDayMetadata(animal, missing)));
    // And the rule's verdict flips on that off-export set.
    expect(epochVideoUndeclared(missing).length).toBeGreaterThan(0);
    expect(epochVideoUndeclared(declared)).toHaveLength(0);
  });

  it('remapping the off-export absent declaration leaves exported video bytes unchanged', () => {
    const { animal, day } = buildRealisticWorkspace() as {
      animal: Parameters<typeof mergeDayMetadata>[0];
      day: Record<string, unknown>;
    };
    const remapped = {
      ...day,
      state: {
        ...((day.state as Record<string, unknown>) ?? {}),
        videolessEpochs: remapVideolessEpochs([1, 3, 5], new Map([[1, 2], [3, 4], [5, 6]])),
      },
    } as unknown as Parameters<typeof mergeDayMetadata>[1];
    const beforeVideos = (mergeDayMetadata(animal, day as unknown as Parameters<typeof mergeDayMetadata>[1]) as {
      associated_video_files?: unknown;
    }).associated_video_files;
    const afterVideos = (mergeDayMetadata(animal, remapped) as { associated_video_files?: unknown }).associated_video_files;

    expect(encodeYaml({ associated_video_files: afterVideos })).toBe(
      encodeYaml({ associated_video_files: beforeVideos })
    );
  });

  it('a catalog day behaves identically (epochs read from taskInstances)', () => {
    const { day } = buildCatalogWorkspace() as { day: Record<string, unknown> };
    const dayState = day.state as Record<string, unknown>;
    // realistic catalog day: epochs 1,3,5 sleep have no video → missing until declared.
    const missing = { ...day, state: { ...dayState, videolessEpochs: [] } };
    expect(epochVideoUndeclared(missing).length).toBeGreaterThan(0);
    const declared = { ...day, state: { ...dayState, videolessEpochs: [1, 3, 5] } };
    expect(epochVideoUndeclared(declared)).toHaveLength(0);
  });
});
