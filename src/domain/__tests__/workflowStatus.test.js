/**
 * Workflow/readiness domain helper (Phase 8.6 Task 1). Derives the user-facing setup
 * checklist and day readiness purely from existing validation outputs
 * (`computeStepStatus` / `validateDay`) and the shape-safe `workspaceSelectors` reads — it
 * never re-implements validation or recomputes a parallel ready/blocked. `getDayWorkflowStatus`
 * MUST derive `readyForExportPreflight` from `computeStepStatus(...).export === 'valid'`.
 */
import { describe, it, expect } from 'vitest';
import {
  SETUP_STATE,
  getAnimalSetupChecklist,
  getDayWorkflowStatus,
} from '../workflowStatus';
import { buildRealisticWorkspace } from '../../__tests__/fixtures/workspaceBuilders';
import { mergeDayMetadata } from '../../state/workspaceUtils';
import { computeStepStatus } from '../validation';

/**
 * A minimal freshly-created animal: a subject, an empty initial config snapshot, no days.
 * @returns {object} The animal record.
 */
function newAnimal() {
  return {
    id: 'newbie',
    subject: { subject_id: 'newbie', species: 'Rattus norvegicus', sex: 'M', date_of_birth: '2024-01-01T00:00:00' },
    devices: { electrode_groups: [], ntrode_electrode_group_channel_map: [], data_acq_device: [], device: { name: [] } },
    cameras: [],
    experimenters: { experimenter_name: [], lab: '', institution: '' },
    days: [],
    configurationHistory: [{ version: 1, date: '2024-01-02', description: 'Initial', devices: { electrode_groups: [], ntrode_electrode_group_channel_map: [] }, appliedToDays: [] }],
  };
}

const itemFor = (checklist, key) => checklist.find((i) => i.key === key);

describe('getAnimalSetupChecklist', () => {
  it('lists subject, electrodes, cameras, data_acq and days in workflow order', () => {
    const checklist = getAnimalSetupChecklist(newAnimal());
    expect(checklist.map((i) => i.key)).toEqual([
      'subject',
      'electrodes',
      'cameras',
      'data_acq',
      'days',
    ]);
  });

  it('marks electrodes not_started with a "Set Up Electrodes" action for a new animal', () => {
    const electrodes = itemFor(getAnimalSetupChecklist(newAnimal()), 'electrodes');
    expect(electrodes.state).toBe(SETUP_STATE.NOT_STARTED);
    expect(electrodes.action.label).toBe('Set Up Electrodes');
  });

  it('still shows electrodes not_started when an animal has days but no electrode setup', () => {
    const animal = newAnimal();
    animal.days = ['newbie-2024-01-02'];
    const checklist = getAnimalSetupChecklist(animal);
    expect(itemFor(checklist, 'electrodes').state).toBe(SETUP_STATE.NOT_STARTED);
    expect(itemFor(checklist, 'electrodes').action.label).toBe('Set Up Electrodes');
    expect(itemFor(checklist, 'days').state).not.toBe(SETUP_STATE.NOT_STARTED);
  });

  it('marks present electrode setup needs_review with a "Review Electrodes" action', () => {
    const { animal } = buildRealisticWorkspace();
    const electrodes = itemFor(getAnimalSetupChecklist(animal), 'electrodes');
    expect(electrodes.state).toBe(SETUP_STATE.NEEDS_REVIEW);
    expect(electrodes.action.label).toBe('Review Electrodes');
  });

  it('detects electrodes present from the latest configuration snapshot, not only animal.devices', () => {
    // The realistic fixture keeps animal.devices.electrode_groups empty but the latest
    // snapshot carries the geometry the export resolves — "has electrodes" must read that.
    const { animal } = buildRealisticWorkspace();
    expect(animal.devices.electrode_groups).toEqual([]);
    expect(itemFor(getAnimalSetupChecklist(animal), 'electrodes').state).toBe(
      SETUP_STATE.NEEDS_REVIEW
    );
  });

  it('shows cameras needs_review when present and not_started when absent', () => {
    const { animal } = buildRealisticWorkspace();
    expect(itemFor(getAnimalSetupChecklist(animal), 'cameras').state).toBe(SETUP_STATE.NEEDS_REVIEW);
    expect(itemFor(getAnimalSetupChecklist(animal), 'cameras').action.label).toBe('Review Cameras');
    expect(itemFor(getAnimalSetupChecklist(newAnimal()), 'cameras').state).toBe(
      SETUP_STATE.NOT_STARTED
    );
  });

  it('upgrades an item to has_errors when a matching animal_setup issue is supplied', () => {
    const { animal } = buildRealisticWorkspace();
    const issues = [
      { code: 'empty_location', severity: 'error', message: 'x', path: 'electrode_groups[0].location' },
    ];
    const electrodes = itemFor(getAnimalSetupChecklist(animal, { issues }), 'electrodes');
    expect(electrodes.state).toBe(SETUP_STATE.HAS_ERRORS);
  });

  it('maps subject and data-acq issues to their own checklist items (not just electrodes)', () => {
    const { animal } = buildRealisticWorkspace();
    const subjectChecklist = getAnimalSetupChecklist(animal, {
      issues: [{ code: 'invalid_species', severity: 'error', message: 'bad species' }],
    });
    expect(itemFor(subjectChecklist, 'subject').state).toBe(SETUP_STATE.HAS_ERRORS);

    const dataAcqChecklist = getAnimalSetupChecklist(animal, {
      issues: [{ code: 'divergent_data_acq_identity', severity: 'error', message: 'diverges' }],
    });
    expect(itemFor(dataAcqChecklist, 'data_acq').state).toBe(SETUP_STATE.HAS_ERRORS);

    // A corrupt cameras collection (raw-shape issue: field, no schema path) maps to cameras.
    const cameraChecklist = getAnimalSetupChecklist(animal, {
      issues: [{ code: 'malformed_animal_collection', severity: 'error', field: 'cameras', message: 'corrupt' }],
    });
    expect(itemFor(cameraChecklist, 'cameras').state).toBe(SETUP_STATE.HAS_ERRORS);
  });

  it('does not let an informational missing camera/data-acq block — they stay not_started, never has_errors without an issue', () => {
    const checklist = getAnimalSetupChecklist(newAnimal());
    expect(itemFor(checklist, 'cameras').state).toBe(SETUP_STATE.NOT_STARTED);
    expect(itemFor(checklist, 'data_acq').state).toBe(SETUP_STATE.NOT_STARTED);
  });
});

