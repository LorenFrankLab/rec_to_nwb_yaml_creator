/**
 * Orphaned task_epochs must be cleared whenever form state changes, not only
 * when the set of valid epochs changes.
 *
 * Importing a second file whose tasks define the same epochs as the first,
 * but whose associated files reference an epoch that does not exist, left the
 * dangling reference in place. The epoch dropdowns only render epochs that
 * exist, so the stale value was invisible and exported silently.
 */

import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useStore } from '../store';
import { defaultYMLValues } from '../../valueList';

const fileWithEpochs = (taskEpochs, fileEpoch) => ({
  ...defaultYMLValues,
  tasks: [
    {
      task_name: 'Run',
      task_description: 'd',
      task_environment: 'e',
      camera_id: [],
      task_epochs: taskEpochs,
    },
  ],
  associated_files: [
    { name: 'log.stateScriptLog', description: 'd', path: '/p', task_epochs: fileEpoch },
  ],
  associated_video_files: [{ name: 'v.mp4', camera_id: '', task_epochs: fileEpoch }],
});

describe('Store - task epoch cleanup with an unchanged epoch set', () => {
  it('clears an orphaned epoch on a second load that defines the same epochs', async () => {
    const { result } = renderHook(() => useStore());

    await act(async () => {
      result.current.actions.setFormData(fileWithEpochs([1, 2], 2));
    });
    expect(result.current.model.associated_files[0].task_epochs).toBe(2);

    // Second file: same task epochs, but the associated files point at epoch 99
    await act(async () => {
      result.current.actions.setFormData(fileWithEpochs([1, 2], 99));
    });

    expect(result.current.model.associated_files[0].task_epochs).toBe('');
    expect(result.current.model.associated_video_files[0].task_epochs).toBe('');
  });

  it('clears an orphan present in the very first state loaded', async () => {
    const { result } = renderHook(() => useStore());
    await act(async () => {
      result.current.actions.setFormData(fileWithEpochs([1, 2], 99));
    });
    expect(result.current.model.associated_files[0].task_epochs).toBe('');
  });
});
