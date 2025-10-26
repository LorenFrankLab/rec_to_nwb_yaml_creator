/**
 * JSON Schema Validation using AJV
 *
 * Validates model against NWB JSON schema and returns unified Issue[] format.
 */

import addFormats from 'ajv-formats';
import JsonSchemaFile from '../nwb_schema.json';
import { normalizeAjvPath } from './paths';
const Ajv = require('ajv');

// Compile AJV validator once at module load for performance
// Recompiling on every validation call would cause significant performance degradation
const ajv = new Ajv({ allErrors: true });
addFormats(ajv);
const compiledValidator = ajv.compile(JsonSchemaFile);

/**
 * Validates model against NWB JSON schema using AJV
 *
 * @param {object} model - The form data to validate
 * @returns {Issue[]} Array of validation issues with format:
 *   {
 *     path: string,           // Normalized path: "subject.weight"
 *     code: string,           // AJV keyword: "required", "pattern", "type", etc.
 *     severity: "error",      // Always "error" for schema violations
 *     message: string,        // User-friendly message
 *     instancePath: string,   // Original AJV path: "/subject/weight"
 *     schemaPath: string      // AJV schema path for debugging
 *   }
 */
export const schemaValidation = (model) => {
  compiledValidator(model);

  if (!compiledValidator.errors) {
    return [];
  }

  return compiledValidator.errors.map(error => {
    // For required field errors, AJV puts the field name in params.missingProperty
    // instead of instancePath (which is empty string for root object)
    let path = normalizeAjvPath(error.instancePath);
    if (error.keyword === 'required' && error.params?.missingProperty) {
      path = error.params.missingProperty;
    }

    return {
      path,
      code: error.keyword,
      severity: 'error',
      message: sanitizeMessage(error.message, error.instancePath),
      instancePath: error.instancePath,
      schemaPath: error.schemaPath
    };
  });
};

/**
 * Sanitizes AJV error messages to be more user-friendly
 *
 * @param {string} message - Original AJV error message
 * @param {string} instancePath - AJV instancePath for context
 * @returns {string} User-friendly error message
 */
function sanitizeMessage(message, instancePath) {
  // Defensive null check - AJV should always provide message, but be safe
  if (!message) {
    return 'Validation error';
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
