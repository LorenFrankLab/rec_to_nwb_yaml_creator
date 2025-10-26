/**
 * TEST for Empty Array Validation (P2)
 *
 * Test-Driven Development (TDD) approach:
 * 1. Write failing test (RED)
 * 2. Fix schema (GREEN)
 * 3. Verify test passes (REFACTOR)
 *
 * BUG DESCRIPTION:
 * fs_gui_yamls[].epochs is marked as REQUIRED but allows empty arrays.
 * If a fs_gui yaml file is defined, it should apply to at least one epoch.
 *
 * ANALYSIS:
 * - Total array fields in schema: 19
 * - Fields with minItems: 4
 * - Fields WITHOUT minItems: 15
 * - Required arrays needing minItems:
 *   1. fs_gui_yamls[].epochs (REQUIRED, but allows empty - BUG!)
 *
 * CONFIRMED VALID (no minItems needed):
 * - tasks[].camera_id: A task can have NO cameras (user confirmed)
 * - tasks[].task_epochs: A task can span entire session (no specific epochs)
 * - ntrode_electrode_group_channel_map[].bad_channels: All channels can be good
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

describe('Empty Array Validation (P2)', () => {
  describe('fs_gui_yamls[].epochs empty array bug', () => {
    it('should REJECT fs_gui_yamls with empty epochs array', () => {
      // ARRANGE: Create YAML with fs_gui_yaml containing empty epochs
      const yaml = {
        ...loadFixture('valid', 'minimal-valid.yml'),
        fs_gui_yamls: [
          {
            name: 'test.yaml',
            power_in_mW: 5.0,
            epochs: [], // BUG: Currently accepted, should be rejected
            dio_output_name: 'Laser',
            camera_id: 0
          }
        ]
      };

      // ACT: Validate the YAML
      const issues = validate(yaml);
      const isValid = issues.length === 0;

      // ASSERT: Should REJECT empty epochs array (currently FAILS - bug exists)
      expect(isValid).toBe(false);
      expect(issues.length).toBeGreaterThan(0);
      expect(issues.some(err =>
        err.instancePath.includes('/fs_gui_yamls/0/epochs') &&
        err.code === 'minItems'
      )).toBe(true);
    });

    it('should ACCEPT fs_gui_yamls with one epoch', () => {
      // ARRANGE: Valid fs_gui_yaml with one epoch
      const yaml = {
        ...loadFixture('valid', 'minimal-valid.yml'),
        fs_gui_yamls: [
          {
            name: 'test.yaml',
            power_in_mW: 5.0,
            epochs: [1], // Valid: has at least one epoch
            dio_output_name: 'Laser',
            camera_id: 0
          }
        ]
      };

      // ACT
      const issues = validate(yaml);
      const isValid = issues.length === 0;

      // ASSERT: Should ACCEPT
      expect(isValid).toBe(true);
      expect(issues).toEqual([]);
    });

    it('should ACCEPT fs_gui_yamls with multiple epochs', () => {
      // ARRANGE: Valid fs_gui_yaml with multiple epochs
      const yaml = {
        ...loadFixture('valid', 'minimal-valid.yml'),
        fs_gui_yamls: [
          {
            name: 'test.yaml',
            power_in_mW: 5.0,
            epochs: [1, 2, 3], // Valid: multiple epochs
            dio_output_name: 'Laser',
            camera_id: 0
          }
        ]
      };

      // ACT
      const issues = validate(yaml);
      const isValid = issues.length === 0;

      // ASSERT: Should ACCEPT
      expect(isValid).toBe(true);
      expect(issues).toEqual([]);
    });
  });

  describe('Arrays that SHOULD allow empty (verification)', () => {
    it('should ACCEPT tasks with empty camera_id array', () => {
      // ARRANGE: Task can have no cameras (user confirmed)
      const yaml = {
        ...loadFixture('valid', 'minimal-valid.yml'),
        tasks: [
          {
            task_name: 'Test Task',
            task_description: 'A task without cameras',
            task_environment: 'Home cage',
            camera_id: [], // Valid: tasks can have no cameras
            task_epochs: [1]
          }
        ]
      };

      // ACT
      const issues = validate(yaml);
      const isValid = issues.length === 0;

      // ASSERT: Should ACCEPT empty camera_id
      expect(isValid).toBe(true);
      expect(issues).toEqual([]);
    });

    it('should ACCEPT tasks with empty task_epochs array', () => {
      // ARRANGE: Task can span entire session (no specific epochs)
      const yaml = {
        ...loadFixture('valid', 'minimal-valid.yml'),
        tasks: [
          {
            task_name: 'Full Session Task',
            task_description: 'A task spanning entire session',
            task_environment: 'Home cage',
            camera_id: [], // Fixed: empty camera_id to avoid rules validation error
            task_epochs: [] // Valid: task spans entire session
          }
        ]
      };

      // ACT
      const issues = validate(yaml);
      const isValid = issues.length === 0;

      // ASSERT: Should ACCEPT empty task_epochs
      expect(isValid).toBe(true);
      expect(issues).toEqual([]);
    });

  });

  describe('Arrays with existing minItems: 1 (verification)', () => {
    it('should REJECT empty experimenter_name array', () => {
      // ARRANGE: experimenter_name already has minItems: 1
      const yaml = {
        ...loadFixture('valid', 'minimal-valid.yml'),
        experimenter_name: [] // Should be rejected (minItems: 1 exists)
      };

      // ACT
      const issues = validate(yaml);
      const isValid = issues.length === 0;

      // ASSERT: Should REJECT (verifies existing minItems works)
      expect(isValid).toBe(false);
      expect(issues.length).toBeGreaterThan(0);
    });

    it('should REJECT empty data_acq_device array', () => {
      // ARRANGE: data_acq_device already has minItems: 1
      const yaml = {
        ...loadFixture('valid', 'minimal-valid.yml'),
        data_acq_device: [] // Should be rejected (minItems: 1 exists)
      };

      // ACT
      const issues = validate(yaml);
      const isValid = issues.length === 0;

      // ASSERT: Should REJECT (verifies existing minItems works)
      expect(isValid).toBe(false);
      expect(issues.length).toBeGreaterThan(0);
    });
  });
});
