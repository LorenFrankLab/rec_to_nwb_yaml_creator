/**
 * Phase 6 Task 0b: task_name is a Spyglass identity across the whole
 * workspace/dataset. Saving a task whose task_name already exists with a
 * DIFFERENT task_description must block normal Save and show the existing vs.
 * proposed descriptions side by side. Same name + same description is allowed
 * (this supersedes the old unconditional within-day duplicate-name block).
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import TaskModal from '../TaskModal';

const cameras = [{ id: 0, camera_name: 'overhead' }];

/**
 * Render TaskModal in add mode with a known-descriptions map.
 * @param {object} [props] Overrides (knownTaskDescriptions, existingTasks, ...).
 * @returns {{onSave: Function}}
 */
function renderModal(props = {}) {
  const onSave = vi.fn();
  render(
    <TaskModal
      isOpen
      mode="add"
      task={null}
      existingTasks={[]}
      cameras={cameras}
      onSave={onSave}
      onCancel={vi.fn()}
      {...props}
    />
  );
  return { onSave };
}

describe('TaskModal task_name identity guard (Task 0b)', () => {
  it('blocks Save when reusing a known task_name with a different description', async () => {
    const user = userEvent.setup();
    const known = { sleep: 'Rest in the home cage' };
    renderModal({ knownTaskDescriptions: known });

    await user.type(screen.getByRole('textbox', { name: /task name/i }), 'sleep');
    await user.type(screen.getByRole('textbox', { name: /task environment/i }), 'HomeBox');
    await user.type(
      screen.getByRole('textbox', { name: /task description/i }),
      'A totally different description'
    );

    const save = screen.getByRole('button', { name: /save task/i });
    expect(save).toBeDisabled();

    // Existing vs. proposed descriptions shown side by side and announced.
    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent(/Rest in the home cage/);
    expect(alert).toHaveTextContent(/A totally different description/);
  });

  it('allows Save when the description matches the known description', async () => {
    const user = userEvent.setup();
    const known = { sleep: 'Rest in the home cage' };
    const { onSave } = renderModal({ knownTaskDescriptions: known });

    await user.type(screen.getByRole('textbox', { name: /task name/i }), 'sleep');
    await user.type(screen.getByRole('textbox', { name: /task environment/i }), 'HomeBox');
    await user.type(
      screen.getByRole('textbox', { name: /task description/i }),
      'Rest in the home cage'
    );

    const save = screen.getByRole('button', { name: /save task/i });
    expect(save).toBeEnabled();
    await user.click(save);
    expect(onSave).toHaveBeenCalledTimes(1);
    expect(onSave.mock.calls[0][0].task_description).toBe('Rest in the home cage');
  });

  it('allows a within-day duplicate name when the description matches', async () => {
    const user = userEvent.setup();
    // A sibling "sleep" task with the same description; reusing the name with a
    // matching description must now be saveable (supersedes the old hard block).
    const existing = [
      {
        task_name: 'sleep',
        task_description: 'Rest in the home cage',
        task_environment: 'HomeBox',
        camera_id: [],
        task_epochs: [1],
      },
    ];
    const { onSave } = renderModal({
      existingTasks: existing,
      knownTaskDescriptions: { sleep: 'Rest in the home cage' },
    });

    await user.type(screen.getByRole('textbox', { name: /task name/i }), 'sleep');
    await user.type(screen.getByRole('textbox', { name: /task environment/i }), 'HomeBox');
    await user.type(
      screen.getByRole('textbox', { name: /task description/i }),
      'Rest in the home cage'
    );

    const save = screen.getByRole('button', { name: /save task/i });
    expect(save).toBeEnabled();
    await user.click(save);
    expect(onSave).toHaveBeenCalledTimes(1);
  });

  it('blocks a within-day duplicate name when the description differs', async () => {
    const user = userEvent.setup();
    const existing = [
      {
        task_name: 'sleep',
        task_description: 'Rest in the home cage',
        task_environment: 'HomeBox',
        camera_id: [],
        task_epochs: [1],
      },
    ];
    renderModal({
      existingTasks: existing,
      knownTaskDescriptions: { sleep: 'Rest in the home cage' },
    });

    await user.type(screen.getByRole('textbox', { name: /task name/i }), 'sleep');
    await user.type(screen.getByRole('textbox', { name: /task environment/i }), 'HomeBox');
    await user.type(
      screen.getByRole('textbox', { name: /task description/i }),
      'Something else entirely'
    );

    expect(screen.getByRole('button', { name: /save task/i })).toBeDisabled();
  });

  it('phrases the description-conflict save hint as a complete sentence', async () => {
    const user = userEvent.setup();
    renderModal({ knownTaskDescriptions: { sleep: 'Rest in the home cage' } });

    await user.type(screen.getByRole('textbox', { name: /task name/i }), 'sleep');
    await user.type(screen.getByRole('textbox', { name: /task environment/i }), 'HomeBox');
    await user.type(
      screen.getByRole('textbox', { name: /task description/i }),
      'A different description'
    );

    // The shared "To save, add ..." template was ungrammatical for this reason
    // ("add a new task name..."). The hint must read as a real instruction.
    const hint = screen.getByRole('status');
    expect(hint).toHaveTextContent(/rename this task|match the existing description/i);
    expect(hint).not.toHaveTextContent(/add a new task name/i);
  });

  it('describes the description field by the conflict message when a conflict exists', async () => {
    const user = userEvent.setup();
    renderModal({ knownTaskDescriptions: { sleep: 'Rest in the home cage' } });

    await user.type(screen.getByRole('textbox', { name: /task name/i }), 'sleep');
    await user.type(
      screen.getByRole('textbox', { name: /task description/i }),
      'A different description'
    );

    const textarea = screen.getByRole('textbox', { name: /task description/i });
    const describedBy = (textarea.getAttribute('aria-describedby') || '').split(/\s+/);
    const conflict = screen.getByText(/already used in this dataset with a different description/i);
    const conflictContainer = conflict.closest('[id]');
    expect(conflictContainer.id).toBeTruthy();
    expect(describedBy).toContain(conflictContainer.id);
  });
});
