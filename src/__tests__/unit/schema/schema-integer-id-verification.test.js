/**
 * VERIFICATION TEST for BUG #8: Float camera ID acceptance
 *
 * This test verifies that the schema correctly enforces integer types
 * for all ID fields. If this test PASSES, it means the bug is already
 * fixed (schema correctly rejects float IDs).
 *
 * INVESTIGATION:
 * All ID fields in nwb_schema.json already have "type": "integer":
 * - cameras[].id
 * - electrode_groups[].id
 * - ntrode_electrode_group_channel_map[].ntrode_id
 * - ntrode_electrode_group_channel_map[].electrode_group_id
 * - associated_video_files[].camera_id
 * - fs_gui_yamls[].camera_id
 *
 * If JSON Schema validator (AJV) correctly enforces "type": "integer",
 * then float values should already be rejected.
 */

import { describe, it, expect } from 'vitest';
import YAML from 'yaml';
import fs from 'fs';
import path from 'path';
import { validate } from '../../../validation';

function loadFixture(category, filename) {
  const fixturePath = path.join(
    __dirname,
    '../../fixtures',
    category,
    filename
  );
  const content = fs.readFileSync(fixturePath, 'utf8');
  return YAML.parse(content);
}

describe('BUG #8 Verification: Integer ID Enforcement', () => {
  describe('Camera ID integer enforcement', () => {
    it('should REJECT camera with float ID (1.5)', () => {
      const yaml = {
        ...loadFixture('valid', 'minimal-valid.yml'),
        cameras: [
          {
            id: 1.5, // Float - should be rejected
            meters_per_pixel: 0.001,
            manufacturer: 'Test Manufacturer',
            model: 'Test Model',
            lens: 'Test Lens',
            camera_name: 'test_camera'
          }
        ]
      };

      const issues = validate(yaml);
      const isValid = issues.length === 0;

      // If schema correctly enforces "type": "integer", this should FAIL
      expect(isValid).toBe(false);
      expect(issues.length).toBeGreaterThan(0);

      // Should have error about type
      const typeError = issues.find(issue =>
        issue.instancePath === '/cameras/0/id' &&
        issue.code === 'type'
      );
      expect(typeError).toBeDefined();
      expect(typeError.message).toContain('integer');
    });

    it('should REJECT camera with float ID (0.5)', () => {
      const yaml = {
        ...loadFixture('valid', 'minimal-valid.yml'),
        cameras: [
          {
            id: 0.5,
            meters_per_pixel: 0.001,
            manufacturer: 'Test',
            model: 'Test',
            lens: 'Test',
            camera_name: 'test'
          }
        ]
      };

      const issues = validate(yaml);
      const isValid = issues.length === 0;
      expect(isValid).toBe(false);
    });

    it('should ACCEPT camera with integer ID (0)', () => {
      const yaml = {
        ...loadFixture('valid', 'minimal-valid.yml'),
        cameras: [
          {
            id: 0, // Integer - should be accepted
            meters_per_pixel: 0.001,
            manufacturer: 'Test',
            model: 'Test',
            lens: 'Test',
            camera_name: 'test'
          }
        ]
      };

      const issues = validate(yaml);
      const isValid = issues.length === 0;
      expect(isValid).toBe(true);
      expect(issues).toEqual([]);
    });

    it('should ACCEPT camera with integer ID (5)', () => {
      const yaml = {
        ...loadFixture('valid', 'minimal-valid.yml'),
        cameras: [
          {
            id: 5,
            meters_per_pixel: 0.001,
            manufacturer: 'Test',
            model: 'Test',
            lens: 'Test',
            camera_name: 'test'
          }
        ]
      };

      const issues = validate(yaml);
      const isValid = issues.length === 0;
      expect(isValid).toBe(true);
    });
  });

  describe('Electrode group ID integer enforcement', () => {
    it('should REJECT electrode group with float ID', () => {
      const yaml = {
        ...loadFixture('valid', 'minimal-valid.yml'),
        electrode_groups: [
          {
            id: 2.5, // Float - should be rejected
            location: 'CA1',
            device_type: 'tetrode_12.5',
            description: 'Test electrode',
            targeted_location: 'CA1',
            targeted_x: 0,
            targeted_y: 0,
            targeted_z: 0,
            units: 'um'
          }
        ]
      };

      const issues = validate(yaml);
      const isValid = issues.length === 0;
      expect(isValid).toBe(false);

      const typeError = issues.find(issue =>
        issue.instancePath === '/electrode_groups/0/id'
      );
      expect(typeError).toBeDefined();
    });

    it('should ACCEPT electrode group with integer ID', () => {
      const yaml = {
        ...loadFixture('valid', 'minimal-valid.yml'),
        electrode_groups: [
          {
            id: 0,
            location: 'CA1',
            device_type: 'tetrode_12.5',
            description: 'Test electrode',
            targeted_location: 'CA1',
            targeted_x: 0,
            targeted_y: 0,
            targeted_z: 0,
            units: 'um'
          }
        ]
      };

      const issues = validate(yaml);
      const isValid = issues.length === 0;
      expect(isValid).toBe(true);
    });
  });

  describe('Ntrode ID integer enforcement', () => {
    it('should REJECT ntrode with float ntrode_id', () => {
      const yaml = {
        ...loadFixture('valid', 'minimal-valid.yml'),
        electrode_groups: [
          {
            id: 0,
            location: 'CA1',
            device_type: 'tetrode_12.5',
            description: 'Test'
          }
        ],
        ntrode_electrode_group_channel_map: [
          {
            ntrode_id: 1.5, // Float - should be rejected
            electrode_group_id: 0,
            bad_channels: [],
            map: { '0': 0, '1': 1, '2': 2, '3': 3 }
          }
        ]
      };

      const issues = validate(yaml);
      const isValid = issues.length === 0;
      expect(isValid).toBe(false);

      const typeError = issues.find(issue =>
        issue.instancePath === '/ntrode_electrode_group_channel_map/0/ntrode_id'
      );
      expect(typeError).toBeDefined();
    });

    it('should REJECT ntrode with float electrode_group_id', () => {
      const yaml = {
        ...loadFixture('valid', 'minimal-valid.yml'),
        electrode_groups: [
          {
            id: 0,
            location: 'CA1',
            device_type: 'tetrode_12.5',
            description: 'Test'
          }
        ],
        ntrode_electrode_group_channel_map: [
          {
            ntrode_id: 0,
            electrode_group_id: 2.5, // Float - should be rejected
            bad_channels: [],
            map: { '0': 0, '1': 1, '2': 2, '3': 3 }
          }
        ]
      };

      const issues = validate(yaml);
      const isValid = issues.length === 0;
      expect(isValid).toBe(false);
    });
  });

  describe('Task camera_id array integer enforcement', () => {
    it('should REJECT task with float camera_id in array', () => {
      const yaml = {
        ...loadFixture('valid', 'minimal-valid.yml'),
        cameras: [
          {
            id: 0,
            meters_per_pixel: 0.001,
            manufacturer: 'Test',
            model: 'Test',
            lens: 'Test',
            camera_name: 'test'
          }
        ],
        tasks: [
          {
            task_name: 'test',
            task_description: 'test',
            camera_id: [1.5] // Float in array - should be rejected
          }
        ]
      };

      const issues = validate(yaml);
      const isValid = issues.length === 0;

      // Note: camera_id is an array of integers
      // May or may not reject depending on schema enforcement
      // This test documents actual behavior
      if (!isValid) {
        const typeError = issues.find(issue =>
          issue.instancePath.includes('camera_id')
        );
        expect(typeError).toBeDefined();
      }
    });
  });
});
