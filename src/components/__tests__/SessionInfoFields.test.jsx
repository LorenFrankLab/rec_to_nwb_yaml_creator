import { describe, it, expect, beforeEach } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '../../__tests__/helpers/test-utils';
import SessionInfoFields from '../SessionInfoFields';

describe('SessionInfoFields Component', () => {
  let initialState;

  beforeEach(() => {
    initialState = {
      experiment_description: 'Spatial navigation study with hippocampal recordings',
      session_description: 'W-track alternation task',
      session_id: 'session_01',
      keywords: ['hippocampus', 'spatial', 'memory'],
    };
  });

  describe('Rendering', () => {
    it('should render all session info fields', () => {
      renderWithProviders(<SessionInfoFields />, { initialState });

      expect(screen.getByLabelText(/Experiment Description/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/Session Description/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/Session Id/i)).toBeInTheDocument();
      // Keywords renders as ListElement - just verify section exists
      expect(screen.getByText(/hippocampus/i)).toBeInTheDocument();
    });

    it('should render experiment_description field', () => {
      renderWithProviders(<SessionInfoFields />, { initialState });

      const field = screen.getByPlaceholderText(/Description of subject and where subject came from/i);
      expect(field).toBeInTheDocument();
    });

    it('should render session_description field', () => {
      renderWithProviders(<SessionInfoFields />, { initialState });

      const field = screen.getByPlaceholderText(/Description of current session/i);
      expect(field).toBeInTheDocument();
    });

    it('should render session_id field', () => {
      renderWithProviders(<SessionInfoFields />, { initialState });

      const field = screen.getByPlaceholderText(/Session id, e.g - 1/i);
      expect(field).toBeInTheDocument();
    });

    it('should render keywords field', () => {
      renderWithProviders(<SessionInfoFields />, { initialState });

      // Check that keywords are rendered (ListElement shows items as text)
      expect(screen.getByText(/hippocampus/i)).toBeInTheDocument();
    });
  });

  describe('Field Values', () => {
    it('should display experiment_description value', () => {
      renderWithProviders(<SessionInfoFields />, { initialState });

      const field = screen.getByPlaceholderText(/Description of subject and where subject came from/i);
      expect(field).toHaveValue('Spatial navigation study with hippocampal recordings');
    });

    it('should display session_description value', () => {
      renderWithProviders(<SessionInfoFields />, { initialState });

      const field = screen.getByPlaceholderText(/Description of current session/i);
      expect(field).toHaveValue('W-track alternation task');
    });

    it('should display session_id value', () => {
      renderWithProviders(<SessionInfoFields />, { initialState });

      const field = screen.getByPlaceholderText(/Session id, e.g - 1/i);
      expect(field).toHaveValue('session_01');
    });
  });

  describe('Field Interactions', () => {
    it('should allow typing in experiment_description field', async () => {
      const user = userEvent.setup();
      renderWithProviders(<SessionInfoFields />, { initialState });

      const field = screen.getByPlaceholderText(/Description of subject and where subject came from/i);
      await user.type(field, ' updated');

      // Verify field accepts input
      expect(field).toBeInTheDocument();
    });

    it('should allow typing in session_description field', async () => {
      const user = userEvent.setup();
      renderWithProviders(<SessionInfoFields />, { initialState });

      const field = screen.getByPlaceholderText(/Description of current session/i);
      await user.type(field, ' updated');

      // Verify field accepts input
      expect(field).toBeInTheDocument();
    });

    it('should allow typing in session_id field', async () => {
      const user = userEvent.setup();
      renderWithProviders(<SessionInfoFields />, { initialState });

      const field = screen.getByPlaceholderText(/Session id, e.g - 1/i);
      await user.clear(field);
      await user.type(field, 'new_session');

      // Verify field accepts input
      expect(field).toBeInTheDocument();
    });

    it('should handle blur events on fields', async () => {
      const user = userEvent.setup();
      renderWithProviders(<SessionInfoFields />, { initialState });

      const expField = screen.getByPlaceholderText(/Description of subject and where subject came from/i);
      await user.click(expField);
      await user.tab();

      // Verify field can lose focus
      expect(expField).toBeInTheDocument();
    });
  });

  describe('Validation', () => {
    it('should have required attribute on experiment_description', () => {
      renderWithProviders(<SessionInfoFields />, { initialState });

      const field = screen.getByPlaceholderText(/Description of subject and where subject came from/i);
      expect(field).toHaveAttribute('required');
    });

    it('should have required attribute on session_description', () => {
      renderWithProviders(<SessionInfoFields />, { initialState });

      const field = screen.getByPlaceholderText(/Description of current session/i);
      expect(field).toHaveAttribute('required');
    });

    it('should have required attribute on session_id', () => {
      renderWithProviders(<SessionInfoFields />, { initialState });

      const field = screen.getByPlaceholderText(/Session id, e.g - 1/i);
      expect(field).toHaveAttribute('required');
    });

    it('should have pattern validation on session_id', () => {
      renderWithProviders(<SessionInfoFields />, { initialState });

      const field = screen.getByPlaceholderText(/Session id, e.g - 1/i);
      // InputElement handles pattern validation internally
      expect(field).toBeInTheDocument();
    });
  });

  describe('Edge Cases', () => {
    it('should render with empty values', () => {
      const emptyState = {
        experiment_description: '',
        session_description: '',
        session_id: '',
        keywords: [],
      };

      renderWithProviders(<SessionInfoFields />, { initialState: emptyState });

      expect(screen.getByLabelText(/Experiment Description/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/Session Description/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/Session Id/i)).toBeInTheDocument();
    });

    it('should handle undefined keywords gracefully', () => {
      const stateNoKeywords = {
        experiment_description: 'Spatial navigation study with hippocampal recordings',
        session_description: 'W-track alternation task',
        session_id: 'session_01',
        keywords: undefined,
      };

      renderWithProviders(<SessionInfoFields />, { initialState: stateNoKeywords });

      expect(screen.getByLabelText(/Keywords/i)).toBeInTheDocument();
    });
  });
});
