import { describe, it, expect, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import TaskModal from '../TaskModal';

const cameras = [
  { id: 0, camera_name: 'overhead' },
  { id: 1, camera_name: 'sleepbox' },
];

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
  });

  it('has no read-only inherited behavioral-events section (those live on the Behavioral Events tab)', () => {
    // Inherited/behavioral events were pulled out of the task edit modal; the modal is just
    // the three task accordions. Their absence here keeps the edit surface to one job.
    renderModal();
    expect(document.querySelectorAll('details')).toHaveLength(3);
    expect(screen.queryByText(/behavioral events/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/inherited/i)).not.toBeInTheDocument();
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

  it('re-enables Save once a bad epoch row is corrected', async () => {
    const user = userEvent.setup();
    renderModal();
    const save = screen.getByRole('button', { name: /save task/i });

    await user.type(screen.getByRole('textbox', { name: /task name/i }), 'sleep');
    await user.type(screen.getByRole('textbox', { name: /task environment/i }), 'HomeBox');
    await user.click(screen.getByRole('button', { name: /add epoch/i }));
    await user.type(screen.getByRole('spinbutton', { name: /epoch number, row 1/i }), '1');
    const start = screen.getByRole('spinbutton', { name: /start time.*row 1/i });
    const end = screen.getByRole('spinbutton', { name: /end time.*row 1/i });
    await user.type(start, '10');
    await user.type(end, '5');
    expect(save).toBeDisabled();

    await user.clear(end);
    await user.type(end, '20');
    expect(save).toBeEnabled();
  });

  it('keeps Save disabled for a whitespace-only required field and trims on save', async () => {
    const user = userEvent.setup();
    const { onSave } = renderModal();
    const save = screen.getByRole('button', { name: /save task/i });

    await user.type(screen.getByRole('textbox', { name: /task name/i }), '  sleep  ');
    await user.type(screen.getByRole('textbox', { name: /task environment/i }), '   ');
    expect(save).toBeDisabled();

    await user.clear(screen.getByRole('textbox', { name: /task environment/i }));
    await user.type(screen.getByRole('textbox', { name: /task environment/i }), 'HomeBox');
    await user.click(save);

    expect(onSave.mock.calls[0][0].task_name).toBe('sleep');
  });

  it('blocks a reused task name (with a different description) even with surrounding whitespace', async () => {
    const user = userEvent.setup();
    // Sibling "sleep" has description 'd'; typing the same name with a DIFFERENT
    // (here empty) description trips the task-name identity guard.
    renderModal({ existingTasks: [{ task_name: 'sleep', task_description: 'd', task_environment: 'e', camera_id: [], task_epochs: [] }] });

    await user.type(screen.getByRole('textbox', { name: /task name/i }), '  sleep  ');
    await user.type(screen.getByRole('textbox', { name: /task environment/i }), 'HomeBox');

    expect(screen.getByRole('button', { name: /save task/i })).toBeDisabled();
    expect(screen.getByText(/already used in this dataset with a different description/i)).toBeInTheDocument();
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

  it('blocks Save on a reference to a camera the animal no longer has until it is removed', async () => {
    const user = userEvent.setup();
    const onSave = vi.fn();
    render(
      <TaskModal
        isOpen
        mode="edit"
        task={{ task_name: 'sleep', task_description: 'd', task_environment: 'HomeBox', camera_id: [9], task_epochs: [] }}
        existingTasks={[]}
        cameras={cameras}
        onSave={onSave}
        onCancel={vi.fn()}
      />
    );

    const cameraSection = detailsFor('Cameras');
    expect(within(cameraSection).getByRole('alert')).toHaveTextContent(/9/);
    expect(screen.getByRole('button', { name: /save task/i })).toBeDisabled();

    // Removing the dangling reference unblocks Save and the bad id is dropped.
    await user.click(screen.getByRole('button', { name: /remove camera reference/i }));
    await user.click(screen.getByRole('button', { name: /save task/i }));
    expect(onSave.mock.calls[0][0].camera_id).not.toContain(9);
  });

  it('blocks Save when reusing a sibling task name with a different description', async () => {
    const user = userEvent.setup();
    renderModal({ existingTasks: [{ task_name: 'sleep', task_description: 'd', task_environment: 'e', camera_id: [], task_epochs: [] }] });

    await user.type(screen.getByRole('textbox', { name: /task name/i }), 'sleep');
    await user.type(screen.getByRole('textbox', { name: /task environment/i }), 'HomeBox');
    await user.type(screen.getByRole('textbox', { name: /task description/i }), 'different');

    expect(screen.getByRole('button', { name: /save task/i })).toBeDisabled();
    expect(screen.getByText(/already used in this dataset with a different description/i)).toBeInTheDocument();
  });

  // Editing a task whose persisted task_epochs / camera_id are malformed (a string
  // or number rather than an array) must open the form instead of throwing on the
  // `.map(Number)` initializers — the corruption is then editable and repairable.
  it('opens without throwing when editing a task whose task_epochs is a non-array', () => {
    expect(() =>
      renderModal({
        mode: 'edit',
        task: {
          task_name: 'sleep',
          task_description: 'd',
          task_environment: 'HomeBox',
          camera_id: 5,
          task_epochs: '1',
        },
      })
    ).not.toThrow();
    expect(detailsFor('Task details')).toBeInTheDocument();
  });
});
