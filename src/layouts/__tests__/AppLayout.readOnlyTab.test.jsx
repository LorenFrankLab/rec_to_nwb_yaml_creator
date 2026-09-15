/**
 * A read-only tab (another tab holds the writer lease) must not ACCEPT edits: every editing control
 * on the routed page is disabled, while the ownership banner (take over, download a backup) and
 * hash navigation stay usable.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render as rtlRender, screen, waitFor } from '@testing-library/react';
import { StoreProvider } from '../../state/StoreContext';
import { AppLayout } from '../AppLayout';
import { resetWriterLockForTests, WRITER_LEASE_KEY } from '../../state/writerLock';

vi.mock('../../pages/Home', () => ({ Home: () => <main id="main-content">Home</main> }));
vi.mock('../../pages/AnimalWorkspace', () => ({
  AnimalWorkspace: () => (
    <main id="main-content">
      <label htmlFor="weight">Weight</label>
      <input id="weight" />
      <button type="button">Add day</button>
      <a href="#/validation">Validation</a>
    </main>
  ),
}));
vi.mock('../../pages/DayEditor', () => ({ DayEditor: () => <main id="main-content">Day</main> }));
vi.mock('../../pages/ValidationSummary', () => ({ ValidationSummary: () => <main id="main-content">Validation</main> }));
vi.mock('../../pages/LegacyFormView', () => ({ LegacyFormView: () => <main id="main-content">Legacy</main> }));
vi.mock('../../pages/AnimalView', () => ({ AnimalView: () => <main id="main-content">Animal</main> }));

let originalLocation;
beforeEach(() => {
  resetWriterLockForTests();
  window.localStorage.clear();
  originalLocation = window.location;
  delete window.location;
  window.location = { hash: '#/workspace' };
});
afterEach(() => {
  window.location = originalLocation;
  resetWriterLockForTests();
});

describe('AppLayout — read-only tab', () => {
  it('disables the page’s editing controls but keeps take-over, backup download and links usable', async () => {
    window.localStorage.setItem(WRITER_LEASE_KEY, JSON.stringify({ writerId: 'other-tab', heartbeat: Date.now() }));
    rtlRender(<AppLayout />, {
      wrapper: ({ children }) => <StoreProvider initialState={{ workspace: { animals: {}, days: {}, settings: {} } }}>{children}</StoreProvider>,
    });
    await waitFor(() => expect(screen.getByText(/Another tab is editing this workspace/)).toBeInTheDocument());
    expect(screen.getByLabelText('Weight')).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Add day' })).toBeDisabled();
    expect(screen.getByRole('button', { name: /Edit in this tab instead/ })).toBeEnabled();
    expect(screen.getByRole('button', { name: /Download workspace backup/ })).toBeEnabled();
    expect(screen.getByRole('link', { name: 'Validation', hidden: false })).toBeInTheDocument();
  });

  it('the writer tab’s controls are enabled', async () => {
    rtlRender(<AppLayout />, {
      wrapper: ({ children }) => <StoreProvider initialState={{ workspace: { animals: {}, days: {}, settings: {} } }}>{children}</StoreProvider>,
    });
    await waitFor(() => expect(screen.queryByText(/Checking whether another tab/)).not.toBeInTheDocument());
    expect(screen.getByLabelText('Weight')).toBeEnabled();
  });
});
