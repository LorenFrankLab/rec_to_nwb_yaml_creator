/**
 * Tests for the ephys setup tabs mounted into AnimalView (Phase 3-2 — tabbed-workspace-ia).
 *
 * Phase 3-2 replaces the Phase-1 placeholder for the `electrode-groups` and `channel-maps` tabs
 * with their extracted containers (ElectrodeGroupsContainer / ChannelMapsContainer from 3-1), adds
 * the per-tab scope descriptors, and proves the channel-map auto-regen wiring still fires through
 * the tab path. Uses the REAL containers + modals (no mocks) so the integration is genuine.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { StoreProvider, useStoreContext } from '../../../state/StoreContext';
import { AnimalView } from '../index';

// A 4-shank probe → its generator yields 4 ntrodes (vs. the tetrode's 1), so a tetrode→4-shank
// edit changes the ntrode COUNT unambiguously (1 → 4) — mirrors the 3-1 characterization.
const FOUR_SHANK_DEVICE = '128c-4s8mm6cm-20um-40um-sl';

/**
 * A fully-valid single-tetrode animal whose electrode-groups table renders (not the needs-sync banner).
 * @returns {object} An animal record with one configured tetrode group + its ntrode map.
 */
function buildConfiguredAnimal() {
  return {
    id: 'remy',
    subject: { subject_id: 'remy', species: 'Rattus norvegicus', sex: 'M' },
    devices: {
      electrode_groups: [
        {
          id: 0,
          device_type: 'tetrode_12.5',
          location: 'CA1',
          description: 'CA1 tetrode',
          targeted_location: 'CA1',
          targeted_x: 1,
          targeted_y: 2,
          targeted_z: 3,
          units: 'mm',
        },
      ],
      ntrode_electrode_group_channel_map: [
        { ntrode_id: 1, electrode_group_id: 0, bad_channels: [], map: { 0: 0, 1: 1, 2: 2, 3: 3 } },
      ],
      data_acq_device: [],
    },
    cameras: [],
    configurationHistory: [
      {
        version: 1,
        date: '2023-06-22',
        description: 'Initial configuration',
        devices: {
          electrode_groups: [{ id: 0, device_type: 'tetrode_12.5', location: 'CA1' }],
          ntrode_electrode_group_channel_map: [],
        },
        appliedToDays: [],
      },
    ],
    days: ['remy-2023-06-22'],
  };
}

const days = {
  'remy-2023-06-22': {
    animalId: 'remy',
    date: '2023-06-22',
    session: { session_id: 'remy_20230622' },
    state: { draft: false, validated: true, exported: false },
  },
};

/**
 * Exposes remy's ntrode maps from the live store for assertions.
 * @returns {React.Element} A <pre> with the serialized ntrode maps.
 */
function NtrodeProbe() {
  const { model } = useStoreContext();
  const maps = model.workspace.animals.remy?.devices?.ntrode_electrode_group_channel_map || [];
  return <pre data-testid="ntrode-maps">{JSON.stringify(maps)}</pre>;
}

const ntrodeMaps = () => JSON.parse(screen.getByTestId('ntrode-maps').textContent);

/**
 * Render AnimalView for a tab against a seeded store, with a store probe.
 * @param {string} tab - The active tab.
 * @param {object} [animal] - The remy animal record (defaults to a configured one).
 * @returns {object} render result
 */
function renderView(tab, animal = buildConfiguredAnimal()) {
  return render(
    <StoreProvider initialState={{ workspace: { animals: { remy: animal }, days, settings: {} } }}>
      <AnimalView animalId="remy" tab={tab} />
      <NtrodeProbe />
    </StoreProvider>
  );
}

