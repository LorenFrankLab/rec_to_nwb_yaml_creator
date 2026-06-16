/**
 * New-configuration (re-implant) flow on the animal page (Phase 2 — epoch-editor).
 *
 * The ConfigurationCard's "New configuration…" action opens a modal: an effective start date, a
 * copy-from-current-config toggle, and a confirm that bad-channel history resets for the new version.
 * It commits through the SAME `createConfigurationSnapshotAndApplyForward` action the Day-Editor
 * reconfiguration uses (no parallel snapshot logic): days from the effective date forward stamp the
 * new version; earlier days keep theirs.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { StoreProvider, useStoreContext } from '../../../state/StoreContext';
import { AnimalView } from '../index';

let captured = null;
/** Captures the shared store so a test can read what the reconfiguration wrote. */
function StoreProbe() {
  captured = useStoreContext();
  return null;
}

const electrodeGroups = [
  { id: 0, location: 'CA1', device_type: 'tetrode_12.5', targeted_x: 1, targeted_y: 2, targeted_z: 3 },
];
const ntrodeMap = [{ ntrode_id: 1, electrode_group_id: 0, bad_channels: [], map: { 0: 0, 1: 1, 2: 2, 3: 3 } }];

const animal = {
  id: 'remy',
  subject: { subject_id: 'remy', species: 'Rattus norvegicus', sex: 'M' },
  devices: {
    electrode_groups: electrodeGroups,
    ntrode_electrode_group_channel_map: ntrodeMap,
    data_acq_device: [],
  },
  cameras: [],
  configurationHistory: [
    {
      version: 1,
      date: '2026-01-01',
      description: 'Initial',
      devices: { electrode_groups: electrodeGroups, ntrode_electrode_group_channel_map: ntrodeMap },
      appliedToDays: [],
    },
  ],
  days: ['remy-2026-05-01', 'remy-2026-05-10', 'remy-2026-05-20'],
};
const mkDay = (date) => ({
  id: `remy-${date}`,
  animalId: 'remy',
  date,
  session: { session_id: `remy_${date.replace(/-/g, '')}` },
  configurationVersion: 1,
  state: {},
});
const days = {
  'remy-2026-05-01': mkDay('2026-05-01'),
  'remy-2026-05-10': mkDay('2026-05-10'),
  'remy-2026-05-20': mkDay('2026-05-20'),
};

/** Render AnimalView (electrode-groups tab) + a live-store probe. */
function renderView() {
  captured = null;
  render(
    <StoreProvider initialState={{ workspace: { animals: { remy: structuredClone(animal) }, days: structuredClone(days), settings: {} } }}>
      <StoreProbe />
      <AnimalView animalId="remy" tab="electrode-groups" />
    </StoreProvider>
  );
}

beforeEach(() => {
  delete window.location;
  window.location = { hash: '#/animal/remy/electrode-groups' };
});
afterEach(() => {
  window.location = { hash: '' };
});

describe('AnimalView — new-configuration (re-implant) modal', () => {
  it('the modal offers an effective date, a copy-from-current toggle, and a bad-channel-reset confirm', async () => {
    const user = userEvent.setup();
    renderView();

    await user.click(screen.getByRole('button', { name: /new configuration/i }));
    const dialog = screen.getByRole('alertdialog');
    expect(within(dialog).getByLabelText(/effective (start )?date/i)).toBeInTheDocument();
    expect(within(dialog).getByRole('checkbox', { name: /copy.*current/i })).toBeInTheDocument();
    expect(within(dialog).getByText(/bad[- ]channel.*reset/i)).toBeInTheDocument();
  });

  it('re-pins days from the effective date forward to the new version, keeping earlier days', async () => {
    const user = userEvent.setup();
    renderView();

    await user.click(screen.getByRole('button', { name: /new configuration/i }));
    const dialog = screen.getByRole('alertdialog');

    const dateInput = within(dialog).getByLabelText(/effective (start )?date/i);
    await user.clear(dateInput);
    await user.type(dateInput, '2026-05-10');
    await user.click(within(dialog).getByRole('button', { name: /start (new )?configuration|create.*configuration/i }));

    const ws = captured.model.workspace;
    // A second configuration version now exists.
    expect(ws.animals.remy.configurationHistory).toHaveLength(2);
    expect(ws.animals.remy.configurationHistory[1].version).toBe(2);
    // Days on/after the effective date moved to v2; the earlier day kept v1.
    expect(ws.days['remy-2026-05-01'].configurationVersion).toBe(1);
    expect(ws.days['remy-2026-05-10'].configurationVersion).toBe(2);
    expect(ws.days['remy-2026-05-20'].configurationVersion).toBe(2);
  });

  it('resets the form on reopen — a canceled effective date does not prefill the next attempt', async () => {
    const user = userEvent.setup();
    renderView();

    // Open, type a date, then cancel without committing.
    await user.click(screen.getByRole('button', { name: /new configuration/i }));
    let dialog = screen.getByRole('alertdialog');
    await user.type(within(dialog).getByLabelText(/effective (start )?date/i), '2026-05-10');
    await user.click(within(dialog).getByRole('button', { name: /^cancel$/i }));

    // Reopen — the effective date must be cleared, not the canceled value.
    await user.click(screen.getByRole('button', { name: /new configuration/i }));
    dialog = screen.getByRole('alertdialog');
    expect(within(dialog).getByLabelText(/effective (start )?date/i)).toHaveValue('');
  });
});
