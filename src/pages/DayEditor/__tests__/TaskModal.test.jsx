import { describe, it, expect, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import TaskModal from '../TaskModal';

const cameras = [
  { id: 0, camera_name: 'overhead' },
  { id: 1, camera_name: 'sleepbox' },
];

const inheritedEvents = [{ name: 'reward_well', description: 'Reward' }];

/**
 * Render a TaskModal with sensible defaults, overridable per test.
 * @param {object} [props] Props to override the defaults.
 * @returns {{onSave: Function, onCancel: Function}} The save/cancel spies.
 */
function renderModal(props = {}) {
  const onSave = vi.fn();
  const onCancel = vi.fn();
  render(
    <TaskModal
      isOpen
      mode="add"
      task={null}
      existingTasks={[]}
      cameras={cameras}
      inheritedEvents={inheritedEvents}
      onSave={onSave}
      onCancel={onCancel}
      {...props}
    />
  );
  return { onSave, onCancel };
}

/**
 * Find the <details> element whose <summary> matches text.
 * @param {string} summaryText Summary text to match.
 * @returns {HTMLElement} The enclosing <details> element.
 */
function detailsFor(summaryText) {
  const summary = screen.getByText(summaryText, { selector: 'summary' });
  return summary.closest('details');
}

describe('TaskModal', () => {
  it('renders required sections open and optional sections collapsed', () => {
    renderModal();
    expect(detailsFor('Task details')).toHaveAttribute('open');
    expect(detailsFor('Task epochs')).toHaveAttribute('open');
    expect(detailsFor('Cameras')).not.toHaveAttribute('open');
    expect(detailsFor('Behavioral events (inherited)')).not.toHaveAttribute('open');
  });

  it('writes selected camera ids as integers and removes them on uncheck', async () => {
    const user = userEvent.setup();
    const { onSave } = renderModal();

    await user.type(screen.getByRole('textbox', { name: /task name/i }), 'sleep');
    await user.type(screen.getByRole('textbox', { name: /task environment/i }), 'HomeBox');

    const cameraSection = detailsFor('Cameras');
    const sleepbox = within(cameraSection).getByRole('checkbox', { name: /1.*sleepbox/i });
    await user.click(sleepbox);
    await user.click(screen.getByRole('button', { name: /save task/i }));

    expect(onSave).toHaveBeenCalledTimes(1);
    const saved = onSave.mock.calls[0][0];
    expect(saved.camera_id).toEqual([1]);
    expect(saved.camera_id.every((id) => Number.isInteger(id))).toBe(true);

    // Re-open via a fresh render to verify unchecking removes the id.
    onSave.mockClear();
    const user2 = userEvent.setup();
    render(
      <TaskModal
        isOpen
        mode="edit"
        task={{ task_name: 'sleep', task_description: 'd', task_environment: 'HomeBox', camera_id: [1], task_epochs: [] }}
        existingTasks={[]}
        cameras={cameras}
        inheritedEvents={inheritedEvents}
        onSave={onSave}
        onCancel={vi.fn()}
      />
    );
    const editCameras = screen.getAllByText('Cameras', { selector: 'summary' })[1].closest('details');
    await user2.click(within(editCameras).getByRole('checkbox', { name: /1.*sleepbox/i }));
    await user2.click(screen.getAllByRole('button', { name: /save task/i })[1]);
    expect(onSave.mock.calls[0][0].camera_id).toEqual([]);
  });

  it('disables Save while the task name is blank', async () => {
    const user = userEvent.setup();
    renderModal();

    const save = screen.getByRole('button', { name: /save task/i });
    expect(save).toBeDisabled();

    await user.type(screen.getByRole('textbox', { name: /task name/i }), 'sleep');
    await user.type(screen.getByRole('textbox', { name: /task environment/i }), 'HomeBox');
    expect(save).toBeEnabled();
  });

  it('disables Save while an epoch row has end <= start', async () => {
    const user = userEvent.setup();
    renderModal();

    await user.type(screen.getByRole('textbox', { name: /task name/i }), 'sleep');
    await user.type(screen.getByRole('textbox', { name: /task environment/i }), 'HomeBox');
    const save = screen.getByRole('button', { name: /save task/i });
    expect(save).toBeEnabled();

    await user.click(screen.getByRole('button', { name: /add epoch/i }));
    await user.type(screen.getByRole('spinbutton', { name: /epoch number, row 1/i }), '1');
    await user.type(screen.getByRole('spinbutton', { name: /start time.*row 1/i }), '10');
    await user.type(screen.getByRole('spinbutton', { name: /end time.*row 1/i }), '5');
    expect(save).toBeDisabled();
  });

  it('persists task_epochs as unique integers without start/end times', async () => {
    const user = userEvent.setup();
    const { onSave } = renderModal();

    await user.type(screen.getByRole('textbox', { name: /task name/i }), 'sleep');
    await user.type(screen.getByRole('textbox', { name: /task environment/i }), 'HomeBox');
    await user.click(screen.getByRole('button', { name: /add epoch/i }));
    await user.type(screen.getByRole('spinbutton', { name: /epoch number, row 1/i }), '2');
    await user.type(screen.getByRole('spinbutton', { name: /start time.*row 1/i }), '0');
    await user.type(screen.getByRole('spinbutton', { name: /end time.*row 1/i }), '100');
    await user.click(screen.getByRole('button', { name: /save task/i }));

    const saved = onSave.mock.calls[0][0];
    expect(saved.task_epochs).toEqual([2]);
    expect(JSON.stringify(saved)).not.toMatch(/start|end/);
  });

  it('shows an info note and still allows saving when the animal has no cameras', async () => {
    const user = userEvent.setup();
    const { onSave } = renderModal({ cameras: [] });

    const cameraSection = detailsFor('Cameras');
    expect(within(cameraSection).getByRole('status')).toHaveTextContent(/no cameras/i);

    await user.type(screen.getByRole('textbox', { name: /task name/i }), 'sleep');
    await user.type(screen.getByRole('textbox', { name: /task environment/i }), 'HomeBox');
    expect(screen.getByRole('button', { name: /save task/i })).toBeEnabled();
    await user.click(screen.getByRole('button', { name: /save task/i }));
    expect(onSave).toHaveBeenCalledTimes(1);
  });

  it('flags a reference to a camera the animal no longer has as info, and still saves it', async () => {
    const user = userEvent.setup();
    const onSave = vi.fn();
    render(
      <TaskModal
        isOpen
        mode="edit"
        task={{ task_name: 'sleep', task_description: 'd', task_environment: 'HomeBox', camera_id: [9], task_epochs: [] }}
        existingTasks={[]}
        cameras={cameras}
        inheritedEvents={inheritedEvents}
        onSave={onSave}
        onCancel={vi.fn()}
      />
    );

    const cameraSection = detailsFor('Cameras');
    expect(within(cameraSection).getByRole('status')).toHaveTextContent(/9/);

    await user.click(screen.getByRole('button', { name: /save task/i }));
    expect(onSave.mock.calls[0][0].camera_id).toContain(9);
  });

  it('blocks Save on a duplicate task name within the day', async () => {
    const user = userEvent.setup();
    renderModal({ existingTasks: [{ task_name: 'sleep', task_description: 'd', task_environment: 'e', camera_id: [], task_epochs: [] }] });

    await user.type(screen.getByRole('textbox', { name: /task name/i }), 'sleep');
    await user.type(screen.getByRole('textbox', { name: /task environment/i }), 'HomeBox');

    expect(screen.getByRole('button', { name: /save task/i })).toBeDisabled();
    expect(screen.getByText(/task name must be unique/i)).toBeInTheDocument();
  });
});
