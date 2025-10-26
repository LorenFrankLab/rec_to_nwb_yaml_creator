/**
 * Fixture Verification Tests
 *
 * Verifies that all test fixtures behave as expected:
 * - Valid fixtures pass validation
 * - Invalid fixtures fail validation with expected errors
 * - Edge case fixtures pass validation
 */

import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import yaml from 'yaml';
import { validate } from '../../validation';

// Read fixture files
const fixturesDir = path.join(__dirname);

function loadFixture(category, filename) {
  const filePath = path.join(fixturesDir, category, filename);
  const content = fs.readFileSync(filePath, 'utf8');
  return yaml.parse(content);
}

describe('Fixture Verification', () => {
  describe('Valid Fixtures', () => {
    it('minimal-valid.yml should pass validation', () => {
      const data = loadFixture('valid', 'minimal-valid.yml');

      // Verify required fields present
      expect(data).toHaveProperty('experimenter_name');
      expect(data).toHaveProperty('lab');
      expect(data).toHaveProperty('institution');
      expect(data).toHaveProperty('data_acq_device');
      expect(data).toHaveProperty('times_period_multiplier');
      expect(data).toHaveProperty('raw_data_to_volts');

      // Verify no optional fields (truly minimal)
      expect(data).not.toHaveProperty('subject');
      expect(data).not.toHaveProperty('cameras');

      // Should pass validation
      expect(data).toBeValidYaml();
    });

    it('complete-valid.yml should pass validation', () => {
      const data = loadFixture('valid', 'complete-valid.yml');

      // Verify has required fields
      expect(data).toHaveProperty('experimenter_name');
      expect(data.experimenter_name).toHaveLength(2);

      // Verify has optional fields
      expect(data).toHaveProperty('subject');
      expect(data).toHaveProperty('cameras');
      expect(data).toHaveProperty('tasks');
      expect(data).toHaveProperty('electrode_groups');
      expect(data).toHaveProperty('ntrode_electrode_group_channel_map');

      // Verify realistic structure
      expect(data.cameras).toHaveLength(1);
      expect(data.tasks).toHaveLength(2);
      expect(data.electrode_groups).toHaveLength(2);
      expect(data.ntrode_electrode_group_channel_map).toHaveLength(2);

      // Verify realistic brain regions
      expect(data.electrode_groups[0].location).toBe('CA1');
      expect(data.electrode_groups[1].location).toBe('CA3');

      // Verify realistic device type
      expect(data.electrode_groups[0].device_type).toBe('tetrode_12.5');

      // Should pass validation
      expect(data).toBeValidYaml();
    });

    it('realistic-session.yml should pass validation', () => {
      const data = loadFixture('valid', 'realistic-session.yml');

      // Verify multi-tetrode setup
      expect(data.electrode_groups).toHaveLength(8);
      expect(data.ntrode_electrode_group_channel_map).toHaveLength(8);

      // Verify multi-region recording
      const locations = data.electrode_groups.map(eg => eg.location);
      expect(locations).toContain('CA1');
      expect(locations).toContain('CA3');
      expect(locations).toContain('PFC');

      // Verify sleep-behavior-sleep protocol
      expect(data.tasks).toHaveLength(3);
      expect(data.tasks[0].task_name).toBe('sleep');
      expect(data.tasks[1].task_name).toBe('w_alternation');
      expect(data.tasks[2].task_name).toBe('sleep');

      // Verify multi-camera setup
      expect(data.cameras).toHaveLength(2);

      // Verify behavioral events
      expect(data.behavioral_events).toHaveLength(3);

      // Verify bad channels present
      const badChannelsMap = data.ntrode_electrode_group_channel_map.find(
        ntrode => ntrode.bad_channels.length > 0
      );
      expect(badChannelsMap).toBeDefined();

      // Should pass validation
      expect(data).toBeValidYaml();
    });
  });

  describe('Invalid Fixtures', () => {
    it('missing-required-fields.yml should fail validation', () => {
      const data = loadFixture('invalid', 'missing-required-fields.yml');

      // Verify it's missing required fields
      expect(data).toHaveProperty('experimenter_name');
      expect(data).not.toHaveProperty('lab');
      expect(data).not.toHaveProperty('institution');
      expect(data).not.toHaveProperty('data_acq_device');

      // Should fail validation with missing required property error
      expect(data).toHaveValidationError('required');
    });

    it('invalid-types.yml should fail validation', () => {
      const data = loadFixture('invalid', 'invalid-types.yml');

      // Verify incorrect types are present
      expect(typeof data.times_period_multiplier).toBe('string');
      expect(typeof data.raw_data_to_volts).toBe('string');
      expect(data.cameras[0].id).toBe(1.5);
      expect(typeof data.cameras[0].meters_per_pixel).toBe('string');

      // Should fail validation with type error
      const issues = validate(data);
      const isValid = issues.length === 0;
      expect(isValid).toBe(false);
      expect(issues).toBeDefined();
      expect(issues.length).toBeGreaterThan(0);
      // Check that at least one error is about types
      const hasTypeError = issues.some(issue => issue.code === 'type');
      expect(hasTypeError).toBe(true);
    });

    it('schema-violations.yml should fail validation', () => {
      const data = loadFixture('invalid', 'schema-violations.yml');

      // Verify violations are present
      expect(data.experimenter_name).toHaveLength(0);  // minItems violation
      expect(data.lab).toBe('');  // pattern violation
      expect(data.cameras[0].meters_per_pixel).toBeLessThan(0);  // negative value
      expect(data.electrode_groups[0].location).toBe('');  // empty location

      // Should fail validation
      const issues = validate(data);
      const isValid = issues.length === 0;
      expect(isValid).toBe(false);
      expect(issues).toBeDefined();
      expect(issues.length).toBeGreaterThan(0);

      // Check we have expected types of errors
      const errorCodes = issues.map(issue => issue.code);
      // Should have pattern, minItems, or similar violations
      const hasSchemaViolation = errorCodes.some(code =>
        ['pattern', 'minItems', 'minimum', 'required'].includes(code)
      );
      expect(hasSchemaViolation).toBe(true);
    });
  });

  describe('Edge Cases', () => {
    it('unicode-strings.yml should pass validation', () => {
      const data = loadFixture('edge-cases', 'unicode-strings.yml');

      // Verify unicode characters present
      expect(data.experimenter_name[0]).toContain('Müller');
      expect(data.experimenter_name[1]).toContain('García');
      expect(data.lab).toContain('研究室');
      expect(data.experiment_description).toContain('🧠');

      // Should pass validation (UTF-8 support)
      expect(data).toBeValidYaml();
    });

    it('boundary-values.yml should pass validation', () => {
      const data = loadFixture('edge-cases', 'boundary-values.yml');

      // Verify extreme values present
      expect(data.lab).toBe('X');  // Single character
      expect(data.session_description.length).toBeGreaterThan(500);  // Very long
      expect(data.times_period_multiplier).toBe(0.000001);  // Very small
      expect(data.raw_data_to_volts).toBe(999999.999999);  // Very large
      expect(data.electrode_groups).toHaveLength(16);  // Many items

      // Verify all channels bad
      const allBad = data.ntrode_electrode_group_channel_map[0];
      expect(allBad.bad_channels).toEqual([0, 1, 2, 3]);

      // Should pass validation
      expect(data).toBeValidYaml();
    });

    it('empty-optional-arrays.yml should pass validation', () => {
      const data = loadFixture('edge-cases', 'empty-optional-arrays.yml');

      // Verify required fields present
      expect(data).toHaveProperty('experimenter_name');
      expect(data).toHaveProperty('lab');

      // Verify optional arrays are empty
      expect(data.cameras).toEqual([]);
      expect(data.tasks).toEqual([]);
      expect(data.electrode_groups).toEqual([]);
      expect(data.ntrode_electrode_group_channel_map).toEqual([]);
      expect(data.associated_files).toEqual([]);
      expect(data.associated_video_files).toEqual([]);

      // Verify optional objects omitted
      expect(data).not.toHaveProperty('subject');

      // Should pass validation
      expect(data).toBeValidYaml();
    });
  });

  describe('Fixture Integrity', () => {
    it('all valid fixtures have realistic device types', () => {
      const fixtures = [
        'complete-valid.yml',
        'realistic-session.yml',
      ];

      fixtures.forEach(filename => {
        const data = loadFixture('valid', filename);
        if (data.electrode_groups && data.electrode_groups.length > 0) {
          data.electrode_groups.forEach(eg => {
            if (eg.device_type) {
              // Should be a known device type
              expect(eg.device_type).toMatch(/tetrode_12\.5|128c-4s8mm6cm-20um-40um-sl|A1x32/);
            }
          });
        }
      });
    });

    it('all valid fixtures have realistic brain regions', () => {
      const fixtures = [
        'complete-valid.yml',
        'realistic-session.yml',
      ];

      const validRegions = ['CA1', 'CA2', 'CA3', 'DG', 'PFC', 'mPFC'];

      fixtures.forEach(filename => {
        const data = loadFixture('valid', filename);
        if (data.electrode_groups && data.electrode_groups.length > 0) {
          data.electrode_groups.forEach(eg => {
            if (eg.location) {
              // Should be a realistic brain region
              const isValid = validRegions.some(region =>
                eg.location.includes(region)
              );
              expect(isValid).toBe(true);
            }
          });
        }
      });
    });

    it('ntrode maps reference valid electrode groups', () => {
      const fixtures = [
        'complete-valid.yml',
        'realistic-session.yml',
      ];

      fixtures.forEach(filename => {
        const data = loadFixture('valid', filename);
        if (data.electrode_groups && data.ntrode_electrode_group_channel_map) {
          const egIds = data.electrode_groups.map(eg => eg.id);

          data.ntrode_electrode_group_channel_map.forEach(ntrode => {
            // Each ntrode should reference a valid electrode group
            expect(egIds).toContain(ntrode.electrode_group_id);
          });
        }
      });
    });

    it('tasks reference valid cameras', () => {
      const fixtures = [
        'complete-valid.yml',
        'realistic-session.yml',
      ];

      fixtures.forEach(filename => {
        const data = loadFixture('valid', filename);
        if (data.cameras && data.tasks) {
          const cameraIds = data.cameras.map(cam => cam.id);

          data.tasks.forEach(task => {
            if (task.camera_id) {
              task.camera_id.forEach(camId => {
                // Each camera reference should be valid
                expect(cameraIds).toContain(camId);
              });
            }
          });
        }
      });
    });
  });
});
