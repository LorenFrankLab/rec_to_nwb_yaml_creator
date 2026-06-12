/**
 * Unified Validation API
 *
 * Single entry point for all validation (schema + rules).
 * Returns standardized Issue[] format.
 */

import { schemaValidation } from './schemaValidation';
import { rulesValidation } from './rulesValidation';
import type { ValidationIssue, ValidationModel } from './issueTypes';

// The unified issue shape (schema + rules) is `ValidationIssue` (validation/issueTypes.ts):
// `path`/`code`/`message`/`severity` always present, with optional `instancePath`/`schemaPath`
// carried by AJV schema errors.

/**
 * Unified validation function combining schema and rules validation
 *
 * @param model - The form data to validate
 * @returns Sorted array of all validation issues
 */
export function validate(model: ValidationModel): ValidationIssue[] {
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
 * @param model - The form data to validate
 * @param fieldPath - Dot notation path (e.g., "subject.weight", "cameras[0]")
 * @returns Issues for that field and its children
 */
export function validateField(model: ValidationModel, fieldPath: string): ValidationIssue[] {
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
