/**
 * Quick Checks - Lightweight Synchronous Validation
 *
 * Provides instant feedback while typing (debounced onChange, 250-400ms).
 * These are cheap, synchronous checks that don't require full schema validation.
 *
 * Each check returns:
 * - null if valid
 * - { severity: 'hint', message: string } if invalid
 *
 * Note: These are "hints", not errors. They use severity: 'hint' instead of 'error'
 * to indicate they should be displayed subtly (no role="alert", no ARIA announcements).
 */

/**
 * Check if a value is considered "empty" for required field validation
 * @param {any} value - Value to check
 * @returns {boolean} True if value is empty/null/undefined/whitespace
 */
function isEmpty(value) {
  if (value === null || value === undefined) {
    return true;
  }

  if (typeof value === 'string') {
    return value.trim() === '';
  }

  if (Array.isArray(value)) {
    return value.length === 0;
  }

  if (typeof value === 'object') {
    return Object.keys(value).length === 0;
  }

  return false; // Numbers, booleans, etc. are not empty
}

/**
 * Quick validation checks for instant feedback
 */
export const quickChecks = {
  /**
   * Check if required field has a value
   * @param {string} path - Field path (for future use in custom messages)
   * @param {any} value - Field value
   * @returns {null|{severity: 'hint', message: string}} Null if valid, hint if invalid
   */
  required(path, value) {
    if (isEmpty(value)) {
      return {
        severity: 'hint',
        message: 'This field is required'
      };
    }
    return null;
  },

  /**
   * Check if date string matches ISO 8601 format
   * @param {string} path - Field path
   * @param {string} value - Date string to validate
   * @returns {null|{severity: 'hint', message: string}} Null if valid, hint if invalid
   */
  dateFormat(path, value) {
    // Empty values are allowed (field might be optional)
    if (!value) {
      return null;
    }

    // ISO 8601 format: YYYY-MM-DDTHH:MM:SS[.sss][Z|±HH:MM]
    const iso8601Pattern = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/;

    if (!iso8601Pattern.test(value)) {
      return {
        severity: 'hint',
        message: 'Date must be in ISO 8601 format (YYYY-MM-DDTHH:MM:SS, e.g., 2023-06-22T14:30:00)'
      };
    }

    return null;
  },

  /**
   * Check if value is one of the allowed enum values
   * @param {string} path - Field path
   * @param {any} value - Value to check
   * @param {Array} validValues - Array of allowed values
   * @returns {null|{severity: 'hint', message: string}} Null if valid, hint if invalid
   */
  enum(path, value, validValues) {
    // Empty values are allowed (field might be optional)
    if (!value) {
      return null;
    }

    if (!validValues.includes(value)) {
      return {
        severity: 'hint',
        message: `Must be one of: ${validValues.join(', ')}`
      };
    }

    return null;
  },

  /**
   * Check if numeric value is within range
   * @param {string} path - Field path
   * @param {number|string} value - Numeric value to check
   * @param {number} [min] - Minimum allowed value (inclusive)
   * @param {number} [max] - Maximum allowed value (inclusive)
   * @returns {null|{severity: 'hint', message: string}} Null if valid, hint if invalid
   */
  numberRange(path, value, min, max) {
    // Empty values are allowed (field might be optional)
    if (!value && value !== 0) {
      return null;
    }

    const num = parseFloat(value);

    // If not a valid number, ignore (let schema validation handle it)
    if (isNaN(num)) {
      return null;
    }

    if (min !== undefined && num < min) {
      return {
        severity: 'hint',
        message: `Must be at least ${min}`
      };
    }

    if (max !== undefined && num > max) {
      return {
        severity: 'hint',
        message: `Must be at most ${max}`
      };
    }

    return null;
  },

  /**
   * Check if value matches a regular expression pattern
   * @param {string} path - Field path
   * @param {string} value - Value to check
   * @param {RegExp} pattern - Regular expression pattern
   * @param {string} [customMessage] - Custom error message (optional)
   * @returns {null|{severity: 'hint', message: string}} Null if valid, hint if invalid
   */
  pattern(path, value, pattern, customMessage) {
    // Empty values are allowed (field might be optional)
    if (!value) {
      return null;
    }

    if (!pattern.test(value)) {
      return {
        severity: 'hint',
        message: customMessage || 'Value has invalid format'
      };
    }

    return null;
  }
};
