/**
 * Integration tests for the Tasks & Epochs step, rendered through the real store
 * provider and DayEditorStepper (the same harness as DayEditorStepper.test.jsx).
 * These exercise keyboard/focus behavior, animal→day inheritance, and persistence
 * through onFieldUpdate→updateDay end-to-end.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { StoreProvider, useStoreContext } from '../../../state/StoreContext';
import DayEditorStepper from '../DayEditorStepper';
import { useDayIdFromUrl } from '../../../hooks/useDayIdFromUrl';
import { mergeDayMetadata } from '../../../state/workspaceUtils';
import { makeAnimalWithCamerasAndDay } from './taskFixtures';

vi.mock('../../../hooks/useDayIdFromUrl', () => ({
  useDayIdFromUrl: vi.fn(),
}));

const DAY_ID = 'remy_20230622';
const ANIMAL_ID = 'remy';

// The catalog shape: the day picks task types the animal defines (cameras live on the TYPE).
const CATALOG = {
  animal: {
    taskTypes: [
      { id: 'tasktype-0', task_name: 'sleep', task_description: 'Rest', task_environment: 'HomeBox', camera_id: [1] },
    ],
  },
  day: { tasks: undefined, taskInstances: [{ taskTypeId: 'tasktype-0', task_epochs: [1, 3] }] },
};

/**
 * Renders the day's EXPORTED tasks (resolved from the catalog) as JSON so tests can read export truth.
 * @returns {JSX.Element} A hidden element carrying the serialized exported tasks.
 */
function TasksInspector() {
  const { model } = useStoreContext();
  const animal = model.workspace?.animals?.[ANIMAL_ID];
  const day = model.workspace?.days?.[DAY_ID];
  const tasks = animal && day ? mergeDayMetadata(animal, day).tasks : [];
  return <div data-testid="tasks-json">{JSON.stringify(tasks)}</div>;
}

/**
 * Render the full DayEditorStepper through the real store for the fixture day.
 * @param {object} [overrides] Fixture overrides ({ animal?, day? }).
 * @returns {{animal: object, day: object}} The fixture animal and day.
 */
function renderStepper(overrides = {}) {
  const { animal, day } = makeAnimalWithCamerasAndDay(overrides);
  const initialState = {
    workspace: {
      animals: { [animal.id]: animal },
      days: { [day.id]: day },
      settings: {},
    },
  };
  render(
    <StoreProvider initialState={initialState}>
      <DayEditorStepper />
      <TasksInspector />
    </StoreProvider>
  );
  return { animal, day };
}

/**
 * Read the current persisted tasks from the inspector.
 * @returns {Array} The day's tasks as currently held in the store.
 */
function readTasks() {
  return JSON.parse(screen.getByTestId('tasks-json').textContent);
}

/**
 * Navigate the stepper to the Epochs step.
 * @param {object} user The userEvent instance.
 * @returns {Promise<void>}
 */
async function goToEpochs(user) {
  await user.click(screen.getByRole('button', { name: /Epochs/i }));
}

describe('Tasks & Epochs step (integration)', () => {
  beforeEach(() => {
    useDayIdFromUrl.mockReturnValue(DAY_ID);
    Element.prototype.scrollIntoView = vi.fn();
  });

  it('keyboard/focus: opens with focus inside, traps Tab, ESC closes and returns focus to the trigger', async () => {
    const user = userEvent.setup();
    renderStepper();
    await goToEpochs(user);

    const addButton = screen.getByRole('button', { name: /add.*task/i });
    await user.click(addButton);

    const dialog = screen.getByRole('dialog');
    // Focus moved into the dialog on open (onto the first focusable element).
    expect(dialog.contains(document.activeElement)).toBe(true);

    // Shift+Tab from the first focusable must WRAP to the last inside the dialog
    // (the shared Modal trap); without the trap it would escape to the document.
    await user.tab({ shift: true });
    expect(dialog.contains(document.activeElement)).toBe(true);

    // ESC closes and returns focus to the element that opened the modal.
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(document.activeElement).toBe(addButton);
  });

  it('inheritance: the exported task camera ids come from the task type and reference the animal', async () => {
    const user = userEvent.setup();
    const { animal } = renderStepper({ animal: CATALOG.animal, day: CATALOG.day });
    await goToEpochs(user);

    // The seeded instance resolves to its catalog type, whose camera_id (animal-level) flows to export.
    const sleep = readTasks().find((t) => t.task_name === 'sleep');
    const animalCameraIds = animal.cameras.map((c) => c.id);
    expect(sleep.camera_id.length).toBeGreaterThan(0);
    sleep.camera_id.forEach((id) => expect(animalCameraIds).toContain(id));
  });

  it('persistence: adding a task instance commits the day only; the animal catalog is untouched', async () => {
    const user = userEvent.setup();
    const { animal } = renderStepper({ animal: CATALOG.animal, day: CATALOG.day });
    const animalBefore = JSON.stringify(animal);
    await goToEpochs(user);
    const before = readTasks().length;

    // Pick the existing 'sleep' type, add an epoch, save.
    await user.click(screen.getByRole('button', { name: /add task/i }));
    await user.click(screen.getByRole('button', { name: /add epoch/i }));
    const epochInputs = screen.getAllByRole('spinbutton', { name: /epoch number/i });
    await user.type(epochInputs[epochInputs.length - 1], '7');
    await user.click(screen.getByRole('button', { name: /save task for this day/i }));

    expect(readTasks()).toHaveLength(before + 1);
    // Picking an EXISTING type writes only the day's taskInstances — the input animal isn't mutated.
    expect(JSON.stringify(animal)).toBe(animalBefore);
  });
});
