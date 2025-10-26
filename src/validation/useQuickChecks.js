/**
 * useQuickChecks - React Hook for Debounced Instant Feedback Validation
 *
 * Provides debounced validation hints while typing. Returns:
 * - hint: Current validation hint or null
 * - validate: Function to trigger validation (debounced)
 * - clear: Function to immediately clear hint
 *
 * @example
 * const { hint, validate } = useQuickChecks('required');
 *
 * <input
 *   onChange={(e) => validate('lab', e.target.value)}
 * />
 * {hint && <span className="hint">{hint.message}</span>}
 * // Note: Hints persist until field becomes valid (don't clear on focus)
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import { quickChecks } from './quickChecks';

/**
 * React hook for debounced quick validation checks
 *
 * @param {string} checkType - Type of validation ('required', 'dateFormat', 'enum', 'numberRange', 'pattern')
 * @param {object} options - Optional configuration
 * @param {number} options.debounceMs - Debounce delay in milliseconds (default: 300)
 * @param {Array} options.validValues - Valid values for enum check
 * @param {number} options.min - Minimum value for numberRange check
 * @param {number} options.max - Maximum value for numberRange check
 * @param {string} options.unit - Unit to display for numberRange (e.g., 'nm', 'mm', 'degrees')
 * @param {RegExp} options.pattern - Regular expression for pattern check
 * @param {string} options.patternMessage - Custom message for pattern check
 * @returns {{hint: object|null, validate: function, clear: function}}
 */
export function useQuickChecks(checkType, options = {}) {
  const {
    debounceMs = 300,
    validValues,
    min,
    max,
    unit,
    pattern,
    patternMessage
  } = options;

  const [hint, setHint] = useState(null);
  const timeoutRef = useRef(null);

  /**
   * Clear any pending validation and reset hint
   */
  const clear = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    setHint(null);
  }, []); // Empty deps: setState functions are stable and don't need to be included

  /**
   * Validate a field value (debounced)
   * @param {string} path - Field path
   * @param {any} value - Field value
   */
  const validate = useCallback((path, value) => {
    // Cancel any pending validation
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    // Schedule new validation
    timeoutRef.current = setTimeout(() => {
      let result = null;

      // Run the appropriate check
      switch (checkType) {
        case 'required':
          result = quickChecks.required(path, value);
          break;

        case 'dateFormat':
          result = quickChecks.dateFormat(path, value);
          break;

        case 'enum':
          // P1-2: Validate parameters before use
          if (validValues && Array.isArray(validValues) && validValues.length > 0) {
            result = quickChecks.enum(path, value, validValues);
          }
          break;

        case 'numberRange':
          result = quickChecks.numberRange(path, value, min, max, unit);
          break;

        case 'pattern':
          // P1-2: Validate pattern is a RegExp
          if (pattern && pattern instanceof RegExp) {
            result = quickChecks.pattern(path, value, pattern, patternMessage);
          }
          break;

        default:
          // Unknown check type - return null
          result = null;
      }

      setHint(result);
      timeoutRef.current = null; // P0-2: Clear ref after timeout executes
    }, debounceMs);
  }, [checkType, debounceMs, validValues, min, max, unit, pattern, patternMessage]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return {
    hint,
    validate,
    clear
  };
}
