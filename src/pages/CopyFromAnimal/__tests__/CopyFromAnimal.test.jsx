/**
 * Copy-from-animal screen (validation slice).
 *
 * Drives the flow against a LIVE store: pick a same-rig source, choose which setup to copy, name the
 * new animal, and "Copy & continue setup". Proves the new animal gets the copied hardware setup
 * (probes / cameras / recording system / task types / optogenetics) but NOT identity, recording
 * days, or DIO, and that it hands off to the guided wizard (`#/home?animal=<id>`) to continue.
 */
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { StoreProvider, useStoreContext } from '../../../state/StoreContext';
import CopyFromAnimal from '../index';

const originalHash = window.location.hash;
afterEach(() => {
  window.location.hash = originalHash;
});

/** The live workspace, captured for assertions. */
let captured;

/**
 * Render-only probe capturing the live workspace.
 * @returns {null} Renders nothing.
 */
function StoreProbe() {
  captured = useStoreContext().model.workspace;
  return null;
}

/**
 * A source animal with a full same-rig setup (probes / cameras / recording system / task types /
 * optogenetics) plus identity, days, and DIO — the latter three must NOT be copied.
 * @returns {object} The source animal record.
 */
function buildSourceAnimal() {
  const electrodeGroups = [
    { id: 0, location: 'CA1', device_type: 'tetrode_12.5', description: 'tet', targeted_location: 'CA1', targeted_x: 3, targeted_y: 2, targeted_z: 2, units: 'mm' },
  ];
  const ntrode = [{ ntrode_id: 1, electrode_group_id: 0, bad_channels: [], map: { 0: 0, 1: 1, 2: 2, 3: 3 } }];
  return {
    id: 'emmett',
    subject: { subject_id: 'emmett', species: 'Rattus norvegicus', sex: 'M', genotype: 'PV-Cre', date_of_birth: '2023-01-01T00:00:00', weight: 450, description: 'PV-Cre rat' },
    devices: {
      electrode_groups: electrodeGroups,
      ntrode_electrode_group_channel_map: ntrode,
      data_acq_device: [{ name: 'SpikeGadgets', system: 'SpikeGadgets', amplifier: 'Intan', adc_circuit: 'Intan' }],
      device: { name: ['Trodes'] },
    },
    cameras: [{ id: 0, camera_name: 'sleep_camera', meters_per_pixel: 0.001, manufacturer: 'Allied', model: 'Mako', lens: 'Fujinon' }],
    taskTypes: [{ id: 'task-1', name: 'Sleep', description: 'Rest in box' }],
    optogenetics: { opto_excitation_source: [], optical_fiber: [], virus_injection: [], optogenetic_stimulation_software: 'FSGui' },
    experimenters: { experimenter_name: ['Doe, Jane'], lab: 'Frank', institution: 'UCSF' },
    days: ['emmett-2023-02-01'],
    configurationHistory: [{ version: 1, devices: { electrode_groups: electrodeGroups, ntrode_electrode_group_channel_map: ntrode }, appliedToDays: [] }],
  };
}

/**
 * Render the screen with a source animal in the store.
 * @returns {object} The render result.
 */
function renderScreen() {
  captured = null;
  return render(
    <StoreProvider
      initialState={{
        workspace: { animals: { emmett: buildSourceAnimal() }, days: { 'emmett-2023-02-01': { id: 'emmett-2023-02-01', animalId: 'emmett', date: '2023-02-01', behavioral_events: [{ name: 'Poke', description: 'x' }] } }, settings: {} },
      }}
    >
      <CopyFromAnimal />
      <StoreProbe />
    </StoreProvider>
  );
}

describe('CopyFromAnimal', () => {
  it('lists candidate source animals and explains what is not copied', async () => {
    const user = userEvent.setup();
    renderScreen();
    expect(screen.getByLabelText(/source animal/i)).toBeInTheDocument();
    expect(screen.getByText('emmett')).toBeInTheDocument();
    // The "what to copy" card (with the "Not copied" note) appears once a source is chosen.
    await user.selectOptions(screen.getByLabelText(/source animal/i), 'emmett');
    const notCopied = screen.getByText(/not copied/i).closest('p');
    expect(notCopied.textContent.toLowerCase()).toMatch(/identity/);
    expect(notCopied.textContent.toLowerCase()).toMatch(/recording day|days/);
    expect(notCopied.textContent.toLowerCase()).toMatch(/dio|behavioral event/);
  });

  it('copies the setup to a new animal, excludes identity/days/DIO, and hands off to the wizard', async () => {
    const user = userEvent.setup();
    renderScreen();

    await user.selectOptions(screen.getByLabelText(/source animal/i), 'emmett');
    await user.type(screen.getByLabelText(/subject id/i), 'wilbur');
    await user.click(screen.getByRole('button', { name: /copy.*continue setup/i }));

    const wilbur = captured.animals.wilbur;
    expect(wilbur).toBeDefined();
    // Copied setup.
    expect(wilbur.devices.electrode_groups).toHaveLength(1);
    expect(wilbur.devices.ntrode_electrode_group_channel_map).toHaveLength(1);
    expect(wilbur.cameras).toHaveLength(1);
    expect(wilbur.devices.data_acq_device).toHaveLength(1);
    expect(wilbur.taskTypes).toHaveLength(1);
    expect(wilbur.optogenetics).toBeTruthy();
    // NOT copied: identity (its own subject id), recording days, DIO (no behavioral_events at animal level).
    expect(wilbur.subject.subject_id).toBe('wilbur');
    expect(wilbur.subject.genotype).not.toBe('PV-Cre');
    expect(wilbur.days).toEqual([]);
    // Hands off to the wizard to continue setup.
    expect(window.location.hash).toBe('#/home?animal=wilbur');
  });

  it('omits a section that is unchecked', async () => {
    const user = userEvent.setup();
    renderScreen();

    await user.selectOptions(screen.getByLabelText(/source animal/i), 'emmett');
    // Uncheck optogenetics.
    await user.click(screen.getByRole('checkbox', { name: /optogenetics/i }));
    await user.type(screen.getByLabelText(/subject id/i), 'wilbur');
    await user.click(screen.getByRole('button', { name: /copy.*continue setup/i }));

    const wilbur = captured.animals.wilbur;
    expect(wilbur).toBeDefined();
    expect(wilbur.optogenetics == null).toBe(true);
    // Other sections still copied.
    expect(wilbur.devices.electrode_groups).toHaveLength(1);
  });
});
