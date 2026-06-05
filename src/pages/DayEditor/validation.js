/**
 * @fileoverview Day Editor validation utilities
 *
 * Wraps the core validation module to provide day-editor-specific
 * functionality like step status computation and error grouping.
 */

import { validate, validateField as validateFieldCore } from '../../validation';

/**
 * Validates a single field against schema and rules.
 *
 * @param {object} mergedData - Merged animal + day metadata
 * @param {string} fieldPath - Dot-notation path (e.g., 'session.session_id')
 * @returns {Promise<{valid: boolean, errors: Array}>}
 *
 * @example
 * const { valid, errors } = await validateField(mergedDay, 'session.session_id');
 * if (!valid) {
 *   console.error(errors[0].message);
 * }
 */
export async function validateField(mergedData, fieldPath) {
  // Convert dot notation to validation module's format
  // "session.session_id" -> "session.session_id" (already compatible)
  const issues = validateFieldCore(mergedData, fieldPath);

  return {
    valid: issues.length === 0,
    errors: issues.map(issue => ({
      path: fieldPath,
      message: issue.message || 'Invalid value',
      severity: issue.severity || 'error',
      code: issue.code,
    })),
  };
}

/**
 * Validates entire day and computes step status.
 *
 * @param {import('@/state/workspaceTypes').Day} day - Day record
 * @param {object} mergedDay - Merged animal + day metadata
 * @returns {object} Status map: { stepId: 'valid'|'incomplete'|'error'|'pending' }
 *
 * @example
 * const status = computeStepStatus(day, mergedDay);
 * if (status.overview === 'error') {
 *   console.log('Overview step has validation errors');
 * }
 */
export function computeStepStatus(day, mergedDay) {
  const issues = validate(mergedDay);

  // Group errors by step
  const errorsByStep = groupErrorsByStep(issues);

  return {
    overview: getStepStatus(errorsByStep.overview, day.session),
    devices: computeDevicesStatus(day, mergedDay),
    epochs: computeEpochsStatus(day, errorsByStep.epochs),
    // (errorsByStep.epochs is scoped to task-path errors inside computeEpochsStatus)
    // The validation step owns the catch-all bucket (anything not routed to
    // overview/devices/epochs). It is in error only when that bucket has an
    // error-severity issue; an empty/clean catch-all reports valid so it stops
    // permanently disabling Export.
    validation: errorsByStep.validation.some(i => i.severity === 'error') ? 'error' : 'valid',
    export: issues.filter(i => i.severity === 'error').length === 0 ? 'valid' : 'error',
  };
}

/**
 * Computes the Epochs (Tasks & Epochs) step status from the day's tasks and the
 * task-level schema/rules errors.
 *
 * The status is driven by the day's **tasks**. We narrow the `epochs` error group
 * to task-path errors (path references `tasks[…]`): the group also collects
 * behavioral-event and associated-file paths (and a `units.behavioral_events`
 * required artifact), which are completeness concerns owned by the later
 * Validation step, not the Tasks & Epochs data-entry step.
 *
 * Severity policy: data entry is non-blocking except for blank schema-required
 * task fields (and epoch end <= start, which is blocked at the modal Save so it
 * cannot persist). Empty cameras, missing-camera references, no-epoch tasks, and
 * epoch overlaps are warnings/info and never mark the step in error.
 *
 * @param {object} day - Day record (reads `tasks`).
 * @param {Array} epochErrors - Issues grouped into the `epochs` step.
 * @returns {'incomplete'|'error'|'valid'}
 *   - `'incomplete'`: no tasks yet.
 *   - `'error'`: a task has an error-severity issue (e.g., a blank required field).
 *   - `'valid'`: at least one task and no task-level error-severity issues.
 */
export function computeEpochsStatus(day, epochErrors) {
  const tasks = day?.tasks || [];
  if (tasks.length === 0) return 'incomplete';

  const hasTaskError = (epochErrors || []).some(
    (issue) => issue.severity === 'error' && (issue.path || '').includes('task')
  );
  return hasTaskError ? 'error' : 'valid';
}

