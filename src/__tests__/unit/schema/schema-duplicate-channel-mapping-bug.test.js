/**
 * Tests for Hardware Channel Mapping Duplicate Value Bug (P2)
 *
 * BUG: The schema validates that map keys have integer values, but doesn't
 * validate that the VALUES are unique. This allows invalid hardware configurations
 * where multiple logical channels map to the same physical channel.
 *
 * Example invalid config:
 *   map: { '0': 5, '1': 5, '2': 7, '3': 8 }
 *         Both channel 0 and 1 map to physical channel 5 (INVALID!)
 *
 * Business Logic:
 * - Each logical channel (keys: 0,1,2,3) must map to a UNIQUE physical channel
 * - Duplicate physical channels would cause hardware conflicts
 * - This validation cannot be expressed in JSON Schema Draft 7
 * - Must be implemented in rulesValidation() custom logic
 *
 * Impact: Could allow configurations that crash trodes_to_nwb during conversion
 */

import { describe, it, expect } from 'vitest';
import YAML from 'yaml';
import fs from 'fs';
import path from 'path';
import { validate } from '../../../validation';

/**
 * Helper to load YAML fixtures
 * @param category
 * @param filename
 */
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

describe('BUG: Hardware Channel Mapping - Duplicate Values Not Detected', () => {
  describe('RED Phase: Verify bug exists (tests should FAIL)', () => {
    it('should reject ntrode map with duplicate channel values (both map to 5)', () => {
      // ARRANGE
      const formData = {
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
            units: 'um',
          },
        ],
        ntrode_electrode_group_channel_map: [
          {
            ntrode_id: 0,
            electrode_group_id: 0,
            bad_channels: [],
            // tetrode electrode ids are 0..3; channels 0 and 1 both map to 1 (DUPLICATE).
            // The Phase 6 partition rule also flags this broken map, so assert the
            // duplicate-channel message is present rather than an exact issue count.
            map: {
              '0': 1,
              '1': 1, // DUPLICATE - both 0 and 1 map to electrode 1
              '2': 2,
              '3': 3,
            },
          },
        ],
      };

      // ACT
      const allIssues = validate(formData);
      const rulesIssues = allIssues.filter(i => i.instancePath === undefined);
      const isFormValid = rulesIssues.length === 0;

      // ASSERT - Should detect duplicate channel mapping
      expect(isFormValid).toBe(false);
      expect(rulesIssues.some(i => /duplicate.*channel.*map/i.test(i.message))).toBe(true);
    });

    it('should reject ntrode map with three channels mapping to same value', () => {
      // ARRANGE
      const formData = {
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
            units: 'um',
          },
        ],
        ntrode_electrode_group_channel_map: [
          {
            ntrode_id: 0,
            electrode_group_id: 0,
            bad_channels: [],
            map: {
              '0': 3,
              '1': 3, // Three channels map to electrode 3 (INVALID!)
              '2': 3,
              '3': 0,
            },
          },
        ],
      };

      // ACT
      const allIssues = validate(formData);
      const rulesIssues = allIssues.filter(i => i.instancePath === undefined);
      const isFormValid = rulesIssues.length === 0;

      // ASSERT
      expect(isFormValid).toBe(false);
      expect(rulesIssues.some(i => /duplicate.*channel.*map/i.test(i.message))).toBe(true);
    });

    it('should reject when multiple ntrodes have duplicate mappings', () => {
      // ARRANGE
      const formData = {
        ...loadFixture('valid', 'minimal-valid.yml'),
        electrode_groups: [
          { id: 0, location: 'CA1', device_type: 'tetrode_12.5', description: 'Test electrode', targeted_location: 'CA1', targeted_x: 0, targeted_y: 0, targeted_z: 0, units: 'um' },
          { id: 1, location: 'CA1', device_type: 'tetrode_12.5', description: 'Test electrode', targeted_location: 'CA1', targeted_x: 0, targeted_y: 0, targeted_z: 0, units: 'um' },
        ],
        ntrode_electrode_group_channel_map: [
          {
            ntrode_id: 0,
            electrode_group_id: 0,
            bad_channels: [],
            map: {
              '0': 1,
              '1': 1, // Duplicate in first ntrode (in range 0..3)
              '2': 2,
              '3': 3,
            },
          },
          {
            ntrode_id: 1,
            electrode_group_id: 1,
            bad_channels: [],
            map: {
              '0': 0,
              '1': 2,
              '2': 2, // Duplicate in second ntrode (in range 0..3)
              '3': 3,
            },
          },
        ],
      };

      // ACT
      const allIssues = validate(formData);
      const rulesIssues = allIssues.filter(i => i.instancePath === undefined);
      const isFormValid = rulesIssues.length === 0;

      // ASSERT - Should detect duplicates in BOTH ntrodes
      expect(isFormValid).toBe(false);
      const messages = rulesIssues.map(i => i.message);
      expect(messages.some(m => /ntrode\s+0.*duplicate/i.test(m))).toBe(true);
      expect(messages.some(m => /ntrode\s+1.*duplicate/i.test(m))).toBe(true);
    });
  });

  describe('GREEN Phase: Verify valid configurations pass', () => {
    it('should accept ntrode map with all unique channel values', () => {
      // ARRANGE
      const formData = {
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
            units: 'um',
          },
        ],
        ntrode_electrode_group_channel_map: [
          {
            ntrode_id: 0,
            electrode_group_id: 0,
            bad_channels: [],
            map: {
              '0': 0,
              '1': 1,
              '2': 2,
              '3': 3,
            },
          },
        ],
      };

      // ACT
      const allIssues = validate(formData);
      const rulesIssues = allIssues.filter(i => i.instancePath === undefined);
      const isFormValid = rulesIssues.length === 0;

      // ASSERT
      expect(isFormValid).toBe(true);
      expect(rulesIssues.map(i => i.message)).toEqual([]);
    });

    it('should accept ntrode map with a non-sequential permutation of the probe electrode ids', () => {
      // ARRANGE
      const formData = {
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
            units: 'um',
          },
        ],
        ntrode_electrode_group_channel_map: [
          {
            ntrode_id: 0,
            electrode_group_id: 0,
            bad_channels: [],
            // A non-sequential but valid permutation of the tetrode's electrode ids 0..3.
            map: {
              '0': 3,
              '1': 1,
              '2': 2,
              '3': 0,
            },
          },
        ],
      };

      // ACT
      const allIssues = validate(formData);
      const rulesIssues = allIssues.filter(i => i.instancePath === undefined);
      const isFormValid = rulesIssues.length === 0;

      // ASSERT
      expect(isFormValid).toBe(true);
      expect(rulesIssues.map(i => i.message)).toEqual([]);
    });

    it('should accept multiple ntrodes each with unique mappings', () => {
      // ARRANGE
      const formData = {
        ...loadFixture('valid', 'minimal-valid.yml'),
        electrode_groups: [
          { id: 0, location: 'CA1', device_type: 'tetrode_12.5', description: 'Test electrode', targeted_location: 'CA1', targeted_x: 0, targeted_y: 0, targeted_z: 0, units: 'um' },
          { id: 1, location: 'CA1', device_type: 'tetrode_12.5', description: 'Test electrode', targeted_location: 'CA1', targeted_x: 0, targeted_y: 0, targeted_z: 0, units: 'um' },
        ],
        // Two independent tetrode probes → each resets electrode ids to 0..3.
        ntrode_electrode_group_channel_map: [
          {
            ntrode_id: 0,
            electrode_group_id: 0,
            bad_channels: [],
            map: {
              '0': 0,
              '1': 1,
              '2': 2,
              '3': 3,
            },
          },
          {
            ntrode_id: 1,
            electrode_group_id: 1,
            bad_channels: [],
            map: {
              '0': 0,
              '1': 1,
              '2': 2,
              '3': 3,
            },
          },
        ],
      };

      // ACT
      const allIssues = validate(formData);
      const rulesIssues = allIssues.filter(i => i.instancePath === undefined);
      const isFormValid = rulesIssues.length === 0;

      // ASSERT
      expect(isFormValid).toBe(true);
      expect(rulesIssues.map(i => i.message)).toEqual([]);
    });

    it('should accept empty ntrode_electrode_group_channel_map array', () => {
      // ARRANGE
      const formData = {
        ...loadFixture('valid', 'minimal-valid.yml'),
        ntrode_electrode_group_channel_map: [],
      };

      // ACT
      const allIssues = validate(formData);
      const rulesIssues = allIssues.filter(i => i.instancePath === undefined);
      const isFormValid = rulesIssues.length === 0;

      // ASSERT
      expect(isFormValid).toBe(true);
      expect(rulesIssues.map(i => i.message)).toEqual([]);
    });
  });

  describe('Edge Cases', () => {
    it('should handle 32-channel probe with all unique mappings', () => {
      // ARRANGE - 32-channel probe has more channels
      const map = {};
      for (let i = 0; i < 32; i++) {
        map[i.toString()] = i;
      }

      const formData = {
        ...loadFixture('valid', 'minimal-valid.yml'),
        electrode_groups: [
          {
            id: 0,
            location: 'CA1',
            device_type: 'A1x32-6mm-50-177-H32_21mm',
            description: 'Test electrode',
            targeted_location: 'CA1',
            targeted_x: 0,
            targeted_y: 0,
            targeted_z: 0,
            units: 'um',
          },
        ],
        ntrode_electrode_group_channel_map: [
          {
            ntrode_id: 0,
            electrode_group_id: 0,
            bad_channels: [],
            map,
          },
        ],
      };

      // ACT
      const allIssues = validate(formData);
      const rulesIssues = allIssues.filter(i => i.instancePath === undefined);
      const isFormValid = rulesIssues.length === 0;

      // ASSERT
      expect(isFormValid).toBe(true);
      expect(rulesIssues.map(i => i.message)).toEqual([]);
    });

    it('should reject 32-channel probe with one duplicate', () => {
      // ARRANGE
      const map = {};
      for (let i = 0; i < 32; i++) {
        map[i.toString()] = i;
      }
      map['31'] = 30; // Make last channel duplicate the second-to-last

      const formData = {
        ...loadFixture('valid', 'minimal-valid.yml'),
        electrode_groups: [
          {
            id: 0,
            location: 'CA1',
            device_type: 'A1x32-6mm-50-177-H32_21mm',
            description: 'Test electrode',
            targeted_location: 'CA1',
            targeted_x: 0,
            targeted_y: 0,
            targeted_z: 0,
            units: 'um',
          },
        ],
        ntrode_electrode_group_channel_map: [
          {
            ntrode_id: 0,
            electrode_group_id: 0,
            bad_channels: [],
            map,
          },
        ],
      };

      // ACT
      const allIssues = validate(formData);
      const rulesIssues = allIssues.filter(i => i.instancePath === undefined);
      const isFormValid = rulesIssues.length === 0;

      // ASSERT
      expect(isFormValid).toBe(false);
      expect(rulesIssues.some(i => /duplicate.*channel.*map/i.test(i.message))).toBe(true);
    });
  });
});
