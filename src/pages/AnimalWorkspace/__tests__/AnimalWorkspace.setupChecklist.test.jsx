/**
 * Animal Workspace "Review existing data" state (originally Phase 8.6 Task 2). Recovered/imported
 * setup must invite review instead of looking silently trusted: this surface counts the days +
 * hardware configs, flags corrupt collections, and offers the executable RawCorruptionBanner
 * reset. (The first-run setup CHECKLIST this file once tested was replaced in Phase 2 Task 2.3 by
 * the "Set up this animal" card — covered in RecordingDaysTab.setupCard.test.jsx.)
 */
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { StoreProvider } from '../../../state/StoreContext';
import { RecordingDaysTab } from '../RecordingDaysTab';

const originalHash = window.location.hash;
afterEach(() => {
  window.location.hash = originalHash;
});

/**
 * Render the recording-days pane for one animal directly (Phase 1 — the pane was extracted to
 * RecordingDaysTab and the legacy Workspace picker now navigates to the route, so these
 * pane-behavior tests host the component itself instead of clicking a picker card).
 * @param {string} animalId - The animal whose pane to render.
 * @param {object} animals - workspace.animals
 * @param {object} [days] - workspace.days
 * @returns {object} render result
 */
function renderPane(animalId, animals, days = {}) {
  return render(
    <StoreProvider initialState={{ workspace: { animals, days, settings: {} } }}>
      <RecordingDaysTab animalId={animalId} />
    </StoreProvider>
  );
}

const newAnimal = {
  subject: { subject_id: 'newbie', species: 'Rattus norvegicus', sex: 'M' },
  devices: { electrode_groups: [], ntrode_electrode_group_channel_map: [], data_acq_device: [] },
  cameras: [],
  configurationHistory: [{ version: 1, date: '2024-01-02', description: 'Initial', devices: { electrode_groups: [] }, appliedToDays: [] }],
  days: [],
};

const configuredAnimal = {
  subject: { subject_id: 'remy', species: 'Rattus norvegicus', sex: 'M' },
  devices: {
    electrode_groups: [{ id: 0, location: 'CA1', device_type: 'tetrode_12.5', targeted_location: 'CA1' }],
    ntrode_electrode_group_channel_map: [],
    data_acq_device: [{ name: 'SpikeGadgets', system: 'SpikeGadgets', amplifier: 'Intan', adc_circuit: 'Intan' }],
  },
  cameras: [{ id: 0, camera_name: 'overhead', meters_per_pixel: 0.001, lens: '16mm', model: 'X', manufacturer: 'Y' }],
  configurationHistory: [{ version: 1, date: '2024-01-02', description: 'Initial', devices: { electrode_groups: [{ id: 0, location: 'CA1', device_type: 'tetrode_12.5', targeted_location: 'CA1' }] }, appliedToDays: [] }],
  days: [],
};

// The first-run "Animal setup" checklist this file used to test was replaced in Phase 2 (Task
// 2.3) by the "Set up this animal" card — see RecordingDaysTab.setupCard.test.jsx. This file now
// covers the SEPARATE "Review existing data" state, which is unchanged by that reframe.

