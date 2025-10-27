/**
 * Baseline Test Compatibility Wrappers
 *
 * These functions convert the new unified validate() API back to the old
 * separate jsonschemaValidation() and rulesValidation() formats.
 *
 * This allows baseline tests to continue working without modification during refactoring.
 *
 * DO NOT use these in new tests - use validate() directly instead.
 */

import { validate } from '../../validation';

/**
 * Compatibility wrapper: converts new validate() API to old jsonschemaValidation() format
 * This allows baseline tests to continue working without modification
 *
 * @param {Object} formContent - Form data to validate
 * @returns {Object} Validation result in old format
 */
export function jsonschemaValidation(formContent) {
  const issues = validate(formContent);

  // Filter to only schema validation issues (have instancePath)
  const schemaIssues = issues.filter(issue => issue.instancePath !== undefined);

  const isValid = schemaIssues.length === 0;

  const validationMessages = schemaIssues.map((issue) => {
    return `Key: ${issue.instancePath
      .split('/')
      .filter((x) => x !== '')
      .join(', ')}. | Error: ${issue.message}`;
  });

  const errorIds = [
    ...new Set(
      schemaIssues.map((issue) => {
        const validationEntries = issue.instancePath
          .split('/')
          .filter((x) => x !== '');
        return validationEntries[0];
      })
    ),
  ];

  // Convert to AJV error format for compatibility
  const errors = schemaIssues.length === 0 ? null : schemaIssues.map(issue => ({
    instancePath: issue.instancePath,
    schemaPath: issue.schemaPath,
    message: issue.message,
  }));

  return {
    valid: isValid,
    isValid,
    jsonSchemaErrorMessages: validationMessages,
    jsonSchemaErrors: errors,
    jsonSchemaErrorIds: errorIds,
    errors,
  };
}

/**
 * Compatibility wrapper: converts new validate() API to old rulesValidation() format
 *
 * @param {Object} jsonFileContent - Form data to validate
 * @returns {Object} Validation result in old format
 */
export function rulesValidation(jsonFileContent) {
  const issues = validate(jsonFileContent);

  // Filter to only rules validation issues (no instancePath)
  const rulesIssues = issues.filter(issue => issue.instancePath === undefined);

  const isFormValid = rulesIssues.length === 0;

  const errorMessages = rulesIssues.map(issue => issue.message);

  const errorIds = [
    ...new Set(
      rulesIssues.map(issue => {
        const topLevelField = issue.path.split('[')[0].split('.')[0];
        return topLevelField;
      })
    )
  ];

  const errors = rulesIssues.map(issue => ({
    id: issue.path.replace(/\[(\d+)\]\.(\w+)/g, '-$2-$1').replace(/\[(\d+)\]$/g, '-$1'),
    message: issue.message,
  }));

  return {
    isFormValid,
    formErrors: errorMessages,
    formErrorIds: errorIds,
    errors,
  };
}
