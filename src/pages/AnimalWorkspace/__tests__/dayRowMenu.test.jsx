/**
 * Per-day ⋯ overflow menu on the Recording Days table (Phase 2 — epoch-editor).
 *
 * Each OK row carries a ⋯ menu (the shared {@link OverflowMenu}) with Open / Duplicate day / Export
 * this day / Delete day — the per-row sibling of the bulk bar. It reuses the existing commands/actions:
 * Open navigates, Duplicate opens the single-date picker (→ `duplicateDay`), Export this day uses the
 * SAME single-day export path the bulk bar uses, and Delete uses the same undo toast.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within, act, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { StoreProvider, useStoreContext } from '../../../state/StoreContext';
import { RecordingDaysTab } from '../RecordingDaysTab';
import { buildRealisticWorkspace } from '../../../__tests__/fixtures/workspaceBuilders';
import { downloadYamlFile } from '../../../io/yaml';

// The download side-effect is mocked so "Export this day" can be asserted without a real download.
vi.mock('../../../io/yaml', async (importOriginal) => {
  const actual = await importOriginal();
  return { ...actual, downloadYamlFile: vi.fn() };
});

let captured = null;
/** Captures the shared store so a test can read what an action wrote. */
function StoreProbe() {
  captured = useStoreContext();
  return null;
}

const originalHash = window.location.hash;

/** Render the recording-days pane + a live-store probe for the realistic single-day animal. */
function renderPane() {
  captured = null;
  const { animal, day } = buildRealisticWorkspace();
  render(
    <StoreProvider
      initialState={{ workspace: { animals: { [animal.id]: animal }, days: { [day.id]: day }, settings: {} } }}
    >
      <StoreProbe />
      <RecordingDaysTab animalId={animal.id} />
    </StoreProvider>
  );
  return { animalId: animal.id, dayId: day.id };
}

describe('RecordingDaysTab — per-day ⋯ menu', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.location.hash = originalHash;
  });

  it('offers Open / Duplicate day / Export this day / Delete day', async () => {
    const user = userEvent.setup();
    renderPane();

    await user.click(screen.getByRole('button', { name: /actions for 2023-06-22/i }));
    const menu = screen.getByRole('menu');
    expect(within(menu).getByRole('menuitem', { name: /^open$/i })).toBeInTheDocument();
    expect(within(menu).getByRole('menuitem', { name: /duplicate day/i })).toBeInTheDocument();
    expect(within(menu).getByRole('menuitem', { name: /export this day/i })).toBeInTheDocument();
    expect(within(menu).getByRole('menuitem', { name: /delete day/i })).toBeInTheDocument();
  });

  it('Open navigates to the day editor', async () => {
    const user = userEvent.setup();
    const { dayId } = renderPane();

    await user.click(screen.getByRole('button', { name: /actions for 2023-06-22/i }));
    await user.click(screen.getByRole('menuitem', { name: /^open$/i }));

    expect(window.location.hash).toBe(`#/day/${dayId}`);
  });

  it('Duplicate day opens the single-date picker (→ duplicateDay)', async () => {
    const user = userEvent.setup();
    renderPane();

    await user.click(screen.getByRole('button', { name: /actions for 2023-06-22/i }));
    await user.click(screen.getByRole('menuitem', { name: /duplicate day/i }));

    expect(screen.getByLabelText(/new date/i)).toBeInTheDocument();
  });

  it('Export this day downloads exactly that day via the shared export path', async () => {
    const user = userEvent.setup();
    renderPane();

    await user.click(screen.getByRole('button', { name: /actions for 2023-06-22/i }));
    await user.click(screen.getByRole('menuitem', { name: /export this day/i }));

    expect(downloadYamlFile).toHaveBeenCalledTimes(1);
    expect(downloadYamlFile.mock.calls[0][0]).toBe('06222023_remy_metadata.yml');
  });

  it('Delete day shows the undo toast (no hard confirm dialog)', async () => {
    const user = userEvent.setup();
    renderPane();

    await user.click(screen.getByRole('button', { name: /actions for 2023-06-22/i }));
    await user.click(screen.getByRole('menuitem', { name: /delete day/i }));

    // No alertdialog (per-day delete is reversible, not a hard confirm) — a status toast with Undo.
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    const toast = screen.getByRole('status');
    expect(within(toast).getByRole('button', { name: /undo/i })).toBeInTheDocument();
    // The day is gone from the store.
    expect(captured.model.workspace.days['remy-2023-06-22']).toBeUndefined();
  });

  it('keeps the duplicate-day store write working through the menu', () => {
    renderPane();

    fireEvent.click(screen.getByRole('button', { name: /actions for 2023-06-22/i }));
    fireEvent.click(screen.getByRole('menuitem', { name: /duplicate day/i }));
    fireEvent.change(screen.getByLabelText(/new date/i), { target: { value: '2023-06-30' } });
    act(() => {
      fireEvent.click(screen.getByRole('button', { name: /^duplicate day$/i }));
    });

    const dup = captured.model.workspace.days['remy-2023-06-30'];
    expect(dup).toBeDefined();
    expect(dup.session.session_id).toBe('remy_20230630');
  });
});
