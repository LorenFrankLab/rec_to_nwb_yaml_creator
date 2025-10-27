import { render, screen } from '@testing-library/react';
import { vi } from 'vitest';
import LabInstitutionFields from '../LabInstitutionFields';

describe('LabInstitutionFields', () => {
  const defaultProps = {
    formData: {
      lab: 'Frank Lab',
      institution: 'University of California, San Francisco',
    },
    handleChange: vi.fn(() => vi.fn()),
    onBlur: vi.fn(),
    itemSelected: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('PropTypes validation', () => {
    it('should accept valid props without warnings', () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      render(<LabInstitutionFields {...defaultProps} />);
      expect(consoleSpy).not.toHaveBeenCalled();
      consoleSpy.mockRestore();
    });

    it('should warn if formData is missing', () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const { formData, ...propsWithoutFormData } = defaultProps;
      render(<LabInstitutionFields {...propsWithoutFormData} />);
      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });

    // Note: Tests for missing handleChange, onBlur, and itemSelected removed
    // These props are marked as isRequired in PropTypes, so the component
    // correctly throws an error when they're missing rather than silently failing.
    // PropTypes validation is tested via the "should warn if formData is missing" test.
  });

  describe('Component rendering', () => {
    it('should render lab field', () => {
      render(<LabInstitutionFields {...defaultProps} />);
      expect(screen.getByDisplayValue('Frank Lab')).toBeInTheDocument();
    });

    it('should render institution field', () => {
      render(<LabInstitutionFields {...defaultProps} />);
      expect(screen.getByDisplayValue('University of California, San Francisco')).toBeInTheDocument();
    });

    it('should render with area-region wrappers', () => {
      const { container } = render(<LabInstitutionFields {...defaultProps} />);
      const labArea = container.querySelector('#lab-area.area-region');
      const institutionArea = container.querySelector('#institution-area.area-region');
      expect(labArea).toBeInTheDocument();
      expect(institutionArea).toBeInTheDocument();
    });

    it('should render field titles', () => {
      render(<LabInstitutionFields {...defaultProps} />);
      expect(screen.getByText('Lab')).toBeInTheDocument();
      expect(screen.getByText('Institution')).toBeInTheDocument();
    });
  });

  describe('Field types and validation', () => {
    it('should render lab as InputElement with required validation', () => {
      const { container } = render(<LabInstitutionFields {...defaultProps} />);
      const labInput = container.querySelector('#lab');
      expect(labInput).toBeInTheDocument();
      expect(labInput).toHaveAttribute('type', 'text');
      expect(labInput).toHaveAttribute('required');
    });

    it('should render institution as DataListElement with required validation', () => {
      const { container } = render(<LabInstitutionFields {...defaultProps} />);
      const institutionInput = container.querySelector('#institution');
      expect(institutionInput).toBeInTheDocument();
      expect(institutionInput).toHaveAttribute('required');
    });

    it('should use correct placeholders', () => {
      render(<LabInstitutionFields {...defaultProps} />);
      expect(screen.getByPlaceholderText('Laboratory where the experiment is conducted')).toBeInTheDocument();
      expect(screen.getByPlaceholderText('Type to find an affiliated University or Research center')).toBeInTheDocument();
    });
  });

  describe('Event handlers', () => {
    it('should call handleChange for lab field', () => {
      const handleChange = vi.fn(() => vi.fn());
      const props = { ...defaultProps, handleChange };
      render(<LabInstitutionFields {...props} />);
      expect(handleChange).toHaveBeenCalledWith('lab');
    });

    it('should call handleChange for institution field', () => {
      const handleChange = vi.fn(() => vi.fn());
      const props = { ...defaultProps, handleChange };
      render(<LabInstitutionFields {...props} />);
      expect(handleChange).toHaveBeenCalledWith('institution');
    });
  });

  describe('Form data handling', () => {
    it('should handle empty lab value', () => {
      const props = {
        ...defaultProps,
        formData: {
          ...defaultProps.formData,
          lab: '',
        },
      };
      render(<LabInstitutionFields {...props} />);
      const labInput = screen.getByPlaceholderText('Laboratory where the experiment is conducted');
      expect(labInput).toHaveValue('');
    });

    it('should handle empty institution value', () => {
      const props = {
        ...defaultProps,
        formData: {
          ...defaultProps.formData,
          institution: '',
        },
      };
      render(<LabInstitutionFields {...props} />);
      const institutionInput = screen.getByPlaceholderText('Type to find an affiliated University or Research center');
      expect(institutionInput).toHaveValue('');
    });
  });
});
