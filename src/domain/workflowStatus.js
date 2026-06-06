/**
 * @fileoverview User-facing setup/readiness workflow status.
 *
 * Phase 8.6 Task 1. Turns the workspace model into the workflow the scientist follows —
 * animal setup first, recording-day metadata second, day-specific failed channels, hardware
 * changes by day range, export confidence last — so the UI can render and route from a single
 * source of truth instead of each page re-deciding "is this ready?".
 *
 * Binding rule: this module is a PURE function of the EXISTING validation outputs
 * (`computeStepStatus` / `validateDay` in `./validation`) plus the shape-safe raw-state reads
 * in `../state/workspaceSelectors`. It NEVER re-implements validation or recomputes a parallel
 * ready/blocked. In particular `readyForExportPreflight` derives from
 * `isExportEnabled(computeStepStatus(...))` — the SAME gate the Export button consults (which
 * folds in the prerequisite-step statuses, not just the `export` status) — so a second
 * readiness computation can't drift from the export gate.
 *
 * Setup-state categories (missing cameras/data-acq, …) are INFORMATIONAL. They never gate
 * export: cameras/data-acq can be legitimately absent. The export gate is unchanged.
 */

import { computeStepStatus } from './validation';
import { isExportEnabled } from './stepGate';
import {
  getAnimalElectrodeGroups,
  getAnimalCameras,
  getDataAcqDevices,
  getAnimalSubject,
  getAnimalDayIds,
  getConfigHistory,
  getProbeElectrodeGroups,
} from '../state/workspaceSelectors';

/**
 * The four checklist-item states from the workflow design.
 * @type {Record<string, 'not_started'|'needs_review'|'has_errors'|'complete'>}
 */
export const SETUP_STATE = {
  NOT_STARTED: 'not_started',
  NEEDS_REVIEW: 'needs_review',
  HAS_ERRORS: 'has_errors',
  COMPLETE: 'complete',
};

/**
 * The latest configuration snapshot's electrode groups (the export source of truth).
 * @param {object} animal
 * @returns {Array}
 */
function latestSnapshotElectrodeGroups(animal) {
  const history = getConfigHistory(animal);
  const latest = history.length > 0 ? history[history.length - 1] : null;
  return getProbeElectrodeGroups(latest?.devices);
}

/**
 * Whether the animal has electrode/probe geometry loaded for editing. Reads `animal.devices` —
 * the SAME source the Animal Editor renders and edits — so a "Review Electrodes" action always
 * lands on a populated editor. Under model B, `animal.devices` mirrors the latest configuration
 * snapshot, so in normal use this also matches what the export resolves.
 *
 * @param {object} animal
 * @returns {boolean}
 */
export function animalHasElectrodes(animal) {
  return getAnimalElectrodeGroups(animal).length > 0;
}

/**
 * The mirror-divergence case (recovered/imported data, or a corrupted blob): the latest
 * configuration snapshot HAS electrode geometry (so the export encodes electrodes) but
 * `animal.devices` is empty (so the Animal Editor would render a blank "add your first group"
 * state). This is NOT "not set up" — the electrodes exist; the editable mirror is stale.
 * Treated as a repair/sync state so the user re-loads the saved configuration instead of
 * (dangerously) adding a fresh group that would OVERWRITE the snapshot via the devices→snapshot
 * mirror in `applyAnimalUpdates`.
 *
 * @param {object} animal
 * @returns {boolean}
 */
export function animalElectrodeSetupNeedsSync(animal) {
  return getAnimalElectrodeGroups(animal).length === 0 && latestSnapshotElectrodeGroups(animal).length > 0;
}

/**
 * Which setup-checklist item an issue belongs to (for the per-item `has_errors` state). This
 * is presentation grouping for the checklist only — repair routing stays owned by
 * `repairTargetForIssue`. Returns null for issues that don't map to a setup item.
 *
 * @param {{code?: string, path?: string, instancePath?: string, field?: string}} issue
 * @returns {'subject'|'electrodes'|'cameras'|'data_acq'|null}
 */
function setupAreaForIssue(issue) {
  const code = issue?.code;
  // Raw-shape issues carry `field`/`focusPath` rather than a schema `path`, so fold them in
  // (e.g. a corrupt `cameras` collection → the Cameras setup item).
  const path = (
    issue?.path ||
    issue?.instancePath ||
    issue?.focusPath ||
    issue?.field ||
    ''
  ).toLowerCase();

  if (code === 'invalid_species' || code === 'subject_id_slash' || code === 'session_id_slash') {
    return 'subject';
  }
  if (path.includes('subject')) return 'subject';
  if (code === 'divergent_data_acq_identity' || path.includes('data_acq')) return 'data_acq';
  if (code === 'duplicate_camera_id' || code === 'divergent_camera_identity' || path.includes('camera')) {
    return 'cameras';
  }
  if (
    path.includes('electrode') ||
    path.includes('ntrode') ||
    path.includes('channel') ||
    (code || '').includes('channel') ||
    (code || '').includes('electrode') ||
    (code || '').includes('probe') ||
    (code || '').includes('device_type') ||
    code === 'empty_location' ||
    code === 'empty_targeted_location' ||
    code === 'inconsistent_location_case' ||
    code === 'unknown_device_type'
  ) {
    return 'electrodes';
  }
  return null;
}

