/**
 * "Copy from another animal…" affordance on the Recording Days setup card.
 *
 * A lab's rig is shared across animals, so an under-configured animal can copy another animal's
 * electrode groups (+ channel maps), cameras, and recording system in ONE update. The button shows
 * only when another animal exists; the dialog writes the checked catalogs to the target animal.
 * Assertions read the LIVE store (via a probe) so we observe the state the action wrote, and stay
 * clock-robust (no date input is involved).
 */
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { StoreProvider, useStoreContext } from '../../../state/StoreContext';
import { RecordingDaysTab } from '../RecordingDaysTab';

// Live-store probe: captures the shared store so the test can read what the action wrote.
let captured = null;
/** Capture the shared store context. */
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

/** A fresh, under-configured target (subject set, empty catalogs, no days → setup card shows). */
const target = {
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

/** A fully-configured source animal (electrodes + maps + cameras + recording system). */
const source = {
  id: 'remy',
  subject: { subject_id: 'remy', species: 'Rattus norvegicus', sex: 'M' },
  devices: {
    electrode_groups: [{ id: 0, location: 'CA1', device_type: 'tetrode_12.5', targeted_location: 'CA1' }],
    ntrode_electrode_group_channel_map: [
      { ntrode_id: 0, electrode_group_id: 0, bad_channels: [], map: { 0: 0, 1: 1, 2: 2, 3: 3 } },
    ],
    data_acq_device: [{ name: 'acq1', system: 'SpikeGadgets', amplifier: 'Intan', adc_circuit: 'Intan' }],
  },
  cameras: [{ id: 0, camera_name: 'overhead', meters_per_pixel: 0.001, lens: '16mm', model: 'X', manufacturer: 'Y' }],
  behavioral_events: [],
  configurationHistory: [
    { version: 1, date: '2024-01-02', description: 'Initial', devices: { electrode_groups: [{ id: 0, location: 'CA1', device_type: 'tetrode_12.5', targeted_location: 'CA1' }] }, appliedToDays: [] },
  ],
  days: [],
};

describe('RecordingDaysTab — Copy from another animal', () => {
  it('hides the button when there is no other animal to copy from', () => {
    renderPane('newbie', { newbie: target });
    expect(
      screen.queryByRole('button', { name: /copy from another animal/i })
    ).not.toBeInTheDocument();
  });

  it('shows the button when another animal exists', () => {
    renderPane('newbie', { newbie: target, remy: source });
    expect(
      screen.getByRole('button', { name: /copy from another animal/i })
    ).toBeInTheDocument();
  });

  it('copies the selected catalogs to the target animal in one update', async () => {
    const user = userEvent.setup();
    renderPane('newbie', { newbie: target, remy: source });

    await user.click(screen.getByRole('button', { name: /copy from another animal/i }));
    await user.click(screen.getByRole('radio', { name: /remy/i }));
    await user.click(screen.getByRole('button', { name: /^copy$/i }));

    const written = captured.model.workspace.animals.newbie;
    // All three checked catalogs landed on the target in one update.
    expect(written.devices.electrode_groups).toHaveLength(1);
    expect(written.devices.ntrode_electrode_group_channel_map).toHaveLength(1);
    expect(written.devices.data_acq_device).toHaveLength(1);
    expect(written.devices.data_acq_device[0].name).toBe('acq1');
    expect(written.cameras).toHaveLength(1);
    expect(written.cameras[0].camera_name).toBe('overhead');
  });

  it('writes only cameras when electrodes + recording system are unchecked, leaving devices untouched', async () => {
    const user = userEvent.setup();
    renderPane('newbie', { newbie: target, remy: source });

    await user.click(screen.getByRole('button', { name: /copy from another animal/i }));
    await user.click(screen.getByRole('radio', { name: /remy/i }));
    await user.click(screen.getByRole('checkbox', { name: /electrode groups/i }));
    await user.click(screen.getByRole('checkbox', { name: /recording system/i }));
    await user.click(screen.getByRole('button', { name: /^copy$/i }));

    const written = captured.model.workspace.animals.newbie;
    expect(written.cameras).toHaveLength(1);
    // Electrode groups untouched (still empty — devices not written).
    expect(written.devices.electrode_groups).toHaveLength(0);
    expect(written.devices.data_acq_device).toHaveLength(0);
  });
});
