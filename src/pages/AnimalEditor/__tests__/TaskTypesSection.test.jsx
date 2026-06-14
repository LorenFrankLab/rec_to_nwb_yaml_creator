/**
 * TaskTypesSection — the animal task-type catalog table (presentational).
 *
 * Covers the empty state, the table render with identity fields + camera labels, the status badge
 * (complete / incomplete / duplicate-name), the add/edit/delete handler wiring, and shape-tolerance
 * for a corrupt `taskTypes` (this is a repair destination).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'jest-axe';
import TaskTypesSection from '../TaskTypesSection';

const animal = {
  id: 'remy',
  cameras: [{ id: 0, camera_name: 'box' }, { id: 1, camera_name: 'track' }],
  taskTypes: [
    { id: 'tasktype-0', task_name: 'sleep', task_description: 'Rest', task_environment: 'home cage', camera_id: [0] },
    { id: 'tasktype-1', task_name: 'w-track', task_description: 'Alternation', task_environment: 'W maze', camera_id: [0, 1] },
  ],
};

describe('TaskTypesSection', () => {
  let user;
  beforeEach(() => {
    user = userEvent.setup();
    vi.clearAllMocks();
  });

  it('shows the empty state with a call to action when no task types are defined', () => {
    render(<TaskTypesSection animal={{ id: 'remy', taskTypes: [] }} onFieldUpdate={vi.fn()} />);
    expect(screen.getByText(/No Task Types Defined/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Add First Task Type/i })).toBeInTheDocument();
  });

  it('degrades to the empty state for a corrupt non-array taskTypes (repair destination)', () => {
    render(<TaskTypesSection animal={{ id: 'remy', taskTypes: 'nope' }} onFieldUpdate={vi.fn()} />);
    expect(screen.getByText(/No Task Types Defined/i)).toBeInTheDocument();
  });

  it('renders a row per task type with name, description, environment, and camera labels', () => {
    render(<TaskTypesSection animal={animal} onFieldUpdate={vi.fn()} />);
    expect(screen.getByText('sleep')).toBeInTheDocument();
    expect(screen.getByText('w-track')).toBeInTheDocument();
    expect(screen.getByText('Alternation')).toBeInTheDocument();
    // Camera labels combine id + camera_name.
    expect(screen.getByText('0 · box, 1 · track')).toBeInTheDocument();
  });

  it('flags a duplicate task_name as an error status (the Spyglass identity collision)', () => {
    const dup = {
      id: 'remy',
      taskTypes: [
        { id: 'tasktype-0', task_name: 'sleep', task_description: 'A', task_environment: 'e' },
        { id: 'tasktype-1', task_name: 'sleep', task_description: 'B', task_environment: 'e' },
      ],
    };
    render(<TaskTypesSection animal={dup} onFieldUpdate={vi.fn()} />);
    const badges = screen.getAllByLabelText(/Duplicate task name/i);
    expect(badges).toHaveLength(2);
  });

  it('marks a type missing a required field as incomplete', () => {
    const incomplete = {
      id: 'remy',
      taskTypes: [{ id: 'tasktype-0', task_name: 'sleep', task_description: '', task_environment: 'e' }],
    };
    render(<TaskTypesSection animal={incomplete} onFieldUpdate={vi.fn()} />);
    expect(screen.getByLabelText(/Incomplete/i)).toBeInTheDocument();
  });

  it('calls onAdd / onEdit / onDelete from the buttons', async () => {
    const onAdd = vi.fn();
    const onEdit = vi.fn();
    const onDelete = vi.fn();
    render(<TaskTypesSection animal={animal} onFieldUpdate={vi.fn()} onAdd={onAdd} onEdit={onEdit} onDelete={onDelete} />);

    await user.click(screen.getByRole('button', { name: /\+ Add Task Type/i }));
    expect(onAdd).toHaveBeenCalledTimes(1);

    await user.click(screen.getByRole('button', { name: /Edit task type sleep/i }));
    expect(onEdit).toHaveBeenCalledWith('tasktype-0');

    await user.click(screen.getByRole('button', { name: /Delete task type w-track/i }));
    expect(onDelete).toHaveBeenCalledWith(animal.taskTypes[1]);
  });

  it('has no axe violations in the table view', async () => {
    const { container } = render(
      <main>
        <TaskTypesSection animal={animal} onFieldUpdate={vi.fn()} />
      </main>
    );
    expect(await axe(container)).toHaveNoViolations();
  });
});
