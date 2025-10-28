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

  it('displays inherited fields as read-only', () => {
    render(
      <OverviewStep
        animal={mockAnimal}
        day={mockDay}
        mergedDay={mockMergedDay}
        onFieldUpdate={vi.fn()}
      />
    );

    // Subject fields should be read-only
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

    const sessionIdInput = screen.getByLabelText(/Session ID/i);
    expect(sessionIdInput).not.toBeDisabled();
    expect(sessionIdInput).toHaveValue('remy_20230622');
  });

  it('calls onFieldUpdate on blur', async () => {
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

    const sessionIdInput = screen.getByLabelText(/Session ID/i);
    await user.clear(sessionIdInput);
    await user.type(sessionIdInput, 'remy_20230623');
    await user.tab(); // Blur

    await waitFor(() => {
      expect(onFieldUpdate).toHaveBeenCalledWith('session.session_id', 'remy_20230623');
    });
  });

  it('shows format hints for session_id', () => {
    render(
      <OverviewStep
        animal={mockAnimal}
        day={mockDay}
        mergedDay={mockMergedDay}
        onFieldUpdate={vi.fn()}
      />
    );

    expect(screen.getByText(/Format:.*remy_\d{8}/i)).toBeInTheDocument();
  });

  it('marks required fields with asterisks', () => {
    render(
      <OverviewStep
        animal={mockAnimal}
        day={mockDay}
        mergedDay={mockMergedDay}
        onFieldUpdate={vi.fn()}
      />
    );

    // Check that required label has the required class (CSS adds asterisk)
    const sessionIdLabel = screen.getByText(/Session ID/i);
    expect(sessionIdLabel).toHaveClass('required');
  });

  it('shows "Edit Animal" links', () => {
    render(
      <OverviewStep
        animal={mockAnimal}
        day={mockDay}
        mergedDay={mockMergedDay}
        onFieldUpdate={vi.fn()}
      />
    );

    const editLinks = screen.getAllByText(/Edit Animal/i);
    expect(editLinks.length).toBeGreaterThan(0);
    expect(editLinks[0]).toHaveAttribute('href', '#/animal/remy');
  });

  it('groups fields in sections', () => {
    render(
      <OverviewStep
        animal={mockAnimal}
        day={mockDay}
        mergedDay={mockMergedDay}
        onFieldUpdate={vi.fn()}
      />
    );

    expect(screen.getByText('Subject Information')).toBeInTheDocument();
    expect(screen.getByText('Session Information')).toBeInTheDocument();
    expect(screen.getByText('Experimenters')).toBeInTheDocument();
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

    const sessionIdInput = screen.getByLabelText(/Session ID/i);
    expect(sessionIdInput).toHaveAttribute('required');
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