describe('AnimalWorkspace existing-data review state', () => {
  it('does NOT show a review state for a clean established animal with recording days', async () => {
    // A clean animal with a present, non-corrupt recording day has nothing to review — the banner
    // must not linger and compete with "Add Recording Days" forever after the first day.
    const animal = { ...newAnimal, days: ['newbie-2024-01-02'] };
    const days = { 'newbie-2024-01-02': { id: 'newbie-2024-01-02', date: '2024-01-02', session: { session_id: 's' }, state: {} } };
    renderPane('newbie', { newbie: animal }, days);
    expect(screen.queryByRole('region', { name: /existing data review/i })).not.toBeInTheDocument();
  });

  it('shows the review state for an established animal that ALSO has an orphan day', async () => {
    // A clean OK day plus a recovered-unlinked (orphan) day: there IS something to review, so the
    // banner shows even though the animal is established.
    const animal = { ...newAnimal, days: ['newbie-2024-01-02'] };
    const days = {
      'newbie-2024-01-02': { id: 'newbie-2024-01-02', animalId: 'newbie', date: '2024-01-02', session: { session_id: 's' }, state: {} },
      // Orphan: a real record owned by newbie but NOT listed in its day index.
      'newbie-2024-02-02': { id: 'newbie-2024-02-02', animalId: 'newbie', date: '2024-02-02', session: { session_id: 's2' }, state: {} },
    };
    renderPane('newbie', { newbie: animal }, days);
    expect(screen.getByRole('region', { name: /existing data review/i })).toBeInTheDocument();
  });

  it('surfaces corrupt recovered data via the shared RawCorruptionBanner (executable reset)', async () => {
    // A recovered/imported animal whose cameras collection is corrupt (a string, not a list).
    const corrupt = { ...configuredAnimal, cameras: 'nope', days: [] };
    renderPane('remy', { remy: corrupt });
    // Review state appears even without days because there is corruption to repair.
    expect(screen.getByRole('region', { name: /existing data review/i })).toBeInTheDocument();
    // The shipped recovery surface (not a parallel one) renders the executable reset.
    expect(screen.getByRole('alert', { name: /corrupt saved data/i })).toBeInTheDocument();
  });

  it('does not show a review state for a fresh animal with no days and no corruption', async () => {
    renderPane('newbie', { newbie: newAnimal });
    expect(screen.queryByRole('region', { name: /existing data review/i })).not.toBeInTheDocument();
  });

  it('surfaces a dangling day reference (id with no record) instead of silently dropping it', async () => {
    // animal.days lists an id whose record is absent from the days map (recovered data).
    const animal = { ...newAnimal, days: ['newbie-2024-01-02'] };
    renderPane('newbie', { newbie: animal }, {}); // empty days map → the reference is dangling
    expect(screen.getByText(/saved record missing or corrupt/i)).toBeInTheDocument();
    expect(screen.getByText(/missing record/i)).toBeInTheDocument();
  });

  it('surfaces recovered records when animal.days is MISSING but day records exist', async () => {
    // animal.days is undefined (not just non-array); a real record exists in the days map.
    const animal = { ...newAnimal };
    delete animal.days;
    const dayRecord = {
      id: 'newbie-2024-02-02',
      animalId: 'newbie',
      date: '2024-02-02',
      session: { session_id: 'newbie_20240202' },
      state: {},
    };
    renderPane('newbie', { newbie: animal }, { 'newbie-2024-02-02': dayRecord });

    // The record is shown (not "No recording days yet"), flagged as not in the index (the
    // phrase appears both in the review note and on the day row). The row's identity is its
    // date now — session_id moved off the row (Task 2.6).
    expect(screen.getAllByText(/not in day list/i).length).toBeGreaterThan(0);
    expect(screen.getByRole('link', { name: /2024-02-02/i })).toBeInTheDocument();
    expect(screen.queryByText(/no recording days yet/i)).not.toBeInTheDocument();
    // The review state appears and points to THIS animal's own Validation & Export tab to re-link
    // (not the cross-animal batch screen) — "go review this" stays within the animal you're in.
    const review = screen.getByRole('region', { name: /existing data review/i });
    within(review)
      .getAllByRole('link')
      .forEach((link) => expect(link).toHaveAttribute('href', '#/animal/newbie/export'));
  });

  it('surfaces a wrong-owner indexed day with an unlink repair, not as an ordinary day', async () => {
    // newbie's index lists a record that belongs to a different animal.
    const animal = { ...newAnimal, days: ['intruder'] };
    const days = {
      intruder: { id: 'intruder', animalId: 'someoneelse', date: '2024-03-03', session: { session_id: 'x' } },
    };
    renderPane('newbie', { newbie: animal }, days);
    // The sole animal auto-selects on mount; no need to click (clicking by /newbie/i would now
    // also match the unlink button's label below).
    expect(screen.getByText(/belongs to someoneelse/i)).toBeInTheDocument();
    // It is repairable in place (unlink from this animal) — not shown as a normal export-ready day.
    expect(
      screen.getByRole('button', { name: /remove .* from newbie .*belongs to someoneelse/i })
    ).toBeInTheDocument();
  });

  it('surfaces a corrupt (non-array) recording-day list instead of laundering it to "no days"', async () => {
    // A recovered animal whose `days` is a string, not a list.
    const corrupt = { ...newAnimal, days: 'nope' };
    renderPane('newbie', { newbie: corrupt });

    // The review state appears and explains the corrupt day reference (not "no recording days").
    const review = screen.getByRole('region', { name: /existing data review/i });
    expect(within(review).getByText(/recording-day list is corrupt/i)).toBeInTheDocument();
    // The day-list area says "corrupt", not the misleading "No recording days yet".
    expect(screen.getByText(/recording-day list is corrupt and can.?t be shown/i)).toBeInTheDocument();
    expect(screen.queryByText(/no recording days yet/i)).not.toBeInTheDocument();
  });

});
