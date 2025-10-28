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
    devices: 'incomplete',    // M6 will implement
    epochs: 'incomplete',     // M7 will implement
    validation: 'incomplete', // M9 will implement
    export: issues.filter(i => i.severity === 'error').length === 0 ? 'valid' : 'error',
  };
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
