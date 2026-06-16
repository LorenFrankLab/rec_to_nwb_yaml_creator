/**
 * @file Animals home table — rows, links, opto tag, search + filters, and the onboarding empty state.
 * Companion to AnimalWorkspace.test.jsx (which pins the picker's behavioral contracts: create/import
 * buttons, the per-animal ⋮ menu, the ?animal handshake). This file covers the home table the redesign
 * introduces.
 */
import { describe, it, expect } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { StoreProvider } from '../../../state/StoreContext';
import { AnimalWorkspace } from '../index';
import { buildRealisticWorkspace } from '../../../__tests__/fixtures/workspaceBuilders';

/** A ready (Wild Type) animal + an opto (PV-Cre) animal with no days. */
function buildHomeWorkspace() {
  const { animal, day } = buildRealisticWorkspace();
  const laurent = {
    id: 'laurent',
    subject: { subject_id: 'laurent', genotype: 'PV-Cre', species: 'Rattus norvegicus' },
    days: [],
    optogenetics: { optical_fiber: [{ id: 0 }], opto_excitation_source: [], virus_injection: [] },
  };
  return {
    animalId: animal.id,
    workspace: { animals: { [animal.id]: animal, laurent }, days: { [day.id]: day }, settings: {} },
  };
}

/**
 * Render the Animals home seeded with the given workspace.
 * @param {object} workspace - The workspace slice (animals / days / settings).
 * @returns {object} render result
 */
function renderHome(workspace) {
  return render(
    <StoreProvider initialState={{ workspace }}>
      <AnimalWorkspace />
    </StoreProvider>
  );
}

describe('Animals home — table', () => {
  it('renders one linked row per animal with its day count and rolled-up status', () => {
    const { animalId, workspace } = buildHomeWorkspace();
    renderHome(workspace);

    expect(screen.getByRole('link', { name: animalId })).toHaveAttribute(
      'href',
      `#/animal/${animalId}/days`
    );
    expect(screen.getByRole('link', { name: 'laurent' })).toHaveAttribute(
      'href',
      '#/animal/laurent/days'
    );
    // Status rollups are surfaced (ready for the valid day; no-days for the fresh animal).
    expect(screen.getByText('1 ready')).toBeInTheDocument();
    expect(screen.getByText('No recording days')).toBeInTheDocument();
  });

  it('shows the opto tag only on the optogenetics animal', () => {
    const { animalId, workspace } = buildHomeWorkspace();
    renderHome(workspace);
    const optoRow = screen.getByRole('link', { name: 'laurent' }).closest('tr');
    expect(within(optoRow).getByText('opto')).toBeInTheDocument();
    const readyRow = screen.getByRole('link', { name: animalId }).closest('tr');
    expect(within(readyRow).queryByText('opto')).not.toBeInTheDocument();
  });

  it('filters rows by the search box (id / genotype)', async () => {
    const user = userEvent.setup();
    const { animalId, workspace } = buildHomeWorkspace();
    renderHome(workspace);

    await user.type(screen.getByRole('searchbox', { name: /search animals/i }), 'laurent');
    expect(screen.getByRole('link', { name: 'laurent' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: animalId })).not.toBeInTheDocument();
  });

  it('narrows rows with the genotype filter', async () => {
    const user = userEvent.setup();
    const { animalId, workspace } = buildHomeWorkspace();
    renderHome(workspace);

    await user.selectOptions(screen.getByRole('combobox', { name: /genotype/i }), 'PV-Cre');
    expect(screen.getByRole('link', { name: 'laurent' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: animalId })).not.toBeInTheDocument();
  });

  it('narrows rows with the status filter', async () => {
    const user = userEvent.setup();
    const { animalId, workspace } = buildHomeWorkspace();
    renderHome(workspace);

    await user.selectOptions(screen.getByRole('combobox', { name: /status/i }), 'Ready');
    expect(screen.getByRole('link', { name: animalId })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'laurent' })).not.toBeInTheDocument();
  });
});

describe('Animals home — empty state', () => {
  it('shows the onboarding card with both Create and Import CTAs when there are no animals', () => {
    render(
      <StoreProvider initialState={{ workspace: { animals: {}, days: {}, settings: {} } }}>
        <AnimalWorkspace />
      </StoreProvider>
    );
    expect(screen.getByText(/no animals/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^create animal$/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /import yaml/i })).toBeInTheDocument();
  });
});
