/**
 * Animal-static edit consequence (Phase 2 — epoch-editor).
 *
 * Committing an Identity / Cameras / Optogenetics edit isn't just a pre-edit warning (the
 * BlastRadiusChip) — it surfaces the POST-edit consequence "N already-exported days now need
 * re-export", so the user sees what the animal-wide change just invalidated. Identity (the Edit-profile
 * dialog) and Cameras (deleting a camera) are driven here through real saves; Optogenetics reuses the
 * same `noteEditConsequence` mechanism (wired via OptogeneticsContainer's onAfterUpdate).
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
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
 * Render AnimalView for a tab against the single-exported-day animal.
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
  window.location = { hash: '#/animal/laurent/days' };
});
afterEach(() => {
  window.location = { hash: '' };
});

describe('AnimalView — animal-static edit consequence', () => {
  it('Identity: saving an Edit-profile change surfaces the re-export consequence', async () => {
    const user = userEvent.setup();
    renderView('days');

    await user.click(screen.getByRole('button', { name: /actions for laurent/i }));
    await user.click(screen.getByRole('menuitem', { name: /edit profile/i }));
    // Make the form dirty, then commit through the confirm.
    await user.clear(screen.getByLabelText(/genotype/i));
    await user.type(screen.getByLabelText(/genotype/i), 'scn2a');
    await user.click(screen.getByRole('button', { name: /save profile changes/i }));
    await user.click(screen.getByRole('button', { name: /update profile/i }));

    expect(screen.getByText(/already-exported day now needs? re-export/i)).toBeInTheDocument();
  });

  it('Cameras: deleting a camera surfaces the re-export consequence', async () => {
    const user = userEvent.setup();
    renderView('cameras');

    await user.click(screen.getByRole('button', { name: /delete camera 0/i }));
    // The camera-delete confirm dialog → confirm.
    await user.click(screen.getByRole('button', { name: /^delete$/i }));

    expect(screen.getByText(/already-exported day now needs? re-export/i)).toBeInTheDocument();
  });
});
