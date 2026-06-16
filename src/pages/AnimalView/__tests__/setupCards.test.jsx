/**
 * Animal setup blast-radius affordances (Phase 2 — epoch-editor).
 *
 * The animal-static sections whose edit forces affected days to re-export — Identity, Cameras,
 * Optogenetics — carry a BlastRadiusChip ("Affects all N days") at their edit surface; the
 * Optogenetics tab also shows the opto-completeness meter ("Opto configured · N of N", read from
 * optoFieldsPresence). Recording System / Task Types do NOT carry the chip (not re-export-forcing).
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { StoreProvider } from '../../../state/StoreContext';
import { AnimalView } from '../index';

const animal = {
  id: 'laurent',
  subject: { subject_id: 'laurent', species: 'Rattus norvegicus', sex: 'M', genotype: 'PV-Cre' },
  devices: {
    electrode_groups: [],
    ntrode_electrode_group_channel_map: [],
    data_acq_device: [{ name: 'SpikeGadgets', system: 'SpikeGadgets', amplifier: 'Intan' }],
  },
  cameras: [
    { id: 0, camera_name: 'sleep_camera', meters_per_pixel: 0.001, manufacturer: 'Manta', model: 'G-158C', lens: 'Theia' },
  ],
  optogenetics: {
    opto_excitation_source: [{ name: 'laser_638' }],
    optical_fiber: [{ id: 0 }],
    virus_injection: [{ id: 0 }],
    optogenetic_stimulation_software: 'fsgui',
  },
  experimenters: { experimenter_name: ['Gao, Scott'] },
  configurationHistory: [
    { version: 1, date: '2026-04-20', description: 'init', devices: { electrode_groups: [] }, appliedToDays: [] },
  ],
  days: ['laurent-2026-05-07'],
};
const days = {
  'laurent-2026-05-07': {
    id: 'laurent-2026-05-07',
    animalId: 'laurent',
    date: '2026-05-07',
    session: { session_id: 'laurent_20260507' },
    state: { exported: true },
  },
};

/**
 * Render AnimalView for a tab against the opto-configured single-day animal.
 * @param {string} tab - The active tab to render.
 * @returns {object} render result
 */
function renderView(tab) {
  return render(
    <StoreProvider
      initialState={{ workspace: { animals: { laurent: structuredClone(animal) }, days: structuredClone(days), settings: {} } }}
    >
      <AnimalView animalId="laurent" tab={tab} />
    </StoreProvider>
  );
}

beforeEach(() => {
  delete window.location;
  window.location = { hash: '#/animal/laurent/cameras' };
});
afterEach(() => {
  window.location = { hash: '' };
});

describe('AnimalView setup — blast-radius chips + opto meter', () => {
  it('shows a BlastRadiusChip on the Cameras tab', () => {
    renderView('cameras');
    expect(screen.getByText(/affects all 1 day/i)).toBeInTheDocument();
  });

  it('shows a BlastRadiusChip and the opto-completeness meter on the Optogenetics tab', () => {
    renderView('optogenetics');
    expect(screen.getByText(/affects all 1 day/i)).toBeInTheDocument();
    expect(screen.getByText(/opto configured/i)).toHaveTextContent(/4 of 4/);
  });

  it('does NOT show a BlastRadiusChip on the Recording System tab (not re-export-forcing)', () => {
    renderView('recording-system');
    expect(screen.queryByText(/affects all/i)).not.toBeInTheDocument();
  });

  it('shows a BlastRadiusChip in the Edit-profile (Identity) dialog', async () => {
    const user = userEvent.setup();
    renderView('days');
    await user.click(screen.getByRole('button', { name: /actions for laurent/i }));
    await user.click(screen.getByRole('menuitem', { name: /edit profile/i }));
    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByText(/affects all 1 day/i)).toBeInTheDocument();
  });
});
