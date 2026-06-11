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

import { computeStepStatus, validateDay, STEP_STATUS } from './validation';
import { isExportEnabled } from './stepGate';
import { DAY_LIFECYCLE, DAY_LIFECYCLE_LABEL } from './dayLifecycle';
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
 * The four checklist-item states from the workflow design. Frozen to match the closed-enum
 * convention used elsewhere in the domain/state layers (these are informational categories, never an
 * export gate).
 * @type {Readonly<Record<string, 'not_started'|'needs_review'|'has_errors'|'complete'>>}
 */
export const SETUP_STATE = Object.freeze({
  NOT_STARTED: 'not_started',
  NEEDS_REVIEW: 'needs_review',
  HAS_ERRORS: 'has_errors',
  COMPLETE: 'complete',
});

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
 * keyword the existing `animalSetupTabForFieldPath` understands, so the rendering surface can
 * deep-link to the owning animal-setup tab without the domain layer knowing route strings.
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
 * @param {{ issues?: Array, recordingDayCount?: number }} [options] - `issues`: validation issues
 *   (already computed by the caller via `validateDay`) used only to upgrade items to `has_errors`;
 *   the checklist never computes validation itself. `recordingDayCount`: a recovery-aware count of
 *   the animal's recording-day RECORDS (indexed + recovered) from the caller's
 *   `classifyAnimalDays`; when omitted, the Recording Days item falls back to the raw `days` index
 *   length. Passing it keeps the checklist count consistent with the rest of the Workspace.
 * @returns {Array<{ key: string, label: string, state: string, count: number, present: boolean, action: { label: string, fieldHint: (string|null) } }>}
 */
export function getAnimalSetupChecklist(animal, { issues = [], recordingDayCount } = {}) {
  const subject = getAnimalSubject(animal);
  const electrodeCount = getAnimalElectrodeGroups(animal).length;
  const electrodesPresent = electrodeCount > 0;
  const electrodesNeedSync = animalElectrodeSetupNeedsSync(animal);
  const cameras = getAnimalCameras(animal);
  const dataAcq = getDataAcqDevices(animal);
  const dayCount =
    typeof recordingDayCount === 'number' ? recordingDayCount : getAnimalDayIds(animal).length;

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
  const daysPresent = dayCount > 0;

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
    item('days', 'Recording days', daysPresent, SETUP_STATE.COMPLETE, dayCount,
      daysPresent ? `${dayCount} day${dayCount === 1 ? '' : 's'}` : 'None'),
  ];
}

/**
 * The first blocking (error-severity) reason a day cannot export, in the validation layer's
 * own words — or null when the day has no blocking issue. Reuses {@link validateDay} (the SAME
 * error set the export gate's `computeStepStatus(...).export` and the animal-level
 * `collectAnimalSetupIssues` consume); it does NOT re-derive validation. A null `mergedDay`
 * (the merge threw on a corrupt/missing configuration) is itself a blocking reason.
 *
 * @param {object} animal - The owning animal.
 * @param {object} day - The recording day record.
 * @param {object|null} mergedDay - `mergeDayMetadata(animal, day)`, or null if it threw.
 * @param {Array} [animalDays] - The animal's day records; enables the bad-channel monotonicity
 *   export-block (a day that silently un-fails an earlier same-config bad channel reads as
 *   "Needs fixing"). Omitted → no cross-day comparison (back-compat).
 * @returns {string|null} The blocking reason, or null when nothing blocks export.
 */
function firstBlockingReason(animal, day, mergedDay, animalDays = []) {
  if (!mergedDay) return 'recording day configuration could not be loaded';
  let issues;
  try {
    issues = validateDay(day, mergedDay, animal, animalDays);
  } catch (err) {
    // Validation itself failed on this record — treat as blocking rather than silently clean.
    // eslint-disable-next-line no-console
    console.debug(`[workflow-status] could not validate day "${day?.id}":`, err);
    return 'recording day could not be validated';
  }
  const firstError = issues.find((i) => i?.severity === 'error');
  return firstError ? firstError.message || 'see the validation summary' : null;
}

