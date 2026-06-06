/**
 * Animal Workspace setup checklist (Phase 8.6 Task 2). The workspace is the operational home:
 * it surfaces a first-class setup checklist so electrode setup is discoverable WITHOUT opening
 * the Animal Editor, and existing/imported setup invites review instead of looking trusted.
 */
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { StoreProvider } from '../../../state/StoreContext';
import { AnimalWorkspace } from '../index';
import { buildRealisticWorkspace } from '../../../__tests__/fixtures/workspaceBuilders';

const originalHash = window.location.hash;
afterEach(() => {
  window.location.hash = originalHash;
});

/**
 *
 * @param animals
 * @param days
 */
function renderWith(animals, days = {}) {
  return render(
    <StoreProvider initialState={{ workspace: { animals, days, settings: {} } }}>
      <AnimalWorkspace />
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

/**
 *
 * @param name
 */
async function selectAnimal(name) {
  await userEvent.click(screen.getByRole('button', { name: new RegExp(name, 'i') }));
}

describe('AnimalWorkspace setup checklist', () => {
  it('lists the five setup items for the selected animal', async () => {
    renderWith({ newbie: newAnimal });
    await selectAnimal('newbie');
    const checklist = screen.getByRole('region', { name: /animal setup/i });
    // Exact item labels (avoid matching the intro paragraph or the action buttons).
    expect(within(checklist).getByText('Subject')).toBeInTheDocument();
    expect(within(checklist).getByText('Electrodes / probes')).toBeInTheDocument();
    expect(within(checklist).getByText('Cameras / calibration')).toBeInTheDocument();
    expect(within(checklist).getByText('Data acquisition')).toBeInTheDocument();
    expect(within(checklist).getByText('Recording days')).toBeInTheDocument();
  });

  it('offers "Set Up Electrodes" as the primary action for a new animal, linking to the Animal Editor', async () => {
    renderWith({ newbie: newAnimal });
    await selectAnimal('newbie');
    const action = screen.getByRole('link', { name: /set up electrodes/i });
    expect(action).toBeInTheDocument();
    expect(action.getAttribute('href')).toMatch(/#\/animal\/newbie\/editor/);
  });

  it('still shows "Set Up Electrodes" for an animal that has days but no electrodes', async () => {
    const animal = { ...newAnimal, days: ['newbie-2024-01-02'] };
    const days = { 'newbie-2024-01-02': { id: 'newbie-2024-01-02', date: '2024-01-02', session: { session_id: 's' }, state: {} } };
    renderWith({ newbie: animal }, days);
    await selectAnimal('newbie');
    expect(screen.getByRole('link', { name: /set up electrodes/i })).toBeInTheDocument();
  });

  it('invites review (not setup) when electrode and camera setup already exist', async () => {
    renderWith({ remy: configuredAnimal });
    await selectAnimal('remy');
    expect(screen.getByRole('link', { name: /review electrodes/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /review cameras/i })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /set up electrodes/i })).not.toBeInTheDocument();
  });
});

describe('AnimalWorkspace existing-data review state', () => {
  it('shows a review state when the animal has recording days', async () => {
    const animal = { ...newAnimal, days: ['newbie-2024-01-02'] };
    const days = { 'newbie-2024-01-02': { id: 'newbie-2024-01-02', date: '2024-01-02', session: { session_id: 's' }, state: {} } };
    renderWith({ newbie: animal }, days);
    await selectAnimal('newbie');
    const review = screen.getByRole('region', { name: /existing data review/i });
    expect(within(review).getByText(/found 1 recording day/i)).toBeInTheDocument();
    expect(within(review).getByText(/review electrodes and cameras before exporting/i)).toBeInTheDocument();
  });

  it('surfaces corrupt recovered data via the shared RawCorruptionBanner (executable reset)', async () => {
    // A recovered/imported animal whose cameras collection is corrupt (a string, not a list).
    const corrupt = { ...configuredAnimal, cameras: 'nope', days: [] };
    renderWith({ remy: corrupt });
    await selectAnimal('remy');
    // Review state appears even without days because there is corruption to repair.
    expect(screen.getByRole('region', { name: /existing data review/i })).toBeInTheDocument();
    // The shipped recovery surface (not a parallel one) renders the executable reset.
    expect(screen.getByRole('alert', { name: /corrupt saved data/i })).toBeInTheDocument();
    // …and the checklist marks the cameras item as having errors.
    const camerasItem = screen.getByText('Cameras / calibration').closest('.setup-item');
    expect(camerasItem.className).toMatch(/setup-item-has_errors/);
  });

  it('does not show a review state for a fresh animal with no days and no corruption', async () => {
    renderWith({ newbie: newAnimal });
    await selectAnimal('newbie');
    expect(screen.queryByRole('region', { name: /existing data review/i })).not.toBeInTheDocument();
  });

  it('surfaces a dangling day reference (id with no record) instead of silently dropping it', async () => {
    // animal.days lists an id whose record is absent from the days map (recovered data).
    const animal = { ...newAnimal, days: ['newbie-2024-01-02'] };
    renderWith({ newbie: animal }, {}); // empty days map → the reference is dangling
    await selectAnimal('newbie');
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
    renderWith({ newbie: animal }, { 'newbie-2024-02-02': dayRecord });
    await selectAnimal('newbie');

    // The record is shown (not "No recording days yet"), flagged as not in the index (the
    // phrase appears both in the review note and on the day row).
    expect(screen.getAllByText(/not in day list/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/newbie_20240202/)).toBeInTheDocument();
    expect(screen.queryByText(/no recording days yet/i)).not.toBeInTheDocument();
    // The review state appears and points to the validation summary to re-link.
    expect(screen.getByRole('region', { name: /existing data review/i })).toBeInTheDocument();
  });

  it('surfaces a wrong-owner indexed day with an unlink repair, not as an ordinary day', async () => {
    // newbie's index lists a record that belongs to a different animal.
    const animal = { ...newAnimal, days: ['intruder'] };
    const days = {
      intruder: { id: 'intruder', animalId: 'someoneelse', date: '2024-03-03', session: { session_id: 'x' } },
    };
    renderWith({ newbie: animal }, days);
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
    renderWith({ newbie: corrupt });
    await selectAnimal('newbie');

    // The review state appears and explains the corrupt day reference (not "no recording days").
    const review = screen.getByRole('region', { name: /existing data review/i });
    expect(within(review).getByText(/recording-day list is corrupt/i)).toBeInTheDocument();
    // The day-list area says "corrupt", not the misleading "No recording days yet".
    expect(screen.getByText(/recording-day list is corrupt and can.?t be shown/i)).toBeInTheDocument();
    expect(screen.queryByText(/no recording days yet/i)).not.toBeInTheDocument();
  });

  it('folds a per-day setup-validation error into the checklist item (not just raw corruption)', async () => {
    // A real setup error (an unknown probe device_type) surfaces only by validating the day's
    // merged metadata; the workspace must aggregate it so the Electrodes item badges has_errors.
    const { animal, day } = buildRealisticWorkspace();
    const badGeometry = animal.configurationHistory[0].devices.electrode_groups.map((g, i) =>
      i === 0 ? { ...g, device_type: 'totally_unknown_probe' } : g
    );
    animal.configurationHistory[0].devices.electrode_groups = badGeometry;
    animal.devices.electrode_groups = badGeometry; // mirror, so the item also reads as present

    renderWith({ [animal.id]: animal }, { [day.id]: day });
    await selectAnimal(animal.id);

    const electrodesItem = screen.getByText('Electrodes / probes').closest('.setup-item');
    expect(electrodesItem.className).toMatch(/setup-item-has_errors/);
  });
});