/**
 * Computes the Devices step status from the merged/effective electrode configuration
 * the export will encode. Mirrors the per-group health logic in
 * DevicesStep (getGroupStatus + the missing-channel-map branch) so the stepper and
 * the step content agree.
 *
 * @param {object} day - Day record (retained for call-site compatibility).
 * @param {object} mergedDay - Merged metadata (reads electrode_groups +
 *   ntrode_electrode_group_channel_map, including effective ntrode.bad_channels).
 * @returns {'incomplete'|'error'|'valid'}
 *   - `'incomplete'`: no electrode groups, or any group has no channel mapping.
 *   - `'error'`: any group has all its channels marked bad (group inactive).
 *   - `'valid'`: otherwise (bad-channel warnings are non-blocking).
 */
export function computeDevicesStatus(day, mergedDay) {
  const groups = mergedDay?.electrode_groups || [];
  const ntrodeMap = mergedDay?.ntrode_electrode_group_channel_map || [];

  if (groups.length === 0) return 'incomplete';

  let anyGroupAllBad = false;

  for (const group of groups) {
    // electrode_group_id and group ids are integers end-to-end (schema contract).
    const ntrodes = ntrodeMap.filter((n) => n.electrode_group_id === group.id);

    // A group with no channel mapping is a data-completeness problem (corruption
    // branch in DevicesStep), surfaced as incomplete rather than a hard error.
    if (ntrodes.length === 0) return 'incomplete';

    let totalChannels = 0;
    let totalBadChannels = 0;
    for (const ntrode of ntrodes) {
      totalChannels += Object.keys(ntrode.map || {}).length;
      totalBadChannels += (Array.isArray(ntrode.bad_channels) ? ntrode.bad_channels : []).length;
    }
    if (totalChannels > 0 && totalBadChannels === totalChannels) {
      anyGroupAllBad = true;
    }
  }

  return anyGroupAllBad ? 'error' : 'valid';
}

/**
 * Determine step status from errors and data completeness.
 *
 * @private
 * @param {Array} errors - Validation issues for this step
 * @param {object} data - Step data to check completeness
 * @returns {'valid'|'incomplete'|'error'|'pending'}
 */
function getStepStatus(errors, data) {
  // Check completeness first - if data is incomplete, treat as incomplete
  // rather than error (even if validation would fail)
  if (!data || !isStepComplete(data)) {
    // Missing required data
    return 'incomplete';
  }

  if (errors && errors.length > 0) {
    // Has validation errors (but data is present)
    return 'error';
  }

  // All good
  return 'valid';
}

/**
 * Check if overview step has required fields.
 *
 * @private
 * @param {object} sessionData - Session metadata
 * @returns {boolean} True if all required fields present
 */
function isStepComplete(sessionData) {
  return !!(
    sessionData &&
    sessionData.session_id &&
    sessionData.session_description
  );
}

/**
 * Group validation errors by which step they belong to.
 *
 * @param {Array} errors - All validation issues
 * @returns {object} Errors grouped by step
 *
 * @example
 * const grouped = groupErrorsByStep(allErrors);
 * console.log(`Overview has ${grouped.overview.length} errors`);
 */
export function groupErrorsByStep(errors) {
  const groups = {
    overview: [],
    devices: [],
    epochs: [],
    validation: [],
    export: [],
  };

  errors.forEach(error => {
    groups[stepIdForIssue(error)].push(error);
  });

  return groups;
}

/**
 * Determine which editor step "owns" a single validation issue, by inspecting its
 * path. This is the single source of truth for issue→step routing, used both to
 * group the validation summary ({@link groupErrorsByStep}) and to route a repair
 * action to the step that can fix it.
 *
 * Routing degrades to the catch-all `validation` step when a path matches none of
 * the data-entry steps (e.g. a bare `required` artifact whose path is just the
 * missing property name).
 *
 * @param {{path?: string, instancePath?: string}} issue - A validation issue.
 * @returns {'overview'|'devices'|'epochs'|'validation'} The owning step id.
 */
