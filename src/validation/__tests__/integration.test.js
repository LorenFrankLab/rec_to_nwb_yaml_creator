/**
 * Unified Validation API Integration Tests
 *
 * Tests the new unified validation system with Issue[] return type.
 * This follows TDD - tests written FIRST, then implementation.
 *
 * Goal: Replace dual validation system (jsonschemaValidation + rulesValidation)
 * with single validate() function returning standardized Issue[] format.
 */

import { describe, it, expect } from 'vitest';
import { validate, validateField } from '../index';
import { createTestYaml } from '../../__tests__/helpers/test-utils';

describe('Unified Validation API', () => {
  describe('validate()', () => {
    describe('Valid Models', () => {
      it('should return empty array for minimal valid model', () => {
        const model = createTestYaml();
        const issues = validate(model);

        expect(issues).toEqual([]);
      });

      it('should return empty array for complete valid model with all optional fields', () => {
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
          electrode_groups: [{
            id: 0,
            location: 'CA1',
            device_type: 'tetrode_12.5',
            description: 'Tetrode in CA1',
            targeted_location: 'CA1',
            targeted_x: 3.0,
            targeted_y: 2.5,
            targeted_z: 2.0,
            units: 'mm',
          }],
          cameras: [{
            id: 0,
            meters_per_pixel: 0.001,
            manufacturer: 'Test Manufacturer',
            model: 'TestCam',
            lens: '2.8mm',
            camera_name: 'overhead',
          }],
        });
        const issues = validate(model);

        expect(issues).toEqual([]);
      });
    });

    describe('Issue Format', () => {
      it('should return Issue objects with required properties', () => {
        const model = { ...createTestYaml(), lab: '' };
        const issues = validate(model);

        expect(issues).toHaveLength(1);
        expect(issues[0]).toMatchObject({
          path: expect.any(String),
          code: expect.any(String),
          severity: expect.stringMatching(/^(error|warning)$/),
          message: expect.any(String),
        });
      });

      it('should include instancePath for AJV schema errors', () => {
        const model = { ...createTestYaml(), lab: '' };
        const issues = validate(model);

        const schemaIssue = issues.find(i => i.code === 'pattern');
        expect(schemaIssue).toBeDefined();
        expect(schemaIssue.instancePath).toBe('/lab');
      });

      it('should include schemaPath for AJV schema errors', () => {
        const model = { ...createTestYaml(), lab: '' };
        const issues = validate(model);

        const schemaIssue = issues.find(i => i.code === 'pattern');
        expect(schemaIssue).toBeDefined();
        expect(schemaIssue.schemaPath).toBeDefined();
      });
    });

    describe('Schema Validation Integration', () => {
      it('should detect missing required fields', () => {
        const model = { ...createTestYaml(), experimenter_name: undefined };
        const issues = validate(model);

        expect(issues.some(i => i.path === 'experimenter_name' && i.code === 'required')).toBe(true);
      });

      it('should detect empty string pattern violations', () => {
        const model = { ...createTestYaml(), lab: '' };
        const issues = validate(model);

        expect(issues.some(i =>
          i.path === 'lab' &&
          i.code === 'pattern' &&
          i.message.includes('cannot be empty')
        )).toBe(true);
      });

      it('should detect type violations', () => {
        const model = { ...createTestYaml(), lab: 12345 };
        const issues = validate(model);

        expect(issues.some(i =>
          i.path === 'lab' &&
          i.code === 'type'
        )).toBe(true);
      });

      it('should normalize nested paths to dot notation', () => {
        const model = createTestYaml({
          subject: { ...createTestYaml().subject, weight: -50 }
        });
        const issues = validate(model);

        const weightIssue = issues.find(i => i.path.includes('weight'));
        expect(weightIssue).toBeDefined();
        expect(weightIssue.path).toBe('subject.weight');
        expect(weightIssue.instancePath).toBe('/subject/weight');
      });

      it('should normalize array paths to bracket notation', () => {
        const model = createTestYaml({
          cameras: [{ id: null }]
        });
        const issues = validate(model);

        const cameraIssue = issues.find(i => i.path.includes('cameras'));
        expect(cameraIssue).toBeDefined();
        expect(cameraIssue.path).toMatch(/^cameras\[0\]/);
      });
    });

    describe('Rules Validation Integration', () => {
      it('should detect tasks without cameras (missing_camera)', () => {
        const model = {
          ...createTestYaml(),
          tasks: [{ camera_ids: [0] }],
          cameras: undefined
        };
        const issues = validate(model);

        expect(issues).toContainEqual(expect.objectContaining({
          path: 'tasks',
          code: 'missing_camera',
          severity: 'error',
          message: expect.stringContaining('camera')
        }));
      });

      it('should detect associated_video_files without cameras', () => {
        const model = {
          ...createTestYaml(),
          associated_video_files: [{ camera_id: 0, task_epochs: [1] }],
          cameras: undefined
        };
        const issues = validate(model);

        expect(issues).toContainEqual(expect.objectContaining({
          path: 'associated_video_files',
          code: 'missing_camera',
          severity: 'error'
        }));
      });

      it('should detect partial optogenetics configuration', () => {
        const model = {
          ...createTestYaml(),
          opto_excitation_source: [{ opto_excitation_source_name: 'LED' }],
          optical_fiber: undefined,
          virus_injection: undefined
        };
        const issues = validate(model);

        expect(issues).toContainEqual(expect.objectContaining({
          path: 'optogenetics',
          code: 'partial_configuration',
          severity: 'error',
          message: expect.stringContaining('All fields required')
        }));
      });

      it('should detect duplicate channel mappings', () => {
        const model = {
          ...createTestYaml(),
          ntrode_electrode_group_channel_map: [{
            ntrode_id: 1,
            electrode_group_id: 0,
            map: { 0: 5, 1: 5, 2: 6, 3: 7 }  // Duplicate: channel 5 mapped twice
          }]
        };
        const issues = validate(model);

        expect(issues).toContainEqual(expect.objectContaining({
          path: expect.stringContaining('ntrode_electrode_group_channel_map'),
          code: 'duplicate_channels',
          severity: 'error',
          message: expect.stringContaining('duplicate')
        }));
      });
    });

    describe('Combined Schema + Rules Validation', () => {
      it('should combine schema and rules validation issues', () => {
        const model = {
          ...createTestYaml(),
          lab: '',  // Schema violation: empty string
          tasks: [{ camera_ids: [0] }],  // Rules violation: no cameras defined
          cameras: undefined
        };
        const issues = validate(model);

        expect(issues.length).toBeGreaterThanOrEqual(2);
        expect(issues.some(i => i.code === 'pattern')).toBe(true);
        expect(issues.some(i => i.code === 'missing_camera')).toBe(true);
      });

      it('should detect multiple errors from both systems', () => {
        const model = {
          ...createTestYaml(),
          lab: '',  // Schema: empty string
          institution: 12345,  // Schema: wrong type
          tasks: [{ camera_ids: [0] }],  // Rules: missing cameras
          opto_excitation_source: [{ opto_excitation_source_name: 'LED' }],  // Rules: partial opto
          optical_fiber: undefined,
          virus_injection: undefined
        };
        const issues = validate(model);

        expect(issues.length).toBeGreaterThanOrEqual(4);
      });
    });

    describe('Deterministic Sorting', () => {
      it('should sort issues deterministically by path then code', () => {
        const model = {
          ...createTestYaml(),
          lab: '',
          institution: '',
        };

        const issues1 = validate(model);
        const issues2 = validate(model);

        expect(issues1).toEqual(issues2);
      });

      it('should sort nested paths correctly', () => {
        const model = {
          ...createTestYaml(),
          lab: '',
          subject: { weight: -50, sex: 'X' }
        };

        const issues = validate(model);
        const paths = issues.map(i => i.path);

        // Verify sorting: alphabetical by path
        const labIndex = paths.indexOf('lab');
        const subjectIndices = paths.filter(p => p.startsWith('subject')).map(p => paths.indexOf(p));

        // All subject paths should come after lab (alphabetical: 'l' < 's')
        expect(subjectIndices.every(i => i > labIndex)).toBe(true);
      });
    });

    describe('Edge Cases', () => {
      it('should handle null model gracefully', () => {
        expect(() => validate(null)).not.toThrow();
      });

      it('should handle undefined model gracefully', () => {
        expect(() => validate(undefined)).not.toThrow();
      });

      it('should handle empty object model', () => {
        const issues = validate({});
        expect(Array.isArray(issues)).toBe(true);
        expect(issues.length).toBeGreaterThan(0); // Should have required field errors
      });

      it('should handle deeply nested errors', () => {
        const model = createTestYaml({
          electrode_groups: [{
            id: 0,
            location: 'CA1',
            device_type: 'tetrode_12.5',
            targeted_x: 'not_a_number'  // Type error
          }]
        });
        const issues = validate(model);

        expect(issues.some(i => i.path.includes('electrode_groups'))).toBe(true);
      });
    });
  });

  describe('validateField()', () => {
    it('should return only issues for specified field path', () => {
      const model = {
        ...createTestYaml(),
        lab: '',
        institution: '',
        subject: { weight: -50 }
      };

      const labIssues = validateField(model, 'lab');

      expect(labIssues.every(i => i.path === 'lab')).toBe(true);
      expect(labIssues.length).toBeGreaterThan(0);
    });

    it('should return issues for field and its children', () => {
      const model = createTestYaml({
        subject: { weight: -50, sex: 'invalid' }
      });

      const subjectIssues = validateField(model, 'subject');

      expect(subjectIssues.every(i =>
        i.path === 'subject' || i.path.startsWith('subject.')
      )).toBe(true);
    });

    it('should return empty array for valid field', () => {
      const model = createTestYaml();
      const labIssues = validateField(model, 'lab');

      expect(labIssues).toEqual([]);
    });

    it('should handle array field paths', () => {
      const model = createTestYaml({
        cameras: [
          { id: 0, meters_per_pixel: 0.001, manufacturer: 'Test', model: 'Test', lens: '2.8mm', camera_name: 'cam1' },
          { id: null }  // Invalid
        ]
      });

      const camera1Issues = validateField(model, 'cameras[1]');
      expect(camera1Issues.length).toBeGreaterThan(0);
    });

    it('should not return issues for unrelated fields', () => {
      const model = {
        ...createTestYaml(),
        lab: '',
        institution: ''
      };

      const labIssues = validateField(model, 'lab');

      expect(labIssues.every(i => i.path === 'lab')).toBe(true);
      expect(labIssues.some(i => i.path === 'institution')).toBe(false);
    });
  });
});
