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
