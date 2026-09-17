/**
 * JSON Schema Validation using AJV
 *
 * Validates model against NWB JSON schema and returns unified Issue[] format.
 */

import Ajv from 'ajv';
import JsonSchemaFile from '../nwb_schema.json';
import { normalizeAjvPath } from './paths';
import type { ValidationIssue, ValidationModel } from './issueTypes';

// Compile AJV validator once at module load for performance
// Recompiling on every validation call would cause significant performance degradation
const ajv = new Ajv({
  allErrors: true,
  strict: false // Allow non-standard keywords like "version" for metadata
});
const compiledValidator = ajv.compile(JsonSchemaFile);

/**
 * Validates model against NWB JSON schema using AJV
 *
 * @param model - The form data to validate
 * @returns Array of validation issues with format:
 *   {
 *     path: string,           // Normalized path: "subject.weight"
 *     code: string,           // AJV keyword: "required", "pattern", "type", etc.
 *     severity: "error",      // Always "error" for schema violations
 *     message: string,        // User-friendly message
 *     instancePath: string,   // Original AJV path: "/subject/weight"
 *     schemaPath: string      // AJV schema path for debugging
 *   }
 */
export const schemaValidation = (model: ValidationModel): ValidationIssue[] => {
  compiledValidator(model);

  if (!compiledValidator.errors) {
    return [];
  }

  return compiledValidator.errors.map((error: any) => {
    // For required field errors, AJV puts the field name in params.missingProperty
    // instead of instancePath (which is empty string for root object)
    let path = normalizeAjvPath(error.instancePath);
    if (error.keyword === 'required' && error.params?.missingProperty) {
      path = path
        ? `${path}.${error.params.missingProperty}`
        : error.params.missingProperty;
    }

    const fileMatch = /^(associated_(?:video_)?files)\[(\d+)\]\.task_epochs$/.exec(path);
    const files = fileMatch ? model[fileMatch[1]] : undefined;
    const file = Array.isArray(files) ? files[Number(fileMatch?.[2])] : undefined;
    const epochMessage = fileMatch
      ? `${fileMatch[1] === 'associated_video_files' ? 'Video' : 'File'} “${file?.name || `entry ${Number(fileMatch[2]) + 1}`}” needs a recording epoch. Select an epoch or remove this file in Manage files.`
      : undefined;

    return {
      path,
      code: error.keyword,
      severity: 'error',
      message: epochMessage ?? sanitizeMessage(error.message, error.instancePath, path),
      instancePath: error.instancePath,
      schemaPath: error.schemaPath
    };
  });
};

/**
 * Messages for a REQUIRED field whose absence is expected in normal use and whose repair lives
 * somewhere specific, keyed by the resolved issue path. An animal may legitimately be created as a
 * draft without a date of birth, so "must have required property 'date_of_birth'" is the export
 * gate finally asking for it — it must name the field and where to supply it.
 */
const MISSING_REQUIRED_MESSAGES: Record<string, string> = {
  'subject.date_of_birth': 'Date of birth is missing. Add it in the animal profile.',
};

/**
 * Sanitizes AJV error messages to be more user-friendly
 *
 * @param message - Original AJV error message
 * @param instancePath - AJV instancePath for context
 * @param path - Resolved dotted issue path (includes the missing property for `required` errors)
 * @returns User-friendly error message
 */
function sanitizeMessage(message: string | undefined, instancePath: string, path?: string): string {
  // Defensive null check - AJV should always provide message, but be safe
  if (!message) {
    return 'Validation error';
  }

  // A missing required field whose absence is a normal draft state (see the table above). The
  // instancePath names the PARENT object, so this keys off the resolved path instead.
  if (path && message.startsWith('must have required property') && MISSING_REQUIRED_MESSAGES[path]) {
    return MISSING_REQUIRED_MESSAGES[path];
  }

  // Empty string pattern violation - schema uses pattern "^(.|\\s)*\\S(.|\\s)*$"
  // which requires at least one non-whitespace character
  if (message.includes('must match pattern') && message.includes('\\S')) {
    const fieldName = instancePath.split('/').filter(x => x).join('.');
    return `${fieldName} cannot be empty or contain only whitespace`;
  }

  // Special message for date_of_birth field
  if (instancePath === '/subject/date_of_birth') {
    return 'Date of birth needs to comply with ISO 8601 format';
  }

  // Return original message for all other cases
  return message;
}
