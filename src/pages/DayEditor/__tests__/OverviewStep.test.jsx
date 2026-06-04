import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import OverviewStep from '../OverviewStep';
import { parseHashRoute } from '../../../hooks/useHashRouter';

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
    const toggleButton = screen.getByRole('button', { name: /inherited subject metadata/i });
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

  it('adds a keyword and updates the day keywords field', async () => {
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

    await user.type(screen.getByRole('textbox', { name: /keywords/i }), 'spatial');
    await user.click(screen.getByRole('button', { name: /add keyword/i }));

    expect(onFieldUpdate).toHaveBeenCalledWith('keywords', ['spatial']);
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
    const toggleButton = screen.getByRole('button', { name: /inherited subject metadata/i });
    await user.click(toggleButton);

    await waitFor(() => {
      const editLinks = screen.getAllByText(/Edit Animal/i);
      expect(editLinks.length).toBeGreaterThan(0);
      // Must resolve to the Animal Editor route, not the unknown-route → legacy fallback.
      expect(editLinks[0]).toHaveAttribute('href', '#/animal/remy/editor');
    });
  });

  it('breadcrumb and Edit-Animal hrefs resolve to the Animal Editor route', async () => {
    const user = userEvent.setup();
    render(
      <OverviewStep
        animal={mockAnimal}
        day={mockDay}
        mergedDay={mockMergedDay}
        onFieldUpdate={vi.fn()}
      />
    );

    const animalCrumb = screen.getByRole('link', { name: /Animal: remy/i });
    expect(animalCrumb).toHaveAttribute('href', '#/animal/remy/editor');

    // parseHashRoute on that href yields the animal-editor view (not isUnknownRoute legacy).
    const route = parseHashRoute('#/animal/remy/editor');
    expect(route.view).toBe('animal-editor');
    expect(route.isUnknownRoute).toBeFalsy();
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
    const toggleButton = screen.getByRole('button', { name: /inherited subject metadata/i });
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

  it('marks experiment description as required (non-empty; written to the NWB file)', () => {
    render(
      <OverviewStep
        animal={mockAnimal}
        day={mockDay}
        mergedDay={mockMergedDay}
        onFieldUpdate={vi.fn()}
      />
    );

    const experimentDesc = screen.getByLabelText(/Experiment Description/i);
    expect(experimentDesc).toBeRequired();
  });

  it('shows an inline error when experiment description is cleared (validated at the merged path)', async () => {
    const user = userEvent.setup();
    render(
      <OverviewStep
        animal={mockAnimal}
        day={{ ...mockDay, session: { ...mockDay.session, experiment_description: 'Some experiment' } }}
        mergedDay={{ ...mockMergedDay, experiment_description: 'Some experiment' }}
        onFieldUpdate={vi.fn()}
      />
    );

    const field = screen.getByLabelText(/Experiment Description/i);
    await user.clear(field);
    await user.tab();

    await waitFor(() => {
      expect(screen.getByText(/cannot be empty|empty or contain only whitespace/i)).toBeInTheDocument();
    });
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

  describe('Subject repair fields (editable, write through to the animal)', () => {
    const expand = async (onSubjectUpdate) => {
      const user = userEvent.setup();
      render(
        <OverviewStep
          animal={mockAnimal}
          day={mockDay}
          mergedDay={mockMergedDay}
          onFieldUpdate={vi.fn()}
          onSubjectUpdate={onSubjectUpdate}
        />
      );
      await user.click(screen.getByRole('button', { name: /inherited subject metadata/i }));
      await waitFor(() => expect(screen.getByText('Subject Information')).toBeInTheDocument());
      return user;
    };

    it('normalizes an edited date of birth to a T-timestamp', async () => {
      const onSubjectUpdate = vi.fn();
      await expand(onSubjectUpdate);

      const dob = screen.getByLabelText(/date of birth/i);
      fireEvent.change(dob, { target: { value: '2024-02-03' } });
      fireEvent.blur(dob);

      expect(onSubjectUpdate).toHaveBeenCalledWith('date_of_birth', new Date('2024-02-03').toISOString());
    });

    it('writes an edited weight as a number', async () => {
      const onSubjectUpdate = vi.fn();
      const user = await expand(onSubjectUpdate);

      const weight = screen.getByLabelText(/weight/i);
      await user.type(weight, '450');
      await user.tab();

      expect(onSubjectUpdate).toHaveBeenCalledWith('weight', 450);
    });

    it('shows an inline error when an edited species is not a valid binomial', async () => {
      const onSubjectUpdate = vi.fn();
      const user = await expand(onSubjectUpdate);

      const species = screen.getByLabelText('Species');
      await user.clear(species);
      await user.type(species, 'Rat');
      await user.tab();

      // The user sees the format error at the repair site (not silently left invalid).
      expect(screen.getByRole('alert')).toHaveTextContent(/latin binomial|ncbi/i);
    });

    it('clears the species error once a valid binomial is entered', async () => {
      const user = await expand(vi.fn());
      const species = screen.getByLabelText('Species');

      await user.clear(species);
      await user.type(species, 'Rat');
      await user.tab();
      expect(screen.queryByRole('alert')).toBeInTheDocument();

      await user.clear(species);
      await user.type(species, 'Rattus norvegicus');
      await user.tab();
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });

    it('auto-expands the inherited section when a subject field is the repair target', () => {
      // The repair routes here with focusRequest.fieldPath = 'subject.weight'; the
      // section must open so the control is actually rendered (and focusable).
      render(
        <OverviewStep
          animal={mockAnimal}
          day={mockDay}
          mergedDay={mockMergedDay}
          onFieldUpdate={vi.fn()}
          onSubjectUpdate={vi.fn()}
          focusRequest={{ fieldPath: 'subject.weight', token: 1 }}
        />
      );

      // Without any click, the subject fields are visible because the section opened.
      expect(screen.getByText('Subject Information')).toBeInTheDocument();
      expect(document.querySelector('[data-field-path="subject.weight"]')).toBeInTheDocument();
    });

    it('does not auto-expand for a non-subject focus target', () => {
      render(
        <OverviewStep
          animal={mockAnimal}
          day={mockDay}
          mergedDay={mockMergedDay}
          onFieldUpdate={vi.fn()}
          onSubjectUpdate={vi.fn()}
          focusRequest={{ fieldPath: 'session_description', token: 1 }}
        />
      );
      expect(screen.queryByText('Subject Information')).not.toBeInTheDocument();
    });

    it('exposes data-field-path anchors so a subject validation error can focus the field', async () => {
      await expand(vi.fn());

      for (const path of ['subject.date_of_birth', 'subject.weight', 'subject.species', 'subject.description']) {
        expect(document.querySelector(`[data-field-path="${path}"]`)).toBeInTheDocument();
      }
    });
  });
});
