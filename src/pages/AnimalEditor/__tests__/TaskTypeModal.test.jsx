/**
 * TaskTypeModal — add/edit form for an animal task type.
 *
 * Covers required-field validation (name/description/environment gate Save), the camera multi-select
 * (toggles, seeded from edit data), the cleaned save payload (camera ids coerced to integers), the
 * parent-supplied name-collision message, and add-vs-edit titles.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import TaskTypeModal from '../TaskTypeModal';

const animal = {
  id: 'remy',
  cameras: [{ id: 0, camera_name: 'box' }, { id: 1, camera_name: 'track' }],
};

const renderModal = (props = {}) =>
  render(
    <TaskTypeModal
      isOpen
      mode="add"
      animal={animal}
      onSave={props.onSave || vi.fn()}
      onCancel={props.onCancel || vi.fn()}
      {...props}
    />
  );

describe('TaskTypeModal', () => {
  let user;
  beforeEach(() => {
    user = userEvent.setup();
    vi.clearAllMocks();
  });

  it('shows the Add title and disables Save until all required fields are filled', async () => {
    renderModal();
    expect(screen.getByText('Add Task Type')).toBeInTheDocument();
    const save = screen.getByRole('button', { name: /Save task type/i });
    expect(save).toBeDisabled();

    await user.type(screen.getByLabelText(/Task name/i), 'w-track');
    await user.type(screen.getByLabelText('Description'), 'Alternation');
    expect(save).toBeDisabled(); // environment still empty
    await user.type(screen.getByLabelText('Environment'), 'W maze');
    expect(save).toBeEnabled();
  });

  it('saves a cleaned definition with integer camera ids from the multi-select', async () => {
    const onSave = vi.fn();
    renderModal({ onSave });
    await user.type(screen.getByLabelText(/Task name/i), 'w-track');
    await user.type(screen.getByLabelText('Description'), 'Alternation');
    await user.type(screen.getByLabelText('Environment'), 'W maze');
    await user.click(screen.getByLabelText(/0 · box/));
    await user.click(screen.getByLabelText(/1 · track/));
    await user.click(screen.getByRole('button', { name: /Save task type/i }));

    expect(onSave).toHaveBeenCalledWith({
      task_name: 'w-track',
      task_description: 'Alternation',
      task_environment: 'W maze',
      camera_id: [0, 1],
    });
  });

  it('seeds the form from an edited task type (Edit title + checked cameras)', () => {
    renderModal({
      mode: 'edit',
      taskType: { id: 'tasktype-0', task_name: 'sleep', task_description: 'Rest', task_environment: 'home', camera_id: [1] },
    });
    expect(screen.getByText('Edit Task Type')).toBeInTheDocument();
    expect(screen.getByLabelText(/Task name/i)).toHaveValue('sleep');
    expect(screen.getByLabelText(/1 · track/)).toBeChecked();
    expect(screen.getByLabelText(/0 · box/)).not.toBeChecked();
  });

  it('surfaces a parent-supplied name-collision error and keeps the modal open', () => {
    renderModal({ nameError: 'A task type named "sleep" already exists.' });
    expect(screen.getByRole('alert')).toHaveTextContent(/already exists/i);
  });

  it('calls onCancel from the Cancel button', async () => {
    const onCancel = vi.fn();
    renderModal({ onCancel });
    await user.click(screen.getByRole('button', { name: /Cancel and close modal/i }));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });
});
