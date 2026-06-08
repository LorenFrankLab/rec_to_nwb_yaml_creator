/**
 * Tests for the ?field= repair-landing highlight on AnimalView's setup tabs (Phase 3a.3).
 *
 * A repair deep-link now lands on `#/animal/:id/:tab?field=…`. The destination tab must orient the
 * user by highlighting the section the field belongs to (matching the Day Editor's repair-target
 * highlight), instead of dropping them on a long tab with no cue. It degrades to no-op when the
 * field has no matching section anchor.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { StoreProvider } from '../../../state/StoreContext';
import { AnimalView } from '../index';

const animal = {
  id: 'remy',
  subject: { subject_id: 'remy', species: 'Rattus norvegicus', sex: 'M' },
  devices: {
    electrode_groups: [{ id: 0, device_type: 'tetrode_12.5', location: 'CA1', targeted_location: 'CA1', targeted_x: 1, targeted_y: 2, targeted_z: 3, units: 'mm' }],
    ntrode_electrode_group_channel_map: [{ ntrode_id: 0, electrode_group_id: 0, bad_channels: [], map: { 0: 0 } }],
    data_acq_device: [{ name: 'SpikeGadgets', system: 'SpikeGadgets', amplifier: 'Intan', adc_circuit: 'Intan' }],
  },
  cameras: [],
  configurationHistory: [{ version: 1, date: '2023-06-22', description: 'i', devices: { electrode_groups: [], ntrode_electrode_group_channel_map: [] }, appliedToDays: [] }],
  days: [],
};

/**
 * Render AnimalView for a tab against a seeded store.
 * @param {string} tab - The active tab.
 * @returns {object} render result
 */
function renderView(tab) {
  return render(
    <StoreProvider initialState={{ workspace: { animals: { remy: animal }, days: {}, settings: {} } }}>
      <AnimalView animalId="remy" tab={tab} />
    </StoreProvider>
  );
}

describe('AnimalView — ?field= repair-landing highlight (Phase 3a.3)', () => {
  beforeEach(() => {
    delete window.location;
  });
  afterEach(() => {
    window.location = { hash: '' };
  });

  it('highlights the electrode-groups section when arriving with ?field=electrode_groups', async () => {
    window.location = { hash: '#/animal/remy/electrode-groups?field=electrode_groups' };
    renderView('electrode-groups');
    await waitFor(() =>
      expect(document.querySelector('[data-field-path="electrode_groups"]')).toHaveClass('repair-target-highlight')
    );
  });

  it('matches a specific field path against the section anchor (data_acq_device[0].name → recording-system)', async () => {
    window.location = { hash: '#/animal/remy/recording-system?field=data_acq_device%5B0%5D.name' };
    renderView('recording-system');
    await waitFor(() =>
      expect(document.querySelector('[data-field-path="data_acq_device"]')).toHaveClass('repair-target-highlight')
    );
  });

  it('renders the section anchor but does not highlight when there is no ?field=', () => {
    window.location = { hash: '#/animal/remy/cameras' };
    renderView('cameras');
    const anchor = document.querySelector('[data-field-path="cameras"]');
    expect(anchor).toBeInTheDocument();
    expect(anchor).not.toHaveClass('repair-target-highlight');
  });

  it('degrades silently when ?field= matches no section anchor on the tab', async () => {
    // A field that belongs to a different tab's anchor — nothing on the cameras tab matches it.
    window.location = { hash: '#/animal/remy/cameras?field=electrode_groups' };
    renderView('cameras');
    // The cameras anchor is present but never highlighted; no crash.
    await waitFor(() => expect(screen.getByTestId('panel-scope-cameras')).toBeInTheDocument());
    expect(document.querySelector('.repair-target-highlight')).toBeNull();
  });
});
