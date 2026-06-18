/**
 * Tests for AnimalView — the tabbed animal shell (Phase 1 — tabbed-workspace-ia).
 *
 * Covers Task 1.1 (section-nav as a navigation landmark with aria-current), Task 1.2 (the days
 * tab hosts the shared RecordingDaysTab), the Phase-1 placeholder for not-yet-extracted setup
 * tabs, and the loading/not-found guard (Task 1.5-lite).
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
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
  it('renders a navigation landmark labelled "Animal sections" with all seven section links', () => {
    renderView('days');
    const nav = screen.getByRole('navigation', { name: /animal sections/i });
    const links = within(nav).getAllByRole('link');
    const hrefs = links.map((a) => a.getAttribute('href'));
    expect(hrefs).toEqual([
      '#/animal/remy/days',
      '#/animal/remy/export',
      '#/animal/remy/electrode-groups',
      '#/animal/remy/recording-system',
      '#/animal/remy/cameras',
      '#/animal/remy/task-types',
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

describe('AnimalView — URL canonicalization', () => {
  let originalHash;
  beforeEach(() => {
    originalHash = window.location.hash;
  });
  afterEach(() => {
    window.location.hash = originalHash;
  });

  it('replaces a bare #/animal/:id URL with the canonical #/animal/:id/days', () => {
    window.location.hash = '#/animal/remy';
    renderView('days'); // the router resolves the bare URL to the days tab
    expect(window.location.hash).toBe('#/animal/remy/days');
  });

  it('replaces an unknown-tab URL with the canonical resolved tab', () => {
    window.location.hash = '#/animal/remy/banana';
    renderView('days'); // unknown tab resolves to days
    expect(window.location.hash).toBe('#/animal/remy/days');
  });

  it('does not rewrite an already-canonical URL (no spurious replaceState)', () => {
    window.location.hash = '#/animal/remy/cameras';
    const spy = vi.spyOn(window.history, 'replaceState');
    renderView('cameras');
    expect(window.location.hash).toBe('#/animal/remy/cameras');
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });
});

describe('AnimalView — section-nav status (Task 1.1c)', () => {
  const configuredRemy = {
    ...remy,
    devices: {
      electrode_groups: [{ id: 0, device_type: 'tetrode_12.5', location: 'CA1' }],
      ntrode_electrode_group_channel_map: [{ ntrode_id: 0, electrode_group_id: 0, map: { 0: 0 } }],
      data_acq_device: [{ name: 'SpikeGadgets' }],
    },
    cameras: [{ id: 0, camera_name: 'overhead' }],
    behavioral_events: [{ name: 'Din1' }],
    optogenetics: { opto_excitation_source: [{ name: 'laser' }] },
  };

  it('shows a "not set up" todo ring on never-configured setup sections (the bare remy fixture)', () => {
    renderView('days'); // remy has empty devices / cameras / behavioral_events
    expect(screen.getByRole('link', { name: /electrode groups — not set up/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /cameras — not set up/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /optogenetics — not set up/i })).toBeInTheDocument();
  });

  it('does not mark the day-work sections as todo', () => {
    renderView('days');
    expect(screen.getByRole('link', { name: /^recording days\b/i })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /recording days — not set up/i })).not.toBeInTheDocument();
  });

  it('clears the todo ring once a section is configured', () => {
    renderView('days', { animals: { remy: configuredRemy } });
    expect(screen.queryByRole('link', { name: /cameras — not set up/i })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: /^cameras$/i })).toBeInTheDocument();
  });
});

describe('AnimalView — section-nav count + chevron affordance (decision 10)', () => {
  const configuredRemy = {
    ...remy,
    devices: {
      electrode_groups: [
        { id: 0, device_type: 'tetrode_12.5', location: 'CA1' },
        { id: 1, device_type: 'tetrode_12.5', location: 'CA1' },
      ],
      ntrode_electrode_group_channel_map: [{ ntrode_id: 0, electrode_group_id: 0, map: { 0: 0 } }],
      data_acq_device: [{ name: 'SpikeGadgets' }],
    },
    cameras: [{ id: 0, camera_name: 'overhead' }],
    behavioral_events: [{ name: 'Din1' }],
  };

  it('shows the per-setup-section item count and a trailing chevron, hidden from assistive tech', () => {
    renderView('days', { animals: { remy: configuredRemy } });
    const eg = screen.getByRole('link', { name: /^electrode groups$/i });
    // The count is visual "information scent" (aria-hidden) so it does NOT change the link's
    // accessible name (the `^electrode groups$` query above still resolves).
    const count = within(eg).getByText('2');
    expect(count).toHaveAttribute('aria-hidden', 'true');
    const chev = within(eg).getByText('›');
    expect(chev).toHaveAttribute('aria-hidden', 'true');
    // Cameras has exactly one camera.
    expect(within(screen.getByRole('link', { name: /^cameras$/i })).getByText('1')).toBeInTheDocument();
  });

  it('shows the recording-day count and a validation "N ready" count', () => {
    // remy owns one present day record → Recording Days count "1". The "ready" figure comes from
    // the export validator (buildAnimalRows), so assert its shape (a number + "ready"), not a fixed
    // value the fixture doesn't pin.
    renderView('days', { animals: { remy: configuredRemy } });
    const nav = screen.getByRole('navigation', { name: /animal sections/i });
    expect(within(within(nav).getByRole('link', { name: /^recording days\b/i })).getByText('1')).toBeInTheDocument();
    expect(
      within(within(nav).getByRole('link', { name: /validation & export/i })).getByText(/\d+ ready/i)
    ).toBeInTheDocument();
  });

  it('never-configured setup sections keep the ○ ring (no numeric count)', () => {
    renderView('days'); // bare remy
    const eg = screen.getByRole('link', { name: /electrode groups — not set up/i });
    // The todo ring stands in for the count; no "0" is shown.
    expect(within(eg).queryByText('0')).not.toBeInTheDocument();
    expect(within(eg).getByText('○')).toBeInTheDocument();
    // The chevron is still present on a todo row.
    expect(within(eg).getByText('›')).toBeInTheDocument();
  });
});

describe('AnimalView — tab panels (Task 1.2)', () => {
  it('hosts the Recording Days pane in the days tab', () => {
    renderView('days');
    expect(screen.getByRole('heading', { name: /recording days for remy/i })).toBeInTheDocument();
  });

  it('hosts the per-animal Validation & Export surface in the export tab (Phase 3-5)', () => {
    // All tabs are extracted now; `export` renders the scoped ValidationSummary, not a placeholder.
    renderView('export');
    expect(screen.queryByRole('heading', { name: /recording days for remy/i })).not.toBeInTheDocument();
    expect(screen.queryByText(/this section moves here in a later phase/i)).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /this animal — readiness & export/i })).toBeInTheDocument();
  });
});

describe('AnimalView — not-found guard (Task 1.5)', () => {
  it('shows "Animal not found" when the id is absent but other animals exist', () => {
    renderView('days', { animalId: 'ghost', animals: { remy } });
    expect(screen.getByRole('heading', { name: /animal not found/i })).toBeInTheDocument();
    const back = screen.getByRole('link', { name: /back to workspace/i });
    expect(back).toHaveAttribute('href', '#/workspace');
    // The escape is a prominent styled action (matching the Day Editor's ErrorState), not a
    // bare inline link buried in a sentence — and it stays keyboard-reachable.
    expect(back).toHaveClass('error-state-action');
    expect(back.closest('p')).toBeNull();
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
    // Animal delete lives in the header ⋮ menu (Phase 4) → type-to-confirm dialog, then confirm.
    await user.click(screen.getByRole('button', { name: /actions for remy/i }));
    await user.click(screen.getByRole('menuitem', { name: /delete animal/i }));
    const dialog = screen.getByRole('alertdialog');
    await user.type(within(dialog).getByRole('textbox', { name: /type .* to confirm/i }), 'remy');
    await user.click(within(dialog).getByRole('button', { name: /^delete animal$/i }));
    expect(await screen.findByRole('heading', { name: /animal not found/i })).toBeInTheDocument();
    expect(screen.queryByText(/loading/i)).not.toBeInTheDocument();
  });
});