/**
 * The plain-language status for a recording-day LIST row (decision 12 — the row is triage, not
 * inspection). One of five mutually-exclusive states, worded from the shared {@link DAY_LIFECYCLE}
 * vocabulary so the row never contradicts the other surfaces:
 *   - `needs_fixing` — the day has a LIVE blocking issue (overrides every stored flag, so a day
 *     validated/exported before a referenced camera broke reads the honest current state, not a
 *     stale "Exported"). The reason is the blocking issue's own message.
 *   - `exported` / `validated` — the persisted history (checked before live readiness so a saved
 *     day shows the saved fact): `state.exported → Exported`, `state.validated → Validated`. The
 *     persisted `state.validated` reads as "Validated" (the saved fact), NOT "Ready to export".
 *   - `ready` — no persisted flag, but the day passes the SAME export gate right now
 *     (`isExportEnabled(computeStepStatus(...))`) → "Ready to export". This is the live-readiness
 *     state, and it MUST be surfaced here so the row agrees with Day Validation / Day Export / the
 *     Validation Summary instead of flatly reading "Draft" for an already-passing (but unsaved)
 *     day — the exact "Ready to export" vs "Draft" contradiction this phase removes.
 *   - `draft` — no persisted flag and not export-ready: the day is still incomplete → "Draft —
 *     incomplete".
 *
 * Read-only over the existing validation + step gate; it does not re-implement validation (it reuses
 * `validateDay`/`computeStepStatus`) and never mutates. A null `mergedDay` is already `needs_fixing`
 * via {@link firstBlockingReason}; a malformed (non-object) `state` reads as not-persisted.
 *
 * @param {object} animal - The owning animal.
 * @param {object} day - The recording day record.
 * @param {object|null} mergedDay - `mergeDayMetadata(animal, day)`, or null if it threw.
 * @param {Array} [animalDays] - The animal's day records; forwarded to the export gate so the
 *   bad-channel monotonicity block surfaces as a "Needs fixing" row (and folds into live readiness).
 *   Omitted → back-compat.
 * @returns {{ variant: 'needs_fixing'|'exported'|'validated'|'ready'|'draft', label: string }}
 */
export function getDayRowStatus(animal, day, mergedDay, animalDays = []) {
  const reason = firstBlockingReason(animal, day, mergedDay, animalDays);
  if (reason) {
    return { variant: DAY_LIFECYCLE.NEEDS_FIXING, label: `${DAY_LIFECYCLE_LABEL.needs_fixing} — ${reason}` };
  }
  const state =
    day?.state && typeof day.state === 'object' && !Array.isArray(day.state) ? day.state : {};
  if (state.exported) return { variant: DAY_LIFECYCLE.EXPORTED, label: DAY_LIFECYCLE_LABEL.exported };
  if (state.validated) return { variant: DAY_LIFECYCLE.VALIDATED, label: DAY_LIFECYCLE_LABEL.validated };
  // No persisted flag and no blocking issue. Distinguish a day that passes the SAME export gate the
  // Export button enforces ("Ready to export") from one still being filled in ("Draft — incomplete"),
  // so the list row agrees with the other surfaces. `firstBlockingReason` already returned non-null
  // for a null/unvalidatable merge, so reaching here means the merge is usable; guard the step-status
  // computation anyway and fall back to draft (never crash the row).
  let liveReady = false;
  if (mergedDay) {
    try {
      liveReady = isExportEnabled(computeStepStatus(day, mergedDay, animal, animalDays));
    } catch (err) {
      // eslint-disable-next-line no-console
      console.debug(`[workflow-status] could not compute readiness for day "${day?.id}":`, err);
    }
  }
  if (liveReady) return { variant: DAY_LIFECYCLE.READY, label: DAY_LIFECYCLE_LABEL.ready };
  return { variant: DAY_LIFECYCLE.DRAFT, label: `${DAY_LIFECYCLE_LABEL.draft} — incomplete` };
}

/**
 * The day's workflow/readiness status. The configuration version + historical flag come from
 * the day's pin vs. the latest snapshot; readiness comes straight from the SAME export gate
 * the Export button enforces (`isExportEnabled(computeStepStatus(...))`, which folds in the
 * prerequisite-step statuses, not just the `export` status), so it can't drift from the UI.
 *
 * `usesUnpinnedConfiguration` flags the existing-data review case Phase 8.6 calls out: a day with
 * no pinned `configurationVersion` in a multi-version animal would be resolved to the latest
 * snapshot by `resolveDayConfig` — the wrong geometry for a recovered day that actually recorded an
 * earlier configuration. As of Phase 8.6 that case is export-BLOCKED by the dedicated
 * `unpinned_configuration` validation rule (see {@link module:domain/validation}); this flag no
 * longer guards export — it drives the explanatory review copy and the pin control. (A
 * single-version animal is unambiguous, so it is not flagged.)
 *
 * @param {object} animal - The owning animal.
 * @param {object} day - The recording day.
 * @param {object|null} mergedDay - `mergeDayMetadata(animal, day)`, or null when it could not
 *   be resolved (corrupt/missing configuration) — treated as blocked, not ready.
 * @param {Array} [animalDays] - The animal's day records; forwarded to the export gate so the
 *   cross-day bad-channel monotonicity block (a day that silently un-fails an earlier same-config
 *   bad channel) folds into readiness, matching the Export button. Omitted → back-compat no-op.
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
export function getDayWorkflowStatus(animal, day, mergedDay, animalDays = []) {
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
  const stepStatus = mergedDay ? computeStepStatus(day, mergedDay, animal, animalDays) : null;
  const exportStatus = stepStatus ? stepStatus.export : STEP_STATUS.ERROR;
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
