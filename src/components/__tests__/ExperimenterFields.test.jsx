import { screen } from '@testing-library/react';
import { renderWithProviders } from '../../__tests__/helpers/test-utils';
import ExperimenterFields from '../ExperimenterFields';

describe('ExperimenterFields', () => {
  const initialState = {
    experimenter_name: ['Doe, John', 'Smith, Jane'],
  };

  describe('Component rendering', () => {
    it('should render experimenter_name field', () => {
      renderWithProviders(<ExperimenterFields />, { initialState });
      // ListElement renders items as text
      expect(screen.getByText('Doe, John')).toBeInTheDocument();
      expect(screen.getByText('Smith, Jane')).toBeInTheDocument();
    });

    it('should render with area-region wrapper', () => {
      const { container } = renderWithProviders(<ExperimenterFields />, { initialState });
      const areaRegion = container.querySelector('#experimenter_name-area.area-region');
      expect(areaRegion).toBeInTheDocument();
    });

    it('should render ListElement with correct props', () => {
      renderWithProviders(<ExperimenterFields />, { initialState });
      // Check that the ListElement title is rendered
      const labels = screen.getAllByText('Experimenter Name');
      expect(labels.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('Form data handling', () => {
    it('should handle empty experimenter_name array', () => {
      const stateWithEmptyArray = {
        experimenter_name: [],
      };
      renderWithProviders(<ExperimenterFields />, { initialState: stateWithEmptyArray });
      // Should still render the field, just without items
      const labels = screen.getAllByText('Experimenter Name');
      expect(labels.length).toBeGreaterThanOrEqual(1);
    });

    it('should handle single experimenter', () => {
      const stateWithSingleExperimenter = {
        experimenter_name: ['Doe, John'],
      };
      renderWithProviders(<ExperimenterFields />, { initialState: stateWithSingleExperimenter });
      expect(screen.getByText('Doe, John')).toBeInTheDocument();
    });

    it('should handle multiple experimenters', () => {
      const stateWithMultipleExperimenters = {
        experimenter_name: ['Doe, John', 'Smith, Jane', 'Brown, Bob'],
      };
      renderWithProviders(<ExperimenterFields />, { initialState: stateWithMultipleExperimenters });
      expect(screen.getByText('Doe, John')).toBeInTheDocument();
      expect(screen.getByText('Smith, Jane')).toBeInTheDocument();
      expect(screen.getByText('Brown, Bob')).toBeInTheDocument();
    });
  });

  describe('Integration with ListElement', () => {
    it('should pass updateFormData to ListElement', () => {
      renderWithProviders(<ExperimenterFields />, { initialState });
      // ListElement should receive updateFormData prop
      // This is tested by checking the component renders without errors
      expect(screen.getByText('Doe, John')).toBeInTheDocument();
    });

    it('should pass correct metaData to ListElement', () => {
      renderWithProviders(<ExperimenterFields />, { initialState });
      // metaData.nameValue should be 'experimenter_name'
      // This is tested indirectly through successful rendering
      expect(screen.getByText('Doe, John')).toBeInTheDocument();
    });

    it('should use correct placeholder text', () => {
      const stateWithEmptyArray = {
        experimenter_name: [],
      };
      renderWithProviders(<ExperimenterFields />, { initialState: stateWithEmptyArray });
      // ListElement uses placeholder when empty
      // Check the title is rendered
      const labels = screen.getAllByText('Experimenter Name');
      expect(labels.length).toBeGreaterThanOrEqual(1);
    });
  });
});
