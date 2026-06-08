/**
 * Tests for the catalog/library setup tabs mounted into AnimalView (Phase 3-3 — tabbed-workspace-ia).
 *
 * Phase 3-3 replaces the Phase-1 placeholder for the `recording-system`, `cameras`, `dio`, and
 * `optogenetics` tabs with their extracted containers (from 3-1), adds their scope descriptors and
 * the optogenetics status chip, and hoists the 3-field RawCorruptionBanner to the AnimalView level
 * (charter decision 1). Uses the REAL containers (no mocks) so the integration is genuine.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { StoreProvider } from '../../../state/StoreContext';
import { AnimalView } from '../index';

/**
 * A configured animal whose four catalog sections render their real content.
 * @param {object} [overrides] - Fields to override on the base animal record.
 * @returns {object} The remy animal record.
 */
function buildAnimal(overrides = {}) {
  return {
    id: 'remy',
    subject: { subject_id: 'remy', species: 'Rattus norvegicus', sex: 'M' },
    devices: {
      electrode_groups: [],
      ntrode_electrode_group_channel_map: [],
      data_acq_device: [{ name: 'SpikeGadgets', system: 'SpikeGadgets', amplifier: 'Intan', adc_circuit: 'Intan' }],
    },
    technicalDefaults: { raw_data_to_volts: 0.195, times_period_multiplier: 1.5 },
    cameras: [{ id: 0, camera_name: 'overhead_camera', meters_per_pixel: 0.001, manufacturer: 'AV', model: 'Mako', lens: 'Fuji' }],
    behavioral_events: [{ name: 'Din1', description: 'reward' }],
    optogenetics: undefined,
    configurationHistory: [
      { version: 1, date: '2023-06-22', description: 'Initial', devices: { electrode_groups: [], ntrode_electrode_group_channel_map: [] }, appliedToDays: [] },
    ],
    days: [],
    ...overrides,
  };
}

/**
 * Render AnimalView for a tab against a seeded store.
 * @param {string} tab - The active tab.
 * @param {object} [animal] - The remy animal record.
 * @returns {object} render result
 */
function renderView(tab, animal = buildAnimal()) {
  return render(
    <StoreProvider initialState={{ workspace: { animals: { remy: animal }, days: {}, settings: {} } }}>
      <AnimalView animalId="remy" tab={tab} />
    </StoreProvider>
  );
}

const PLACEHOLDER = /this section moves here in a later phase/i;

describe('AnimalView — catalog/library tabs render (Phase 3-3)', () => {
  beforeEach(() => {
    delete window.location;
    window.location = { hash: '#/animal/remy/recording-system' };
  });
  afterEach(() => {
    window.location = { hash: '' };
  });

  it('renders the recording-system container, not the placeholder', () => {
    renderView('recording-system');
    expect(screen.queryByText(PLACEHOLDER)).not.toBeInTheDocument();
    // DataAcqSection surfaces the seeded device name in its section (name + system both carry it).
    expect(screen.getAllByDisplayValue('SpikeGadgets').length).toBeGreaterThan(0);
  });

  it('renders the cameras container, not the placeholder', () => {
    renderView('cameras');
    expect(screen.queryByText(PLACEHOLDER)).not.toBeInTheDocument();
    expect(screen.getByText('overhead_camera')).toBeInTheDocument();
  });

  it('renders the dio container, not the placeholder', () => {
    renderView('dio');
    expect(screen.queryByText(PLACEHOLDER)).not.toBeInTheDocument();
    expect(screen.getByText('Din1')).toBeInTheDocument();
  });

  it('renders the optogenetics container, not the placeholder', () => {
    renderView('optogenetics');
    expect(screen.queryByText(PLACEHOLDER)).not.toBeInTheDocument();
  });
});

describe('AnimalView — catalog tab scope descriptors (Phase 3-3)', () => {
  beforeEach(() => {
    delete window.location;
    window.location = { hash: '#/animal/remy/recording-system' };
  });
  afterEach(() => {
    window.location = { hash: '' };
  });

  it('recording-system honesty: "shared across all days", no per-day framing', () => {
    renderView('recording-system');
    expect(screen.getByText(/shared across all days/i)).toBeInTheDocument();
    expect(screen.queryByText(/apply.*per day|apply to days as needed/i)).not.toBeInTheDocument();
  });

  it('cameras scope descriptor', () => {
    renderView('cameras');
    expect(screen.getByText(/catalog — referenced per day/i)).toBeInTheDocument();
  });

  it('dio scope descriptor', () => {
    renderView('dio');
    expect(screen.getByText(/library — opt in per day/i)).toBeInTheDocument();
  });
});

describe('AnimalView — optogenetics status chip (Phase 3-3)', () => {
  beforeEach(() => {
    delete window.location;
    window.location = { hash: '#/animal/remy/optogenetics' };
  });
  afterEach(() => {
    window.location = { hash: '' };
  });

  it('shows "Not used — no stimulation" for an opto-free animal', () => {
    renderView('optogenetics'); // optogenetics: undefined
    expect(screen.getByText(/not used — no stimulation/i)).toBeInTheDocument();
  });

  it('does not show the chip for an opto-configured animal', () => {
    const animal = buildAnimal({
      // A configured opto carries all three lists (the editor initializes them); a non-empty
      // excitation source makes getAnimalSectionStatus report it as set up.
      optogenetics: { opto_excitation_source: [{ name: 'laser', wavelength_in_nm: 473 }], optical_fiber: [], virus_injection: [] },
    });
    renderView('optogenetics', animal);
    expect(screen.queryByText(/not used — no stimulation/i)).not.toBeInTheDocument();
  });
});

describe('AnimalView — unsaved-edit guard extends to the CameraModal (charter decision 2)', () => {
  beforeEach(() => {
    delete window.location;
    window.location = { hash: '#/animal/remy/cameras' };
  });
  afterEach(() => {
    window.location = { hash: '' };
  });

  /**
   * Render the cameras tab and open the CameraModal so there are pending edits.
   * @returns {object} The userEvent instance for driving subsequent interactions.
   */
  async function renderWithOpenCameraModal() {
    const user = userEvent.setup();
    renderView('cameras');
    await user.click(screen.getByRole('button', { name: /add camera/i }));
    expect(screen.getByRole('heading', { name: /add camera/i })).toBeInTheDocument();
    return user;
  }

  it('intercepts a section-nav switch with the discard confirm when the CameraModal is open', async () => {
    const user = await renderWithOpenCameraModal();
    await user.click(screen.getByRole('link', { name: /^recording system$/i }));
    expect(screen.getByRole('alertdialog', { name: /discard unsaved changes/i })).toBeInTheDocument();
  });

  it('cancel keeps the cameras tab and the open CameraModal', async () => {
    const user = await renderWithOpenCameraModal();
    await user.click(screen.getByRole('link', { name: /^recording system$/i }));
    await user.click(screen.getByRole('button', { name: /keep editing/i }));
    expect(screen.queryByRole('alertdialog', { name: /discard unsaved changes/i })).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /add camera/i })).toBeInTheDocument();
    expect(window.location.hash).toBe('#/animal/remy/cameras');
  });

  it('confirm navigates away and dismisses the guard', async () => {
    const user = await renderWithOpenCameraModal();
    await user.click(screen.getByRole('link', { name: /^recording system$/i }));
    await user.click(screen.getByRole('button', { name: /discard changes/i }));
    expect(screen.queryByRole('alertdialog', { name: /discard unsaved changes/i })).not.toBeInTheDocument();
    expect(window.location.hash).toBe('#/animal/remy/recording-system');
  });
});
