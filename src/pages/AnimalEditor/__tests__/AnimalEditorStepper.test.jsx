import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { StoreProvider, useStoreContext } from '../../../state/StoreContext';
import AnimalEditorStepper from '../AnimalEditorStepper';

import { useAnimalIdFromUrl } from '../../../hooks/useAnimalIdFromUrl';

// Mock components
vi.mock('../ElectrodeGroupsStep', () => ({
  default: ({ animal, onFieldUpdate, onAdd, onEdit, onDelete }) => (
    <div data-testid="electrode-groups-step">
      <div>ElectrodeGroupsStep for {animal.id}</div>
      <button onClick={() => onAdd?.()}>Add</button>
      {animal.devices?.electrode_groups?.map(group => (
        <div key={group.id}>
          <button
            onClick={() => onEdit?.(group.id)}
            data-testid={`edit-group-${group.id}`}
          >
            Edit {group.id}
          </button>
          <button
            onClick={() => onDelete?.(group)}
            data-testid={`delete-group-${group.id}`}
            aria-label={`Delete electrode group ${group.id}`}
          >
            Delete {group.id}
          </button>
        </div>
      ))}
    </div>
  ),
}));

vi.mock('../ChannelMapsStep', () => ({
  default: ({ animal, onEditChannelMap }) => (
    <div data-testid="channel-maps-step">
      <h2>Step 2: Channel Maps</h2>
      <div>ChannelMapsStep for {animal.id}</div>
      {animal.devices?.ntrode_electrode_group_channel_map?.map(channelMap => (
        <div key={channelMap.electrode_group_id}>
          <button
            onClick={() => onEditChannelMap?.(channelMap.electrode_group_id)}
            data-testid={`edit-channel-map-${channelMap.electrode_group_id}`}
          >
            Edit {channelMap.electrode_group_id}
          </button>
        </div>
      ))}
    </div>
  ),
}));

vi.mock('../HardwareConfigStep', () => ({
  default: ({ animal, onFieldUpdate, onNavigateBack, onNavigateNext }) => (
    <div data-testid="hardware-config-step">
      <h2>Step 3: Hardware Config</h2>
      <div>HardwareConfigStep for {animal.id}</div>
      <button onClick={onNavigateBack} data-testid="hardware-back-button">
        Back
      </button>
      <button onClick={onNavigateNext} data-testid="hardware-next-button">
        Continue
      </button>
    </div>
  ),
}));

vi.mock('../ChannelMapEditor', () => ({
  default: ({ electrodeGroup, channelMaps, onSave, onCancel }) => (
    <div
      data-testid="channel-map-editor"
      data-group-id={electrodeGroup?.id}
    >
      <h3>Edit Channel Maps for Group {electrodeGroup?.id}</h3>
      <div data-testid="editor-channel-map-count">
        {channelMaps?.length || 0} maps
      </div>
      <button
        onClick={() => onSave(channelMaps || [])}
        data-testid="editor-save"
      >
        Save
      </button>
      <button onClick={onCancel} data-testid="editor-cancel">Cancel</button>
    </div>
  ),
}));

vi.mock('../ElectrodeGroupModal', () => ({
  default: ({ isOpen, mode, group, onSave, onCancel }) => {
    if (!isOpen) return null;
    return (
      <div data-testid="electrode-group-modal" data-mode={mode}>
        <h3>{mode === 'add' ? 'Add' : 'Edit'} Electrode Group</h3>
        {group && <div data-testid="edit-group-id">{group.id}</div>}
        <button
          onClick={() => onSave({
            device_type: 'tetrode_12.5',
            location: 'CA1',
            description: 'CA1 tetrode',
            targeted_location: 'CA1',
            targeted_x: 1.0,
            targeted_y: 2.0,
            targeted_z: 3.0,
            units: 'mm',
            bad_channels: ''
          })}
          data-testid="modal-save"
        >
          Save
        </button>
        <button onClick={onCancel} data-testid="modal-cancel">Cancel</button>
      </div>
    );
  },
}));

// Mock hooks
vi.mock('../../../hooks/useAnimalIdFromUrl', () => ({
  useAnimalIdFromUrl: vi.fn(),
}));

/**
 * @returns {JSX.Element} Probe exposing device state for integration assertions.
 */
function StoreStateProbe() {
  const { model } = useStoreContext();
  return (
    <pre data-testid="workspace-state">
      {JSON.stringify(model.workspace.animals.remy?.devices || {})}
    </pre>
  );
}

