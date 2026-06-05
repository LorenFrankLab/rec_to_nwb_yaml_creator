/**
 * Phase 6 Task 0(b): the workspace associated-video editor writes
 * day.associated_video_files. camera_id is a SCALAR selected from existing
 * cameras; task_epochs is selected from the current day's task epoch set. There
 * is no manual numeric entry in the normal path, and a loaded video carrying a
 * stale id is flagged and cannot be left valid.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { StoreProvider, useStoreContext } from '../../../state/StoreContext';
import DayEditorStepper from '../DayEditorStepper';
import AssociatedVideosEditor from '../AssociatedVideosEditor';
import { useDayIdFromUrl } from '../../../hooks/useDayIdFromUrl';
import { makeAnimalWithCamerasAndDay } from './taskFixtures';

vi.mock('../../../hooks/useDayIdFromUrl', () => ({
  useDayIdFromUrl: vi.fn(),
}));

const DAY_ID = 'remy_20230622';

/**
 * Surfaces the day's associated_video_files as JSON for assertions.
 * @returns {JSX.Element}
 */
function VideosInspector() {
  const { model } = useStoreContext();
  const videos = model.workspace?.days?.[DAY_ID]?.associated_video_files ?? [];
  return <div data-testid="videos-json">{JSON.stringify(videos)}</div>;
}

/**
 * Render the stepper for the fixture day.
 * @param {object} [overrides] Fixture overrides.
 * @returns {{animal: object, day: object}}
 */
function renderStepper(overrides = {}) {
  const { animal, day } = makeAnimalWithCamerasAndDay(overrides);
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
      <DayEditorStepper />
      <VideosInspector />
    </StoreProvider>
  );
  return { animal, day };
}

/**
 * Read the persisted associated_video_files.
 * @returns {Array}
 */
function readVideos() {
  return JSON.parse(screen.getByTestId('videos-json').textContent);
}

/**
 * Navigate to the Epochs step (where the video editor lives).
 * @param {object} user userEvent instance.
 * @returns {Promise<void>}
 */
async function goToEpochs(user) {
  await user.click(screen.getByRole('button', { name: /Epochs/i }));
}

