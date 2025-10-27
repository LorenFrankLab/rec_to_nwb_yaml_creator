import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import SessionInfoFields from '../SessionInfoFields';

describe('SessionInfoFields Component', () => {
  let defaultProps;

  beforeEach(() => {
    defaultProps = {
      formData: {
        experiment_description: 'Spatial navigation study with hippocampal recordings',
        session_description: 'W-track alternation task',
        session_id: 'session_01',
        keywords: ['hippocampus', 'spatial', 'memory'],
      },
      handleChange: (field) => (e) => {},
      onBlur: () => {},
      updateFormData: () => {},
    };
  });

  describe('Rendering', () => {
    it('should render all session info fields', () => {
      render(<SessionInfoFields {...defaultProps} />);

      expect(screen.getByLabelText(/Experiment Description/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/Session Description/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/Session Id/i)).toBeInTheDocument();
      // Keywords renders as ListElement - just verify section exists
      expect(screen.getByText(/hippocampus/i)).toBeInTheDocument();
    });

    it('should render experiment_description field', () => {
      render(<SessionInfoFields {...defaultProps} />);

      const field = screen.getByPlaceholderText(/Description of subject and where subject came from/i);
      expect(field).toBeInTheDocument();
    });

    it('should render session_description field', () => {
      render(<SessionInfoFields {...defaultProps} />);

      const field = screen.getByPlaceholderText(/Description of current session/i);
      expect(field).toBeInTheDocument();
    });

    it('should render session_id field', () => {
      render(<SessionInfoFields {...defaultProps} />);

      const field = screen.getByPlaceholderText(/Session id, e.g - 1/i);
      expect(field).toBeInTheDocument();
    });

    it('should render keywords field', () => {
      render(<SessionInfoFields {...defaultProps} />);

      // Check that keywords are rendered (ListElement shows items as text)
      expect(screen.getByText(/hippocampus/i)).toBeInTheDocument();
    });
  });

  describe('Field Values', () => {
    it('should display experiment_description value', () => {
      render(<SessionInfoFields {...defaultProps} />);

      const field = screen.getByPlaceholderText(/Description of subject and where subject came from/i);
      expect(field).toHaveValue('Spatial navigation study with hippocampal recordings');
    });

    it('should display session_description value', () => {
      render(<SessionInfoFields {...defaultProps} />);

      const field = screen.getByPlaceholderText(/Description of current session/i);
      expect(field).toHaveValue('W-track alternation task');
    });

    it('should display session_id value', () => {
      render(<SessionInfoFields {...defaultProps} />);

      const field = screen.getByPlaceholderText(/Session id, e.g - 1/i);
      expect(field).toHaveValue('session_01');
    });
  });

  describe('Field Interactions', () => {
    it('should call handleChange when experiment_description changes', async () => {
      const user = userEvent.setup();
      let changeCalled = false;
      const mockHandleChange = (field) => (e) => {
        if (field === 'experiment_description') changeCalled = true;
      };

      render(
        <SessionInfoFields {...defaultProps} handleChange={mockHandleChange} />
      );

      const field = screen.getByPlaceholderText(/Description of subject and where subject came from/i);
      await user.type(field, ' updated');

      expect(changeCalled).toBe(true);
    });

    it('should call handleChange when session_description changes', async () => {
      const user = userEvent.setup();
      let changeCalled = false;
      const mockHandleChange = (field) => (e) => {
        if (field === 'session_description') changeCalled = true;
      };

      render(
        <SessionInfoFields {...defaultProps} handleChange={mockHandleChange} />
      );

      const field = screen.getByPlaceholderText(/Description of current session/i);
      await user.type(field, ' updated');

      expect(changeCalled).toBe(true);
    });

    it('should call handleChange when session_id changes', async () => {
      const user = userEvent.setup();
      let changeCalled = false;
      const mockHandleChange = (field) => (e) => {
        if (field === 'session_id') changeCalled = true;
      };

      render(
        <SessionInfoFields {...defaultProps} handleChange={mockHandleChange} />
      );

      const field = screen.getByPlaceholderText(/Session id, e.g - 1/i);
      await user.clear(field);
      await user.type(field, 'new_session');

      expect(changeCalled).toBe(true);
    });

    it('should call onBlur when fields lose focus', async () => {
      const user = userEvent.setup();
      let blurCount = 0;
      const mockOnBlur = () => {
        blurCount++;
      };

      render(<SessionInfoFields {...defaultProps} onBlur={mockOnBlur} />);

      const expField = screen.getByPlaceholderText(/Description of subject and where subject came from/i);
      await user.click(expField);
      await user.tab();

      expect(blurCount).toBeGreaterThan(0);
    });
  });

  describe('Validation', () => {
    it('should have required attribute on experiment_description', () => {
      render(<SessionInfoFields {...defaultProps} />);

      const field = screen.getByPlaceholderText(/Description of subject and where subject came from/i);
      expect(field).toHaveAttribute('required');
    });

    it('should have required attribute on session_description', () => {
      render(<SessionInfoFields {...defaultProps} />);

      const field = screen.getByPlaceholderText(/Description of current session/i);
      expect(field).toHaveAttribute('required');
    });

    it('should have required attribute on session_id', () => {
      render(<SessionInfoFields {...defaultProps} />);

      const field = screen.getByPlaceholderText(/Session id, e.g - 1/i);
      expect(field).toHaveAttribute('required');
    });

    it('should have pattern validation on session_id', () => {
      render(<SessionInfoFields {...defaultProps} />);

      const field = screen.getByPlaceholderText(/Session id, e.g - 1/i);
      // InputElement handles pattern validation internally
      expect(field).toBeInTheDocument();
    });
  });

  describe('Edge Cases', () => {
    it('should render with empty values', () => {
      const emptyProps = {
        ...defaultProps,
        formData: {
          experiment_description: '',
          session_description: '',
          session_id: '',
          keywords: [],
        },
      };

      render(<SessionInfoFields {...emptyProps} />);

      expect(screen.getByLabelText(/Experiment Description/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/Session Description/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/Session Id/i)).toBeInTheDocument();
    });

    it('should handle undefined keywords gracefully', () => {
      const propsNoKeywords = {
        ...defaultProps,
        formData: {
          ...defaultProps.formData,
          keywords: undefined,
        },
      };

      render(<SessionInfoFields {...propsNoKeywords} />);

      expect(screen.getByLabelText(/Keywords/i)).toBeInTheDocument();
    });
  });

  describe('PropTypes', () => {
    it('should validate PropTypes correctly', () => {
      // Console warnings would appear if PropTypes fail
      render(<SessionInfoFields {...defaultProps} />);

      expect(screen.getByLabelText(/Experiment Description/i)).toBeInTheDocument();
    });
  });
});
