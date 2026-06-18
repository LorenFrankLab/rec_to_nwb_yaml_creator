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
    expect(screen.getByRole('heading', { name: /daily setup/i })).toBeInTheDocument();
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
    expect(screen.getByRole('heading', { name: /daily setup/i })).toBeInTheDocument();
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

  it('displays editable daily setup fields before collapsed read-only context', () => {
    render(
      <DayTab
        animal={mockAnimal}
        day={mockDay}
        mergedDay={mockMergedDay}
        onFieldUpdate={vi.fn()}
      />
    );

    expect(screen.getByLabelText(/Data folder/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Recording-day weight/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Session Description/i)).toBeRequired();
    expect(screen.getByLabelText(/Experiment Description/i)).toBeRequired();
    expect(screen.getByRole('heading', { name: /file location/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /required descriptions/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /session measurement/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /search terms/i })).toBeInTheDocument();
    expect(screen.queryByText(/start here/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/export required/i)).not.toBeInTheDocument();

    const dataFolder = screen.getByLabelText(/Data folder/i);
    const weight = screen.getByLabelText(/Recording-day weight/i);
    const sessionDescription = screen.getByLabelText(/Session Description/i);
    const experimentDescription = screen.getByLabelText(/Experiment Description/i);
    const keywords = screen.getByRole('textbox', { name: /keywords/i });
    const context = screen.getByText(/session identity and animal context/i);
    const sessionId = screen.getByDisplayValue('remy_20230622');

    expect(dataFolder.compareDocumentPosition(sessionDescription) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(sessionDescription.compareDocumentPosition(experimentDescription) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(experimentDescription.compareDocumentPosition(weight) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(weight.compareDocumentPosition(keywords) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(keywords.compareDocumentPosition(context) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(context.closest('details')).not.toHaveAttribute('open');
    expect(sessionId).not.toBeVisible();
  });

  it('writes day.dataFolder via onFieldUpdate on blur', async () => {
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

    const folder = screen.getByLabelText(/data folder/i);
    await user.type(folder, '/stelmo/remy/20230622/');
    await user.tab();

    expect(onFieldUpdate).toHaveBeenCalledWith('dataFolder', '/stelmo/remy/20230622/');
  });

  it('pre-fills the data folder from the stored day value', () => {
    render(
      <DayTab
        animal={mockAnimal}
        day={{ ...mockDay, dataFolder: '/stelmo/remy/' }}
        mergedDay={mockMergedDay}
        onFieldUpdate={vi.fn()}
      />
    );

    expect(screen.getByLabelText(/data folder/i)).toHaveValue('/stelmo/remy/');
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

    const weight = screen.getByLabelText(/recording-day weight/i);
    await user.type(weight, '450');
    await user.tab();

    expect(onFieldUpdate).toHaveBeenCalledWith('session.weight', 450);
  });

  it('identifies the animal baseline as a fallback when no day weight is set', () => {
    const animalWithWeight = { ...mockAnimal, subject: { ...mockAnimal.subject, weight: 450 } };
    const dayNoWeight = { ...mockDay, session: { ...mockDay.session, weight: undefined } };
    render(
      <DayTab
        animal={animalWithWeight}
        day={dayNoWeight}
        mergedDay={mockMergedDay}
        onFieldUpdate={vi.fn()}
      />
    );

    expect(screen.getByLabelText(/recording-day weight/i)).toHaveValue(null);
    expect(
      screen.getByText(/animal baseline \(450 g\) will be exported as a fallback/i)
    ).toBeInTheDocument();
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
      { fieldPath: 'experimenters.experimenter_name', label: 'Names', value: 'VM Names', source: 'inherited', inheritedFrom: 'animal', readOnly: true },
      { fieldPath: 'experimenters.lab', label: 'Lab', value: 'VM Lab', source: 'inherited', inheritedFrom: 'animal', readOnly: true },
      { fieldPath: 'experimenters.institution', label: 'Institution', value: 'VM Inst', source: 'inherited', inheritedFrom: 'animal', readOnly: true },
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
    for (const v of ['VM_SUBJECT', 'VM_SPECIES', 'VM_SEX', 'VM_GENO', 'VM_DOB', 'VM_DESC', 'VM Names', 'VM Lab', 'VM Inst']) {
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
