/**
 * Workspace-day task-epoch cleanup.
 *
 * The same data-integrity invariant the legacy form enforces must also run per
 * workspace day: when a task's epoch is removed, orphaned `task_epochs` references in
 * that day's associated_files / associated_video_files are scrubbed to '', valid refs
 * are untouched, and no other day is mutated.
 */
import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useStore } from '../store';

describe('Store - workspace day task-epoch cleanup', () => {
  it('clears orphaned task_epochs from a day when its task epoch is removed', () => {
    const { result } = renderHook(() => useStore());

    act(() => {
      result.current.actions.createAnimal('remy', {
        species: 'Rattus norvegicus', sex: 'M', genotype: 'WT', date_of_birth: '2023-01-01',
      });
      result.current.actions.createDay('remy', '2023-06-22', {
        session_id: 'remy_20230622', session_description: 'Day 1',
      });
    });

    // Set up tasks with epochs 1 & 2, and files referencing both (no orphans yet).
    act(() => {
      result.current.actions.updateDay('remy-2023-06-22', {
        tasks: [{ task_name: 'run', task_epochs: [1, 2] }],
        associated_files: [{ name: 'f.dat', task_epochs: 2 }],
        associated_video_files: [{ name: 'v.mp4', camera_id: 0, task_epochs: 1 }],
      });
    });

    expect(result.current.model.workspace.days['remy-2023-06-22'].associated_files[0].task_epochs).toBe(2);

    // Remove epoch 2 (keep epoch 1) → the file referencing 2 is now orphaned.
    act(() => {
      result.current.actions.updateDay('remy-2023-06-22', {
        tasks: [{ task_name: 'run', task_epochs: [1] }],
      });
    });

    const day = result.current.model.workspace.days['remy-2023-06-22'];
    expect(day.associated_files[0].task_epochs).toBe(''); // orphaned → cleared
    expect(day.associated_video_files[0].task_epochs).toBe(1); // still valid → untouched
  });

  it('clears an orphaned associated_video_files ref and scrubs all refs when every task is removed', () => {
    const { result } = renderHook(() => useStore());

    act(() => {
      result.current.actions.createAnimal('remy', {
        species: 'Rattus norvegicus', sex: 'M', genotype: 'WT', date_of_birth: '2023-01-01',
      });
      result.current.actions.createDay('remy', '2023-06-22', {
        session_id: 'remy_20230622', session_description: 'Day 1',
      });
      result.current.actions.updateDay('remy-2023-06-22', {
        tasks: [{ task_name: 'run', task_epochs: [1] }],
        associated_files: [{ name: 'f.dat', task_epochs: 1 }],
        associated_video_files: [{ name: 'v.mp4', camera_id: 0, task_epochs: 1 }],
      });
    });

    // Remove ALL tasks → valid epoch set is empty → every file ref is orphaned.
    act(() => {
      result.current.actions.updateDay('remy-2023-06-22', { tasks: [] });
    });

    const day = result.current.model.workspace.days['remy-2023-06-22'];
    expect(day.associated_files[0].task_epochs).toBe('');
    expect(day.associated_video_files[0].task_epochs).toBe('');
  });

  it('cleans only the edited day and leaves other days untouched', () => {
    const { result } = renderHook(() => useStore());

    act(() => {
      result.current.actions.createAnimal('remy', {
        species: 'Rattus norvegicus', sex: 'M', genotype: 'WT', date_of_birth: '2023-01-01',
      });
      result.current.actions.createDay('remy', '2023-06-22', { session_id: 'a', session_description: 'A' });
      result.current.actions.createDay('remy', '2023-06-23', { session_id: 'b', session_description: 'B' });
      result.current.actions.updateDay('remy-2023-06-22', {
        tasks: [{ task_name: 'run', task_epochs: [1, 2] }],
        associated_files: [{ name: 'a.dat', task_epochs: 2 }],
      });
      result.current.actions.updateDay('remy-2023-06-23', {
        tasks: [{ task_name: 'run', task_epochs: [5] }],
        associated_files: [{ name: 'b.dat', task_epochs: 5 }],
      });
    });

    const dayBBefore = result.current.model.workspace.days['remy-2023-06-23'];

    // Orphan day A's file by removing epoch 2; day B must be untouched (same object).
    act(() => {
      result.current.actions.updateDay('remy-2023-06-22', {
        tasks: [{ task_name: 'run', task_epochs: [1] }],
      });
    });

    const days = result.current.model.workspace.days;
    expect(days['remy-2023-06-22'].associated_files[0].task_epochs).toBe(''); // cleaned
    expect(days['remy-2023-06-23'].associated_files[0].task_epochs).toBe(5); // untouched
    expect(days['remy-2023-06-23']).toBe(dayBBefore); // not even re-created
  });

  it('does not re-churn a day after its orphans are cleaned (per-day guard holds)', () => {
    const { result } = renderHook(() => useStore());

    act(() => {
      result.current.actions.createAnimal('remy', {
        species: 'Rattus norvegicus', sex: 'M', genotype: 'WT', date_of_birth: '2023-01-01',
      });
      result.current.actions.createDay('remy', '2023-06-22', { session_id: 'a', session_description: 'A' });
      result.current.actions.updateDay('remy-2023-06-22', {
        tasks: [{ task_name: 'run', task_epochs: [1, 2] }],
        associated_files: [{ name: 'f.dat', task_epochs: 2 }],
      });
    });

    // Trigger cleanup (remove epoch 2 → file orphaned → scrubbed to '').
    act(() => {
      result.current.actions.updateDay('remy-2023-06-22', {
        tasks: [{ task_name: 'run', task_epochs: [1] }],
      });
    });

    // After cleanup settles, the day reference is stable: the guard must not keep
    // dispatching updateDay (which would advance lastModified / replace the object).
    const settled = result.current.model.workspace.days['remy-2023-06-22'];
    const settledModified = settled.lastModified;
    act(() => {}); // flush any pending effects
    const after = result.current.model.workspace.days['remy-2023-06-22'];
    expect(after).toBe(settled); // same object — no extra cleanup write
    expect(after.lastModified).toBe(settledModified);
    expect(after.associated_files[0].task_epochs).toBe('');
  });

  it('does not mutate a day whose epochs are unchanged', () => {
    const { result } = renderHook(() => useStore());

    act(() => {
      result.current.actions.createAnimal('remy', {
        species: 'Rattus norvegicus', sex: 'M', genotype: 'WT', date_of_birth: '2023-01-01',
      });
      result.current.actions.createDay('remy', '2023-06-22', {
        session_id: 'remy_20230622', session_description: 'Day 1',
      });
      result.current.actions.updateDay('remy-2023-06-22', {
        tasks: [{ task_name: 'run', task_epochs: [1] }],
        associated_files: [{ name: 'f.dat', task_epochs: 1 }],
      });
    });

    // A non-epoch edit (session) must not trigger cleanup churn on the files.
    act(() => {
      result.current.actions.updateDay('remy-2023-06-22', {
        session: { session_description: 'Edited' },
      });
    });

    const after = result.current.model.workspace.days['remy-2023-06-22'];
    expect(after.associated_files[0].task_epochs).toBe(1); // valid ref preserved
    expect(after.session.session_description).toBe('Edited');
  });
});
