/**
 * Animal Workspace lifecycle cleanup (Phase 8.7 Task 8 → Phase 4 Task 4.1). Ordinary users must
 * be able to discover SAFE animal/day deletion — the store already exposes guarded `deleteAnimal`
 * / `deleteDay`, but nothing surfaced them. As of Phase 4, animal delete lives in the AnimalView
 * header's ⋮ overflow menu (not a day-tab danger zone) and routes through the type-to-confirm
 * AnimalDeleteDialog; per-day delete keeps its plain in-row confirm. Confirmations still name the
 * animal/day, the cascade count, and the consequence — including that deleting local workspace
 * metadata does NOT delete an already-downloaded YAML / NWB / DANDI / Spyglass.
 */
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { StoreProvider } from '../../../state/StoreContext';
import { AnimalView } from '../../AnimalView';

const originalHash = window.location.hash;
afterEach(() => {
  window.location.hash = originalHash;
});

/**
 * Open the animal-delete dialog from the AnimalView header ⋮ menu.
 * @param {object} user - userEvent session.
 * @returns {Promise<HTMLElement>} the open alertdialog.
 */
async function openAnimalDeleteDialog(user) {
  await user.click(screen.getByRole('button', { name: /actions for remy/i }));
  await user.click(screen.getByRole('menuitem', { name: /delete animal/i }));
  return screen.getByRole('alertdialog');
}

/**
 * Render the tabbed animal view for one animal (Phase 1 — the delete actions live in the
 * extracted pane, now hosted by AnimalView, which also owns the post-delete "Animal not found"
 * fallback). Cross-animal survival (e.g. "totoro remains") is the store's concern, covered by
 * the deleteAnimal store tests — here we verify the UI triggers + confirm copy + fallback.
 * @param {string} animalId - The animal whose view to render.
 * @param {object} animals - workspace.animals
 * @param {object} [days] - workspace.days
 * @returns {object} render result
 */
function renderView(animalId, animals, days = {}) {
  return render(
    <StoreProvider initialState={{ workspace: { animals, days, settings: {} } }}>
      <AnimalView animalId={animalId} tab="days" />
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

describe('AnimalWorkspace lifecycle cleanup — Delete animal', () => {
  it('exposes a discoverable per-animal ⋮ menu in the header with a Delete animal action', async () => {
    const user = userEvent.setup();
    renderView('remy', { remy, totoro }, remyDays);

    const trigger = screen.getByRole('button', { name: /actions for remy/i });
    expect(trigger).toHaveAttribute('aria-haspopup', 'menu');
    // Destructive delete lives in the menu — NOT a primary control, and the old day-tab danger
    // zone is gone.
    expect(screen.queryByRole('button', { name: /delete this animal/i })).not.toBeInTheDocument();

    await user.click(trigger);
    expect(screen.getByRole('menuitem', { name: /delete animal/i })).toBeInTheDocument();
    // The header ⋮ omits a redundant "Open" (you are already viewing this animal) and the dead
    // "Rename…" placeholder — only the real lifecycle action remains.
    expect(screen.queryByRole('menuitem', { name: /^open$/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('menuitem', { name: /rename/i })).not.toBeInTheDocument();
  });

  it('confirms with the animal name and recording-day cascade count, then deletes (type-to-confirm)', async () => {
    const user = userEvent.setup();
    renderView('remy', { remy, totoro }, remyDays);

    const dialog = await openAnimalDeleteDialog(user);

    // A destructive confirm (alertdialog) names the animal + its 2 recording days.
    expect(within(dialog).getByText(/2 recording days/i)).toBeInTheDocument();

    // The gate: Delete is disabled until the id is typed exactly.
    const confirm = within(dialog).getByRole('button', { name: /^delete animal$/i });
    expect(confirm).toBeDisabled();
    await user.type(within(dialog).getByRole('textbox', { name: /type .* to confirm/i }), 'remy');
    await user.click(confirm);

    // Deleting the viewed animal navigates to the picker (the deliberate-delete success landing),
    // not the "Animal not found" 404-like state; its day rows are gone. (That deleting remy
    // preserves totoro is the store's guarantee, covered by the deleteAnimal store tests.)
    expect(window.location.hash).toBe('#/workspace');
    expect(screen.queryByText('2023-06-22')).not.toBeInTheDocument();
  });

  it('leaves the animal intact when the confirm is cancelled', async () => {
    const user = userEvent.setup();
    renderView('remy', { remy, totoro }, remyDays);

    const dialog = await openAnimalDeleteDialog(user);
    await user.click(within(dialog).getByRole('button', { name: /^cancel$/i }));

    // The animal is intact: still its days pane (not the "Animal not found" fallback).
    expect(screen.queryByRole('heading', { name: /animal not found/i })).not.toBeInTheDocument();
    expect(screen.getByText('2023-06-22')).toBeInTheDocument();
  });

  it('warns that deleting does not remove already-downloaded YAML / NWB / DANDI / Spyglass', async () => {
    const user = userEvent.setup();
    renderView('remy', { remy, totoro }, remyDays); // remy has an exported day

    const dialog = await openAnimalDeleteDialog(user);
    expect(within(dialog).getByText(/already downloaded|does not delete/i)).toBeInTheDocument();
    expect(within(dialog).getByText(/NWB|DANDI|Spyglass/i)).toBeInTheDocument();
  });
});

describe('AnimalWorkspace lifecycle cleanup — Delete recording day', () => {
  it('exposes a Delete recording day action on an ordinary day row and deletes on confirm', async () => {
    const user = userEvent.setup();
    renderView('remy', { remy }, remyDays);

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
    renderView('remy', { remy }, remyDays);

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
    renderView('remy', animals, days);

    const dialog = await openAnimalDeleteDialog(user);
    // Cascade count is the ONE owned day, not two.
    expect(within(dialog).getByText(/1 recording day/i)).toBeInTheDocument();
    // And the wrong-owner record is called out as preserved.
    expect(within(dialog).getByText(/preserved|belong/i)).toBeInTheDocument();
  });

  it('excludes recovered-unlinked records from the cascade count (the store leaves them) and notes they remain', async () => {
    const user = userEvent.setup();
    // remy's INDEX lists only the OK day; a second record belongs to remy but is NOT in the index
    // (recovered-unlinked). The store's deleteAnimal walks the index only, so it would NOT delete
    // that record — the confirmation must not count it as a deleted "recording day".
    const animals = {
      remy: { ...remy, days: ['remy-2023-06-22'] },
    };
    const days = {
      'remy-2023-06-22': remyDays['remy-2023-06-22'],
      'remy-2023-06-25': {
        animalId: 'remy',
        date: '2023-06-25',
        session: { session_id: 'remy_20230625' },
        state: { draft: true },
      },
    };
    renderView('remy', animals, days);

    const dialog = await openAnimalDeleteDialog(user);
    // Count is the ONE indexed (OK) day — NOT two.
    expect(within(dialog).getByText(/its 1 recording day/i)).toBeInTheDocument();
    expect(within(dialog).queryByText(/its 2 recording days/i)).not.toBeInTheDocument();
    // The surviving recovered record is disclosed, not silently left behind.
    expect(within(dialog).getByText(/recovered day record.*remain in the workspace/i)).toBeInTheDocument();
  });
});
