/**
 * Create / import entry points on the Animals home (epoch-editor Phase 6).
 *
 * From-scratch creation is the guided wizard at `#/home` — the picker's "+ New Animal" and the
 * empty-state "Create Animal" navigate there (the old inline AnimalCreationForm panel was retired).
 * The wizard's "Import a YAML…" start option routes back via `#/workspace?import=1`, which opens the
 * existing import dialog. Cancelling/aborting is the wizard's own concern (covered in
 * CreateAnimalWizard.test.jsx); here we pin the navigation + the import handshake.
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

describe('AnimalWorkspace — create / import entry points', () => {
  it('"+ New Animal" navigates to the guided create wizard at #/home', async () => {
    const user = userEvent.setup();
    window.location.hash = '#/workspace';
    renderPicker();

    await user.click(screen.getByRole('button', { name: /new animal/i }));
    expect(window.location.hash).toBe('#/home');
  });

  it('the empty-state "Create Animal" action navigates to #/home', async () => {
    const user = userEvent.setup();
    window.location.hash = '#/workspace';
    renderPicker({});

    await user.click(screen.getByRole('button', { name: /create.*animal/i }));
    expect(window.location.hash).toBe('#/home');
  });

  it('opens the import dialog on the #/workspace?import=1 handshake (from the wizard start option)', () => {
    window.location.hash = '#/workspace?import=1';
    renderPicker();
    // The wizard's "Import a YAML…" routes here; the dialog opens without a click.
    expect(screen.getByRole('dialog', { name: /import/i })).toBeInTheDocument();
    // The transient ?import=1 is stripped so Back / reload doesn't reopen it.
    expect(window.location.hash).toBe('#/workspace');
  });
});
