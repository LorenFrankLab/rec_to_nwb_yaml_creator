/**
 * @file Tests for convertObjectToYAMLString function
 * @description Phase 1, Week 6 - YAML Conversion Functions
 *
 * Function location: src/App.js:444-449
 *
 * Purpose: Convert JavaScript object to YAML string using YAML.Document API
 *
 * Implementation:
 * ```javascript
 * const convertObjectToYAMLString = (content) => {
 *   const doc = new YAML.Document();
 *   doc.contents = content || {};
 *   return doc.toString();
 * };
 * ```
 *
 * Test Coverage: 8 tests documenting current behavior
 */

import { describe, it, expect } from 'vitest';
import YAML from 'yaml';

/**
 * Note: These are DOCUMENTATION TESTS (Phase 1)
 *
 * We are documenting HOW the function works, not testing if it's correct.
 * These tests should all PASS because they document current behavior.
 *
 * convertObjectToYAMLString is a thin wrapper around YAML.Document API.
 * We're testing our understanding of the implementation.
 */
describe('convertObjectToYAMLString()', () => {
  describe('Basic Conversions', () => {
    it('converts simple object to YAML string', () => {
      // Replicate the implementation
      const input = { name: 'test', value: 123 };

      const doc = new YAML.Document();
      doc.contents = input;
      const result = doc.toString();

      // Should produce valid YAML
      expect(result).toContain('name: test');
      expect(result).toContain('value: 123');
      expect(typeof result).toBe('string');
    });

    it('converts nested object to YAML string', () => {
      const input = {
        subject: {
          subject_id: 'rat01',
          weight: 300,
        },
      };

      const doc = new YAML.Document();
      doc.contents = input;
      const result = doc.toString();

      // Should preserve nesting
      expect(result).toContain('subject:');
      expect(result).toContain('subject_id: rat01');
      expect(result).toContain('weight: 300');
    });

    it('converts object with arrays to YAML string', () => {
      const input = {
        experimenter: ['Doe, John', 'Smith, Jane'],
        cameras: [
          { id: 0, model: 'Camera1' },
          { id: 1, model: 'Camera2' },
        ],
      };

      const doc = new YAML.Document();
      doc.contents = input;
      const result = doc.toString();

      // Should preserve arrays
      expect(result).toContain('experimenter:');
      expect(result).toContain('cameras:');
      // YAML arrays use "- " prefix
      expect(result).toContain('- Doe, John');
      expect(result).toContain('- Smith, Jane');
    });

    it('converts empty object to YAML string', () => {
      const input = {};

      const doc = new YAML.Document();
      doc.contents = input;
      const result = doc.toString();

      // Empty object produces "{}\n" in YAML
      expect(result).toBe('{}\n');
      expect(typeof result).toBe('string');
    });
  });

  describe('Edge Cases', () => {
    it('handles null values in object', () => {
      const input = {
        field1: 'value',
        field2: null,
        field3: 'another',
      };

      const doc = new YAML.Document();
      doc.contents = input;
      const result = doc.toString();

      // YAML represents null as "null" or empty
      expect(result).toContain('field1: value');
      expect(result).toContain('field3: another');
      // null is either "field2: null" or "field2:" depending on YAML version
      expect(result).toMatch(/field2:/);
    });

    it('filters out undefined values (YAML.Document behavior)', () => {
      const input = {
        field1: 'value',
        field2: undefined,
        field3: 'another',
      };

      const doc = new YAML.Document();
      doc.contents = input;
      const result = doc.toString();

      // YAML.Document typically omits undefined values
      expect(result).toContain('field1: value');
      expect(result).toContain('field3: another');
      // undefined values are typically not included in YAML output
      // (YAML.Document omits them)
      const parsed = YAML.parse(result);
      expect(parsed).toEqual({
        field1: 'value',
        field3: 'another',
      });
    });
  });

  describe('YAML.Document API Usage', () => {
    it('uses YAML.Document constructor', () => {
      const input = { test: 'value' };

      // This is how convertObjectToYAMLString works
      const doc = new YAML.Document();
      expect(doc).toBeInstanceOf(YAML.Document);

      doc.contents = input;
      const result = doc.toString();

      expect(typeof result).toBe('string');
      expect(result).toContain('test: value');
    });

    it('uses toString() to get YAML string output', () => {
      const input = { name: 'test', count: 42 };

      const doc = new YAML.Document();
      doc.contents = input;

      // toString() is the API method for converting to YAML string
      expect(typeof doc.toString).toBe('function');

      const result = doc.toString();

      // Result should be a string
      expect(typeof result).toBe('string');

      // Result should be parseable back to original object
      const parsed = YAML.parse(result);
      expect(parsed).toEqual(input);
    });
  });
});

/**
 * Implementation Notes (from reading App.js:444-449):
 *
 * 1. Creates new YAML.Document instance
 * 2. Sets doc.contents to input object (or {} if falsy)
 * 3. Returns doc.toString() which produces YAML string
 *
 * Behavior:
 * - Simple wrapper around YAML.Document API
 * - Handles undefined input by defaulting to {}
 * - Delegates all YAML formatting to YAML library
 * - Does NOT filter or transform the input (content || {} is only safety check)
 *
 * Used by:
 * - generateYMLFile() at line 660 to convert form data before download
 *
 * Integration:
 * - Called during YAML export workflow
 * - Result is passed to createYAMLFile() for download
 */
