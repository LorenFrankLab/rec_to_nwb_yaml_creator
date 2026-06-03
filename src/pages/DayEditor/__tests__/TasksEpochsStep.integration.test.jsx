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
import { makeAnimalWithCamerasAndDay } from './taskFixtures';

vi.mock('../../../hooks/useDayIdFromUrl', () => ({
  useDayIdFromUrl: vi.fn(),
}));

const DAY_ID = 'remy_20230622';

/**
 * Renders the current day's tasks as JSON so tests can read store state.
 * @returns {JSX.Element} A hidden element carrying the serialized tasks.
 */
function TasksInspector() {
  const { model } = useStoreContext();
  const tasks = model.workspace?.days?.[DAY_ID]?.tasks ?? [];
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

  it('inheritance: shows the animal cameras and behavioral events, and saves camera ids that reference the animal', async () => {
    const user = userEvent.setup();
    const { animal } = renderStepper();
    await goToEpochs(user);

    await user.click(screen.getByRole('button', { name: /add.*task/i }));
    const dialog = screen.getByRole('dialog');

    // Inherited cameras appear as task options.
    const cameraSummary = within(dialog).getByText('Cameras', { selector: 'summary' });
    const cameraSection = cameraSummary.closest('details');
    animal.cameras.forEach((camera) => {
      expect(
        within(cameraSection).getByRole('checkbox', {
          name: new RegExp(`${camera.id}.*${camera.camera_name}`, 'i'),
        })
      ).toBeInTheDocument();
    });

    // Inherited behavioral events appear (read-only).
    animal.behavioral_events.forEach((event) => {
      expect(within(dialog).getByText(event.name)).toBeInTheDocument();
    });

    // Select the first animal camera and save.
    await user.type(within(dialog).getByRole('textbox', { name: /task name/i }), 'newtask');
    await user.type(within(dialog).getByRole('textbox', { name: /task environment/i }), 'Env');
    const firstCamera = animal.cameras[0];
    await user.click(
      within(cameraSection).getByRole('checkbox', {
        name: new RegExp(`${firstCamera.id}.*${firstCamera.camera_name}`, 'i'),
      })
    );
    await user.click(within(dialog).getByRole('button', { name: /save task/i }));

    const tasks = readTasks();
    const saved = tasks.find((t) => t.task_name === 'newtask');
    const animalCameraIds = animal.cameras.map((c) => c.id);
    expect(saved.camera_id).toContain(firstCamera.id);
    saved.camera_id.forEach((id) => expect(animalCameraIds).toContain(id));
  });

  it('persistence: a saved task is committed through updateDay and the animal data is untouched', async () => {
    const user = userEvent.setup();
    const { animal, day } = renderStepper();
    const originalTaskCount = day.tasks.length;
    const animalCamerasBefore = JSON.stringify(animal.cameras);
    await goToEpochs(user);

    await user.click(screen.getByRole('button', { name: /add.*task/i }));
    const dialog = screen.getByRole('dialog');
    await user.type(within(dialog).getByRole('textbox', { name: /task name/i }), 'persisted');
    await user.type(within(dialog).getByRole('textbox', { name: /task environment/i }), 'Env');
    await user.click(within(dialog).getByRole('button', { name: /save task/i }));

    const tasks = readTasks();
    expect(tasks).toHaveLength(originalTaskCount + 1);
    expect(tasks.some((t) => t.task_name === 'persisted')).toBe(true);
    // Animal-level inherited data is not mutated by saving a day task.
    expect(JSON.stringify(animal.cameras)).toBe(animalCamerasBefore);
  });
});
