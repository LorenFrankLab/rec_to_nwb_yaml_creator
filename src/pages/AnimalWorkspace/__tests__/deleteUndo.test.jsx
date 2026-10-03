/**
 * Undo-able recording-day delete (Phase 2 — epoch-editor).
 *
 * Day delete is the FREQUENT, reversible action: it deletes immediately and shows the Phase-0 UndoToast
 * whose Undo re-creates the day from the captured record (`createDay` + `updateDay`). The CATASTROPHIC
 * animal delete keeps its hard type-to-confirm dialog (AnimalView header) — undo for the reversible,
 * confirm for the catastrophic.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { StoreProvider, useStoreContext } from '../../../state/StoreContext';
import { RecordingDaysTab } from '../RecordingDaysTab';
import { AnimalView } from '../../AnimalView';
import { buildCatalogWorkspace } from '../../../__tests__/fixtures/workspaceBuilders';
import { completeOptogenetics } from '../../../__tests__/fixtures/completeOptogenetics';
import { buildExportReceipt, currentExportArtifact, exportFreshnessStatus } from '../../../domain/exportReceipt';
import { validateDay } from '../../../domain/dayValidationComposer';
import { mergeDayMetadata } from '../../../state/workspaceUtils';

let captured = null;
/** Captures the shared store so a test can read what an action wrote. */
function StoreProbe() {
  captured = useStoreContext();
  return null;
}

const originalHash = window.location.hash;

const animal = {
  id: 'remy',
  subject: { subject_id: 'remy', species: 'Rattus norvegicus', sex: 'M' },
  devices: { electrode_groups: [], ntrode_electrode_group_channel_map: [], data_acq_device: [] },
  cameras: [],
  configurationHistory: [
    { version: 1, date: '2024-01-02', description: 'Initial', devices: { electrode_groups: [] }, appliedToDays: [] },
  ],
  days: ['remy-2023-06-22', 'remy-2023-06-23'],
};
const days = {
  'remy-2023-06-22': {
    id: 'remy-2023-06-22',
    animalId: 'remy',
    date: '2023-06-22',
    session: { session_id: 'remy_20230622', session_description: 'W-track' },
    tasks: [{ task_name: 'W-track', task_epochs: [1] }],
    keywords: ['hpc'],
    configurationVersion: 1,
    state: { draft: false, validated: true, exported: true },
  },
  'remy-2023-06-23': {
    id: 'remy-2023-06-23',
    animalId: 'remy',
    date: '2023-06-23',
    session: { session_id: 'remy_20230623' },
    state: { draft: true },
  },
};

/** Render the recording-days pane + a live-store probe for the two-day remy fixture. */
function renderPane() {
  captured = null;
  render(
    <StoreProvider initialState={{ workspace: { animals: { remy: structuredClone(animal) }, days: structuredClone(days), settings: {} } }}>
      <StoreProbe />
      <RecordingDaysTab animalId="remy" />
    </StoreProvider>
  );
}

describe('RecordingDaysTab — undo-able day delete', () => {
  beforeEach(() => {
    window.location.hash = originalHash;
  });

  it('row delete removes the day and Undo restores its record (id, tasks, state)', async () => {
    const user = userEvent.setup();
    renderPane();

    await user.click(screen.getByRole('button', { name: /actions for 2023-06-22/i }));
    await user.click(screen.getByRole('menuitem', { name: /delete day/i }));

    expect(captured.model.workspace.days['remy-2023-06-22']).toBeUndefined();
    expect(captured.model.workspace.animals.remy.days).not.toContain('remy-2023-06-22');

    // Undo re-creates the day with its day-owned content intact.
    await user.click(within(screen.getByRole('status')).getByRole('button', { name: /undo/i }));

    const restored = captured.model.workspace.days['remy-2023-06-22'];
    expect(restored).toBeDefined();
    expect(restored.tasks).toEqual([{ task_name: 'W-track', task_epochs: [1] }]);
    expect(restored.session.session_id).toBe('remy_20230622');
    expect(restored.state).toMatchObject({ validated: true, exported: true });
    expect(captured.model.workspace.animals.remy.days).toContain('remy-2023-06-22');
  });

  it('bulk delete removes every selected day and Undo restores all of them', async () => {
    const user = userEvent.setup();
    renderPane();

    await user.click(screen.getByRole('checkbox', { name: /select all recording days/i }));
    await user.click(screen.getByRole('button', { name: /^delete$/i }));

    expect(captured.model.workspace.days['remy-2023-06-22']).toBeUndefined();
    expect(captured.model.workspace.days['remy-2023-06-23']).toBeUndefined();

    await user.click(within(screen.getByRole('status')).getByRole('button', { name: /undo/i }));

    expect(captured.model.workspace.days['remy-2023-06-22']).toBeDefined();
    expect(captured.model.workspace.days['remy-2023-06-23']).toBeDefined();
  });
});

/**
 * An imported day whose own facts differ from the animal's defaults: its own team and optogenetics,
 * a blocking review flag, a scientist-confirmed setup choice, a data folder, a download receipt that
 * is out of date, and a field the day record does not have yet (a later addition must not fall out
 * of Undo either).
 *
 * @returns {{ workspace: object, dayId: string }}
 */
