/**
 * Tests for reconciling camera_id references against the cameras list.
 *
 * tasks[].camera_id and fs_gui_yamls[].camera_id are integer arrays;
 * associated_video_files[].camera_id is a single integer ('' when unset).
 * References to cameras that no longer exist must be removed, because the
 * UI only renders checkboxes/radios for existing cameras and cannot show them.
 */

import { describe, it, expect } from 'vitest';
import {
  getDefinedCameraIds,
  removeStaleCameraReferences,
} from '../cameraReferences';

describe('getDefinedCameraIds', () => {
  it('returns integer ids from the cameras list', () => {
    expect(getDefinedCameraIds([{ id: 0 }, { id: 4 }])).toEqual([0, 4]);
  });

  it('accepts string ids (the id input holds a string while being typed)', () => {
    expect(getDefinedCameraIds([{ id: '4' }])).toEqual([4]);
  });

  it('ignores empty, NaN, and undefined ids', () => {
    expect(getDefinedCameraIds([{ id: '' }, { id: NaN }, {}])).toEqual([]);
  });

  it('returns an empty list when cameras is missing', () => {
    expect(getDefinedCameraIds(undefined)).toEqual([]);
  });
});

describe('removeStaleCameraReferences', () => {
  const base = {
    cameras: [{ id: 4 }],
    tasks: [{ task_name: 'Run', camera_id: [0, 4, 7] }],
    associated_video_files: [
      { name: 'a.mp4', camera_id: 4 },
      { name: 'b.mp4', camera_id: 7 },
      { name: 'c.mp4', camera_id: '' },
    ],
    fs_gui_yamls: [{ name: 'x.yaml', camera_id: [7] }, { name: 'y.yaml' }],
  };

  it('drops task camera ids that no longer exist and keeps valid ones', () => {
    const result = removeStaleCameraReferences(base);
    expect(result.tasks[0].camera_id).toEqual([4]);
  });

  it('clears a video file camera_id that no longer exists', () => {
    const result = removeStaleCameraReferences(base);
    expect(result.associated_video_files.map((v) => v.camera_id)).toEqual([4, '', '']);
  });

  it('drops fs_gui_yamls camera ids that no longer exist', () => {
    const result = removeStaleCameraReferences(base);
    expect(result.fs_gui_yamls[0].camera_id).toEqual([]);
    expect(result.fs_gui_yamls[1]).toEqual({ name: 'y.yaml' });
  });

  it('drops every reference when the cameras list is emptied', () => {
    const result = removeStaleCameraReferences({ ...base, cameras: [] });
    expect(result.tasks[0].camera_id).toEqual([]);
    expect(result.associated_video_files[0].camera_id).toBe('');
  });

  it('does not mutate its input', () => {
    const input = structuredClone(base);
    removeStaleCameraReferences(input);
    expect(input).toEqual(base);
  });

  it('returns the same object when nothing is stale', () => {
    const clean = {
      cameras: [{ id: 4 }],
      tasks: [{ camera_id: [4] }],
      associated_video_files: [{ camera_id: 4 }, { camera_id: '' }],
      fs_gui_yamls: [{ camera_id: [4] }],
    };
    expect(removeStaleCameraReferences(clean)).toBe(clean);
  });

  it('tolerates missing sections', () => {
    const model = { cameras: [{ id: 1 }] };
    expect(removeStaleCameraReferences(model)).toBe(model);
  });
});
