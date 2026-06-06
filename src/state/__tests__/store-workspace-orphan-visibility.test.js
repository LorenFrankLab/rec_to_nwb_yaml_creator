/**
 * Workspace-day orphaned-reference VISIBILITY.
 *
 * Load-Time Orphan Visibility Contract: the workspace must NOT silently scrub
 * orphaned `task_epochs` references in a day's associated_files /
 * associated_video_files. Stale references are preserved (so the user sees the
 * value they entered), validation owns them (`orphaned_file` / `orphaned_video`),
 * and export is blocked until the user repairs them. The only place references are
 * cleared is the explicit, user-confirmed destructive-edit flow in the Day Editor.
 */
import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useStore } from '../store';
import { mergeDayMetadata } from '../workspaceUtils';
import { validate } from '../../validation';
import { computeStepStatus } from '../../domain/validation';

/**
 *
 */
function seededDay() {
  const { result } = renderHook(() => useStore());
  act(() => {
    result.current.actions.createAnimal('remy', {
      species: 'Rattus norvegicus', sex: 'M', genotype: 'WT', date_of_birth: '2023-01-01',
    });
    result.current.actions.createDay('remy', '2023-06-22', {
      session_id: 'remy_20230622', session_description: 'Day 1',
    });
  });
  return result;
}

describe('Store - workspace day orphaned-reference visibility', () => {
  it('preserves (does not scrub) an orphaned file/video ref when a task epoch is removed', () => {
    const result = seededDay();

    act(() => {
      result.current.actions.updateDay('remy-2023-06-22', {
        tasks: [{ task_name: 'run', task_epochs: [1, 2] }],
        associated_files: [{ name: 'f.dat', task_epochs: 2 }],
        associated_video_files: [{ name: 'v.mp4', camera_id: 0, task_epochs: 1 }],
      });
    });

    // Remove epoch 2 (keep epoch 1) → the file referencing 2 is now orphaned.
    act(() => {
      result.current.actions.updateDay('remy-2023-06-22', {
        tasks: [{ task_name: 'run', task_epochs: [1] }],
      });
    });

    const day = result.current.model.workspace.days['remy-2023-06-22'];
    // Preserved, NOT silently cleared — the user must see and repair epoch 2.
    expect(day.associated_files[0].task_epochs).toBe(2);
    expect(day.associated_video_files[0].task_epochs).toBe(1); // still valid
  });

  it('validation flags the preserved orphan and the export gate blocks', () => {
    const result = seededDay();
    act(() => {
      result.current.actions.updateDay('remy-2023-06-22', {
        tasks: [{ task_name: 'run', task_epochs: [1] }],
        associated_files: [{ name: 'f.dat', task_epochs: 9 }], // orphaned epoch 9
        associated_video_files: [{ name: 'v.mp4', camera_id: 0, task_epochs: 9 }],
      });
    });

    const ws = result.current.model.workspace;
    const day = ws.days['remy-2023-06-22'];
    const animal = ws.animals.remy;
    const merged = mergeDayMetadata(animal, day);

    const issueCodes = validate(merged).map((i) => i.code);
    expect(issueCodes).toContain('orphaned_video');
    expect(issueCodes).toContain('orphaned_file');
    expect(computeStepStatus(day, merged).export).toBe('error');
  });

  it('does not mutate a day whose epochs are unchanged', () => {
    const result = seededDay();
    act(() => {
      result.current.actions.updateDay('remy-2023-06-22', {
        tasks: [{ task_name: 'run', task_epochs: [1] }],
        associated_files: [{ name: 'f.dat', task_epochs: 1 }],
      });
    });
    act(() => {
      result.current.actions.updateDay('remy-2023-06-22', {
        session: { session_description: 'Edited' },
      });
    });
    const after = result.current.model.workspace.days['remy-2023-06-22'];
    expect(after.associated_files[0].task_epochs).toBe(1);
    expect(after.session.session_description).toBe('Edited');
  });
});