export function stepIdForIssue(issue) {
  // Prefer an explicit, valid issue.step (set by validation rules) over path routing,
  // so a rule can land its repair action on the step that actually fixes it
  // (e.g. a camera-path issue routed to 'epochs'). Fall back to path routing when
  // step is absent or not a known data-entry step.
  const ROUTABLE_STEPS = ['overview', 'devices', 'epochs', 'validation'];
  if (issue?.step && ROUTABLE_STEPS.includes(issue.step)) {
    return issue.step;
  }

  const path = issue?.path || issue?.instancePath || '';

  // Session-related fields → Overview
  if (path.includes('session') || path.includes('subject') || path.includes('experimenter') || path.includes('lab') || path.includes('institution') || path.includes('experiment_description')) {
    return 'overview';
  }
  // Device-related fields → Devices
  if (
    path.includes('electrode') ||
    path.includes('device') ||
    path.includes('camera') ||
    path.includes('ntrode') ||
    path.includes('targeted_') ||
    path.includes('meters_per_pixel') ||
    path.includes('lens')
  ) {
    return 'devices';
  }
  // Task/behavioral fields → Epochs
  if (path.includes('task') || path.includes('behavioral') || path.includes('epoch') || path.includes('associated')) {
    return 'epochs';
  }
  // Everything else → Validation (catch-all)
  return 'validation';
}

/**
 * User-facing step names, the single source of truth for step→label mapping shared by
 * the repair-action buttons and the Validation summary's step-group headings (re-exported
 * from RepairActions for back-compat). The catch-all `validation` step reads as
 * "Other required fields".
 *
 * @type {Record<string, string>}
 */
export const STEP_LABELS = {
  overview: 'Overview',
  devices: 'Devices',
  epochs: 'Epochs',
  validation: 'Other required fields',
  export: 'Export',
};

/**
 * The valid repair surfaces. `day` issues are editable in the Day Editor's own steps;
 * `animal` issues are only editable in the Animal Editor (device geometry, channel
 * maps, cameras, data-acq devices, subject identity); `none` issues point at a
 * read-only identity (slash ids) with no in-app editable target.
 *
 * @type {Set<string>}
 */
const REPAIR_SURFACES = new Set(['day', 'animal', 'none']);

/**
 * Explicit surface for each app rule code (Repair Routing Contract). This is the
 * authoritative map: an issue's `repairSurface` (set by the rule) is preferred, but
 * this table is the fallback for app-rule codes and the single place the contract is
 * enumerated. Codes absent here fall through to path/code derivation (notably AJV
 * schema issues, which carry no app metadata).
 *
 * @type {Record<string, 'day'|'animal'|'none'>}
 */
const SURFACE_BY_CODE = {
  // Editable ONLY in the Animal Editor (device geometry, channel maps, probe catalog,
  // electrode-group identity/location, cameras, data-acq devices, subject identity).
  channel_value_out_of_range: 'animal',
  channel_key_out_of_range: 'animal',
  channel_partition_invalid: 'animal',
  channel_row_count_mismatch: 'animal',
  multishank_bad_channels_ignored: 'animal',
  inconsistent_probe_catalog: 'animal',
  empty_location: 'animal',
  empty_targeted_location: 'animal',
  inconsistent_location_case: 'animal',
  unknown_device_type: 'animal',
  duplicate_electrode_group_id: 'animal',
  duplicate_ntrode_id: 'animal',
  dangling_electrode_group_ref: 'animal',
  duplicate_channels: 'animal',
  missing_channels: 'animal',
  duplicate_camera_id: 'animal',
  divergent_camera_identity: 'animal',
  divergent_data_acq_identity: 'animal',
  // Editable in the Day Editor (task/video/event re-picks, day bad-channel overrides,
  // session metadata incl. the inherited subject fields repairable in Overview,
  // optogenetics completeness).
  invalid_species: 'day',
  dangling_camera_ref: 'day',
  duplicate_behavioral_event_name: 'day',
  duplicate_behavioral_event_description: 'day',
  duplicate_task_epoch: 'day',
  orphaned_video: 'day',
  orphaned_file: 'day',
  divergent_task_identity: 'day',
  bad_channel_out_of_range: 'day',
  missing_camera: 'day',
  partial_configuration: 'day',
  // No editable in-app target — read-only identity (slash ids). The explanatory
  // message states the remedy (recreate the animal); a "Fix in …" button would
  // dead-end on a disabled control.
  subject_id_slash: 'none',
  session_id_slash: 'none',
};

