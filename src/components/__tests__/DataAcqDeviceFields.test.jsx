import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import DataAcqDeviceFields from '../DataAcqDeviceFields';

describe('DataAcqDeviceFields', () => {
  let defaultProps;

  beforeEach(() => {
    // Default props matching App.js interface
    defaultProps = {
      formData: {
        data_acq_device: [
          {
            name: '',
            system: '',
            amplifier: '',
            adc_circuit: '',
          },
        ],
      },
      handleChange: vi.fn(() => vi.fn()),
      onBlur: vi.fn(),
      addArrayItem: vi.fn(),
      removeArrayItem: vi.fn(),
      duplicateArrayItem: vi.fn(),
    };
  });

  describe('Component Rendering', () => {
    it('renders the data acq device section', () => {
      render(<DataAcqDeviceFields {...defaultProps} />);

      expect(screen.getByText('Data Acq Device')).toBeInTheDocument();
    });

    it('renders with details element open by default', () => {
      const { container } = render(<DataAcqDeviceFields {...defaultProps} />);

      const details = container.querySelector('details');
      expect(details).toHaveAttribute('open');
    });

    it('has correct area ID', () => {
      const { container } = render(<DataAcqDeviceFields {...defaultProps} />);

      const area = container.querySelector('#data_acq_device-area');
      expect(area).toBeInTheDocument();
      expect(area).toHaveClass('area-region');
    });

    it('renders array update menu', () => {
      render(<DataAcqDeviceFields {...defaultProps} />);

      // ArrayUpdateMenu should be present (look for add button or menu container)
      const container = screen.getByText('Data Acq Device').closest('details');
      expect(container).toBeInTheDocument();
    });
  });

  describe('Array Item Rendering', () => {
    it('renders single device item', () => {
      render(<DataAcqDeviceFields {...defaultProps} />);

      expect(screen.getByText('Item #1')).toBeInTheDocument();
    });

    it('renders multiple device items', () => {
      const props = {
        ...defaultProps,
        formData: {
          data_acq_device: [
            { name: '1', system: 'SpikeGadgets', amplifier: 'Intan', adc_circuit: 'Intan' },
            { name: '2', system: 'SpikeGadgets', amplifier: 'Intan', adc_circuit: 'Intan' },
          ],
        },
      };

      render(<DataAcqDeviceFields {...props} />);

      expect(screen.getByText('Item #1')).toBeInTheDocument();
      expect(screen.getByText('Item #2')).toBeInTheDocument();
    });

    it('renders all fields for each device', () => {
      render(<DataAcqDeviceFields {...defaultProps} />);

      // Use getAllByLabelText since DataListElement may have multiple labels
      expect(screen.getAllByLabelText(/Name/i)[0]).toBeInTheDocument();
      expect(screen.getAllByLabelText(/System/i)[0]).toBeInTheDocument();
      expect(screen.getAllByLabelText(/Amplifier/i)[0]).toBeInTheDocument();
      expect(screen.getAllByLabelText(/ADC circuit/i)[0]).toBeInTheDocument();
    });

    it('renders array item controls (duplicate/remove)', () => {
      render(<DataAcqDeviceFields {...defaultProps} />);

      const item = screen.getByText('Item #1').closest('details');

      // ArrayItemControl should render duplicate and remove buttons
      expect(item).toBeInTheDocument();
    });
  });

  describe('Field Values from Props', () => {
    it('displays device name from formData', () => {
      const props = {
        ...defaultProps,
        formData: {
          data_acq_device: [
            { name: 'Device-123', system: '', amplifier: '', adc_circuit: '' },
          ],
        },
      };

      render(<DataAcqDeviceFields {...props} />);

      const input = screen.getByLabelText(/Name/i);
      expect(input).toHaveValue('Device-123');
    });

    it('displays system from formData', () => {
      const props = {
        ...defaultProps,
        formData: {
          data_acq_device: [
            { name: '', system: 'SpikeGadgets', amplifier: '', adc_circuit: '' },
          ],
        },
      };

      render(<DataAcqDeviceFields {...props} />);

      const input = screen.getAllByLabelText(/System/i)[0];
      expect(input).toHaveValue('SpikeGadgets');
    });

    it('displays amplifier from formData', () => {
      const props = {
        ...defaultProps,
        formData: {
          data_acq_device: [
            { name: '', system: '', amplifier: 'Intan', adc_circuit: '' },
          ],
        },
      };

      render(<DataAcqDeviceFields {...props} />);

      const input = screen.getByLabelText(/Amplifier/i);
      expect(input).toHaveValue('Intan');
    });

    it('displays adc_circuit from formData', () => {
      const props = {
        ...defaultProps,
        formData: {
          data_acq_device: [
            { name: '', system: '', amplifier: '', adc_circuit: 'Intan' },
          ],
        },
      };

      render(<DataAcqDeviceFields {...props} />);

      const input = screen.getByLabelText(/ADC circuit/i);
      expect(input).toHaveValue('Intan');
    });
  });

  describe('User Interactions', () => {
    it('calls handleChange when name is typed', async () => {
      const user = userEvent.setup();
      const mockHandleChange = vi.fn(() => vi.fn());
      const props = { ...defaultProps, handleChange: mockHandleChange };

      render(<DataAcqDeviceFields {...props} />);

      const input = screen.getByLabelText(/Name/i);
      await user.type(input, '1');

      expect(mockHandleChange).toHaveBeenCalledWith('name', 'data_acq_device', 0);
    });

    it('calls handleChange when system is typed', async () => {
      const user = userEvent.setup();
      const mockHandleChange = vi.fn(() => vi.fn());
      const props = { ...defaultProps, handleChange: mockHandleChange };

      render(<DataAcqDeviceFields {...props} />);

      const input = screen.getAllByLabelText(/System/i)[0];
      await user.type(input, 'S');

      expect(mockHandleChange).toHaveBeenCalledWith('system', 'data_acq_device', 0);
    });
  });

  describe('Blur Events', () => {
    it('calls onBlur when name loses focus', async () => {
      const user = userEvent.setup();
      const mockOnBlur = vi.fn();
      const props = { ...defaultProps, onBlur: mockOnBlur };

      render(<DataAcqDeviceFields {...props} />);

      const input = screen.getByLabelText(/Name/i);
      await user.click(input);
      await user.tab();

      expect(mockOnBlur).toHaveBeenCalledWith(
        expect.any(Object),
        { key: 'data_acq_device', index: 0 }
      );
    });
  });

  describe('Validation Props', () => {
    it('marks all fields as required', () => {
      render(<DataAcqDeviceFields {...defaultProps} />);

      expect(screen.getAllByLabelText(/Name/i)[0]).toBeRequired();
      expect(screen.getAllByLabelText(/System/i)[0]).toBeRequired();
      expect(screen.getAllByLabelText(/Amplifier/i)[0]).toBeRequired();
      expect(screen.getAllByLabelText(/ADC circuit/i)[0]).toBeRequired();
    });
  });

  describe('CRUD Operations', () => {
    it('calls addArrayItem when add button is clicked', async () => {
      const user = userEvent.setup();
      const mockAddArrayItem = vi.fn();
      const props = { ...defaultProps, addArrayItem: mockAddArrayItem };

      render(<DataAcqDeviceFields {...props} />);

      // Find the add button in ArrayUpdateMenu
      const addButton = screen.getByRole('button', { name: '＋' });
      await user.click(addButton);

      expect(mockAddArrayItem).toHaveBeenCalledTimes(1);
      expect(mockAddArrayItem.mock.calls[0][0]).toBe('data_acq_device');
      // In simple mode (allowMultiple=false), second arg is click event object
      expect(mockAddArrayItem.mock.calls[0][1]).toBeTruthy();
    });

    it('calls removeArrayItem when remove button is clicked', async () => {
      const user = userEvent.setup();
      const mockRemoveArrayItem = vi.fn();
      const props = { ...defaultProps, removeArrayItem: mockRemoveArrayItem };

      render(<DataAcqDeviceFields {...props} />);

      // Find the remove button for the first item
      const removeButton = screen.getByRole('button', { name: /Remove/i });
      await user.click(removeButton);

      expect(mockRemoveArrayItem).toHaveBeenCalledWith(0, 'data_acq_device');
    });

    it('calls duplicateArrayItem when duplicate button is clicked', async () => {
      const user = userEvent.setup();
      const mockDuplicateArrayItem = vi.fn();
      const props = { ...defaultProps, duplicateArrayItem: mockDuplicateArrayItem };

      render(<DataAcqDeviceFields {...props} />);

      // Find the duplicate button for the first item
      const duplicateButton = screen.getByRole('button', { name: /Duplicate/i });
      await user.click(duplicateButton);

      expect(mockDuplicateArrayItem).toHaveBeenCalledWith(0, 'data_acq_device');
    });

    it('renders multiple devices with independent values', () => {
      const props = {
        ...defaultProps,
        formData: {
          data_acq_device: [
            {
              name: 'Device1',
              system: 'SpikeGadgets',
              amplifier: 'Intan',
              adc_circuit: 'Intan',
            },
            {
              name: 'Device2',
              system: 'OpenEphys',
              amplifier: 'RHD',
              adc_circuit: 'RHD',
            },
          ],
        },
      };

      render(<DataAcqDeviceFields {...props} />);

      expect(screen.getByDisplayValue('Device1')).toBeInTheDocument();
      expect(screen.getByDisplayValue('Device2')).toBeInTheDocument();
      expect(screen.getByDisplayValue('SpikeGadgets')).toBeInTheDocument();
      expect(screen.getByDisplayValue('OpenEphys')).toBeInTheDocument();
    });

    it('handles empty data_acq_device array', () => {
      const props = {
        ...defaultProps,
        formData: { data_acq_device: [] },
      };

      render(<DataAcqDeviceFields {...props} />);

      // Should show ArrayUpdateMenu but no items
      expect(screen.getByText('Data Acq Device')).toBeInTheDocument();
      expect(screen.queryByText(/Item #1/i)).not.toBeInTheDocument();
    });
  });
});
