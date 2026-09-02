/**
 * Tests for camera_id cleanup behavior.
 *
 * Critical data integrity requirement:
 * When cameras are removed or renumbered, camera_id references in tasks,
 * associated_video_files, and fs_gui_yamls must be cleared automatically.
 * The UI only renders checkboxes for cameras that currently exist, so a
 * stale reference is invisible to the user and would otherwise reach the
 * exported YAML unnoticed.
 */

import { describe, it, expect } from 'vitest';
import { render, renderHook, act } from '@testing-library/react';
import React from 'react';
import { useStore } from '../store';
import { defaultYMLValues } from '../../valueList';
import CheckboxList from '../../element/CheckboxList';

const stateWith = (cameras, overrides = {}) => ({
  ...defaultYMLValues,
  cameras,
  tasks: [
    {
      task_name: 'Run',
      task_description: 'd',
      task_environment: 'e',
      camera_id: [0, 4],
      task_epochs: [2],
    },
  ],
  associated_video_files: [{ name: 'v.mp4', camera_id: 0, task_epochs: 2 }],
  fs_gui_yamls: [{ name: 'f.yaml', epochs: [2], camera_id: [0, 4] }],
  ...overrides,
});

const setup = async (state) => {
  const hook = renderHook(() => useStore());
  await act(async () => {
    hook.result.current.actions.setFormData(state);
  });
  return hook;
};

describe('Store - camera_id cleanup', () => {
  it('drops a task camera_id when that camera is removed', async () => {
    const { result } = await setup(stateWith([{ id: 0 }, { id: 4 }]));
    await act(async () => {
      result.current.actions.updateFormData('cameras', [{ id: 4 }]);
    });
    expect(result.current.model.tasks[0].camera_id).toEqual([4]);
  });

  it('drops a task camera_id when that camera is renumbered', async () => {
    const { result } = await setup(stateWith([{ id: 0 }], { tasks: [{ camera_id: [0] }] }));
    await act(async () => {
      result.current.actions.updateFormData('id', 4, 'cameras', 0);
    });
    expect(result.current.model.cameras[0].id).toBe(4);
    expect(result.current.model.tasks[0].camera_id).toEqual([]);
  });

  it('clears associated_video_files camera_id when that camera is removed', async () => {
    const { result } = await setup(stateWith([{ id: 0 }, { id: 4 }]));
    await act(async () => {
      result.current.actions.updateFormData('cameras', [{ id: 4 }]);
    });
    expect(result.current.model.associated_video_files[0].camera_id).toBe('');
  });

  it('drops fs_gui_yamls camera ids when that camera is removed', async () => {
    const { result } = await setup(stateWith([{ id: 0 }, { id: 4 }]));
    await act(async () => {
      result.current.actions.updateFormData('cameras', [{ id: 4 }]);
    });
    expect(result.current.model.fs_gui_yamls[0].camera_id).toEqual([4]);
  });

  it('drops references when the last camera is removed', async () => {
    const { result } = await setup(stateWith([{ id: 0 }, { id: 4 }]));
    await act(async () => {
      result.current.actions.updateFormData('cameras', []);
    });
    expect(result.current.model.tasks[0].camera_id).toEqual([]);
  });

  it('removes stale references present in freshly loaded (imported) state', async () => {
    const { result } = await setup(stateWith([{ id: 4 }]));
    expect(result.current.model.tasks[0].camera_id).toEqual([4]);
    expect(result.current.model.associated_video_files[0].camera_id).toBe('');
  });

  it('leaves valid references untouched', async () => {
    const { result } = await setup(stateWith([{ id: 0 }, { id: 4 }]));
    expect(result.current.model.tasks[0].camera_id).toEqual([0, 4]);
    expect(result.current.model.associated_video_files[0].camera_id).toBe(0);
    expect(result.current.model.fs_gui_yamls[0].camera_id).toEqual([0, 4]);
  });
});

describe('CheckboxList - stale ids are invisible', () => {
  it('renders no checkbox for selected ids that are not in dataItems', () => {
    const { container } = render(
      <CheckboxList id="t" name="camera_id" title="Camera Id" value={[0, 4, 7]} dataItems={['4']} />
    );
    const boxes = container.querySelectorAll('input[type="checkbox"]');
    expect(boxes.length).toBe(1);
    expect(boxes[0].checked).toBe(true);
  });
});
