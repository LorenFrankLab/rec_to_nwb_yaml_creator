/**
 * Golden YAML Baseline Tests
 *
 * These tests ensure deterministic YAML export output by comparing generated YAML
 * against golden fixtures. Any changes to YAML formatting will cause these tests to fail,
 * preventing unintended changes to output format.
 *
 * Purpose:
 * - Ensure YAML export is deterministic (same input -> same output)
 * - Catch unintended formatting changes
 * - Verify round-trip consistency (import -> export -> import)
 * - Protect against regressions during refactoring
 *
 * If these tests fail:
 * 1. Verify the change is intentional
 * 2. If intentional, regenerate golden fixtures: node src/__tests__/fixtures/golden/generate-golden.js
 * 3. Review the diff carefully before committing new golden fixtures
 */

import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import YAML from 'yaml';
import { encodeYaml as convertObjectToYAMLString } from '../../io/yaml.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const goldenDir = path.join(__dirname, '../fixtures/golden');

/**
 * Helper to read golden fixture
 */
function readGoldenFixture(filename) {
  const filepath = path.join(goldenDir, filename);
  return fs.readFileSync(filepath, 'utf8');
}

/**
 * Helper to parse YAML and re-export
 */
function roundTripYAML(yamlString) {
  const parsed = YAML.parse(yamlString);
  return convertObjectToYAMLString(parsed);
}

