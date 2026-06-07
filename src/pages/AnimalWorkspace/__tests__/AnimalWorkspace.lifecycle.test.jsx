/**
 * Animal Workspace lifecycle cleanup (Phase 8.7 Task 8). Ordinary users must be able to
 * discover SAFE animal/day deletion from the workspace — the store already exposes guarded
 * `deleteAnimal` / `deleteDay`, but nothing surfaced them. These actions must be secondary/
 * destructive (never adjacent to the primary setup/export action), and their confirmations
 * must name the animal/day, the cascade count, and the consequence — including that deleting
 * local workspace metadata does NOT delete an already-downloaded YAML / NWB / DANDI / Spyglass.
 */
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { StoreProvider } from '../../../state/StoreContext';
import { AnimalWorkspace } from '../index';

const originalHash = window.location.hash;
afterEach(() => {
  window.location.hash = originalHash;
});

/**
 * Render the workspace seeded with the given animals/days.
 * @param {object} animals - workspace.animals
 * @param {object} [days] - workspace.days
 * @returns {object} render result
 */
function renderWith(animals, days = {}) {
  return render(
    <StoreProvider initialState={{ workspace: { animals, days, settings: {} } }}>
      <AnimalWorkspace />
    </StoreProvider>
  );
}

/** A minimally-configured animal owning two OK days, one of them exported. */
const remyDays = {
  'remy-2023-06-22': {
    animalId: 'remy',
    date: '2023-06-22',
    session: { session_id: 'remy_20230622' },
    state: { draft: false, validated: true, exported: true },
  },
  'remy-2023-06-23': {
    animalId: 'remy',
    date: '2023-06-23',
    session: { session_id: 'remy_20230623' },
    state: { draft: true, validated: false, exported: false },
  },
};

const remy = {
  id: 'remy',
  subject: { subject_id: 'remy', species: 'Rattus norvegicus', sex: 'M' },
  devices: { electrode_groups: [], ntrode_electrode_group_channel_map: [], data_acq_device: [] },
  cameras: [],
  configurationHistory: [
    { version: 1, date: '2024-01-02', description: 'Initial', devices: { electrode_groups: [] }, appliedToDays: [] },
  ],
  days: ['remy-2023-06-22', 'remy-2023-06-23'],
};

const totoro = {
  id: 'totoro',
  subject: { subject_id: 'totoro', species: 'Rattus norvegicus', sex: 'F' },
  devices: { electrode_groups: [], ntrode_electrode_group_channel_map: [], data_acq_device: [] },
  cameras: [],
  configurationHistory: [
    { version: 1, date: '2024-01-02', description: 'Initial', devices: { electrode_groups: [] }, appliedToDays: [] },
  ],
  days: [],
};

/**
 * Select an animal by name in the sidebar.
 * @param {string} name - Animal id.
 */
async function selectAnimal(name) {
  await userEvent.click(screen.getByRole('button', { name: new RegExp(`^${name}`, 'i') }));
}

