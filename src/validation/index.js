/**
 * Unified Validation API
 *
 * Single entry point for all validation (schema + rules).
 * Returns standardized Issue[] format.
 */

import { schemaValidation } from './schemaValidation';
import { rulesValidation } from './rulesValidation';

/**
 * @typedef {object} Issue
 * @property {string} path - Normalized path: "subject.weight", "cameras[0].id"
 * @property {string} code - Error code: "required", "pattern", "missing_camera", "duplicate_channels", etc.
 * @property {"error"|"warning"} severity - Error severity level
 * @property {string} message - User-friendly error message
 * @property {string} [instancePath] - Original AJV path (for schema errors): "/subject/weight"
 * @property {string} [schemaPath] - Original AJV schema path (for schema errors)
 */

/**
 * Unified validation function combining schema and rules validation
 *
 * @param {object} model - The form data to validate
 * @returns {Issue[]} Sorted array of all validation issues
 */
export function validate(model) {
  const schemaIssues = schemaValidation(model);
  const rulesIssues = rulesValidation(model);

  const allIssues = [...schemaIssues, ...rulesIssues];

  // Sort deterministically: path first, then code
  // This ensures consistent ordering for snapshot tests and stable error display
  return allIssues.sort((a, b) => {
    if (a.path !== b.path) {
      return a.path.localeCompare(b.path);
    }
    return a.code.localeCompare(b.code);
  });
}

/**
 * Validates a specific field path and returns only issues for that subtree
 *
 * @param {object} model - The form data to validate
 * @param {string} fieldPath - Dot notation path (e.g., "subject.weight", "cameras[0]")
 * @returns {Issue[]} Issues for that field and its children
 */
export function validateField(model, fieldPath) {
  const allIssues = validate(model);

  // Filter to issues that match the field path or are children of it
  return allIssues.filter(issue =>
    issue.path === fieldPath ||
    issue.path.startsWith(fieldPath + '.') ||
    issue.path.startsWith(fieldPath + '[')
  );
}

// Re-export individual validation functions for advanced use cases
export { schemaValidation, rulesValidation };
