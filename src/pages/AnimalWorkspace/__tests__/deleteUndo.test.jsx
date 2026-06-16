/**
 * Undo-able recording-day delete (Phase 2 — epoch-editor).
 *
 * Day delete is the FREQUENT, reversible action: it deletes immediately and shows the Phase-0 UndoToast
 * whose Undo re-creates the day from the captured record (`createDay` + `updateDay`). The CATASTROPHIC
 * animal delete keeps its hard type-to-confirm dialog (AnimalView header) — undo for the reversible,
 * confirm for the catastrophic.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { StoreProvider, useStoreContext } from '../../../state/StoreContext';
import { RecordingDaysTab } from '../RecordingDaysTab';
import { AnimalView } from '../../AnimalView';

let captured = null;
/** Captures the shared store so a test can read what an action wrote. */
function StoreProbe() {
  captured = useStoreContext();
  return null;
}

const originalHash = window.location.hash;

const animal = {
  id: 'remy',
  subject: { subject_id: 'remy', species: 'Rattus norvegicus', sex: 'M' },
  devices: { electrode_groups: [], ntrode_electrode_group_channel_map: [], data_acq_device: [] },
  cameras: [],
  configurationHistory: [
    { version: 1, date: '2024-01-02', description: 'Initial', devices: { electrode_groups: [] }, appliedToDays: [] },
  ],
  days: ['remy-2023-06-22', 'remy-2023-06-23'],
};
const days = {
  'remy-2023-06-22': {
    id: 'remy-2023-06-22',
    animalId: 'remy',
    date: '2023-06-22',
    session: { session_id: 'remy_20230622', session_description: 'W-track' },
    tasks: [{ task_name: 'W-track', task_epochs: [1] }],
    keywords: ['hpc'],
    configurationVersion: 1,
    state: { draft: false, validated: true, exported: true },
  },
  'remy-2023-06-23': {
    id: 'remy-2023-06-23',
    animalId: 'remy',
    date: '2023-06-23',
    session: { session_id: 'remy_20230623' },
    state: { draft: true },
  },
};

/** Render the recording-days pane + a live-store probe for the two-day remy fixture. */
function renderPane() {
  captured = null;
  render(
    <StoreProvider initialState={{ workspace: { animals: { remy: structuredClone(animal) }, days: structuredClone(days), settings: {} } }}>
      <StoreProbe />
      <RecordingDaysTab animalId="remy" />
    </StoreProvider>
  );
}

describe('RecordingDaysTab — undo-able day delete', () => {
  beforeEach(() => {
    window.location.hash = originalHash;
  });

  it('row delete removes the day and Undo restores its record (id, tasks, state)', async () => {
    const user = userEvent.setup();
    renderPane();

    await user.click(screen.getByRole('button', { name: /actions for 2023-06-22/i }));
    await user.click(screen.getByRole('menuitem', { name: /delete day/i }));

    expect(captured.model.workspace.days['remy-2023-06-22']).toBeUndefined();
    expect(captured.model.workspace.animals.remy.days).not.toContain('remy-2023-06-22');

    // Undo re-creates the day with its day-owned content intact.
    await user.click(within(screen.getByRole('status')).getByRole('button', { name: /undo/i }));

    const restored = captured.model.workspace.days['remy-2023-06-22'];
    expect(restored).toBeDefined();
    expect(restored.tasks).toEqual([{ task_name: 'W-track', task_epochs: [1] }]);
    expect(restored.session.session_id).toBe('remy_20230622');
    expect(restored.state).toMatchObject({ validated: true, exported: true });
    expect(captured.model.workspace.animals.remy.days).toContain('remy-2023-06-22');
  });

  it('bulk delete removes every selected day and Undo restores all of them', async () => {
    const user = userEvent.setup();
    renderPane();

    await user.click(screen.getByRole('checkbox', { name: /select all recording days/i }));
    await user.click(screen.getByRole('button', { name: /^delete$/i }));

    expect(captured.model.workspace.days['remy-2023-06-22']).toBeUndefined();
    expect(captured.model.workspace.days['remy-2023-06-23']).toBeUndefined();

    await user.click(within(screen.getByRole('status')).getByRole('button', { name: /undo/i }));

    expect(captured.model.workspace.days['remy-2023-06-22']).toBeDefined();
    expect(captured.model.workspace.days['remy-2023-06-23']).toBeDefined();
  });
});

describe('AnimalView — delete-animal keeps the hard confirm', () => {
  it('routes animal delete through the type-to-confirm alertdialog (not an undo toast)', async () => {
    const user = userEvent.setup();
    window.location.hash = originalHash;
    render(
      <StoreProvider initialState={{ workspace: { animals: { remy: structuredClone(animal) }, days: structuredClone(days), settings: {} } }}>
        <AnimalView animalId="remy" tab="days" />
      </StoreProvider>
    );

    await user.click(screen.getByRole('button', { name: /actions for remy/i }));
    await user.click(screen.getByRole('menuitem', { name: /delete animal/i }));

    // A destructive, deliberate confirm — NOT an undo toast.
    expect(screen.getByRole('alertdialog')).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: /type .* to confirm/i })).toBeInTheDocument();
  });
});
