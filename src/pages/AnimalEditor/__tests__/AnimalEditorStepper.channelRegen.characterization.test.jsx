/**
 * Characterization: editing an electrode group's device_type regenerates its channel maps.
 *
 * This pins the highest-value wiring guarantee in the animal-setup host (the channel-map
 * auto-regen on a device_type change — `handleSaveGroup`): a group's maps must be REPLACED with
 * the new device's per-shank ntrodes, and an unchanged device_type must leave maps untouched. The
 * regen MATH lives in tested pure helpers; this test pins the host WIRING that detects the change
 * and applies the regen, so it can be re-run unchanged after that wiring is extracted into a
 * container (the store mutation is identical whichever component owns the handler).
 *
 * Leaf/modal components are mocked so the test drives the handler directly via the store; the real
 * channel-map generator runs (not mocked) so the regenerated shape is the production shape.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { StoreProvider, useStoreContext } from '../../../state/StoreContext';
import AnimalEditorStepper from '../AnimalEditorStepper';
import { useAnimalIdFromUrl } from '../../../hooks/useAnimalIdFromUrl';

// A 4-shank probe → its generator yields 4 ntrodes (vs. the tetrode's 1), so a tetrode→4-shank
// edit changes the ntrode COUNT unambiguously (1 → 4).
const FOUR_SHANK_DEVICE = '128c-4s8mm6cm-20um-40um-sl';

// ElectrodeGroupsStep mock: just an Edit trigger for the seeded group.
vi.mock('../ElectrodeGroupsStep', () => ({
  default: ({ animal, onEdit }) => (
    <div data-testid="electrode-groups-step">
      {animal.devices?.electrode_groups?.map((g) => (
        <button key={g.id} data-testid={`edit-group-${g.id}`} onClick={() => onEdit?.(g.id)}>
          Edit {g.id}
        </button>
      ))}
    </div>
  ),
}));

// ElectrodeGroupModal mock: two saves — one that CHANGES device_type, one that keeps it — so the
// test can exercise both the regen and the no-regen branches with the same harness.
vi.mock('../ElectrodeGroupModal', () => ({
  default: ({ isOpen, group, onSave }) => {
    if (!isOpen) return null;
    const base = {
      location: 'CA1',
      description: 'CA1',
      targeted_location: 'CA1',
      targeted_x: 1,
      targeted_y: 2,
      targeted_z: 3,
      units: 'mm',
      bad_channels: '',
    };
    return (
      <div data-testid="electrode-group-modal">
        <button data-testid="save-changed" onClick={() => onSave({ ...base, device_type: FOUR_SHANK_DEVICE })}>
          Save (change device)
        </button>
        <button data-testid="save-unchanged" onClick={() => onSave({ ...base, device_type: group?.device_type })}>
          Save (same device)
        </button>
      </div>
    );
  },
}));

// Trivial mocks for the other steps so the stepper renders without their real complexity.
vi.mock('../ChannelMapsStep', () => ({ default: () => <div data-testid="channel-maps-step" /> }));
vi.mock('../HardwareConfigStep', () => ({ default: () => <div data-testid="hardware-config-step" /> }));
vi.mock('../OptogeneticsStep', () => ({ default: () => <div data-testid="optogenetics-step" /> }));
vi.mock('../ChannelMapEditor', () => ({ default: () => null }));
vi.mock('../../../hooks/useAnimalIdFromUrl', () => ({ useAnimalIdFromUrl: vi.fn() }));

/** Exposes remy's ntrode maps for assertions. */
function NtrodeProbe() {
  const { model } = useStoreContext();
  const maps = model.workspace.animals.remy?.devices?.ntrode_electrode_group_channel_map || [];
  return <pre data-testid="ntrode-maps">{JSON.stringify(maps)}</pre>;
}

const seededState = {
  workspace: {
    animals: {
      remy: {
        id: 'remy',
        subject: { subject_id: 'remy' },
        devices: {
          electrode_groups: [
            { id: 0, device_type: 'tetrode_12.5', location: 'CA1', targeted_location: 'CA1' },
          ],
          ntrode_electrode_group_channel_map: [
            { ntrode_id: 1, electrode_group_id: 0, bad_channels: [], map: { 0: 0, 1: 1, 2: 2, 3: 3 } },
          ],
        },
        days: [],
      },
    },
    days: {},
  },
};

const ntrodeMaps = () => JSON.parse(screen.getByTestId('ntrode-maps').textContent);

describe('handleSaveGroup — channel-map regeneration on device_type change (characterization)', () => {
  beforeEach(() => {
    useAnimalIdFromUrl.mockReturnValue('remy');
    delete window.location;
    window.location = { hash: '' };
  });
  afterEach(() => vi.restoreAllMocks());

  it('regenerates the group\'s channel maps when device_type changes (tetrode 1 ntrode → 4-shank 4 ntrodes)', async () => {
    const user = userEvent.setup();
    render(
      <StoreProvider initialState={seededState}>
        <AnimalEditorStepper />
        <NtrodeProbe />
      </StoreProvider>
    );

    expect(ntrodeMaps()).toHaveLength(1); // tetrode → 1 ntrode

    await user.click(screen.getByTestId('edit-group-0'));
    await user.click(screen.getByTestId('save-changed'));

    const maps = ntrodeMaps();
    // 4-shank probe → 4 ntrodes, all for group 0; the old tetrode map is gone (replaced).
    expect(maps).toHaveLength(4);
    expect(maps.every((m) => String(m.electrode_group_id) === '0')).toBe(true);
    expect(new Set(maps.map((m) => m.ntrode_id)).size).toBe(4); // distinct ntrode ids
  });

  it('leaves channel maps untouched when device_type is unchanged', async () => {
    const user = userEvent.setup();
    render(
      <StoreProvider initialState={seededState}>
        <AnimalEditorStepper />
        <NtrodeProbe />
      </StoreProvider>
    );

    await user.click(screen.getByTestId('edit-group-0'));
    await user.click(screen.getByTestId('save-unchanged'));

    const maps = ntrodeMaps();
    expect(maps).toHaveLength(1);
    expect(maps[0].map).toEqual({ 0: 0, 1: 1, 2: 2, 3: 3 });
  });
});
