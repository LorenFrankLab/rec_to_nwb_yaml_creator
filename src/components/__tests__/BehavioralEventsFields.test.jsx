import { describe, it, expect, beforeEach } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithProviders } from '../../__tests__/helpers/test-utils';
import BehavioralEventsFields from '../BehavioralEventsFields';

describe('BehavioralEventsFields', () => {
  let initialState;

  beforeEach(() => {
    initialState = {
      behavioral_events: [
        {
          description: '',
          name: '',
        },
      ],
    };
  });

  it('renders behavioral events section', () => {
    renderWithProviders(<BehavioralEventsFields />, { initialState });
    expect(screen.getByText('Behavioral Events')).toBeInTheDocument();
  });

  it('renders behavioral event fields', () => {
    renderWithProviders(<BehavioralEventsFields />, { initialState });
    expect(screen.getAllByLabelText(/Description/i)[0]).toBeInTheDocument();
    expect(screen.getAllByLabelText(/Name/i)[0]).toBeInTheDocument();
  });

  it('displays values from formData', () => {
    const state = {
      behavioral_events: [
        {
          description: 'Din01',
          name: 'light1',
        },
      ],
    };
    renderWithProviders(<BehavioralEventsFields />, { initialState: state });
    expect(screen.getByDisplayValue('light1')).toBeInTheDocument();
    // The description SelectInputPairElement seeds its select/input from the
    // stored value ('Din01' -> type 'Din', index 1).
    expect(screen.getByDisplayValue('Din')).toBeInTheDocument();
    expect(screen.getByRole('spinbutton')).toHaveValue(1);
  });

  it('renders multiple behavioral event items', () => {
    const state = {
      behavioral_events: [
        {
          description: 'Din01',
          name: 'light1',
        },
        {
          description: 'Din02',
          name: 'light2',
        },
      ],
    };
    renderWithProviders(<BehavioralEventsFields />, { initialState: state });
    // Names assert per-item; the description field is covered by the
    // single-item test above (two SelectInputPairs would be ambiguous here).
    expect(screen.getByDisplayValue('light1')).toBeInTheDocument();
    expect(screen.getByDisplayValue('light2')).toBeInTheDocument();
  });

  describe('CRUD Operations', () => {
    it('renders add button for adding events', () => {
      renderWithProviders(<BehavioralEventsFields />, { initialState });

      const addButton = screen.getByRole('button', { name: '＋' });
      expect(addButton).toBeInTheDocument();
    });

    it('renders remove button for removing events', () => {
      renderWithProviders(<BehavioralEventsFields />, { initialState });

      const removeButton = screen.getByRole('button', { name: /Remove/i });
      expect(removeButton).toBeInTheDocument();
    });

    it('renders duplicate button for duplicating events', () => {
      renderWithProviders(<BehavioralEventsFields />, { initialState });

      const duplicateButton = screen.getByRole('button', { name: /Duplicate/i });
      expect(duplicateButton).toBeInTheDocument();
    });
  });
});