/**
 * Codes whose affected field is a read-only identity with no editable in-app target.
 * Kept distinct so the path/code FALLBACK (for schema issues) can honor them even when
 * the path otherwise looks like a subject/session field.
 *
 * @type {Set<string>}
 */
const NONE_CODES = new Set(['subject_id_slash', 'session_id_slash']);

/**
 * Derive the repair surface for an issue that carries no explicit `repairSurface` and
 * no app-rule code in {@link SURFACE_BY_CODE} — i.e. an AJV schema issue. Device
 * geometry, channel maps, cameras, data-acq devices, and subject identity are edited in
 * the Animal Editor; everything else (session/overview, tasks, catch-all) is edited in
 * the Day Editor. Slash-id codes have no editable target.
 *
 * @param {{code?: string, path?: string, instancePath?: string}} issue
 * @returns {'day'|'animal'|'none'}
 */
function deriveSurfaceFromPath(issue) {
  if (NONE_CODES.has(issue?.code)) return 'none';

  // Normalize an AJV instancePath ("/cameras/0/lens") so the same substring checks
  // work as for the app rules' dotted paths ("cameras[0].lens").
  const raw = issue?.path || issue?.instancePath || '';
  const path = raw.replace(/^\//, '').replace(/\//g, '.');

  // Session/overview fields stay in the Day Editor even though they are "subject"-
  // adjacent — check these BEFORE the broad subject match below.
  if (
    path.includes('session') ||
    path.includes('experimenter') ||
    path.includes('lab') ||
    path.includes('institution') ||
    path.includes('experiment_description')
  ) {
    return 'day';
  }

  // Animal-Editor-owned domains: electrode geometry, channel maps, cameras, data-acq
  // devices, and subject metadata (DOB/weight/description/species/sex/genotype).
  if (
    path.includes('electrode') ||
    path.includes('ntrode') ||
    path.includes('camera') ||
    path.includes('data_acq') ||
    path.includes('targeted_') ||
    path.includes('meters_per_pixel') ||
    path.includes('lens') ||
    path.includes('subject')
  ) {
    return 'animal';
  }

  // Everything else (tasks, behavioral events, catch-all required artifacts) → Day Editor.
  return 'day';
}

/**
 * The single source of truth for routing a repair action to the editable OWNER of a
 * problem (Repair Routing Contract). Returns the surface to navigate to, the Day-Editor
 * step (for `day` surface) or `null` (for `animal`/`none`), and the button label.
 *
 * Resolution order:
 *   1. an explicit `issue.repairSurface` (set by the app rule) wins;
 *   2. else the app-rule code's surface from {@link SURFACE_BY_CODE};
 *   3. else derive from path/code ({@link deriveSurfaceFromPath}) — the fallback for
 *      AJV schema issues, which carry no app metadata.
 *
 * For `day`, the owning step is {@link stepIdForIssue} (which itself honors an explicit
 * `issue.step`); the label is "Fix in {StepLabel}". For `animal`, the label is
 * "Fix in Animal Editor". For `none`, no button is rendered (the label is informational).
 *
 * @param {{code?: string, path?: string, instancePath?: string, step?: string, repairSurface?: string}} issue
 * @returns {{surface: 'day'|'animal'|'none', step: string|null, label: string}}
 */
export function repairTargetForIssue(issue) {
  let surface =
    issue?.repairSurface && REPAIR_SURFACES.has(issue.repairSurface)
      ? issue.repairSurface
      : SURFACE_BY_CODE[issue?.code];
  if (!surface) {
    surface = deriveSurfaceFromPath(issue);
  }

  if (surface === 'animal') {
    return { surface: 'animal', step: null, label: 'Fix in Animal Editor' };
  }
  if (surface === 'none') {
    return { surface: 'none', step: null, label: 'No in-app fix' };
  }

  // Day surface: route to the owning Day-Editor step.
  const step = stepIdForIssue(issue);
  const stepLabel = STEP_LABELS[step] || step;
  return { surface: 'day', step, label: `Fix in ${stepLabel}` };
}
