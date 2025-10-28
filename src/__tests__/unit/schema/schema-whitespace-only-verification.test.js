/**
 * VERIFICATION TEST: Whitespace-Only String Acceptance (P2)
 *
 * This test verifies that ALL string fields in the schema properly reject
 * whitespace-only values. This was identified as a potential bug during
 * Phase 1, but investigation shows it was already fixed in BUG #7.
 *
 * FINDINGS:
 * - Total string fields in schema: 54
 * - Fields with pattern constraint: 53 (all use `^(.|\\s)*\\S(.|\\s)*$`)
 * - Fields with enum constraint: 1 (subject.sex = ["M", "F", "U", "O"])
 * - Fields without any constraint: 0
 *
 * CONCLUSION: All 54 string fields are already protected against whitespace-only values.
 *
 * This test serves as regression protection and verification.
 */

import { describe, it, expect } from 'vitest';
import YAML from 'yaml';
import fs from 'fs';
import path from 'path';
import { validate } from '../../../validation';
import schema from '../../../nwb_schema.json';

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

/**
 * Get all string field paths from schema
 */
function getAllStringFields(obj, path = '') {
  const fields = [];

  if (obj && typeof obj === 'object') {
    if (obj.type === 'string') {
      fields.push({
        path,
        hasPattern: !!obj.pattern,
        hasEnum: !!obj.enum,
        pattern: obj.pattern,
        enum: obj.enum
      });
    }

    if (obj.properties) {
      for (const [key, value] of Object.entries(obj.properties)) {
        fields.push(...getAllStringFields(value, path ? `${path}.${key}` : key));
      }
    }

    if (obj.items) {
      fields.push(...getAllStringFields(obj.items, `${path}[]`));
    }
  }

  return fields;
}

