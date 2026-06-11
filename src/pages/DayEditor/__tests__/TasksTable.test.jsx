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

  it('shows a "Complete" text status for a complete task', () => {
    renderTable({ tasks: [completeTask] });
    const row = screen.getByRole('row', { name: /sleep/i });
    expect(within(row).getByText('Complete')).toBeInTheDocument();
  });

  it('shows the Room (task_environment) column — the task → room/cameras/epochs mapping (Task 5c)', () => {
    renderTable({ tasks: [completeTask] });
    const table = screen.getByRole('table');
    const headers = within(table).getAllByRole('columnheader').map((h) => h.textContent);
    expect(headers).toEqual(expect.arrayContaining(['Task', 'Room', 'Cameras', 'Epochs', 'Status', 'Actions']));
    const row = screen.getByRole('row', { name: /sleep/i });
    expect(within(row).getByText('HomeBox')).toBeInTheDocument(); // room
    expect(within(row).getByText('1')).toBeInTheDocument(); // camera id 1
    expect(within(row).getByText('1, 2')).toBeInTheDocument(); // epochs
  });

  it('surfaces a duplicate task-epoch collision as an "Epoch reused" error on BOTH tasks (Task 5c)', () => {
    // Each epoch belongs to exactly one task (duplicate_task_epoch is export-blocking). Epoch 2
    // is claimed by both tasks → both rows must show the prevented error inline, not silently.
    const sleep = { ...completeTask, task_name: 'sleep', task_epochs: [1, 2] };
    const run = { ...completeTask, task_name: 'run', camera_id: [0], task_epochs: [2, 3] };
    renderTable({ tasks: [sleep, run] });

    const sleepRow = screen.getByRole('row', { name: /sleep/i });
    const runRow = screen.getByRole('row', { name: /run/i });
    expect(within(sleepRow).getByText('Epoch reused')).toBeInTheDocument();
    expect(within(runRow).getByText('Epoch reused')).toBeInTheDocument();
    // The detail (which epoch, and why) is the label's tooltip.
    expect(
      within(sleepRow).getByTitle(/epoch 2 .*another task|each epoch belongs to exactly one task/i)
    ).toBeInTheDocument();
  });

  it('shows a distinct "Needs epochs" status for a task with no epochs', () => {
    renderTable({ tasks: [{ ...completeTask, task_epochs: [] }] });
    const row = screen.getByRole('row', { name: /sleep/i });
    expect(within(row).getByText('Needs epochs')).toBeInTheDocument();
  });

  it('shows a distinct "Missing camera" status for a task referencing a missing camera', () => {
    renderTable({ tasks: [{ ...completeTask, camera_id: [9] }] });
    const row = screen.getByRole('row', { name: /sleep/i });
    expect(within(row).getByText('Missing camera')).toBeInTheDocument();
  });

  it('shows BOTH warnings as separate labels (the old single ⚠ overloaded them)', () => {
    // A task with no epochs AND a missing camera surfaces two distinct labels, not one badge.
    renderTable({ tasks: [{ ...completeTask, task_epochs: [], camera_id: [9] }] });
    const row = screen.getByRole('row', { name: /sleep/i });
    expect(within(row).getByText('Needs epochs')).toBeInTheDocument();
    expect(within(row).getByText('Missing camera')).toBeInTheDocument();
  });

  it('shows a "Missing required fields" error for a task with a blank required field', () => {
    renderTable({ tasks: [{ ...completeTask, task_environment: '' }] });
    const row = screen.getByRole('row', { name: /sleep/i });
    expect(within(row).getByText('Missing required fields')).toBeInTheDocument();
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

  it('names affected videos in the delete confirmation', async () => {
    const user = userEvent.setup();
    renderTable({
      tasks: [completeTask],
      affectedVideosForDelete: () => [{ name: 'overhead.h264' }],
    });
    await user.click(screen.getByRole('button', { name: /delete task/i }));
    const dialog = screen.getByRole('alertdialog');
    expect(dialog).toHaveTextContent(/associated video file/i);
    expect(dialog).toHaveTextContent(/overhead\.h264/);
  });

  it('names affected associated_files in the delete confirmation', async () => {
    const user = userEvent.setup();
    renderTable({
      tasks: [completeTask],
      affectedFilesForDelete: () => [{ name: 'stim_log' }],
    });
    await user.click(screen.getByRole('button', { name: /delete task/i }));
    const dialog = screen.getByRole('alertdialog');
    expect(dialog).toHaveTextContent(/associated file/i);
    expect(dialog).toHaveTextContent(/stim_log/);
  });

  it('names both affected videos and files when a delete orphans each', async () => {
    const user = userEvent.setup();
    renderTable({
      tasks: [completeTask],
      affectedVideosForDelete: () => [{ name: 'overhead.h264' }],
      affectedFilesForDelete: () => [{ name: 'stim_log' }],
    });
    await user.click(screen.getByRole('button', { name: /delete task/i }));
    const dialog = screen.getByRole('alertdialog');
    expect(dialog).toHaveTextContent(/overhead\.h264/);
    expect(dialog).toHaveTextContent(/stim_log/);
  });

  // A child field (task_epochs / camera_id) inside an otherwise-valid task can be
  // malformed in loaded state — a string/number where an array is assumed. The
  // table must render the row (so the corruption is visible + repairable) rather
  // than throw on `.join`/`.some`/`.length`.
  it('renders a row without throwing when task_epochs and camera_id are non-arrays', () => {
    expect(() =>
      renderTable({ tasks: [{ task_name: 'a', task_epochs: '1', camera_id: 5 }] })
    ).not.toThrow();
    const row = screen.getByRole('row', { name: /^a/i });
    // The malformed child arrays render as empty (em dash), not their raw scalar.
    expect(within(row).getAllByText('—').length).toBeGreaterThan(0);
  });
});
