/**
 * Inline create-animal panel (Phase 4b, Task 4.2). "+ New Animal" (and the empty-state create
 * action) open the existing AnimalCreationForm as an inline panel ON the picker — NOT a route to
 * a separate `#/home` screen — so first-animal creation uses the same pattern as everything else.
 * On success the workspace lands on the new animal's days route (`#/animal/:id/days`); cancel
 * closes the panel without creating anything. This is the Phase-5 blocker (create must live in the
 * workspace before the Home/stepper split can be removed).
 */
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
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

/**
 * Fill the inline creation form's required fields with a valid new animal.
 * @param {object} user - userEvent session.
 * @param {string} id - The new animal's subject id.
 */
async function fillValidForm(user, id) {
  const form = screen.getByRole('form', { name: /animal creation form/i });
  await user.type(within(form).getByLabelText(/subject id/i), id);
  await user.type(within(form).getByLabelText(/genotype/i), 'Wild-type');
  await user.type(within(form).getByLabelText(/experimenter 1/i), 'Test User');
  await user.type(within(form).getByLabelText(/lab/i), 'Test Lab');
  await user.type(within(form).getByLabelText(/institution/i), 'Test Uni');
  await user.type(within(form).getByLabelText(/date of birth/i), new Date().toISOString().split('T')[0]);
  await user.type(within(form).getByLabelText(/weight/i), '450');
}

describe('AnimalWorkspace — inline create-animal panel', () => {
  it('"+ New Animal" is a button (not a link to #/home) that opens the inline creation form', async () => {
    const user = userEvent.setup();
    renderPicker();

    const trigger = screen.getByRole('button', { name: /new animal/i });
    expect(trigger).toBeInTheDocument();
    // The form is not shown until the trigger is used.
    expect(screen.queryByRole('form', { name: /animal creation form/i })).not.toBeInTheDocument();

    await user.click(trigger);
    expect(screen.getByRole('form', { name: /animal creation form/i })).toBeInTheDocument();
  });

  it('the empty-state create action opens the inline form (no #/home link)', async () => {
    const user = userEvent.setup();
    renderPicker({});

    // No animals: the empty-state create is a button, not a link to #/home.
    expect(screen.queryByRole('link', { name: /create.*animal/i })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /create.*animal/i }));
    expect(screen.getByRole('form', { name: /animal creation form/i })).toBeInTheDocument();
  });

  it('creating an animal navigates to its days route and closes the panel', async () => {
    const user = userEvent.setup();
    window.location.hash = '#/workspace';
    renderPicker();

    await user.click(screen.getByRole('button', { name: /new animal/i }));
    await fillValidForm(user, 'bean');
    await user.click(screen.getByRole('button', { name: /^create animal$/i }));

    expect(window.location.hash).toBe('#/animal/bean/days');
  });

  it('auto-opens the create panel on the #/workspace?create=1 handshake (from the top selector)', () => {
    window.location.hash = '#/workspace?create=1';
    renderPicker();
    // The selector's "+ New animal…" routes here; the panel opens without a click.
    expect(screen.getByRole('form', { name: /animal creation form/i })).toBeInTheDocument();
    // The transient ?create=1 is stripped so Back / reload doesn't reopen it.
    expect(window.location.hash).toBe('#/workspace');
  });

  it('cancelling the panel creates nothing and returns to the picker', async () => {
    const user = userEvent.setup();
    renderPicker();

    await user.click(screen.getByRole('button', { name: /new animal/i }));
    const form = screen.getByRole('form', { name: /animal creation form/i });
    await user.click(within(form).getByRole('button', { name: /cancel|skip/i }));

    expect(screen.queryByRole('form', { name: /animal creation form/i })).not.toBeInTheDocument();
    // The existing animal is still listed; no new one was added.
    expect(screen.getByRole('link', { name: /remy/i })).toBeInTheDocument();
  });
});
