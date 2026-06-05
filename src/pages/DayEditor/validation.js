/**
 * @fileoverview Day Editor validation utilities
 *
 * Wraps the core validation module to provide day-editor-specific
 * functionality like step status computation and error grouping.
 */

import { validate, validateField as validateFieldCore } from '../../validation';
import { validateRawDay, validateRawAnimal } from '../../validation/rawShape';

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
/**
 * Whether `value` is a plain object record (not null, not an array). Mirrors the
 * helper in `workspaceUtils.js` — used to tell a well-formed override container/map
 * from a malformed (scalar/array) one.
 *
 * @param {*} value
 * @returns {boolean}
 */
function isRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

/**
 * Surface EVERY malformed/stale/shadowing `day.deviceOverrides` shape that
 * `resolveDayConfig` cannot faithfully apply (or applies in a way whose errors
 * mis-route), so it becomes a visible, day-routed, export-blocking, REPAIRABLE issue
 * instead of vanishing (fail-open), being smeared onto the geometry path (mis-routed
 * to the Animal Editor), or dead-ending repair. This is the validation "shadow" of
 * `resolveDayConfig`; the two MUST stay in lockstep — whenever the merge can't honor an
 * override cleanly, this surfaces a day-routed escape, and {@link DevicesStep} renders a
 * removal control for it.
 *
 * Covered shapes (all → `day` surface, `devices` step, error severity):
 *  - the WHOLE `deviceOverrides` is not a record (e.g. scalar "corrupt"): the merge
 *    reads `overrides?.x` off it (all undefined → fail-open to the snapshot), so it
 *    would export as if clean (`malformed_device_override`, path `deviceOverrides`);
 *  - a geometry override (`electrode_groups` / `ntrode_electrode_group_channel_map`)
 *    present but not an array — the merge falls back to the snapshot, hiding the
 *    corruption (`malformed_device_override`, path `deviceOverrides.<key>`);
 *  - a VALID-SHAPED (array) geometry override whose CONTENTS produce validation errors:
 *    the merge honors it (a supported feature — it shadows the snapshot), but those
 *    errors route to the Animal Editor, which edits the SNAPSHOT, not this day's
 *    override — a dead-end. We add a day-routed removable escape so the user can drop
 *    the override (`shadowed_geometry_override`, requires `baseIssues`);
 *  - a `bad_channels` container that is not an ntrode_id→list map (e.g. scalar "2.9")
 *    — the merge ignores it entirely (`malformed_bad_channel_override`);
 *  - a `bad_channels` key with no resolved ntrode — stale/dangling, keyed by ntrode_id
 *    for precise repair focus (`stale_bad_channel_override`);
 *  - a `bad_channels` value under a VALID key that is not a list — the merge declines
 *    to apply it (rather than smear a scalar onto the ntrode row), keyed by ntrode_id
 *    (`malformed_bad_channel_override`).
 *
 * Per-key `bad_channels` issues carry a KEY-SPECIFIC path (`deviceOverrides.bad_channels.<id>`)
 * so the stepper's repair-focus lands on the clicked ntrode's removal control, not the
 * first matching one.
 *
 * These issues are folded into `computeStepStatus` (the export gate) AND the rendered
 * repair lists via {@link validateDay}, so a blocking override is always repairable on
 * the Devices step, never "gated but invisible" or routed to a dead-end.
 *
 * @param {object} day - The day record (reads `deviceOverrides`).
 * @param {object} mergedDay - Merged metadata (resolved ntrode id set).
 * @param {Array} [baseIssues] - The `validate(mergedDay)` issues, used to detect whether
 *   an active array geometry override's contents are actually erroring (so a CLEAN valid
 *   override is not flagged). Defaults to empty (skips the shadowed-override check).
 * @returns {Array} Error issues for malformed/stale/shadowing overrides.
 */
