/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { StoreProvider } from '../../../state/StoreContext';
import AnimalEditorStepper from '../AnimalEditorStepper';
import { useAnimalIdFromUrl } from '../../../hooks/useAnimalIdFromUrl';

vi.mock('../ElectrodeGroupsStep', () => ({
  default: () => <div data-testid="electrode-groups-step">Electrode Groups</div>,
}));
vi.mock('../ChannelMapsStep', () => ({
  default: () => <div data-testid="channel-maps-step">Channel Maps</div>,
}));
vi.mock('../HardwareConfigStep', () => ({
  default: () => <div data-testid="hardware-config-step">Hardware Config</div>,
}));
vi.mock('../ChannelMapEditor', () => ({ default: () => null }));
vi.mock('../ElectrodeGroupModal', () => ({ default: () => null }));

vi.mock('../../../hooks/useAnimalIdFromUrl', () => ({
  useAnimalIdFromUrl: vi.fn(),
}));

const INITIAL = {
  workspace: {
    animals: {
      remy: {
        id: 'remy',
        subject: { subject_id: 'remy' },
        devices: { electrode_groups: [], ntrode_electrode_group_channel_map: [] },
        days: [],
      },
    },
    days: {},
  },
};

/**
 * @param {string} hash - The full hash to seed (incl. ?field=...).
 * @returns {import('@testing-library/react').RenderResult}
 */
function renderAt(hash) {
  window.location.hash = hash;
  useAnimalIdFromUrl.mockReturnValue('remy');
  return render(
    <StoreProvider initialState={INITIAL}>
      <AnimalEditorStepper />
    </StoreProvider>
  );
}

describe('AnimalEditorStepper — deep-link to repair step from ?field=', () => {
  beforeEach(() => {
    window.location.hash = '';
  });
  afterEach(() => {
    window.location.hash = '';
    vi.clearAllMocks();
  });

  it('opens on the Channel Maps step for a channel-map field', () => {
    renderAt('#/animal/remy/editor?field=ntrode_electrode_group_channel_map%5B0%5D');
    expect(screen.getByTestId('channel-maps-step')).toBeInTheDocument();
    expect(screen.queryByTestId('electrode-groups-step')).not.toBeInTheDocument();
  });

  it('opens on the Electrode Groups step for an electrode-group field', () => {
    renderAt('#/animal/remy/editor?field=electrode_groups%5B0%5D.location');
    expect(screen.getByTestId('electrode-groups-step')).toBeInTheDocument();
  });

  it('opens on the Hardware Config step for a camera field', () => {
    renderAt('#/animal/remy/editor?field=cameras%5B0%5D.lens');
    expect(screen.getByTestId('hardware-config-step')).toBeInTheDocument();
  });

  it('opens on step 0 (Electrode Groups) when no field is provided', () => {
    renderAt('#/animal/remy/editor');
    expect(screen.getByTestId('electrode-groups-step')).toBeInTheDocument();
  });
});
