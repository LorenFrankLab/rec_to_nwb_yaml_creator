/**
 * Duplicate-day row action on the Recording Days tab.
 *
 * A "Duplicate day…" control on each OK row opens a single-date picker; choosing a
 * non-colliding date clones that day to the new date via the store's duplicateDay action.
 * Assertions read the LIVE store (via a probe) so we observe the state the action wrote,
 * not a render-time snapshot, and stay clock-robust by setting the date input explicitly.
 */
import { describe, it, expect } from 'vitest';
import { render, screen, act, fireEvent } from '@testing-library/react';
import { StoreProvider, useStoreContext } from '../../../state/StoreContext';
import { RecordingDaysTab } from '../RecordingDaysTab';

// Live-store probe: captures the shared store so the test can read what the action wrote.
let captured = null;
/**
 *
 */
function StoreProbe() {
  captured = useStoreContext();
  return null;
}

/**
 * Render the recording-days pane plus a probe under one shared store.
 * @param {string} animalId - The animal whose pane to render.
 * @param {object} animals - workspace.animals
 * @param {object} [days] - workspace.days
 * @returns {object} render result
 */
function renderPane(animalId, animals, days = {}) {
  captured = null;
  return render(
    <StoreProvider initialState={{ workspace: { animals, days, settings: {} } }}>
      <StoreProbe />
      <RecordingDaysTab animalId={animalId} />
    </StoreProvider>
  );
}

/** An established animal with one prior day carrying tasks. */
const animal = {
  id: 'remy',
  subject: { subject_id: 'remy', species: 'Rattus norvegicus', sex: 'M' },
  devices: { electrode_groups: [], ntrode_electrode_group_channel_map: [], data_acq_device: [] },
  cameras: [],
  behavioral_events: [],
  configurationHistory: [
    { version: 1, date: '2024-01-02', description: 'Initial', devices: { electrode_groups: [] }, appliedToDays: [] },
  ],
  days: ['remy-2023-06-22'],
};
const sourceDay = {
  id: 'remy-2023-06-22',
  animalId: 'remy',
  date: '2023-06-22',
  session: { session_id: 'remy_20230622', session_description: 'Day 1' },
  tasks: [{ task_name: 'W-track', task_epochs: [1] }],
  behavioral_events: [],
  keywords: [],
  state: { draft: true, validated: false, exported: false },
  configurationVersion: 1,
};

describe('RecordingDaysTab — duplicate day row action', () => {
  it('clicking "Duplicate day…" and choosing a date duplicates the day in the store', () => {
    renderPane('remy', { remy: animal }, { 'remy-2023-06-22': sourceDay });

    // Open the single-date duplicate picker for the OK row.
    fireEvent.click(screen.getByRole('button', { name: /duplicate recording day/i }));

    // A date input appears; set a fixed, non-colliding date (clock-robust).
    const dateInput = screen.getByLabelText(/new date/i);
    fireEvent.change(dateInput, { target: { value: '2023-06-30' } });

    // Confirm the duplication.
    act(() => {
      fireEvent.click(screen.getByRole('button', { name: /^duplicate day$/i }));
    });

    const dup = captured.model.workspace.days['remy-2023-06-30'];
    expect(dup).toBeDefined();
    expect(dup.date).toBe('2023-06-30');
    expect(dup.tasks).toEqual([{ task_name: 'W-track', task_epochs: [1] }]);
    expect(dup.session.session_id).toBe('remy_20230630');
    expect(captured.model.workspace.animals.remy.days).toContain('remy-2023-06-30');
  });
});
