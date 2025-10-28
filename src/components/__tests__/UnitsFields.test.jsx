import { screen } from '@testing-library/react';
import { renderWithProviders } from '../../__tests__/helpers/test-utils';
import UnitsFields from '../UnitsFields';

describe('UnitsFields', () => {
  const initialState = {
    units: {
      analog: 'volts',
      behavioral_events: 'seconds',
    },
  };

  describe('Component rendering', () => {
    it('should render units area with details element', () => {
      const { container } = renderWithProviders(<UnitsFields />, { initialState });
      const unitsArea = container.querySelector('#units-area.area-region');
      const details = container.querySelector('details');
      expect(unitsArea).toBeInTheDocument();
      expect(details).toBeInTheDocument();
    });

    it('should render details element as open', () => {
      const { container } = renderWithProviders(<UnitsFields />, { initialState });
      const details = container.querySelector('details');
      expect(details).toHaveAttribute('open');
    });

    it('should render summary element with "Units" text', () => {
      renderWithProviders(<UnitsFields />, { initialState });
      expect(screen.getByText('Units')).toBeInTheDocument();
    });

    it('should render analog field', () => {
      renderWithProviders(<UnitsFields />, { initialState });
      expect(screen.getByDisplayValue('volts')).toBeInTheDocument();
    });

    it('should render behavioral_events field', () => {
      renderWithProviders(<UnitsFields />, { initialState });
      expect(screen.getByDisplayValue('seconds')).toBeInTheDocument();
    });

    it('should render field titles', () => {
      renderWithProviders(<UnitsFields />, { initialState });
      expect(screen.getByText('Analog')).toBeInTheDocument();
      expect(screen.getByText('Behavioral Events')).toBeInTheDocument();
    });
  });

  describe('Field validation', () => {
    it('should render analog field with required validation', () => {
      const { container } = renderWithProviders(<UnitsFields />, { initialState });
      const analogInput = container.querySelector('#analog');
      expect(analogInput).toHaveAttribute('required');
    });

    it('should render behavioral_events field with required validation', () => {
      const { container } = renderWithProviders(<UnitsFields />, { initialState });
      const behavioralEventsInput = container.querySelector('#behavioralEvents');
      expect(behavioralEventsInput).toHaveAttribute('required');
    });
  });

  describe('Form data handling', () => {
    it('should handle empty analog value', () => {
      const stateWithEmptyAnalog = {
        units: {
          analog: '',
          behavioral_events: 'seconds',
        },
      };
      renderWithProviders(<UnitsFields />, { initialState: stateWithEmptyAnalog });
      const analogInput = screen.getByPlaceholderText('Analog');
      expect(analogInput).toHaveValue('');
    });

    it('should handle empty behavioral_events value', () => {
      const stateWithEmptyBehavioralEvents = {
        units: {
          analog: 'volts',
          behavioral_events: '',
        },
      };
      renderWithProviders(<UnitsFields />, { initialState: stateWithEmptyBehavioralEvents });
      const behavioralEventsInput = screen.getByPlaceholderText('Behavioral Events');
      expect(behavioralEventsInput).toHaveValue('');
    });

    it('should handle missing units object', () => {
      const stateWithoutUnits = {};
      renderWithProviders(<UnitsFields />, { initialState: stateWithoutUnits });
      // Should render with empty values
      const analogInput = screen.getByPlaceholderText('Analog');
      const behavioralEventsInput = screen.getByPlaceholderText('Behavioral Events');
      expect(analogInput).toHaveValue('');
      expect(behavioralEventsInput).toHaveValue('');
    });
  });
});