describe('Golden YAML Baseline Tests', () => {
  describe('Deterministic Export - Byte-for-Byte Equality', () => {
    it('should produce identical output for 20230622_sample_metadata.yml', () => {
      const golden = readGoldenFixture('20230622_sample_metadata.yml');
      const roundTripped = roundTripYAML(golden);

      expect(roundTripped).toBe(golden);
    });

    it('should produce identical output for minimal-valid.yml', () => {
      const golden = readGoldenFixture('minimal-valid.yml');
      const roundTripped = roundTripYAML(golden);

      expect(roundTripped).toBe(golden);
    });

    it('should produce identical output for realistic-session.yml', () => {
      const golden = readGoldenFixture('realistic-session.yml');
      const roundTripped = roundTripYAML(golden);

      expect(roundTripped).toBe(golden);
    });

    it('should produce identical output for 20230622_sample_metadataProbeReconfig.yml', () => {
      const golden = readGoldenFixture('20230622_sample_metadataProbeReconfig.yml');
      const roundTripped = roundTripYAML(golden);

      expect(roundTripped).toBe(golden);
    });
  });

  describe('Multiple Export Consistency', () => {
    it('should produce identical output across multiple exports (sample metadata)', () => {
      const golden = readGoldenFixture('20230622_sample_metadata.yml');
      const parsed = YAML.parse(golden);

      const export1 = convertObjectToYAMLString(parsed);
      const export2 = convertObjectToYAMLString(parsed);
      const export3 = convertObjectToYAMLString(parsed);

      expect(export1).toBe(export2);
      expect(export2).toBe(export3);
      expect(export1).toBe(golden);
    });

    it('should produce identical output across multiple exports (minimal valid)', () => {
      const golden = readGoldenFixture('minimal-valid.yml');
      const parsed = YAML.parse(golden);

      const export1 = convertObjectToYAMLString(parsed);
      const export2 = convertObjectToYAMLString(parsed);
      const export3 = convertObjectToYAMLString(parsed);

      expect(export1).toBe(export2);
      expect(export2).toBe(export3);
      expect(export1).toBe(golden);
    });
  });

  describe('Deep Round-Trip Consistency', () => {
    it('should maintain data integrity through multiple round-trips (sample metadata)', () => {
      const golden = readGoldenFixture('20230622_sample_metadata.yml');

      // Round-trip 3 times
      const trip1 = roundTripYAML(golden);
      const trip2 = roundTripYAML(trip1);
      const trip3 = roundTripYAML(trip2);

      // All trips should be identical to golden
      expect(trip1).toBe(golden);
      expect(trip2).toBe(golden);
      expect(trip3).toBe(golden);
    });

    it('should maintain data integrity through parse-export cycles', () => {
      const golden = readGoldenFixture('realistic-session.yml');
      const parsed1 = YAML.parse(golden);
      const exported1 = convertObjectToYAMLString(parsed1);
      const parsed2 = YAML.parse(exported1);
      const exported2 = convertObjectToYAMLString(parsed2);

      // Exports should be identical
      expect(exported1).toBe(golden);
      expect(exported2).toBe(golden);

      // Parsed data should be deeply equal
      expect(parsed1).toEqual(parsed2);
    });
  });

  describe('Complex Structure Preservation', () => {
    it('should preserve optogenetics metadata structure', () => {
      const golden = readGoldenFixture('20230622_sample_metadata.yml');
      const parsed = YAML.parse(golden);

      // Verify optogenetics sections exist in sample fixture
      expect(parsed).toHaveProperty('opto_excitation_source');
      expect(parsed).toHaveProperty('optical_fiber');
      expect(parsed).toHaveProperty('virus_injection');
      expect(parsed).toHaveProperty('optogenetic_stimulation_software');

      // Verify structures are arrays with content
      expect(Array.isArray(parsed.opto_excitation_source)).toBe(true);
      expect(parsed.opto_excitation_source.length).toBeGreaterThan(0);
      expect(Array.isArray(parsed.optical_fiber)).toBe(true);
      expect(parsed.optical_fiber.length).toBeGreaterThan(0);
      expect(Array.isArray(parsed.virus_injection)).toBe(true);
      expect(parsed.virus_injection.length).toBeGreaterThan(0);

      // Round-trip should preserve structure exactly
      const exported = convertObjectToYAMLString(parsed);
      const reparsed = YAML.parse(exported);

      // Deep equality on optogenetics sections
      expect(reparsed.opto_excitation_source).toEqual(parsed.opto_excitation_source);
      expect(reparsed.optical_fiber).toEqual(parsed.optical_fiber);
      expect(reparsed.virus_injection).toEqual(parsed.virus_injection);
      expect(reparsed.optogenetic_stimulation_software).toEqual(parsed.optogenetic_stimulation_software);
    });
  });

  describe('Format Stability', () => {
    it('should maintain consistent line endings', () => {
      const golden = readGoldenFixture('20230622_sample_metadata.yml');
      const roundTripped = roundTripYAML(golden);

      // Should use Unix line endings (\n)
      expect(roundTripped).not.toContain('\r\n');
      expect(roundTripped.split('\n').length).toBeGreaterThan(1);
    });

    it('should maintain consistent indentation', () => {
      const golden = readGoldenFixture('realistic-session.yml');
      const lines = golden.split('\n');

      // Check that indentation uses spaces (YAML convention)
      const indentedLines = lines.filter(line => line.match(/^\s+/));
      indentedLines.forEach(line => {
        expect(line).not.toMatch(/^\t/); // No tabs
      });
    });

    it('should handle empty objects and arrays consistently', () => {
      const data = {
        empty_object: {},
        empty_array: [],
        nested: {
          also_empty: {}
        }
      };

      const export1 = convertObjectToYAMLString(data);
      const export2 = convertObjectToYAMLString(data);

      expect(export1).toBe(export2);
    });

    it('should preserve object key order from input', () => {
      // Test with deliberately non-alphabetical keys
      const data = {
        zebra: 'last',
        apple: 'first',
        middle: 'between'
      };

      const exported = convertObjectToYAMLString(data);
      const lines = exported.split('\n').filter(l => l.trim());

      // Verify insertion order is preserved (not alphabetized)
      expect(lines[0]).toContain('zebra:');
      expect(lines[1]).toContain('apple:');
      expect(lines[2]).toContain('middle:');
    });

    it('should maintain nested object key order through round-trip', () => {
      const data = {
        z_field: { nested_z: 1, nested_a: 2 },
        a_field: { nested_m: 3, nested_b: 4 }
      };

      const exported = convertObjectToYAMLString(data);
      const parsed = YAML.parse(exported);
      const reexported = convertObjectToYAMLString(parsed);

      // Round-trip should preserve exact order
      expect(reexported).toBe(exported);
    });
  });

  describe('Edge Cases', () => {
    it('should handle null and undefined consistently', () => {
      const data1 = { value: null };
      const data2 = { value: undefined };

      const export1 = convertObjectToYAMLString(data1);
      const export2 = convertObjectToYAMLString(data2);

      // null exports as "value: null"
      expect(export1).toContain('value: null');

      // undefined causes key to be omitted (YAML.Document behavior)
      // This is consistent with JSON.stringify behavior
      expect(export2).toBe('{}\n');

      // Verify round-trip consistency
      const parsed1 = YAML.parse(export1);
      expect(parsed1.value).toBeNull();
    });

    it('should handle special characters in strings', () => {
      const data = {
        special: 'Value with "quotes" and \'apostrophes\'',
        multiline: 'Line 1\nLine 2',
        unicode: 'Café ☕'
      };

      const exported = convertObjectToYAMLString(data);
      const parsed = YAML.parse(exported);

      expect(parsed).toEqual(data);
    });

    it('should handle multiline strings consistently', () => {
      const data = {
        short_description: 'Single line',
        long_description: 'First line\nSecond line\nThird line',
        paragraph: 'This is a very long description that spans multiple lines and should be handled consistently by the YAML library regardless of content length or line breaks within the text.'
      };

      const export1 = convertObjectToYAMLString(data);
      const export2 = convertObjectToYAMLString(data);

      // Should be deterministic
      expect(export1).toBe(export2);

      // Round-trip should preserve content exactly
      const parsed = YAML.parse(export1);
      expect(parsed.short_description).toBe('Single line');
      expect(parsed.long_description).toBe('First line\nSecond line\nThird line');
      expect(parsed.paragraph).toBe(data.paragraph);

      // Verify multiline strings preserve newlines
      expect(parsed.long_description.split('\n')).toHaveLength(3);
    });

    it('should handle numeric types correctly', () => {
      const data = {
        integer: 42,
        float: 3.14,
        scientific: 1e10,
        string_number: '123'
      };

      const exported = convertObjectToYAMLString(data);
      const parsed = YAML.parse(exported);

      expect(parsed).toEqual(data);
      expect(typeof parsed.integer).toBe('number');
      expect(typeof parsed.float).toBe('number');
      expect(typeof parsed.string_number).toBe('string');
    });
  });
});
