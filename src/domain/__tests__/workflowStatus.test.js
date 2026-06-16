/**
 * Workflow/readiness domain helper (Phase 8.6 Task 1). Derives the user-facing setup
 * checklist and day readiness purely from existing validation outputs
 * (`computeStepStatus` / `validateDay`) and the shape-safe `workspaceSelectors` reads — it
 * never re-implements validation or recomputes a parallel ready/blocked. `getDayWorkflowStatus`
 * MUST derive `readyForExportPreflight` from the SAME export gate the Export button uses —
 * `isExportEnabled(computeStepStatus(...))` (export status + all prerequisite steps valid).
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  SETUP_STATE,
  getAnimalSetupChecklist,
  getDayWorkflowStatus,
  getDayRowStatus,
} from '../workflowStatus';
import { buildRealisticWorkspace } from '../../__tests__/fixtures/workspaceBuilders';
import { mergeDayMetadata } from '../../state/workspaceUtils';
import { computeStepStatus } from '../validation';
// Namespace import so the step-only-blocker / throw tests can spy on computeStepStatus (the live
// binding getDayRowStatus consults), without affecting firstBlockingReason's separate validateDay.
import * as validationModule from '../validation';
import { isExportEnabled } from '../stepGate';

afterEach(() => vi.restoreAllMocks());

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
    // animal.devices mirrors the latest snapshot in production; populate it so this reflects a
    // normal configured animal (the parity fixture leaves devices empty for byte parity).
    animal.devices.electrode_groups = animal.configurationHistory[0].devices.electrode_groups;
    const electrodes = itemFor(getAnimalSetupChecklist(animal), 'electrodes');
    expect(electrodes.state).toBe(SETUP_STATE.NEEDS_REVIEW);
    expect(electrodes.action.label).toBe('Review Electrodes');
  });

  it('flags a device/snapshot mirror divergence as a repair/sync state (not "not started")', () => {
    // A recovered animal whose geometry is ONLY in the snapshot (animal.devices empty) must NOT
    // read as not_started → "Set Up Electrodes" (which would overwrite the snapshot), nor
    // needs_review → an empty editor. It is a repair/sync state: the electrodes exist, the
    // editable mirror is stale.
    const { animal } = buildRealisticWorkspace();
    expect(animal.devices.electrode_groups).toEqual([]);
    expect(animal.configurationHistory[0].devices.electrode_groups.length).toBeGreaterThan(0);
    const electrodes = itemFor(getAnimalSetupChecklist(animal), 'electrodes');
    expect(electrodes.state).toBe(SETUP_STATE.HAS_ERRORS);
    expect(electrodes.needsSync).toBe(true);
    expect(electrodes.action.label).toBe('Repair electrode setup');
  });

  it('does not flag a sync divergence for a normal animal (devices mirrors the snapshot)', () => {
    const { animal } = buildRealisticWorkspace();
    animal.devices.electrode_groups = animal.configurationHistory[0].devices.electrode_groups;
    const electrodes = itemFor(getAnimalSetupChecklist(animal), 'electrodes');
    expect(electrodes.state).toBe(SETUP_STATE.NEEDS_REVIEW);
    expect(electrodes.needsSync).toBe(false);
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

  it('uses the recovery-aware recordingDayCount for the Recording days item when supplied', () => {
    const animal = newAnimal(); // no indexed days
    // The caller supplies a recovery-aware count (e.g. recovered records not in the index).
    const days = itemFor(getAnimalSetupChecklist(animal, { recordingDayCount: 2 }), 'days');
    expect(days.count).toBe(2);
    expect(days.state).toBe(SETUP_STATE.COMPLETE);
    // Without the override it falls back to the raw index length (0 here).
    expect(itemFor(getAnimalSetupChecklist(animal), 'days').count).toBe(0);
  });

  it('does not let an informational missing camera/data-acq block — they stay not_started, never has_errors without an issue', () => {
    const checklist = getAnimalSetupChecklist(newAnimal());
    expect(itemFor(checklist, 'cameras').state).toBe(SETUP_STATE.NOT_STARTED);
    expect(itemFor(checklist, 'data_acq').state).toBe(SETUP_STATE.NOT_STARTED);
  });
});

describe('getDayWorkflowStatus', () => {
  it('derives readiness from the real export gate isExportEnabled(computeStepStatus(...))', () => {
    const { animal, day } = buildRealisticWorkspace();
    const merged = mergeDayMetadata(animal, day);
    const status = getDayWorkflowStatus(animal, day, merged);

    // The single source of truth: readiness must equal the gate the Export button uses
    // (export status + all prerequisite steps valid), not a re-derivation off `.export` alone.
    const stepStatus = computeStepStatus(day, merged, animal);
    expect(status.readyForExportPreflight).toBe(isExportEnabled(stepStatus));
    expect(status.exportStatus).toBe(stepStatus.export);
    expect(status.blockedByRepair).toBe(!isExportEnabled(stepStatus));
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

  it('flags an unpinned day in a multi-version animal as a configuration review risk', () => {
    const { animal, day } = buildRealisticWorkspace();
    animal.configurationHistory.push({
      version: 2,
      date: '2023-07-01',
      description: 'Lowered tetrodes',
      devices: animal.configurationHistory[0].devices,
      appliedToDays: [],
    });
    delete day.configurationVersion; // unpinned, but two versions exist → ambiguous
    const merged = mergeDayMetadata(animal, day);
    const status = getDayWorkflowStatus(animal, day, merged);
    expect(status.usesUnpinnedConfiguration).toBe(true);
    // …and it is export-BLOCKING (the gate folds in the unpinned validation error).
    expect(status.readyForExportPreflight).toBe(false);
    expect(status.blockedByRepair).toBe(true);
  });

  it('does not flag an unpinned day as a risk when the animal has only one configuration', () => {
    const { animal, day } = buildRealisticWorkspace();
    delete day.configurationVersion; // unpinned, single version → unambiguous
    const merged = mergeDayMetadata(animal, day);
    const status = getDayWorkflowStatus(animal, day, merged);
    expect(status.usesUnpinnedConfiguration).toBe(false);
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

/**
 * A realistic workspace made video-complete (every task epoch carries a bound video), so the day
 * reads export-ready WITHOUT relying on the off-export `videolessEpochs` declaration. The lifecycle
 * tests below replace/delete `day.state` (which is where the declaration lives), so they use this
 * variant to keep the Phase-4 video-declaration rule satisfied independent of state shape.
 */
