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

  it('tolerates malformed nested records (session/subject/experimenters) without crashing or warning', () => {
    // A repair routes here; malformed null/scalar nested objects must render blank fields
    // the user can fix, never crash the step on a raw dereference — and, because corrupt
    // state is first-class here, without emitting React prop-type / controlled-input warnings.
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const corruptAnimal = { id: 'remy', subject: 'corrupt', experimenters: null };
    const corruptDay = { date: 42, session: 'nope' };
    expect(() =>
      render(
        <OverviewStep animal={corruptAnimal} day={corruptDay} mergedDay={{}} onFieldUpdate={vi.fn()} onSubjectUpdate={vi.fn()} />
      )
    ).not.toThrow();
    // The Session Metadata heading still renders (step is usable, not blanked).
    expect(screen.getByRole('heading', { name: /session metadata/i })).toBeInTheDocument();
    expect(errorSpy).not.toHaveBeenCalled();
    errorSpy.mockRestore();
  });

  it('tolerates a null mergedDay (the merge-failed fail-closed path) without warning', () => {
    // DayEditorStepper passes mergedDay=null when the merge throws (corrupt animal config).
    // OverviewStep must render that fail-closed state without a required-prop warning.
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() =>
      render(
        <OverviewStep animal={mockAnimal} day={mockDay} mergedDay={null} onFieldUpdate={vi.fn()} onSubjectUpdate={vi.fn()} />
      )
    ).not.toThrow();
    expect(screen.getByRole('heading', { name: /session metadata/i })).toBeInTheDocument();
    expect(errorSpy).not.toHaveBeenCalled();
    errorSpy.mockRestore();
  });

  it('surfaces a malformed session with an executable Reset session banner', async () => {
    const user = userEvent.setup();
    const onRepair = vi.fn();
    render(
      <OverviewStep
        animal={mockAnimal}
        day={{ date: '2023-06-22', session: 'corrupt' }}
        mergedDay={{}}
        onFieldUpdate={vi.fn()}
        onSubjectUpdate={vi.fn()}
        onRepair={onRepair}
      />
    );
    const reset = screen.getByRole('button', { name: /^reset session$/i });
    await user.click(reset);
    expect(onRepair).toHaveBeenCalledWith(
      expect.objectContaining({ repairCommand: { type: 'resetDaySession' } })
    );
  });

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

  it('prefers the provided overview view-model for displayed values, help text, and the weight placeholder', async () => {
    // Phase 3-e: the DayEditorStepper passes `vm.overview.fields`; the step renders the DISPLAYED
    // read-only values, help text, and the weight placeholder from it (not re-derived inline). The
    // sentinel values below differ from what the inline derivation would produce, so a passing
    // assertion proves the view-model is the source rendered.
    const user = userEvent.setup();
    const overviewFields = [
      { fieldPath: 'session.session_id', label: 'Session ID', value: 'remy_VM', source: 'derived', readOnly: true, helpText: 'VM session id help' },
      { fieldPath: 'session.experiment_description', label: 'Experiment Description', value: '', source: 'default', helpText: 'VM experiment help' },
      { fieldPath: 'session.weight', label: 'Recording-day weight (grams)', value: '', source: 'default', fallbackValue: '999 (animal baseline)', helpText: 'VM weight help' },
      { fieldPath: 'subject.subject_id', label: 'Subject ID', value: 'VM_SUBJECT', source: 'inherited', inheritedFrom: 'animal', readOnly: true },
      { fieldPath: 'subject.sex', label: 'Sex', value: 'VM_SEX', source: 'inherited', inheritedFrom: 'animal', readOnly: true },
      { fieldPath: 'subject.genotype', label: 'Genotype', value: 'VM_GENO', source: 'inherited', inheritedFrom: 'animal', readOnly: true },
      { fieldPath: 'experimenters.experimenter_name', label: 'Names', value: 'VM Names', source: 'inherited', inheritedFrom: 'animal', readOnly: true },
      { fieldPath: 'experimenters.lab', label: 'Lab', value: 'VM Lab', source: 'inherited', inheritedFrom: 'animal', readOnly: true },
      { fieldPath: 'experimenters.institution', label: 'Institution', value: 'VM Inst', source: 'inherited', inheritedFrom: 'animal', readOnly: true },
    ];
    render(
      <OverviewStep
        animal={mockAnimal}
        day={mockDay}
        mergedDay={mockMergedDay}
        onFieldUpdate={vi.fn()}
        onSubjectUpdate={vi.fn()}
        overviewFields={overviewFields}
      />
    );

    // Default-visible Session Metadata reads from the view-model.
    expect(screen.getByDisplayValue('remy_VM')).toBeInTheDocument();
    expect(screen.getByText('VM session id help')).toBeInTheDocument();
    expect(screen.getByText('VM experiment help')).toBeInTheDocument();
    expect(screen.getByText('VM weight help')).toBeInTheDocument();
    expect(screen.getByLabelText(/recording-day weight/i)).toHaveAttribute(
      'placeholder',
      '999 (animal baseline)'
    );

    // Read-only inherited values (in the collapsed section) also read from the view-model.
    await user.click(screen.getByRole('button', { name: /inherited subject metadata/i }));
    await waitFor(() => expect(screen.getByText('Subject Information')).toBeInTheDocument());
    for (const v of ['VM_SUBJECT', 'VM_SEX', 'VM_GENO', 'VM Names', 'VM Lab', 'VM Inst']) {
      expect(screen.getByDisplayValue(v)).toBeInTheDocument();
    }
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
      expect(editLinks[0]).toHaveAttribute('href', '#/animal/remy/days');
    });
  });

  it('breadcrumb and Edit-Animal hrefs resolve to the Animal Editor route', async () => {
    render(
      <OverviewStep
        animal={mockAnimal}
        day={mockDay}
        mergedDay={mockMergedDay}
        onFieldUpdate={vi.fn()}
      />
    );

    const animalCrumb = screen.getByRole('link', { name: /Animal: remy/i });
    expect(animalCrumb).toHaveAttribute('href', '#/animal/remy/days');

    // parseHashRoute on that href yields the tabbed animal-view (Phase 3a re-points the breadcrumb
    // off the legacy /editor route), not isUnknownRoute legacy.
    const route = parseHashRoute('#/animal/remy/days');
    expect(route.view).toBe('animal-view');
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

    // Phase 8.7 Task 2.5: weight is a recording-DAY fact. The Day Overview weight field lives in
    // Session Metadata (always visible) and writes `session.weight` (the exported value), NOT the
    // shared animal weight; an animal-created weight is only a labelled fallback.
    it('writes the recording-day weight to session.weight (day-owned), not the animal', async () => {
      const user = userEvent.setup();
      const onFieldUpdate = vi.fn();
      const onSubjectUpdate = vi.fn();
      render(
        <OverviewStep
          animal={mockAnimal}
          day={mockDay}
          mergedDay={mockMergedDay}
          onFieldUpdate={onFieldUpdate}
          onSubjectUpdate={onSubjectUpdate}
        />
      );
      const weight = screen.getByLabelText(/recording-day weight/i);
      await user.type(weight, '450');
      await user.tab();

      expect(onFieldUpdate).toHaveBeenCalledWith('session.weight', 450);
      // Editing the day weight must NOT mutate the shared animal record.
      expect(onSubjectUpdate).not.toHaveBeenCalledWith('weight', expect.anything());
    });

    it('shows the day-owned weight and labels it as the value exported for this day', () => {
      const dayWithWeight = { ...mockDay, session: { ...mockDay.session, weight: 500 } };
      render(
        <OverviewStep
          animal={mockAnimal}
          day={dayWithWeight}
          mergedDay={mockMergedDay}
          onFieldUpdate={vi.fn()}
          onSubjectUpdate={vi.fn()}
        />
      );
      expect(screen.getByLabelText(/recording-day weight/i)).toHaveValue(500);
      expect(screen.getByText(/value exported for this day/i)).toBeInTheDocument();
    });

    it('identifies the animal baseline as a fallback (named) when no day weight is set', () => {
      const animalWithWeight = { ...mockAnimal, subject: { ...mockAnimal.subject, weight: 450 } };
      const dayNoWeight = { ...mockDay, session: { ...mockDay.session, weight: undefined } };
      render(
        <OverviewStep
          animal={animalWithWeight}
          day={dayNoWeight}
          mergedDay={mockMergedDay}
          onFieldUpdate={vi.fn()}
          onSubjectUpdate={vi.fn()}
        />
      );
      // Empty input + the fallback explicitly named, not silently reused as the day's own value.
      const weightInput = screen.getByLabelText(/recording-day weight/i);
      expect(weightInput).toHaveValue(null);
      expect(
        screen.getByText(/animal baseline \(450 g\) will be exported as a fallback/i)
      ).toBeInTheDocument();
      // The fallback cue (which weight will export) is announced to screen readers.
      expect(weightInput).toHaveAttribute('aria-describedby', 'session-weight-help');
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
      // The repair routes here with focusRequest.fieldPath = 'subject.species'; the
      // section must open so the control is actually rendered (and focusable). (Weight is no
      // longer a subject field — it is a day fact in Session Metadata, Phase 8.7 Task 2.5.)
      render(
        <OverviewStep
          animal={mockAnimal}
          day={mockDay}
          mergedDay={mockMergedDay}
          onFieldUpdate={vi.fn()}
          onSubjectUpdate={vi.fn()}
          focusRequest={{ fieldPath: 'subject.species', token: 1 }}
        />
      );

      // Without any click, the subject fields are visible because the section opened.
      expect(screen.getByText('Subject Information')).toBeInTheDocument();
      expect(document.querySelector('[data-field-path="subject.species"]')).toBeInTheDocument();
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

      // Weight is no longer a subject anchor here — it is a day fact (session.weight) in
      // Session Metadata (Phase 8.7 Task 2.5).
      for (const path of ['subject.date_of_birth', 'subject.species', 'subject.description']) {
        expect(document.querySelector(`[data-field-path="${path}"]`)).toBeInTheDocument();
      }
    });
  });
});
