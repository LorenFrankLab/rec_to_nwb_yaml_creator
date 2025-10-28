import { screen } from '@testing-library/react';
import { renderWithProviders } from '../../__tests__/helpers/test-utils';
import TechnicalFields from '../TechnicalFields';

describe('TechnicalFields', () => {
  const initialState = {
    times_period_multiplier: 1.5,
    raw_data_to_volts: 0.000000195,
    default_header_file_path: '/path/to/header.xml',
  };

  describe('Component rendering', () => {
    it('should render times_period_multiplier field', () => {
      renderWithProviders(<TechnicalFields />, { initialState });
      expect(screen.getByDisplayValue('1.5')).toBeInTheDocument();
    });

    it('should render raw_data_to_volts field', () => {
      const { container } = renderWithProviders(<TechnicalFields />, { initialState });
      const input = container.querySelector('#raw_data_to_volts');
      expect(input).toBeInTheDocument();
      // Number input may display in scientific notation or decimal format
      expect(input.value).toBeTruthy();
    });

    it('should render default_header_file_path field', () => {
      renderWithProviders(<TechnicalFields />, { initialState });
      expect(screen.getByDisplayValue('/path/to/header.xml')).toBeInTheDocument();
    });

    it('should render all area-region wrappers', () => {
      const { container } = renderWithProviders(<TechnicalFields />, { initialState });
      const timesArea = container.querySelector('#times_period_multiplier-area.area-region');
      const voltsArea = container.querySelector('#raw_data_to_volts-area.area-region');
      const headerArea = container.querySelector('#default_header_file_path-area.area-region');
      expect(timesArea).toBeInTheDocument();
      expect(voltsArea).toBeInTheDocument();
      expect(headerArea).toBeInTheDocument();
    });

    it('should render field titles', () => {
      renderWithProviders(<TechnicalFields />, { initialState });
      expect(screen.getByText('Times Period Multiplier')).toBeInTheDocument();
      expect(screen.getByText('Ephys-to-Volt Conversion Factor')).toBeInTheDocument();
      expect(screen.getByText('Default Header File Path')).toBeInTheDocument();
    });
  });

  describe('Field types and validation', () => {
    it('should render times_period_multiplier as number input with required validation', () => {
      const { container } = renderWithProviders(<TechnicalFields />, { initialState });
      const input = container.querySelector('#times_period_multiplier');
      expect(input).toHaveAttribute('type', 'number');
      expect(input).toHaveAttribute('required');
      expect(input).toHaveAttribute('step', 'any');
    });

    it('should render raw_data_to_volts as number input with required validation', () => {
      const { container } = renderWithProviders(<TechnicalFields />, { initialState });
      const input = container.querySelector('#raw_data_to_volts');
      expect(input).toHaveAttribute('type', 'number');
      expect(input).toHaveAttribute('required');
      expect(input).toHaveAttribute('step', 'any');
    });

    it('should render default_header_file_path as text input with required validation', () => {
      const { container } = renderWithProviders(<TechnicalFields />, { initialState });
      const input = container.querySelector('#defaultHeaderFilePath');
      expect(input).toHaveAttribute('type', 'text');
      expect(input).toHaveAttribute('required');
    });
  });

  describe('Form data handling', () => {
    it('should handle empty times_period_multiplier value', () => {
      const stateWithEmptyMultiplier = {
        times_period_multiplier: '',
        raw_data_to_volts: 0.000000195,
        default_header_file_path: '/path/to/header.xml',
      };
      renderWithProviders(<TechnicalFields />, { initialState: stateWithEmptyMultiplier });
      const input = screen.getByPlaceholderText('Times Period Multiplier');
      expect(input).toHaveValue(null);
    });

    it('should handle empty raw_data_to_volts value', () => {
      const stateWithEmptyVolts = {
        times_period_multiplier: 1.5,
        raw_data_to_volts: '',
        default_header_file_path: '/path/to/header.xml',
      };
      renderWithProviders(<TechnicalFields />, { initialState: stateWithEmptyVolts });
      const input = screen.getByPlaceholderText(/Scalar to multiply each element/);
      expect(input).toHaveValue(null);
    });

    it('should handle empty default_header_file_path value', () => {
      const stateWithEmptyPath = {
        times_period_multiplier: 1.5,
        raw_data_to_volts: 0.000000195,
        default_header_file_path: '',
      };
      renderWithProviders(<TechnicalFields />, { initialState: stateWithEmptyPath });
      const input = screen.getByPlaceholderText('Default Header File Path');
      expect(input).toHaveValue('');
    });

    it('should handle numeric string for times_period_multiplier', () => {
      const stateWithStringMultiplier = {
        times_period_multiplier: '2.5',
        raw_data_to_volts: 0.000000195,
        default_header_file_path: '/path/to/header.xml',
      };
      renderWithProviders(<TechnicalFields />, { initialState: stateWithStringMultiplier });
      expect(screen.getByDisplayValue('2.5')).toBeInTheDocument();
    });
  });
});