describe('AnimalView — electrode-groups tab (Phase 3-2)', () => {
  beforeEach(() => {
    delete window.location;
    window.location = { hash: '#/animal/remy/electrode-groups' };
  });
  afterEach(() => {
    window.location = { hash: '' };
  });

  it('renders the electrode-groups container (groups table), not the placeholder', () => {
    renderView('electrode-groups');
    // The container's table renders the seeded group; the placeholder pointer is gone.
    expect(screen.getByRole('button', { name: /add electrode group/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /edit electrode group 0/i })).toBeInTheDocument();
    expect(screen.queryByText(/this section moves here in a later phase/i)).not.toBeInTheDocument();
  });

  it('shows the electrode-groups scope descriptor', () => {
    renderView('electrode-groups');
    expect(screen.getByText(/a hardware change starts a new version/i)).toBeInTheDocument();
  });

  it('regenerates channel maps to local ids when device_type changes via the tab', async () => {
    const user = userEvent.setup();
    renderView('electrode-groups');

    expect(ntrodeMaps()).toHaveLength(1); // tetrode → 1 ntrode

    await user.click(screen.getByRole('button', { name: /edit electrode group 0/i }));
    // Real ElectrodeGroupModal opens; change device_type to a 4-shank probe and save.
    await user.selectOptions(screen.getByLabelText(/device type/i), FOUR_SHANK_DEVICE);
    await user.click(screen.getByRole('button', { name: /save electrode group configuration/i }));

    const maps = ntrodeMaps();
    expect(maps).toHaveLength(4); // 4-shank probe → 4 ntrodes, old tetrode map replaced
    expect(maps.every((m) => String(m.electrode_group_id) === '0')).toBe(true);
    expect(new Set(maps.map((m) => m.ntrode_id)).size).toBe(4);
    // Each shank's map resets to LOCAL electrode ids (keys 0..N-1), not global hardware channels.
    expect(Object.keys(maps[0].map)).toEqual(expect.arrayContaining(['0', '1', '2', '3']));
  });
});

describe('AnimalView — electrode-groups config-version legibility (Task 3.4, ephys slice)', () => {
  beforeEach(() => {
    delete window.location;
    window.location = { hash: '#/animal/remy/electrode-groups' };
  });
  afterEach(() => {
    window.location = { hash: '' };
  });

  /**
   * A multi-version animal: config forked from v1 (2023-06-22) to v2 (2023-07-10).
   * @returns {object} The remy animal record with a two-version configurationHistory.
   */
  function buildMultiVersionAnimal() {
    const animal = buildConfiguredAnimal();
    animal.configurationHistory = [
      {
        version: 1,
        date: '2023-06-22',
        description: 'Initial configuration',
        devices: { electrode_groups: [{ id: 0, device_type: 'tetrode_12.5', location: 'CA1' }], ntrode_electrode_group_channel_map: [] },
        appliedToDays: [],
      },
      {
        version: 2,
        date: '2023-07-10',
        description: 'Lowered CA1 tetrodes by 40um',
        devices: { electrode_groups: [{ id: 0, device_type: 'tetrode_12.5', location: 'CA1' }], ntrode_electrode_group_channel_map: [] },
        appliedToDays: [],
      },
    ];
    return animal;
  }

  it('shows dated, human-readable config-change context (not a bare "v2") for a multi-version animal', () => {
    renderView('electrode-groups', buildMultiVersionAnimal());
    const context = screen.getByRole('note', { name: /electrode configuration history/i });
    // The reconfiguration date is surfaced, with which versions apply before/after.
    expect(within(context).getByText(/changed on 2023-07-10/i)).toBeInTheDocument();
    expect(within(context).getByText(/use v1/i)).toBeInTheDocument();
    expect(within(context).getByText(/use v2/i)).toBeInTheDocument();
  });

  it('does not show the config-version context for a single-version animal', () => {
    renderView('electrode-groups'); // default fixture has one configuration version
    expect(screen.queryByRole('note', { name: /electrode configuration history/i })).not.toBeInTheDocument();
  });

  it('does not show the config-version context on the channel-maps tab', () => {
    delete window.location;
    window.location = { hash: '#/animal/remy/channel-maps' };
    renderView('channel-maps', buildMultiVersionAnimal());
    expect(screen.queryByRole('note', { name: /electrode configuration history/i })).not.toBeInTheDocument();
  });
});

describe('AnimalView — channel-maps tab (Phase 3-2)', () => {
  beforeEach(() => {
    delete window.location;
    window.location = { hash: '#/animal/remy/channel-maps' };
  });
  afterEach(() => {
    window.location = { hash: '' };
  });

  it('renders the channel-maps container, not the placeholder', () => {
    renderView('channel-maps');
    expect(screen.getByTestId('channel-maps-step')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /export channel maps to csv/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /import channel maps from csv/i })).toBeInTheDocument();
    expect(screen.queryByText(/this section moves here in a later phase/i)).not.toBeInTheDocument();
  });

  it('shows the channel-maps scope descriptor', () => {
    renderView('channel-maps');
    expect(screen.getByText(/failed channels are marked per day in the day editor/i)).toBeInTheDocument();
  });

  it('opens the ChannelMapEditor for a group', async () => {
    const user = userEvent.setup();
    renderView('channel-maps');
    await user.click(screen.getByRole('button', { name: /edit channel map for electrode group 0/i }));
    expect(screen.getByRole('heading', { name: /channel map editor/i })).toBeInTheDocument();
  });
});

