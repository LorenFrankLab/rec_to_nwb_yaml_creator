/**
 * RecoveryReview component tests (epoch-editor Phase 8).
 *
 * The recovery screen renders the EXISTING day-recovery classification and dispatches the EXISTING
 * repair commands. These tests pin the screen behavior:
 *   - every needs-review record (dangling / recovered-unlinked / wrong-owner / orphan) is shown, and
 *     the orphan (which has no in-app repair) still surfaces its message — nothing silently dropped;
 *   - a constructive repair (re-link) runs immediately and the resolved row drops out;
 *   - the destructive repair (remove a dangling reference) is gated by a confirm — Cancel does NOT
 *     dispatch, Confirm does;
 *   - a clean workspace shows the all-clear state;
 *   - a structurally-recovered load surfaces the auto-recovered FYI notice.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { StoreProvider } from '../../../state/StoreContext';
import { WORKSPACE_STORAGE_KEY, WORKSPACE_SCHEMA_VERSION } from '../../../state/persistence';
import { RecoveryReview } from '../index';

/** A workspace exercising every non-ok recovery class plus one ordinary ok day. */
function recoveryWorkspace() {
  return {
    settings: {},
    animals: {
      bean: { id: 'bean', subject: { subject_id: 'bean' }, days: ['bean-shared'] },
      okboy: { id: 'okboy', subject: { subject_id: 'okboy' }, days: ['okboy-d1'] },
      remy: { id: 'remy', subject: { subject_id: 'remy' }, days: ['remy-missing'] },
      wilbur: { id: 'wilbur', subject: { subject_id: 'wilbur' }, days: [] },
    },
    days: {
      'bean-shared': { id: 'bean-shared', animalId: 'cleo', date: '2023-06-24' },
      'okboy-d1': { id: 'okboy-d1', animalId: 'okboy', date: '2023-06-22' },
      'wilbur-unlinked': { id: 'wilbur-unlinked', animalId: 'wilbur', date: '2023-06-25' },
      'ghost-day': { id: 'ghost-day', animalId: 'nobody', date: '2023-06-26' },
    },
  };
}

const renderWith = (workspace) =>
  render(
    <StoreProvider initialState={{ workspace }}>
      <RecoveryReview />
    </StoreProvider>
  );

beforeEach(() => window.localStorage.clear());
afterEach(() => window.localStorage.clear());

describe('RecoveryReview', () => {
  it('renders every needs-review record, and the orphan still surfaces its message', () => {
    renderWith(recoveryWorkspace());

    expect(screen.getByRole('heading', { name: /review recovered data/i })).toBeInTheDocument();
    // The four non-ok classes are each surfaced.
    expect(screen.getByText(/missing record/i)).toBeInTheDocument();
    expect(screen.getByText(/not in day list/i)).toBeInTheDocument();
    expect(screen.getByText(/belongs to cleo/i)).toBeInTheDocument();
    // Orphan has no repair button but is NOT dropped — its title + message are shown ("no owning
    // animal" appears in both, so assert the unique re-create guidance).
    expect(screen.getByText(/re-create the animal or re-import/i)).toBeInTheDocument();
    // The count badge reflects the four needs-review rows.
    expect(screen.getByText('4')).toBeInTheDocument();
    // The ordinary ok day is never surfaced here.
    expect(screen.queryByText(/okboy-d1/)).not.toBeInTheDocument();
  });

  it('runs a constructive re-link immediately and drops the resolved row', async () => {
    const user = userEvent.setup();
    renderWith(recoveryWorkspace());

    expect(screen.getByText(/not in day list/i)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /add to day list/i }));

    // Re-linked → reclassified to ok → no longer a needs-review row.
    expect(screen.queryByText(/not in day list/i)).not.toBeInTheDocument();
    // The other rows remain.
    expect(screen.getByText(/missing record/i)).toBeInTheDocument();
  });

  it('gates the destructive remove behind a confirm — Cancel does not dispatch', async () => {
    const user = userEvent.setup();
    renderWith(recoveryWorkspace());

    await user.click(screen.getByRole('button', { name: /remove day reference/i }));
    // A confirm dialog appears…
    const dialog = screen.getByRole('alertdialog');
    expect(within(dialog).getByText(/can't be undone/i)).toBeInTheDocument();

    // …Cancel leaves the dangling row intact (not dispatched).
    await user.click(within(dialog).getByRole('button', { name: /cancel/i }));
    expect(screen.getByText(/missing record/i)).toBeInTheDocument();
  });

  it('dispatches the destructive remove only after confirming', async () => {
    const user = userEvent.setup();
    renderWith(recoveryWorkspace());

    await user.click(screen.getByRole('button', { name: /remove day reference/i }));
    const dialog = screen.getByRole('alertdialog');
    await user.click(within(dialog).getByRole('button', { name: /remove reference/i }));

    // The dangling reference is gone (its index entry + leftover were removed).
    expect(screen.queryByText(/missing record/i)).not.toBeInTheDocument();
  });

  it('shows the all-clear state for a clean workspace', () => {
    renderWith({ settings: {}, animals: {}, days: {} });
    expect(screen.getByText(/nothing to review/i)).toBeInTheDocument();
    expect(screen.getByText(/no recovered day records need attention/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /back to animals/i })).toHaveAttribute(
      'href',
      '#/workspace'
    );
  });

  it('surfaces the auto-recovered FYI notice from a structurally-recovered load', async () => {
    // Seed a blob missing a required section so loadWorkspace returns a `recovered` notice.
    window.localStorage.setItem(
      WORKSPACE_STORAGE_KEY,
      JSON.stringify({ schemaVersion: WORKSPACE_SCHEMA_VERSION, workspace: { animals: {}, days: {} } })
    );
    // Mount WITHOUT initialState so the load-on-init recovery path runs.
    render(
      <StoreProvider>
        <RecoveryReview />
      </StoreProvider>
    );
    expect(await screen.findByText(/missing required sections/i)).toBeInTheDocument();
    expect(screen.getByText(/nothing was discarded/i)).toBeInTheDocument();
    expect(screen.getByText(/every recovered record is in good shape/i)).toBeInTheDocument();
  });

  it('is honest when a saved workspace was discarded and no recovered records exist', async () => {
    window.localStorage.setItem(WORKSPACE_STORAGE_KEY, '{not valid json');

    render(
      <StoreProvider>
        <RecoveryReview />
      </StoreProvider>
    );

    expect(await screen.findByText(/could not be restored and was discarded/i)).toBeInTheDocument();
    expect(screen.getByText(/Saved workspace data could not be restored/i)).toBeInTheDocument();
    expect(screen.queryByText(/nothing was discarded/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/every recovered record is in good shape/i)).not.toBeInTheDocument();
    expect(
      screen.getByText(/because the unusable saved workspace was discarded/i)
    ).toBeInTheDocument();
  });
});