export function dayOverrideIssues(day, mergedDay, baseIssues = []) {
  const overrides = day?.deviceOverrides;
  if (overrides == null) return [];

  // The WHOLE container is a scalar/array, not a record. resolveDayConfig reads
  // `overrides?.electrode_groups` etc. off it (all undefined → fail-open to the
  // snapshot), so a restored `deviceOverrides: "corrupt"` exports as if nothing were
  // wrong. Surface + make removable; nothing further can be inspected.
  if (!isRecord(overrides)) {
    return [{
      path: 'deviceOverrides',
      field: 'deviceOverrides',
      step: 'devices',
      repairSurface: 'day',
      actionLabel: 'Remove device overrides',
      code: 'malformed_device_override',
      severity: 'error',
      message:
        `This day's device overrides are corrupt (expected an object). They are being ignored ` +
        `in favor of the saved configuration — remove them to clear this error.`,
    }];
  }

  const issues = [];

  // Geometry overrides. The app never PRODUCES day-level geometry overrides (probe
  // geometry lives in animal configuration snapshots), but `resolveDayConfig` honors a
  // valid array override (a supported legacy/import feature). So:
  //  - present-but-not-an-array → corrupt, fail-open hidden → blocking + removable;
  //  - present array whose CONTENTS error → honored-but-shadowing the snapshot, errors
  //    mis-route to the Animal Editor → add a day-routed removable escape. A CLEAN valid
  //    array override is NOT flagged (no dead-end to break).
  const baseErrors = (Array.isArray(baseIssues) ? baseIssues : []).filter((i) => i?.severity === 'error');
  const errorPath = (i) => i?.path || i?.instancePath || '';
  // A geometry override is "erroring" only when its STRUCTURAL contents err — NOT when a
  // day-owned bad-channel overlay errors on an ntrode path. Excluding bad_channels here
  // is what stops a CLEAN ntrode override from being falsely blamed for a bad-channel
  // error (the path contains "ntrode" either way).
  const isBadChannelError = (i) =>
    i?.field === 'bad_channels' ||
    errorPath(i).includes('bad_channels') ||
    i?.code === 'bad_channel_out_of_range' ||
    i?.code === 'multishank_bad_channels_ignored';
  // 'electrode_groups' (with the trailing 's') appears only in electrode-group paths;
  // the ntrode path is 'ntrode_electrode_group_channel_map' (singular 'electrode_group').
  const GEOMETRY_DOMAINS = {
    electrode_groups: (i) => !isBadChannelError(i) && errorPath(i).includes('electrode_groups'),
    ntrode_electrode_group_channel_map: (i) => !isBadChannelError(i) && errorPath(i).includes('ntrode'),
  };
  for (const key of ['electrode_groups', 'ntrode_electrode_group_channel_map']) {
    const value = overrides[key];
    if (value == null) continue;
    if (!Array.isArray(value)) {
      issues.push({
        path: `deviceOverrides.${key}`,
        field: key,
        step: 'devices',
        repairSurface: 'day',
        actionLabel: 'Remove device override',
        code: 'malformed_device_override',
        severity: 'error',
        message:
          `This day's "${key}" device override is corrupt (expected a list of devices). ` +
          `It is being ignored in favor of the saved configuration — remove the override to clear this error.`,
      });
    } else if (baseErrors.some(GEOMETRY_DOMAINS[key])) {
      issues.push({
        path: `deviceOverrides.${key}`,
        field: key,
        step: 'devices',
        repairSurface: 'day',
        actionLabel: 'Remove device override',
        code: 'shadowed_geometry_override',
        severity: 'error',
        message:
          `This day overrides the saved device ${key === 'electrode_groups' ? 'electrode groups' : 'channel map'} ` +
          `and the override has validation errors. Those errors can't be fixed in the Animal Editor (which edits ` +
          `the saved configuration, not this day's override). Remove the day override to use the saved configuration.`,
      });
    }
  }

  const bad = overrides.bad_channels;
  if (bad != null) {
    if (!isRecord(bad)) {
      // Container is a scalar/array instead of an ntrode_id→list map: the merge
      // ignores it entirely, so without this it would vanish with no repair.
      issues.push({
        path: 'deviceOverrides.bad_channels',
        field: 'bad_channels',
        step: 'devices',
        repairSurface: 'day',
        actionLabel: 'Remove failed-channel override',
        code: 'malformed_bad_channel_override',
        severity: 'error',
        message:
          `This day's failed-channel override is corrupt (expected a map of ntrode id → ` +
          `failed-channel list). It is being ignored — remove the override to clear this error.`,
      });
    } else {
      const validNtrodeIds = new Set(
        (mergedDay?.ntrode_electrode_group_channel_map || []).map((n) => String(n?.ntrode_id))
      );
      Object.keys(bad).forEach((key) => {
        if (!validNtrodeIds.has(String(key))) {
          issues.push({
            path: `deviceOverrides.bad_channels.${key}`,
            field: 'bad_channels',
            step: 'devices',
            repairSurface: 'day',
            actionLabel: 'Fix bad channels',
            code: 'stale_bad_channel_override',
            severity: 'error',
            message:
              `A day-level bad-channel override targets ntrode "${key}", which no longer exists ` +
              `in this day's channel map. Remove the stale override or restore the ntrode.`,
          });
        } else if (!Array.isArray(bad[key])) {
          // Value under a VALID ntrode key is not a list. resolveDayConfig declines to
          // apply it (smearing a scalar onto the ntrode row would surface as an
          // Animal-Editor schema error on a field the user can't reach there), so the
          // corrupt value is surfaced HERE, keyed to its real owner (the day override).
          issues.push({
            path: `deviceOverrides.bad_channels.${key}`,
            field: 'bad_channels',
            step: 'devices',
            repairSurface: 'day',
            actionLabel: 'Remove failed-channel override',
            code: 'malformed_bad_channel_override',
            severity: 'error',
            message:
              `A day-level failed-channel override for ntrode "${key}" is corrupt (expected a ` +
              `list of channel numbers). Remove the stale override to clear this error.`,
          });
        }
      });
    }
  }

  return issues;
}