/**
 * Build the action `{ label, fieldHint }` for a setup item. `fieldHint` is a field-path
 * keyword the existing `animalEditorStepForFieldPath` understands, so the rendering surface can
 * deep-link to the owning Animal Editor step without the domain layer knowing route strings.
 *
 * @param {string} key - Setup item key.
 * @param {boolean} present - Whether the item has content.
 * @returns {{ label: string, fieldHint: (string|null) }}
 */
function actionForItem(key, present) {
  switch (key) {
    case 'electrodes':
      return { label: present ? 'Review Electrodes' : 'Set Up Electrodes', fieldHint: 'electrode_groups' };
    case 'cameras':
      return { label: present ? 'Review Cameras' : 'Set Up Cameras', fieldHint: 'cameras' };
    case 'data_acq':
      return { label: present ? 'Review Data Acquisition' : 'Set Up Data Acquisition', fieldHint: 'data_acq_device' };
    case 'subject':
      return { label: present ? 'Review Subject' : 'Add Subject', fieldHint: null };
    case 'days':
      return { label: present ? 'View Recording Days' : 'Add Recording Days', fieldHint: null };
    default:
      return { label: 'Review', fieldHint: null };
  }
}

/**
 * The animal setup checklist: Subject, Electrodes/Probes, Cameras/Calibration, Data
 * Acquisition, Recording Days — in workflow order, each with a state and a next action worded
 * in workflow terms.
 *
 * State rules (presence-based, upgraded by supplied issues):
 *  - absent → `not_started` (missing cameras/data-acq are informational, never blocking);
 *  - present hardware (electrodes/cameras/data-acq) → `needs_review` (recovered/imported setup
 *    must be reviewed, never silently trusted) — surfaces the `Review …` action;
 *  - present subject/days → `complete`;
 *  - a supplied error-severity issue mapped to the item → `has_errors` (overrides the above).
 *
 * @param {object} animal - The animal record.
 * @param {{ issues?: Array }} [options] - Optional validation issues (already computed by the
 *   caller via `validateDay`) used only to upgrade items to `has_errors`. The checklist never
 *   computes validation itself.
 * @returns {Array<{ key: string, label: string, state: string, count: number, present: boolean, action: { label: string, fieldHint: (string|null) } }>}
 */
export function getAnimalSetupChecklist(animal, { issues = [] } = {}) {
  const subject = getAnimalSubject(animal);
  const electrodeCount = getAnimalElectrodeGroups(animal).length;
  const electrodesPresent = electrodeCount > 0;
  const electrodesNeedSync = animalElectrodeSetupNeedsSync(animal);
  const cameras = getAnimalCameras(animal);
  const dataAcq = getDataAcqDevices(animal);
  const dayIds = getAnimalDayIds(animal);

  // Which items carry an error-severity issue (per-item has_errors).
  const errorAreas = new Set(
    (Array.isArray(issues) ? issues : [])
      .filter((i) => i?.severity === 'error')
      .map(setupAreaForIssue)
      .filter(Boolean)
  );

  const subjectPresent = Boolean(subject.subject_id);
  const camerasPresent = cameras.length > 0;
  const dataAcqPresent = dataAcq.length > 0;
  const daysPresent = dayIds.length > 0;

  /**
   * @param {string} key
   * @param {string} label
   * @param {boolean} present
   * @param {string} presentState - The state to use when present and error-free.
   * @param {number} count
   * @param {string} summary
   * @returns {object} The checklist item.
   */
  const item = (key, label, present, presentState, count, summary) => {
    let state;
    if (errorAreas.has(key)) state = SETUP_STATE.HAS_ERRORS;
    else if (!present) state = SETUP_STATE.NOT_STARTED;
    else state = presentState;
    return { key, label, state, count, present, summary, action: actionForItem(key, present) };
  };

  // Electrodes are special: a mirror divergence (geometry only in the snapshot) is a
  // repair/sync state, NOT "not started" — the electrodes exist; the editable mirror is stale.
  const snapshotElectrodeCount = latestSnapshotElectrodeGroups(animal).length;
  const electrodesItem = (() => {
    let state;
    if (errorAreas.has('electrodes') || electrodesNeedSync) state = SETUP_STATE.HAS_ERRORS;
    else if (!electrodesPresent) state = SETUP_STATE.NOT_STARTED;
    else state = SETUP_STATE.NEEDS_REVIEW;
    const action = electrodesNeedSync
      ? { label: 'Repair electrode setup', fieldHint: 'electrode_groups' }
      : actionForItem('electrodes', electrodesPresent);
    const summary = electrodesNeedSync
      ? `${snapshotElectrodeCount} in saved configuration (not loaded for editing)`
      : electrodesPresent
        ? `${electrodeCount} electrode group${electrodeCount === 1 ? '' : 's'}`
        : 'Not set up';
    return {
      key: 'electrodes',
      label: 'Electrodes / probes',
      state,
      count: electrodesPresent ? electrodeCount : snapshotElectrodeCount,
      present: electrodesPresent,
      needsSync: electrodesNeedSync,
      summary,
      action,
    };
  })();

  return [
    item('subject', 'Subject', subjectPresent, SETUP_STATE.COMPLETE, subjectPresent ? 1 : 0,
      subjectPresent ? subject.subject_id : 'Not set'),
    electrodesItem,
    item('cameras', 'Cameras / calibration', camerasPresent, SETUP_STATE.NEEDS_REVIEW, cameras.length,
      camerasPresent ? `${cameras.length} camera${cameras.length === 1 ? '' : 's'}` : 'None'),
    item('data_acq', 'Data acquisition', dataAcqPresent, SETUP_STATE.NEEDS_REVIEW, dataAcq.length,
      dataAcqPresent ? `${dataAcq.length} device${dataAcq.length === 1 ? '' : 's'}` : 'None'),
    item('days', 'Recording days', daysPresent, SETUP_STATE.COMPLETE, dayIds.length,
      daysPresent ? `${dayIds.length} day${dayIds.length === 1 ? '' : 's'}` : 'None'),
  ];
}