describe('getDayWorkflowStatus', () => {
  it('derives readiness from computeStepStatus(...).export for a clean realistic day', () => {
    const { animal, day } = buildRealisticWorkspace();
    const merged = mergeDayMetadata(animal, day);
    const status = getDayWorkflowStatus(animal, day, merged);

    // The single source of truth: it must equal the export gate, not a re-derivation.
    const exportStatus = computeStepStatus(day, merged, animal).export;
    expect(status.readyForExportPreflight).toBe(exportStatus === 'valid');
    expect(status.exportStatus).toBe(exportStatus);
    expect(status.blockedByRepair).toBe(exportStatus !== 'valid');
  });

  it('reports the resolved configuration version and that the latest day is not historical', () => {
    const { animal, day } = buildRealisticWorkspace();
    const merged = mergeDayMetadata(animal, day);
    const status = getDayWorkflowStatus(animal, day, merged);
    expect(status.configurationVersion).toBe(1);
    expect(status.latestConfigurationVersion).toBe(1);
    expect(status.isHistoricalConfiguration).toBe(false);
  });

  it('flags a day pinned to an older version as historical', () => {
    const { animal, day } = buildRealisticWorkspace();
    // Add a newer snapshot; the day still pins v1.
    animal.configurationHistory.push({
      version: 2,
      date: '2023-07-01',
      description: 'Lowered tetrodes',
      devices: animal.configurationHistory[0].devices,
      appliedToDays: [],
    });
    const merged = mergeDayMetadata(animal, day);
    const status = getDayWorkflowStatus(animal, day, merged);
    expect(status.configurationVersion).toBe(1);
    expect(status.latestConfigurationVersion).toBe(2);
    expect(status.isHistoricalConfiguration).toBe(true);
  });

  it('reports electrodes present and ready_for_failed_channels for a configured day', () => {
    const { animal, day } = buildRealisticWorkspace();
    const merged = mergeDayMetadata(animal, day);
    const status = getDayWorkflowStatus(animal, day, merged);
    expect(status.hasElectrodes).toBe(true);
    expect(status.readyForFailedChannels).toBe(true);
  });

  it('treats a day with no merged metadata as blocked and not ready (no electrodes)', () => {
    const { animal, day } = buildRealisticWorkspace();
    const status = getDayWorkflowStatus(animal, day, null);
    expect(status.hasElectrodes).toBe(false);
    expect(status.readyForFailedChannels).toBe(false);
    expect(status.readyForExportPreflight).toBe(false);
    expect(status.blockedByRepair).toBe(true);
  });

  it('reports blocked through the REAL export gate for a non-null but invalid merged day', () => {
    const { animal, day } = buildRealisticWorkspace();
    const merged = mergeDayMetadata(animal, day);
    // Make the merged model invalid in a way computeStepStatus will flag (blank session).
    merged.session_id = '';
    merged.session_description = '';
    const exportStatus = computeStepStatus(day, merged, animal).export;
    expect(exportStatus).not.toBe('valid'); // sanity: the gate really blocks
    const status = getDayWorkflowStatus(animal, day, merged);
    expect(status.exportStatus).toBe(exportStatus);
    expect(status.readyForExportPreflight).toBe(false);
    expect(status.blockedByRepair).toBe(true);
  });

  it('does not flag a day as historical when the animal has no configuration history', () => {
    const { animal, day } = buildRealisticWorkspace();
    animal.configurationHistory = [];
    // mergeDayMetadata throws with no history, so callers pass null; the status must still be
    // computed and must NOT falsely mark the day historical (latest version is unknown).
    const status = getDayWorkflowStatus(animal, day, null);
    expect(status.latestConfigurationVersion).toBeNull();
    expect(status.isHistoricalConfiguration).toBe(false);
  });
});
