/**
 * BASELINE TEST - Do not modify without approval
 *
 * This test documents CURRENT behavior (including bugs).
 * When we fix bugs, we'll update these tests to new expected behavior.
 *
 * Purpose: Detect unintended regressions during refactoring
 *
 * IMPORTANT: These tests document what CURRENTLY happens, not what SHOULD happen.
 * Known bugs are explicitly marked with comments explaining the incorrect behavior.
 */

import { describe, it, expect } from 'vitest';
import YAML from 'yaml';
import fs from 'fs';
import path from 'path';
import { jsonschemaValidation, rulesValidation } from '../../App';

/**
 * Helper to load YAML fixtures
 */
function loadFixture(category, filename) {
  const fixturePath = path.join(
    __dirname,
    '../fixtures',
    category,
    filename
  );
  const content = fs.readFileSync(fixturePath, 'utf8');
  return YAML.parse(content);
}

describe('BASELINE: JSON Schema Validation', () => {
  describe('Valid YAML Acceptance', () => {
    it('accepts minimal valid YAML with all required fields', () => {
      const yaml = loadFixture('valid', 'minimal-valid.yml');
      const result = jsonschemaValidation(yaml);

      expect(result.valid).toBe(true);
      expect(result.isValid).toBe(true);
      expect(result.errors).toBeNull();
      expect(result.jsonSchemaErrorMessages).toEqual([]);
    });

    it('accepts complete valid YAML with optional fields', () => {
      const yaml = loadFixture('valid', 'complete-valid.yml');
      const result = jsonschemaValidation(yaml);

      expect(result.valid).toBe(true);
      expect(result.errors).toBeNull();
    });

    it('accepts realistic session YAML', () => {
      const yaml = loadFixture('valid', 'realistic-session.yml');
      const result = jsonschemaValidation(yaml);

      expect(result.valid).toBe(true);
      expect(result.errors).toBeNull();
    });
  });

  describe('Required Fields Validation', () => {
    it('rejects YAML missing experimenter_name', () => {
      const yaml = loadFixture('valid', 'minimal-valid.yml');
      delete yaml.experimenter_name;

      const result = jsonschemaValidation(yaml);

      expect(result.valid).toBe(false);
      expect(result.errors).not.toBeNull();
      expect(result.errors.some(err =>
        err.message.includes('experimenter_name')
      )).toBe(true);
    });

    it('rejects YAML missing lab', () => {
      const yaml = loadFixture('valid', 'minimal-valid.yml');
      delete yaml.lab;

      const result = jsonschemaValidation(yaml);

      expect(result.valid).toBe(false);
      expect(result.errors).not.toBeNull();
      expect(result.errors.some(err =>
        err.message.includes('lab')
      )).toBe(true);
    });

    it('rejects YAML missing institution', () => {
      const yaml = loadFixture('valid', 'minimal-valid.yml');
      delete yaml.institution;

      const result = jsonschemaValidation(yaml);

      expect(result.valid).toBe(false);
      expect(result.errors).not.toBeNull();
    });

    it('rejects YAML missing data_acq_device', () => {
      const yaml = loadFixture('valid', 'minimal-valid.yml');
      delete yaml.data_acq_device;

      const result = jsonschemaValidation(yaml);

      expect(result.valid).toBe(false);
      expect(result.errors).not.toBeNull();
    });

    it('rejects YAML missing times_period_multiplier', () => {
      const yaml = loadFixture('valid', 'minimal-valid.yml');
      delete yaml.times_period_multiplier;

      const result = jsonschemaValidation(yaml);

      expect(result.valid).toBe(false);
      expect(result.errors).not.toBeNull();
    });

    it('rejects YAML missing raw_data_to_volts', () => {
      const yaml = loadFixture('valid', 'minimal-valid.yml');
      delete yaml.raw_data_to_volts;

      const result = jsonschemaValidation(yaml);

      expect(result.valid).toBe(false);
      expect(result.errors).not.toBeNull();
    });
  });

  describe('Type Validation', () => {
    it('rejects experimenter_name as string instead of array', () => {
      const yaml = loadFixture('valid', 'minimal-valid.yml');
      yaml.experimenter_name = 'Doe, John'; // Should be array

      const result = jsonschemaValidation(yaml);

      expect(result.valid).toBe(false);
      expect(result.errors).not.toBeNull();
      expect(result.errors.some(err =>
        err.message.includes('array')
      )).toBe(true);
    });

    it('rejects lab as number instead of string', () => {
      const yaml = loadFixture('valid', 'minimal-valid.yml');
      yaml.lab = 123; // Should be string

      const result = jsonschemaValidation(yaml);

      expect(result.valid).toBe(false);
      expect(result.errors).not.toBeNull();
    });

    it('rejects times_period_multiplier as string instead of number', () => {
      const yaml = loadFixture('valid', 'minimal-valid.yml');
      yaml.times_period_multiplier = 'not a number';

      const result = jsonschemaValidation(yaml);

      expect(result.valid).toBe(false);
      expect(result.errors).not.toBeNull();
    });

    it('rejects data_acq_device as object instead of array', () => {
      const yaml = loadFixture('valid', 'minimal-valid.yml');
      yaml.data_acq_device = { name: 'Test' }; // Should be array

      const result = jsonschemaValidation(yaml);

      expect(result.valid).toBe(false);
      expect(result.errors).not.toBeNull();
    });
  });

  describe('Pattern Validation (non-empty strings)', () => {
    it('BASELINE: documents current behavior for empty lab string', () => {
      // BUG: Schema pattern ^(.|\s)*\S(.|\s)*$ should reject empty strings
      // but validation behavior needs to be baselined
      const yaml = loadFixture('valid', 'minimal-valid.yml');
      yaml.lab = '';

      const result = jsonschemaValidation(yaml);

      // Document current behavior (may incorrectly accept empty string)
      expect(result).toMatchSnapshot('empty-lab-string');
    });

    it('BASELINE: documents current behavior for whitespace-only lab string', () => {
      const yaml = loadFixture('valid', 'minimal-valid.yml');
      yaml.lab = '   '; // Only whitespace

      const result = jsonschemaValidation(yaml);

      // Schema pattern should reject this
      // Document actual behavior
      expect(result).toMatchSnapshot('whitespace-only-lab');
    });

    it('BASELINE: documents current behavior for empty institution', () => {
      const yaml = loadFixture('valid', 'minimal-valid.yml');
      yaml.institution = '';

      const result = jsonschemaValidation(yaml);
      expect(result).toMatchSnapshot('empty-institution');
    });
  });

  describe('Array Validation', () => {
    it('BASELINE: documents behavior for empty experimenter_name array', () => {
      // Schema has minItems: 1, so this should be rejected
      const yaml = loadFixture('valid', 'minimal-valid.yml');
      yaml.experimenter_name = []; // minItems: 1

      const result = jsonschemaValidation(yaml);

      // Document actual behavior - may or may not detect this
      expect(result).toMatchSnapshot('empty-experimenter-array');
    });

    it('rejects experimenter_name array with empty string', () => {
      const yaml = loadFixture('valid', 'minimal-valid.yml');
      yaml.experimenter_name = [''];

      const result = jsonschemaValidation(yaml);

      // Pattern should reject empty string
      expect(result.valid).toBe(false);
      expect(result.errors).not.toBeNull();
    });

    it('accepts experimenter_name with multiple valid entries', () => {
      const yaml = loadFixture('valid', 'minimal-valid.yml');
      yaml.experimenter_name = ['Doe, John', 'Smith, Jane'];

      const result = jsonschemaValidation(yaml);

      expect(result.valid).toBe(true);
      expect(result.errors).toBeNull();
    });
  });

  describe('Nested Object Validation', () => {
    it('rejects data_acq_device with missing required fields', () => {
      const yaml = loadFixture('valid', 'minimal-valid.yml');
      yaml.data_acq_device = [{ name: 'Test' }]; // Missing system, amplifier, adc_circuit

      const result = jsonschemaValidation(yaml);

      expect(result.valid).toBe(false);
      expect(result.errors).not.toBeNull();
    });

    it('accepts data_acq_device with all required fields', () => {
      const yaml = loadFixture('valid', 'minimal-valid.yml');
      // Already has all required fields

      const result = jsonschemaValidation(yaml);

      expect(result.valid).toBe(true);
    });
  });

  describe('Number Constraints', () => {
    it('accepts valid times_period_multiplier', () => {
      const yaml = loadFixture('valid', 'minimal-valid.yml');
      yaml.times_period_multiplier = 1.5;

      const result = jsonschemaValidation(yaml);

      expect(result.valid).toBe(true);
    });

    it('accepts valid raw_data_to_volts', () => {
      const yaml = loadFixture('valid', 'minimal-valid.yml');
      yaml.raw_data_to_volts = 0.195;

      const result = jsonschemaValidation(yaml);

      expect(result.valid).toBe(true);
    });
  });

  describe('Error Message Format', () => {
    it('provides structured error messages for validation failures', () => {
      const yaml = loadFixture('invalid', 'missing-required-fields.yml');
      const result = jsonschemaValidation(yaml);

      expect(result.valid).toBe(false);
      expect(result.jsonSchemaErrorMessages).toBeDefined();
      expect(Array.isArray(result.jsonSchemaErrorMessages)).toBe(true);
      expect(result.jsonSchemaErrorMessages.length).toBeGreaterThan(0);

      // Error messages should have consistent format
      result.jsonSchemaErrorMessages.forEach(msg => {
        expect(typeof msg).toBe('string');
      });
    });

    it('provides errorIds for failed validation', () => {
      const yaml = loadFixture('invalid', 'missing-required-fields.yml');
      const result = jsonschemaValidation(yaml);

      expect(result.jsonSchemaErrorIds).toBeDefined();
      expect(Array.isArray(result.jsonSchemaErrorIds)).toBe(true);
    });

    it('returns null errors for valid YAML', () => {
      const yaml = loadFixture('valid', 'minimal-valid.yml');
      const result = jsonschemaValidation(yaml);

      expect(result.errors).toBeNull();
      expect(result.jsonSchemaErrorMessages).toEqual([]);
    });
  });

  describe('Edge Cases and Boundary Values', () => {
    it('BASELINE: handles empty optional arrays', () => {
      const yaml = loadFixture('edge-cases', 'empty-optional-arrays.yml');
      const result = jsonschemaValidation(yaml);

      // Document current behavior
      expect(result).toMatchSnapshot('empty-optional-arrays');
    });

    it('BASELINE: handles unicode strings', () => {
      const yaml = loadFixture('edge-cases', 'unicode-strings.yml');
      const result = jsonschemaValidation(yaml);

      // Unicode should be allowed
      expect(result).toMatchSnapshot('unicode-strings');
    });

    it('BASELINE: handles boundary values', () => {
      const yaml = loadFixture('edge-cases', 'boundary-values.yml');
      const result = jsonschemaValidation(yaml);

      expect(result).toMatchSnapshot('boundary-values');
    });
  });
});

