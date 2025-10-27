import { render, screen } from '@testing-library/react';
import { vi } from 'vitest';
import UnitsFields from '../UnitsFields';

describe('UnitsFields', () => {
  const defaultProps = {
    formData: {
      units: {
        analog: 'volts',
        behavioral_events: 'seconds',
      },
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
      render(<UnitsFields {...defaultProps} />);
      expect(consoleSpy).not.toHaveBeenCalled();
      consoleSpy.mockRestore();
    });

    it('should warn if formData is missing', () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const { formData, ...propsWithoutFormData } = defaultProps;
      render(<UnitsFields {...propsWithoutFormData} />);
      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });

    it('should warn if handleChange is missing', () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const { handleChange, ...propsWithoutHandleChange } = defaultProps;
      render(<UnitsFields {...propsWithoutHandleChange} />);
      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });

    it('should warn if onBlur is missing', () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const { onBlur, ...propsWithoutOnBlur } = defaultProps;
      render(<UnitsFields {...propsWithoutOnBlur} />);
      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });
  });

  describe('Component rendering', () => {
    it('should render units area with details element', () => {
      const { container } = render(<UnitsFields {...defaultProps} />);
      const unitsArea = container.querySelector('#units-area.area-region');
      const details = container.querySelector('details');
      expect(unitsArea).toBeInTheDocument();
      expect(details).toBeInTheDocument();
    });

    it('should render details element as open', () => {
      const { container } = render(<UnitsFields {...defaultProps} />);
      const details = container.querySelector('details');
      expect(details).toHaveAttribute('open');
    });

    it('should render summary element with "Units" text', () => {
      render(<UnitsFields {...defaultProps} />);
      expect(screen.getByText('Units')).toBeInTheDocument();
    });

    it('should render analog field', () => {
      render(<UnitsFields {...defaultProps} />);
      expect(screen.getByDisplayValue('volts')).toBeInTheDocument();
    });

    it('should render behavioral_events field', () => {
      render(<UnitsFields {...defaultProps} />);
      expect(screen.getByDisplayValue('seconds')).toBeInTheDocument();
    });

    it('should render field titles', () => {
      render(<UnitsFields {...defaultProps} />);
      expect(screen.getByText('Analog')).toBeInTheDocument();
      expect(screen.getByText('Behavioral Events')).toBeInTheDocument();
    });
  });

  describe('Field validation', () => {
    it('should render analog field with required validation', () => {
      const { container } = render(<UnitsFields {...defaultProps} />);
      const analogInput = container.querySelector('#analog');
      expect(analogInput).toHaveAttribute('required');
    });

    it('should render behavioral_events field with required validation', () => {
      const { container } = render(<UnitsFields {...defaultProps} />);
      const behavioralEventsInput = container.querySelector('#behavioralEvents');
      expect(behavioralEventsInput).toHaveAttribute('required');
    });
  });

  describe('Event handlers', () => {
    it('should call handleChange for analog field with correct arguments', () => {
      const handleChange = vi.fn(() => vi.fn());
      const props = { ...defaultProps, handleChange };
      render(<UnitsFields {...props} />);
      expect(handleChange).toHaveBeenCalledWith('analog', 'units');
    });

    it('should call handleChange for behavioral_events field with correct arguments', () => {
      const handleChange = vi.fn(() => vi.fn());
      const props = { ...defaultProps, handleChange };
      render(<UnitsFields {...props} />);
      expect(handleChange).toHaveBeenCalledWith('behavioral_events', 'units');
    });
  });

  describe('Form data handling', () => {
    it('should handle empty analog value', () => {
      const props = {
        ...defaultProps,
        formData: {
          units: {
            analog: '',
            behavioral_events: 'seconds',
          },
        },
      };
      render(<UnitsFields {...props} />);
      const analogInput = screen.getByPlaceholderText('Analog');
      expect(analogInput).toHaveValue('');
    });

    it('should handle empty behavioral_events value', () => {
      const props = {
        ...defaultProps,
        formData: {
          units: {
            analog: 'volts',
            behavioral_events: '',
          },
        },
      };
      render(<UnitsFields {...props} />);
      const behavioralEventsInput = screen.getByPlaceholderText('Behavioral Events');
      expect(behavioralEventsInput).toHaveValue('');
    });

    it('should handle missing units object', () => {
      const props = {
        ...defaultProps,
        formData: {},
      };
      render(<UnitsFields {...props} />);
      // Should render with empty values
      const analogInput = screen.getByPlaceholderText('Analog');
      const behavioralEventsInput = screen.getByPlaceholderText('Behavioral Events');
      expect(analogInput).toHaveValue('');
      expect(behavioralEventsInput).toHaveValue('');
    });
  });
});
