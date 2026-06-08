/**
 * Carry-forward day creation toggle on the Recording Days tab.
 *
 * A new recording day should default its day-owned content from the animal's most recent existing
 * day, with a default-ON, reviewable opt-out toggle. The toggle is shown only when a prior day
 * exists. When on, creating a day copies the prior day's tasks (asserted via a live-store probe so
 * we read the ACTUAL store state the action wrote, not a render-time snapshot).
 */
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { StoreProvider, useStoreContext } from '../../../state/StoreContext';
import { RecordingDaysTab } from '../RecordingDaysTab';

const originalHash = window.location.hash;
afterEach(() => {
  window.location.hash = originalHash;
});

// Live-store probe: captures the shared store object so a test can call actions and read the
// resulting state directly (the same store the rendered RecordingDaysTab consumes).
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
const animalWithDay = {
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
const priorDay = {
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

/** A brand-new animal with no recording days. */
const animalNoDays = {
  id: 'newbie',
  subject: { subject_id: 'newbie', species: 'Rattus norvegicus', sex: 'M' },
  devices: { electrode_groups: [], ntrode_electrode_group_channel_map: [], data_acq_device: [] },
  cameras: [],
  behavioral_events: [],
  configurationHistory: [
    { version: 1, date: '2024-01-02', description: 'Initial', devices: { electrode_groups: [] }, appliedToDays: [] },
  ],
  days: [],
};

describe('Carry-forward day creation toggle', () => {
  it('renders a default-checked toggle naming the most-recent day when a prior day exists', () => {
    renderPane('remy', { remy: animalWithDay }, { 'remy-2023-06-22': priorDay });
    const toggle = screen.getByRole('checkbox', {
      name: /start each new day from the last day \(2023-06-22\)/i,
    });
    expect(toggle).toBeChecked();
  });

  it('does NOT render the toggle when the animal has no prior day', () => {
    renderPane('newbie', { newbie: animalNoDays });
    expect(
      screen.queryByRole('checkbox', { name: /start each new day from the last day/i })
    ).not.toBeInTheDocument();
  });

  it('with the toggle ON, creating a day copies the prior day tasks (via the live store)', async () => {
    renderPane('remy', { remy: animalWithDay }, { 'remy-2023-06-22': priorDay });
    // Drive the create path directly with the toggle's default-ON behavior: the most recent day is
    // the carry source. (The calendar UI is clock-dependent, so we exercise the wired action.)
    await act(async () => {
      captured.actions.createDay(
        'remy',
        '2023-06-23',
        { session_id: 'remy_20230623', session_description: 'Day 2' },
        { carryForwardFromDayId: 'remy-2023-06-22' }
      );
    });
    const newDay = captured.model.workspace.days['remy-2023-06-23'];
    expect(newDay.tasks).toEqual([{ task_name: 'W-track', task_epochs: [1] }]);
  });
});
