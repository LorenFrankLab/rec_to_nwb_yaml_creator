/**
 * Tests for AnimalView — the tabbed animal shell (Phase 1 — tabbed-workspace-ia).
 *
 * Covers Task 1.1 (section-nav as a navigation landmark with aria-current), Task 1.2 (the days
 * tab hosts the shared RecordingDaysTab), the Phase-1 placeholder for not-yet-extracted setup
 * tabs, and the loading/not-found guard (Task 1.5-lite).
 */

import { describe, it, expect } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { StoreProvider } from '../../../state/StoreContext';
import { AnimalView } from '../index';

const remy = {
  id: 'remy',
  subject: { subject_id: 'remy', species: 'Rattus norvegicus', sex: 'M' },
  devices: { electrode_groups: [], ntrode_electrode_group_channel_map: [], data_acq_device: [] },
  cameras: [],
  configurationHistory: [
    { version: 1, date: '2024-01-02', description: 'Initial', devices: { electrode_groups: [] }, appliedToDays: [] },
  ],
  days: ['remy-2023-06-22'],
};
const days = {
  'remy-2023-06-22': {
    animalId: 'remy',
    date: '2023-06-22',
    session: { session_id: 'remy_20230622' },
    state: { draft: false, validated: true, exported: false },
  },
};

/**
 * Render AnimalView for an animal/tab against a seeded store.
 * @param {string} tab - The active tab.
 * @param {object} [opts] - Options.
 * @param {string} [opts.animalId] - The animal id to view.
 * @param {object} [opts.animals] - workspace.animals override.
 * @returns {object} render result
 */
function renderView(tab, { animalId = 'remy', animals = { remy } } = {}) {
  return render(
    <StoreProvider initialState={{ workspace: { animals, days, settings: {} } }}>
      <AnimalView animalId={animalId} tab={tab} />
    </StoreProvider>
  );
}

describe('AnimalView — section nav (Task 1.1)', () => {
  it('renders a navigation landmark labelled "Animal sections" with all eight section links', () => {
    renderView('days');
    const nav = screen.getByRole('navigation', { name: /animal sections/i });
    const links = within(nav).getAllByRole('link');
    const hrefs = links.map((a) => a.getAttribute('href'));
    expect(hrefs).toEqual([
      '#/animal/remy/days',
      '#/animal/remy/export',
      '#/animal/remy/electrode-groups',
      '#/animal/remy/channel-maps',
      '#/animal/remy/recording-system',
      '#/animal/remy/cameras',
      '#/animal/remy/dio',
      '#/animal/remy/optogenetics',
    ]);
  });

  it('marks only the active tab with aria-current="page"', () => {
    renderView('cameras');
    const nav = screen.getByRole('navigation', { name: /animal sections/i });
    const current = within(nav).getAllByRole('link').filter((a) => a.getAttribute('aria-current') === 'page');
    expect(current).toHaveLength(1);
    expect(current[0]).toHaveAttribute('href', '#/animal/remy/cameras');
  });

  it('groups the nav under "Day work" and "Animal setup" headings', () => {
    renderView('days');
    const nav = screen.getByRole('navigation', { name: /animal sections/i });
    expect(within(nav).getByText('Day work')).toBeInTheDocument();
    expect(within(nav).getByText('Animal setup')).toBeInTheDocument();
  });
});

describe('AnimalView — tab panels (Task 1.2)', () => {
  it('hosts the Recording Days pane in the days tab', () => {
    renderView('days');
    expect(screen.getByRole('heading', { name: /recording days for remy/i })).toBeInTheDocument();
  });

  it('renders a placeholder (not the days pane) for a not-yet-extracted setup tab', () => {
    renderView('cameras');
    expect(screen.queryByRole('heading', { name: /recording days for remy/i })).not.toBeInTheDocument();
    // Placeholder points the user at the still-live Animal Editor for now.
    const link = screen.getByRole('link', { name: /animal setup/i });
    expect(link).toHaveAttribute('href', '#/animal/remy/editor');
  });
});

describe('AnimalView — not-found guard (Task 1.5)', () => {
  it('shows "Animal not found" when the id is absent but other animals exist', () => {
    renderView('days', { animalId: 'ghost', animals: { remy } });
    expect(screen.getByRole('heading', { name: /animal not found/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /back to workspace/i })).toHaveAttribute('href', '#/workspace');
  });

  it('shows "Animal not found" (never a perpetual "Loading…") for an empty workspace', () => {
    // The store hydrates synchronously, so an empty workspace is genuinely empty, not loading.
    renderView('days', { animalId: 'remy', animals: {} });
    expect(screen.getByRole('heading', { name: /animal not found/i })).toBeInTheDocument();
    expect(screen.queryByText(/loading/i)).not.toBeInTheDocument();
  });

  it('falls back to "Animal not found" after deleting the viewed (sole) animal — no perpetual loading', async () => {
    const user = userEvent.setup();
    renderView('days'); // remy is the only animal
    // Danger-zone delete inside the hosted RecordingDaysTab, then confirm.
    await user.click(screen.getByRole('button', { name: /delete this animal/i }));
    await user.click(screen.getByRole('button', { name: /^delete animal$/i }));
    expect(await screen.findByRole('heading', { name: /animal not found/i })).toBeInTheDocument();
    expect(screen.queryByText(/loading/i)).not.toBeInTheDocument();
  });
});
