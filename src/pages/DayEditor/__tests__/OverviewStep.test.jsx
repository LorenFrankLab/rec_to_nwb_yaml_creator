import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import OverviewStep from '../OverviewStep';

describe('OverviewStep', () => {
  const mockAnimal = {
    id: 'remy',
    subject: {
      subject_id: 'remy',
      species: 'Rat',
      sex: 'M',
      genotype: 'WT',
      date_of_birth: '2023-01-01',
    },
    experimenters: {
      experimenter_name: ['John Doe'],
      lab: 'Test Lab',
      institution: 'Test Institution',
    },
  };

  const mockDay = {
    date: '2023-06-22',
    session: {
      session_id: 'remy_20230622',
      session_description: 'Day 45 of training',
      experiment_description: '',
    },
  };

  const mockMergedDay = {
    ...mockDay.session,
    ...mockAnimal.subject,
    ...mockAnimal.experimenters,
  };

  it('displays inherited fields as read-only when expanded', async () => {
    const user = userEvent.setup();
    render(
      <OverviewStep
        animal={mockAnimal}
        day={mockDay}
        mergedDay={mockMergedDay}
        onFieldUpdate={vi.fn()}
      />
    );

    // Inherited metadata should be hidden by default
    expect(screen.queryByText('Subject Information')).not.toBeInTheDocument();

    // Click toggle to show inherited metadata
    const toggleButton = screen.getByRole('button', { name: /view inherited metadata/i });
    await user.click(toggleButton);

    // Now subject fields should be visible and read-only
    await waitFor(() => {
      expect(screen.getByText('Subject Information')).toBeInTheDocument();
    });

    const subjectIdInput = screen.getByDisplayValue('remy');
    expect(subjectIdInput).toBeDisabled();
    expect(subjectIdInput).toHaveAttribute('readonly');
  });

  it('displays editable session fields', () => {
    render(
      <OverviewStep
        animal={mockAnimal}
        day={mockDay}
        mergedDay={mockMergedDay}
        onFieldUpdate={vi.fn()}
      />
    );

    // Session ID should display the value (it's read-only now, inside input value)
    expect(screen.getByDisplayValue('remy_20230622')).toBeInTheDocument();
  });

  it('calls onFieldUpdate on blur for editable fields', async () => {
    const user = userEvent.setup();
    const onFieldUpdate = vi.fn();

    render(
      <OverviewStep
        animal={mockAnimal}
        day={mockDay}
        mergedDay={mockMergedDay}
        onFieldUpdate={onFieldUpdate}
      />
    );

    // Test with Session Description (it's editable, Session ID is read-only)
    const sessionDescriptionInput = screen.getByLabelText(/Session Description/i);
    await user.clear(sessionDescriptionInput);
    await user.type(sessionDescriptionInput, 'Updated description');
    await user.tab(); // Blur

    await waitFor(() => {
      expect(onFieldUpdate).toHaveBeenCalledWith('session.session_description', 'Updated description');
    });
  });

  it('shows session ID as read-only with help text', () => {
    render(
      <OverviewStep
        animal={mockAnimal}
        day={mockDay}
        mergedDay={mockMergedDay}
        onFieldUpdate={vi.fn()}
      />
    );

    // Session ID is read-only, shows auto-generated message
    expect(screen.getByText(/Auto-generated from animal ID and date/i)).toBeInTheDocument();
  });

  it('marks required editable fields with asterisks', () => {
    render(
      <OverviewStep
        animal={mockAnimal}
        day={mockDay}
        mergedDay={mockMergedDay}
        onFieldUpdate={vi.fn()}
      />
    );

    // Check that required label has the required class (CSS adds asterisk)
    // Session Description is required, Session ID is read-only
    const sessionDescriptionLabel = screen.getByText(/Session Description/i);
    expect(sessionDescriptionLabel).toHaveClass('required');
  });

  it('shows "Edit Animal" links when inherited metadata is expanded', async () => {
    const user = userEvent.setup();
    render(
      <OverviewStep
        animal={mockAnimal}
        day={mockDay}
        mergedDay={mockMergedDay}
        onFieldUpdate={vi.fn()}
      />
    );

    // Expand inherited metadata
    const toggleButton = screen.getByRole('button', { name: /view inherited metadata/i });
    await user.click(toggleButton);

    await waitFor(() => {
      const editLinks = screen.getAllByText(/Edit Animal/i);
      expect(editLinks.length).toBeGreaterThan(0);
      expect(editLinks[0]).toHaveAttribute('href', '#/animal/remy');
    });
  });

  it('shows breadcrumb navigation', () => {
    render(
      <OverviewStep
        animal={mockAnimal}
        day={mockDay}
        mergedDay={mockMergedDay}
        onFieldUpdate={vi.fn()}
      />
    );

    expect(screen.getByRole('navigation', { name: /breadcrumb/i })).toBeInTheDocument();
    expect(screen.getByText(/Animal: remy/i)).toBeInTheDocument();
    expect(screen.getByText(/Day: 2023-06-22/i)).toBeInTheDocument();
  });

  it('groups fields in sections', async () => {
    const user = userEvent.setup();
    render(
      <OverviewStep
        animal={mockAnimal}
        day={mockDay}
        mergedDay={mockMergedDay}
        onFieldUpdate={vi.fn()}
      />
    );

    // Session Metadata should always be visible
    expect(screen.getByText('Session Metadata')).toBeInTheDocument();

    // Inherited sections should be hidden by default
    expect(screen.queryByText('Subject Information')).not.toBeInTheDocument();
    expect(screen.queryByText('Experimenters')).not.toBeInTheDocument();

    // Expand inherited metadata
    const toggleButton = screen.getByRole('button', { name: /view inherited metadata/i });
    await user.click(toggleButton);

    // Now inherited sections should be visible
    await waitFor(() => {
      expect(screen.getByText('Subject Information')).toBeInTheDocument();
      expect(screen.getByText('Experimenters')).toBeInTheDocument();
    });
  });

  it('uses correct ARIA attributes for required fields', () => {
    render(
      <OverviewStep
        animal={mockAnimal}
        day={mockDay}
        mergedDay={mockMergedDay}
        onFieldUpdate={vi.fn()}
      />
    );

    // Session Description is required (Session ID is read-only)
    const sessionDescriptionInput = screen.getByLabelText(/Session Description/i);
    expect(sessionDescriptionInput).toHaveAttribute('required');
  });

  it('handles optional fields without required indicator', () => {
    render(
      <OverviewStep
        animal={mockAnimal}
        day={mockDay}
        mergedDay={mockMergedDay}
        onFieldUpdate={vi.fn()}
      />
    );

    const experimentDescLabel = screen.getByText(/Experiment Description.*Optional/i);
    expect(experimentDescLabel).toBeInTheDocument();
  });

  it('renders textarea for long text fields', () => {
    render(
      <OverviewStep
        animal={mockAnimal}
        day={mockDay}
        mergedDay={mockMergedDay}
        onFieldUpdate={vi.fn()}
      />
    );

    const sessionDescTextarea = screen.getByLabelText(/Session Description/i);
    expect(sessionDescTextarea.tagName).toBe('TEXTAREA');
  });
});