describe('Associated video files editor (Task 0b)', () => {
  beforeEach(() => {
    useDayIdFromUrl.mockReturnValue(DAY_ID);
    Element.prototype.scrollIntoView = vi.fn();
  });

  it('adds a video row with a scalar camera_id and an epoch from current tasks', async () => {
    const user = userEvent.setup();
    // The fixture day has one task with task_epochs [1, 3] and cameras 0, 1.
    renderStepper();
    await goToEpochs(user);

    const region = screen.getByRole('region', { name: /associated video/i });
    await user.click(within(region).getByRole('button', { name: /add video/i }));

    await user.type(
      within(region).getByRole('textbox', { name: /video name/i }),
      'overhead_epoch1'
    );

    // camera_id is a SELECT of existing cameras, label "id – camera_name".
    const cameraSelect = within(region).getByRole('combobox', { name: /camera/i });
    await user.selectOptions(cameraSelect, '1');

    // task_epochs is a SELECT built from the current day's task epoch set.
    const epochSelect = within(region).getByRole('combobox', { name: /epoch/i });
    // Only epochs 1 and 3 exist; there must be no option "2".
    expect(within(epochSelect).queryByRole('option', { name: '2' })).toBeNull();
    await user.selectOptions(epochSelect, '3');

    const videos = readVideos();
    expect(videos).toHaveLength(1);
    expect(videos[0].name).toBe('overhead_epoch1');
    expect(videos[0].camera_id).toBe(1);
    expect(typeof videos[0].camera_id).toBe('number');
    expect(videos[0].task_epochs).toBe(3);
    expect(typeof videos[0].task_epochs).toBe('number');
  });

  it('offers no manual numeric entry for camera_id or task_epochs in the normal path', async () => {
    const user = userEvent.setup();
    renderStepper();
    await goToEpochs(user);

    const region = screen.getByRole('region', { name: /associated video/i });
    await user.click(within(region).getByRole('button', { name: /add video/i }));

    // camera/epoch controls are SELECTs (comboboxes), never number spinbuttons.
    expect(within(region).getByRole('combobox', { name: /camera/i }).tagName).toBe('SELECT');
    expect(within(region).getByRole('combobox', { name: /epoch/i }).tagName).toBe('SELECT');
    expect(
      within(region).queryByRole('spinbutton', { name: /camera|epoch/i })
    ).toBeNull();
  });

  it('flags a loaded video with a stale camera/epoch id and blocks it being considered valid', async () => {
    const user = userEvent.setup();
    // Day loaded with a stale camera id (5, not in animal cameras) and stale epoch (9).
    renderStepper({
      day: {
        associated_video_files: [
          { name: 'stale_vid', camera_id: 5, task_epochs: 9 },
        ],
      },
    });
    await goToEpochs(user);

    const region = screen.getByRole('region', { name: /associated video/i });
    // The stale reference is flagged for the user to fix.
    expect(within(region).getByRole('alert')).toHaveTextContent(/stale_vid|fix|invalid|stale/i);

    // Repointing to a valid camera + epoch clears the flag and persists a valid row.
    const cameraSelect = within(region).getByRole('combobox', { name: /camera/i });
    await user.selectOptions(cameraSelect, '0');
    const epochSelect = within(region).getByRole('combobox', { name: /epoch/i });
    await user.selectOptions(epochSelect, '1');

    const videos = readVideos();
    expect(videos[0].camera_id).toBe(0);
    expect(videos[0].task_epochs).toBe(1);
  });

  it('removes a video row through the editor', async () => {
    const user = userEvent.setup();
    renderStepper({
      day: {
        associated_video_files: [{ name: 'vid', camera_id: 0, task_epochs: 1 }],
      },
    });
    await goToEpochs(user);

    const region = screen.getByRole('region', { name: /associated video/i });
    await user.click(within(region).getByRole('button', { name: /remove video/i }));
    expect(readVideos()).toHaveLength(0);
  });

  it('names the specific stale camera value in the error', async () => {
    const user = userEvent.setup();
    // Stale camera id 5 (not defined on this day). NB: a stale task_epochs is
    // silently scrubbed by the useEpochCleanup backstop on load, so only the
    // camera reference survives to be flagged here; the stale-epoch wording is
    // covered by the component-level test below.
    renderStepper({
      day: {
        associated_video_files: [
          { name: 'stale_vid', camera_id: 5, task_epochs: 1 },
        ],
      },
    });
    await goToEpochs(user);

    const region = screen.getByRole('region', { name: /associated video/i });
    const alert = within(region).getByRole('alert');
    // The exact stale value is named, not a generic "no longer exists".
    expect(alert).toHaveTextContent(/camera id 5|camera 5/i);
  });

  it('names the specific stale epoch value in the error (component-level)', () => {
    render(
      <AssociatedVideosEditor
        videos={[{ name: 'stale_vid', camera_id: 0, task_epochs: 9 }]}
        cameras={[{ id: 0, camera_name: 'overhead' }]}
        tasks={[{ task_epochs: [1, 3] }]}
        onChange={() => {}}
      />
    );
    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent(/epoch 9/i);
  });

  it('renders a stale epoch as a visible "Missing epoch N" option, not a blank select', () => {
    // Load-Time Orphan Visibility: the dropdown must SHOW the stale value (9), so
    // the user sees what they entered and can re-point it — never silently blank.
    render(
      <AssociatedVideosEditor
        videos={[{ name: 'stale_vid', camera_id: 0, task_epochs: 9 }]}
        cameras={[{ id: 0, camera_name: 'overhead' }]}
        tasks={[{ task_epochs: [1, 3] }]}
        onChange={() => {}}
      />
    );
    const epochSelect = screen.getByLabelText(/task epoch/i);
    // The stale value is the selected, visible option (an invalid/disabled choice).
    const staleOption = within(epochSelect).getByRole('option', { name: /missing epoch 9/i });
    expect(staleOption).toBeInTheDocument();
    expect(epochSelect).toHaveValue('9');
  });

  it('shows an empty-state note for the camera select when the animal has no cameras', async () => {
    const user = userEvent.setup();
    renderStepper({ animal: { cameras: [] } });
    await goToEpochs(user);

    const region = screen.getByRole('region', { name: /associated video/i });
    await user.click(within(region).getByRole('button', { name: /add video/i }));
    expect(within(region).getByText(/no cameras are defined/i)).toBeInTheDocument();
  });

  it('shows an empty-state note for the epoch select when no task epochs are defined', async () => {
    const user = userEvent.setup();
    renderStepper({ day: { tasks: [] } });
    await goToEpochs(user);

    const region = screen.getByRole('region', { name: /associated video/i });
    await user.click(within(region).getByRole('button', { name: /add video/i }));
    expect(within(region).getByText(/no task epochs/i)).toBeInTheDocument();
  });

  it('marks the video name field as required and shows an example filename placeholder', async () => {
    const user = userEvent.setup();
    renderStepper();
    await goToEpochs(user);

    const region = screen.getByRole('region', { name: /associated video/i });
    await user.click(within(region).getByRole('button', { name: /add video/i }));

    const nameInput = within(region).getByRole('textbox', { name: /video name/i });
    expect(nameInput).toBeRequired();
    expect(nameInput).toHaveAttribute('placeholder', expect.stringMatching(/\.h264$/i));
  });
});