/**
 * The authoritative issue list for a day — schema + rules over the merged model
 * PLUS day-level issues that the merge would otherwise hide (stale bad-channel
 * overrides). This is the SINGLE source so the export gate
 * (`computeStepStatus`) and the rendered repair lists (ValidationStep, ExportStep)
 * never diverge — a blocking issue must always be visible and repairable, never
 * "gated but invisible".
 *
 * @param {object} day - The day record.
 * @param {object} mergedDay - Merged animal + day metadata.
 * @param animal
 * @returns {Array} All validation issues for the day.
 */
export function validateDay(day, mergedDay, animal) {
  // Boundary 1: validate the RAW persisted day AND animal shape FIRST — before the merge
  // launders a corrupt collection (`tasks: {}`, `animal.cameras: "nope"`) into an empty
  // export default that the merged-model validation below would see as clean. These block
  // export on raw corruption regardless of how the merge would launder it. `animal` is
  // optional (call sites that have it pass it); without it, animal raw issues are skipped.
  const raw = validateRawDay(day);
  const rawAnimal = validateRawAnimal(animal);
  // Compute the base (schema + rules) issues once, then pass them to dayOverrideIssues
  // so it can tell an erroring array geometry override (a dead-end that needs a day-routed
  // escape) from a clean one (which must NOT be flagged).
  const base = validate(mergedDay);
  // Boundary 2: ownership by PROVENANCE, not path. A geometry error's owner depends on
  // WHERE the merged geometry came from — the animal snapshot (animal-owned, edit there)
  // or a day-level override (day-owned, the snapshot is the wrong editor). Re-tag base
  // geometry errors to the day when the day overrides that geometry, so they don't
  // dead-end on "Fix in Animal Editor".
  const taggedBase = tagBaseOwnershipByProvenance(base, dayGeometryProvenance(day));
  return [...raw, ...rawAnimal, ...taggedBase, ...dayOverrideIssues(day, mergedDay, base)];
}

/**
 * Day-level geometry provenance, derived from the persisted day's overrides ALONE (no
 * animal needed): a collection is day-owned exactly when the day overrides it with an
 * array. `bad_channels` are always a day-editable overlay (their rule already routes to
 * day), so they are not part of geometry provenance.
 *
 * @param {object} day - The persisted day.
 * @returns {{ electrode_groups: boolean, ntrode: boolean }} Whether each is day-overridden.
 */
