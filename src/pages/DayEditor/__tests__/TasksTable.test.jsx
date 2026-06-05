import { describe, it, expect, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import TasksTable from '../TasksTable';

const cameras = [
  { id: 0, camera_name: 'overhead' },
  { id: 1, camera_name: 'sleepbox' },
];

const completeTask = {
  task_name: 'sleep',
  task_description: 'rest',
  task_environment: 'HomeBox',
  camera_id: [1],
  task_epochs: [1, 2],
};

/**
 * Render a TasksTable with default handler spies, overridable per test.
 * @param {object} [props] Props to override the defaults.
 * @returns {{onAdd: Function, onEdit: Function, onDelete: Function}} The spies.
 */
function renderTable(props = {}) {
  const handlers = { onAdd: vi.fn(), onEdit: vi.fn(), onDelete: vi.fn() };
  render(<TasksTable tasks={[]} cameras={cameras} {...handlers} {...props} />);
  return handlers;
}

describe('TasksTable', () => {
  it('renders the empty state with an Add Task button', async () => {
    const user = userEvent.setup();
    const { onAdd } = renderTable({ tasks: [] });

    expect(screen.getByText(/no tasks/i)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /add.*task/i }));
    expect(onAdd).toHaveBeenCalledTimes(1);
  });

  it('shows a ✓ status for a complete task', () => {
    renderTable({ tasks: [completeTask] });
    const row = screen.getByRole('row', { name: /sleep/i });
    expect(within(row).getByText('✓')).toBeInTheDocument();
  });

  it('shows a ⚠ status for a task with no epochs', () => {
    renderTable({ tasks: [{ ...completeTask, task_epochs: [] }] });
    const row = screen.getByRole('row', { name: /sleep/i });
    expect(within(row).getByText('⚠')).toBeInTheDocument();
  });

  it('shows a ⚠ status for a task referencing a missing camera', () => {
    renderTable({ tasks: [{ ...completeTask, camera_id: [9] }] });
    const row = screen.getByRole('row', { name: /sleep/i });
    expect(within(row).getByText('⚠')).toBeInTheDocument();
  });

  it('shows a ❌ status for a task with a blank required field', () => {
    renderTable({ tasks: [{ ...completeTask, task_environment: '' }] });
    const row = screen.getByRole('row', { name: /sleep/i });
    expect(within(row).getByText('❌')).toBeInTheDocument();
  });

  it('calls onEdit with the task index', async () => {
    const user = userEvent.setup();
    const { onEdit } = renderTable({ tasks: [completeTask] });
    await user.click(screen.getByRole('button', { name: /edit/i }));
    expect(onEdit).toHaveBeenCalledWith(0);
  });

  it('calls onDelete only after the delete is confirmed', async () => {
    const user = userEvent.setup();
    const { onDelete } = renderTable({ tasks: [completeTask] });

    await user.click(screen.getByRole('button', { name: /delete/i }));
    // Dialog is open but nothing deleted yet.
    expect(onDelete).not.toHaveBeenCalled();

    const dialog = screen.getByRole('alertdialog');
    await user.click(within(dialog).getByRole('button', { name: /^delete$/i }));
    expect(onDelete).toHaveBeenCalledWith(0);
  });

  it('lists the actual epoch numbers (not just a count) so they match the repair dialog', () => {
    renderTable({ tasks: [{ ...completeTask, task_epochs: [1, 3] }] });
    const row = screen.getByRole('row', { name: /sleep/i });
    const epochsCell = within(row).getByText('1, 3');
    expect(epochsCell).toBeInTheDocument();
  });

  it('shows an em dash for a task with no epochs', () => {
    renderTable({ tasks: [{ ...completeTask, task_epochs: [] }] });
    const row = screen.getByRole('row', { name: /sleep/i });
    expect(within(row).getAllByText('—').length).toBeGreaterThan(0);
  });
});
