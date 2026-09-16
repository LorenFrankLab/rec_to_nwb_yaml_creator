/** Import → first epoch edit → save/reload, using the real screens and store. */
import fs from 'node:fs';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AppLayout } from '../../../layouts/AppLayout';
import { StoreProvider, useStoreContext } from '../../../state/StoreContext';
import { loadWorkspace } from '../../../state/persistence';
import { resetDraftRegistryForTests } from '../../../state/draftRegistry';
import { mergeDayMetadata } from '../../../state/workspaceUtils';
import { validateDay } from '../../../domain/dayValidationComposer';
import { decodeYaml, encodeYaml } from '../../../io/yaml';

const cleanYaml = fs.readFileSync(
  path.join(__dirname, '../../../__tests__/fixtures/golden/workspace-export.realistic.yml'),
  'utf8'
);
const firstDayId = 'remy-2023-06-22';
let workspace;

/** Observe the real store without replacing any action or selector. */
function StoreProbe() {
  workspace = useStoreContext().model.workspace;
  return null;
}

/** Mount the routed app; subsequent mounts hydrate from its saved workspace. */
function renderApp() {
  render(<StoreProvider><AppLayout /><StoreProbe /></StoreProvider>);
}

/**
 * Navigate in the same live app, as a hash link does.
 * @param {string} hash - Destination route.
 */
async function navigate(hash) {
  await act(async () => {
    window.location.hash = hash;
    window.dispatchEvent(new HashChangeEvent('hashchange'));
  });
}

/**
 * Import through the file picker and the real import commit action.
 * @param {object} user - User-event session.
 * @param {string} yaml - Metadata file contents.
 * @param {boolean} [existingAnimal] - Add a day to the previously imported animal.
 */
async function importDay(user, yaml, existingAnimal = false) {
  await navigate('#/import');
  const input = await screen.findByLabelText(/choose a metadata yaml file/i);
  await user.upload(input, { name: 'metadata.yml', text: () => Promise.resolve(yaml) });
  await user.click(await screen.findByRole('button', {
    name: existingAnimal ? /add recording day/i : /import as new animal/i,
  }));
  await screen.findByRole('region', { name: 'Import complete' });
}

/**
 * Change only the imported run's environment, leaving its selected cameras alone.
 * @param {object} user - User-event session.
 * @param {string} dayId - Recording day to open.
 * @param {string} room - Environment observed on this day.
 */
async function editRoom(user, dayId, room) {
  await navigate(`#/day/${dayId}`);
  await user.click(await screen.findByRole('button', { name: 'Show epoch 2 details' }));
  await user.click(screen.getByRole('button', { name: 'Edit for this day' }));
  const field = screen.getByLabelText('Environment for this day');
  await user.clear(field);
  await user.type(field, room);
  await user.click(screen.getByRole('button', { name: 'Save for this day' }));
}

/** Persist through the user-facing shortcut. */
async function save() {
  await act(async () => {
    fireEvent.keyDown(document.body, { key: 's', ctrlKey: true });
  });
}

/**
 * Verify the export merge and validation using the stored catalog and day.
 * @param {object} source - Live or reloaded workspace.
 * @param {string} dayId - Recording day to validate.
 * @param {object[]} expectedTasks - Complete task definitions expected in exported metadata.
 */
function expectTasks(source, dayId, expectedTasks) {
  const animal = source.animals.remy;
  const day = source.days[dayId];
  const merged = mergeDayMetadata(animal, day);
  expect(merged.tasks).toEqual(expectedTasks);
  expect(validateDay(day, merged, animal, Object.values(source.days)))
    .not.toEqual(expect.arrayContaining([expect.objectContaining({ code: 'dangling_task_type_ref' })]));
}

beforeEach(() => {
  resetDraftRegistryForTests();
  window.localStorage.clear();
  window.location.hash = '#/import';
  workspace = null;
});

afterEach(() => {
  cleanup();
  window.localStorage.clear();
  window.location.hash = '';
});

describe('imported tasks survive their first day edit', () => {
  it.each([false, true])('keeps every definition and camera order (reload before editing: %s)', async (reloadBeforeEdit) => {
    const user = userEvent.setup();
    renderApp();
    const model = decodeYaml(cleanYaml);
    // This order matters downstream and differs from the order in the animal's camera catalog.
    model.tasks[1].camera_id = [1, 0];
    await importDay(user, encodeYaml(model));
    expect(workspace.animals.remy.taskTypes).toBeUndefined();
    expectTasks(workspace, firstDayId, model.tasks);
    if (reloadBeforeEdit) {
      await save();
      cleanup();
      renderApp();
    }

    const room = 'Room recorded for this day';
    await editRoom(user, firstDayId, room);
    const expected = model.tasks.map((task, index) => index === 1
      ? { ...task, task_environment: room } : task);
    expectTasks(workspace, firstDayId, expected);
    expect(workspace.animals.remy.taskTypes).toHaveLength(2);
    expect(workspace.animals.remy.taskTypes.find((task) => task.task_name === 'w_alternation'))
      .toMatchObject({ task_environment: model.tasks[1].task_environment, camera_id: [1, 0] });

    await save();
    expectTasks(loadWorkspace().workspace, firstDayId, expected);
    cleanup();
    renderApp();
    await screen.findByRole('button', { name: 'Show epoch 2 details' });
    expectTasks(workspace, firstDayId, expected);
    expect(screen.getByLabelText(/epoch status summary/i)).toHaveTextContent('5 epochs');
  });

  it('adds an unfamiliar imported task without changing existing definitions or earlier days', async () => {
    const user = userEvent.setup();
    renderApp();
    await importDay(user, cleanYaml);
    await editRoom(user, firstDayId, 'Earlier room');
    const priorAnimal = structuredClone(workspace.animals.remy);
    expect(priorAnimal.taskTypes).toHaveLength(2);
    const priorDay = structuredClone(workspace.days[firstDayId]);
    const priorTasks = mergeDayMetadata(priorAnimal, priorDay).tasks;

    const model = decodeYaml(cleanYaml);
    model.session_id = 'remy_20230623';
    model.tasks[1] = { ...model.tasks[1], task_name: 'linear_track', camera_id: [1, 0] };
    const newDayId = 'remy-2023-06-23';
    await importDay(user, encodeYaml(model), true);
    expectTasks(workspace, newDayId, model.tasks);
    await editRoom(user, newDayId, 'Later room');
    const expected = model.tasks.map((task, index) => index === 1
      ? { ...task, task_environment: 'Later room' } : task);
    expectTasks(workspace, newDayId, expected);
    expect(workspace.animals.remy.taskTypes).toHaveLength(3);
    expect(workspace.animals.remy.taskTypes.slice(0, 2)).toEqual(priorAnimal.taskTypes);
    expect(workspace.days[firstDayId]).toEqual(priorDay);
    expectTasks(workspace, firstDayId, priorTasks);

    await save();
    cleanup();
    renderApp();
    await screen.findByRole('button', { name: 'Show epoch 2 details' });
    expectTasks(workspace, newDayId, expected);
    expectTasks(workspace, firstDayId, priorTasks);
  });
});
