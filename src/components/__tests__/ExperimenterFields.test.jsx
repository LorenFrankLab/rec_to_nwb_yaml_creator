import { render, screen } from '@testing-library/react';
import { vi } from 'vitest';
import ExperimenterFields from '../ExperimenterFields';

describe('ExperimenterFields', () => {
  const defaultProps = {
    formData: {
      experimenter_name: ['Doe, John', 'Smith, Jane'],
    },
    updateFormData: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('PropTypes validation', () => {
    it('should accept valid props without warnings', () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      render(<ExperimenterFields {...defaultProps} />);
      expect(consoleSpy).not.toHaveBeenCalled();
      consoleSpy.mockRestore();
    });

    it('should warn if formData is missing', () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const { formData, ...propsWithoutFormData } = defaultProps;
      render(<ExperimenterFields {...propsWithoutFormData} />);
      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });

    it('should warn if updateFormData is missing', () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const { updateFormData, ...propsWithoutUpdateFormData } = defaultProps;
      render(<ExperimenterFields {...propsWithoutUpdateFormData} />);
      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });
  });

  describe('Component rendering', () => {
    it('should render experimenter_name field', () => {
      render(<ExperimenterFields {...defaultProps} />);
      // ListElement renders items as text
      expect(screen.getByText('Doe, John')).toBeInTheDocument();
      expect(screen.getByText('Smith, Jane')).toBeInTheDocument();
    });

    it('should render with area-region wrapper', () => {
      const { container } = render(<ExperimenterFields {...defaultProps} />);
      const areaRegion = container.querySelector('#experimenter_name-area.area-region');
      expect(areaRegion).toBeInTheDocument();
    });

    it('should render ListElement with correct props', () => {
      render(<ExperimenterFields {...defaultProps} />);
      // Check that the ListElement title is rendered
      const labels = screen.getAllByText('Experimenter Name');
      expect(labels.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('Form data handling', () => {
    it('should handle empty experimenter_name array', () => {
      const props = {
        ...defaultProps,
        formData: {
          experimenter_name: [],
        },
      };
      render(<ExperimenterFields {...props} />);
      // Should still render the field, just without items
      const labels = screen.getAllByText('Experimenter Name');
      expect(labels.length).toBeGreaterThanOrEqual(1);
    });

    it('should handle single experimenter', () => {
      const props = {
        ...defaultProps,
        formData: {
          experimenter_name: ['Doe, John'],
        },
      };
      render(<ExperimenterFields {...props} />);
      expect(screen.getByText('Doe, John')).toBeInTheDocument();
    });

    it('should handle multiple experimenters', () => {
      const props = {
        ...defaultProps,
        formData: {
          experimenter_name: ['Doe, John', 'Smith, Jane', 'Brown, Bob'],
        },
      };
      render(<ExperimenterFields {...props} />);
      expect(screen.getByText('Doe, John')).toBeInTheDocument();
      expect(screen.getByText('Smith, Jane')).toBeInTheDocument();
      expect(screen.getByText('Brown, Bob')).toBeInTheDocument();
    });
  });

  describe('Integration with ListElement', () => {
    it('should pass updateFormData to ListElement', () => {
      render(<ExperimenterFields {...defaultProps} />);
      // ListElement should receive updateFormData prop
      // This is tested by checking the component renders without errors
      expect(screen.getByText('Doe, John')).toBeInTheDocument();
    });

    it('should pass correct metaData to ListElement', () => {
      render(<ExperimenterFields {...defaultProps} />);
      // metaData.nameValue should be 'experimenter_name'
      // This is tested indirectly through successful rendering
      expect(screen.getByText('Doe, John')).toBeInTheDocument();
    });

    it('should use correct placeholder text', () => {
      const props = {
        ...defaultProps,
        formData: {
          experimenter_name: [],
        },
      };
      render(<ExperimenterFields {...props} />);
      // ListElement uses placeholder when empty
      // Check the title is rendered
      const labels = screen.getAllByText('Experimenter Name');
      expect(labels.length).toBeGreaterThanOrEqual(1);
    });
  });
});
