/**
 * @jest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import AnimalCreationForm from '../AnimalCreationForm';

describe('AnimalCreationForm', () => {
  const defaultProps = {
    onSubmit: vi.fn(),
    onCancel: vi.fn(),
    defaultExperimenters: {
      experimenter_names: ['Alice Researcher'],
      lab: 'Loren Frank Lab',
      institution: 'University of California, San Francisco',
    },
    existingAnimals: {},
    showCancelAsSkip: false,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  // Rendering Tests
  describe('Rendering', () => {
    it('renders all 8 required fields', () => {
      render(<AnimalCreationForm {...defaultProps} />);

      // Subject section
      expect(screen.getByLabelText(/subject id/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/species/i)).toBeInTheDocument();
      expect(screen.getByRole('group', { name: /^sex$/i })).toBeInTheDocument();
      expect(screen.getByLabelText(/genotype/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/date of birth/i)).toBeInTheDocument();

      // Experimenters section
      expect(screen.getByText(/experimenter names/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/lab/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/institution/i)).toBeInTheDocument();
    });

    it('pre-fills experimenters from defaultExperimenters prop', () => {
      render(<AnimalCreationForm {...defaultProps} />);

      expect(screen.getByLabelText(/experimenter 1/i)).toHaveValue('Alice Researcher');
      expect(screen.getByLabelText(/lab/i)).toHaveValue('Loren Frank Lab');
      expect(screen.getByLabelText(/institution/i)).toHaveValue(
        'University of California, San Francisco'
      );
    });
  });

  // Validation Tests
  describe('Validation', () => {
    it('validates subject_id uniqueness on blur', async () => {
      const user = userEvent.setup();
      const existingAnimals = { remy: {} };

      render(<AnimalCreationForm {...defaultProps} existingAnimals={existingAnimals} />);

      const input = screen.getByLabelText(/subject id/i);
      await user.type(input, 'remy');
      await user.tab(); // Trigger blur

      // Validation error should appear
      expect(screen.getAllByText(/already exists/i).length).toBeGreaterThan(0);
    });

    it('validates date_of_birth not in future', async () => {
      const user = userEvent.setup();
      render(<AnimalCreationForm {...defaultProps} />);

      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const futureDate = tomorrow.toISOString().split('T')[0];

      const input = screen.getByLabelText(/date of birth/i);
      await user.type(input, futureDate);
      await user.tab(); // Trigger blur

      // Validation error appears
      expect(screen.getAllByText(/cannot be in the future/i).length).toBeGreaterThan(0);
    });

    it('shows warning for date_of_birth >5 years ago', async () => {
      const user = userEvent.setup();
      render(<AnimalCreationForm {...defaultProps} />);

      const sixYearsAgo = new Date();
      sixYearsAgo.setFullYear(sixYearsAgo.getFullYear() - 6);
      const oldDate = sixYearsAgo.toISOString().split('T')[0];

      const input = screen.getByLabelText(/date of birth/i);
      await user.type(input, oldDate);
      await user.tab(); // Trigger blur

      await waitFor(() => {
        expect(screen.getByText(/years old/i)).toBeInTheDocument();
      });
    });

    it('validates at least one experimenter name required', async () => {
      const user = userEvent.setup();
      render(<AnimalCreationForm {...defaultProps} />);

      // Clear the pre-filled experimenter
      const input = screen.getByLabelText(/experimenter 1/i);
      await user.clear(input);
      await user.tab();

      // Validation error appears
      expect(screen.getAllByText(/at least one experimenter/i).length).toBeGreaterThan(0);
    });

    it('validates species required when "Other" selected', async () => {
      const user = userEvent.setup();
      render(<AnimalCreationForm {...defaultProps} />);

      const select = screen.getByLabelText(/species/i);
      await user.selectOptions(select, 'other');

      // Custom species field should appear immediately
      expect(screen.getByLabelText(/custom species/i)).toBeInTheDocument();

      // Try to submit without filling custom species
      const form = screen.getByRole('form');
      fireEvent.submit(form);

      // Validation error appears
      expect(screen.getAllByText(/custom species.*required/i).length).toBeGreaterThan(0);
    });
  });

  // Submit Behavior Tests
  describe('Submit Behavior', () => {
    it('disables submit button when form invalid', () => {
      render(<AnimalCreationForm {...defaultProps} />);

      const submitButton = screen.getByRole('button', { name: /create animal/i });
      expect(submitButton).toBeDisabled();
    });

    it('enables submit button when all required fields valid', async () => {
      const user = userEvent.setup();
      render(<AnimalCreationForm {...defaultProps} />);

      // Fill all required fields
      await user.type(screen.getByLabelText(/subject id/i), 'bean');
      await user.type(screen.getByLabelText(/genotype/i), 'Wild-type');

      const today = new Date().toISOString().split('T')[0];
      await user.type(screen.getByLabelText(/date of birth/i), today);

      await waitFor(() => {
        const submitButton = screen.getByRole('button', { name: /create animal/i });
        expect(submitButton).not.toBeDisabled();
      });
    });

    it('calls onSubmit with correct data structure', async () => {
      const user = userEvent.setup();
      const onSubmit = vi.fn();

      render(<AnimalCreationForm {...defaultProps} onSubmit={onSubmit} />);

      // Fill required fields
      await user.type(screen.getByLabelText(/subject id/i), 'bean');
      await user.type(screen.getByLabelText(/genotype/i), 'Wild-type');

      const today = new Date().toISOString().split('T')[0];
      await user.type(screen.getByLabelText(/date of birth/i), today);

      const submitButton = screen.getByRole('button', { name: /create animal/i });
      await user.click(submitButton);

      await waitFor(() => {
        expect(onSubmit).toHaveBeenCalledWith(
          expect.objectContaining({
            subject_id: 'bean',
            species: 'Rattus norvegicus',
            sex: 'U',
            genotype: 'Wild-type',
            date_of_birth: today,
            experimenter_names: ['Alice Researcher'],
            lab: 'Loren Frank Lab',
            institution: 'University of California, San Francisco',
          })
        );
      });
    });

    it('prevents duplicate submission (race condition)', async () => {
      const user = userEvent.setup();
      const onSubmit = vi.fn();

      render(<AnimalCreationForm {...defaultProps} onSubmit={onSubmit} />);

      // Fill required fields
      await user.type(screen.getByLabelText(/subject id/i), 'bean');
      await user.type(screen.getByLabelText(/genotype/i), 'Wild-type');

      const today = new Date().toISOString().split('T')[0];
      await user.type(screen.getByLabelText(/date of birth/i), today);

      const submitButton = screen.getByRole('button', { name: /create animal/i });

      // Click submit twice rapidly
      await user.click(submitButton);
      await user.click(submitButton);

      // Should only call onSubmit once (button disabled during submission)
      await waitFor(() => {
        expect(onSubmit).toHaveBeenCalledTimes(1);
      });
    });
  });

  // Interaction Tests
  describe('Interactions', () => {
    it('adds experimenter when "Add Experimenter" clicked', async () => {
      const user = userEvent.setup();
      render(<AnimalCreationForm {...defaultProps} />);

      const addButton = screen.getByRole('button', { name: /add experimenter/i });
      await user.click(addButton);

      // New field appears immediately
      expect(screen.getByRole('textbox', { name: /experimenter 2/i })).toBeInTheDocument();
    });

    it('removes experimenter when "Remove" clicked', async () => {
      const user = userEvent.setup();
      render(<AnimalCreationForm {...defaultProps} />);

      // Add second experimenter
      const addButton = screen.getByRole('button', { name: /add experimenter/i });
      await user.click(addButton);

      expect(screen.getByRole('textbox', { name: /experimenter 2/i })).toBeInTheDocument();

      // Remove it
      const removeButton = screen.getByRole('button', { name: /remove experimenter 2/i });
      await user.click(removeButton);

      // Field removed immediately
      expect(screen.queryByRole('textbox', { name: /experimenter 2/i })).not.toBeInTheDocument();
    });
  });

  // Accessibility Tests
  describe('Accessibility', () => {
    it('focuses first error field after failed validation', async () => {
      const user = userEvent.setup();
      render(<AnimalCreationForm {...defaultProps} />);

      // Fill form to enable button, then empty first field
      await user.type(screen.getByLabelText(/subject id/i), 'test');
      await user.type(screen.getByLabelText(/genotype/i), 'Wild-type');
      const today = new Date().toISOString().split('T')[0];
      await user.type(screen.getByLabelText(/date of birth/i), today);

      // Now clear subject_id to create an error
      await user.clear(screen.getByLabelText(/subject id/i));

      // Try to submit with empty subject_id
      const form = screen.getByRole('form');
      fireEvent.submit(form);

      // Focus should move to first error field
      const subjectIdInput = screen.getByLabelText(/subject id/i);
      expect(subjectIdInput).toHaveFocus();
    });

    it('announces validation errors to screen readers', async () => {
      const user = userEvent.setup();
      render(<AnimalCreationForm {...defaultProps} />);

      // Submit empty form
      const submitButton = screen.getByRole('button', { name: /create animal/i });
      await user.click(submitButton);

      // Validation summary should have role="alert" for screen readers
      const alerts = screen.getAllByRole('alert');
      const summary = alerts.find((el) => el.textContent.includes('Please fix'));
      expect(summary).toBeInTheDocument();
      expect(summary).toHaveTextContent(/please fix/i);
    });
  });

  // Edge Cases
  describe('Edge Cases', () => {
    it('prevents subject_id with spaces', async () => {
      const user = userEvent.setup();

      render(<AnimalCreationForm {...defaultProps} />);

      // Try to enter subject_id with spaces
      const subjectInput = screen.getByLabelText(/subject id/i);
      await user.type(subjectInput, 'remy with spaces');
      await user.tab();

      // Should show validation error about spaces
      expect(screen.getAllByText(/cannot contain spaces/i).length).toBeGreaterThan(0);
    });

    it('handles empty string in experimenter names array', async () => {
      const user = userEvent.setup();
      const onSubmit = vi.fn();

      render(<AnimalCreationForm {...defaultProps} onSubmit={onSubmit} />);

      // Add second experimenter but leave it empty
      const addButton = screen.getByRole('button', { name: /add experimenter/i });
      await user.click(addButton);

      // Fill all required fields (first experimenter has default value)
      await user.type(screen.getByLabelText(/subject id/i), 'bean');
      await user.type(screen.getByLabelText(/genotype/i), 'Wild-type');

      const today = new Date().toISOString().split('T')[0];
      await user.type(screen.getByLabelText(/date of birth/i), today);

      // Wait for button to become enabled
      const submitButton = screen.getByRole('button', { name: /create animal/i });
      await waitFor(() => {
        expect(submitButton).not.toBeDisabled();
      });

      await user.click(submitButton);

      // onSubmit called with filtered array (empty experimenter 2 removed)
      expect(onSubmit).toHaveBeenCalledWith(
        expect.objectContaining({
          experimenter_names: ['Alice Researcher'], // Empty string filtered out
        })
      );
    });

    it('converts species "other" + custom to final species value', async () => {
      const user = userEvent.setup();
      const onSubmit = vi.fn();

      render(<AnimalCreationForm {...defaultProps} onSubmit={onSubmit} />);

      // Select "Other" species
      const select = screen.getByLabelText(/species/i);
      await user.selectOptions(select, 'other');

      // Fill custom species
      const customInput = await screen.findByLabelText(/custom species/i);
      await user.type(customInput, 'Homo sapiens');

      // Fill other required fields
      await user.type(screen.getByLabelText(/subject id/i), 'human1');
      await user.type(screen.getByLabelText(/genotype/i), 'Wild-type');

      const today = new Date().toISOString().split('T')[0];
      await user.type(screen.getByLabelText(/date of birth/i), today);

      const submitButton = screen.getByRole('button', { name: /create animal/i });
      await user.click(submitButton);

      await waitFor(() => {
        expect(onSubmit).toHaveBeenCalledWith(
          expect.objectContaining({
            species: 'Homo sapiens', // Custom value, not "other"
          })
        );
      });
    });

    it('shows appropriate cancel button text for first-time users', () => {
      // No animals - should show "Skip for Now"
      const { rerender } = render(
        <AnimalCreationForm {...defaultProps} showCancelAsSkip={true} />
      );

      expect(screen.getByRole('button', { name: /skip for now/i })).toBeInTheDocument();

      // Animals exist - should show "Cancel"
      rerender(<AnimalCreationForm {...defaultProps} showCancelAsSkip={false} />);

      expect(screen.getByRole('button', { name: /^cancel$/i })).toBeInTheDocument();
    });
  });
});
