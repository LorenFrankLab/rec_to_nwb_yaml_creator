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
import type { QuickCheckResult } from './quickChecks';

/** Optional configuration for {@link useQuickChecks}, by check type. */
export interface UseQuickChecksOptions {
  /** Debounce delay in milliseconds (default: 300). */
  debounceMs?: number;
  /** Valid values for the `enum` check. */
  validValues?: unknown[];
  /** Minimum value for the `numberRange` check. */
  min?: number;
  /** Maximum value for the `numberRange` check. */
  max?: number;
  /** Unit to display for `numberRange` (e.g. 'nm', 'mm', 'degrees'). */
  unit?: string;
  /** Regular expression for the `pattern` check. */
  pattern?: RegExp;
  /** Custom message for the `pattern` check. */
  patternMessage?: string;
}

/**
 * React hook for debounced quick validation checks
 *
 * @param checkType - Type of validation ('required', 'dateFormat', 'enum', 'numberRange', 'pattern')
 * @param options - Optional configuration
 * @returns The current hint plus the validate / validateOnBlur / clear controls.
 */
export function useQuickChecks(checkType: string, options: UseQuickChecksOptions = {}) {
  const {
    debounceMs = 300,
    validValues,
    min,
    max,
    unit,
    pattern,
    patternMessage
  } = options;

  const [hint, setHint] = useState<QuickCheckResult | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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
   * Run validation check (shared logic for validate and validateOnBlur)
   * @param path - Field path
   * @param value - Field value
   * @returns Validation result
   */
  const runValidation = useCallback((path: string, value: unknown): QuickCheckResult | null => {
    let result: QuickCheckResult | null = null;

    switch (checkType) {
      case 'required':
        result = quickChecks.required(path, value);
        break;

      case 'dateFormat':
        result = quickChecks.dateFormat(path, value);
        break;

      case 'enum':
        if (validValues && Array.isArray(validValues) && validValues.length > 0) {
          result = quickChecks.enum(path, value, validValues);
        }
        break;

      case 'numberRange':
        result = quickChecks.numberRange(path, value, min, max, unit);
        break;

      case 'pattern':
        if (pattern && pattern instanceof RegExp) {
          result = quickChecks.pattern(path, value, pattern, patternMessage);
        }
        break;

      default:
        result = null;
    }

    return result;
  }, [checkType, validValues, min, max, unit, pattern, patternMessage]);

  /**
   * Validate a field value (debounced, shows hints)
   * @param path - Field path
   * @param value - Field value
   */
  const validate = useCallback((path: string, value: unknown) => {
    // Cancel any pending validation
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    // Schedule new validation
    timeoutRef.current = setTimeout(() => {
      const result = runValidation(path, value);

      // Set as hint (not error)
      if (result) {
        result.severity = 'hint';
      }

      setHint(result);
      timeoutRef.current = null;
    }, debounceMs);
  }, [debounceMs, runValidation]);

  /**
   * Validate a field value on blur (immediate, escalates to error)
   * @param path - Field path
   * @param value - Field value
   */
  const validateOnBlur = useCallback((path: string, value: unknown) => {
    // Clear any pending debounced validation
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }

    // Run validation immediately (no debounce)
    const result = runValidation(path, value);

    // Escalate to error if invalid
    if (result) {
      result.severity = 'error';
    }

    setHint(result);
  }, [runValidation]);

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
    validateOnBlur,
    clear
  };
}