/**
 * The day's workflow/readiness status. The configuration version + historical flag come from
 * the day's pin vs. the latest snapshot; readiness comes straight from the SAME export gate
 * the Export button enforces (`isExportEnabled(computeStepStatus(...))`, which folds in the
 * prerequisite-step statuses, not just the `export` status), so it can't drift from the UI.
 *
 * `usesUnpinnedConfiguration` flags the existing-data review risk Phase 8.6 calls out: a day
 * with no pinned `configurationVersion` in a multi-version animal is silently resolved to the
 * latest snapshot by `resolveDayConfig`, which can export the wrong geometry for a recovered
 * day that actually recorded an earlier configuration. (A single-version animal is
 * unambiguous, so it is not flagged.)
 *
 * @param {object} animal - The owning animal.
 * @param {object} day - The recording day.
 * @param {object|null} mergedDay - `mergeDayMetadata(animal, day)`, or null when it could not
 *   be resolved (corrupt/missing configuration) — treated as blocked, not ready.
 * @returns {{
 *   configurationVersion: (number|null),
 *   latestConfigurationVersion: (number|null),
 *   isHistoricalConfiguration: boolean,
 *   usesUnpinnedConfiguration: boolean,
 *   hasElectrodes: boolean,
 *   readyForFailedChannels: boolean,
 *   exportStatus: string,
 *   blockedByRepair: boolean,
 *   readyForExportPreflight: boolean
 * }}
 */
export function getDayWorkflowStatus(animal, day, mergedDay) {
  const history = getConfigHistory(animal);
  const latest = history.length > 0 ? history[history.length - 1] : null;
  const latestConfigurationVersion = latest && latest.version != null ? latest.version : null;
  const isPinned = day?.configurationVersion != null;
  const configurationVersion = isPinned ? day.configurationVersion : latestConfigurationVersion;
  const isHistoricalConfiguration =
    configurationVersion != null &&
    latestConfigurationVersion != null &&
    configurationVersion !== latestConfigurationVersion;
  // A missing pin only ambiguous when more than one version exists.
  const usesUnpinnedConfiguration = !isPinned && history.length > 1;

  const hasElectrodes =
    Boolean(mergedDay) &&
    Array.isArray(mergedDay.electrode_groups) &&
    mergedDay.electrode_groups.length > 0;

  // Readiness is the SAME gate the Export button uses (isExportEnabled folds in the
  // prerequisite-step statuses, not just `export`), so the helper can't say "ready" while the
  // Export button is disabled. Without a merged model the day could not be resolved
  // (corrupt/missing configuration) → blocked.
  const stepStatus = mergedDay ? computeStepStatus(day, mergedDay, animal) : null;
  const exportStatus = stepStatus ? stepStatus.export : 'error';
  const ready = stepStatus ? isExportEnabled(stepStatus) : false;

  return {
    configurationVersion,
    latestConfigurationVersion,
    isHistoricalConfiguration,
    usesUnpinnedConfiguration,
    hasElectrodes,
    readyForFailedChannels: hasElectrodes,
    exportStatus,
    blockedByRepair: !ready,
    readyForExportPreflight: ready,
  };
}
