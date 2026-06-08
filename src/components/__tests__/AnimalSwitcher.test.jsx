/**
 * Tests for AnimalSwitcher — the top object-selector dropdown (Phase 4, Task 4.5 / decision 9).
 *
 * `Workspace ▸ <animal> ▾` is a DISCLOSURE popup (NOT a listbox, NOT a menu): the trigger is a
 * `button[aria-haspopup]` and the popup is a labelled `role="group"` whose rows each carry a PRIMARY
 * switch link (→ `#/animal/:id/days`, current animal `aria-current`) plus a SECONDARY ⋮ menubutton
 * (its own `role="menu"`: Open / Rename… / Delete animal…). A trailing "+ New animal…" button opens
 * the create panel. Keyboard: Esc closes + returns focus to the trigger; Up/Down rove between rows;
 * focus enters the popup on open. The nested ⋮ owns its own roving focus + Esc (OverflowMenu).
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import AnimalSwitcher from '../AnimalSwitcher';

const animals = {
  remy: { id: 'remy', subject: { subject_id: 'remy' }, days: ['remy-2023-06-22', 'remy-2023-06-23'] },
  totoro: { id: 'totoro', subject: { subject_id: 'totoro' }, days: ['totoro-2023-07-01'] },
};
const days = {
  'remy-2023-06-22': { animalId: 'remy', date: '2023-06-22' },
  'remy-2023-06-23': { animalId: 'remy', date: '2023-06-23' },
  'totoro-2023-07-01': { animalId: 'totoro', date: '2023-07-01' },
};

const originalHash = window.location.hash;
afterEach(() => {
  window.location.hash = originalHash;
});

/**
 * Render the switcher with remy current.
 * @param {object} [overrides] - Prop overrides.
 * @returns {{ onRequestDelete: Function, onRequestCreate: Function, user: object }}
 */
function renderSwitcher(overrides = {}) {
  const onRequestDelete = vi.fn();
  const onRequestCreate = vi.fn();
  const user = userEvent.setup();
  render(
    <AnimalSwitcher
      currentAnimalId="remy"
      animals={animals}
      days={days}
      onRequestDelete={onRequestDelete}
      onRequestCreate={onRequestCreate}
      {...overrides}
    />
  );
  return { onRequestDelete, onRequestCreate, user };
}

describe('AnimalSwitcher — trigger', () => {
  it('shows the current animal and a collapsed disclosure trigger', () => {
    renderSwitcher();
    const trigger = screen.getByRole('button', { name: /switch animal/i });
    expect(trigger).toHaveAttribute('aria-haspopup', 'true');
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
    expect(trigger).toHaveTextContent('remy');
    expect(screen.queryByRole('group', { name: /switch animal/i })).not.toBeInTheDocument();
  });

  it('opens a labelled disclosure region wired via aria-controls', async () => {
    const { user } = renderSwitcher();
    const trigger = screen.getByRole('button', { name: /switch animal/i });
    await user.click(trigger);
    const popup = screen.getByRole('group', { name: /switch animal/i });
    expect(trigger).toHaveAttribute('aria-expanded', 'true');
    expect(trigger).toHaveAttribute('aria-controls', popup.id);
  });
});

describe('AnimalSwitcher — rows', () => {
  it('lists every animal as a switch link to its days route, current marked aria-current, with a day count', async () => {
    const { user } = renderSwitcher();
    await user.click(screen.getByRole('button', { name: /switch animal/i }));
    const popup = screen.getByRole('group', { name: /switch animal/i });

    const remyLink = within(popup).getByRole('link', { name: /remy/i });
    expect(remyLink).toHaveAttribute('href', '#/animal/remy/days');
    expect(remyLink).toHaveAttribute('aria-current', 'true');

    const totoroLink = within(popup).getByRole('link', { name: /totoro/i });
    expect(totoroLink).toHaveAttribute('href', '#/animal/totoro/days');
    expect(totoroLink).not.toHaveAttribute('aria-current');

    // Day counts (information scent), aria-hidden visual cue.
    expect(within(popup).getByText(/2 days/i)).toBeInTheDocument();
    expect(within(popup).getByText(/1 day/i)).toBeInTheDocument();
  });

  it('moves focus into the popup onto the current animal on open', async () => {
    const { user } = renderSwitcher();
    await user.click(screen.getByRole('button', { name: /switch animal/i }));
    expect(screen.getByRole('link', { name: /remy/i })).toHaveFocus();
  });
});

describe('AnimalSwitcher — per-row ⋮ menu', () => {
  it('each row has a ⋮ menubutton with Open / Delete animal… (no dead Rename placeholder)', async () => {
    const { user } = renderSwitcher();
    await user.click(screen.getByRole('button', { name: /switch animal/i }));

    const totoroMenuBtn = screen.getByRole('button', { name: /totoro actions/i });
    expect(totoroMenuBtn).toHaveAttribute('aria-haspopup', 'menu');
    await user.click(totoroMenuBtn);

    const menu = screen.getByRole('menu', { name: /totoro actions/i });
    expect(within(menu).getByRole('menuitem', { name: /^open$/i })).toBeInTheDocument();
    expect(within(menu).getByRole('menuitem', { name: /delete animal/i })).toBeInTheDocument();
    // The disabled "Rename…" placeholder is gone — a permanently-dead menu item is user friction.
    expect(within(menu).queryByRole('menuitem', { name: /rename/i })).not.toBeInTheDocument();
  });

  it('row Delete animal… requests the delete for THAT animal and closes the popup', async () => {
    const { onRequestDelete, user } = renderSwitcher();
    await user.click(screen.getByRole('button', { name: /switch animal/i }));
    await user.click(screen.getByRole('button', { name: /totoro actions/i }));
    await user.click(screen.getByRole('menuitem', { name: /delete animal/i }));

    expect(onRequestDelete).toHaveBeenCalledWith('totoro');
    expect(screen.queryByRole('group', { name: /switch animal/i })).not.toBeInTheDocument();
  });
});

describe('AnimalSwitcher — new animal + dismissal', () => {
  it('"+ New animal…" requests create and closes the popup', async () => {
    const { onRequestCreate, user } = renderSwitcher();
    await user.click(screen.getByRole('button', { name: /switch animal/i }));
    await user.click(screen.getByRole('button', { name: /new animal/i }));
    expect(onRequestCreate).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('group', { name: /switch animal/i })).not.toBeInTheDocument();
  });

  it('Escape closes the popup and returns focus to the trigger', async () => {
    const { user } = renderSwitcher();
    const trigger = screen.getByRole('button', { name: /switch animal/i });
    await user.click(trigger);
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('group', { name: /switch animal/i })).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });

  it('ArrowDown/ArrowUp rove between the animal rows', async () => {
    const { user } = renderSwitcher();
    await user.click(screen.getByRole('button', { name: /switch animal/i }));
    // Opens focused on remy (current). Down → totoro, Down → wraps to the "+ New animal…" button.
    await user.keyboard('{ArrowDown}');
    expect(screen.getByRole('link', { name: /totoro/i })).toHaveFocus();
    await user.keyboard('{ArrowUp}');
    expect(screen.getByRole('link', { name: /remy/i })).toHaveFocus();
  });

  it('closes when clicking outside', async () => {
    const { user } = renderSwitcher();
    await user.click(screen.getByRole('button', { name: /switch animal/i }));
    expect(screen.getByRole('group', { name: /switch animal/i })).toBeInTheDocument();
    await user.click(document.body);
    expect(screen.queryByRole('group', { name: /switch animal/i })).not.toBeInTheDocument();
  });
});
