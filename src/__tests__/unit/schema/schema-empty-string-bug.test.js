/**
 * TEST for BUG #6 (P1): Empty String Validation
 *
 * Test-Driven Development (TDD) approach:
 * 1. Write failing test (RED)
 * 2. Fix schema (GREEN)
 * 3. Verify test passes (REFACTOR)
 *
 * BUG DESCRIPTION:
 * Two string fields in nwb_schema.json do NOT have pattern constraints:
 * 1. virus_injection[].hemisphere - should reject empty strings
 * 2. opto_software - should reject empty strings
 *
 * These fields accept empty strings when they shouldn't, allowing
 * invalid metadata to pass validation.
 */

import { describe, it, expect } from 'vitest';
import YAML from 'yaml';
import fs from 'fs';
import path from 'path';
import { validate } from '../../../validation';

/**
 *
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

describe('BUG #6: Empty String Validation for Missing Pattern Fields', () => {
  describe('virus_injection.hemisphere empty string bug', () => {
    it('should REJECT virus_injection with empty hemisphere string', () => {
      // ARRANGE: Create YAML with virus_injection containing empty hemisphere
      const yaml = {
        ...loadFixture('valid', 'minimal-valid.yml'),
        virus_injection: [
          {
            name: 'Test Virus',
            description: 'Test injection',
            virus_name: 'AAV-ChR2',
            volume_in_ul: 0.5,
            titer_in_vg_per_ml: 1e12,
            location: 'CA1',
            hemisphere: '', // BUG: Currently accepted, should be rejected
            ap_in_mm: 1.5,
            ml_in_mm: 1.0,
            dv_in_mm: 2.0,
            roll_in_deg: 0,
            pitch_in_deg: 0,
            yaw_in_deg: 0
          }
        ]
      };

      // ACT: Validate the YAML
      const issues = validate(yaml);
      const isValid = issues.length === 0;

      // ASSERT: Should REJECT empty hemisphere (currently FAILS - bug exists)
      expect(isValid).toBe(false);
      expect(issues.length).toBeGreaterThan(0);
      expect(issues.some(issue =>
        issue.instancePath?.includes('hemisphere') &&
        issue.code === 'pattern'
      )).toBe(true);
    });

    it('should REJECT virus_injection with whitespace-only hemisphere', () => {
      const yaml = {
        ...loadFixture('valid', 'minimal-valid.yml'),
        virus_injection: [
          {
            name: 'Test Virus',
            description: 'Test injection',
            virus_name: 'AAV-ChR2',
            volume_in_ul: 0.5,
            titer_in_vg_per_ml: 1e12,
            location: 'CA1',
            hemisphere: '   ', // BUG: Whitespace-only should be rejected
            ap_in_mm: 1.5,
            ml_in_mm: 1.0,
            dv_in_mm: 2.0,
            roll_in_deg: 0,
            pitch_in_deg: 0,
            yaw_in_deg: 0
          }
        ]
      };

      const issues = validate(yaml);
      const isValid = issues.length === 0;

      // Should REJECT whitespace-only hemisphere
      expect(isValid).toBe(false);
      expect(issues.length).toBeGreaterThan(0);
    });

    it('should ACCEPT virus_injection with valid hemisphere', () => {
      const yaml = {
        ...loadFixture('valid', 'minimal-valid.yml'),
        // NOTE: If ANY optogenetics field is present, ALL must be present
        virus_injection: [
          {
            name: 'Test Virus',
            description: 'Test injection',
            virus_name: 'AAV-ChR2',
            volume_in_ul: 0.5,
            titer_in_vg_per_ml: 1e12,
            location: 'CA1',
            hemisphere: 'left', // Valid value
            ap_in_mm: 1.5,
            ml_in_mm: 1.0,
            dv_in_mm: 2.0,
            roll_in_deg: 0,
            pitch_in_deg: 0,
            yaw_in_deg: 0
          }
        ],
        opto_excitation_source: [
          {
            name: 'Laser1',
            description: 'Blue laser for optogenetic stimulation',
            wavelength_in_nm: 473,
            power_in_W: 0.1,
            intensity_in_W_per_m2: 1000, // Required field
            model_name: 'LaserModel-473' // Required field
          }
        ],
        optical_fiber: [
          {
            name: 'Fiber1',
            hardware_name: 'Fiber Optic Cable 200um',
            hemisphere: 'left',
            implanted_fiber_description: '200um core fiber',
            location: 'CA1',
            ap_in_mm: 1.5,
            ml_in_mm: 1.0,
            dv_in_mm: 2.0,
            pitch_in_deg: 0, // Required field
            roll_in_deg: 0, // Required field
            yaw_in_deg: 0 // Required field
          }
        ]
      };

      const issues = validate(yaml);
      const isValid = issues.length === 0;

      // Should ACCEPT valid hemisphere (and complete optogenetics config)
      expect(isValid).toBe(true);
      expect(issues).toEqual([]);
    });
  });

  describe('opto_software empty string bug', () => {
    it('should REJECT empty opto_software string', () => {
      // ARRANGE: Create YAML with empty opto_software
      const yaml = {
        ...loadFixture('valid', 'minimal-valid.yml'),
        opto_software: '' // BUG: Currently accepted, should be rejected
      };

      // ACT: Validate the YAML
      const issues = validate(yaml);
      const isValid = issues.length === 0;

      // ASSERT: Should REJECT empty opto_software (currently FAILS - bug exists)
      expect(isValid).toBe(false);
      expect(issues.length).toBeGreaterThan(0);
      expect(issues.some(issue =>
        issue.instancePath === '/opto_software' &&
        issue.code === 'pattern'
      )).toBe(true);
    });

    it('should REJECT whitespace-only opto_software', () => {
      const yaml = {
        ...loadFixture('valid', 'minimal-valid.yml'),
        opto_software: '   ' // BUG: Whitespace-only should be rejected
      };

      const issues = validate(yaml);
      const isValid = issues.length === 0;

      // Should REJECT whitespace-only opto_software
      expect(isValid).toBe(false);
      expect(issues.length).toBeGreaterThan(0);
    });

    it('should ACCEPT valid opto_software', () => {
      const yaml = {
        ...loadFixture('valid', 'minimal-valid.yml'),
        opto_software: 'fsgui' // Valid value (default)
      };

      const issues = validate(yaml);
      const isValid = issues.length === 0;

      // Should ACCEPT valid opto_software
      expect(isValid).toBe(true);
      expect(issues).toEqual([]);
    });
  });
});
