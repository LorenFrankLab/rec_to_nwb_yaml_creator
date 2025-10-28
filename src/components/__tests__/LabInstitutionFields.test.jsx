import { screen } from '@testing-library/react';
import { renderWithProviders } from '../../__tests__/helpers/test-utils';
import LabInstitutionFields from '../LabInstitutionFields';

describe('LabInstitutionFields', () => {
  const initialState = {
    lab: 'Frank Lab',
    institution: 'University of California, San Francisco',
  };

  describe('Component rendering', () => {
    it('should render lab field', () => {
      renderWithProviders(<LabInstitutionFields />, { initialState });
      expect(screen.getByDisplayValue('Frank Lab')).toBeInTheDocument();
    });

    it('should render institution field', () => {
      renderWithProviders(<LabInstitutionFields />, { initialState });
      expect(screen.getByDisplayValue('University of California, San Francisco')).toBeInTheDocument();
    });

    it('should render with area-region wrappers', () => {
      const { container } = renderWithProviders(<LabInstitutionFields />, { initialState });
      const labArea = container.querySelector('#lab-area.area-region');
      const institutionArea = container.querySelector('#institution-area.area-region');
      expect(labArea).toBeInTheDocument();
      expect(institutionArea).toBeInTheDocument();
    });

    it('should render field titles', () => {
      renderWithProviders(<LabInstitutionFields />, { initialState });
      expect(screen.getByText('Lab')).toBeInTheDocument();
      expect(screen.getByText('Institution')).toBeInTheDocument();
    });
  });

  describe('Field types and validation', () => {
    it('should render lab as InputElement with required validation', () => {
      const { container } = renderWithProviders(<LabInstitutionFields />, { initialState });
      const labInput = container.querySelector('#lab');
      expect(labInput).toBeInTheDocument();
      expect(labInput).toHaveAttribute('type', 'text');
      expect(labInput).toHaveAttribute('required');
    });

    it('should render institution as DataListElement with required validation', () => {
      const { container } = renderWithProviders(<LabInstitutionFields />, { initialState });
      const institutionInput = container.querySelector('#institution');
      expect(institutionInput).toBeInTheDocument();
      expect(institutionInput).toHaveAttribute('required');
    });

    it('should use correct placeholders', () => {
      renderWithProviders(<LabInstitutionFields />, { initialState });
      expect(screen.getByPlaceholderText('Laboratory where the experiment is conducted')).toBeInTheDocument();
      expect(screen.getByPlaceholderText('Type to find an affiliated University or Research center')).toBeInTheDocument();
    });
  });

  describe('Form data handling', () => {
    it('should handle empty lab value', () => {
      const stateWithEmptyLab = {
        lab: '',
        institution: 'University of California, San Francisco',
      };
      renderWithProviders(<LabInstitutionFields />, { initialState: stateWithEmptyLab });
      const labInput = screen.getByPlaceholderText('Laboratory where the experiment is conducted');
      expect(labInput).toHaveValue('');
    });

    it('should handle empty institution value', () => {
      const stateWithEmptyInstitution = {
        lab: 'Frank Lab',
        institution: '',
      };
      renderWithProviders(<LabInstitutionFields />, { initialState: stateWithEmptyInstitution });
      const institutionInput = screen.getByPlaceholderText('Type to find an affiliated University or Research center');
      expect(institutionInput).toHaveValue('');
    });
  });
});