function dayGeometryProvenance(day) {
  const ov = day && typeof day === 'object' && !Array.isArray(day) ? day.deviceOverrides : null;
  const rec = ov && typeof ov === 'object' && !Array.isArray(ov) ? ov : {};
  return {
    electrode_groups: Array.isArray(rec.electrode_groups),
    ntrode: Array.isArray(rec.ntrode_electrode_group_channel_map),
  };
}

/**
 * Re-tag base (schema/rule) GEOMETRY errors with explicit day ownership when the day
 * overrides that geometry — the override, not the animal snapshot, owns them, so fixing
 * the snapshot can't clear them. Bad-channel errors are left alone (already day-owned by
 * their rule). Non-overridden domains are untouched (snapshot-owned → animal).
 *
 * @param {Array} issues - Base validation issues.
 * @param {{ electrode_groups: boolean, ntrode: boolean }} prov - Geometry provenance.
 * @returns {Array} Issues with explicit `ownerSurface`/`repairStep`/`focusPath` on the
 *   day-overridden geometry errors.
 */
function tagBaseOwnershipByProvenance(issues, prov) {
  if (!prov.electrode_groups && !prov.ntrode) return issues;
  return issues.map((issue) => {
    if (issue?.severity !== 'error') return issue;
    const path = issue.path || issue.instancePath || '';
    const isBadChannel =
      issue.field === 'bad_channels' ||
      path.includes('bad_channels') ||
      issue.code === 'bad_channel_out_of_range' ||
      issue.code === 'multishank_bad_channels_ignored';
    if (isBadChannel) return issue;
    // 'electrode_groups' (with the trailing 's') is only in electrode-group paths; the
    // ntrode path is 'ntrode_electrode_group_channel_map' (singular 'electrode_group').
    if (prov.electrode_groups && path.includes('electrode_groups')) {
      return { ...issue, ownerSurface: 'day', step: 'devices', repairStep: 'devices', focusPath: 'deviceOverrides.electrode_groups' };
    }
    if (prov.ntrode && path.includes('ntrode')) {
      return { ...issue, ownerSurface: 'day', step: 'devices', repairStep: 'devices', focusPath: 'deviceOverrides.ntrode_electrode_group_channel_map' };
    }
    return issue;
  });
}

/**
 * Validates entire day and computes step status.
 *
 * @param {object} day - The day record.
 * @param {object} mergedDay - Merged animal + day metadata.
 * @param {object} [animal] - The owning animal (optional); folds raw animal-shape issues
 *   (e.g. a non-array `cameras`) into the export gate.
 * @returns {object} Status map per step.
 */
export function computeStepStatus(day, mergedDay, animal) {
  const issues = validateDay(day, mergedDay, animal);

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
  // A non-array `tasks` is corrupt persisted state (raw-shape error, blocking) — reflect
  // it as 'error', never a false 'incomplete'/'valid'. `{}.length` is undefined, so the
  // old `=== 0` guard let `{}` slip through as if it had tasks.
  if (day?.tasks != null && !Array.isArray(day.tasks)) return 'error';
  const tasks = Array.isArray(day?.tasks) ? day.tasks : [];
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
  multishank_bad_channels_ignored: 'day',
  stale_bad_channel_override: 'day',
  malformed_bad_channel_override: 'day',
  malformed_device_override: 'day',
  shadowed_geometry_override: 'day',
  malformed_day_collection: 'day',
  malformed_animal_collection: 'animal',
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

  // Read-only identity fields have no editable target on ANY step (subject_id is the
  // animal's identity; session_id is derived from it) — both are rendered read-only.
  // A generic SCHEMA error on them (not just the slash-specific app rules) must route
  // to 'none' (message only) rather than dead-ending on a disabled control.
  if (/(^|\.)subject_id($|\b)/.test(path) || /(^|\.)session_id($|\b)/.test(path)) {
    return 'none';
  }

  // Session/overview fields stay in the Day Editor. The inherited SUBJECT fields
  // (species/sex/genotype/DOB/weight/description) are repairable in the Day Editor
  // Overview step (the Animal Editor has no subject step), so they route to 'day'
  // too — check these BEFORE the device matches below.
  if (
    path.includes('session') ||
    path.includes('subject') ||
    path.includes('experimenter') ||
    path.includes('lab') ||
    path.includes('institution') ||
    path.includes('experiment_description')
  ) {
    return 'day';
  }

  // Animal-Editor-owned domains: electrode geometry, channel maps, cameras, data-acq devices.
  if (
    path.includes('electrode') ||
    path.includes('ntrode') ||
    path.includes('camera') ||
    path.includes('data_acq') ||
    path.includes('targeted_') ||
    path.includes('meters_per_pixel') ||
    path.includes('lens')
  ) {
    return 'animal';
  }

  // Everything else (tasks, behavioral events, catch-all required artifacts) → Day Editor.
  return 'day';
}

