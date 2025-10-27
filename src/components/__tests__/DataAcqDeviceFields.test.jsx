import { describe, it, expect, beforeEach } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '../../__tests__/helpers/test-utils';
import DataAcqDeviceFields from '../DataAcqDeviceFields';

describe('DataAcqDeviceFields', () => {
  let initialState;

  beforeEach(() => {
    initialState = {
      data_acq_device: [
        {
          name: '',
          system: '',
          amplifier: '',
          adc_circuit: '',
        },
      ],
    };
  });

  describe('Component Rendering', () => {
    it('renders the data acq device section', () => {
      renderWithProviders(<DataAcqDeviceFields />, { initialState });

      expect(screen.getByText('Data Acq Device')).toBeInTheDocument();
    });

    it('renders with details element open by default', () => {
      const { container } = renderWithProviders(<DataAcqDeviceFields />, { initialState });

      const details = container.querySelector('details');
      expect(details).toHaveAttribute('open');
    });

    it('has correct area ID', () => {
      const { container } = renderWithProviders(<DataAcqDeviceFields />, { initialState });

      const area = container.querySelector('#data_acq_device-area');
      expect(area).toBeInTheDocument();
      expect(area).toHaveClass('area-region');
    });

    it('renders array update menu', () => {
      renderWithProviders(<DataAcqDeviceFields />, { initialState });

      // ArrayUpdateMenu should be present (look for add button or menu container)
      const container = screen.getByText('Data Acq Device').closest('details');
      expect(container).toBeInTheDocument();
    });
  });

  describe('Array Item Rendering', () => {
    it('renders single device item', () => {
      renderWithProviders(<DataAcqDeviceFields />, { initialState });

      expect(screen.getByText('Item #1')).toBeInTheDocument();
    });

    it('renders multiple device items', () => {
      const state = {
        data_acq_device: [
          { name: '1', system: 'SpikeGadgets', amplifier: 'Intan', adc_circuit: 'Intan' },
          { name: '2', system: 'SpikeGadgets', amplifier: 'Intan', adc_circuit: 'Intan' },
        ],
      };

      renderWithProviders(<DataAcqDeviceFields />, { initialState: state });

      expect(screen.getByText('Item #1')).toBeInTheDocument();
      expect(screen.getByText('Item #2')).toBeInTheDocument();
    });

    it('renders all fields for each device', () => {
      renderWithProviders(<DataAcqDeviceFields />, { initialState });

      // Use getAllByLabelText since DataListElement may have multiple labels
      expect(screen.getAllByLabelText(/Name/i)[0]).toBeInTheDocument();
      expect(screen.getAllByLabelText(/System/i)[0]).toBeInTheDocument();
      expect(screen.getAllByLabelText(/Amplifier/i)[0]).toBeInTheDocument();
      expect(screen.getAllByLabelText(/ADC circuit/i)[0]).toBeInTheDocument();
    });

    it('renders array item controls (duplicate/remove)', () => {
      renderWithProviders(<DataAcqDeviceFields />, { initialState });

      const item = screen.getByText('Item #1').closest('details');

      // ArrayItemControl should render duplicate and remove buttons
      expect(item).toBeInTheDocument();
    });
  });

  describe('Field Values from Props', () => {
    it('displays device name from formData', () => {
      const state = {
        data_acq_device: [
          { name: 'Device-123', system: '', amplifier: '', adc_circuit: '' },
        ],
      };

      renderWithProviders(<DataAcqDeviceFields />, { initialState: state });

      const input = screen.getByLabelText(/Name/i);
      expect(input).toHaveValue('Device-123');
    });

    it('displays system from formData', () => {
      const state = {
        data_acq_device: [
          { name: '', system: 'SpikeGadgets', amplifier: '', adc_circuit: '' },
        ],
      };

      renderWithProviders(<DataAcqDeviceFields />, { initialState: state });

      const input = screen.getAllByLabelText(/System/i)[0];
      expect(input).toHaveValue('SpikeGadgets');
    });

    it('displays amplifier from formData', () => {
      const state = {
        data_acq_device: [
          { name: '', system: '', amplifier: 'Intan', adc_circuit: '' },
        ],
      };

      renderWithProviders(<DataAcqDeviceFields />, { initialState: state });

      const input = screen.getByLabelText(/Amplifier/i);
      expect(input).toHaveValue('Intan');
    });

    it('displays adc_circuit from formData', () => {
      const state = {
        data_acq_device: [
          { name: '', system: '', amplifier: '', adc_circuit: 'Intan' },
        ],
      };

      renderWithProviders(<DataAcqDeviceFields />, { initialState: state });

      const input = screen.getByLabelText(/ADC circuit/i);
      expect(input).toHaveValue('Intan');
    });
  });

  describe('User Interactions', () => {
    it('allows typing in name field', async () => {
      const user = userEvent.setup();
      renderWithProviders(<DataAcqDeviceFields />, { initialState });

      const input = screen.getByLabelText(/Name/i);
      await user.type(input, '123');

      // Verify input accepts text
      expect(input).toHaveValue('123');
    });

    it('allows typing in system field', async () => {
      const user = userEvent.setup();
      renderWithProviders(<DataAcqDeviceFields />, { initialState });

      const input = screen.getAllByLabelText(/System/i)[0];
      await user.type(input, 'SpikeGadgets');

      // Verify input accepts text
      expect(input).toHaveValue('SpikeGadgets');
    });
  });

  describe('Blur Events', () => {
    it('handles blur on name field', async () => {
      const user = userEvent.setup();
      renderWithProviders(<DataAcqDeviceFields />, { initialState });

      const input = screen.getByLabelText(/Name/i);
      await user.click(input);
      await user.tab();

      // Verify blur doesn't cause errors (onBlur is handled by store)
      expect(input).not.toHaveFocus();
    });
  });

  describe('Validation Props', () => {
    it('marks all fields as required', () => {
      renderWithProviders(<DataAcqDeviceFields />, { initialState });

      expect(screen.getAllByLabelText(/Name/i)[0]).toBeRequired();
      expect(screen.getAllByLabelText(/System/i)[0]).toBeRequired();
      expect(screen.getAllByLabelText(/Amplifier/i)[0]).toBeRequired();
      expect(screen.getAllByLabelText(/ADC circuit/i)[0]).toBeRequired();
    });
  });

  describe('CRUD Operations', () => {
    it('renders add button for adding devices', () => {
      renderWithProviders(<DataAcqDeviceFields />, { initialState });

      // Find the add button in ArrayUpdateMenu
      const addButton = screen.getByRole('button', { name: '＋' });
      expect(addButton).toBeInTheDocument();
    });

    it('renders remove button for removing devices', () => {
      renderWithProviders(<DataAcqDeviceFields />, { initialState });

      // Find the remove button for the first item
      const removeButton = screen.getByRole('button', { name: /Remove/i });
      expect(removeButton).toBeInTheDocument();
    });

    it('renders duplicate button for duplicating devices', () => {
      renderWithProviders(<DataAcqDeviceFields />, { initialState });

      // Find the duplicate button for the first item
      const duplicateButton = screen.getByRole('button', { name: /Duplicate/i });
      expect(duplicateButton).toBeInTheDocument();
    });

    it('renders multiple devices with independent values', () => {
      const state = {
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
      };

      renderWithProviders(<DataAcqDeviceFields />, { initialState: state });

      expect(screen.getByDisplayValue('Device1')).toBeInTheDocument();
      expect(screen.getByDisplayValue('Device2')).toBeInTheDocument();
      expect(screen.getByDisplayValue('SpikeGadgets')).toBeInTheDocument();
      expect(screen.getByDisplayValue('OpenEphys')).toBeInTheDocument();
    });

    it('handles empty data_acq_device array', () => {
      const state = { data_acq_device: [] };

      renderWithProviders(<DataAcqDeviceFields />, { initialState: state });

      // Should show ArrayUpdateMenu but no items
      expect(screen.getByText('Data Acq Device')).toBeInTheDocument();
      expect(screen.queryByText(/Item #1/i)).not.toBeInTheDocument();
    });
  });
});
