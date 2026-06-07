/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { StoreProvider } from '../../../state/StoreContext';
import AnimalEditorStepper from '../AnimalEditorStepper';
import { useAnimalIdFromUrl } from '../../../hooks/useAnimalIdFromUrl';

// Child steps mocked so the harness isolates the stepper's own render-path iterations
// over persisted collections (configurationHistory, electrode_groups) from the children.
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

/**
 * @param {object} overrides - Fields to merge onto the remy animal record.
 * @returns {object} Initial store state with a single corrupt-able animal.
 */
function stateWith(overrides) {
  return {
    workspace: {
      animals: {
        remy: {
          id: 'remy',
          subject: { subject_id: 'remy' },
          devices: { electrode_groups: [], ntrode_electrode_group_channel_map: [] },
          days: [],
          ...overrides,
        },
      },
      days: {},
    },
  };
}

/**
 * @param {string} hash - Hash to seed (incl. ?version=... to reach the versioned path).
 * @param {object} state - Initial store state.
 * @returns {import('@testing-library/react').RenderResult}
 */
function renderAt(hash, state) {
  window.location.hash = hash;
  useAnimalIdFromUrl.mockReturnValue('remy');
  return render(
    <StoreProvider initialState={state}>
      <AnimalEditorStepper />
    </StoreProvider>
  );
}

describe('AnimalEditorStepper — tolerates corrupt persisted collections', () => {
  beforeEach(() => {
    window.location.hash = '';
  });
  afterEach(() => {
    window.location.hash = '';
    vi.clearAllMocks();
  });

  // The versioned reconfigure path calls `.some` on configurationHistory once a
  // `?version=` is present. A persisted non-array configurationHistory must not crash
  // the editor — it is a legitimate repair destination, not a dead-end.
  it.each([
    ['a string', 'nope'],
    ['a plain object', {}],
    ['a number', 42],
  ])('does not throw when configurationHistory is %s (versioned route)', (_label, corrupt) => {
    expect(() => {
      renderAt(
        '#/animal/remy/editor?context=reconfigure&version=3',
        stateWith({ configurationHistory: corrupt, days: ['remy-2023-06-24'] })
      );
    }).not.toThrow();

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Animal Setup: remy');
  });

  it('does not throw when configurationHistory is corrupt without a version param', () => {
    expect(() => {
      renderAt('#/animal/remy/editor', stateWith({ configurationHistory: 'nope' }));
    }).not.toThrow();

    expect(screen.getByTestId('electrode-groups-step')).toBeInTheDocument();
  });
});