function importedDayWorkspace() {
  const { animal, day } = buildCatalogWorkspace();
  // The setup's recorded effective date is AFTER the recording: only the explicit confirmation on
  // the day makes its configuration choice settled.
  animal.configurationHistory[0].date = '2023-07-01';
  const ownDay = {
    ...day,
    experimenters: { experimenter_name: ['Doe, Jane'], lab: 'Frank', institution: 'UCSF' },
    optogenetics: completeOptogenetics(),
    dataFolder: '/stelmo/remy/20230622/',
    provenance: {
      origin: 'import',
      enteredAt: '2023-06-23T09:00:00.000Z',
      copiedFromDayId: null,
      copiedFromDate: null,
      configuration: { source: 'explicit', confirmed: true },
      fields: { experimenters: 'import', optogenetics: 'import' },
      review: ['weight_from_baseline'],
    },
    state: { ...day.state, badChannelRemovalAcks: { 3: [2] } },
    futureDayField: { kept: true },
  };
  const artifact = currentExportArtifact(animal, ownDay);
  // Downloaded, then edited: the receipt no longer matches the day's export.
  ownDay.exportReceipt = buildExportReceipt({
    filename: artifact.filename,
    yaml: `${artifact.yaml}# an earlier edit\n`,
    now: '2023-06-23T10:00:00.000Z',
    schemaVersion: 5,
    yamlStored: false,
    dayLastModified: '2023-06-23T10:00:00.000Z',
    animalLastModified: animal.lastModified,
  });
  return {
    workspace: { animals: { remy: { ...animal, days: [day.id] } }, days: { [day.id]: ownDay }, settings: {} },
    dayId: day.id,
  };
}

/**
 * The codes of a day's validation issues.
 *
 * @param {object} animal
 * @param {object} day
 * @returns {string[]}
 */
const issueCodes = (animal, day) => validateDay(day, mergeDayMetadata(animal, day), animal).map((i) => i.code).sort();

describe('RecordingDaysTab — Undo restores the deleted day in full', () => {
  beforeEach(() => {
    window.location.hash = originalHash;
  });

  it('delete → Undo exports the same file, keeps every day field, review flag and receipt', async () => {
    const user = userEvent.setup();
    const { workspace, dayId } = importedDayWorkspace();
    captured = null;
    render(
      <StoreProvider initialState={{ workspace }}>
        <StoreProbe />
        <RecordingDaysTab animalId="remy" />
      </StoreProvider>
    );

    const before = structuredClone(captured.model.workspace.days[dayId]);
    const animalBefore = captured.model.workspace.animals.remy;
    const indexBefore = [...animalBefore.days];
    const exportBefore = currentExportArtifact(animalBefore, before);
    // Preconditions: the day exports its OWN team, and its review flag blocks export.
    expect(mergeDayMetadata(animalBefore, before).experimenter_name).toEqual(['Doe, Jane']);
    expect(issueCodes(animalBefore, before)).toContain('weight_from_baseline');
    expect(exportFreshnessStatus(animalBefore, before)).toBe('changed');

    await user.click(screen.getByRole('button', { name: /actions for 2023-06-22/i }));
    await user.click(screen.getByRole('menuitem', { name: /delete day/i }));
    expect(captured.model.workspace.days[dayId]).toBeUndefined();
    await user.click(within(screen.getByRole('status')).getByRole('button', { name: /undo/i }));

    const after = captured.model.workspace.days[dayId];
    const animalAfter = captured.model.workspace.animals.remy;
    // The same download: filename and bytes (team, optogenetics, everything the day exports).
    expect(currentExportArtifact(animalAfter, after)).toEqual(exportBefore);
    // The same readiness: the review flag still blocks, the confirmed setup choice is still settled.
    expect(issueCodes(animalAfter, after)).toEqual(issueCodes(animalBefore, before));
    // Still "changed since download" — never re-stamped as current.
    expect(exportFreshnessStatus(animalAfter, after)).toBe('changed');
    // The whole record, field for field (including fields Undo has never heard of).
    expect(after).toEqual(before);
    expect(animalAfter.days).toEqual(indexBefore);
  });
});

describe('AnimalView — delete-animal keeps the hard confirm', () => {
  it('routes animal delete through the type-to-confirm alertdialog (not an undo toast)', async () => {
    const user = userEvent.setup();
    window.location.hash = originalHash;
    render(
      <StoreProvider initialState={{ workspace: { animals: { remy: structuredClone(animal) }, days: structuredClone(days), settings: {} } }}>
        <AnimalView animalId="remy" tab="days" />
      </StoreProvider>
    );

    await user.click(screen.getByRole('button', { name: /actions for remy/i }));
    await user.click(screen.getByRole('menuitem', { name: /delete animal/i }));

    // A destructive, deliberate confirm — NOT an undo toast.
    expect(screen.getByRole('alertdialog')).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: /type .* to confirm/i })).toBeInTheDocument();
  });
});
