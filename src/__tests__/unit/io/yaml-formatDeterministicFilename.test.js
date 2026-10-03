/**
 * @file Tests for formatDeterministicFilename function
 * @description Phase 3 - Code Review Follow-up (P1-1)
 *
 * Function location: src/io/yaml
 *
 * Purpose: Generate deterministic filenames for YAML metadata export
 * Format: {EXPERIMENT_DATE_in_format_YYYYMMDD}_{subject_id}_metadata.yml
 *
 * This filename format is CRITICAL for trodes_to_nwb pipeline integration.
 * Its file scanner splits the name on "_", reads the first part as the
 * integer date and the second as the animal, and groups the file with the
 * recordings ({YYYYMMDD}_{animal}_{epoch}_{tag}.rec) that have the same
 * date and the same, case-sensitive animal.
 */

import { describe, it, expect } from 'vitest';
import { formatDeterministicFilename } from '../../../io/yaml';

/**
 * trodes_to_nwb's data_scanner._process_path (main @ 6603412), reduced to the session key it
 * groups files by: `date, animal, ... = path.stem.split("_")` with the date read as an int.
 * Returns null when the scanner skips the file (wrong number of parts, or a date that is not an
 * integer).
 *
 * @param {string} filename - A file name
 * @returns {{date: number, animal: string}|null} The session key
 */
function scannerSessionKey(filename) {
  const parts = filename.slice(0, filename.lastIndexOf('.')).split('_');
  const expectedParts = filename.endsWith('.yml') ? 3 : 4;
  if (parts.length !== expectedParts || !/^[+-]?\d+$/.test(parts[0])) {
    return null;
  }
  return { date: Number.parseInt(parts[0], 10), animal: parts[1] };
}

