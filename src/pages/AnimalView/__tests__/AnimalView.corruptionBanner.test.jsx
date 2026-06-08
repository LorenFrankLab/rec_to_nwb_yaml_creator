/**
 * Tests for the 3-field RawCorruptionBanner hoisted to the AnimalView level (Phase 3-3, charter
 * decision 1 — tabbed-workspace-ia).
 *
 * The banner covers `cameras` / `data_acq_device` / `configurationHistory`, which now span THREE
 * different setup tabs. Rendering it per-tab would let a sibling field's corruption hide when that
 * field's tab isn't open. Hoisting it ABOVE the panels makes corruption in any of the three visible
 * from every tab. It self-hides when clean, so it costs nothing on a healthy animal.
 */

import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { StoreProvider } from '../../../state/StoreContext';
import { AnimalView } from '../index';

/**
 * An animal with a corrupt (non-array) cameras field — a `data_acq_device` sibling lives on another tab.
 * @returns {object} The remy animal record with `cameras: 'nope'`.
 */
function corruptAnimal() {
  return {
    id: 'remy',
    subject: { subject_id: 'remy', species: 'Rattus norvegicus', sex: 'M' },
    devices: { electrode_groups: [], ntrode_electrode_group_channel_map: [], data_acq_device: [{ name: 'SG', system: 'SpikeGadgets', amplifier: 'Intan', adc_circuit: 'Intan' }] },
    cameras: 'nope', // corrupt
    behavioral_events: [],
    configurationHistory: [{ version: 1, date: '2023-06-22', description: 'i', devices: { electrode_groups: [], ntrode_electrode_group_channel_map: [] }, appliedToDays: [] }],
    days: [],
  };
}

/**
 * Render AnimalView for a tab against a seeded store.
 * @param {string} tab - The active tab.
 * @param {object} animal - The remy animal record.
 * @returns {object} render result
 */
function renderView(tab, animal) {
  return render(
    <StoreProvider initialState={{ workspace: { animals: { remy: animal }, days: {}, settings: {} } }}>
      <AnimalView animalId="remy" tab={tab} />
    </StoreProvider>
  );
}

describe('AnimalView — 3-field corruption banner (charter decision 1)', () => {
  afterEach(() => {
    window.location = { hash: '' };
  });

  it('shows the corrupt-cameras banner from a NON-owning tab (recording-system), exactly once', () => {
    delete window.location;
    window.location = { hash: '#/animal/remy/recording-system' };
    renderView('recording-system', corruptAnimal());
    const banners = screen.getAllByRole('alert', { name: /corrupt saved data/i });
    expect(banners).toHaveLength(1);
    expect(within(banners[0]).getByRole('button', { name: /^reset cameras$/i })).toBeInTheDocument();
  });

  it('also shows it from the dio tab (sibling-field visibility across tabs)', () => {
    delete window.location;
    window.location = { hash: '#/animal/remy/dio' };
    renderView('dio', corruptAnimal());
    expect(screen.getByRole('button', { name: /^reset cameras$/i })).toBeInTheDocument();
  });

  it('renders no corruption banner for a clean animal', () => {
    delete window.location;
    window.location = { hash: '#/animal/remy/cameras' };
    const clean = corruptAnimal();
    clean.cameras = [];
    renderView('cameras', clean);
    expect(screen.queryByRole('alert', { name: /corrupt saved data/i })).not.toBeInTheDocument();
  });
});
