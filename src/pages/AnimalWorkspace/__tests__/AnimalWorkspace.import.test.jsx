/**
 * The workspace's "Import YAML…" entry point. It must be reachable both from the empty state
 * (beside "Create Animal") and from the populated picker header (beside "+ New Animal"), and
 * clicking it routes to the full-page Import & Repair screen (#/import). The existing create flow
 * stays unchanged (routes to the wizard at #/home).
 */
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { StoreProvider } from '../../../state/StoreContext';
import { AnimalWorkspace } from '../index';

const originalHash = window.location.hash;
afterEach(() => {
  window.location.hash = originalHash;
});

const existing = {
  id: 'remy',
  subject: { subject_id: 'remy', species: 'Rattus norvegicus', sex: 'M' },
  devices: { electrode_groups: [], ntrode_electrode_group_channel_map: [], data_acq_device: [] },
  cameras: [],
  configurationHistory: [],
  days: [],
};

/**
 * Render the picker with the given animals.
 * @param {object} [animals] - workspace.animals (default: one existing animal).
 * @returns {object} render result
 */
function renderPicker(animals = { remy: existing }) {
  return render(
    <StoreProvider initialState={{ workspace: { animals, days: {}, settings: {} } }}>
      <AnimalWorkspace />
    </StoreProvider>
  );
}

describe('AnimalWorkspace — Import YAML entry point', () => {
  it('shows an "Import YAML…" button in the populated picker header and routes to #/import', async () => {
    const user = userEvent.setup();
    window.location.hash = '#/workspace';
    renderPicker();

    const trigger = screen.getByRole('button', { name: /import yaml/i });
    expect(trigger).toBeInTheDocument();

    await user.click(trigger);
    expect(window.location.hash).toBe('#/import');
  });

  it('shows an "Import YAML…" button in the empty state and routes to #/import', async () => {
    const user = userEvent.setup();
    window.location.hash = '#/workspace';
    renderPicker({});

    const trigger = screen.getByRole('button', { name: /import yaml/i });
    expect(trigger).toBeInTheDocument();

    await user.click(trigger);
    expect(window.location.hash).toBe('#/import');
  });

  it('the create flow is independent of import (the create button routes to the wizard at #/home)', async () => {
    const user = userEvent.setup();
    window.location.hash = '#/workspace';
    renderPicker();

    await user.click(screen.getByRole('button', { name: /new animal/i }));
    expect(window.location.hash).toBe('#/home');
  });
});
