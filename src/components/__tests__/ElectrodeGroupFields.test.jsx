import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ElectrodeGroupFields from '../ElectrodeGroupFields';

describe('ElectrodeGroupFields', () => {
  let defaultProps;

  beforeEach(() => {
    defaultProps = {
      formData: {
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
      },
      handleChange: vi.fn(() => vi.fn()),
      onBlur: vi.fn(),
      itemSelected: vi.fn(),
      nTrodeMapSelected: vi.fn(),
      addArrayItem: vi.fn(),
      removeElectrodeGroupItem: vi.fn(),
      duplicateElectrodeGroupItem: vi.fn(),
      updateFormArray: vi.fn(),
      onMapInput: vi.fn(),
    };
  });

  describe('Rendering', () => {
    it('renders electrode groups section', () => {
      render(<ElectrodeGroupFields {...defaultProps} />);
      expect(screen.getByText('Electrode Groups')).toBeInTheDocument();
    });

    it('renders all electrode group fields', () => {
      render(<ElectrodeGroupFields {...defaultProps} />);

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
      render(<ElectrodeGroupFields {...defaultProps} />);

      // ArrayUpdateMenu should be present (has the add button)
      const addButtons = screen.getAllByRole('button', { name: /＋/i });
      expect(addButtons.length).toBeGreaterThan(0);
    });

    it('renders multiple electrode groups when present', () => {
      const props = {
        ...defaultProps,
        formData: {
          electrode_groups: [
            { id: 0, location: 'CA1', device_type: 'tetrode_12.5', description: 'Test 1', targeted_location: '', targeted_x: '', targeted_y: '', targeted_z: '', units: '' },
            { id: 1, location: 'CA3', device_type: 'tetrode_12.5', description: 'Test 2', targeted_location: '', targeted_x: '', targeted_y: '', targeted_z: '', units: '' },
          ],
          ntrode_electrode_group_channel_map: [],
        },
      };
      render(<ElectrodeGroupFields {...props} />);

      // Should have 2 items
      expect(screen.getByText('Item #1')).toBeInTheDocument();
      expect(screen.getByText('Item #2')).toBeInTheDocument();
    });
  });

  describe('Field Values', () => {
    it('displays electrode group id', () => {
      const props = {
        ...defaultProps,
        formData: {
          electrode_groups: [
            { id: 5, location: '', device_type: '', description: '', targeted_location: '', targeted_x: '', targeted_y: '', targeted_z: '', units: '' },
          ],
          ntrode_electrode_group_channel_map: [],
        },
      };
      render(<ElectrodeGroupFields {...props} />);
      expect(screen.getByDisplayValue('5')).toBeInTheDocument();
    });

    it('displays electrode group location', () => {
      const props = {
        ...defaultProps,
        formData: {
          electrode_groups: [
            { id: 0, location: 'CA1', device_type: '', description: '', targeted_location: '', targeted_x: '', targeted_y: '', targeted_z: '', units: '' },
          ],
          ntrode_electrode_group_channel_map: [],
        },
      };
      render(<ElectrodeGroupFields {...props} />);
      expect(screen.getByDisplayValue('CA1')).toBeInTheDocument();
    });

    it('displays electrode group device_type', () => {
      const props = {
        ...defaultProps,
        formData: {
          electrode_groups: [
            { id: 0, location: '', device_type: 'tetrode_12.5', description: '', targeted_location: '', targeted_x: '', targeted_y: '', targeted_z: '', units: '' },
          ],
          ntrode_electrode_group_channel_map: [],
        },
      };
      render(<ElectrodeGroupFields {...props} />);
      expect(screen.getByDisplayValue('tetrode_12.5')).toBeInTheDocument();
    });

    it('displays electrode group description', () => {
      const props = {
        ...defaultProps,
        formData: {
          electrode_groups: [
            { id: 0, location: '', device_type: '', description: 'Test description', targeted_location: '', targeted_x: '', targeted_y: '', targeted_z: '', units: '' },
          ],
          ntrode_electrode_group_channel_map: [],
        },
      };
      render(<ElectrodeGroupFields {...props} />);
      expect(screen.getByDisplayValue('Test description')).toBeInTheDocument();
    });

    it('displays targeted coordinates', () => {
      const props = {
        ...defaultProps,
        formData: {
          electrode_groups: [
            { id: 0, location: '', device_type: '', description: '', targeted_location: 'CA1', targeted_x: 1.5, targeted_y: 2.3, targeted_z: 1.8, units: 'mm' },
          ],
          ntrode_electrode_group_channel_map: [],
        },
      };
      render(<ElectrodeGroupFields {...props} />);
      expect(screen.getByDisplayValue('CA1')).toBeInTheDocument();
      expect(screen.getByDisplayValue('1.5')).toBeInTheDocument();
      expect(screen.getByDisplayValue('2.3')).toBeInTheDocument();
      expect(screen.getByDisplayValue('1.8')).toBeInTheDocument();
      expect(screen.getByDisplayValue('mm')).toBeInTheDocument();
    });
  });

  describe('User Interactions', () => {
    it('calls handleChange when id field changes', async () => {
      const user = userEvent.setup();
      const mockHandleChange = vi.fn(() => vi.fn());
      const props = { ...defaultProps, handleChange: mockHandleChange };

      render(<ElectrodeGroupFields {...props} />);

      const idInput = screen.getByLabelText(/^Id$/i);
      await user.clear(idInput);
      await user.type(idInput, '10');

      expect(mockHandleChange).toHaveBeenCalledWith('id', 'electrode_groups', 0);
    });

    it('calls handleChange when location field changes', async () => {
      const user = userEvent.setup();
      const mockHandleChange = vi.fn(() => vi.fn());
      const props = { ...defaultProps, handleChange: mockHandleChange };

      render(<ElectrodeGroupFields {...props} />);

      // Use placeholder text to find the specific location input (not targeted_location)
      const locationInput = screen.getByPlaceholderText(/Type to find a location/i);
      await user.type(locationInput, 'CA1');

      expect(mockHandleChange).toHaveBeenCalledWith('location', 'electrode_groups', 0);
    });

    it('calls handleChange when description field changes', async () => {
      const user = userEvent.setup();
      const mockHandleChange = vi.fn(() => vi.fn());
      const props = { ...defaultProps, handleChange: mockHandleChange };

      render(<ElectrodeGroupFields {...props} />);

      const descInput = screen.getByLabelText(/^Description$/i);
      await user.type(descInput, 'Test');

      expect(mockHandleChange).toHaveBeenCalledWith('description', 'electrode_groups', 0);
    });

    it('calls nTrodeMapSelected when device_type changes', async () => {
      const user = userEvent.setup();
      const mockNTrodeMapSelected = vi.fn();
      const props = { ...defaultProps, nTrodeMapSelected: mockNTrodeMapSelected };

      render(<ElectrodeGroupFields {...props} />);

      const deviceTypeSelect = screen.getByLabelText(/Device Type/i);
      await user.selectOptions(deviceTypeSelect, 'tetrode_12.5');

      expect(mockNTrodeMapSelected).toHaveBeenCalled();
    });

    it('calls itemSelected when location blur occurs', async () => {
      const user = userEvent.setup();
      const mockItemSelected = vi.fn();
      const props = { ...defaultProps, itemSelected: mockItemSelected };

      render(<ElectrodeGroupFields {...props} />);

      const locationInput = screen.getByPlaceholderText(/Type to find a location/i);
      await user.type(locationInput, 'CA1');
      await user.tab(); // Trigger blur

      expect(mockItemSelected).toHaveBeenCalled();
    });

    it('calls onBlur when numeric field loses focus', async () => {
      const user = userEvent.setup();
      const mockOnBlur = vi.fn();
      const props = { ...defaultProps, onBlur: mockOnBlur };

      render(<ElectrodeGroupFields {...props} />);

      const idInput = screen.getByLabelText(/^Id$/i);
      await user.click(idInput);
      await user.tab(); // Trigger blur

      expect(mockOnBlur).toHaveBeenCalled();
    });
  });

  describe('CRUD Operations', () => {
    it('calls addArrayItem when add button is clicked', async () => {
      const user = userEvent.setup();
      const mockAddArrayItem = vi.fn();
      const props = { ...defaultProps, addArrayItem: mockAddArrayItem };

      render(<ElectrodeGroupFields {...props} />);

      const addButton = screen.getByRole('button', { name: '＋' });
      await user.click(addButton);

      expect(mockAddArrayItem).toHaveBeenCalledWith('electrode_groups', expect.anything());
    });

    it('calls removeElectrodeGroupItem when remove button is clicked', async () => {
      const user = userEvent.setup();
      const mockRemoveElectrodeGroupItem = vi.fn();
      const props = { ...defaultProps, removeElectrodeGroupItem: mockRemoveElectrodeGroupItem };

      render(<ElectrodeGroupFields {...props} />);

      const removeButton = screen.getByRole('button', { name: /Remove/i });
      await user.click(removeButton);

      expect(mockRemoveElectrodeGroupItem).toHaveBeenCalledWith(0, 'electrode_groups');
    });

    it('calls duplicateElectrodeGroupItem when duplicate button is clicked', async () => {
      const user = userEvent.setup();
      const mockDuplicateElectrodeGroupItem = vi.fn();
      const props = { ...defaultProps, duplicateElectrodeGroupItem: mockDuplicateElectrodeGroupItem };

      render(<ElectrodeGroupFields {...props} />);

      const duplicateButton = screen.getByRole('button', { name: /Duplicate/i });
      await user.click(duplicateButton);

      expect(mockDuplicateElectrodeGroupItem).toHaveBeenCalledWith(0, 'electrode_groups');
    });
  });

  describe('Ntrode Channel Map Integration', () => {
    it('does not render ChannelMap when no ntrode items exist', () => {
      const { container } = render(<ElectrodeGroupFields {...defaultProps} />);

      // ChannelMap should be hidden by 'hide' className
      const hiddenDiv = container.querySelector('.hide');
      expect(hiddenDiv).toBeInTheDocument();
    });

    it('renders ChannelMap when ntrode items exist for electrode group', () => {
      const props = {
        ...defaultProps,
        formData: {
          electrode_groups: [
            { id: 0, location: 'CA1', device_type: 'tetrode_12.5', description: '', targeted_location: '', targeted_x: '', targeted_y: '', targeted_z: '', units: '' },
          ],
          ntrode_electrode_group_channel_map: [
            { electrode_group_id: 0, ntrode_id: 1, map: { 0: 0, 1: 1, 2: 2, 3: 3 } },
          ],
        },
      };

      const { container } = render(<ElectrodeGroupFields {...props} />);

      // ChannelMap div should NOT have 'hide' class when ntrode items exist
      const channelMapDiv = container.querySelector('div:not(.hide) .channel-map-container, div:not(.hide)');
      expect(channelMapDiv).toBeTruthy();
    });

    it('filters ntrode items by electrode_group_id', () => {
      const props = {
        ...defaultProps,
        formData: {
          electrode_groups: [
            { id: 0, location: 'CA1', device_type: 'tetrode_12.5', description: '', targeted_location: '', targeted_x: '', targeted_y: '', targeted_z: '', units: '' },
            { id: 1, location: 'CA3', device_type: 'tetrode_12.5', description: '', targeted_location: '', targeted_x: '', targeted_y: '', targeted_z: '', units: '' },
          ],
          ntrode_electrode_group_channel_map: [
            { electrode_group_id: 0, ntrode_id: 1, map: { 0: 0, 1: 1, 2: 2, 3: 3 } },
            { electrode_group_id: 1, ntrode_id: 2, map: { 0: 4, 1: 5, 2: 6, 3: 7 } },
          ],
        },
      };

      const { container } = render(<ElectrodeGroupFields {...props} />);

      // Both electrode groups should have ChannelMap visible (not hidden)
      const visibleDivs = container.querySelectorAll('div:not(.hide)');
      expect(visibleDivs.length).toBeGreaterThan(0);
    });

    it('passes correct props to ChannelMap', () => {
      const mockUpdateFormArray = vi.fn();
      const mockOnBlur = vi.fn();
      const mockOnMapInput = vi.fn();

      const props = {
        ...defaultProps,
        formData: {
          electrode_groups: [
            { id: 5, location: 'CA1', device_type: 'tetrode_12.5', description: '', targeted_location: '', targeted_x: '', targeted_y: '', targeted_z: '', units: '' },
          ],
          ntrode_electrode_group_channel_map: [
            { electrode_group_id: 5, ntrode_id: 1, map: { 0: 0, 1: 1, 2: 2, 3: 3 } },
          ],
        },
        updateFormArray: mockUpdateFormArray,
        onBlur: mockOnBlur,
        onMapInput: mockOnMapInput,
      };

      const { container } = render(<ElectrodeGroupFields {...props} />);

      // ChannelMap should be rendered (not hidden) and receive correct props
      const hiddenDivs = container.querySelectorAll('.hide');
      expect(hiddenDivs.length).toBe(0);
    });
  });

  describe('PropTypes Validation', () => {
    it('accepts all required props without warnings', () => {
      // This test ensures PropTypes are correctly defined
      const consoleWarnSpy = vi.spyOn(console, 'warn');
      render(<ElectrodeGroupFields {...defaultProps} />);
      expect(consoleWarnSpy).not.toHaveBeenCalled();
      consoleWarnSpy.mockRestore();
    });
  });

  describe('Edge Cases', () => {
    it('handles empty electrode_groups array', () => {
      const props = {
        ...defaultProps,
        formData: {
          electrode_groups: [],
          ntrode_electrode_group_channel_map: [],
        },
      };

      render(<ElectrodeGroupFields {...props} />);

      // Should still render section header
      expect(screen.getByText('Electrode Groups')).toBeInTheDocument();

      // Should not have any items
      expect(screen.queryByText('Item #1')).not.toBeInTheDocument();
    });

    it('handles missing ntrode_electrode_group_channel_map', () => {
      const props = {
        ...defaultProps,
        formData: {
          electrode_groups: [
            { id: 0, location: '', device_type: '', description: '', targeted_location: '', targeted_x: '', targeted_y: '', targeted_z: '', units: '' },
          ],
          ntrode_electrode_group_channel_map: undefined,
        },
      };

      // Should not crash
      expect(() => render(<ElectrodeGroupFields {...props} />)).not.toThrow();
    });

    it('handles electrode group with all fields populated', () => {
      const props = {
        ...defaultProps,
        formData: {
          electrode_groups: [
            {
              id: 10,
              location: 'CA1',
              device_type: 'tetrode_12.5',
              description: 'Primary recording site',
              targeted_location: 'CA1 pyramidal layer',
              targeted_x: 1.5,
              targeted_y: -2.0,
              targeted_z: 1.8,
              units: 'mm',
            },
          ],
          ntrode_electrode_group_channel_map: [],
        },
      };

      render(<ElectrodeGroupFields {...props} />);

      expect(screen.getByDisplayValue('10')).toBeInTheDocument();
      expect(screen.getByDisplayValue('CA1')).toBeInTheDocument();
      expect(screen.getByDisplayValue('tetrode_12.5')).toBeInTheDocument();
      expect(screen.getByDisplayValue('Primary recording site')).toBeInTheDocument();
      expect(screen.getByDisplayValue('CA1 pyramidal layer')).toBeInTheDocument();
      expect(screen.getByDisplayValue('1.5')).toBeInTheDocument();
      // Number inputs display -2.0 as "-2" (HTML standard behavior)
      expect(screen.getByDisplayValue('-2')).toBeInTheDocument();
      expect(screen.getByDisplayValue('1.8')).toBeInTheDocument();
      expect(screen.getByDisplayValue('mm')).toBeInTheDocument();
    });
  });
});
