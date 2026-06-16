/**
 * Integration tests for the global keyboard shortcuts and the shortcuts-help dialog,
 * exercising the full chain (AppLayout hook → stepper event bridge → active stepper).
 */
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, fireEvent, act, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { App } from '../../App';
import { StoreProvider } from '../../state/StoreContext';
import { makeConfiguredWorkspace } from '../helpers/test-fixtures';

const workspace = makeConfiguredWorkspace();
const DAY_ID = 'remy-2023-06-22';

/**
 * Render <App/> seeded with the configured workspace at the given hash route.
 *
 * @param {string} hash - The hash route (e.g. '#/home').
 * @returns {Promise<import('@testing-library/react').RenderResult>}
 */
async function renderRoute(hash) {
  window.location.hash = hash;
  const view = render(
    <StoreProvider initialState={{ workspace }}>
      <App />
    </StoreProvider>
  );
  await act(async () => {
    window.dispatchEvent(new HashChangeEvent('hashchange'));
    await Promise.resolve();
  });
  return view;
}

afterEach(() => {
  cleanup();
  window.location.hash = '';
  document.body.style.overflow = '';
});

describe('global shortcuts + help (integration)', () => {
  it('? opens the shortcuts help and Esc closes it; the header trigger has an accessible name', async () => {
    await renderRoute('#/home');

    // Header trigger is discoverable and named.
    expect(screen.getByRole('button', { name: /keyboard shortcuts/i })).toBeInTheDocument();

    // ? opens the help dialog.
    fireEvent.keyDown(document.body, { key: '?' });
    const dialog = await screen.findByRole('dialog', { name: /keyboard shortcuts/i });
    expect(dialog).toBeInTheDocument();

    // Esc closes it (owned by the shared Modal).
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('dialog', { name: /keyboard shortcuts/i })).not.toBeInTheDocument();
  });

  it('Alt+ArrowRight / Alt+ArrowLeft move the DayEditor tabs', async () => {
    await renderRoute(`#/day/${DAY_ID}`);
    await screen.findByRole('heading', { name: /session metadata/i }); // the Day tab is active

    // Advance to the Epochs tab.
    fireEvent.keyDown(document.body, { key: 'ArrowRight', altKey: true });
    expect(await screen.findByRole('heading', { name: /^Epochs$/i })).toBeInTheDocument();

    // Retreat back to the Day tab.
    fireEvent.keyDown(document.body, { key: 'ArrowLeft', altKey: true });
    expect(await screen.findByRole('heading', { name: /session metadata/i })).toBeInTheDocument();
  });

  it('Alt+N opens the epoch template menu on the Epochs tab', async () => {
    const user = userEvent.setup();
    await renderRoute(`#/day/${DAY_ID}`);
    await screen.findByRole('heading', { name: /day editor/i });

    // Go to the Epochs tab.
    await user.click(screen.getByRole('button', { name: /^Epochs$/i }));
    await screen.findByRole('heading', { name: /^Epochs$/i });

    // Alt+N opens the grid's add affordance — the "+ from template" menu.
    fireEvent.keyDown(document.body, { key: 'n', altKey: true });
    expect(await screen.findByRole('menuitem', { name: /Sleep day/i })).toBeInTheDocument();
  });

  it('Alt+N is a no-op on a step with no add target (Overview)', async () => {
    await renderRoute(`#/day/${DAY_ID}`);
    await screen.findByRole('heading', { name: /session metadata/i });

    fireEvent.keyDown(document.body, { key: 'n', altKey: true });
    await act(async () => { await Promise.resolve(); });
    // No dialog appears and the view is unchanged.
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /session metadata/i })).toBeInTheDocument();
  });

  it('further shortcuts are ignored while the help dialog is open', async () => {
    await renderRoute(`#/day/${DAY_ID}`);
    await screen.findByRole('heading', { name: /session metadata/i });

    fireEvent.keyDown(document.body, { key: '?' });
    expect(await screen.findByRole('dialog', { name: /keyboard shortcuts/i })).toBeInTheDocument();

    // With a modal open, Alt+N must not open another dialog and Alt+Arrow must not
    // navigate the stepper underneath.
    fireEvent.keyDown(document.body, { key: 'n', altKey: true });
    fireEvent.keyDown(document.body, { key: 'ArrowRight', altKey: true });
    await act(async () => { await Promise.resolve(); });
    expect(screen.getAllByRole('dialog')).toHaveLength(1);
    expect(screen.getByRole('dialog', { name: /keyboard shortcuts/i })).toBeInTheDocument();
  });

  // The AnimalEditor stepper (and its Alt+N / Alt+Arrow step shortcuts) was removed in Phase 5;
  // the tabbed Animal View uses section-nav links + per-section add buttons, not stepper shortcuts.
  // The Day Editor stepper shortcuts above remain the live stepper-shortcut surface.
});