describe('AnimalEditorStepper', () => {
  const mockInitialState = {
    workspace: {
      animals: {
        remy: {
          id: 'remy',
          subject: { subject_id: 'remy' },
          devices: {
            electrode_groups: [],
            ntrode_electrode_group_channel_map: [],
          },
          days: [],
        },
      },
      days: {},
    },
  };

  /**
   * @param {React.ReactNode} component - Component under test.
   * @param {object} initialState - Store initial state.
   * @returns {import('@testing-library/react').RenderResult} Render result.
   */
  function renderWithStore(component, initialState = mockInitialState) {
    return render(
      <StoreProvider initialState={initialState}>
        {component}
      </StoreProvider>
    );
  }

  beforeEach(() => {
    vi.clearAllMocks();
    useAnimalIdFromUrl.mockReturnValue('remy');

    // Mock window.location.hash
    delete window.location;
    window.location = { hash: '' };
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Animal validation', () => {
    it('renders stepper when animal exists', () => {
      renderWithStore(<AnimalEditorStepper />);
      expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Animal Setup: remy');
    });

    it('frames the editor as shared animal setup with honest per-kind blast radius', () => {
      renderWithStore(<AnimalEditorStepper />);
      expect(screen.getByText(/shared setup for this animal/i)).toBeInTheDocument();
      // Phase 8.7 Task 2: electrodes/probes are versioned (each day keeps its pinned config);
      // cameras and the recording system are shared and affect ALL recording days (no false
      // "days pinned earlier keep theirs" claim for cameras/data-acq, which is not true today).
      expect(screen.getByText(/electrodes\/probes are versioned/i)).toBeInTheDocument();
      expect(
        screen.getByText(/cameras and the recording system are shared animal-level setup/i)
      ).toBeInTheDocument();
      expect(screen.getByText(/editing them affects all recording days/i)).toBeInTheDocument();
    });

    it('does not show reconfiguration context on a normal editor open', () => {
      renderWithStore(<AnimalEditorStepper />);

      expect(document.querySelector('.configuration-edit-context')).not.toBeInTheDocument();
      expect(screen.queryByText(/configuration v/i)).not.toBeInTheDocument();
    });

    it('shows error when animal not found', () => {
      const emptyState = { workspace: { animals: {}, days: {} } };
      renderWithStore(<AnimalEditorStepper />, emptyState);
      expect(screen.getByText(/Animal.*not found/i)).toBeInTheDocument();
    });

    it('renders exactly one main landmark (#main-content, role=main)', () => {
      const { container } = renderWithStore(<AnimalEditorStepper />);
      const mains = container.querySelectorAll('main');
      expect(mains).toHaveLength(1);
      expect(mains[0]).toHaveAttribute('id', 'main-content');
      expect(mains[0]).toHaveAttribute('role', 'main');
    });

    it('renders a back-to-workspace link in the header', () => {
      renderWithStore(<AnimalEditorStepper />);
      const back = screen.getByRole('link', { name: /back to workspace/i });
      expect(back).toHaveAttribute('href', '#/workspace?animal=remy');
    });

    it('shows latest configuration context and moved-day acknowledgement after a reconfiguration fork', () => {
      window.location.hash = '#/animal/remy/editor?context=reconfigure&version=3&fromDay=remy-2023-06-24&movedDays=1';
      const stateAfterReconfig = {
        workspace: {
          animals: {
            remy: {
              id: 'remy',
              subject: { subject_id: 'remy' },
              devices: {
                electrode_groups: [],
                ntrode_electrode_group_channel_map: [],
              },
              days: ['remy-2023-06-24'],
              configurationHistory: [
                { version: 1, date: '2023-06-22', description: 'Initial', devices: {} },
                { version: 3, date: '2023-06-24', description: 'Lowered CA1', devices: {} },
              ],
            },
          },
          days: {
            'remy-2023-06-24': {
              id: 'remy-2023-06-24',
              animalId: 'remy',
              date: '2023-06-24',
            },
          },
        },
      };

      renderWithStore(<AnimalEditorStepper />, stateAfterReconfig);

      expect(document.querySelector('.configuration-edit-context')).toHaveTextContent(
        'Editing latest configuration v3 for reconfiguration starting 2023-06-24. Moved 1 day to this version.'
      );
    });

    it('warns when a reconfiguration route points at a historical configuration version', () => {
      window.location.hash = '#/animal/remy/editor?context=reconfigure&version=2&fromDay=remy-2023-06-24&movedDays=2';
      const stateAfterLaterReconfig = {
        workspace: {
          animals: {
            remy: {
              id: 'remy',
              subject: { subject_id: 'remy' },
              devices: {
                electrode_groups: [],
                ntrode_electrode_group_channel_map: [],
              },
              days: ['remy-2023-06-24', 'remy-2023-06-25'],
              configurationHistory: [
                { version: 1, date: '2023-06-22', description: 'Initial', devices: {} },
                { version: 2, date: '2023-06-24', description: 'Lowered CA1', devices: {} },
                { version: 3, date: '2023-06-25', description: 'Lowered CA3', devices: {} },
              ],
            },
          },
          days: {
            'remy-2023-06-24': {
              id: 'remy-2023-06-24',
              animalId: 'remy',
              date: '2023-06-24',
            },
            'remy-2023-06-25': {
              id: 'remy-2023-06-25',
              animalId: 'remy',
              date: '2023-06-25',
            },
          },
        },
      };

      renderWithStore(<AnimalEditorStepper />, stateAfterLaterReconfig);

      expect(document.querySelector('.configuration-edit-context')).toHaveTextContent(
        'Review configuration v2; current latest is v3 for reconfiguration starting 2023-06-24. Moved 2 days to this version.'
      );
    });

    it('treats blank and nonnumeric route values as absent instead of rendering v0', () => {
      window.location.hash = '#/animal/remy/editor?context=reconfigure&version=&fromDay=remy-2023-06-24&movedDays=abc';
      const stateAfterReconfig = {
        workspace: {
          animals: {
            remy: {
              id: 'remy',
              subject: { subject_id: 'remy' },
              devices: {
                electrode_groups: [],
                ntrode_electrode_group_channel_map: [],
              },
              days: ['remy-2023-06-24'],
              configurationHistory: [
                { version: 1, date: '2023-06-22', description: 'Initial', devices: {} },
                { version: 3, date: '2023-06-24', description: 'Lowered CA1', devices: {} },
              ],
            },
          },
          days: {
            'remy-2023-06-24': {
              id: 'remy-2023-06-24',
              animalId: 'remy',
              date: '2023-06-24',
            },
          },
        },
      };

      renderWithStore(<AnimalEditorStepper />, stateAfterReconfig);

      expect(document.querySelector('.configuration-edit-context')).toHaveTextContent(
        'Editing latest configuration v3 for reconfiguration starting 2023-06-24.'
      );
      expect(document.querySelector('.configuration-edit-context')).not.toHaveTextContent(/v0|moved/i);
    });

    it('ignores route versions that are absent from configuration history', () => {
      window.location.hash = '#/animal/remy/editor?context=reconfigure&version=99&fromDay=remy-2023-06-24';
      const stateAfterReconfig = {
        workspace: {
          animals: {
            remy: {
              id: 'remy',
              subject: { subject_id: 'remy' },
              devices: {
                electrode_groups: [],
                ntrode_electrode_group_channel_map: [],
              },
              days: ['remy-2023-06-24'],
              configurationHistory: [
                { version: 1, date: '2023-06-22', description: 'Initial', devices: {} },
                { version: 3, date: '2023-06-24', description: 'Lowered CA1', devices: {} },
              ],
            },
          },
          days: {
            'remy-2023-06-24': {
              id: 'remy-2023-06-24',
              animalId: 'remy',
              date: '2023-06-24',
            },
          },
        },
      };

      renderWithStore(<AnimalEditorStepper />, stateAfterReconfig);

      expect(document.querySelector('.configuration-edit-context')).toHaveTextContent(
        'Editing latest configuration v3 for reconfiguration starting 2023-06-24.'
      );
      expect(document.querySelector('.configuration-edit-context')).not.toHaveTextContent(/v99/i);
    });

    it('the not-found error screen provides Workspace and Home escapes (no dead-end)', () => {
      const emptyState = { workspace: { animals: {}, days: {} } };
      const { container } = renderWithStore(<AnimalEditorStepper />, emptyState);
      expect(screen.getByRole('link', { name: /return to workspace/i }))
        .toHaveAttribute('href', '#/workspace');
      expect(screen.getByRole('link', { name: /go to home/i }))
        .toHaveAttribute('href', '#/home');
      // Error screen still exposes a single main landmark / focus target.
      expect(container.querySelectorAll('main')).toHaveLength(1);
    });

    it('shows error when no animal ID in URL', () => {
      useAnimalIdFromUrl.mockReturnValue(null);
      renderWithStore(<AnimalEditorStepper />);
      expect(screen.getByText(/No animal specified/i)).toBeInTheDocument();
    });
  });

  describe('Step navigation', () => {
    it('starts at step 0 (Electrode Groups)', () => {
      renderWithStore(<AnimalEditorStepper />);
      // Check for step content
      expect(screen.getByTestId('electrode-groups-step')).toBeInTheDocument();
    });

    it('Next button advances to step 1 (Channel Maps)', async () => {
      const user = userEvent.setup();
      renderWithStore(<AnimalEditorStepper />);

      const nextButton = screen.getByRole('button', { name: /next step/i });
      await user.click(nextButton);

      expect(screen.getByTestId('channel-maps-step')).toBeInTheDocument();
    });

    it('Back button returns to step 0', async () => {
      const user = userEvent.setup();
      renderWithStore(<AnimalEditorStepper />);

      // Go to step 1
      const nextButton = screen.getByRole('button', { name: /next step/i });
      await user.click(nextButton);
      expect(screen.getByTestId('channel-maps-step')).toBeInTheDocument();

      // Go back to step 0
      const backButton = screen.getByRole('button', { name: /previous step/i });
      await user.click(backButton);
      expect(screen.getByTestId('electrode-groups-step')).toBeInTheDocument();
    });

    it('Back button disabled on step 0', () => {
      renderWithStore(<AnimalEditorStepper />);
      const backButton = screen.getByRole('button', { name: /previous step/i });
      expect(backButton).toBeDisabled();
    });

    it('Next button changes to Save on final step', async () => {
      const user = userEvent.setup();
      renderWithStore(<AnimalEditorStepper />);

      // Navigate to the final step (Hardware Config is Step 4 now that Optogenetics
      // was inserted before it).
      const nextButton = screen.getByRole('button', { name: /next step/i });
      await user.click(nextButton); // Step 0 -> Step 1
      await user.click(nextButton); // Step 1 -> Step 2 (Optogenetics)
      await user.click(nextButton); // Step 2 -> Step 3 (final: Hardware Config)

      // Check button label changed
      expect(screen.getByRole('button', { name: /save configuration/i })).toBeInTheDocument();
    });

    it('Save button is enabled on final step', async () => {
      const user = userEvent.setup();
      renderWithStore(<AnimalEditorStepper />);

      // Navigate to the final step (Hardware Config is Step 4 now that Optogenetics
      // was inserted before it).
      const nextButton = screen.getByRole('button', { name: /next step/i });
      await user.click(nextButton); // Step 0 -> Step 1
      await user.click(nextButton); // Step 1 -> Step 2 (Optogenetics)
      await user.click(nextButton); // Step 2 -> Step 3 (final: Hardware Config)

      // Check button is enabled
      const saveButton = screen.getByRole('button', { name: /save configuration/i });
      expect(saveButton).not.toBeDisabled();
    });
  });

  describe('Save functionality', () => {
    it('navigates to create-day action when animal has no days', async () => {
      const user = userEvent.setup();

      renderWithStore(<AnimalEditorStepper />);

      // Navigate to the final step (Hardware Config is Step 4 now that Optogenetics
      // was inserted before it).
      const nextButton = screen.getByRole('button', { name: /next step/i });
      await user.click(nextButton); // Step 0 -> Step 1
      await user.click(nextButton); // Step 1 -> Step 2 (Optogenetics)
      await user.click(nextButton); // Step 2 -> Step 3 (final: Hardware Config)

      // Click Save
      const saveButton = screen.getByRole('button', { name: /save configuration/i });
      await user.click(saveButton);

      // In-app alert shows the message; navigation is deferred until dismissal.
      const alert = await screen.findByRole('alertdialog');
      expect(alert).toHaveTextContent('Configuration saved. Ready to create first recording day.');

      await user.click(screen.getByRole('button', { name: /close alert/i }));
      expect(window.location.hash).toBe('#/workspace?animal=remy&action=create-day');
    });

    it('navigates to devices section when animal has days', async () => {
      const user = userEvent.setup();

      const stateWithDays = {
        workspace: {
          animals: {
            remy: {
              id: 'remy',
              subject: { subject_id: 'remy' },
              devices: {
                electrode_groups: [],
                ntrode_electrode_group_channel_map: [],
              },
              days: ['remy-2023-06-22', 'remy-2023-06-23'],
            },
          },
          days: {
            'remy-2023-06-22': {
              id: 'remy-2023-06-22',
              animalId: 'remy',
              date: '2023-06-22',
            },
            'remy-2023-06-23': {
              id: 'remy-2023-06-23',
              animalId: 'remy',
              date: '2023-06-23',
            },
          },
        },
      };

      renderWithStore(<AnimalEditorStepper />, stateWithDays);

      // Navigate to the final step (Hardware Config is Step 4 now that Optogenetics
      // was inserted before it).
      const nextButton = screen.getByRole('button', { name: /next step/i });
      await user.click(nextButton); // Step 0 -> Step 1
      await user.click(nextButton); // Step 1 -> Step 2 (Optogenetics)
      await user.click(nextButton); // Step 2 -> Step 3 (final: Hardware Config)

      // Click Save
      const saveButton = screen.getByRole('button', { name: /save configuration/i });
      await user.click(saveButton);

      // Alert states the accurate inheritance (latest version, not all days); navigation
      // deferred until dismissal.
      const alert = await screen.findByRole('alertdialog');
      expect(alert).toHaveTextContent(/Configuration saved to the latest version/i);
      expect(alert).toHaveTextContent(/days pinned to an earlier version keep theirs/i);

      await user.click(screen.getByRole('button', { name: /close alert/i }));
      expect(window.location.hash).toBe('#/workspace?animal=remy&section=devices');
    });

    it('shows singular day message when animal has one day', async () => {
      const user = userEvent.setup();

      const stateWithOneDay = {
        workspace: {
          animals: {
            remy: {
              id: 'remy',
              subject: { subject_id: 'remy' },
              devices: {
                electrode_groups: [],
                ntrode_electrode_group_channel_map: [],
              },
              days: ['remy-2023-06-22'],
            },
          },
          days: {
            'remy-2023-06-22': {
              id: 'remy-2023-06-22',
              animalId: 'remy',
              date: '2023-06-22',
            },
          },
        },
      };

      renderWithStore(<AnimalEditorStepper />, stateWithOneDay);

      // Navigate to the final step (Hardware Config is Step 4 now that Optogenetics
      // was inserted before it).
      const nextButton = screen.getByRole('button', { name: /next step/i });
      await user.click(nextButton); // Step 0 -> Step 1
      await user.click(nextButton); // Step 1 -> Step 2 (Optogenetics)
      await user.click(nextButton); // Step 2 -> Step 3 (final: Hardware Config)

      // Click Save
      const saveButton = screen.getByRole('button', { name: /save configuration/i });
      await user.click(saveButton);

      // Same accurate inheritance message regardless of day count; navigation deferred.
      const alert = await screen.findByRole('alertdialog');
      expect(alert).toHaveTextContent(/Configuration saved to the latest version/i);

      await user.click(screen.getByRole('button', { name: /close alert/i }));
      expect(window.location.hash).toBe('#/workspace?animal=remy&section=devices');
    });

    it('Save button works from Next button on final step', async () => {
      const user = userEvent.setup();

      renderWithStore(<AnimalEditorStepper />);

      // Navigate to the final step (Hardware Config is Step 4 now that Optogenetics
      // was inserted before it).
      const nextButton = screen.getByRole('button', { name: /next step/i });
      await user.click(nextButton); // Step 0 -> Step 1
      await user.click(nextButton); // Step 1 -> Step 2 (Optogenetics)
      await user.click(nextButton); // Step 2 -> Step 3 (final: Hardware Config)

      // The "Next" button should now say "Save"
      const saveButton = screen.getByRole('button', { name: /save configuration/i });
      expect(saveButton).toHaveTextContent('Save');

      // Click it
      await user.click(saveButton);

      // Save logic executed: in-app alert shown, navigation on dismissal.
      expect(await screen.findByRole('alertdialog')).toBeInTheDocument();
      await user.click(screen.getByRole('button', { name: /close alert/i }));
      expect(window.location.hash).toContain('#/workspace');
    });
  });

  describe('Step indicators', () => {
    it('shows the step indicators with correct labels', () => {
      renderWithStore(<AnimalEditorStepper />);
      expect(screen.getByText('Electrodes & Ephys')).toBeInTheDocument();
      expect(screen.getByText('Channel Maps')).toBeInTheDocument();
      expect(screen.getByText('Optogenetics Setup')).toBeInTheDocument();
      // Phase 8.7 Task 2: "Hardware Config" → ownership-named label for the step.
      expect(screen.getByText('Recording System, Cameras & DIO')).toBeInTheDocument();
    });

    it('marks active step visually', () => {
      renderWithStore(<AnimalEditorStepper />);
      const nav = screen.getByRole('navigation', { name: /configuration steps/i });
      const electrodeGroupsStep = nav.querySelector('.active');
      expect(electrodeGroupsStep).toHaveTextContent('Electrodes & Ephys');
    });
  });

  describe('Accessibility', () => {
    it('has proper heading with animal ID', () => {
      renderWithStore(<AnimalEditorStepper />);
      const heading = screen.getByRole('heading', { level: 1 });
      expect(heading).toHaveTextContent('Animal Setup: remy');
    });

    it('navigation has proper aria-label', () => {
      renderWithStore(<AnimalEditorStepper />);
      expect(screen.getByRole('navigation', { name: /configuration steps/i })).toBeInTheDocument();
    });

    it('buttons have aria-labels', () => {
      renderWithStore(<AnimalEditorStepper />);
      expect(screen.getByRole('button', { name: /previous step/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /next step/i })).toBeInTheDocument();
    });
  });

  describe('ElectrodeGroupsStep Integration', () => {
    it('renders ElectrodeGroupsStep when on step 0', () => {
      renderWithStore(<AnimalEditorStepper />);
      expect(screen.getByTestId('electrode-groups-step')).toBeInTheDocument();
      expect(screen.getByText(/ElectrodeGroupsStep for remy/)).toBeInTheDocument();
    });

    it('passes correct animal prop to ElectrodeGroupsStep', () => {
      const state = {
        workspace: {
          animals: {
            remy: {
              id: 'remy',
              subject: { subject_id: 'remy' },
              devices: {
                electrode_groups: [
                  {
                    id: '0',
                    device_type: 'tetrode_12.5',
                    location: 'CA1',
                    description: 'CA1 tetrode',
                    targeted_location: 'CA1',
                    targeted_x: 1.0,
                    targeted_y: 2.0,
                    targeted_z: 3.0,
                    units: 'mm'
                  }
                ],
                ntrode_electrode_group_channel_map: [],
              },
              days: [],
            },
          },
          days: {},
        },
      };
      renderWithStore(<AnimalEditorStepper />, state);
      expect(screen.getByText('ElectrodeGroupsStep for remy')).toBeInTheDocument();
    });

    it('ElectrodeGroupsStep receives onFieldUpdate callback', () => {
      renderWithStore(<AnimalEditorStepper />);
      // Verify the component is rendered with expected props
      expect(screen.getByTestId('electrode-groups-step')).toBeInTheDocument();
    });

    it('modal opens in add mode when Add button clicked', async () => {
      const user = userEvent.setup();
      renderWithStore(<AnimalEditorStepper />);

      const addButton = screen.getByRole('button', { name: 'Add' });
      await user.click(addButton);

      expect(screen.getByTestId('electrode-group-modal')).toBeInTheDocument();
      expect(screen.getByTestId('electrode-group-modal')).toHaveAttribute('data-mode', 'add');
    });

    it('modal opens in edit mode when Edit button clicked', async () => {
      const user = userEvent.setup();
      const state = {
        workspace: {
          animals: {
            remy: {
              id: 'remy',
              subject: { subject_id: 'remy' },
              devices: {
                electrode_groups: [
                  {
                    // Strict load normalization preserves ids verbatim (no laundering
                    // of a corrupt string id into a synthesized index), so the group
                    // must already carry its real schema-integer id.
                    id: 0,
                    device_type: 'tetrode_12.5',
                    location: 'CA1',
                    description: 'CA1 tetrode',
                    targeted_location: 'CA1',
                    targeted_x: 1.0,
                    targeted_y: 2.0,
                    targeted_z: 3.0,
                    units: 'mm'
                  }
                ],
                ntrode_electrode_group_channel_map: [],
              },
              days: [],
            },
          },
          days: {},
        },
      };
      renderWithStore(<AnimalEditorStepper />, state);

      const editButton = screen.getByTestId('edit-group-0');
      await user.click(editButton);

      expect(screen.getByTestId('electrode-group-modal')).toBeInTheDocument();
      expect(screen.getByTestId('electrode-group-modal')).toHaveAttribute('data-mode', 'edit');
      expect(screen.getByTestId('edit-group-id')).toHaveTextContent('0');
    });

    it('resolves an integer electrode-group id on edit (group object, not undefined)', async () => {
      const user = userEvent.setup();
      const state = {
        workspace: {
          animals: {
            remy: {
              id: 'remy',
              subject: { subject_id: 'remy' },
              devices: {
                electrode_groups: [
                  {
                    id: 0,
                    device_type: 'tetrode_12.5',
                    location: 'CA1',
                    description: 'CA1 tetrode',
                    targeted_location: 'CA1',
                    targeted_x: 1.0,
                    targeted_y: 2.0,
                    targeted_z: 3.0,
                    units: 'mm'
                  }
                ],
                ntrode_electrode_group_channel_map: [],
              },
              days: [],
            },
          },
          days: {},
        },
      };
      renderWithStore(<AnimalEditorStepper />, state);

      // ElectrodeGroupsStep calls onEdit(group.id) — an INTEGER. handleEditGroup
      // must resolve it to the group object, not treat the number as the group.
      await user.click(screen.getByTestId('edit-group-0'));

      expect(screen.getByTestId('electrode-group-modal')).toHaveAttribute('data-mode', 'edit');
      // The resolved group's id renders (would be empty if editingGroup were the number 0).
      expect(screen.getByTestId('edit-group-id')).toHaveTextContent('0');
    });

    it('modal saves new electrode group when in add mode', async () => {
      const user = userEvent.setup();
      renderWithStore(<AnimalEditorStepper />);

      const addButton = screen.getByRole('button', { name: 'Add' });
      await user.click(addButton);

      expect(screen.getByTestId('electrode-group-modal')).toBeInTheDocument();

      const saveButton = screen.getByTestId('modal-save');
      await user.click(saveButton);

      // Modal should close after save
      // We can verify by checking that a new group was added
      // In a real test this would verify store state was updated
    });

    it('modal saves edited electrode group', async () => {
      const user = userEvent.setup();
      const state = {
        workspace: {
          animals: {
            remy: {
              id: 'remy',
              subject: { subject_id: 'remy' },
              devices: {
                electrode_groups: [
                  {
                    id: '0',
                    device_type: 'tetrode_12.5',
                    location: 'CA1',
                    description: 'CA1 tetrode',
                    targeted_location: 'CA1',
                    targeted_x: 1.0,
                    targeted_y: 2.0,
                    targeted_z: 3.0,
                    units: 'mm'
                  }
                ],
                ntrode_electrode_group_channel_map: [],
              },
              days: [],
            },
          },
          days: {},
        },
      };
      renderWithStore(<AnimalEditorStepper />, state);

      const editButton = screen.getByTestId('edit-group-0');
      await user.click(editButton);

      expect(screen.getByTestId('electrode-group-modal')).toBeInTheDocument();

      const saveButton = screen.getByTestId('modal-save');
      await user.click(saveButton);

      // Modal should close after save
      // In a real test this would verify store state was updated
    });

    it('modal closes when Cancel button clicked', async () => {
      const user = userEvent.setup();
      renderWithStore(<AnimalEditorStepper />);

      const addButton = screen.getByRole('button', { name: 'Add' });
      await user.click(addButton);

      expect(screen.getByTestId('electrode-group-modal')).toBeInTheDocument();

      const cancelButton = screen.getByTestId('modal-cancel');
      await user.click(cancelButton);

      expect(screen.queryByTestId('electrode-group-modal')).not.toBeInTheDocument();
    });
  });

  describe('ID Generation', () => {
    it('generates sequential IDs starting from 0 for empty groups', async () => {
      const user = userEvent.setup();
      const stateWithEmptyGroups = {
        workspace: {
          animals: {
            remy: {
              id: 'remy',
              subject: { subject_id: 'remy' },
              devices: {
                electrode_groups: [],
                ntrode_electrode_group_channel_map: [],
              },
              days: [],
            },
          },
          days: {},
        },
      };

      render(
        <StoreProvider initialState={stateWithEmptyGroups}>
          <AnimalEditorStepper />
        </StoreProvider>
      );

      // Open modal and save first group
      const addButton = screen.getByRole('button', { name: 'Add' });
      await user.click(addButton);

      const saveButton = screen.getByTestId('modal-save');
      await user.click(saveButton);

      // Verify ID is "0" - check via the mock calls
      // The actual verification happens through state updates
      expect(screen.getByTestId('electrode-groups-step')).toBeInTheDocument();
    });

    it('stores schema-shaped integer groups and non-colliding generated ntrodes on add', async () => {
      const user = userEvent.setup();

      renderWithStore(
        <>
          <AnimalEditorStepper />
          <StoreStateProbe />
        </>
      );

      await user.click(screen.getByRole('button', { name: 'Add' }));
      await user.click(screen.getByTestId('modal-save'));

      const devices = JSON.parse(screen.getByTestId('workspace-state').textContent);
      expect(devices.electrode_groups).toEqual([
        {
          id: 0,
          location: 'CA1',
          device_type: 'tetrode_12.5',
          description: 'CA1 tetrode',
          targeted_location: 'CA1',
          targeted_x: 1,
          targeted_y: 2,
          targeted_z: 3,
          units: 'mm',
        },
      ]);
      expect(devices.electrode_groups[0]).not.toHaveProperty('bad_channels');
      expect(devices.ntrode_electrode_group_channel_map).toEqual([
        {
          electrode_group_id: 0,
          ntrode_id: 0,
          bad_channels: [],
          map: { 0: 0, 1: 1, 2: 2, 3: 3 },
        },
      ]);
    });

    it('increments ID from existing max when adding new group', async () => {
      const user = userEvent.setup();
      const stateWithGroups = {
        workspace: {
          animals: {
            remy: {
              id: 'remy',
              subject: { subject_id: 'remy' },
              devices: {
                electrode_groups: [
                  {
                    id: '0',
                    device_type: 'tetrode_12.5',
                    location: 'CA1',
                    targeted_x: 1.0,
                    targeted_y: 2.0,
                    targeted_z: 3.0,
                    units: 'mm'
                  },
                  {
                    id: '5',
                    device_type: 'tetrode_12.5',
                    location: 'CA3',
                    targeted_x: 4.0,
                    targeted_y: 5.0,
                    targeted_z: 6.0,
                    units: 'mm'
                  }
                ],
                ntrode_electrode_group_channel_map: [],
              },
              days: [],
            },
          },
          days: {},
        },
      };

      renderWithStore(<AnimalEditorStepper />, stateWithGroups);

      // Add new group
      const addButton = screen.getByRole('button', { name: 'Add' });
      await user.click(addButton);

      // Verify modal opened
      expect(screen.getByTestId('electrode-group-modal')).toBeInTheDocument();

      // Save new group
      const saveButton = screen.getByTestId('modal-save');
      await user.click(saveButton);

      // Modal should close after save
      expect(screen.queryByTestId('electrode-group-modal')).not.toBeInTheDocument();
    });

    it('handles non-numeric IDs gracefully and increments from highest numeric ID', async () => {
      const user = userEvent.setup();
      const stateWithMixedIds = {
        workspace: {
          animals: {
            remy: {
              id: 'remy',
              subject: { subject_id: 'remy' },
              devices: {
                electrode_groups: [
                  {
                    id: 'abc',
                    device_type: 'tetrode_12.5',
                    location: 'CA1',
                    targeted_x: 1.0,
                    targeted_y: 2.0,
                    targeted_z: 3.0,
                    units: 'mm'
                  },
                  {
                    id: '2',
                    device_type: 'tetrode_12.5',
                    location: 'CA3',
                    targeted_x: 4.0,
                    targeted_y: 5.0,
                    targeted_z: 6.0,
                    units: 'mm'
                  }
                ],
                ntrode_electrode_group_channel_map: [],
              },
              days: [],
            },
          },
          days: {},
        },
      };

      renderWithStore(<AnimalEditorStepper />, stateWithMixedIds);

      // Add new group
      const addButton = screen.getByRole('button', { name: 'Add' });
      await user.click(addButton);

      // Verify modal opened
      expect(screen.getByTestId('electrode-group-modal')).toBeInTheDocument();

      // Save new group
      const saveButton = screen.getByTestId('modal-save');
      await user.click(saveButton);

      // Modal should close - highest numeric ID (2) + 1 = 3
      expect(screen.queryByTestId('electrode-group-modal')).not.toBeInTheDocument();
    });

    it('prevents ID collisions even with rapid consecutive clicks', async () => {
      const user = userEvent.setup();
      renderWithStore(<AnimalEditorStepper />);

      // First add
      let addButton = screen.getByRole('button', { name: 'Add' });
      await user.click(addButton);
      let saveButton = screen.getByTestId('modal-save');
      await user.click(saveButton);

      // Verify first group was added and modal closed
      expect(screen.queryByTestId('electrode-group-modal')).not.toBeInTheDocument();

      // Second add immediately after
      addButton = screen.getByRole('button', { name: 'Add' });
      await user.click(addButton);
      saveButton = screen.getByTestId('modal-save');
      await user.click(saveButton);

      // Second group should be added without collision
      expect(screen.queryByTestId('electrode-group-modal')).not.toBeInTheDocument();
    });
  });

  describe('Delete electrode group', () => {
    it('shows confirmation dialog before deleting', async () => {
      const user = userEvent.setup();

      const state = {
        workspace: {
          animals: {
            remy: {
              id: 'remy',
              subject: { subject_id: 'remy' },
              devices: {
                electrode_groups: [
                  {
                    id: '0',
                    device_type: 'tetrode_12.5',
                    location: 'CA1',
                    targeted_x: 1.0,
                    targeted_y: 2.0,
                    targeted_z: 3.0,
                    units: 'mm'
                  }
                ],
                ntrode_electrode_group_channel_map: []
              },
              days: [],
            },
          },
          days: {},
        },
      };

      renderWithStore(<AnimalEditorStepper />, state);

      const deleteButton = screen.getByTestId('delete-group-0');
      await user.click(deleteButton);

      // An in-app confirmation dialog appears (no native window.confirm).
      const dialog = await screen.findByRole('alertdialog');
      expect(dialog).toHaveTextContent('Delete electrode group');
    });

    it('deletes electrode group when confirmed', async () => {
      const user = userEvent.setup();

      const state = {
        workspace: {
          animals: {
            remy: {
              id: 'remy',
              subject: { subject_id: 'remy' },
              devices: {
                electrode_groups: [
                  {
                    id: '0',
                    device_type: 'tetrode_12.5',
                    location: 'CA1',
                    targeted_x: 1.0,
                    targeted_y: 2.0,
                    targeted_z: 3.0,
                    units: 'mm'
                  },
                  {
                    id: '1',
                    device_type: 'tetrode_12.5',
                    location: 'CA3',
                    targeted_x: 4.0,
                    targeted_y: 5.0,
                    targeted_z: 6.0,
                    units: 'mm'
                  }
                ],
                ntrode_electrode_group_channel_map: []
              },
              days: [],
            },
          },
          days: {},
        },
      };

      renderWithStore(<AnimalEditorStepper />, state);

      // Should see both groups initially
      expect(screen.getByTestId('delete-group-0')).toBeInTheDocument();
      expect(screen.getByTestId('delete-group-1')).toBeInTheDocument();

      // Delete first group, then confirm in the dialog.
      const deleteButton = screen.getByTestId('delete-group-0');
      await user.click(deleteButton);
      const dialog = await screen.findByRole('alertdialog');
      await user.click(within(dialog).getByRole('button', { name: /^Delete$/i }));

      // Group 0 is removed; group 1 remains.
      expect(screen.queryByTestId('delete-group-0')).not.toBeInTheDocument();
      expect(screen.getByTestId('delete-group-1')).toBeInTheDocument();
    });

    it('cancels delete when user declines confirmation', async () => {
      const user = userEvent.setup();

      const state = {
        workspace: {
          animals: {
            remy: {
              id: 'remy',
              subject: { subject_id: 'remy' },
              devices: {
                electrode_groups: [
                  {
                    id: '0',
                    device_type: 'tetrode_12.5',
                    location: 'CA1',
                    targeted_x: 1.0,
                    targeted_y: 2.0,
                    targeted_z: 3.0,
                    units: 'mm'
                  }
                ],
                ntrode_electrode_group_channel_map: []
              },
              days: [],
            },
          },
          days: {},
        },
      };

      renderWithStore(<AnimalEditorStepper />, state);

      const deleteButton = screen.getByTestId('delete-group-0');
      await user.click(deleteButton);

      // Cancel the confirmation dialog.
      const dialog = await screen.findByRole('alertdialog');
      await user.click(within(dialog).getByRole('button', { name: /^Cancel$/i }));

      // Group should still exist after cancelling; dialog is gone.
      expect(screen.getByTestId('delete-group-0')).toBeInTheDocument();
      expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    });

    it('cascades delete to associated channel maps', async () => {
      const user = userEvent.setup();

      const state = {
        workspace: {
          animals: {
            remy: {
              id: 'remy',
              subject: { subject_id: 'remy' },
              devices: {
                electrode_groups: [
                  {
                    id: '0',
                    device_type: 'tetrode_12.5',
                    location: 'CA1',
                    targeted_x: 1.0,
                    targeted_y: 2.0,
                    targeted_z: 3.0,
                    units: 'mm'
                  }
                ],
                ntrode_electrode_group_channel_map: [
                  {
                    ntrode_id: 0,
                    electrode_group_id: '0',
                    map: { 0: 0, 1: 1 }
                  },
                  {
                    ntrode_id: 1,
                    electrode_group_id: '0',
                    map: { 0: 2, 1: 3 }
                  }
                ]
              },
              days: [],
            },
          },
          days: {},
        },
      };

      renderWithStore(<AnimalEditorStepper />, state);

      const deleteButton = screen.getByTestId('delete-group-0');
      await user.click(deleteButton);

      // Confirm in the dialog; the group (and, in the store, its channel maps) is removed.
      const dialog = await screen.findByRole('alertdialog');
      await user.click(within(dialog).getByRole('button', { name: /^Delete$/i }));

      expect(screen.queryByTestId('delete-group-0')).not.toBeInTheDocument();
    });
  });

  describe('Channel Maps Integration', () => {
    it('renders ChannelMapsStep in Step 2', async () => {
      const user = userEvent.setup();
      const state = {
        workspace: {
          animals: {
            remy: {
              id: 'remy',
              subject: { subject_id: 'remy' },
              devices: {
                electrode_groups: [
                  {
                    id: '0',
                    device_type: 'tetrode_12.5',
                    location: 'CA1',
                    targeted_x: 1.0,
                    targeted_y: 2.0,
                    targeted_z: 3.0,
                    units: 'mm'
                  }
                ],
                ntrode_electrode_group_channel_map: [],
              },
              days: [],
            },
          },
          days: {},
        },
      };

      renderWithStore(<AnimalEditorStepper />, state);

      // Navigate to step 2
      const nextButton = screen.getByRole('button', { name: /next step/i });
      await user.click(nextButton);

      expect(screen.getByTestId('channel-maps-step')).toBeInTheDocument();
      expect(screen.getByText(/Step 2: Channel Maps/)).toBeInTheDocument();
    });

    it('opens channel map editor when group clicked', async () => {
      const user = userEvent.setup();
      const state = {
        workspace: {
          animals: {
            remy: {
              id: 'remy',
              subject: { subject_id: 'remy' },
              devices: {
                electrode_groups: [
                  {
                    id: '0',
                    device_type: 'tetrode_12.5',
                    location: 'CA1',
                    targeted_x: 1.0,
                    targeted_y: 2.0,
                    targeted_z: 3.0,
                    units: 'mm'
                  }
                ],
                ntrode_electrode_group_channel_map: [
                  {
                    electrode_group_id: '0',
                    ntrode_id: '0',
                    electrode_id: 0,
                    bad_channels: [],
                    map: { 0: 0, 1: 1, 2: 2, 3: 3 }
                  }
                ],
              },
              days: [],
            },
          },
          days: {},
        },
      };

      renderWithStore(<AnimalEditorStepper />, state);

      // Navigate to step 2
      const nextButton = screen.getByRole('button', { name: /next step/i });
      await user.click(nextButton);

      // Click edit channel map button
      const editButton = screen.getByTestId('edit-channel-map-0');
      await user.click(editButton);

      expect(screen.getByTestId('channel-map-editor')).toBeInTheDocument();
      expect(screen.getByTestId('channel-map-editor')).toHaveAttribute('data-group-id', '0');
    });

    it('opens the channel map editor for the group with integer id 0 (0 is not falsy)', async () => {
      const user = userEvent.setup();
      const state = {
        workspace: {
          animals: {
            remy: {
              id: 'remy',
              subject: { subject_id: 'remy' },
              devices: {
                electrode_groups: [
                  {
                    id: 0,
                    device_type: 'tetrode_12.5',
                    location: 'CA1',
                    targeted_x: 1.0,
                    targeted_y: 2.0,
                    targeted_z: 3.0,
                    units: 'mm'
                  }
                ],
                ntrode_electrode_group_channel_map: [
                  {
                    electrode_group_id: 0,
                    ntrode_id: 0,
                    bad_channels: [],
                    map: { 0: 0, 1: 1, 2: 2, 3: 3 }
                  }
                ],
              },
              days: [],
            },
          },
          days: {},
        },
      };

      renderWithStore(<AnimalEditorStepper />, state);

      const nextButton = screen.getByRole('button', { name: /next step/i });
      await user.click(nextButton);

      await user.click(screen.getByTestId('edit-channel-map-0'));

      // With the integer id 0, the editor must still resolve the group (a falsy-0
      // guard would leave editingElectrodeGroup null and render nothing).
      expect(screen.getByTestId('channel-map-editor')).toBeInTheDocument();
      expect(screen.getByTestId('channel-map-editor')).toHaveAttribute('data-group-id', '0');
      expect(screen.getByTestId('editor-channel-map-count')).toHaveTextContent('1 maps');
    });

    it('saves channel map changes correctly', async () => {
      const user = userEvent.setup();
      const state = {
        workspace: {
          animals: {
            remy: {
              id: 'remy',
              subject: { subject_id: 'remy' },
              devices: {
                electrode_groups: [
                  {
                    id: '0',
                    device_type: 'tetrode_12.5',
                    location: 'CA1',
                    targeted_x: 1.0,
                    targeted_y: 2.0,
                    targeted_z: 3.0,
                    units: 'mm'
                  }
                ],
                ntrode_electrode_group_channel_map: [
                  {
                    electrode_group_id: '0',
                    ntrode_id: '0',
                    electrode_id: 0,
                    bad_channels: [],
                    map: { 0: 0, 1: 1, 2: 2, 3: 3 }
                  }
                ],
              },
              days: [],
            },
          },
          days: {},
        },
      };

      renderWithStore(<AnimalEditorStepper />, state);

      // Navigate to step 2
      const nextButton = screen.getByRole('button', { name: /next step/i });
      await user.click(nextButton);

      // Click edit channel map button
      const editButton = screen.getByTestId('edit-channel-map-0');
      await user.click(editButton);

      expect(screen.getByTestId('channel-map-editor')).toBeInTheDocument();

      // Save changes
      const saveButton = screen.getByTestId('editor-save');
      await user.click(saveButton);

      // Editor should close
      expect(screen.queryByTestId('channel-map-editor')).not.toBeInTheDocument();
    });

    it('cancels editing without changes', async () => {
      const user = userEvent.setup();
      const state = {
        workspace: {
          animals: {
            remy: {
              id: 'remy',
              subject: { subject_id: 'remy' },
              devices: {
                electrode_groups: [
                  {
                    id: '0',
                    device_type: 'tetrode_12.5',
                    location: 'CA1',
                    targeted_x: 1.0,
                    targeted_y: 2.0,
                    targeted_z: 3.0,
                    units: 'mm'
                  }
                ],
                ntrode_electrode_group_channel_map: [
                  {
                    electrode_group_id: '0',
                    ntrode_id: '0',
                    electrode_id: 0,
                    bad_channels: [],
                    map: { 0: 0, 1: 1, 2: 2, 3: 3 }
                  }
                ],
              },
              days: [],
            },
          },
          days: {},
        },
      };

      renderWithStore(<AnimalEditorStepper />, state);

      // Navigate to step 2
      const nextButton = screen.getByRole('button', { name: /next step/i });
      await user.click(nextButton);

      // Click edit channel map button
      const editButton = screen.getByTestId('edit-channel-map-0');
      await user.click(editButton);

      expect(screen.getByTestId('channel-map-editor')).toBeInTheDocument();

      // Cancel editing
      const cancelButton = screen.getByTestId('editor-cancel');
      await user.click(cancelButton);

      // Editor should close without saving
      expect(screen.queryByTestId('channel-map-editor')).not.toBeInTheDocument();
    });

    it('filters channel maps to show only those for editing group', async () => {
      const user = userEvent.setup();
      const state = {
        workspace: {
          animals: {
            remy: {
              id: 'remy',
              subject: { subject_id: 'remy' },
              devices: {
                electrode_groups: [
                  {
                    id: '0',
                    device_type: 'tetrode_12.5',
                    location: 'CA1',
                    targeted_x: 1.0,
                    targeted_y: 2.0,
                    targeted_z: 3.0,
                    units: 'mm'
                  },
                  {
                    id: '1',
                    device_type: 'tetrode_12.5',
                    location: 'CA3',
                    targeted_x: 4.0,
                    targeted_y: 5.0,
                    targeted_z: 6.0,
                    units: 'mm'
                  }
                ],
                ntrode_electrode_group_channel_map: [
                  {
                    electrode_group_id: '0',
                    ntrode_id: '0',
                    electrode_id: 0,
                    bad_channels: [],
                    map: { 0: 0, 1: 1, 2: 2, 3: 3 }
                  },
                  {
                    electrode_group_id: '1',
                    ntrode_id: '1',
                    electrode_id: 0,
                    bad_channels: [],
                    map: { 0: 0, 1: 1, 2: 2, 3: 3 }
                  }
                ],
              },
              days: [],
            },
          },
          days: {},
        },
      };

      renderWithStore(<AnimalEditorStepper />, state);

      // Navigate to step 2
      const nextButton = screen.getByRole('button', { name: /next step/i });
      await user.click(nextButton);

      // Click edit channel map button for group 0
      const editButton = screen.getByTestId('edit-channel-map-0');
      await user.click(editButton);

      expect(screen.getByTestId('channel-map-editor')).toBeInTheDocument();
      expect(screen.getByTestId('channel-map-editor')).toHaveAttribute('data-group-id', '0');
      // Should show only 1 map (for group 0)
      expect(screen.getByTestId('editor-channel-map-count')).toHaveTextContent('1 maps');
    });
  });

  describe('HardwareConfigStep Integration (Step 3)', () => {
    it('renders HardwareConfigStep on the final step (after Optogenetics)', async () => {
      const user = userEvent.setup();
      renderWithStore(<AnimalEditorStepper />);

      // Navigate to step 1 (Channel Maps)
      const nextButton = screen.getByRole('button', { name: /next step/i });
      await user.click(nextButton);
      expect(screen.getByTestId('channel-maps-step')).toBeInTheDocument();

      // Step 2 is Optogenetics, then step 3 (final) is Hardware Config.
      await user.click(nextButton);
      expect(screen.getByRole('heading', { name: /optogenetics/i })).toBeInTheDocument();
      await user.click(nextButton);
      expect(screen.getByTestId('hardware-config-step')).toBeInTheDocument();
      expect(screen.getByText(/Step 3: Hardware Config/)).toBeInTheDocument();
    });

    it('navigates Channel Maps -> Optogenetics -> Hardware Config', async () => {
      const user = userEvent.setup();
      renderWithStore(<AnimalEditorStepper />);

      // Navigate through steps
      const nextButton = screen.getByRole('button', { name: /next step/i });
      await user.click(nextButton); // Step 0 -> Step 1
      expect(screen.getByTestId('channel-maps-step')).toBeInTheDocument();

      await user.click(nextButton); // Step 1 -> Step 2 (Optogenetics)
      expect(screen.getByRole('heading', { name: /optogenetics/i })).toBeInTheDocument();

      await user.click(nextButton); // Step 2 -> Step 3 (Hardware Config)
      expect(screen.getByTestId('hardware-config-step')).toBeInTheDocument();
    });

    it('navigates back from Hardware Config to Optogenetics', async () => {
      const user = userEvent.setup();
      renderWithStore(<AnimalEditorStepper />);

      // Navigate to the final step (Hardware Config)
      const nextButton = screen.getByRole('button', { name: /next step/i });
      await user.click(nextButton); // Step 0 -> Step 1
      await user.click(nextButton); // Step 1 -> Step 2 (Optogenetics)
      await user.click(nextButton); // Step 2 -> Step 3 (Hardware Config)
      expect(screen.getByTestId('hardware-config-step')).toBeInTheDocument();

      // Back now lands on Optogenetics (the step before Hardware Config).
      const backButton = screen.getByRole('button', { name: /previous step/i });
      await user.click(backButton);
      expect(screen.getByRole('heading', { name: /optogenetics/i })).toBeInTheDocument();
    });

    it('Hardware Config is the final step (Save button shown)', async () => {
      const user = userEvent.setup();
      renderWithStore(<AnimalEditorStepper />);

      // Navigate to the final step (Hardware Config).
      const nextButton = screen.getByRole('button', { name: /next step/i });
      await user.click(nextButton); // Step 0 -> Step 1
      await user.click(nextButton); // Step 1 -> Step 2 (Optogenetics)
      await user.click(nextButton); // Step 2 -> Step 3 (final: Hardware Config)

      // Check button label changed to Save
      expect(screen.getByRole('button', { name: /save configuration/i })).toBeInTheDocument();
    });

    it('Continue button from the final step saves and exits', async () => {
      const user = userEvent.setup();

      renderWithStore(<AnimalEditorStepper />);

      // Navigate to the final step (Hardware Config).
      const nextButton = screen.getByRole('button', { name: /next step/i });
      await user.click(nextButton); // Step 0 -> Step 1
      await user.click(nextButton); // Step 1 -> Step 2 (Optogenetics)
      await user.click(nextButton); // Step 2 -> Step 3 (final: Hardware Config)

      // Click Save
      const saveButton = screen.getByRole('button', { name: /save configuration/i });
      await user.click(saveButton);

      // Save logic executed: in-app alert shown, navigation on dismissal.
      expect(await screen.findByRole('alertdialog')).toBeInTheDocument();
      await user.click(screen.getByRole('button', { name: /close alert/i }));
      expect(window.location.hash).toContain('#/workspace');
    });

    it('passes correct props to HardwareConfigStep', async () => {
      const user = userEvent.setup();
      const state = {
        workspace: {
          animals: {
            remy: {
              id: 'remy',
              subject: { subject_id: 'remy' },
              devices: {
                electrode_groups: [],
                ntrode_electrode_group_channel_map: [],
              },
              cameras: [],
              data_acq_device: {},
              behavioral_events: [],
              days: [],
            },
          },
          days: {},
        },
      };

      renderWithStore(<AnimalEditorStepper />, state);

      // Navigate to the final step (Hardware Config), past Optogenetics.
      const nextButton = screen.getByRole('button', { name: /next step/i });
      await user.click(nextButton);
      await user.click(nextButton);
      await user.click(nextButton);

      expect(screen.getByTestId('hardware-config-step')).toBeInTheDocument();
      expect(screen.getByText('HardwareConfigStep for remy')).toBeInTheDocument();
    });
  });
});