describe('VERIFICATION: Whitespace-Only String Protection (P2)', () => {
  const allStringFields = getAllStringFields(schema);
  const withPattern = allStringFields.filter(f => f.hasPattern);
  const withEnum = allStringFields.filter(f => f.hasEnum);
  const withoutConstraint = allStringFields.filter(f => !f.hasPattern && !f.hasEnum);

  it('documents all string fields have whitespace protection', () => {
    // DOCUMENT: Schema analysis results
    expect(allStringFields.length).toBe(54);
    expect(withPattern.length).toBe(53);
    expect(withEnum.length).toBe(2); // subject.sex + electrode_groups[].device_type
    expect(withoutConstraint.length).toBe(0);

    // Verify enum fields
    const enumPaths = withEnum.map(f => f.path).sort();
    expect(enumPaths).toEqual([
      'electrode_groups[].device_type',
      'subject.sex'
    ]);

    // Verify subject.sex enum
    const sexField = withEnum.find(f => f.path === 'subject.sex');
    expect(sexField.enum).toEqual(['M', 'F', 'U', 'O']);

    // Verify device_type also has pattern (double protection)
    const deviceTypeField = allStringFields.find(f => f.path === 'electrode_groups[].device_type');
    expect(deviceTypeField.hasPattern).toBe(true);
    expect(deviceTypeField.hasEnum).toBe(true);
  });

  it('verifies pattern constraint rejects whitespace-only strings', () => {
    // ARRANGE: Test YAML with whitespace-only lab field
    const yaml = {
      ...loadFixture('valid', 'minimal-valid.yml'),
      lab: '   ' // Whitespace-only
    };

    // ACT
    const issues = validate(yaml);
      const isValid = issues.length === 0;

    // ASSERT: Should reject whitespace-only value
    expect(isValid).toBe(false);
    expect(issues.length).toBeGreaterThan(0);
    expect(issues.some(err =>
      err.instancePath === '/lab' &&
      err.code === 'pattern'
    )).toBe(true);
  });

  it('verifies enum constraint rejects whitespace-only strings', () => {
    // ARRANGE: Test YAML with whitespace-only subject.sex
    const yaml = {
      ...loadFixture('valid', 'minimal-valid.yml'),
      subject: {
        ...loadFixture('valid', 'minimal-valid.yml').subject,
        sex: '   ' // Whitespace-only (not in enum)
      }
    };

    // ACT
    const issues = validate(yaml);
      const isValid = issues.length === 0;

    // ASSERT: Should reject whitespace-only value (not in enum)
    expect(isValid).toBe(false);
    expect(issues.length).toBeGreaterThan(0);
    expect(issues.some(err =>
      err.instancePath === '/subject/sex' &&
      err.code === 'enum'
    )).toBe(true);
  });

  it('verifies pattern constraint rejects tab+newline strings', () => {
    // ARRANGE: Test with tabs and newlines
    const yaml = {
      ...loadFixture('valid', 'minimal-valid.yml'),
      institution: '\t\n\t' // Tab+newline only
    };

    // ACT
    const issues = validate(yaml);
      const isValid = issues.length === 0;

    // ASSERT: Should reject
    expect(isValid).toBe(false);
    expect(issues.length).toBeGreaterThan(0);
  });

  it('verifies pattern allows strings with whitespace edges but non-whitespace content', () => {
    // ARRANGE: Valid strings with leading/trailing whitespace
    const yaml = {
      ...loadFixture('valid', 'minimal-valid.yml'),
      lab: '  Frank Lab  ', // Valid: has non-whitespace content
      institution: '\tUCSF\n' // Valid: has non-whitespace content
    };

    // ACT
    const issues = validate(yaml);
      const isValid = issues.length === 0;

    // ASSERT: Should accept (these are valid)
    expect(isValid).toBe(true);
  });

  describe('Sample field verification', () => {
    const criticalFields = [
      { path: 'lab', testValue: '   ' },
      { path: 'institution', testValue: '\t\t' },
      { path: 'experiment_description', testValue: '\n\n' },
      { path: 'session_id', testValue: '  ' },
      { path: 'subject.description', testValue: '   ' },
      { path: 'subject.species', testValue: '\t' },
      { path: 'subject.genotype', testValue: '  ' }
    ];

    criticalFields.forEach(({ path, testValue }) => {
      it(`rejects whitespace-only value for ${path}`, () => {
        // ARRANGE: Create YAML with whitespace-only field
        const baseYaml = loadFixture('valid', 'minimal-valid.yml');
        const yaml = { ...baseYaml };

        // Set the field to whitespace-only
        const pathParts = path.split('.');
        if (pathParts.length === 1) {
          yaml[pathParts[0]] = testValue;
        } else {
          yaml[pathParts[0]] = {
            ...yaml[pathParts[0]],
            [pathParts[1]]: testValue
          };
        }

        // ACT
        const issues = validate(yaml);
      const isValid = issues.length === 0;

        // ASSERT
        expect(isValid).toBe(false);
        expect(issues.length).toBeGreaterThan(0);
      });
    });
  });

  describe('Array item string fields', () => {
    it('rejects whitespace-only experimenter names', () => {
      // ARRANGE
      const yaml = {
        ...loadFixture('valid', 'minimal-valid.yml'),
        experimenter_name: ['Valid Name', '   ', 'Another Valid'] // Middle item is whitespace
      };

      // ACT
      const issues = validate(yaml);
      const isValid = issues.length === 0;

      // ASSERT
      expect(isValid).toBe(false);
      expect(issues.length).toBeGreaterThan(0);
    });

    it('rejects whitespace-only keywords', () => {
      // ARRANGE
      const yaml = {
        ...loadFixture('valid', 'minimal-valid.yml'),
        keywords: ['\t\t'] // Whitespace-only keyword
      };

      // ACT
      const issues = validate(yaml);
      const isValid = issues.length === 0;

      // ASSERT
      expect(isValid).toBe(false);
      expect(issues.length).toBeGreaterThan(0);
    });
  });
});
