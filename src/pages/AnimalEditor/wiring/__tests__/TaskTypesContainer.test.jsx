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
import { StoreProvider, useStoreContext } from '../../../../state/StoreContext';
import TaskTypesContainer from '../TaskTypesContainer';

/** The live workspace, republished on every store commit by {@link WorkspaceProbe}. */
let liveWorkspace = null;

/**
 * Publishes the store's current workspace so a test can assert what was really written to the
 * recording days (the container writes them through `actions.updateDay`, not `onFieldUpdate`).
 * @returns {null} Renders nothing.
 */
function WorkspaceProbe() {
  const { model } = useStoreContext();
  liveWorkspace = model.workspace;
  return null;
}

/**
 * Render the container inside a store (its recording-day blast radius reads the workspace).
 * @param {object} ui - The element to render.
 * @param {object} [workspace] - Workspace slice to seed.
 * @returns {object} render result
 */
const renderWithStore = (ui, workspace = { animals: {}, days: {} }) =>
  render(
    <StoreProvider initialState={{ workspace }}>
      {ui}
      <WorkspaceProbe />
    </StoreProvider>
  );

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
    renderWithStore(<TaskTypesContainer animal={{ id: 'remy', taskTypes: [] }} onFieldUpdate={onFieldUpdate} />);

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
    renderWithStore(<TaskTypesContainer animal={animal} onFieldUpdate={onFieldUpdate} />);

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
    renderWithStore(<TaskTypesContainer animal={animal} onFieldUpdate={onFieldUpdate} />);

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
    renderWithStore(<TaskTypesContainer animal={animal} onFieldUpdate={onFieldUpdate} />);

    await user.click(screen.getByRole('button', { name: /Delete task type sleep/i }));
    // ConfirmDialog
    await user.click(screen.getByRole('button', { name: /^Delete$/i }));
    expect(onFieldUpdate).toHaveBeenCalledWith('taskTypes', []);
  });
});