describe('AnimalWorkspace lifecycle cleanup — Delete animal', () => {
  it('exposes a discoverable, secondary Delete animal action for the selected animal', async () => {
    renderWith({ remy, totoro }, remyDays);
    await selectAnimal('remy');

    const deleteBtn = screen.getByRole('button', { name: /delete this animal/i });
    expect(deleteBtn).toBeInTheDocument();
    // Secondary/destructive — NOT the primary action, and not the same control as
    // "Add Recording Days" / "Edit Animal Setup".
    expect(deleteBtn).not.toHaveClass('btn-primary');
    expect(deleteBtn.textContent).not.toMatch(/add recording days|edit animal setup/i);
  });

  it('confirms with the animal name and recording-day cascade count, then deletes', async () => {
    const user = userEvent.setup();
    renderWith({ remy, totoro }, remyDays);
    await selectAnimal('remy');

    await user.click(screen.getByRole('button', { name: /delete this animal/i }));

    // A destructive confirm (alertdialog) names the animal + its 2 recording days.
    const dialog = screen.getByRole('alertdialog');
    expect(within(dialog).getByText(/remy/)).toBeInTheDocument();
    expect(within(dialog).getByText(/2 recording days/i)).toBeInTheDocument();

    await user.click(within(dialog).getByRole('button', { name: /^delete animal$/i }));

    // remy and its days are gone; totoro survives.
    expect(screen.queryByRole('button', { name: /^remy/i })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^totoro/i })).toBeInTheDocument();
    // Selection reset — the deleted animal is no longer shown as selected.
    expect(screen.queryByText('2023-06-22')).not.toBeInTheDocument();
  });

  it('leaves the animal intact when the confirm is cancelled', async () => {
    const user = userEvent.setup();
    renderWith({ remy, totoro }, remyDays);
    await selectAnimal('remy');

    await user.click(screen.getByRole('button', { name: /delete this animal/i }));
    await user.click(screen.getByRole('button', { name: /^cancel$/i }));

    expect(screen.getByRole('button', { name: /^remy/i })).toBeInTheDocument();
    expect(screen.getByText('2023-06-22')).toBeInTheDocument();
  });

  it('warns that deleting does not remove already-downloaded YAML / NWB / DANDI / Spyglass', async () => {
    const user = userEvent.setup();
    renderWith({ remy, totoro }, remyDays); // remy has an exported day
    await selectAnimal('remy');

    await user.click(screen.getByRole('button', { name: /delete this animal/i }));
    const dialog = screen.getByRole('alertdialog');
    expect(within(dialog).getByText(/already downloaded|does not delete/i)).toBeInTheDocument();
    expect(within(dialog).getByText(/NWB|DANDI|Spyglass/i)).toBeInTheDocument();
  });
});

describe('AnimalWorkspace lifecycle cleanup — Delete recording day', () => {
  it('exposes a Delete recording day action on an ordinary day row and deletes on confirm', async () => {
    const user = userEvent.setup();
    renderWith({ remy }, remyDays);
    await selectAnimal('remy');

    // The delete action is a real button, separate from the navigation link (not nested in it).
    const deleteDayBtn = screen.getByRole('button', { name: /delete recording day 2023-06-23/i });
    expect(deleteDayBtn).toBeInTheDocument();
    expect(deleteDayBtn.closest('a')).toBeNull();

    await user.click(deleteDayBtn);
    const dialog = screen.getByRole('alertdialog');
    expect(within(dialog).getByText(/2023-06-23/)).toBeInTheDocument();
    await user.click(within(dialog).getByRole('button', { name: /^delete day$/i }));

    // The deleted day is gone; the sibling day remains.
    expect(screen.queryByText('2023-06-23')).not.toBeInTheDocument();
    expect(screen.getByText('2023-06-22')).toBeInTheDocument();
  });

  it('warns downloaded files are not deleted when the day was exported', async () => {
    const user = userEvent.setup();
    renderWith({ remy }, remyDays);
    await selectAnimal('remy');

    await user.click(screen.getByRole('button', { name: /delete recording day 2023-06-22/i }));
    const dialog = screen.getByRole('alertdialog');
    expect(within(dialog).getByText(/already downloaded|does not delete/i)).toBeInTheDocument();
    expect(within(dialog).getByText(/NWB|DANDI|Spyglass/i)).toBeInTheDocument();
  });
});

describe('AnimalWorkspace lifecycle cleanup — wrong-owner preservation', () => {
  it('excludes wrong-owner day records from the cascade count and notes they are preserved', async () => {
    const user = userEvent.setup();
    // remy indexes a day whose record belongs to totoro (listed here by mistake).
    const animals = {
      remy: { ...remy, days: ['remy-2023-06-22', 'totoro-2023-07-01'] },
    };
    const days = {
      'remy-2023-06-22': remyDays['remy-2023-06-22'],
      'totoro-2023-07-01': {
        animalId: 'totoro',
        date: '2023-07-01',
        session: { session_id: 'totoro_20230701' },
        state: { draft: true },
      },
    };
    renderWith(animals, days);
    await selectAnimal('remy');

    await user.click(screen.getByRole('button', { name: /delete this animal/i }));
    const dialog = screen.getByRole('alertdialog');
    // Cascade count is the ONE owned day, not two.
    expect(within(dialog).getByText(/1 recording day/i)).toBeInTheDocument();
    // And the wrong-owner record is called out as preserved.
    expect(within(dialog).getByText(/preserved|belong/i)).toBeInTheDocument();
  });
});
