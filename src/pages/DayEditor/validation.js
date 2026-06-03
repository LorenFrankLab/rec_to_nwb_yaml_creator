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
    validation: 'incomplete', // Day validation step wired in a later phase
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
 * Computes the Devices step status from the inherited electrode configuration and
 * the day's bad-channel overrides. Mirrors the per-group health logic in
 * DevicesStep (getGroupStatus + the missing-channel-map branch) so the stepper and
 * the step content agree.
 *
 * @param {object} day - Day record (reads deviceOverrides.bad_channels).
 * @param {object} mergedDay - Merged metadata (reads electrode_groups +
 *   ntrode_electrode_group_channel_map).
 * @returns {'incomplete'|'error'|'valid'}
 *   - `'incomplete'`: no electrode groups, or any group has no channel mapping.
 *   - `'error'`: any group has all its channels marked bad (group inactive).
 *   - `'valid'`: otherwise (bad-channel warnings are non-blocking).
 */
export function computeDevicesStatus(day, mergedDay) {
  const groups = mergedDay?.electrode_groups || [];
  const ntrodeMap = mergedDay?.ntrode_electrode_group_channel_map || [];
  const badChannels = day?.deviceOverrides?.bad_channels || {};

  if (groups.length === 0) return 'incomplete';

  let anyGroupAllBad = false;

  for (const group of groups) {
    const ntrodes = ntrodeMap.filter((n) => n.electrode_group_id === group.id);

    // A group with no channel mapping is a data-completeness problem (corruption
    // branch in DevicesStep), surfaced as incomplete rather than a hard error.
    if (ntrodes.length === 0) return 'incomplete';

    let totalChannels = 0;
    let totalBadChannels = 0;
    for (const ntrode of ntrodes) {
      totalChannels += Object.keys(ntrode.map || {}).length;
      totalBadChannels += (badChannels[ntrode.ntrode_id] || []).length;
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
    const path = error.path || error.instancePath || '';

    // Session-related fields → Overview
    if (path.includes('session') || path.includes('subject') || path.includes('experimenter') || path.includes('lab') || path.includes('institution') || path.includes('experiment_description')) {
      groups.overview.push(error);
    }
    // Device-related fields → Devices
    else if (path.includes('electrode') || path.includes('device') || path.includes('camera') || path.includes('ntrode')) {
      groups.devices.push(error);
    }
    // Task/behavioral fields → Epochs
    else if (path.includes('task') || path.includes('behavioral') || path.includes('epoch') || path.includes('associated')) {
      groups.epochs.push(error);
    }
    // Everything else → Validation (catch-all)
    else {
      groups.validation.push(error);
    }
  });

  return groups;
}
