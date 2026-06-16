/**
 * Phase 6 Task 0c: destructive task / task-epoch edits must not silently orphan
 * associated_video_files (or associated_files). Deleting a task or a referenced
 * task epoch surfaces the affected rows and requires an explicit repair (clear /
 * re-point) or a deterministic cleanup BEFORE the orphan is left — the silent
 * useEpochCleanup scrub must not be the user's only signal here.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { StoreProvider, useStoreContext } from '../../../state/StoreContext';
import DayEditorFrame from '../DayEditorFrame';
import { useDayIdFromUrl } from '../../../hooks/useDayIdFromUrl';
import { mergeDayMetadata } from '../../../state/workspaceUtils';
import { makeAnimalWithCamerasAndDay } from './taskFixtures';

vi.mock('../../../hooks/useDayIdFromUrl', () => ({
  useDayIdFromUrl: vi.fn(),
}));

const DAY_ID = 'remy_20230622';
const ANIMAL_ID = 'remy';

/**
 * Surfaces the EXPORTED tasks (resolved from the task-type catalog or legacy inline tasks) + videos
 * as JSON for assertions — the export truth, regardless of which internal shape the day carries.
 * @returns {JSX.Element}
 */
function Inspector() {
  const { model } = useStoreContext();
  const animal = model.workspace?.animals?.[ANIMAL_ID];
  const d = model.workspace?.days?.[DAY_ID] ?? {};
  const exportedTasks = animal && d.id ? mergeDayMetadata(animal, d).tasks : [];
  return (
    <>
      <div data-testid="tasks-json">{JSON.stringify(exportedTasks)}</div>
      <div data-testid="videos-json">{JSON.stringify(d.associated_video_files ?? [])}</div>
    </>
  );
}

/**
 * Render the stepper for a day whose single task (epochs [1,3]) is referenced by
 * a video, so deleting the task or its epoch would orphan that video.
 * @returns {{animal: object, day: object}}
 */
function renderStepper() {
  const { animal, day } = makeAnimalWithCamerasAndDay({
    day: {
      associated_video_files: [
        { name: 'vid_epoch1', camera_id: 1, task_epochs: 1 },
      ],
    },
  });
  render(
    <StoreProvider
      initialState={{
        workspace: {
          animals: { [animal.id]: animal },
          days: { [day.id]: day },
          settings: {},
        },
      }}
    >
      <DayEditorFrame />
      <Inspector />
    </StoreProvider>
  );
  return { animal, day };
}

/**
 * @returns {Array} Current tasks.
 */
function readTasks() {
  return JSON.parse(screen.getByTestId('tasks-json').textContent);
}

/**
 * @returns {Array} Current videos.
 */
function readVideos() {
  return JSON.parse(screen.getByTestId('videos-json').textContent);
}

/**
 * Navigate to the Epochs step.
 * @param {object} user userEvent instance.
 * @returns {Promise<void>}
 */
async function goToEpochs(user) {
  await user.click(screen.getByRole('button', { name: /Epochs/i }));
}

describe('Repair-before-orphaning destructive edits (Task 0c)', () => {
  beforeEach(() => {
    useDayIdFromUrl.mockReturnValue(DAY_ID);
    Element.prototype.scrollIntoView = vi.fn();
  });

  it('shows affected videos and requires confirmation before removing a referenced task', async () => {
    const user = userEvent.setup();
    renderStepper();
    await goToEpochs(user);

    // Removing the instance would orphan the video → the repair prompt surfaces it.
    await user.click(screen.getByRole('button', { name: /remove sleep from this day/i }));
    const dialog = screen.getByRole('alertdialog');
    expect(dialog).toHaveTextContent(/vid_epoch1/);

    await user.click(within(dialog).getByRole('button', { name: /clear references/i }));

    // Task removed from the EXPORT AND the orphaned video reference was deterministically cleaned up.
    expect(readTasks()).toHaveLength(0);
    const videos = readVideos();
    const orphan = videos.find((v) => v.name === 'vid_epoch1');
    expect(orphan.task_epochs).toBe('');
  });

  it('cancelling the removal leaves the task and its video reference intact', async () => {
    const user = userEvent.setup();
    renderStepper();
    await goToEpochs(user);

    await user.click(screen.getByRole('button', { name: /remove sleep from this day/i }));
    const dialog = screen.getByRole('alertdialog');
    await user.click(within(dialog).getByRole('button', { name: /cancel/i }));

    expect(readTasks()).toHaveLength(1);
    expect(readVideos()[0].task_epochs).toBe(1);
  });

  it('shows affected videos and requires confirmation before removing a referenced epoch', async () => {
    const user = userEvent.setup();
    renderStepper();
    await goToEpochs(user);

    // Open the instance to edit its epochs.
    await user.click(screen.getByRole('button', { name: /edit sleep for this day/i }));
    const taskDialog = screen.getByRole('dialog');

    // Remove epoch row 1 (epoch number 1) — it is referenced by vid_epoch1.
    await user.click(
      within(taskDialog).getByRole('button', { name: /remove epoch row 1/i })
    );
    await user.click(within(taskDialog).getByRole('button', { name: /save task for this day/i }));

    // A repair prompt surfaces the affected video and requires action.
    const repair = await screen.findByRole('alertdialog');
    expect(repair).toHaveTextContent(/vid_epoch1/);
    // The copy must be accurate about what Confirm and Cancel actually do: Confirm saves the change
    // AND clears the orphaned video reference; Cancel discards THIS change (not just "keeps the
    // epoch") and leaves the video unchanged.
    expect(repair).toHaveTextContent(/sav\w+/i);
    expect(repair).toHaveTextContent(/discard\w*/i);
    expect(repair).not.toHaveTextContent(/keep the epoch/i);
    await user.click(within(repair).getByRole('button', { name: /clear|confirm|repair/i }));

    const videos = readVideos();
    const orphan = videos.find((v) => v.name === 'vid_epoch1');
    expect(orphan.task_epochs).toBe('');
  });
});
