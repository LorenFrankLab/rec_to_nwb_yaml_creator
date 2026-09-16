import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import DayTab from '../DayTab';
import { mergeDayMetadata } from '../../../state/workspaceUtils';
import { encodeYaml } from '../../../io/yaml';
import { buildRealisticWorkspace } from '../../../__tests__/fixtures/workspaceBuilders';

describe('DayTab', () => {
  const mockAnimal = {
    id: 'remy',
    subject: {
      subject_id: 'remy',
      species: 'Rat',
      sex: 'M',
      genotype: 'WT',
      date_of_birth: '2023-01-01',
      description: 'Long Evans',
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
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const corruptAnimal = { id: 'remy', subject: 'corrupt', experimenters: null };
    const corruptDay = { date: 42, session: 'nope' };
    expect(() =>
      render(
        <DayTab animal={corruptAnimal} day={corruptDay} mergedDay={{}} onFieldUpdate={vi.fn()} />
      )
    ).not.toThrow();
    expect(screen.getByRole('heading', { name: /daily log/i })).toBeInTheDocument();
    expect(errorSpy).not.toHaveBeenCalled();
    errorSpy.mockRestore();
  });

  it('tolerates a null mergedDay (the merge-failed fail-closed path) without warning', () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() =>
      render(
        <DayTab animal={mockAnimal} day={mockDay} mergedDay={null} onFieldUpdate={vi.fn()} />
      )
    ).not.toThrow();
    expect(screen.getByRole('heading', { name: /daily log/i })).toBeInTheDocument();
    expect(errorSpy).not.toHaveBeenCalled();
    errorSpy.mockRestore();
  });

  it('surfaces a malformed session with an executable Reset session banner', async () => {
    const user = userEvent.setup();
    const onRepair = vi.fn();
    render(
      <DayTab
        animal={mockAnimal}
        day={{ date: '2023-06-22', session: 'corrupt' }}
        mergedDay={{}}
        onFieldUpdate={vi.fn()}
        onRepair={onRepair}
      />
    );
    const reset = screen.getByRole('button', { name: /^reset session$/i });
    await user.click(reset);
    expect(onRepair).toHaveBeenCalledWith(
      expect.objectContaining({ repairCommand: { type: 'resetDaySession' } })
    );
  });

  it('puts weight and team first, the epoch editor next, and the rarely-changed fields + read-only context collapsed below', () => {
    render(
      <DayTab
        animal={mockAnimal}
        day={mockDay}
        mergedDay={mockMergedDay}
        onFieldUpdate={vi.fn()}
      />
    );

    expect(screen.getByTestId('day-provenance')).toBeInTheDocument();
    expect(screen.getByLabelText(/Weight measured on/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Experimenters present/i)).toBeInTheDocument();
    expect(screen.queryByLabelText(/Data folder/i)).not.toBeInTheDocument();
    expect(screen.getByLabelText(/Session Description/i)).toBeRequired();
    expect(screen.getByLabelText(/Experiment Description/i)).toBeRequired();
    expect(screen.getByRole('heading', { name: /search terms/i })).toBeInTheDocument();
    expect(screen.queryByText(/start here/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/export required/i)).not.toBeInTheDocument();

    const weight = screen.getByLabelText(/Weight measured on/i);
    const team = screen.getByLabelText(/Experimenters present/i);
    const epochs = screen.getByRole('heading', { name: /^epochs$/i });
    const more = screen.getByText(/Experiment details & search terms/i);
    const sessionDescription = screen.getByLabelText(/Session Description/i);
    const context = screen.getByText(/session identity and animal context/i);
    const sessionId = screen.getByDisplayValue('remy_20230622');

    expect(weight.compareDocumentPosition(team) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(epochs.compareDocumentPosition(team) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(epochs.compareDocumentPosition(more) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(sessionDescription.compareDocumentPosition(more) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(sessionDescription.compareDocumentPosition(context) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(more.closest('details')).toHaveAttribute('open'); // Required experiment description is missing.
    expect(context.closest('details')).not.toHaveAttribute('open');
    expect(sessionId).not.toBeVisible();
  });

  it('writes the recording-day weight to session.weight', async () => {
    const user = userEvent.setup();
    const onFieldUpdate = vi.fn();
    render(
      <DayTab
        animal={mockAnimal}
        day={mockDay}
        mergedDay={mockMergedDay}
        onFieldUpdate={onFieldUpdate}
      />
    );

    const weight = screen.getByLabelText(/weight measured on/i);
    await user.type(weight, '450');
    await user.tab();

    expect(onFieldUpdate).toHaveBeenCalledWith('session.weight', 450);
  });

  it('shows the dated previous measurement as reference and requires a new entry', async () => {
    const user = userEvent.setup();
    const onFieldUpdate = vi.fn();
    const animalWithWeight = { ...mockAnimal, subject: { ...mockAnimal.subject, weight: 450 } };
    const dayNoWeight = { ...mockDay, id: 'remy-2023-06-22', session: { ...mockDay.session, weight: undefined } };
    const earlier = { id: 'remy-2023-06-10', date: '2023-06-10', session: { weight: 410 } };
    render(
      <DayTab
        animal={animalWithWeight}
        day={dayNoWeight}
        mergedDay={mockMergedDay}
        animalDays={[earlier, dayNoWeight]}
        onFieldUpdate={onFieldUpdate}
      />
    );

    const weight = screen.getByLabelText(/weight measured on/i);
    expect(weight).toHaveValue(null); // never pre-filled
    expect(screen.getByText(/previous measurement: 410 g on 2023-06-10/i)).toBeInTheDocument();
    expect(screen.queryByText(/will be exported as a fallback/i)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /use 410/i })).not.toBeInTheDocument();
    expect(onFieldUpdate).not.toHaveBeenCalled();
    await user.type(weight, '412');
    await user.tab();
    expect(onFieldUpdate).toHaveBeenCalledWith('session.weight', 412);
  });

  it('falls back to the setup baseline as the suggestion when no earlier day has a weight', () => {
    const animalWithWeight = { ...mockAnimal, subject: { ...mockAnimal.subject, weight: 450 } };
    const dayNoWeight = { ...mockDay, session: { ...mockDay.session, weight: undefined } };
    render(<DayTab animal={animalWithWeight} day={dayNoWeight} mergedDay={mockMergedDay} onFieldUpdate={vi.fn()} />);
    expect(screen.getByText(/baseline at setup: 450 g/i)).toBeInTheDocument();
  });

  it('edits the DAY\u2019s team (one name per line) and writes day.experimenters', async () => {
    const user = userEvent.setup();
    const onFieldUpdate = vi.fn();
    const dayWithTeam = { ...mockDay, experimenters: { experimenter_name: ['Doe, Jane'], lab: 'L', institution: 'I' } };
    render(<DayTab animal={mockAnimal} day={dayWithTeam} mergedDay={mockMergedDay} onFieldUpdate={onFieldUpdate} />);
    const box = screen.getByLabelText(/experimenters present/i);
    expect(box).toHaveValue('Doe, Jane');
    await user.type(box, '\nRoe, Richard');
    await user.tab();
    expect(onFieldUpdate).toHaveBeenLastCalledWith('experimenters', {
      experimenter_name: ['Doe, Jane', 'Roe, Richard'],
      lab: 'L',
      institution: 'I',
    });
  });

  // The merge must never read `dataFolder`, so the exported YAML is byte-identical with and without it.
  it('keeps dataFolder off-export', () => {
    const { animal, day } = buildRealisticWorkspace();
    const withoutFolder = encodeYaml(mergeDayMetadata(animal, day));
    const withFolder = encodeYaml(mergeDayMetadata(animal, { ...day, dataFolder: '/stelmo/remy/20230622/' }));
    expect(withFolder).toBe(withoutFolder);
  });

  it('adds a keyword and updates the day keywords field', async () => {
    const user = userEvent.setup();
    const onFieldUpdate = vi.fn();

    render(
      <DayTab
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

  it('calls onFieldUpdate on blur for editable session fields', async () => {
    const user = userEvent.setup();
    const onFieldUpdate = vi.fn();

    render(
      <DayTab
        animal={mockAnimal}
        day={mockDay}
        mergedDay={mockMergedDay}
        onFieldUpdate={onFieldUpdate}
      />
    );

    const sessionDescriptionInput = screen.getByLabelText(/Session Description/i);
    await user.clear(sessionDescriptionInput);
    await user.type(sessionDescriptionInput, 'Updated description');
    await user.tab();

    await waitFor(() => {
      expect(onFieldUpdate).toHaveBeenCalledWith('session.session_description', 'Updated description');
    });
  });

  it('prefers the provided overview view-model for displayed values and inherited facts', () => {
    const overviewFields = [
      { fieldPath: 'session.session_id', label: 'Session ID', value: 'remy_VM', source: 'derived', readOnly: true, helpText: 'VM session id help' },
      { fieldPath: 'session.experiment_description', label: 'Experiment Description', value: '', source: 'default', helpText: 'VM experiment help' },
      { fieldPath: 'subject.subject_id', label: 'Subject ID', value: 'VM_SUBJECT', source: 'inherited', inheritedFrom: 'animal', readOnly: true },
      { fieldPath: 'subject.species', label: 'Species', value: 'VM_SPECIES', source: 'inherited', inheritedFrom: 'animal', readOnly: true },
      { fieldPath: 'subject.sex', label: 'Sex', value: 'VM_SEX', source: 'inherited', inheritedFrom: 'animal', readOnly: true },
      { fieldPath: 'subject.genotype', label: 'Genotype', value: 'VM_GENO', source: 'inherited', inheritedFrom: 'animal', readOnly: true },
      { fieldPath: 'subject.date_of_birth', label: 'Date of Birth', value: 'VM_DOB', source: 'inherited', inheritedFrom: 'animal', readOnly: true },
      { fieldPath: 'subject.description', label: 'Subject Description', value: 'VM_DESC', source: 'inherited', inheritedFrom: 'animal', readOnly: true },
    ];
    render(
      <DayTab
        animal={mockAnimal}
        day={mockDay}
        mergedDay={mockMergedDay}
        onFieldUpdate={vi.fn()}
        overviewFields={overviewFields}
      />
    );

    expect(screen.getByDisplayValue('remy_VM')).toBeInTheDocument();
    expect(screen.getByText('VM session id help')).toBeInTheDocument();
    expect(screen.getByText('VM experiment help')).toBeInTheDocument();
    for (const v of ['VM_SUBJECT', 'VM_SPECIES', 'VM_SEX', 'VM_GENO', 'VM_DOB', 'VM_DESC']) {
      expect(screen.getByDisplayValue(v)).toBeInTheDocument();
    }
  });

  it('shows inherited subject/team facts as collapsed read-only context with an animal setup link', () => {
    render(
      <DayTab
        animal={mockAnimal}
        day={mockDay}
        mergedDay={mockMergedDay}
        onFieldUpdate={vi.fn()}
      />
    );

    expect(screen.getByText(/session identity and animal context/i)).toBeInTheDocument();
    expect(screen.getByDisplayValue('Rat')).toBeDisabled();
    expect(screen.getByDisplayValue('Long Evans')).toBeDisabled();
    expect(screen.getByDisplayValue('2023-01-01')).toBeDisabled();
    expect(screen.getByRole('link', { name: /edit animal setup/i })).toHaveAttribute(
      'href',
      '#/animal/remy/days?field=subject.species'
    );
  });

  it('does not render controls that write animal-static subject facts from the day view', () => {
    render(
      <DayTab
        animal={mockAnimal}
        day={mockDay}
        mergedDay={mockMergedDay}
        onFieldUpdate={vi.fn()}
      />
    );

    expect(screen.queryByRole('button', { name: /inherited subject metadata/i })).not.toBeInTheDocument();
    expect(document.querySelector('[data-field-path="subject.species"]')).not.toBeInTheDocument();
    expect(document.querySelector('[data-field-path="subject.date_of_birth"]')).not.toBeInTheDocument();
    expect(document.querySelector('[data-field-path="subject.description"]')).not.toBeInTheDocument();
  });

  it('shows an inline error when experiment description is cleared (validated at the merged path)', async () => {
    const user = userEvent.setup();
    render(
      <DayTab
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
});
