/**
 * Animal Workspace lifecycle cleanup (Phase 8.7 Task 8 → Phase 4 Task 4.1). Ordinary users must
 * be able to discover SAFE animal/day deletion — the store already exposes guarded `deleteAnimal`
 * / `deleteDay`, but nothing surfaced them. As of Phase 4, animal delete lives in the AnimalView
 * header's ⋮ overflow menu (not a day-tab danger zone) and routes through the type-to-confirm
 * AnimalDeleteDialog. As of Phase 2 (epoch-editor), per-day delete is undo-able (the per-row ⋯ menu
 * deletes immediately + offers Undo) rather than a hard confirm — undo for the frequent reversible
 * action, confirm for the catastrophic one. The animal-delete confirm still names the animal, the
 * cascade count, and the consequence — that deleting local metadata does NOT delete an
 * already-downloaded YAML / NWB / DANDI / Spyglass.
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
  // Phase 2 (epoch-editor): per-day delete is the FREQUENT, reversible action — it deletes immediately
  // via the per-row ⋯ menu and offers Undo (Phase-0 UndoToast), rather than the old hard confirm dialog
  // with a cascade preview. The catastrophic animal delete keeps its type-to-confirm (the describe
  // above). The downloaded-artifacts caveat now lives on the animal-delete dialog (covered above).
  it('deletes a day from the per-row ⋯ menu and offers Undo (no hard confirm dialog)', async () => {
    const user = userEvent.setup();
    renderView('remy', { remy }, remyDays);

    await user.click(screen.getByRole('button', { name: /actions for 2023-06-23/i }));
    await user.click(screen.getByRole('menuitem', { name: /delete day/i }));

    // No alertdialog — the reversible delete fires immediately and shows an Undo toast (the toast's
    // Undo button is the unambiguous handle; the AnimalView SaveIndicator is also a role=status).
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    expect(screen.getByText(/deleted 1 recording day/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /undo/i })).toBeInTheDocument();

    // The deleted day is gone; the sibling day remains.
    expect(screen.queryByRole('link', { name: /^2023-06-23$/ })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: /^2023-06-22$/ })).toBeInTheDocument();
  });

  it('Undo re-creates the deleted day', async () => {
    const user = userEvent.setup();
    renderView('remy', { remy }, remyDays);

    await user.click(screen.getByRole('button', { name: /actions for 2023-06-23/i }));
    await user.click(screen.getByRole('menuitem', { name: /delete day/i }));
    expect(screen.queryByRole('link', { name: /^2023-06-23$/ })).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /undo/i }));

    // The day is back in the list.
    expect(screen.getByRole('link', { name: /^2023-06-23$/ })).toBeInTheDocument();
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
