/**
 * @file Tests for formatDeterministicFilename function
 * @description Phase 3 - Code Review Follow-up (P1-1)
 *
 * Function location: src/io/yaml.js
 *
 * Purpose: Generate deterministic filenames for YAML metadata export
 * Format: {EXPERIMENT_DATE_in_format_mmddYYYY}_{subject_id}_metadata.yml
 *
 * This filename format is CRITICAL for trodes_to_nwb pipeline integration.
 * The Python package's file scanner expects this exact pattern to group
 * files by recording session.
 *
 * Test Coverage: 12 tests for normal operation, edge cases, and determinism
 */

import { describe, it, expect } from 'vitest';
import { formatDeterministicFilename } from '../../../io/yaml';

describe('formatDeterministicFilename()', () => {
  describe('Normal Operation', () => {
    it('generates correct filename with all fields present', () => {
      const model = {
        EXPERIMENT_DATE_in_format_mmddYYYY: '06222023',
        subject: { subject_id: 'Rat01' }
      };

      const result = formatDeterministicFilename(model);

      expect(result).toBe('06222023_rat01_metadata.yml');
    });

    it('lowercases subject ID', () => {
      const model = {
        EXPERIMENT_DATE_in_format_mmddYYYY: '06222023',
        subject: { subject_id: 'RAT01' }
      };

      const result = formatDeterministicFilename(model);

      expect(result).toBe('06222023_rat01_metadata.yml');
    });

    it('handles mixed case subject ID', () => {
      const model = {
        EXPERIMENT_DATE_in_format_mmddYYYY: '12252023',
        subject: { subject_id: 'RaT-123_TeSt' }
      };

      const result = formatDeterministicFilename(model);

      expect(result).toBe('12252023_rat-123_test_metadata.yml');
    });

    it('preserves numeric subject IDs', () => {
      const model = {
        EXPERIMENT_DATE_in_format_mmddYYYY: '01012024',
        subject: { subject_id: '12345' }
      };

      const result = formatDeterministicFilename(model);

      expect(result).toBe('01012024_12345_metadata.yml');
    });
  });

  describe('Edge Cases', () => {
    it('uses placeholder when date is missing', () => {
      const model = {
        subject: { subject_id: 'rat01' }
      };

      const result = formatDeterministicFilename(model);

      expect(result).toBe('{EXPERIMENT_DATE_in_format_mmddYYYY}_rat01_metadata.yml');
    });

    it('uses placeholder when date is undefined', () => {
      const model = {
        EXPERIMENT_DATE_in_format_mmddYYYY: undefined,
        subject: { subject_id: 'rat01' }
      };

      const result = formatDeterministicFilename(model);

      expect(result).toBe('{EXPERIMENT_DATE_in_format_mmddYYYY}_rat01_metadata.yml');
    });

    it('uses placeholder when date is empty string', () => {
      const model = {
        EXPERIMENT_DATE_in_format_mmddYYYY: '',
        subject: { subject_id: 'rat01' }
      };

      const result = formatDeterministicFilename(model);

      expect(result).toBe('{EXPERIMENT_DATE_in_format_mmddYYYY}_rat01_metadata.yml');
    });

    it('uses empty string when subject ID is missing', () => {
      const model = {
        EXPERIMENT_DATE_in_format_mmddYYYY: '06222023'
      };

      const result = formatDeterministicFilename(model);

      expect(result).toBe('06222023__metadata.yml');
    });

    it('uses empty string when subject is undefined', () => {
      const model = {
        EXPERIMENT_DATE_in_format_mmddYYYY: '06222023',
        subject: undefined
      };

      const result = formatDeterministicFilename(model);

      expect(result).toBe('06222023__metadata.yml');
    });

    it('uses empty string when subject.subject_id is empty', () => {
      const model = {
        EXPERIMENT_DATE_in_format_mmddYYYY: '06222023',
        subject: { subject_id: '' }
      };

      const result = formatDeterministicFilename(model);

      expect(result).toBe('06222023__metadata.yml');
    });

    it('handles empty model object', () => {
      const model = {};

      const result = formatDeterministicFilename(model);

      expect(result).toBe('{EXPERIMENT_DATE_in_format_mmddYYYY}__metadata.yml');
    });

    it('preserves special characters in subject ID', () => {
      const model = {
        EXPERIMENT_DATE_in_format_mmddYYYY: '06222023',
        subject: { subject_id: 'Rat-01_Test' }
      };

      const result = formatDeterministicFilename(model);

      expect(result).toBe('06222023_rat-01_test_metadata.yml');
    });
  });

  describe('Determinism', () => {
    it('produces identical output for same input', () => {
      const model = {
        EXPERIMENT_DATE_in_format_mmddYYYY: '06222023',
        subject: { subject_id: 'Rat01' }
      };

      const filename1 = formatDeterministicFilename(model);
      const filename2 = formatDeterministicFilename(model);
      const filename3 = formatDeterministicFilename(model);

      expect(filename1).toBe(filename2);
      expect(filename2).toBe(filename3);
      expect(filename1).toBe('06222023_rat01_metadata.yml');
    });

    it('produces identical output even when model is cloned', () => {
      const model = {
        EXPERIMENT_DATE_in_format_mmddYYYY: '06222023',
        subject: { subject_id: 'Rat01' }
      };

      const filename1 = formatDeterministicFilename(model);
      const clonedModel = structuredClone(model);
      const filename2 = formatDeterministicFilename(clonedModel);

      expect(filename1).toBe(filename2);
    });
  });

  describe('Integration with trodes_to_nwb', () => {
    it('matches expected filename format for sample metadata', () => {
      // This is the format used in actual golden fixtures
      const model = {
        EXPERIMENT_DATE_in_format_mmddYYYY: '06222023',
        subject: { subject_id: 'beans' }
      };

      const result = formatDeterministicFilename(model);

      // Expected format matches golden fixture pattern: 20230622_sample_metadata.yml
      // (Note: In actual usage, date format differs - mmddYYYY vs YYYYmmdd)
      expect(result).toBe('06222023_beans_metadata.yml');
      expect(result).toMatch(/^\d{8}_[a-z0-9_-]+_metadata\.yml$/);
    });

    it('filename is compatible with trodes_to_nwb file scanner regex', () => {
      const model = {
        EXPERIMENT_DATE_in_format_mmddYYYY: '06222023',
        subject: { subject_id: 'test_rat_01' }
      };

      const result = formatDeterministicFilename(model);

      // trodes_to_nwb expects: {date}_{animal}_metadata.yml
      // Pattern: 8 digits, underscore, animal name (alphanumeric+underscore+hyphen), _metadata.yml
      expect(result).toMatch(/^\d{8}_[a-z0-9_-]+_metadata\.yml$/);
    });
  });
});

/**
 * Implementation Notes:
 *
 * The formatDeterministicFilename() function is critical for trodes_to_nwb integration.
 *
 * Behavior:
 * - Uses model.EXPERIMENT_DATE_in_format_mmddYYYY or placeholder if missing
 * - Lowercases model.subject.subject_id or uses empty string if missing
 * - Format: {date}_{subject_id}_metadata.yml
 *
 * Used by:
 * - App.js generateYMLFile() to create download filename
 *
 * Integration:
 * - Filename MUST match trodes_to_nwb file scanner expectations
 * - Wrong format = files not found = conversion failure
 *
 * Edge Cases Handled:
 * - Missing date → use placeholder (allows manual correction)
 * - Missing subject ID → use empty string (creates "date__metadata.yml")
 * - Special characters → preserved (hyphens, underscores)
 * - Case sensitivity → lowercased for consistency
 */
