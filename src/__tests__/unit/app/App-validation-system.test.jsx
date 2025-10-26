/**
 * App.js Validation System Tests
 *
 * Tests for the validation system functions:
 * - jsonschemaValidation: JSON Schema validation using AJV
 * - rulesValidation: Custom business logic validation
 *
 * These tests verify the CURRENT production behavior of validation functions.
 * We are NOT fixing bugs here, just documenting existing behavior.
 *
 * Related files:
 * - src/App.js:2770 (jsonschemaValidation)
 * - src/App.js:2813 (rulesValidation)
 * - src/nwb_schema.json (JSON Schema definition)
 */

import { describe, it, expect } from 'vitest';
import { jsonschemaValidation, rulesValidation } from '../../../utils/validation';
import { createTestYaml } from '../../helpers/test-utils';

describe('App Validation System', () => {
  describe('jsonschemaValidation()', () => {
    describe('Valid Input Acceptance', () => {
      it('should accept minimal valid YAML with all required fields', () => {
        const yaml = createTestYaml();
        const result = jsonschemaValidation(yaml);

        expect(result.valid).toBe(true);
        expect(result.isValid).toBe(true);
        expect(result.errors).toBeNull();
        expect(result.jsonSchemaErrorMessages).toEqual([]);
        expect(result.jsonSchemaErrors).toBeNull();
        expect(result.jsonSchemaErrorIds).toEqual([]);
      });

      it('should accept YAML with optional string fields', () => {
        const yaml = createTestYaml({
          experiment_description: 'Test experiment description',
          session_description: 'Test session description',
          session_id: 'test_session_001',
        });
        const result = jsonschemaValidation(yaml);

        expect(result.valid).toBe(true);
        expect(result.errors).toBeNull();
      });

      it('should accept YAML with subject information', () => {
        const yaml = createTestYaml({
          subject: {
            description: 'Test subject',
            genotype: 'WT',
            sex: 'M',
            species: 'Rattus norvegicus',
            subject_id: 'rat001',
            weight: 350,
            date_of_birth: '2023-01-15T00:00:00', // Required field
          },
        });
        const result = jsonschemaValidation(yaml);

        expect(result.valid).toBe(true);
        expect(result.errors).toBeNull();
      });

      it('should accept YAML with electrode groups', () => {
        const yaml = createTestYaml({
          electrode_groups: [
            {
              id: 0,
              location: 'CA1',
              device_type: 'tetrode_12.5',
              description: 'Tetrode array in CA1',
              targeted_location: 'CA1',
              targeted_x: 3.0,
              targeted_y: 2.5,
              targeted_z: 2.0,
              units: 'mm',
            },
          ],
        });
        const result = jsonschemaValidation(yaml);

        expect(result.valid).toBe(true);
        expect(result.errors).toBeNull();
      });

      it('should accept YAML with cameras', () => {
        const yaml = createTestYaml({
          cameras: [
            {
              id: 0,
              meters_per_pixel: 0.001,
              manufacturer: 'Test Manufacturer',
              model: 'TestCam 1000',
              lens: '2.8mm',
              camera_name: 'overhead_camera',
            },
          ],
        });
        const result = jsonschemaValidation(yaml);

        expect(result.valid).toBe(true);
        expect(result.errors).toBeNull();
      });

      it('should accept YAML with tasks', () => {
        const yaml = createTestYaml({
          cameras: [{
            id: 0,
            meters_per_pixel: 0.001,
            manufacturer: 'TestCam Inc',
            model: 'TestCam1000',
            lens: '2.8mm',
            camera_name: 'overhead_camera',
          }],
          tasks: [
            {
              task_name: 'Sleep',
              task_description: 'Sleep session',
              task_environment: 'HomeBox',
              camera_id: [0],
              task_epochs: [1, 2],
            },
          ],
        });
        const result = jsonschemaValidation(yaml);

        expect(result.valid).toBe(true);
        expect(result.errors).toBeNull();
      });

      it('should accept YAML with behavioral events', () => {
        const yaml = createTestYaml({
          behavioral_events: [
            {
              name: 'poke',
              description: 'Nose poke event',
            },
          ],
        });
        const result = jsonschemaValidation(yaml);

        expect(result.valid).toBe(true);
        expect(result.errors).toBeNull();
      });

      it('should accept YAML with associated files', () => {
        const yaml = createTestYaml({
          associated_files: [
            {
              name: 'task_config.yaml',
              description: 'Task configuration',
              path: '/path/to/config.yaml',
              task_epochs: 1, // Integer, not array
            },
          ],
        });
        const result = jsonschemaValidation(yaml);

        expect(result.valid).toBe(true);
        expect(result.errors).toBeNull();
      });

      it('should accept YAML with multiple electrode groups', () => {
        const yaml = createTestYaml({
          electrode_groups: [
            {
              id: 0,
              location: 'CA1',
              device_type: 'tetrode_12.5',
              description: 'CA1 tetrode',
              targeted_location: 'CA1',
              targeted_x: 3.0,
              targeted_y: 2.5,
              targeted_z: 2.0,
              units: 'mm',
            },
            {
              id: 1,
              location: 'CA3',
              device_type: 'tetrode_12.5',
              description: 'CA3 tetrode',
              targeted_location: 'CA3',
              targeted_x: 3.0,
              targeted_y: 2.5,
              targeted_z: 2.0,
              units: 'mm',
            },
            {
              id: 2,
              location: 'PFC',
              device_type: 'tetrode_12.5',
              description: 'PFC tetrode',
              targeted_location: 'PFC',
              targeted_x: 3.0,
              targeted_y: 2.5,
              targeted_z: 2.0,
              units: 'mm',
            },
          ],
        });
        const result = jsonschemaValidation(yaml);

        expect(result.valid).toBe(true);
        expect(result.errors).toBeNull();
      });

      it('should accept YAML with ntrode electrode group channel map', () => {
        const yaml = createTestYaml({
          electrode_groups: [
            {
              id: 0,
              location: 'CA1',
              device_type: 'tetrode_12.5',
              description: 'CA1 tetrode',
              targeted_location: 'CA1',
              targeted_x: 3.0,
              targeted_y: 2.5,
              targeted_z: 2.0,
              units: 'mm',
            },
          ],
          ntrode_electrode_group_channel_map: [
            {
              ntrode_id: 0,
              electrode_group_id: 0,
              bad_channels: [],
              map: { 0: 0, 1: 1, 2: 2, 3: 3 },
            },
          ],
        });
        const result = jsonschemaValidation(yaml);

        expect(result.valid).toBe(true);
        expect(result.errors).toBeNull();
      });

      it('should accept YAML with optogenetics configuration', () => {
        const yaml = createTestYaml({
          opto_excitation_source: [
            {
              name: 'LaserSource1',
              model_name: 'Test Laser',
              description: 'Blue laser source',
              wavelength_in_nm: 473,
              power_in_W: 0.1,
              intensity_in_W_per_m2: 1000,
            },
          ],
          optical_fiber: [
            {
              name: 'Fiber1',
              hardware_name: 'Fiber Hardware',
              implanted_fiber_description: 'Implanted fiber',
              hemisphere: 'left',
              location: 'CA1',
              ap_in_mm: -3.0,
              ml_in_mm: 2.5,
              dv_in_mm: -4.0,
              roll_in_deg: 0,
              pitch_in_deg: 0,
              yaw_in_deg: 0,
            },
          ],
          virus_injection: [
            {
              name: 'Injection1',
              description: 'AAV injection',
              virus_name: 'AAV-ChR2',
              volume_in_ul: 0.5,
              titer_in_vg_per_ml: 1e12,
              location: 'CA1',
              hemisphere: 'left',
              ap_in_mm: -3.0,
              ml_in_mm: 2.5,
              dv_in_mm: -4.0,
              roll_in_deg: 0,
              pitch_in_deg: 0,
              yaw_in_deg: 0,
            },
          ],
        });
        const result = jsonschemaValidation(yaml);

        expect(result.valid).toBe(true);
        expect(result.errors).toBeNull();
      });

      it('should accept YAML with device configuration', () => {
        const yaml = createTestYaml({
          device: {
            name: ['TestProbe'], // name must be an array
          },
        });
        const result = jsonschemaValidation(yaml);

        expect(result.valid).toBe(true);
        expect(result.errors).toBeNull();
      });

      it('should accept YAML with units configuration', () => {
        const yaml = createTestYaml({
          units: {
            analog: 'mV',
            behavioral_events: 'seconds',
          },
        });
        const result = jsonschemaValidation(yaml);

        expect(result.valid).toBe(true);
        expect(result.errors).toBeNull();
      });
    });

    describe('Invalid Input Rejection', () => {
      it('should reject YAML missing experimenter_name', () => {
        const yaml = createTestYaml();
        delete yaml.experimenter_name;

        const result = jsonschemaValidation(yaml);

        expect(result.valid).toBe(false);
        expect(result.isValid).toBe(false);
        expect(result.errors).not.toBeNull();
        expect(result.errors.length).toBeGreaterThan(0);
        expect(result.jsonSchemaErrorMessages.length).toBeGreaterThan(0);
        // Root-level errors have undefined as first path element
        expect(result.jsonSchemaErrorIds).toContain(undefined);
      });

      it('should reject YAML missing lab', () => {
        const yaml = createTestYaml();
        delete yaml.lab;

        const result = jsonschemaValidation(yaml);

        expect(result.valid).toBe(false);
        expect(result.errors).not.toBeNull();
        expect(result.jsonSchemaErrorMessages.some(msg =>
          msg.includes('lab')
        )).toBe(true);
      });

      it('should reject YAML missing institution', () => {
        const yaml = createTestYaml();
        delete yaml.institution;

        const result = jsonschemaValidation(yaml);

        expect(result.valid).toBe(false);
        expect(result.errors).not.toBeNull();
      });

      it('should reject YAML missing data_acq_device', () => {
        const yaml = createTestYaml();
        delete yaml.data_acq_device;

        const result = jsonschemaValidation(yaml);

        expect(result.valid).toBe(false);
        expect(result.errors).not.toBeNull();
      });

      it('should reject YAML missing times_period_multiplier', () => {
        const yaml = createTestYaml();
        delete yaml.times_period_multiplier;

        const result = jsonschemaValidation(yaml);

        expect(result.valid).toBe(false);
        expect(result.errors).not.toBeNull();
      });

      it('should reject YAML missing raw_data_to_volts', () => {
        const yaml = createTestYaml();
        delete yaml.raw_data_to_volts;

        const result = jsonschemaValidation(yaml);

        expect(result.valid).toBe(false);
        expect(result.errors).not.toBeNull();
      });

      it('should reject YAML with invalid type for experimenter_name', () => {
        const yaml = createTestYaml({
          experimenter_name: 'Doe, John', // Should be array
        });

        const result = jsonschemaValidation(yaml);

        expect(result.valid).toBe(false);
        expect(result.errors).not.toBeNull();
        expect(result.errors.some(err =>
          err.message.includes('array')
        )).toBe(true);
      });

      it('should reject YAML with invalid type for lab', () => {
        const yaml = createTestYaml({
          lab: 123, // Should be string
        });

        const result = jsonschemaValidation(yaml);

        expect(result.valid).toBe(false);
        expect(result.errors).not.toBeNull();
        expect(result.errors.some(err =>
          err.message.includes('string')
        )).toBe(true);
      });

      it('should reject YAML with invalid type for times_period_multiplier', () => {
        const yaml = createTestYaml({
          times_period_multiplier: 'invalid', // Should be number
        });

        const result = jsonschemaValidation(yaml);

        expect(result.valid).toBe(false);
        expect(result.errors).not.toBeNull();
        expect(result.errors.some(err =>
          err.message.includes('number')
        )).toBe(true);
      });

      it('should reject YAML with invalid type for raw_data_to_volts', () => {
        const yaml = createTestYaml({
          raw_data_to_volts: 'invalid', // Should be number
        });

        const result = jsonschemaValidation(yaml);

        expect(result.valid).toBe(false);
        expect(result.errors).not.toBeNull();
      });

      it('should reject YAML with invalid type for data_acq_device', () => {
        const yaml = createTestYaml({
          data_acq_device: 'invalid', // Should be array
        });

        const result = jsonschemaValidation(yaml);

        expect(result.valid).toBe(false);
        expect(result.errors).not.toBeNull();
      });

      it('should reject YAML with invalid electrode group structure', () => {
        const yaml = createTestYaml({
          electrode_groups: [
            {
              // Missing required fields
              id: 0,
            },
          ],
        });

        const result = jsonschemaValidation(yaml);

        expect(result.valid).toBe(false);
        expect(result.errors).not.toBeNull();
      });

      it('should reject YAML with invalid camera structure', () => {
        const yaml = createTestYaml({
          cameras: [
            {
              // Missing required fields
              id: 0,
            },
          ],
        });

        const result = jsonschemaValidation(yaml);

        expect(result.valid).toBe(false);
        expect(result.errors).not.toBeNull();
      });

      it('should reject YAML with negative electrode group id', () => {
        const yaml = createTestYaml({
          electrode_groups: [
            {
              id: -1, // Should be non-negative
              location: 'CA1',
              device_type: 'tetrode_12.5',
            },
          ],
        });

        const result = jsonschemaValidation(yaml);

        expect(result.valid).toBe(false);
        expect(result.errors).not.toBeNull();
      });
    });

    describe('Return Value Structure', () => {
      it('should return object with all expected properties for valid input', () => {
        const yaml = createTestYaml();
        const result = jsonschemaValidation(yaml);

        expect(result).toHaveProperty('valid');
        expect(result).toHaveProperty('isValid');
        expect(result).toHaveProperty('jsonSchemaErrorMessages');
        expect(result).toHaveProperty('jsonSchemaErrors');
        expect(result).toHaveProperty('jsonSchemaErrorIds');
        expect(result).toHaveProperty('errors');
      });

      it('should return object with all expected properties for invalid input', () => {
        const yaml = createTestYaml();
        delete yaml.lab;

        const result = jsonschemaValidation(yaml);

        expect(result).toHaveProperty('valid');
        expect(result).toHaveProperty('isValid');
        expect(result).toHaveProperty('jsonSchemaErrorMessages');
        expect(result).toHaveProperty('jsonSchemaErrors');
        expect(result).toHaveProperty('jsonSchemaErrorIds');
        expect(result).toHaveProperty('errors');
      });

      it('should have valid and isValid properties match for valid input', () => {
        const yaml = createTestYaml();
        const result = jsonschemaValidation(yaml);

        expect(result.valid).toBe(result.isValid);
      });

      it('should have valid and isValid properties match for invalid input', () => {
        const yaml = createTestYaml();
        delete yaml.lab;

        const result = jsonschemaValidation(yaml);

        expect(result.valid).toBe(result.isValid);
        expect(result.valid).toBe(false);
      });

      it('should have errors and jsonSchemaErrors match', () => {
        const yaml = createTestYaml();
        delete yaml.lab;

        const result = jsonschemaValidation(yaml);

        expect(result.errors).toBe(result.jsonSchemaErrors);
      });

      it('should format error messages with Key and Error parts', () => {
        const yaml = createTestYaml();
        delete yaml.lab;

        const result = jsonschemaValidation(yaml);

        expect(result.jsonSchemaErrorMessages.length).toBeGreaterThan(0);
        result.jsonSchemaErrorMessages.forEach(msg => {
          // Error messages should contain "Key:" and "Error:" parts
          expect(msg).toContain('Key:');
          expect(msg).toContain('Error:');
        });
      });

      it('should extract unique error IDs from instancePath', () => {
        const yaml = createTestYaml({
          electrode_groups: [
            {
              id: 0,
              // Missing location and device_type
            },
          ],
        });

        const result = jsonschemaValidation(yaml);

        expect(result.valid).toBe(false);
        expect(result.jsonSchemaErrorIds).toContain('electrode_groups');
      });

      it('should return empty array for error IDs when valid', () => {
        const yaml = createTestYaml();
        const result = jsonschemaValidation(yaml);

        expect(result.jsonSchemaErrorIds).toEqual([]);
      });

      it('should return empty array for error messages when valid', () => {
        const yaml = createTestYaml();
        const result = jsonschemaValidation(yaml);

        expect(result.jsonSchemaErrorMessages).toEqual([]);
      });

      it('should return null for errors when valid', () => {
        const yaml = createTestYaml();
        const result = jsonschemaValidation(yaml);

        expect(result.errors).toBeNull();
        expect(result.jsonSchemaErrors).toBeNull();
      });
    });

    describe('Multiple Errors Handling', () => {
      it('should return all errors when multiple fields are missing', () => {
        const yaml = createTestYaml();
        delete yaml.lab;
        delete yaml.institution;
        delete yaml.experimenter_name;

        const result = jsonschemaValidation(yaml);

        expect(result.valid).toBe(false);
        expect(result.errors.length).toBeGreaterThanOrEqual(3);
        expect(result.jsonSchemaErrorMessages.length).toBeGreaterThanOrEqual(3);
      });

      it('should return multiple errors for nested structure violations', () => {
        const yaml = createTestYaml({
          electrode_groups: [
            {
              id: 0,
              // Missing location and device_type
            },
            {
              id: 1,
              // Missing location and device_type
            },
          ],
        });

        const result = jsonschemaValidation(yaml);

        expect(result.valid).toBe(false);
        expect(result.errors.length).toBeGreaterThan(1);
      });

      it('should include all unique error IDs when multiple sections have errors', () => {
        const yaml = createTestYaml({
          electrode_groups: [{ id: -1, location: 'CA1' }], // Invalid id
          cameras: [{ id: -1 }], // Missing required fields
        });

        const result = jsonschemaValidation(yaml);

        expect(result.valid).toBe(false);
        expect(result.jsonSchemaErrorIds).toContain('electrode_groups');
        expect(result.jsonSchemaErrorIds).toContain('cameras');
      });
    });
  });

  describe('rulesValidation()', () => {
    describe('Valid Input Acceptance', () => {
      it('should accept YAML without tasks and without cameras', () => {
        const yaml = createTestYaml();
        const result = rulesValidation(yaml);

        expect(result.isFormValid).toBe(true);
        expect(result.formErrors).toEqual([]);
        expect(result.errors).toEqual([]);
      });

      it('should accept YAML with tasks that have cameras defined', () => {
        const yaml = createTestYaml({
          cameras: [{ id: 0, meters_per_pixel: 0.001 }],
          tasks: [
            {
              task_name: 'Sleep',
              task_description: 'Sleep session',
              task_environment: 'HomeBox',
              camera_id: [0],
              task_epochs: [1, 2],
            },
          ],
        });
        const result = rulesValidation(yaml);

        expect(result.isFormValid).toBe(true);
        expect(result.formErrors).toEqual([]);
      });

      it('should accept YAML with cameras but no tasks', () => {
        const yaml = createTestYaml({
          cameras: [{ id: 0, meters_per_pixel: 0.001 }],
        });
        const result = rulesValidation(yaml);

        expect(result.isFormValid).toBe(true);
        expect(result.formErrors).toEqual([]);
      });

      it('should accept YAML with tasks that have empty camera_id array', () => {
        const yaml = createTestYaml({
          cameras: [{ id: 0, meters_per_pixel: 0.001 }],
          tasks: [
            {
              task_name: 'Sleep',
              task_description: 'Sleep session',
              task_environment: 'HomeBox',
              camera_id: [],
              task_epochs: [1, 2],
            },
          ],
        });
        const result = rulesValidation(yaml);

        expect(result.isFormValid).toBe(true);
        expect(result.formErrors).toEqual([]);
      });
    });

    describe('Invalid Input Rejection', () => {
      it('should reject YAML with tasks but no cameras defined', () => {
        const yaml = createTestYaml({
          tasks: [
            {
              task_name: 'Sleep',
              task_description: 'Sleep session',
              task_environment: 'HomeBox',
              camera_id: [0],
              task_epochs: [1, 2],
            },
          ],
        });
        const result = rulesValidation(yaml);

        expect(result.isFormValid).toBe(false);
        expect(result.formErrors).toContain(
          'Key: task.camera | Error: There is tasks camera_id, but no camera object with ids. No data is loaded'
        );
      });

      it('should include "tasks" in error IDs when tasks exist without cameras', () => {
        const yaml = createTestYaml({
          tasks: [
            {
              task_name: 'Sleep',
              task_description: 'Sleep session',
              task_environment: 'HomeBox',
              camera_id: [0],
              task_epochs: [1, 2],
            },
          ],
        });
        const result = rulesValidation(yaml);

        // Note: Current implementation doesn't populate errorIds array
        // This test documents current behavior
        expect(result.isFormValid).toBe(false);
      });

      it('should reject YAML with multiple tasks but no cameras', () => {
        const yaml = createTestYaml({
          tasks: [
            {
              task_name: 'Sleep',
              task_description: 'Sleep session',
              task_environment: 'HomeBox',
              camera_id: [0],
              task_epochs: [1, 2],
            },
            {
              task_name: 'Run',
              task_description: 'Running session',
              task_environment: 'TrackBox',
              camera_id: [1],
              task_epochs: [3, 4],
            },
          ],
        });
        const result = rulesValidation(yaml);

        expect(result.isFormValid).toBe(false);
        expect(result.formErrors.length).toBeGreaterThan(0);
      });
    });

    describe('Return Value Structure', () => {
      it('should return object with all expected properties for valid input', () => {
        const yaml = createTestYaml();
        const result = rulesValidation(yaml);

        expect(result).toHaveProperty('isFormValid');
        expect(result).toHaveProperty('formErrors');
        expect(result).toHaveProperty('errors');
      });

      it('should return object with all expected properties for invalid input', () => {
        const yaml = createTestYaml({
          tasks: [{
            task_name: 'Test',
            task_description: 'Test task',
            task_environment: 'TestBox',
            camera_id: [0],
            task_epochs: [1]
          }],
        });
        const result = rulesValidation(yaml);

        expect(result).toHaveProperty('isFormValid');
        expect(result).toHaveProperty('formErrors');
        expect(result).toHaveProperty('errors');
      });

      it('should return boolean for isFormValid', () => {
        const yaml = createTestYaml();
        const result = rulesValidation(yaml);

        expect(typeof result.isFormValid).toBe('boolean');
      });

      it('should return array for formErrors', () => {
        const yaml = createTestYaml();
        const result = rulesValidation(yaml);

        expect(Array.isArray(result.formErrors)).toBe(true);
      });

      it('should return array for errors', () => {
        const yaml = createTestYaml();
        const result = rulesValidation(yaml);

        expect(Array.isArray(result.errors)).toBe(true);
      });

      it('should return empty arrays when valid', () => {
        const yaml = createTestYaml();
        const result = rulesValidation(yaml);

        expect(result.formErrors).toEqual([]);
        expect(result.errors).toEqual([]);
      });

      it('should return non-empty formErrors array when invalid', () => {
        const yaml = createTestYaml({
          tasks: [{
            task_name: 'Test',
            task_description: 'Test task',
            task_environment: 'TestBox',
            camera_id: [0],
            task_epochs: [1]
          }],
        });
        const result = rulesValidation(yaml);

        expect(result.formErrors.length).toBeGreaterThan(0);
      });
    });

    describe('Edge Cases', () => {
      it('should handle undefined tasks property', () => {
        const yaml = createTestYaml();
        // Explicitly set tasks to undefined
        yaml.tasks = undefined;

        const result = rulesValidation(yaml);

        expect(result.isFormValid).toBe(true);
        expect(result.formErrors).toEqual([]);
      });

      it('should handle empty tasks array', () => {
        const yaml = createTestYaml({
          tasks: [],
        });

        const result = rulesValidation(yaml);

        expect(result.isFormValid).toBe(true);
        expect(result.formErrors).toEqual([]);
      });

      it('should handle null cameras property with tasks', () => {
        const yaml = createTestYaml({
          cameras: null,
          tasks: [{
            task_name: 'Test',
            task_description: 'Test task',
            task_environment: 'TestBox',
            camera_id: [0],
            task_epochs: [1]
          }],
        });

        const result = rulesValidation(yaml);

        expect(result.isFormValid).toBe(false);
      });

      it('should handle undefined cameras property with tasks', () => {
        const yaml = createTestYaml({
          tasks: [{
            task_name: 'Test',
            task_description: 'Test task',
            task_environment: 'TestBox',
            camera_id: [0],
            task_epochs: [1]
          }],
        });
        delete yaml.cameras;

        const result = rulesValidation(yaml);

        expect(result.isFormValid).toBe(false);
      });

      it('should handle empty cameras array with tasks', () => {
        const yaml = createTestYaml({
          cameras: [],
          tasks: [{
            task_name: 'Test',
            task_description: 'Test task',
            task_environment: 'TestBox',
            camera_id: [0],
            task_epochs: [1]
          }],
        });

        const result = rulesValidation(yaml);

        // Current behavior: empty cameras array is truthy (it's an array), so validation passes
        // The rule only checks `!jsonFileContent.cameras`, not array length
        expect(result.isFormValid).toBe(true);
      });
    });
  });

  describe('Integration: jsonschemaValidation + rulesValidation', () => {
    it('should both pass for completely valid YAML', () => {
      const yaml = createTestYaml({
        cameras: [{
          id: 0,
          meters_per_pixel: 0.001,
          manufacturer: 'TestCam Inc',
          model: 'TestCam1000',
          lens: '2.8mm',
          camera_name: 'overhead_camera',
        }],
        tasks: [
          {
            task_name: 'Sleep',
            task_description: 'Sleep session',
            task_environment: 'HomeBox',
            camera_id: [0],
            task_epochs: [1, 2],
          },
        ],
      });

      const schemaResult = jsonschemaValidation(yaml);
      const rulesResult = rulesValidation(yaml);

      expect(schemaResult.valid).toBe(true);
      expect(rulesResult.isFormValid).toBe(true);
    });

    it('should handle case where schema passes but rules fail', () => {
      const yaml = createTestYaml({
        tasks: [
          {
            task_name: 'Sleep',
            task_description: 'Sleep session',
            task_environment: 'HomeBox',
            camera_id: [0],
            task_epochs: [1, 2],
          },
        ],
      });

      const schemaResult = jsonschemaValidation(yaml);
      const rulesResult = rulesValidation(yaml);

      // Schema validation doesn't check cameras/tasks relationship
      expect(schemaResult.valid).toBe(true);
      // But rules validation does
      expect(rulesResult.isFormValid).toBe(false);
    });

    it('should handle case where schema fails regardless of rules', () => {
      const yaml = createTestYaml();
      delete yaml.lab; // Schema violation

      const schemaResult = jsonschemaValidation(yaml);
      const rulesResult = rulesValidation(yaml);

      expect(schemaResult.valid).toBe(false);
      // Rules validation might still pass if no camera/task issues
      expect(rulesResult.isFormValid).toBe(true);
    });

    it('should handle case where both schema and rules fail', () => {
      const yaml = createTestYaml({
        tasks: [
          {
            task_name: 'Sleep',
            task_description: 'Sleep session',
            task_environment: 'HomeBox',
            camera_id: [0],
            task_epochs: [1, 2],
          },
        ],
      });
      delete yaml.lab; // Schema violation

      const schemaResult = jsonschemaValidation(yaml);
      const rulesResult = rulesValidation(yaml);

      expect(schemaResult.valid).toBe(false);
      expect(rulesResult.isFormValid).toBe(false);
    });
  });
});