describe('formatDeterministicFilename()', () => {
  describe('Normal Operation', () => {
    it('generates correct filename with all fields present', () => {
      const model = {
        EXPERIMENT_DATE_in_format_YYYYMMDD: '20230622',
        subject: { subject_id: 'Rat01' }
      };

      const result = formatDeterministicFilename(model);

      expect(result).toBe('20230622_Rat01_metadata.yml');
    });

    it('keeps the subject ID exactly as entered (the scanner matches it case-sensitively)', () => {
      const model = {
        EXPERIMENT_DATE_in_format_YYYYMMDD: '20230622',
        subject: { subject_id: 'RAT01' }
      };

      const result = formatDeterministicFilename(model);

      expect(result).toBe('20230622_RAT01_metadata.yml');
    });

    it('handles mixed case subject ID', () => {
      const model = {
        EXPERIMENT_DATE_in_format_YYYYMMDD: '20231225',
        subject: { subject_id: 'RaT-123_TeSt' }
      };

      const result = formatDeterministicFilename(model);

      expect(result).toBe('20231225_RaT-123_TeSt_metadata.yml');
    });

    it('preserves numeric subject IDs', () => {
      const model = {
        EXPERIMENT_DATE_in_format_YYYYMMDD: '20240101',
        subject: { subject_id: '12345' }
      };

      const result = formatDeterministicFilename(model);

      expect(result).toBe('20240101_12345_metadata.yml');
    });
  });

  describe('Edge Cases', () => {
    it('uses placeholder when date is missing', () => {
      const model = {
        subject: { subject_id: 'rat01' }
      };

      const result = formatDeterministicFilename(model);

      expect(result).toBe('{EXPERIMENT_DATE_in_format_YYYYMMDD}_rat01_metadata.yml');
    });

    it('uses placeholder when date is undefined', () => {
      const model = {
        EXPERIMENT_DATE_in_format_YYYYMMDD: undefined,
        subject: { subject_id: 'rat01' }
      };

      const result = formatDeterministicFilename(model);

      expect(result).toBe('{EXPERIMENT_DATE_in_format_YYYYMMDD}_rat01_metadata.yml');
    });

    it('uses placeholder when date is empty string', () => {
      const model = {
        EXPERIMENT_DATE_in_format_YYYYMMDD: '',
        subject: { subject_id: 'rat01' }
      };

      const result = formatDeterministicFilename(model);

      expect(result).toBe('{EXPERIMENT_DATE_in_format_YYYYMMDD}_rat01_metadata.yml');
    });

    it('never writes a month-first date (the old mmddYYYY field is not read)', () => {
      const model = {
        EXPERIMENT_DATE_in_format_mmddYYYY: '06222023',
        subject: { subject_id: 'rat01' }
      };

      const result = formatDeterministicFilename(model);

      expect(result).toBe('{EXPERIMENT_DATE_in_format_YYYYMMDD}_rat01_metadata.yml');
    });

    it('uses empty string when subject ID is missing', () => {
      const model = {
        EXPERIMENT_DATE_in_format_YYYYMMDD: '20230622'
      };

      const result = formatDeterministicFilename(model);

      expect(result).toBe('20230622__metadata.yml');
    });

    it('uses empty string when subject is undefined', () => {
      const model = {
        EXPERIMENT_DATE_in_format_YYYYMMDD: '20230622',
        subject: undefined
      };

      const result = formatDeterministicFilename(model);

      expect(result).toBe('20230622__metadata.yml');
    });

    it('uses empty string when subject.subject_id is empty', () => {
      const model = {
        EXPERIMENT_DATE_in_format_YYYYMMDD: '20230622',
        subject: { subject_id: '' }
      };

      const result = formatDeterministicFilename(model);

      expect(result).toBe('20230622__metadata.yml');
    });

    it('handles empty model object', () => {
      const model = {};

      const result = formatDeterministicFilename(model);

      expect(result).toBe('{EXPERIMENT_DATE_in_format_YYYYMMDD}__metadata.yml');
    });

    it('preserves special characters in subject ID', () => {
      const model = {
        EXPERIMENT_DATE_in_format_YYYYMMDD: '20230622',
        subject: { subject_id: 'Rat-01_Test' }
      };

      const result = formatDeterministicFilename(model);

      expect(result).toBe('20230622_Rat-01_Test_metadata.yml');
    });
  });

  describe('Determinism', () => {
    it('produces identical output for same input', () => {
      const model = {
        EXPERIMENT_DATE_in_format_YYYYMMDD: '20230622',
        subject: { subject_id: 'Rat01' }
      };

      const filename1 = formatDeterministicFilename(model);
      const filename2 = formatDeterministicFilename(model);
      const filename3 = formatDeterministicFilename(model);

      expect(filename1).toBe(filename2);
      expect(filename2).toBe(filename3);
      expect(filename1).toBe('20230622_Rat01_metadata.yml');
    });

    it('produces identical output even when model is cloned', () => {
      const model = {
        EXPERIMENT_DATE_in_format_YYYYMMDD: '20230622',
        subject: { subject_id: 'Rat01' }
      };

      const filename1 = formatDeterministicFilename(model);
      const clonedModel = structuredClone(model);
      const filename2 = formatDeterministicFilename(clonedModel);

      expect(filename1).toBe(filename2);
    });
  });

  describe('Integration with trodes_to_nwb', () => {
    const recording = '20230622_Sample_01_a1.rec';

    it('matches the name of the trodes_to_nwb sample metadata file', () => {
      const model = {
        EXPERIMENT_DATE_in_format_YYYYMMDD: '20230622',
        subject: { subject_id: 'sample' }
      };

      expect(formatDeterministicFilename(model)).toBe('20230622_sample_metadata.yml');
    });

    it('groups with the recording once the placeholder is replaced by the date', () => {
      const filename = formatDeterministicFilename({ subject: { subject_id: 'Sample' } })
        .replace('{EXPERIMENT_DATE_in_format_YYYYMMDD}', '20230622');

      expect(filename).toBe('20230622_Sample_metadata.yml');
      expect(scannerSessionKey(filename)).toEqual(scannerSessionKey(recording));
    });

    it('groups with the recording when the date is given', () => {
      const filename = formatDeterministicFilename({
        EXPERIMENT_DATE_in_format_YYYYMMDD: '20230622',
        subject: { subject_id: 'Sample' }
      });

      expect(scannerSessionKey(filename)).toEqual(scannerSessionKey(recording));
    });

    it('the old month-first, lower-cased name did not group with the recording', () => {
      expect(scannerSessionKey('06222023_sample_metadata.yml')).not.toEqual(scannerSessionKey(recording));
    });
  });
});

/**
 * Implementation Notes:
 *
 * The formatDeterministicFilename() function is critical for trodes_to_nwb integration.
 *
 * Behavior:
 * - Uses model.EXPERIMENT_DATE_in_format_YYYYMMDD or placeholder if missing
 * - Uses model.subject.subject_id exactly as entered, or empty string if missing
 * - Format: {date}_{subject_id}_metadata.yml
 *
 * Used by:
 * - exportAll() (features/importExport) to name the legacy form's download
 *
 * Integration:
 * - Filename MUST match trodes_to_nwb file scanner expectations
 * - Wrong format = metadata not grouped with the recording = conversion failure
 *
 * Edge Cases Handled:
 * - Missing date → use placeholder (the form has no date field; the user fills it in)
 * - Missing subject ID → use empty string (creates "date__metadata.yml")
 * - Special characters → preserved (hyphens, underscores)
 * - Case → preserved (the scanner compares the animal case-sensitively)
 */
