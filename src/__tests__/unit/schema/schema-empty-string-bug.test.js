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
import { jsonschemaValidation } from '../../../utils/validation';

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
      const result = jsonschemaValidation(yaml);

      // ASSERT: Should REJECT empty hemisphere (currently FAILS - bug exists)
      expect(result.valid).toBe(false);
      expect(result.errors).not.toBeNull();
      expect(result.errors.some(err =>
        err.instancePath.includes('hemisphere') &&
        err.keyword === 'pattern'
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

      const result = jsonschemaValidation(yaml);

      // Should REJECT whitespace-only hemisphere
      expect(result.valid).toBe(false);
      expect(result.errors).not.toBeNull();
    });

    it('should ACCEPT virus_injection with valid hemisphere', () => {
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
            hemisphere: 'left', // Valid value
            ap_in_mm: 1.5,
            ml_in_mm: 1.0,
            dv_in_mm: 2.0,
            roll_in_deg: 0,
            pitch_in_deg: 0,
            yaw_in_deg: 0
          }
        ]
      };

      const result = jsonschemaValidation(yaml);

      // Should ACCEPT valid hemisphere
      expect(result.valid).toBe(true);
      expect(result.errors).toBeNull();
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
      const result = jsonschemaValidation(yaml);

      // ASSERT: Should REJECT empty opto_software (currently FAILS - bug exists)
      expect(result.valid).toBe(false);
      expect(result.errors).not.toBeNull();
      expect(result.errors.some(err =>
        err.instancePath === '/opto_software' &&
        err.keyword === 'pattern'
      )).toBe(true);
    });

    it('should REJECT whitespace-only opto_software', () => {
      const yaml = {
        ...loadFixture('valid', 'minimal-valid.yml'),
        opto_software: '   ' // BUG: Whitespace-only should be rejected
      };

      const result = jsonschemaValidation(yaml);

      // Should REJECT whitespace-only opto_software
      expect(result.valid).toBe(false);
      expect(result.errors).not.toBeNull();
    });

    it('should ACCEPT valid opto_software', () => {
      const yaml = {
        ...loadFixture('valid', 'minimal-valid.yml'),
        opto_software: 'fsgui' // Valid value (default)
      };

      const result = jsonschemaValidation(yaml);

      // Should ACCEPT valid opto_software
      expect(result.valid).toBe(true);
      expect(result.errors).toBeNull();
    });
  });
});
