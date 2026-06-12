/**
 * TaskTypesContainer — add/edit/delete wiring for the animal task-type catalog.
 *
 * Covers: add appends a type with a fresh id via the mutation helpers; a clashing `task_name` is
 * blocked in-modal (the structural guarantee behind `duplicate_task_type_name`); edit updates in
 * place preserving the id; delete confirms then removes. All writes go through
 * `onFieldUpdate('taskTypes', nextArray)` (mirrors the camera catalog; no dedicated store action).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import TaskTypesContainer from '../TaskTypesContainer';

const fill = async (user) => {
  await user.type(screen.getByLabelText(/Task name/i), 'w-track');
  await user.type(screen.getByLabelText('Description'), 'Alternation');
  await user.type(screen.getByLabelText('Environment'), 'W maze');
};

describe('TaskTypesContainer', () => {
  let user;
  beforeEach(() => {
    user = userEvent.setup();
    vi.clearAllMocks();
  });

  it('adds a new task type with a fresh id through onFieldUpdate', async () => {
    const onFieldUpdate = vi.fn();
    render(<TaskTypesContainer animal={{ id: 'remy', taskTypes: [] }} onFieldUpdate={onFieldUpdate} />);

    await user.click(screen.getByRole('button', { name: /Add First Task Type/i }));
    await fill(user);
    await user.click(screen.getByRole('button', { name: /Save task type/i }));

    expect(onFieldUpdate).toHaveBeenCalledWith('taskTypes', [
      { id: 'tasktype-0', task_name: 'w-track', task_description: 'Alternation', task_environment: 'W maze', camera_id: [] },
    ]);
  });

  it('blocks a clashing task_name and does NOT write (one type per name)', async () => {
    const onFieldUpdate = vi.fn();
    const animal = {
      id: 'remy',
      taskTypes: [{ id: 'tasktype-0', task_name: 'w-track', task_description: 'x', task_environment: 'y' }],
    };
    render(<TaskTypesContainer animal={animal} onFieldUpdate={onFieldUpdate} />);

    await user.click(screen.getByRole('button', { name: /\+ Add Task Type/i }));
    await fill(user); // same name 'w-track'
    await user.click(screen.getByRole('button', { name: /Save task type/i }));

    expect(screen.getByRole('alert')).toHaveTextContent(/already exists/i);
    expect(onFieldUpdate).not.toHaveBeenCalled();
  });

  it('edits a task type in place, preserving its id', async () => {
    const onFieldUpdate = vi.fn();
    const animal = {
      id: 'remy',
      taskTypes: [{ id: 'tasktype-0', task_name: 'sleep', task_description: 'old', task_environment: 'home', camera_id: [] }],
    };
    render(<TaskTypesContainer animal={animal} onFieldUpdate={onFieldUpdate} />);

    await user.click(screen.getByRole('button', { name: /Edit task type sleep/i }));
    const desc = screen.getByLabelText('Description');
    await user.clear(desc);
    await user.type(desc, 'new description');
    await user.click(screen.getByRole('button', { name: /Save task type/i }));

    expect(onFieldUpdate).toHaveBeenCalledWith('taskTypes', [
      { id: 'tasktype-0', task_name: 'sleep', task_description: 'new description', task_environment: 'home', camera_id: [] },
    ]);
  });

  it('deletes a task type after confirmation', async () => {
    const onFieldUpdate = vi.fn();
    const animal = {
      id: 'remy',
      taskTypes: [{ id: 'tasktype-0', task_name: 'sleep', task_description: 'd', task_environment: 'e' }],
    };
    render(<TaskTypesContainer animal={animal} onFieldUpdate={onFieldUpdate} />);

    await user.click(screen.getByRole('button', { name: /Delete task type sleep/i }));
    // ConfirmDialog
    await user.click(screen.getByRole('button', { name: /^Delete$/i }));
    expect(onFieldUpdate).toHaveBeenCalledWith('taskTypes', []);
  });
});
