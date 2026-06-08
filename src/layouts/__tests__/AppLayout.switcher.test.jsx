/**
 * Tests for the top object-selector (AnimalSwitcher) mounted in AppLayout chrome (Phase 4, Task 4.5).
 *
 * The switcher renders in the primary nav ONLY on the animal-view route (`#/animal/:id/:tab`), where
 * there is a "current animal" to switch from. Its lifecycle actions are delegated UP to AppLayout,
 * which hosts the single shared AnimalDeleteDialog (per-row Delete → actions.deleteAnimal) and routes
 * "+ New animal…" to the workspace's inline create panel via `#/workspace?create=1`.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render as rtlRender, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { StoreProvider } from '../../state/StoreContext';
import { AppLayout } from '../AppLayout';

// Light page mocks so this test exercises the chrome (switcher + delete host), not the heavy pages.
vi.mock('../../pages/Home', () => ({ Home: () => <main id="main-content">Home</main> }));
vi.mock('../../pages/AnimalWorkspace', () => ({
  AnimalWorkspace: () => <main id="main-content" data-testid="workspace-view">Workspace</main>,
}));
vi.mock('../../pages/DayEditor', () => ({ DayEditor: () => <main id="main-content">Day</main> }));
vi.mock('../../pages/ValidationSummary', () => ({
  ValidationSummary: () => <main id="main-content">Validation</main>,
}));
vi.mock('../../pages/LegacyFormView', () => ({ LegacyFormView: () => <main id="main-content">Legacy</main> }));
vi.mock('../../pages/AnimalEditor', () => ({ default: () => <main id="main-content">Editor</main> }));
vi.mock('../../pages/AnimalView', () => ({
  AnimalView: ({ animalId }) => <main id="main-content" data-testid="animal-view">Animal {animalId}</main>,
}));

const animals = {
  remy: { id: 'remy', subject: { subject_id: 'remy' }, days: ['remy-2023-06-22'] },
  totoro: { id: 'totoro', subject: { subject_id: 'totoro' }, days: [] },
};
const days = { 'remy-2023-06-22': { animalId: 'remy', date: '2023-06-22' } };

const seeded = { workspace: { animals, days, settings: {} } };

/**
 * Render AppLayout at the given hash with a seeded store.
 * @param {string} hash - The location hash.
 * @returns {object} render result
 */
function renderAt(hash) {
  window.location.hash = hash;
  return rtlRender(<AppLayout />, {
    wrapper: ({ children }) => <StoreProvider initialState={seeded}>{children}</StoreProvider>,
  });
}

let originalLocation;
beforeEach(() => {
  originalLocation = window.location;
  delete window.location;
  window.location = { hash: '#/' };
});
afterEach(() => {
  window.location = originalLocation;
});

describe('AppLayout — animal switcher placement', () => {
  it('renders the switcher (current animal) on the animal-view route', () => {
    renderAt('#/animal/remy/days');
    const trigger = screen.getByRole('button', { name: /switch animal/i });
    expect(trigger).toHaveTextContent('remy');
  });

  it('does NOT render the switcher on the workspace route', () => {
    renderAt('#/workspace');
    expect(screen.queryByRole('button', { name: /switch animal/i })).not.toBeInTheDocument();
    // The plain Workspace / Validation & Export nav is still there.
    expect(screen.getByRole('link', { name: /^workspace$/i })).toBeInTheDocument();
  });
});

describe('AppLayout — switcher lifecycle wiring', () => {
  it('a row Delete opens the shared type-to-confirm dialog hosted by AppLayout', async () => {
    const user = userEvent.setup();
    renderAt('#/animal/remy/days');

    await user.click(screen.getByRole('button', { name: /switch animal/i }));
    await user.click(screen.getByRole('button', { name: /totoro actions/i }));
    await user.click(screen.getByRole('menuitem', { name: /delete animal/i }));

    // The shared AnimalDeleteDialog (type-to-confirm) is now open for totoro.
    const dialog = screen.getByRole('alertdialog', { name: /delete animal/i });
    const confirm = within(dialog).getByRole('button', { name: /^delete animal$/i });
    expect(confirm).toBeDisabled();
    await user.type(within(dialog).getByRole('textbox', { name: /type .* to confirm/i }), 'totoro');
    await user.click(confirm);

    // totoro is gone: re-open the switcher and it's no longer listed (remy remains).
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /switch animal/i }));
    expect(screen.queryByRole('button', { name: /totoro actions/i })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /remy actions/i })).toBeInTheDocument();
  });

  it('"+ New animal…" routes to the workspace create handshake (#/workspace?create=1)', async () => {
    const user = userEvent.setup();
    renderAt('#/animal/remy/days');
    await user.click(screen.getByRole('button', { name: /switch animal/i }));
    await user.click(screen.getByRole('button', { name: /new animal/i }));
    expect(window.location.hash).toBe('#/workspace?create=1');
  });
});
