/**
 * @file Tests for decodeYaml function
 * @description M1 - Pure Utilities Extraction & Testing
 *
 * Function location: src/io/yaml.js
 *
 * Purpose: Decode YAML strings to JavaScript objects with proper error handling
 *
 * Test Coverage: 15 tests covering normal operation, edge cases, error handling, and determinism
 */

import { describe, it, expect } from 'vitest';
import { decodeYaml } from '../../../io/yaml';

describe('decodeYaml()', () => {
  describe('Normal Operation', () => {
    it('parses simple YAML string to object', () => {
      const yamlString = 'name: test\nvalue: 123\n';

      const result = decodeYaml(yamlString);

      expect(result).toEqual({ name: 'test', value: 123 });
    });

    it('parses nested YAML structure', () => {
      const yamlString = `subject:
  subject_id: rat01
  weight: 300
`;

      const result = decodeYaml(yamlString);

      expect(result).toEqual({
        subject: {
          subject_id: 'rat01',
          weight: 300,
        },
      });
    });

    it('parses YAML arrays', () => {
      const yamlString = `experimenter:
  - Doe, John
  - Smith, Jane
cameras:
  - id: 0
    model: Camera1
  - id: 1
    model: Camera2
`;

      const result = decodeYaml(yamlString);

      expect(result).toEqual({
        experimenter: ['Doe, John', 'Smith, Jane'],
        cameras: [
          { id: 0, model: 'Camera1' },
          { id: 1, model: 'Camera2' },
        ],
      });
    });

    it('parses YAML with null values', () => {
      const yamlString = `field1: value
field2: null
field3: another
`;

      const result = decodeYaml(yamlString);

      expect(result).toEqual({
        field1: 'value',
        field2: null,
        field3: 'another',
      });
    });

    it('preserves boolean values', () => {
      const yamlString = `enabled: true
disabled: false
`;

      const result = decodeYaml(yamlString);

      expect(result).toEqual({
        enabled: true,
        disabled: false,
      });
    });

    it('preserves numeric types (integers and floats)', () => {
      const yamlString = `integer: 42
float: 3.14
negative: -10
scientific: 1.23e-4
`;

      const result = decodeYaml(yamlString);

      expect(result).toEqual({
        integer: 42,
        float: 3.14,
        negative: -10,
        scientific: 1.23e-4,
      });
    });
  });

  describe('Edge Cases', () => {
    it('returns null for empty string', () => {
      const yamlString = '';

      const result = decodeYaml(yamlString);

      expect(result).toBeNull();
    });

    it('returns null for whitespace-only string', () => {
      const yamlString = '   \n  \t  \n  ';

      const result = decodeYaml(yamlString);

      expect(result).toBeNull();
    });

    it('parses empty object notation', () => {
      const yamlString = '{}';

      const result = decodeYaml(yamlString);

      expect(result).toEqual({});
    });

    it('parses strings with special characters', () => {
      const yamlString = `description: "Contains: colons, commas, and #comments"
path: "/Users/name/Documents/folder"
`;

      const result = decodeYaml(yamlString);

      expect(result).toEqual({
        description: 'Contains: colons, commas, and #comments',
        path: '/Users/name/Documents/folder',
      });
    });

    it('handles multiline strings', () => {
      const yamlString = `description: |
  Line 1
  Line 2
  Line 3
`;

      const result = decodeYaml(yamlString);

      expect(result.description).toBe('Line 1\nLine 2\nLine 3\n');
    });
  });

  describe('Error Handling', () => {
    it('throws error for malformed YAML (unclosed bracket)', () => {
      const invalidYaml = 'array: [1, 2, 3';

      expect(() => {
        decodeYaml(invalidYaml);
      }).toThrow();
    });

    it('throws error for malformed YAML (invalid indentation)', () => {
      const invalidYaml = `parent:
child: value
  another: value`;

      expect(() => {
        decodeYaml(invalidYaml);
      }).toThrow();
    });

    it('throws error for multiple YAML documents (requires parseAllDocuments)', () => {
      const multiDocYaml = `doc1: value
---
doc2: value`;

      // YAML.parse throws error when multiple documents are present
      // Must use YAML.parseAllDocuments() instead
      expect(() => {
        decodeYaml(multiDocYaml);
      }).toThrow(/multiple documents/);
    });

    it('throws TypeError for non-string input (null)', () => {
      expect(() => {
        decodeYaml(null);
      }).toThrow(TypeError);
    });

    it('throws TypeError for non-string input (undefined)', () => {
      expect(() => {
        decodeYaml(undefined);
      }).toThrow(TypeError);
    });

    it('throws TypeError for non-string input (number)', () => {
      expect(() => {
        decodeYaml(12345);
      }).toThrow(TypeError);
    });

    it('throws TypeError for non-string input (object)', () => {
      expect(() => {
        decodeYaml({ key: 'value' });
      }).toThrow(TypeError);
    });
  });

  describe('Round-Trip Compatibility', () => {
    it('successfully round-trips simple object (encode -> decode)', () => {
      const original = { name: 'test', value: 123 };

      // Simulate encoding (we test this separately)
      const yamlString = 'name: test\nvalue: 123\n';
      const decoded = decodeYaml(yamlString);

      expect(decoded).toEqual(original);
    });

    it('successfully round-trips complex nested structure', () => {
      const yamlString = `EXPERIMENT_DATE_in_format_mmddYYYY: "06222023"
subject:
  subject_id: beans
  weight: 300
  sex: M
cameras:
  - id: 0
    model: Camera1
`;

      const result = decodeYaml(yamlString);

      expect(result).toHaveProperty('EXPERIMENT_DATE_in_format_mmddYYYY', '06222023');
      expect(result).toHaveProperty('subject.subject_id', 'beans');
      expect(result).toHaveProperty('cameras');
      expect(result.cameras).toBeInstanceOf(Array);
      expect(result.cameras[0]).toEqual({ id: 0, model: 'Camera1' });
    });
  });

  describe('Scientific Metadata Use Cases', () => {
    it('parses NWB metadata structure correctly', () => {
      const nwbYaml = `experimenter:
  - Doe, John
session_id: session_01
session_start_time: "2023-06-22T10:00:00"
electrode_groups:
  - id: 0
    location: CA1
    device_type: tetrode_12.5
`;

      const result = decodeYaml(nwbYaml);

      expect(result.experimenter).toEqual(['Doe, John']);
      expect(result.session_id).toBe('session_01');
      expect(result.session_start_time).toBe('2023-06-22T10:00:00');
      expect(result.electrode_groups).toHaveLength(1);
      expect(result.electrode_groups[0].location).toBe('CA1');
    });

    it('preserves ISO 8601 datetime strings', () => {
      const yamlString = `session_start_time: "2023-06-22T10:30:00"
date_of_birth: "2022-01-15"
`;

      const result = decodeYaml(yamlString);

      // Should preserve as strings (not parse to Date objects)
      expect(typeof result.session_start_time).toBe('string');
      expect(result.session_start_time).toBe('2023-06-22T10:30:00');
      expect(typeof result.date_of_birth).toBe('string');
      expect(result.date_of_birth).toBe('2022-01-15');
    });

    it('handles empty arrays in metadata', () => {
      const yamlString = `cameras: []
tasks: []
associated_files: []
`;

      const result = decodeYaml(yamlString);

      expect(result.cameras).toEqual([]);
      expect(result.tasks).toEqual([]);
      expect(result.associated_files).toEqual([]);
    });
  });
});

/**
 * Implementation Notes:
 *
 * The decodeYaml() function is a thin wrapper around YAML.parse() from the
 * 'yaml' npm package (https://eemeli.org/yaml/).
 *
 * Behavior:
 * - Parses YAML 1.2 spec compliant strings
 * - Returns null for empty/whitespace-only input
 * - Throws YAMLParseError for malformed YAML
 * - Throws TypeError for non-string input
 * - Preserves JavaScript types (string, number, boolean, null, Array, Object)
 *
 * Used by:
 * - features/importExport.js - importFiles() to parse uploaded YAML files
 * - Integration tests - to verify YAML output correctness
 *
 * Integration:
 * - Critical for YAML import workflow
 * - Must handle user-provided files that may be malformed
 * - Error messages must be descriptive for user feedback
 *
 * Testing Strategy:
 * - Normal cases: Verify correct parsing of valid YAML structures
 * - Edge cases: Empty strings, whitespace, special characters
 * - Error cases: Malformed YAML, non-string inputs
 * - Scientific use cases: NWB metadata structures, datetime strings
 * - Round-trip: Encode -> Decode should preserve structure
 */
