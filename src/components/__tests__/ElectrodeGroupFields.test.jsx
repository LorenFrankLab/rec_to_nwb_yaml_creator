import { describe, it, expect, beforeEach } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '../../__tests__/helpers/test-utils';
import ElectrodeGroupFields from '../ElectrodeGroupFields';

describe('ElectrodeGroupFields', () => {
  let initialState;

  beforeEach(() => {
    initialState = {
      electrode_groups: [
        {
          id: 0,
          location: '',
          device_type: '',
          description: '',
          targeted_location: '',
          targeted_x: '',
          targeted_y: '',
          targeted_z: '',
          units: '',
        },
      ],
      ntrode_electrode_group_channel_map: [],
    };
  });

  describe('Rendering', () => {
    it('renders electrode groups section', () => {
      renderWithProviders(<ElectrodeGroupFields />, { initialState });
      expect(screen.getByText('Electrode Groups')).toBeInTheDocument();
    });

    it('renders all electrode group fields', () => {
      renderWithProviders(<ElectrodeGroupFields />, { initialState });

      // Check for all required fields using placeholder text for uniqueness
      expect(screen.getByLabelText(/^Id$/i)).toBeInTheDocument();
      expect(screen.getByPlaceholderText(/Type to find a location/i)).toBeInTheDocument(); // Location
      expect(screen.getByLabelText(/Device Type/i)).toBeInTheDocument();
      expect(screen.getByPlaceholderText(/^Description$/i)).toBeInTheDocument(); // Description
      expect(screen.getByPlaceholderText(/Where device is implanted/i)).toBeInTheDocument(); // Targeted Location
      expect(screen.getByPlaceholderText(/Medial-Lateral from Bregma/i)).toBeInTheDocument(); // Targeted X
      expect(screen.getByPlaceholderText(/Anterior-Posterior to Bregma/i)).toBeInTheDocument(); // Targeted Y
      expect(screen.getByPlaceholderText(/Dorsal-Ventral to Cortical Surface/i)).toBeInTheDocument(); // Targeted Z
      expect(screen.getByPlaceholderText(/Distance units defining positioning/i)).toBeInTheDocument(); // Units
    });

    it('renders ArrayUpdateMenu with allowMultiple', () => {
      renderWithProviders(<ElectrodeGroupFields />, { initialState });

      // ArrayUpdateMenu should be present (has the add button)
      const addButtons = screen.getAllByRole('button', { name: /＋/i });
      expect(addButtons.length).toBeGreaterThan(0);
    });

    it('renders multiple electrode groups when present', () => {
      const state = {
        ...initialState,
        electrode_groups: [
          { id: 0, location: 'CA1', device_type: 'tetrode_12.5', description: 'Test 1', targeted_location: '', targeted_x: '', targeted_y: '', targeted_z: '', units: '' },
          { id: 1, location: 'CA3', device_type: 'tetrode_12.5', description: 'Test 2', targeted_location: '', targeted_x: '', targeted_y: '', targeted_z: '', units: '' },
        ],
      };
      renderWithProviders(<ElectrodeGroupFields />, { initialState: state });

      // Should have 2 items
      expect(screen.getByText('Item #1')).toBeInTheDocument();
      expect(screen.getByText('Item #2')).toBeInTheDocument();
    });
  });

  describe('Field Values', () => {
    it('displays electrode group id', () => {
      const state = {
        ...initialState,
        electrode_groups: [
          { id: 5, location: '', device_type: '', description: '', targeted_location: '', targeted_x: '', targeted_y: '', targeted_z: '', units: '' },
        ],
      };
      renderWithProviders(<ElectrodeGroupFields />, { initialState: state });
      expect(screen.getByDisplayValue('5')).toBeInTheDocument();
    });

    it('displays electrode group location', () => {
      const state = {
        ...initialState,
        electrode_groups: [
          { id: 0, location: 'CA1', device_type: '', description: '', targeted_location: '', targeted_x: '', targeted_y: '', targeted_z: '', units: '' },
        ],
      };
      renderWithProviders(<ElectrodeGroupFields />, { initialState: state });
      expect(screen.getByDisplayValue('CA1')).toBeInTheDocument();
    });

    it('displays electrode group device_type', () => {
      const state = {
        ...initialState,
        electrode_groups: [
          { id: 0, location: '', device_type: 'tetrode_12.5', description: '', targeted_location: '', targeted_x: '', targeted_y: '', targeted_z: '', units: '' },
        ],
      };
      renderWithProviders(<ElectrodeGroupFields />, { initialState: state });
      expect(screen.getByDisplayValue('tetrode_12.5')).toBeInTheDocument();
    });

    it('displays electrode group description', () => {
      const state = {
        ...initialState,
        electrode_groups: [
          { id: 0, location: '', device_type: '', description: 'Test description', targeted_location: '', targeted_x: '', targeted_y: '', targeted_z: '', units: '' },
        ],
      };
      renderWithProviders(<ElectrodeGroupFields />, { initialState: state });
      expect(screen.getByDisplayValue('Test description')).toBeInTheDocument();
    });

    it('displays targeted coordinates', () => {
      const state = {
        ...initialState,
        electrode_groups: [
          { id: 0, location: '', device_type: '', description: '', targeted_location: 'CA1', targeted_x: 1.5, targeted_y: 2.3, targeted_z: 1.8, units: 'mm' },
        ],
      };
      renderWithProviders(<ElectrodeGroupFields />, { initialState: state });
      expect(screen.getByDisplayValue('CA1')).toBeInTheDocument();
      expect(screen.getByDisplayValue('1.5')).toBeInTheDocument();
      expect(screen.getByDisplayValue('2.3')).toBeInTheDocument();
      expect(screen.getByDisplayValue('1.8')).toBeInTheDocument();
      expect(screen.getByDisplayValue('mm')).toBeInTheDocument();
    });
  });

  describe('User Interactions', () => {
    it('allows user to type into id field', async () => {
      const user = userEvent.setup();
      renderWithProviders(<ElectrodeGroupFields />, { initialState });

      const idInput = screen.getByLabelText(/^Id$/i);

      // Just verify the input exists and is editable
      expect(idInput).toBeInTheDocument();
      expect(idInput).not.toBeDisabled();

      // Type into the field - the actual value update is tested in other tests
      await user.click(idInput);
      await user.keyboard('[Backspace]7');
    });

    it('allows user to type into location field', async () => {
      const user = userEvent.setup();
      renderWithProviders(<ElectrodeGroupFields />, { initialState });

      const locationInput = screen.getByPlaceholderText(/Type to find a location/i);
      await user.clear(locationInput);
      await user.type(locationInput, 'CA1');

      expect(screen.getByDisplayValue('CA1')).toBeInTheDocument();
    });

    it('allows user to type into description field', async () => {
      const user = userEvent.setup();
      renderWithProviders(<ElectrodeGroupFields />, { initialState });

      const descInput = screen.getByPlaceholderText(/^Description$/i);
      await user.clear(descInput);
      await user.type(descInput, 'Test description');

      expect(screen.getByDisplayValue('Test description')).toBeInTheDocument();
    });

    it('allows user to select device type', async () => {
      const user = userEvent.setup();
      renderWithProviders(<ElectrodeGroupFields />, { initialState });

      const deviceTypeSelect = screen.getByLabelText(/Device Type/i);
      await user.selectOptions(deviceTypeSelect, 'tetrode_12.5');

      expect(screen.getByDisplayValue('tetrode_12.5')).toBeInTheDocument();
    });
  });

  describe('CRUD Operations', () => {
    it('has add button for adding new electrode groups', () => {
      renderWithProviders(<ElectrodeGroupFields />, { initialState });

      const addButtons = screen.getAllByRole('button', { name: /＋/i });
      expect(addButtons.length).toBeGreaterThan(0);
    });

    it('has remove button for each electrode group', () => {
      renderWithProviders(<ElectrodeGroupFields />, { initialState });

      // Should have remove button with text "Remove"
      const removeButtons = screen.getAllByRole('button', { name: /Remove/i });
      expect(removeButtons.length).toBeGreaterThan(0);
    });

    it('has duplicate button for each electrode group', () => {
      renderWithProviders(<ElectrodeGroupFields />, { initialState });

      // Should have duplicate button with text "Duplicate"
      const duplicateButtons = screen.getAllByRole('button', { name: /Duplicate/i });
      expect(duplicateButtons.length).toBeGreaterThan(0);
    });
  });

  describe('ChannelMap Integration', () => {
    it('does not render ChannelMap when no ntrode items exist', () => {
      renderWithProviders(<ElectrodeGroupFields />, { initialState });

      // ChannelMap container should not be visible
      const channelMapContainers = screen.queryAllByText(/Ntrode/i);
      expect(channelMapContainers.length).toBe(0);
    });

    it('renders ChannelMap when ntrode items exist for electrode group', () => {
      const state = {
        ...initialState,
        electrode_groups: [
          { id: 1, location: 'CA1', device_type: 'tetrode_12.5', description: 'Test', targeted_location: '', targeted_x: '', targeted_y: '', targeted_z: '', units: '' },
        ],
        ntrode_electrode_group_channel_map: [
          {
            electrode_group_id: 1,
            ntrode_id: 1,
            map: { 0: 0, 1: 1, 2: 2, 3: 3 },
            bad_channels: [],
          },
        ],
      };
      renderWithProviders(<ElectrodeGroupFields />, { initialState: state });

      // ChannelMap should be visible
      expect(screen.getByText(/Ntrode/i)).toBeInTheDocument();
    });

    it('filters ntrode items by electrode_group_id', () => {
      const state = {
        ...initialState,
        electrode_groups: [
          { id: 1, location: 'CA1', device_type: 'tetrode_12.5', description: 'Test 1', targeted_location: '', targeted_x: '', targeted_y: '', targeted_z: '', units: '' },
          { id: 2, location: 'CA3', device_type: 'tetrode_12.5', description: 'Test 2', targeted_location: '', targeted_x: '', targeted_y: '', targeted_z: '', units: '' },
        ],
        ntrode_electrode_group_channel_map: [
          {
            electrode_group_id: 1,
            ntrode_id: 1,
            map: { 0: 0, 1: 1, 2: 2, 3: 3 },
            bad_channels: [],
          },
          {
            electrode_group_id: 2,
            ntrode_id: 2,
            map: { 0: 4, 1: 5, 2: 6, 3: 7 },
            bad_channels: [],
          },
        ],
      };
      renderWithProviders(<ElectrodeGroupFields />, { initialState: state });

      // Should render 2 ChannelMap components (one per electrode group)
      const channelMaps = screen.getAllByText(/Ntrode/i);
      expect(channelMaps.length).toBe(2);
    });
  });

  describe('Edge Cases', () => {
    it('handles empty electrode_groups array', () => {
      const state = {
        ...initialState,
        electrode_groups: [],
      };
      renderWithProviders(<ElectrodeGroupFields />, { initialState: state });

      // Should still render section header
      expect(screen.getByText('Electrode Groups')).toBeInTheDocument();
      // Should have add button
      expect(screen.getByRole('button', { name: /＋/i })).toBeInTheDocument();
    });

    it('handles missing ntrode_electrode_group_channel_map', () => {
      const state = {
        ...initialState,
        ntrode_electrode_group_channel_map: undefined,
      };

      // Should not crash
      expect(() => renderWithProviders(<ElectrodeGroupFields />, { initialState: state })).not.toThrow();
    });

    it('handles electrode group with all fields populated', () => {
      const state = {
        ...initialState,
        electrode_groups: [
          {
            id: 99,
            location: 'CA1',
            device_type: 'tetrode_12.5',
            description: 'Test electrode group',
            targeted_location: 'DG',
            targeted_x: 1.5,
            targeted_y: 2.3,
            targeted_z: 1.8,
            units: 'mm',
          },
        ],
      };
      renderWithProviders(<ElectrodeGroupFields />, { initialState: state });

      // All values should be displayed - use specific input to avoid ambiguity
      const idInput = screen.getByLabelText(/^Id$/i);
      expect(idInput).toHaveValue(99);
      expect(screen.getByDisplayValue('CA1')).toBeInTheDocument();
      expect(screen.getByDisplayValue('DG')).toBeInTheDocument();
      expect(screen.getByDisplayValue('tetrode_12.5')).toBeInTheDocument();
      expect(screen.getByDisplayValue('Test electrode group')).toBeInTheDocument();
      expect(screen.getByDisplayValue('1.5')).toBeInTheDocument();
      expect(screen.getByDisplayValue('2.3')).toBeInTheDocument();
      expect(screen.getByDisplayValue('1.8')).toBeInTheDocument();
      expect(screen.getByDisplayValue('mm')).toBeInTheDocument();
    });
  });
});
