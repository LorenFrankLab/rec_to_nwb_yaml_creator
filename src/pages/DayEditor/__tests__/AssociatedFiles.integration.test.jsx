/**
 * Phase 7 review (HIGH): `orphaned_file` validation error routes to the Epochs
 * step but previously had NO associated-files editing UI — a dead-end that blocked
 * export. The Epochs step now renders an AssociatedFilesEditor so a loaded stale
 * `associated_files[].task_epochs` is visible ("Missing epoch N") and repairable by
 * re-pointing it; writes flow through onFieldUpdate('associated_files', …) →
 * updateDay. Also: deleting a task that an associated_file references names that
 * file in the delete confirmation (HIGH: silent file clearing).
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
 * Surfaces the day's associated_files as JSON for assertions.
 * @returns {JSX.Element}
 */
function FilesInspector() {
  const { model } = useStoreContext();
  const files = model.workspace?.days?.[DAY_ID]?.associated_files ?? [];
  return <div data-testid="files-json">{JSON.stringify(files)}</div>;
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
      <FilesInspector />
    </StoreProvider>
  );
  return { animal, day };
}

/**
 * Read the persisted associated_files.
 * @returns {Array}
 */
function readFiles() {
  return JSON.parse(screen.getByTestId('files-json').textContent);
}

/**
 * Navigate to the Epochs step (where the files editor lives).
 * @param {object} user userEvent instance.
 * @returns {Promise<void>}
 */
async function goToEpochs(user) {
  await user.click(screen.getByRole('button', { name: /Epochs/i }));
}

describe('Associated files editor (orphaned_file repair surface)', () => {
  beforeEach(() => {
    useDayIdFromUrl.mockReturnValue(DAY_ID);
    Element.prototype.scrollIntoView = vi.fn();
  });

  it('renders the associated-files editor in the Epochs step', async () => {
    const user = userEvent.setup();
    renderStepper();
    await goToEpochs(user);
    expect(screen.getByRole('region', { name: /associated files/i })).toBeInTheDocument();
  });

  it('shows a loaded stale file epoch as "Missing epoch 9" and repairs it by re-pointing', async () => {
    const user = userEvent.setup();
    // The fixture day has one task with task_epochs [1, 3]; epoch 9 is orphaned.
    renderStepper({
      day: {
        associated_files: [
          { name: 'stim_log', description: '', path: '', task_epochs: 9 },
        ],
      },
    });
    await goToEpochs(user);

    const region = screen.getByRole('region', { name: /associated files/i });
    // The stale value is shown (not blank) and flagged via role="alert".
    const epochSelect = within(region).getByLabelText(/task epoch/i);
    expect(within(epochSelect).getByRole('option', { name: /missing epoch 9/i })).toBeInTheDocument();
    expect(within(region).getByRole('alert')).toHaveTextContent(/epoch 9/i);

    // Re-point it to a valid epoch — the write goes through onFieldUpdate→updateDay.
    await user.selectOptions(epochSelect, '1');

    const files = readFiles();
    expect(files[0].task_epochs).toBe(1);
    expect(typeof files[0].task_epochs).toBe('number');
    // The orphan is repaired: the alert is gone.
    expect(within(region).queryByRole('alert')).toBeNull();
  });

  it('names the affected associated_file in the delete confirmation when its epoch would vanish', async () => {
    const user = userEvent.setup();
    // The single task owns epochs [1, 3]; a file references epoch 1, so deleting
    // the task orphans it. The confirmation must NAME that file (not just videos).
    renderStepper({
      day: {
        associated_files: [
          { name: 'stim_log', description: '', path: '', task_epochs: 1 },
        ],
      },
    });
    await goToEpochs(user);

    // Removing the instance orphans the file → the repair confirmation must NAME that file.
    await user.click(screen.getByRole('button', { name: /remove sleep from this day/i }));
    const dialog = screen.getByRole('alertdialog');
    expect(dialog).toHaveTextContent(/affected file/i);
    expect(dialog).toHaveTextContent(/stim_log/i);
  });
});