function videoCompleteRealistic() {
  const { animal, day } = buildRealisticWorkspace();
  day.associated_video_files = [
    ...day.associated_video_files,
    { name: 'sleep_video_epoch1', camera_id: 0, task_epochs: 1 },
    { name: 'sleep_video_epoch3', camera_id: 0, task_epochs: 3 },
    { name: 'sleep_video_epoch5', camera_id: 0, task_epochs: 5 },
  ];
  return { animal, day };
}

describe('getDayRowStatus', () => {
  it('maps a live-ready, unsaved day to "Ready to export" (so the row agrees with the other surfaces)', () => {
    // The realistic fixture day passes the export gate but is not persisted-validated (state.draft).
    // It must read the live-readiness word, NOT "Draft", so Animal Days agrees with Day Validation /
    // Day Export / the Validation Summary (no "Ready to export" vs "Draft" contradiction).
    const { animal, day } = videoCompleteRealistic();
    day.state = { draft: true, validated: false, exported: false };
    const merged = mergeDayMetadata(animal, day);
    expect(getDayRowStatus(animal, day, merged)).toEqual({
      variant: 'ready',
      label: 'Ready to export',
    });
  });

  it('maps an incomplete (no errors, not export-ready) day to "Draft — incomplete"', () => {
    const { animal, day } = videoCompleteRealistic();
    day.state = { draft: true, validated: false, exported: false };
    // Drop a required Overview field → the Overview step is incomplete with NO error-severity issue,
    // so the day is neither blocked nor export-ready → it reads as a draft.
    day.session = { ...day.session, session_id: undefined };
    const merged = mergeDayMetadata(animal, day);
    const status = getDayRowStatus(animal, day, merged);
    expect(status.variant).toBe('draft');
    expect(status.label).toBe('Draft — incomplete');
  });

  it('maps a persisted-validated (not yet exported) day to "Validated" (the saved state, distinct from live "Ready to export")', () => {
    const { animal, day } = videoCompleteRealistic();
    day.state = { draft: false, validated: true, exported: false };
    const merged = mergeDayMetadata(animal, day);
    expect(getDayRowStatus(animal, day, merged)).toEqual({
      variant: 'validated',
      label: 'Validated',
    });
  });

  it('maps an exported day to "Exported"', () => {
    const { animal, day } = videoCompleteRealistic();
    day.state = { draft: false, validated: true, exported: true };
    const merged = mergeDayMetadata(animal, day);
    expect(getDayRowStatus(animal, day, merged)).toEqual({
      variant: 'exported',
      label: 'Exported',
    });
  });

  it('does NOT show "Validated"/"Exported" when a step-only blocker (no validation error) currently closes export', () => {
    // A saved-validated day with a step-only blocker that validateDay does NOT flag as an error
    // (e.g. all channels bad → Devices "error"): the live gate is closed, so the row must read the
    // honest "Needs fixing", never the stale "Validated" — the live gate wins over persisted flags.
    const { animal, day } = buildRealisticWorkspace();
    day.state = { draft: false, validated: true, exported: true };
    const merged = mergeDayMetadata(animal, day);
    // firstBlockingReason (real validateDay) sees no error; the step gate is closed by a step error.
    vi.spyOn(validationModule, 'computeStepStatus').mockReturnValue({
      overview: 'valid',
      devices: 'error',
      epochs: 'valid',
      validation: 'valid',
      export: 'error',
    });
    const status = getDayRowStatus(animal, day, merged);
    expect(status.variant).toBe('needs_fixing');
    expect(status.label).toMatch(/^Needs fixing/);
  });

  it('falls back to "Needs fixing" (not "Draft") when readiness computation throws on a non-blocked day', () => {
    const { animal, day } = buildRealisticWorkspace();
    delete day.state;
    const merged = mergeDayMetadata(animal, day);
    // firstBlockingReason validates cleanly; the step-status computation then throws → the row must
    // surface an honest "Needs fixing", never a misleading "Draft", and must not crash.
    vi.spyOn(validationModule, 'computeStepStatus').mockImplementation(() => {
      throw new Error('boom');
    });
    const status = getDayRowStatus(animal, day, merged);
    expect(status.variant).toBe('needs_fixing');
    expect(status.label).toMatch(/^Needs fixing — /);
  });

  it('treats a passing day with no state flags as ready (live readiness, unsaved)', () => {
    const { animal, day } = videoCompleteRealistic();
    delete day.state;
    const merged = mergeDayMetadata(animal, day);
    expect(getDayRowStatus(animal, day, merged).variant).toBe('ready');
  });

  it('tolerates a malformed (non-object) state, ignoring it (a passing day still reads ready)', () => {
    const { animal, day } = videoCompleteRealistic();
    day.state = 'corrupt';
    const merged = mergeDayMetadata(animal, day);
    expect(getDayRowStatus(animal, day, merged).variant).toBe('ready');
  });

  it('flags a live validation error as "Needs fixing — {reason}", overriding a stale exported flag', () => {
    // A day previously validated AND exported, but its persisted shape later went corrupt
    // (e.g. a restored non-array `tasks`). The row must read the LIVE failure, not the stale
    // stored flag — "Needs fixing" wins over Draft/Ready/Exported (the honest-row rule).
    const { animal, day } = buildRealisticWorkspace();
    day.state = { draft: false, validated: true, exported: true };
    day.tasks = 'not-an-array';
    const merged = mergeDayMetadata(animal, day);
    const status = getDayRowStatus(animal, day, merged);
    expect(status.variant).toBe('needs_fixing');
    expect(status.label).toMatch(/^Needs fixing — /);
    // The reason is the live blocking issue's own message (reused, not re-derived).
    expect(status.label.toLowerCase()).toContain('corrupt');
  });

  it('reports "Needs fixing" when the day could not be merged (null mergedDay)', () => {
    const { animal, day } = buildRealisticWorkspace();
    day.state = { validated: true };
    const status = getDayRowStatus(animal, day, null);
    expect(status.variant).toBe('needs_fixing');
    expect(status.label).toMatch(/^Needs fixing — /);
  });
});