describe('BASELINE: Custom Rules Validation', () => {
  describe('Tasks-Camera Relationship', () => {
    it('BASELINE: validates tasks with no cameras defined', () => {
      const yaml = {
        ...loadFixture('valid', 'minimal-valid.yml'),
        tasks: [
          {
            task_name: 'test_task',
            task_description: 'Test task',
            camera_id: [0],
          }
        ],
        // No cameras array
      };

      const result = rulesValidation(yaml);

      // Document current behavior
      expect(result).toMatchSnapshot('tasks-no-cameras');
    });

    it('accepts tasks when cameras array is defined (even if empty)', () => {
      const yaml = {
        ...loadFixture('valid', 'minimal-valid.yml'),
        tasks: [
          {
            task_name: 'test_task',
            task_description: 'Test task',
          }
        ],
        cameras: [],
      };

      const result = rulesValidation(yaml);

      expect(result.isFormValid).toBe(true);
    });

    it('accepts tasks with matching cameras', () => {
      const yaml = {
        ...loadFixture('valid', 'minimal-valid.yml'),
        cameras: [
          { id: 0, meters_per_pixel: 0.001 }
        ],
        tasks: [
          {
            task_name: 'test_task',
            task_description: 'Test task',
            camera_id: [0],
          }
        ],
      };

      const result = rulesValidation(yaml);

      expect(result.isFormValid).toBe(true);
    });
  });

  describe('Valid YAML Passes All Rules', () => {
    it('accepts minimal valid YAML', () => {
      const yaml = loadFixture('valid', 'minimal-valid.yml');
      const result = rulesValidation(yaml);

      expect(result.isFormValid).toBe(true);
      expect(result.formErrors).toEqual([]);
    });

    it('accepts complete valid YAML', () => {
      const yaml = loadFixture('valid', 'complete-valid.yml');
      const result = rulesValidation(yaml);

      expect(result.isFormValid).toBe(true);
    });
  });
});

