/**
 * Phase 6 Task 0(a): dangling camera references in TaskModal must BLOCK normal
 * Save until removed/restored. Camera choices come from animal.cameras; an
 * existing task carrying a camera id the animal no longer defines is an error,
 * not just info. A clear, accessible action removes the dangling references.
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import TaskModal from '../TaskModal';

const cameras = [
  { id: 0, camera_name: 'overhead', meters_per_pixel: 0.001, lens: '8mm' },
  { id: 1, camera_name: 'sleepbox', meters_per_pixel: 0.0012, lens: '8mm' },
];

const inheritedEvents = [{ name: 'reward_well', description: 'Reward' }];

/**
 * Render an edit-mode TaskModal carrying a dangling camera reference.
 * @param {object} [props] Overrides.
 * @returns {{onSave: Function}}
 */
function renderEditModal(props = {}) {
  const onSave = vi.fn();
  render(
    <TaskModal
      isOpen
      mode="edit"
      task={{
        task_name: 'sleep',
        task_description: 'd',
        task_environment: 'HomeBox',
        camera_id: [9],
        task_epochs: [],
      }}
      existingTasks={[]}
      cameras={cameras}
      inheritedEvents={inheritedEvents}
      onSave={onSave}
      onCancel={vi.fn()}
      {...props}
    />
  );
  return { onSave };
}

describe('TaskModal dangling camera references (Task 0a)', () => {
  it('blocks normal Save while a task references a camera the animal lacks', () => {
    renderEditModal();
    const save = screen.getByRole('button', { name: /save task/i });
    expect(save).toBeDisabled();
    // The missing id is surfaced and announced.
    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent(/9/);
  });

  it('opens the Cameras section by default so the remove action is reachable', () => {
    // A collapsed Cameras section would hide the only action that unblocks Save —
    // a disabled-Save dead-end. The section must be open when a dangling reference
    // exists so the user can act without hunting for it.
    renderEditModal();
    const cameraSection = screen.getByText('Cameras', { selector: 'summary' }).closest('details');
    expect(cameraSection).toHaveAttribute('open');
  });

  it('leaves the Cameras section collapsed when there is no dangling reference', () => {
    renderEditModal({
      task: {
        task_name: 'sleep',
        task_description: 'd',
        task_environment: 'HomeBox',
        camera_id: [0],
        task_epochs: [],
      },
    });
    const cameraSection = screen.getByText('Cameras', { selector: 'summary' }).closest('details');
    expect(cameraSection).not.toHaveAttribute('open');
  });

  it('wires the dangling-camera error into the Save button description', () => {
    renderEditModal();
    const save = screen.getByRole('button', { name: /save task/i });
    const describedBy = (save.getAttribute('aria-describedby') || '').split(/\s+/);
    const errorDiv = screen.getByRole('alert');
    expect(errorDiv.id).toBeTruthy();
    expect(describedBy).toContain(errorDiv.id);
  });

  it('re-enables and saves once the dangling camera reference is removed', async () => {
    const user = userEvent.setup();
    const { onSave } = renderEditModal();
    const save = screen.getByRole('button', { name: /save task/i });
    expect(save).toBeDisabled();

    // An accessible action clears the dangling references.
    await user.click(screen.getByRole('button', { name: /remove camera reference/i }));

    expect(save).toBeEnabled();
    await user.click(save);
    expect(onSave).toHaveBeenCalledTimes(1);
    const saved = onSave.mock.calls[0][0];
    expect(saved.camera_id).toEqual([]);
    expect(saved.camera_id.every((id) => Number.isInteger(id))).toBe(true);
  });

  it('valid selected ids save as an integer array', async () => {
    const user = userEvent.setup();
    const onSave = vi.fn();
    render(
      <TaskModal
        isOpen
        mode="add"
        task={null}
        existingTasks={[]}
        cameras={cameras}
        inheritedEvents={inheritedEvents}
        onSave={onSave}
        onCancel={vi.fn()}
      />
    );
    await user.type(screen.getByRole('textbox', { name: /task name/i }), 'sleep');
    await user.type(screen.getByRole('textbox', { name: /task environment/i }), 'HomeBox');
    const cameraSummary = screen.getByText('Cameras', { selector: 'summary' });
    const cameraSection = cameraSummary.closest('details');
    await user.click(within(cameraSection).getByRole('checkbox', { name: /1.*sleepbox/i }));
    await user.click(screen.getByRole('button', { name: /save task/i }));

    const saved = onSave.mock.calls[0][0];
    expect(saved.camera_id).toEqual([1]);
    expect(saved.camera_id.every((id) => Number.isInteger(id))).toBe(true);
  });

  it('enriches camera checkbox labels with calibration and lens', () => {
    renderEditModal();
    const cameraSummary = screen.getByText('Cameras', { selector: 'summary' });
    const cameraSection = cameraSummary.closest('details');
    // Label includes id, name, meters_per_pixel and lens.
    expect(
      within(cameraSection).getByRole('checkbox', { name: /0.*overhead.*0\.001.*8mm/i })
    ).toBeInTheDocument();
  });

  it('phrases the dangling-camera save hint as a complete, grammatical sentence', () => {
    // The shared "To save, add ..." template was ungrammatical for this reason
    // ("add to remove camera references..."). The hint must read as a real clause.
    renderEditModal();
    const hint = screen.getByRole('status');
    expect(hint).toHaveTextContent(/remove camera reference/i);
    expect(hint).toHaveTextContent(/9/);
    expect(hint).not.toHaveTextContent(/add to remove/i);
  });
});
