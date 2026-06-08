/**
 * Tests for the subject profile + reconfiguration context re-homed onto the AnimalView header
 * (Phase 3-4 — tabbed-workspace-ia).
 *
 * Subject facts and the reconfiguration context are NOT tabs — they belong in the animal header
 * band, visible regardless of which setup tab is open, and must survive the legacy stepper's Phase 5
 * decommission. They render via the SAME AnimalProfileSection + the shared ReconfigurationContextBanner
 * the stepper uses (one implementation, no drift).
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { StoreProvider, useStoreContext } from '../../../state/StoreContext';
import { AnimalView } from '../index';

/**
 * A two-version animal with one recording day (so the blast-radius confirm has a non-zero count).
 * @param {object} [overrides] - Fields to override on the base animal record.
 * @returns {object} The remy animal record.
 */
function buildAnimal(overrides = {}) {
  return {
    id: 'remy',
    subject: { subject_id: 'remy', species: 'Rattus norvegicus', sex: 'M' },
    devices: { electrode_groups: [], ntrode_electrode_group_channel_map: [], data_acq_device: [] },
    cameras: [],
    configurationHistory: [
      { version: 1, date: '2023-06-22', description: 'Initial', devices: { electrode_groups: [], ntrode_electrode_group_channel_map: [] }, appliedToDays: [] },
      { version: 2, date: '2023-07-10', description: 'Lowered tetrodes', devices: { electrode_groups: [], ntrode_electrode_group_channel_map: [] }, appliedToDays: [] },
    ],
    days: ['remy-2023-06-22'],
    ...overrides,
  };
}

const days = { 'remy-2023-06-22': { animalId: 'remy', date: '2023-06-22', session: { session_id: 'remy_20230622' }, state: { draft: true } } };

/**
 * Exposes remy's subject.species from the live store for assertions.
 * @returns {React.Element} A <pre> with the current species string.
 */
function SpeciesProbe() {
  const { model } = useStoreContext();
  return <pre data-testid="species">{model.workspace.animals.remy?.subject?.species || ''}</pre>;
}

/**
 * Render AnimalView for a tab against a seeded store, with a species probe.
 * @param {string} tab - The active tab.
 * @param {object} [animal] - The remy animal record.
 * @returns {object} render result
 */
function renderView(tab, animal = buildAnimal()) {
  return render(
    <StoreProvider initialState={{ workspace: { animals: { remy: animal }, days, settings: {} } }}>
      <AnimalView animalId="remy" tab={tab} />
      <SpeciesProbe />
    </StoreProvider>
  );
}

describe('AnimalView — subject profile in the header (Phase 3-4)', () => {
  beforeEach(() => {
    delete window.location;
    window.location = { hash: '#/animal/remy/electrode-groups' };
  });
  afterEach(() => {
    window.location = { hash: '' };
  });

  /**
   * Open the header ⋮ → "Edit profile…" to reveal the profile dialog.
   * @param {object} user - userEvent session.
   */
  async function openProfile(user) {
    await user.click(screen.getByRole('button', { name: /actions for remy/i }));
    await user.click(screen.getByRole('menuitem', { name: /edit profile/i }));
  }

  it('offers "Edit profile…" in the header ⋮ on a setup tab', async () => {
    const user = userEvent.setup();
    renderView('electrode-groups');
    await user.click(screen.getByRole('button', { name: /actions for remy/i }));
    expect(screen.getByRole('menuitem', { name: /edit profile/i })).toBeInTheDocument();
  });

  it('offers "Edit profile…" on a different tab too (header ⋮, not a tab)', async () => {
    const user = userEvent.setup();
    delete window.location;
    window.location = { hash: '#/animal/remy/cameras' };
    renderView('cameras');
    await user.click(screen.getByRole('button', { name: /actions for remy/i }));
    expect(screen.getByRole('menuitem', { name: /edit profile/i })).toBeInTheDocument();
  });

  it('editing + confirming the blast-radius writes the subject via updateAnimal', async () => {
    const user = userEvent.setup();
    renderView('electrode-groups');
    await openProfile(user);
    const speciesInput = screen.getByLabelText(/^species$/i);
    await user.clear(speciesInput);
    await user.type(speciesInput, 'Mus musculus');
    await user.click(screen.getByRole('button', { name: /save profile changes/i }));
    // Blast-radius confirm fires because the animal has recording days.
    const confirm = screen.getByRole('dialog', { name: /update animal profile/i });
    expect(within(confirm).getByText(/all 1 recording day/i)).toBeInTheDocument();
    await user.click(within(confirm).getByRole('button', { name: /update profile/i }));
    expect(screen.getByTestId('species').textContent).toBe('Mus musculus');
  });
});

describe('AnimalView — reconfiguration context banner in the header (Phase 3-4)', () => {
  afterEach(() => {
    window.location = { hash: '' };
  });

  it('shows the "review vN — current latest is vM" warning for a non-latest reconfigure context', () => {
    delete window.location;
    window.location = { hash: '#/animal/remy/electrode-groups?context=reconfigure&version=1' };
    renderView('electrode-groups'); // latest configuration version is 2
    const banner = document.querySelector('.configuration-edit-context');
    expect(banner).toBeInTheDocument();
    expect(banner).toHaveClass('configuration-edit-context-warning');
    expect(banner).toHaveTextContent(/Review configuration v1; current latest is v2/);
  });

  it('does not render the reconfig banner without a context=reconfigure param', () => {
    delete window.location;
    window.location = { hash: '#/animal/remy/electrode-groups' };
    renderView('electrode-groups');
    expect(document.querySelector('.configuration-edit-context')).not.toBeInTheDocument();
  });
});