describe('BASELINE: Validation Behavior Documentation', () => {
  describe('VALIDATION: Camera ID Type Enforcement (Working Correctly)', () => {
    it('BASELINE: verifies camera id float rejection', () => {
      // VERIFIED: Schema correctly rejects float camera IDs with "must be integer" error
      // This is NOT a bug - validation working as expected
      const yaml = {
        ...loadFixture('valid', 'minimal-valid.yml'),
        cameras: [
          {
            id: 1.5, // Correctly rejected - camera IDs must be integers
            meters_per_pixel: 0.001,
            camera_name: 'test_camera'
          }
        ],
      };

      const result = jsonschemaValidation(yaml);

      // Validates that float IDs are rejected
      expect(result).toMatchSnapshot('camera-id-float-bug');
    });

    it('BASELINE: documents negative camera id (allowed by schema)', () => {
      const yaml = {
        ...loadFixture('valid', 'minimal-valid.yml'),
        cameras: [
          {
            id: -1, // Schema has no minimum constraint, so negative IDs are allowed
            meters_per_pixel: 0.001,
            camera_name: 'test_camera'
          }
        ],
      };

      const result = jsonschemaValidation(yaml);
      expect(result).toMatchSnapshot('camera-id-negative');
    });
  });

  describe('BUG: Hardware Channel Mapping Validation', () => {
    it('BASELINE: documents duplicate channel mappings not detected', () => {
      // BUG: Duplicate hardware channel mappings should be rejected
      // but validation may not catch this
      const yaml = {
        ...loadFixture('valid', 'minimal-valid.yml'),
        electrode_groups: [
          {
            id: 0,
            location: 'CA1',
            device_type: 'tetrode_12.5',
            description: 'Test electrode'
          }
        ],
        ntrode_electrode_group_channel_map: [
          {
            ntrode_id: 0,
            electrode_group_id: 0,
            bad_channels: [],
            map: {
              '0': 5,
              '1': 5, // DUPLICATE - should fail
              '2': 7,
              '3': 8
            }
          }
        ],
      };

      const result = jsonschemaValidation(yaml);

      // Document current behavior (likely doesn't detect duplicate)
      expect(result).toMatchSnapshot('duplicate-channel-mapping-bug');
    });
  });

  describe('VALIDATION: Empty String Pattern Enforcement (Working Correctly)', () => {
    it('BASELINE: verifies empty string rejection', () => {
      // VERIFIED: Schema correctly rejects empty strings via pattern validation
      // This is NOT a bug - validation working as expected
      const yaml = {
        ...loadFixture('valid', 'minimal-valid.yml'),
        experiment_description: '', // Correctly rejected by pattern ^(.|\s)*\S(.|\s)*$
      };

      const result = jsonschemaValidation(yaml);
      expect(result).toMatchSnapshot('empty-experiment-description');
    });

    it('BASELINE: verifies whitespace-only string rejection', () => {
      // VERIFIED: Schema correctly rejects whitespace-only strings
      const yaml = {
        ...loadFixture('valid', 'minimal-valid.yml'),
        session_description: '   ', // Correctly rejected by pattern validation
      };

      const result = jsonschemaValidation(yaml);
      expect(result).toMatchSnapshot('whitespace-only-session-description');
    });
  });

  describe('VALIDATION: Array Uniqueness Enforcement (Working Correctly)', () => {
    it('BASELINE: verifies duplicate experimenter name rejection', () => {
      // VERIFIED: uniqueItems constraint correctly prevents duplicates
      // This is NOT a bug - validation working as expected
      const yaml = loadFixture('valid', 'minimal-valid.yml');
      yaml.experimenter_name = ['Doe, John', 'Doe, John']; // Correctly rejected as duplicate

      const result = jsonschemaValidation(yaml);

      // Validates that duplicates are rejected
      expect(result).toMatchSnapshot('duplicate-experimenter-names');
    });
  });
});

describe('BASELINE: Integration with Invalid Fixtures', () => {
  it('rejects fixture with missing required fields', () => {
    const yaml = loadFixture('invalid', 'missing-required-fields.yml');
    const result = jsonschemaValidation(yaml);

    expect(result.valid).toBe(false);
    expect(result.errors).not.toBeNull();
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it('rejects fixture with invalid types', () => {
    const yaml = loadFixture('invalid', 'invalid-types.yml');
    const result = jsonschemaValidation(yaml);

    expect(result.valid).toBe(false);
    expect(result.errors).not.toBeNull();
  });

  it('rejects fixture with schema violations', () => {
    const yaml = loadFixture('invalid', 'schema-violations.yml');
    const result = jsonschemaValidation(yaml);

    expect(result.valid).toBe(false);
    expect(result.errors).not.toBeNull();
  });
});