/**
 * The Animal Editor's steps, in order, with the field-path keywords that route to each.
 * Used to (a) deep-link an animal-surface repair to the right step and (b) give the
 * repair button a step-aware label. The Day Editor's repair routing already decides the
 * SURFACE (`animal`); this only resolves WHICH animal-editor step owns the field.
 *
 * @type {Array<{ index: number, label: string }>}
 */
export const ANIMAL_EDITOR_STEPS = [
  { index: 0, label: 'Electrode Groups' },
  { index: 1, label: 'Channel Maps' },
  { index: 2, label: 'Hardware Config' },
];

/**
 * Resolve which Animal Editor step owns a field path (for deep-linking + labeling an
 * animal-surface repair). Channel-map paths → Channel Maps; camera / data-acq paths →
 * Hardware Config; electrode-group geometry/identity (and anything else) → Electrode
 * Groups (the default first step). AJV instancePath slashes are normalized first.
 *
 * Note channel-map is checked BEFORE electrode-group because the channel-map path
 * (`ntrode_electrode_group_channel_map`) contains the substring "electrode_group".
 *
 * @param {string} [fieldPath] - Issue path (dotted app path or AJV instancePath).
 * @returns {{ index: number, label: string }} The owning step (defaults to step 0).
 */
export function animalEditorStepForFieldPath(fieldPath) {
  const path = String(fieldPath || '').replace(/^\//, '').replace(/\//g, '.');

  if (path.includes('ntrode')) return ANIMAL_EDITOR_STEPS[1];
  if (path.includes('camera') || path.includes('data_acq')) return ANIMAL_EDITOR_STEPS[2];
  // electrode geometry/identity + bare keyword paths (device_type/location/targeted_*).
  return ANIMAL_EDITOR_STEPS[0];
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
  // Boundary 2: an EXPLICIT ownerSurface (set by the producer or the provenance pass in
  // validateDay) wins — ownership is declared, not inferred from path. The legacy
  // repairSurface / SURFACE_BY_CODE / path-derivation chain is the fallback for issues
  // that don't yet carry explicit ownership (AJV schema issues in unambiguous domains).
  let surface =
    issue?.ownerSurface && REPAIR_SURFACES.has(issue.ownerSurface)
      ? issue.ownerSurface
      : issue?.repairSurface && REPAIR_SURFACES.has(issue.repairSurface)
        ? issue.repairSurface
        : SURFACE_BY_CODE[issue?.code];
  if (!surface) {
    surface = deriveSurfaceFromPath(issue);
  }

  if (surface === 'animal') {
    // Step-aware label so the user knows which Animal Editor step the fix lives in.
    const { label: stepLabel } = animalEditorStepForFieldPath(issue?.path || issue?.instancePath);
    return { surface: 'animal', step: null, label: `Fix in Animal Editor → ${stepLabel}` };
  }
  if (surface === 'none') {
    return { surface: 'none', step: null, label: 'No in-app fix' };
  }

  // Day surface: route to the owning Day-Editor step.
  const step = stepIdForIssue(issue);
  const stepLabel = STEP_LABELS[step] || step;
  return { surface: 'day', step, label: `Fix in ${stepLabel}` };
}
