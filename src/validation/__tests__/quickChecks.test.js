/**
 * Quick Checks Tests
 *
 * Tests for lightweight synchronous validation checks that provide instant
 * feedback while typing (debounced onChange, 250-400ms).
 *
 * Quick checks return null for valid values, or a hint object for invalid:
 * { severity: 'hint', message: string }
 *
 * This follows TDD - tests written FIRST, then implementation.
 */

import { describe, it, expect } from 'vitest';
import { quickChecks } from '../quickChecks';

describe('quickChecks', () => {
  describe('required()', () => {
    it('should return null for valid non-empty string', () => {
      const hint = quickChecks.required('experimenter_name', 'John Doe');
      expect(hint).toBeNull();
    });

    it('should return null for non-empty number', () => {
      const hint = quickChecks.required('subject.weight', 350);
      expect(hint).toBeNull();
    });

    it('should return null for boolean false', () => {
      const hint = quickChecks.required('some_boolean', false);
      expect(hint).toBeNull();
    });

    it('should return null for number zero', () => {
      const hint = quickChecks.required('cameras[0].id', 0);
      expect(hint).toBeNull();
    });

    it('should return hint for empty string', () => {
      const hint = quickChecks.required('lab', '');

      expect(hint).toMatchObject({
        severity: 'hint',
        message: 'This field is required'
      });
    });

    it('should return hint for whitespace-only string', () => {
      const hint = quickChecks.required('institution', '   ');

      expect(hint).toMatchObject({
        severity: 'hint',
        message: 'This field is required'
      });
    });

    it('should return hint for null', () => {
      const hint = quickChecks.required('data_acq_device', null);

      expect(hint).toMatchObject({
        severity: 'hint',
        message: 'This field is required'
      });
    });

    it('should return hint for undefined', () => {
      const hint = quickChecks.required('experimenter_name', undefined);

      expect(hint).toMatchObject({
        severity: 'hint',
        message: 'This field is required'
      });
    });
  });

  describe('dateFormat()', () => {
    it('should return null for valid ISO 8601 datetime', () => {
      const hint = quickChecks.dateFormat('session_start_time', '2023-06-22T14:30:00');
      expect(hint).toBeNull();
    });

    it('should return null for valid ISO 8601 with timezone', () => {
      const hint = quickChecks.dateFormat('session_start_time', '2023-06-22T14:30:00-07:00');
      expect(hint).toBeNull();
    });

    it('should return null for valid ISO 8601 with Z timezone', () => {
      const hint = quickChecks.dateFormat('session_start_time', '2023-06-22T14:30:00Z');
      expect(hint).toBeNull();
    });

    it('should return null for empty value (optional field)', () => {
      const hint = quickChecks.dateFormat('session_start_time', '');
      expect(hint).toBeNull();
    });

    it('should return null for null value', () => {
      const hint = quickChecks.dateFormat('session_start_time', null);
      expect(hint).toBeNull();
    });

    it('should allow invalid month (format check only, not semantic)', () => {
      // quickChecks only validates FORMAT, not semantic correctness
      // Month 13 has correct FORMAT (YYYY-MM-DD...) even if semantically invalid
      const hint = quickChecks.dateFormat('session_start_time', '2023-13-22T14:30:00');
      expect(hint).toBeNull(); // Format is correct, so no hint
    });

    it('should allow invalid day (format check only, not semantic)', () => {
      // quickChecks only validates FORMAT, not semantic correctness
      // Day 45 has correct FORMAT even if semantically invalid
      const hint = quickChecks.dateFormat('session_start_time', '2023-06-45T14:30:00');
      expect(hint).toBeNull(); // Format is correct, so no hint
    });

    it('should return hint for US format (MM/DD/YYYY)', () => {
      const hint = quickChecks.dateFormat('session_start_time', '06/22/2023');

      expect(hint).toMatchObject({
        severity: 'hint',
        message: expect.stringContaining('ISO 8601')
      });
    });

    it('should return hint for date without time', () => {
      const hint = quickChecks.dateFormat('session_start_time', '2023-06-22');

      expect(hint).toMatchObject({
        severity: 'hint',
        message: expect.stringContaining('ISO 8601')
      });
    });

    it('should include example format in message', () => {
      const hint = quickChecks.dateFormat('session_start_time', 'invalid');

      expect(hint.message).toMatch(/YYYY-MM-DD/);
      expect(hint.message).toMatch(/HH:MM:SS/);
    });
  });

  describe('enum()', () => {
    it('should return null for valid enum value', () => {
      const hint = quickChecks.enum('subject.sex', 'M', ['M', 'F', 'U']);
      expect(hint).toBeNull();
    });

    it('should return null for empty value (optional field)', () => {
      const hint = quickChecks.enum('subject.sex', '', ['M', 'F', 'U']);
      expect(hint).toBeNull();
    });

    it('should return null for null value', () => {
      const hint = quickChecks.enum('subject.sex', null, ['M', 'F', 'U']);
      expect(hint).toBeNull();
    });

    it('should return hint for invalid enum value', () => {
      const hint = quickChecks.enum('subject.sex', 'X', ['M', 'F', 'U']);

      expect(hint).toMatchObject({
        severity: 'hint',
        message: expect.stringContaining('Must be one of')
      });
    });

    it('should include valid values in message', () => {
      const hint = quickChecks.enum('subject.sex', 'invalid', ['M', 'F', 'U']);

      expect(hint.message).toContain('M');
      expect(hint.message).toContain('F');
      expect(hint.message).toContain('U');
    });

    it('should handle single valid value', () => {
      const hint = quickChecks.enum('some_field', 'wrong', ['only_option']);

      expect(hint).toMatchObject({
        severity: 'hint',
        message: expect.stringContaining('only_option')
      });
    });
  });

  describe('numberRange()', () => {
    it('should return null for valid number in range', () => {
      const hint = quickChecks.numberRange('subject.weight', 350, 0, 1000);
      expect(hint).toBeNull();
    });

    it('should return null for number at minimum', () => {
      const hint = quickChecks.numberRange('subject.weight', 0, 0, 1000);
      expect(hint).toBeNull();
    });

    it('should return null for number at maximum', () => {
      const hint = quickChecks.numberRange('subject.weight', 1000, 0, 1000);
      expect(hint).toBeNull();
    });

    it('should return null for empty string (optional field)', () => {
      const hint = quickChecks.numberRange('subject.weight', '', 0, 1000);
      expect(hint).toBeNull();
    });

    it('should return null for null value', () => {
      const hint = quickChecks.numberRange('subject.weight', null, 0, 1000);
      expect(hint).toBeNull();
    });

    it('should return null when no min/max specified', () => {
      const hint = quickChecks.numberRange('subject.weight', 9999);
      expect(hint).toBeNull();
    });

    it('should return hint for number below minimum', () => {
      const hint = quickChecks.numberRange('subject.weight', -10, 0, 1000);

      expect(hint).toMatchObject({
        severity: 'hint',
        message: expect.stringContaining('at least 0')
      });
    });

    it('should return hint for number above maximum', () => {
      const hint = quickChecks.numberRange('subject.weight', 2000, 0, 1000);

      expect(hint).toMatchObject({
        severity: 'hint',
        message: expect.stringContaining('at most 1000')
      });
    });

    it('should handle min only (no max)', () => {
      const hint = quickChecks.numberRange('subject.weight', -5, 0);

      expect(hint).toMatchObject({
        severity: 'hint',
        message: expect.stringContaining('at least 0')
      });
    });

    it('should handle max only (no min)', () => {
      const hint = quickChecks.numberRange('subject.weight', 1500, undefined, 1000);

      expect(hint).toMatchObject({
        severity: 'hint',
        message: expect.stringContaining('at most 1000')
      });
    });

    it('should handle string number inputs', () => {
      const hint = quickChecks.numberRange('subject.weight', '350', 0, 1000);
      expect(hint).toBeNull();
    });

    it('should ignore non-numeric strings', () => {
      const hint = quickChecks.numberRange('subject.weight', 'abc', 0, 1000);
      expect(hint).toBeNull(); // Not a number, so no range check
    });
  });

  describe('pattern()', () => {
    it('should return null for value matching pattern', () => {
      // Pattern: requires at least one non-whitespace character
      const hint = quickChecks.pattern('lab', 'Frank Lab', /^(.|\s)*\S(.|\s)*$/);
      expect(hint).toBeNull();
    });

    it('should return null for empty value (optional field)', () => {
      const hint = quickChecks.pattern('lab', '', /^.+$/);
      expect(hint).toBeNull();
    });

    it('should return null for null value', () => {
      const hint = quickChecks.pattern('lab', null, /^.+$/);
      expect(hint).toBeNull();
    });

    it('should return hint for value not matching pattern', () => {
      // Pattern: requires at least one non-whitespace character
      const hint = quickChecks.pattern('lab', '   ', /^(.|\s)*\S(.|\s)*$/);

      expect(hint).toMatchObject({
        severity: 'hint',
        message: expect.stringContaining('invalid format')
      });
    });

    it('should include custom message if provided', () => {
      const hint = quickChecks.pattern('email', 'invalid', /^.+@.+$/, 'Must be a valid email');

      expect(hint.message).toBe('Must be a valid email');
    });

    it('should use default message if no custom message', () => {
      const hint = quickChecks.pattern('lab', '!!!', /^[a-zA-Z]+$/);

      expect(hint).toMatchObject({
        severity: 'hint',
        message: expect.stringContaining('invalid format')
      });
    });
  });

  describe('Edge Cases', () => {
    it('should handle path parameter (currently unused)', () => {
      // Path is included for future features (e.g., field-specific messages)
      const hint = quickChecks.required('deeply.nested[0].field', '');
      expect(hint).toMatchObject({ severity: 'hint', message: expect.any(String) });
    });

    it('should handle array values for required check', () => {
      const hint = quickChecks.required('experimenter_name', ['John', 'Jane']);
      expect(hint).toBeNull(); // Non-empty array is valid
    });

    it('should handle empty array for required check', () => {
      const hint = quickChecks.required('experimenter_name', []);
      expect(hint).toMatchObject({ severity: 'hint' }); // Empty array treated as empty
    });

    it('should handle object values for required check', () => {
      const hint = quickChecks.required('subject', { species: 'Rat' });
      expect(hint).toBeNull(); // Non-empty object is valid
    });

    it('should handle empty object for required check', () => {
      const hint = quickChecks.required('subject', {});
      expect(hint).toMatchObject({ severity: 'hint' }); // Empty object treated as empty
    });
  });
});
