/**
 * @file Tests for encodeYaml function (legacy alias: convertObjectToYAMLString)
 * @description Phase 1, Week 6 - YAML Conversion Functions
 * @updated M1 - Tests updated to test io/yaml.js module
 *
 * Function location: src/io/yaml.js
 *
 * Purpose: Convert JavaScript object to YAML string using YAML.Document API
 *
 * Implementation:
 * ```javascript
 * export function encodeYaml(model) {
 *   const doc = new YAML.Document();
 *   doc.contents = model || {};
 *   return doc.toString();
 * }
 * ```
 *
 * Test Coverage: 8 tests documenting current behavior
 */

import { describe, it, expect } from 'vitest';
import YAML from 'yaml';
import { encodeYaml as convertObjectToYAMLString } from '../../../io/yaml';

/**
 * Note: Tests updated in Phase 3 to test actual exported function
 *
 * convertObjectToYAMLString is a thin wrapper around YAML.Document API.
 * These tests verify the function behaves correctly.
 */
describe('convertObjectToYAMLString()', () => {
  describe('Basic Conversions', () => {
    it('converts simple object to YAML string', () => {
      const input = { name: 'test', value: 123 };
      const result = convertObjectToYAMLString(input);

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

      const result = convertObjectToYAMLString(input);

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

      const result = convertObjectToYAMLString(input);

      // Should preserve arrays
      expect(result).toContain('experimenter:');
      expect(result).toContain('cameras:');
      // YAML arrays use "- " prefix
      expect(result).toContain('- Doe, John');
      expect(result).toContain('- Smith, Jane');
    });

    it('converts empty object to YAML string', () => {
      const input = {};

      const result = convertObjectToYAMLString(input);

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

      const result = convertObjectToYAMLString(input);

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

      const result = convertObjectToYAMLString(input);

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
      const result = convertObjectToYAMLString(input);

      expect(typeof result).toBe('string');
      expect(result).toContain('test: value');
    });

    it('uses toString() to get YAML string output', () => {
      const input = { name: 'test', count: 42 };
      const result = convertObjectToYAMLString(input);

      // Result should be a string
      expect(typeof result).toBe('string');

      // Result should be parseable back to original object
      const parsed = YAML.parse(result);
      expect(parsed).toEqual(input);
    });
  });
});

/**
 * Implementation Notes (from src/io/yaml.js):
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
 * - features/importExport.js - exportAll() to convert form data before download
 *
 * Integration:
 * - Called during YAML export workflow
 * - Result is passed to downloadYamlFile() for download
 *
 * Refactored History:
 * - Phase 1: Originally inline in App.js
 * - Phase 3: Extracted to src/utils/yamlExport.js
 * - M1: Migrated to src/io/yaml.js as encodeYaml()
 * - Legacy alias convertObjectToYAMLString maintained for backwards compatibility
 */
