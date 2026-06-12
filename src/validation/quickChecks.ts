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
 * A quick-check outcome: a lightweight feedback hint, or `null` when the value is valid. The
 * `severity` is `'hint'` from these checks; {@link module:validation/useQuickChecks} escalates it to
 * `'error'` on blur, so the field is widened to `'hint' | 'error'`.
 */
export interface QuickCheckResult {
  severity: 'hint' | 'error';
  message: string;
}

/**
 * Check if a value is considered "empty" for required field validation
 * @param value - Value to check
 * @returns True if value is empty/null/undefined/whitespace
 */
function isEmpty(value: unknown): boolean {
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
 * Check if a value should be treated as "not provided" for optional field validation.
 * Standardized helper for consistent empty-value handling across all checks
 * @param value - Value to check
 * @returns True if value is null/undefined/empty string
 */
function isEmptyForOptionalField(value: unknown): boolean {
  if (value === null || value === undefined) {
    return true;
  }
  if (typeof value === 'string' && value.trim() === '') {
    return true;
  }
  return false;
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
  required(path: string, value: unknown): QuickCheckResult | null {
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
  dateFormat(path: string, value: unknown): QuickCheckResult | null {
    // Use standardized empty check
    if (isEmptyForOptionalField(value)) {
      return null;
    }

    // ISO 8601 format: YYYY-MM-DDTHH:MM:SS[.sss][Z|±HH:MM]
    const iso8601Pattern = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/;

    if (!iso8601Pattern.test(value as string)) {
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
  enum(path: string, value: unknown, validValues: unknown[]): QuickCheckResult | null {
    // Use standardized empty check
    if (isEmptyForOptionalField(value)) {
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
   * @param {string} [unit] - Unit to display (e.g., 'nm', 'mm', 'degrees')
   * @returns {null|{severity: 'hint', message: string}} Null if valid, hint if invalid
   */
  numberRange(
    path: string,
    value: unknown,
    min?: number,
    max?: number,
    unit?: string
  ): QuickCheckResult | null {
    // More explicit empty check that handles all cases correctly
    if (value === null || value === undefined || value === '') {
      return null;
    }

    const num = parseFloat(value as string);

    // If not a valid number, show immediate feedback
    if (isNaN(num)) {
      return {
        severity: 'hint',
        message: 'Must be a valid number'
      };
    }

    const unitSuffix = unit ? ` ${unit}` : '';

    if (min !== undefined && num < min) {
      return {
        severity: 'hint',
        message: `Must be at least ${min}${unitSuffix}`
      };
    }

    if (max !== undefined && num > max) {
      return {
        severity: 'hint',
        message: `Must be at most ${max}${unitSuffix}`
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
  pattern(
    path: string,
    value: unknown,
    pattern: RegExp,
    customMessage?: string
  ): QuickCheckResult | null {
    // Use standardized empty check for null/undefined/empty string
    // But validate whitespace-only strings (user provided a value, just invalid)
    if (value === null || value === undefined || value === '') {
      return null;
    }

    if (!pattern.test(value as string)) {
      return {
        severity: 'hint',
        message: customMessage || 'Value has invalid format'
      };
    }

    return null;
  }
};