describe('AnimalView — unsaved-edit guard (charter decision 2)', () => {
  beforeEach(() => {
    delete window.location;
    window.location = { hash: '#/animal/remy/channel-maps' };
  });
  afterEach(() => {
    window.location = { hash: '' };
  });

  /**
   * Render the channel-maps tab and open the ChannelMapEditor so there are pending edits.
   * @returns {object} The userEvent instance for driving subsequent interactions.
   */
  async function renderWithOpenEditor() {
    const user = userEvent.setup();
    renderView('channel-maps');
    await user.click(screen.getByRole('button', { name: /edit channel map for electrode group 0/i }));
    expect(screen.getByRole('heading', { name: /channel map editor/i })).toBeInTheDocument();
    return user;
  }

  it('intercepts a section-nav switch with a discard confirm when an editor is open', async () => {
    const user = await renderWithOpenEditor();
    await user.click(screen.getByRole('link', { name: /^electrode groups/i }));
    expect(screen.getByRole('alertdialog', { name: /discard unsaved changes/i })).toBeInTheDocument();
  });

  it('does NOT intercept when no editor is open (normal nav, no confirm)', async () => {
    const user = userEvent.setup();
    renderView('channel-maps');
    await user.click(screen.getByRole('link', { name: /^electrode groups/i }));
    expect(screen.queryByRole('alertdialog', { name: /discard unsaved changes/i })).not.toBeInTheDocument();
  });

  it('cancel keeps the tab and the open editor', async () => {
    const user = await renderWithOpenEditor();
    await user.click(screen.getByRole('link', { name: /^electrode groups/i }));
    await user.click(screen.getByRole('button', { name: /keep editing/i }));
    expect(screen.queryByRole('alertdialog', { name: /discard unsaved changes/i })).not.toBeInTheDocument();
    // Editor still open; route unchanged.
    expect(screen.getByRole('heading', { name: /channel map editor/i })).toBeInTheDocument();
    expect(window.location.hash).toBe('#/animal/remy/channel-maps');
  });

  it('confirm navigates to the target tab and dismisses the guard', async () => {
    const user = await renderWithOpenEditor();
    await user.click(screen.getByRole('link', { name: /^electrode groups/i }));
    await user.click(screen.getByRole('button', { name: /discard changes/i }));
    expect(screen.queryByRole('alertdialog', { name: /discard unsaved changes/i })).not.toBeInTheDocument();
    expect(window.location.hash).toBe('#/animal/remy/electrode-groups');
  });

  it('resets pending edits when the tab actually changes (container unmount), so the next nav is unguarded', async () => {
    const user = userEvent.setup();
    const animal = buildConfiguredAnimal();
    const { rerender } = render(
      <StoreProvider initialState={{ workspace: { animals: { remy: animal }, days, settings: {} } }}>
        <AnimalView animalId="remy" tab="channel-maps" />
      </StoreProvider>
    );
    // Open the editor → pending edits true.
    await user.click(screen.getByRole('button', { name: /edit channel map for electrode group 0/i }));
    expect(screen.getByRole('heading', { name: /channel map editor/i })).toBeInTheDocument();

    // Simulate the router driving the tab change (as a guard-confirm or external nav would): the
    // ChannelMapsContainer unmounts, and its cleanup must reset the shell's pending-edits flag.
    rerender(
      <StoreProvider initialState={{ workspace: { animals: { remy: animal }, days, settings: {} } }}>
        <AnimalView animalId="remy" tab="electrode-groups" />
      </StoreProvider>
    );
    expect(screen.queryByRole('heading', { name: /channel map editor/i })).not.toBeInTheDocument();

    // From the new tab with no open editor, navigating away must NOT raise the discard guard.
    await user.click(screen.getByRole('link', { name: /^channel maps/i }));
    expect(screen.queryByRole('alertdialog', { name: /discard unsaved changes/i })).not.toBeInTheDocument();
  });
});
