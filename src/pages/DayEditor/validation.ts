/**
 * @fileoverview Day Editor page-only field-blur validation helper.
 *
 * App-wide day validation composition, step-status computation, and repair/owner
 * routing live in the domain module `src/domain/validation.ts` (consumed by the Day
 * Editor, Animal Editor, Validation summary, and Export step). This file keeps only the
 * page-local on-blur field check used by the Day Editor's Overview step.
 */

import { validateField as validateFieldCore } from '../../validation';
import type { ValidationModel } from '../../validation/issueTypes';

/**
 * Validates a single field against schema and rules.
 *
 * @example
 * const { valid, errors } = await validateField(mergedDay, 'session.session_id');
 * if (!valid) {
 *   console.error(errors[0].message);
 * }
 */
export async function validateField(mergedData: ValidationModel, fieldPath: string) {
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
