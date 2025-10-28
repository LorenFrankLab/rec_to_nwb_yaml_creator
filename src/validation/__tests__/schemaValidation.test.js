/**
 * Schema Validation Tests
 *
 * Tests for AJV JSON Schema validation with unified Issue[] format.
 *
 * TDD: Tests written FIRST, then implementation.
 */

import { describe, it, expect } from 'vitest';
import { schemaValidation } from '../schemaValidation';
import { createTestYaml } from '../../__tests__/helpers/test-utils';

describe('schemaValidation()', () => {
  describe('Valid Models', () => {
    it('should return empty array for minimal valid model', () => {
      const model = createTestYaml();
      const issues = schemaValidation(model);

      expect(issues).toEqual([]);
    });

    it('should return empty array for complete valid model', () => {
      const model = createTestYaml({
        experiment_description: 'Test experiment',
        session_description: 'Test session',
        session_id: 'session_001',
        subject: {
          description: 'Test subject',
          genotype: 'WT',
          sex: 'M',
          species: 'Rattus norvegicus',
          subject_id: 'rat001',
          weight: 350,
          date_of_birth: '2023-01-15T00:00:00',
        },
      });
      const issues = schemaValidation(model);

      expect(issues).toEqual([]);
    });
  });

  describe('Issue Format', () => {
    it('should return Issue objects with all required properties', () => {
      const model = { ...createTestYaml(), lab: '' };
      const issues = schemaValidation(model);

      expect(issues).toHaveLength(1);
      expect(issues[0]).toMatchObject({
        path: expect.any(String),
        code: expect.any(String),
        severity: 'error',
        message: expect.any(String),
        instancePath: expect.any(String),
        schemaPath: expect.any(String),
      });
    });

    it('should set severity to "error" for all schema violations', () => {
      const model = {
        ...createTestYaml(),
        lab: '',
        institution: '',
      };
      const issues = schemaValidation(model);

      expect(issues.every(i => i.severity === 'error')).toBe(true);
    });

    it('should use AJV keyword as code', () => {
      const model = { ...createTestYaml(), lab: '' };
      const issues = schemaValidation(model);

      expect(issues[0].code).toBe('pattern');
    });

    it('should preserve original AJV instancePath', () => {
      const model = { ...createTestYaml(), lab: '' };
      const issues = schemaValidation(model);

      expect(issues[0].instancePath).toBe('/lab');
    });

    it('should preserve original AJV schemaPath', () => {
      const model = { ...createTestYaml(), lab: '' };
      const issues = schemaValidation(model);

      expect(issues[0].schemaPath).toContain('#/properties/lab');
    });
  });

  describe('Path Normalization', () => {
    it('should normalize root path to simple field name', () => {
      const model = { ...createTestYaml(), lab: '' };
      const issues = schemaValidation(model);

      expect(issues[0].path).toBe('lab');
    });

    it('should normalize nested path to dot notation', () => {
      const model = createTestYaml({
        subject: { weight: -50 }
      });
      const issues = schemaValidation(model);

      const weightIssue = issues.find(i => i.instancePath === '/subject/weight');
      expect(weightIssue).toBeDefined();
      expect(weightIssue.path).toBe('subject.weight');
    });

    it('should normalize array path to bracket notation', () => {
      const model = createTestYaml({
        cameras: [{
          id: 0,
          meters_per_pixel: 'not_a_number',  // Type error
          manufacturer: 'Test Mfg',
          model: 'Test Model',
          lens: '2.8mm',
          camera_name: 'cam1'
        }]
      });
      const issues = schemaValidation(model);

      const cameraIssue = issues.find(i => i.instancePath.includes('/cameras/0'));
      expect(cameraIssue).toBeDefined();
      expect(cameraIssue.path).toMatch(/^cameras\[0\]/);
    });

    it('should normalize complex nested array paths', () => {
      const model = createTestYaml({
        electrode_groups: [{
          id: 0,
          location: '',  // Empty string pattern violation
          device_type: 'tetrode_12.5'
        }]
      });
      const issues = schemaValidation(model);

      const locationIssue = issues.find(i => i.instancePath.includes('/electrode_groups/0/location'));
      expect(locationIssue).toBeDefined();
      expect(locationIssue.path).toBe('electrode_groups[0].location');
    });
  });

  describe('Required Fields', () => {
    it('should detect missing experimenter_name', () => {
      const model = { ...createTestYaml(), experimenter_name: undefined };
      const issues = schemaValidation(model);

      expect(issues).toContainEqual(expect.objectContaining({
        path: 'experimenter_name',
        code: 'required',
        severity: 'error'
      }));
    });

    it('should detect missing lab', () => {
      const model = { ...createTestYaml(), lab: undefined };
      const issues = schemaValidation(model);

      expect(issues).toContainEqual(expect.objectContaining({
        path: 'lab',
        code: 'required'
      }));
    });

    it('should detect missing institution', () => {
      const model = { ...createTestYaml(), institution: undefined };
      const issues = schemaValidation(model);

      expect(issues).toContainEqual(expect.objectContaining({
        path: 'institution',
        code: 'required'
      }));
    });

    it('should detect missing data_acq_device', () => {
      const model = { ...createTestYaml(), data_acq_device: undefined };
      const issues = schemaValidation(model);

      expect(issues).toContainEqual(expect.objectContaining({
        path: 'data_acq_device',
        code: 'required'
      }));
    });
  });

  describe('Pattern Validation (Non-Empty Strings)', () => {
    it('should detect empty string in lab', () => {
      const model = { ...createTestYaml(), lab: '' };
      const issues = schemaValidation(model);

      expect(issues).toContainEqual(expect.objectContaining({
        path: 'lab',
        code: 'pattern',
        severity: 'error'
      }));
    });

    it('should detect whitespace-only string', () => {
      const model = { ...createTestYaml(), lab: '   ' };
      const issues = schemaValidation(model);

      // Pattern "^(.|\\s)*\\S(.|\\s)*$" requires at least one non-whitespace character
      // Whitespace-only should fail
      const hasWhitespaceIssue = issues.some(i =>
        i.path === 'lab' && i.code === 'pattern'
      );

      expect(hasWhitespaceIssue).toBe(true);
    });

    it('should accept non-empty string', () => {
      const model = createTestYaml({ lab: 'Test Lab' });
      const issues = schemaValidation(model);

      expect(issues.some(i => i.path === 'lab')).toBe(false);
    });
  });

  describe('Type Validation', () => {
    it('should detect wrong type for string field', () => {
      const model = { ...createTestYaml(), lab: 12345 };
      const issues = schemaValidation(model);

      expect(issues).toContainEqual(expect.objectContaining({
        path: 'lab',
        code: 'type',
        severity: 'error'
      }));
    });

    it('should detect wrong type for number field', () => {
      const model = createTestYaml({
        subject: { weight: 'not a number' }
      });
      const issues = schemaValidation(model);

      expect(issues).toContainEqual(expect.objectContaining({
        path: 'subject.weight',
        code: 'type'
      }));
    });

    it('should detect wrong type for object field', () => {
      const model = { ...createTestYaml(), subject: 'not an object' };
      const issues = schemaValidation(model);

      expect(issues).toContainEqual(expect.objectContaining({
        path: 'subject',
        code: 'type'
      }));
    });

    it('should detect wrong type for array field', () => {
      const model = { ...createTestYaml(), cameras: 'not an array' };
      const issues = schemaValidation(model);

      expect(issues).toContainEqual(expect.objectContaining({
        path: 'cameras',
        code: 'type'
      }));
    });
  });

  describe('Message Sanitization', () => {
    it('should sanitize empty string pattern message', () => {
      const model = { ...createTestYaml(), lab: '' };
      const issues = schemaValidation(model);

      const labIssue = issues.find(i => i.path === 'lab');
      expect(labIssue.message).toContain('cannot be empty');
      expect(labIssue.message).not.toContain('must match pattern');
    });

    it('should provide special message for date_of_birth', () => {
      const model = createTestYaml({
        subject: { date_of_birth: 'invalid-date' }
      });
      const issues = schemaValidation(model);

      const dobIssue = issues.find(i => i.path === 'subject.date_of_birth');
      if (dobIssue) {
        expect(dobIssue.message).toContain('ISO 8601');
      }
    });

    it('should preserve original message for other errors', () => {
      const model = { ...createTestYaml(), lab: 12345 };
      const issues = schemaValidation(model);

      const typeIssue = issues.find(i => i.code === 'type');
      expect(typeIssue).toBeDefined();
      expect(typeIssue.message).toBeTruthy();
      expect(typeIssue.message).not.toContain('cannot be empty');
    });
  });

  describe('Multiple Errors', () => {
    it('should return all errors when multiple fields invalid', () => {
      const model = {
        ...createTestYaml(),
        lab: '',
        institution: ''
      };
      const issues = schemaValidation(model);

      expect(issues.length).toBeGreaterThanOrEqual(2);
      expect(issues.filter(i => i.code === 'pattern').length).toBe(2);
    });

    it('should detect errors in nested objects', () => {
      const model = createTestYaml({
        subject: {
          weight: -50,  // Minimum violation
          sex: 'invalid',  // Enum violation (if enforced)
          date_of_birth: 'bad-date'  // Format violation
        }
      });
      const issues = schemaValidation(model);

      expect(issues.some(i => i.path.startsWith('subject'))).toBe(true);
    });

    it('should detect errors across arrays', () => {
      const model = createTestYaml({
        cameras: [
          { id: 0, meters_per_pixel: 0.001, camera_name: 'cam1' },
          { id: 1, meters_per_pixel: 'invalid', camera_name: 'cam2' },  // Type error
          { id: 2, meters_per_pixel: 0.002, camera_name: '' }  // Empty string pattern error
        ]
      });
      const issues = schemaValidation(model);

      expect(issues.some(i => i.path.includes('cameras[1]'))).toBe(true);
      expect(issues.some(i => i.path.includes('cameras[2]'))).toBe(true);
    });
  });

  describe('Edge Cases', () => {
    it('should handle null model', () => {
      const issues = schemaValidation(null);

      expect(Array.isArray(issues)).toBe(true);
      expect(issues.length).toBeGreaterThan(0); // Should have type error
    });

    it('should handle undefined model', () => {
      const issues = schemaValidation(undefined);

      expect(Array.isArray(issues)).toBe(true);
    });

    it('should handle empty object', () => {
      const issues = schemaValidation({});

      expect(Array.isArray(issues)).toBe(true);
      expect(issues.length).toBeGreaterThan(0); // Should have required field errors
    });

    it('should handle model with extra unknown properties', () => {
      const model = {
        ...createTestYaml(),
        unknown_field: 'should be ignored or flagged depending on schema'
      };
      const issues = schemaValidation(model);

      // Behavior depends on additionalProperties in schema
      expect(Array.isArray(issues)).toBe(true);
    });
  });

  describe('Schema Coverage', () => {
    it('should validate required top-level fields', () => {
      const model = {};
      const issues = schemaValidation(model);

      // These are the actual required fields from nwb_schema.json
      const requiredFields = ['experimenter_name', 'lab', 'institution', 'data_acq_device', 'times_period_multiplier', 'raw_data_to_volts'];
      requiredFields.forEach(field => {
        expect(issues.some(i => i.path === field && i.code === 'required')).toBe(true);
      });
    });

    it('should validate subject schema if present', () => {
      const model = createTestYaml({
        subject: { weight: 'not_a_number' }
      });
      const issues = schemaValidation(model);

      expect(issues.some(i => i.path.startsWith('subject'))).toBe(true);
    });

    it('should validate cameras schema if present', () => {
      const model = createTestYaml({
        cameras: [{ id: 'not_a_number' }]
      });
      const issues = schemaValidation(model);

      expect(issues.some(i => i.path.startsWith('cameras'))).toBe(true);
    });

    it('should validate electrode_groups schema if present', () => {
      const model = createTestYaml({
        electrode_groups: [{
          id: 0,
          location: '',  // Empty string violation
          device_type: 'tetrode_12.5'
        }]
      });
      const issues = schemaValidation(model);

      expect(issues.some(i => i.path.startsWith('electrode_groups'))).toBe(true);
    });
  });
});
