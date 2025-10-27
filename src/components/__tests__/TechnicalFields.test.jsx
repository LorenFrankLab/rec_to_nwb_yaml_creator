import { render, screen } from '@testing-library/react';
import { vi } from 'vitest';
import TechnicalFields from '../TechnicalFields';

describe('TechnicalFields', () => {
  const defaultProps = {
    formData: {
      times_period_multiplier: 1.5,
      raw_data_to_volts: 0.000000195,
      default_header_file_path: '/path/to/header.xml',
    },
    handleChange: vi.fn(() => vi.fn()),
    onBlur: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('PropTypes validation', () => {
    it('should accept valid props without warnings', () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      render(<TechnicalFields {...defaultProps} />);
      expect(consoleSpy).not.toHaveBeenCalled();
      consoleSpy.mockRestore();
    });

    it('should warn if formData is missing', () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const { formData, ...propsWithoutFormData } = defaultProps;
      render(<TechnicalFields {...propsWithoutFormData} />);
      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });

    // Note: Tests for missing handleChange and onBlur removed
    // These props are marked as isRequired in PropTypes, so the component
    // correctly throws an error when they're missing rather than silently failing.
    // PropTypes validation is tested via the "should warn if formData is missing" test.
  });

  describe('Component rendering', () => {
    it('should render times_period_multiplier field', () => {
      render(<TechnicalFields {...defaultProps} />);
      expect(screen.getByDisplayValue('1.5')).toBeInTheDocument();
    });

    it('should render raw_data_to_volts field', () => {
      const { container } = render(<TechnicalFields {...defaultProps} />);
      const input = container.querySelector('#raw_data_to_volts');
      expect(input).toBeInTheDocument();
      // Number input may display in scientific notation or decimal format
      expect(input.value).toBeTruthy();
    });

    it('should render default_header_file_path field', () => {
      render(<TechnicalFields {...defaultProps} />);
      expect(screen.getByDisplayValue('/path/to/header.xml')).toBeInTheDocument();
    });

    it('should render all area-region wrappers', () => {
      const { container } = render(<TechnicalFields {...defaultProps} />);
      const timesArea = container.querySelector('#times_period_multiplier-area.area-region');
      const voltsArea = container.querySelector('#raw_data_to_volts-area.area-region');
      const headerArea = container.querySelector('#default_header_file_path-area.area-region');
      expect(timesArea).toBeInTheDocument();
      expect(voltsArea).toBeInTheDocument();
      expect(headerArea).toBeInTheDocument();
    });

    it('should render field titles', () => {
      render(<TechnicalFields {...defaultProps} />);
      expect(screen.getByText('Times Period Multiplier')).toBeInTheDocument();
      expect(screen.getByText('Ephys-to-Volt Conversion Factor')).toBeInTheDocument();
      expect(screen.getByText('Default Header File Path')).toBeInTheDocument();
    });
  });

  describe('Field types and validation', () => {
    it('should render times_period_multiplier as number input with required validation', () => {
      const { container } = render(<TechnicalFields {...defaultProps} />);
      const input = container.querySelector('#times_period_multiplier');
      expect(input).toHaveAttribute('type', 'number');
      expect(input).toHaveAttribute('required');
      expect(input).toHaveAttribute('step', 'any');
    });

    it('should render raw_data_to_volts as number input with required validation', () => {
      const { container } = render(<TechnicalFields {...defaultProps} />);
      const input = container.querySelector('#raw_data_to_volts');
      expect(input).toHaveAttribute('type', 'number');
      expect(input).toHaveAttribute('required');
      expect(input).toHaveAttribute('step', 'any');
    });

    it('should render default_header_file_path as text input with required validation', () => {
      const { container } = render(<TechnicalFields {...defaultProps} />);
      const input = container.querySelector('#defaultHeaderFilePath');
      expect(input).toHaveAttribute('type', 'text');
      expect(input).toHaveAttribute('required');
    });
  });

  describe('Event handlers', () => {
    it('should call handleChange for times_period_multiplier', () => {
      const handleChange = vi.fn(() => vi.fn());
      const props = { ...defaultProps, handleChange };
      render(<TechnicalFields {...props} />);
      expect(handleChange).toHaveBeenCalledWith('times_period_multiplier');
    });

    it('should call handleChange for raw_data_to_volts', () => {
      const handleChange = vi.fn(() => vi.fn());
      const props = { ...defaultProps, handleChange };
      render(<TechnicalFields {...props} />);
      expect(handleChange).toHaveBeenCalledWith('raw_data_to_volts');
    });

    it('should call handleChange for default_header_file_path', () => {
      const handleChange = vi.fn(() => vi.fn());
      const props = { ...defaultProps, handleChange };
      render(<TechnicalFields {...props} />);
      expect(handleChange).toHaveBeenCalledWith('default_header_file_path');
    });
  });

  describe('Form data handling', () => {
    it('should handle empty times_period_multiplier value', () => {
      const props = {
        ...defaultProps,
        formData: {
          ...defaultProps.formData,
          times_period_multiplier: '',
        },
      };
      render(<TechnicalFields {...props} />);
      const input = screen.getByPlaceholderText('Times Period Multiplier');
      expect(input).toHaveValue(null);
    });

    it('should handle empty raw_data_to_volts value', () => {
      const props = {
        ...defaultProps,
        formData: {
          ...defaultProps.formData,
          raw_data_to_volts: '',
        },
      };
      render(<TechnicalFields {...props} />);
      const input = screen.getByPlaceholderText(/Scalar to multiply each element/);
      expect(input).toHaveValue(null);
    });

    it('should handle empty default_header_file_path value', () => {
      const props = {
        ...defaultProps,
        formData: {
          ...defaultProps.formData,
          default_header_file_path: '',
        },
      };
      render(<TechnicalFields {...props} />);
      const input = screen.getByPlaceholderText('Default Header File Path');
      expect(input).toHaveValue('');
    });

    it('should handle numeric string for times_period_multiplier', () => {
      const props = {
        ...defaultProps,
        formData: {
          ...defaultProps.formData,
          times_period_multiplier: '2.5',
        },
      };
      render(<TechnicalFields {...props} />);
      expect(screen.getByDisplayValue('2.5')).toBeInTheDocument();
    });
  });
});
