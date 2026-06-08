/**
 * Picker lifecycle menu (Phase 4, Task 4.1). Each animal card in the picker carries a ⋮ overflow
 * menu (Open / Rename… / Delete animal…) so an animal can be opened or deleted from the same place
 * it is listed — and the destructive Delete is NOT a control flush against "+ New Animal" (a
 * misclick anti-pattern). Delete routes through the shared type-to-confirm AnimalDeleteDialog.
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

const remy = {
  id: 'remy',
  subject: { subject_id: 'remy', species: 'Rattus norvegicus', sex: 'M' },
  devices: { electrode_groups: [], ntrode_electrode_group_channel_map: [], data_acq_device: [] },
  cameras: [],
  configurationHistory: [],
  days: ['remy-2023-06-22'],
};
const totoro = {
  id: 'totoro',
  subject: { subject_id: 'totoro', species: 'Rattus norvegicus', sex: 'F' },
  devices: { electrode_groups: [], ntrode_electrode_group_channel_map: [], data_acq_device: [] },
  cameras: [],
  configurationHistory: [],
  days: [],
};
const days = {
  'remy-2023-06-22': { animalId: 'remy', date: '2023-06-22', session: { session_id: 'remy_20230622' }, state: { draft: true } },
};

/**
 * Render the picker seeded with remy + totoro.
 * @returns {object} render result
 */
function renderPicker() {
  return render(
    <StoreProvider initialState={{ workspace: { animals: { remy, totoro }, days, settings: {} } }}>
      <AnimalWorkspace />
    </StoreProvider>
  );
}

describe('AnimalWorkspace picker — per-animal ⋮ menu', () => {
  it('renders a per-animal actions menu with Open / Rename… / Delete animal…', async () => {
    const user = userEvent.setup();
    renderPicker();

    const trigger = screen.getByRole('button', { name: /actions for remy/i });
    expect(trigger).toHaveAttribute('aria-haspopup', 'menu');

    await user.click(trigger);
    const menu = screen.getByRole('menu');
    expect(within(menu).getByRole('menuitem', { name: /^open$/i })).toBeInTheDocument();
    expect(within(menu).getByRole('menuitem', { name: /delete animal/i })).toBeInTheDocument();
    // No dead "Rename…" placeholder (a permanently-disabled menu item is user friction).
    expect(within(menu).queryByRole('menuitem', { name: /rename/i })).not.toBeInTheDocument();
  });

  it('the card link still navigates to the animal days route (menu is a sibling, not nested)', () => {
    renderPicker();
    const card = screen.getByRole('link', { name: /remy/i });
    expect(card).toHaveAttribute('href', '#/animal/remy/days');
    // The ⋮ trigger is a button, NOT inside the navigation link.
    const trigger = screen.getByRole('button', { name: /actions for remy/i });
    expect(trigger.closest('a')).toBeNull();
  });

  it('Open navigates to the animal days route', async () => {
    const user = userEvent.setup();
    window.location.hash = '#/workspace';
    renderPicker();
    await user.click(screen.getByRole('button', { name: /actions for remy/i }));
    await user.click(screen.getByRole('menuitem', { name: /^open$/i }));
    expect(window.location.hash).toBe('#/animal/remy/days');
  });

  it('Delete animal… opens the type-to-confirm dialog and deletes on a matching confirm', async () => {
    const user = userEvent.setup();
    renderPicker();

    await user.click(screen.getByRole('button', { name: /actions for remy/i }));
    await user.click(screen.getByRole('menuitem', { name: /delete animal/i }));

    const dialog = screen.getByRole('alertdialog', { name: /delete animal/i });
    expect(within(dialog).getByText(/1 recording day/i)).toBeInTheDocument();

    // The gate: Delete is disabled until the id is typed exactly.
    const confirm = within(dialog).getByRole('button', { name: /^delete animal$/i });
    expect(confirm).toBeDisabled();
    await user.type(within(dialog).getByRole('textbox', { name: /type .* to confirm/i }), 'remy');
    expect(confirm).toBeEnabled();
    await user.click(confirm);

    // remy's card is gone; totoro remains.
    expect(screen.queryByRole('link', { name: /remy/i })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: /totoro/i })).toBeInTheDocument();
  });

  it('cancelling the delete dialog leaves the animal intact', async () => {
    const user = userEvent.setup();
    renderPicker();
    await user.click(screen.getByRole('button', { name: /actions for remy/i }));
    await user.click(screen.getByRole('menuitem', { name: /delete animal/i }));
    await user.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: /cancel/i }));

    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: /remy/i })).toBeInTheDocument();
  });
});
