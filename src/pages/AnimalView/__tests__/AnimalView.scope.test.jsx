/**
 * @file Animal-page scope affordances: the header scope chips and the Electrode Groups configuration
 * card are rendered from the animal view-model (vm.summary / vm.configCard).
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { StoreProvider } from '../../../state/StoreContext';
import { AnimalView } from '../index';
import { buildRealisticWorkspace } from '../../../__tests__/fixtures/workspaceBuilders';

/**
 * Render AnimalView for a tab against a seeded realistic workspace.
 * @param {string} tab - The active tab.
 * @returns {object} render result
 */
function renderView(tab) {
  const { animal, day } = buildRealisticWorkspace();
  return render(
    <StoreProvider
      initialState={{ workspace: { animals: { [animal.id]: animal }, days: { [day.id]: day }, settings: {} } }}
    >
      <AnimalView animalId={animal.id} tab={tab} />
    </StoreProvider>
  );
}

beforeEach(() => {
  delete window.location;
  window.location = { hash: '#/animal/remy/days' };
});
afterEach(() => {
  window.location = { hash: '' };
});

describe('AnimalView — scope chips', () => {
  it('renders the animal-static scope from the summary view-model', () => {
    renderView('days');
    const summary = screen.getByLabelText('Animal summary');
    expect(within(summary).getByText('Wild Type')).toBeInTheDocument();
    expect(within(summary).getByText('Rattus norvegicus')).toBeInTheDocument();
    expect(within(summary).getByText('Config v1')).toBeInTheDocument();
    expect(within(summary).getByText(/8 probes — CA1, CA3, PFC/)).toBeInTheDocument();
    expect(within(summary).getByText(/Team: Guidera, Jennifer, Comrie, Alison/)).toBeInTheDocument();
    expect(within(summary).queryByText('Optogenetics')).not.toBeInTheDocument();
  });
});

describe('AnimalView — configuration card', () => {
  it('renders the configuration card on the Electrode Groups tab', () => {
    renderView('electrode-groups');
    const card = screen.getByRole('region', { name: 'Configuration' });
    expect(within(card).getByText(/v1 \(current\) · since 2023-06-22 · 1 day/)).toBeInTheDocument();
    expect(within(card).getByText('Probe 0 · CA1')).toBeInTheDocument();
  });

  it('does not render the configuration card on the Days tab', () => {
    renderView('days');
    expect(screen.queryByRole('region', { name: 'Configuration' })).not.toBeInTheDocument();
  });
});