describe('TaskTypesContainer — changing a task default that recording days already follow', () => {
  let user;
  beforeEach(() => {
    user = userEvent.setup();
    vi.clearAllMocks();
  });

  const TASK_TYPE = {
    id: 'tasktype-0',
    task_name: 'forkTrack',
    task_description: 'Handle alternation',
    task_environment: 'HaightRight',
    camera_id: [],
  };

  /** An animal with two recording days that both ran the task type, following its default. */
  const workspaceWithTwoDays = () => ({
    animals: {
      sc38: { id: 'sc38', taskTypes: [TASK_TYPE], days: ['sc38-2023-06-06', 'sc38-2023-06-13'] },
    },
    days: {
      'sc38-2023-06-06': {
        id: 'sc38-2023-06-06',
        animalId: 'sc38',
        date: '2023-06-06',
        taskInstances: [{ taskTypeId: 'tasktype-0', task_epochs: [2] }],
      },
      'sc38-2023-06-13': {
        id: 'sc38-2023-06-13',
        animalId: 'sc38',
        date: '2023-06-13',
        taskInstances: [{ taskTypeId: 'tasktype-0', task_epochs: [2] }],
      },
    },
  });

  /**
   * Open the edit modal and retype the environment.
   * @param next
   */
  const editEnvironment = async (next) => {
    await user.click(screen.getByRole('button', { name: /Edit task type forkTrack/i }));
    const environment = screen.getByLabelText('Environment');
    await user.clear(environment);
    await user.type(environment, next);
    await user.click(screen.getByRole('button', { name: /Save task type/i }));
  };

  it('asks for a scope, naming the affected days, before changing the default', async () => {
    const workspace = workspaceWithTwoDays();
    const onFieldUpdate = vi.fn();
    renderWithStore(
      <TaskTypesContainer animal={workspace.animals.sc38} onFieldUpdate={onFieldUpdate} />,
      workspace
    );

    await editEnvironment('HaightLeft');

    const dialog = screen.getByRole('alertdialog');
    expect(dialog).toHaveTextContent(/2 recording days/i);
    expect(dialog).toHaveTextContent('2023-06-06');
    expect(dialog).toHaveTextContent('2023-06-13');
    // Nothing is written until the user chooses.
    expect(onFieldUpdate).not.toHaveBeenCalled();
  });

  it('keeping earlier days as recorded pins the OLD value on them, then saves the new default', async () => {
    const workspace = workspaceWithTwoDays();
    const onFieldUpdate = vi.fn();
    renderWithStore(
      <TaskTypesContainer animal={workspace.animals.sc38} onFieldUpdate={onFieldUpdate} />,
      workspace
    );

    await editEnvironment('HaightLeft');
    await user.click(screen.getByRole('button', { name: /Keep earlier days as recorded/i }));

    expect(onFieldUpdate).toHaveBeenCalledWith('taskTypes', [
      { ...TASK_TYPE, task_environment: 'HaightLeft' },
    ]);
    // Both earlier days now RECORD the room they actually ran in.
    const store = liveWorkspace.days;
    expect(store['sc38-2023-06-06'].taskInstances).toEqual([
      { taskTypeId: 'tasktype-0', task_environment: 'HaightRight', task_epochs: [2] },
    ]);
    expect(store['sc38-2023-06-13'].taskInstances).toEqual([
      { taskTypeId: 'tasktype-0', task_environment: 'HaightRight', task_epochs: [2] },
    ]);
  });

  it('"also correct those days" saves the new default WITHOUT pinning', async () => {
    const workspace = workspaceWithTwoDays();
    const onFieldUpdate = vi.fn();
    renderWithStore(
      <TaskTypesContainer animal={workspace.animals.sc38} onFieldUpdate={onFieldUpdate} />,
      workspace
    );

    await editEnvironment('HaightLeft');
    await user.click(screen.getByRole('button', { name: /Also correct those 2 days/i }));

    expect(onFieldUpdate).toHaveBeenCalledWith('taskTypes', [
      { ...TASK_TYPE, task_environment: 'HaightLeft' },
    ]);
    const store = liveWorkspace.days;
    expect(store['sc38-2023-06-06'].taskInstances).toEqual([
      { taskTypeId: 'tasktype-0', task_epochs: [2] },
    ]);
  });

  it('cancelling the scope choice returns to the form with the edit intact (no silent discard)', async () => {
    const workspace = workspaceWithTwoDays();
    const onFieldUpdate = vi.fn();
    renderWithStore(
      <TaskTypesContainer animal={workspace.animals.sc38} onFieldUpdate={onFieldUpdate} />,
      workspace
    );

    await editEnvironment('HaightLeft');
    await user.click(screen.getByRole('button', { name: /^Cancel$/i }));

    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Environment')).toHaveValue('HaightLeft');
    expect(onFieldUpdate).not.toHaveBeenCalled();
  });

  it('shows the scope dialog as the only modal surface (one focus trap at a time)', async () => {
    const workspace = workspaceWithTwoDays();
    renderWithStore(
      <TaskTypesContainer animal={workspace.animals.sc38} onFieldUpdate={vi.fn()} />,
      workspace
    );

    await editEnvironment('HaightLeft');
    expect(document.querySelectorAll('[aria-modal="true"]')).toHaveLength(1);
  });

  it('saves straight away when no recording day follows the default', async () => {
    const workspace = {
      animals: { sc38: { id: 'sc38', taskTypes: [TASK_TYPE], days: [] } },
      days: {},
    };
    const onFieldUpdate = vi.fn();
    renderWithStore(
      <TaskTypesContainer animal={workspace.animals.sc38} onFieldUpdate={onFieldUpdate} />,
      workspace
    );

    await editEnvironment('HaightLeft');
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    expect(onFieldUpdate).toHaveBeenCalledWith('taskTypes', [
      { ...TASK_TYPE, task_environment: 'HaightLeft' },
    ]);
  });

  it('does not ask when the edit leaves environment and cameras alone', async () => {
    const workspace = workspaceWithTwoDays();
    const onFieldUpdate = vi.fn();
    renderWithStore(
      <TaskTypesContainer animal={workspace.animals.sc38} onFieldUpdate={onFieldUpdate} />,
      workspace
    );

    await user.click(screen.getByRole('button', { name: /Edit task type forkTrack/i }));
    const description = screen.getByLabelText('Description');
    await user.clear(description);
    await user.type(description, 'Handle alternation, two second delay');
    await user.click(screen.getByRole('button', { name: /Save task type/i }));

    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    expect(onFieldUpdate).toHaveBeenCalledWith('taskTypes', [
      { ...TASK_TYPE, task_description: 'Handle alternation, two second delay' },
    ]);
  });

  it('leaves a day that already recorded its own room untouched', async () => {
    const workspace = workspaceWithTwoDays();
    workspace.days['sc38-2023-06-13'].taskInstances = [
      { taskTypeId: 'tasktype-0', task_environment: 'HaightLeft', task_epochs: [2] },
    ];
    const onFieldUpdate = vi.fn();
    renderWithStore(
      <TaskTypesContainer animal={workspace.animals.sc38} onFieldUpdate={onFieldUpdate} />,
      workspace
    );

    await editEnvironment('SomewhereElse');
    const dialog = screen.getByRole('alertdialog');
    expect(dialog).toHaveTextContent(/1 recording day/i);
    expect(dialog).not.toHaveTextContent('2023-06-13');
    await user.click(screen.getByRole('button', { name: /Keep earlier days as recorded/i }));

    const store = liveWorkspace.days;
    expect(store['sc38-2023-06-13'].taskInstances).toEqual([
      { taskTypeId: 'tasktype-0', task_environment: 'HaightLeft', task_epochs: [2] },
    ]);
  });
});
