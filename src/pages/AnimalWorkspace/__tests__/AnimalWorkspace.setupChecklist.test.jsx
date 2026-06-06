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
