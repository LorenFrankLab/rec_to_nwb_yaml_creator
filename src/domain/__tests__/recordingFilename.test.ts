/**
 * Recording-filename contract tests.
 *
 * The scanner mirror below is a line-for-line port of trodes_to_nwb's
 * `data_scanner._process_path` (checkout 6603412) so CI can assert the grouping contract without a
 * Python runtime; `scripts/check-scanner-grouping.py` runs the REAL scanner against the same names
 * (see docs/reviews/2026-09-14/IMPLEMENTATION_STATUS.md for the recorded run).
 */
import { describe, it, expect } from 'vitest';
import {
  formatRecordingMetadataFilename,
  recordingDateToken,
  recordingFilenameIssue,
  subjectMatchesRecordingToken,
} from '../recordingFilename';

/**
 * Port of `data_scanner._process_path` (trodes_to_nwb 6603412): returns the `(date, animal)` group
 * key the converter uses, or null when the scanner would skip the file.
 *
 * @param {string} filename
 * @returns {{date:number, animal:string}|null}
 */
function converterGroupKey(filename: string): { date: number; animal: string } | null {
  const suffix = filename.slice(filename.lastIndexOf('.'));
  const stem = filename.slice(0, filename.lastIndexOf('.'));
  const parts = stem.split('_');
  if (suffix === '.yml') {
    // `date, animal_name, _ = path.stem.split("_")` — exactly three parts, else ValueError → skipped.
    if (parts.length !== 3) return null;
    const date = Number.parseInt(parts[0], 10);
    if (!/^[+-]?\d+$/.test(parts[0].trim()) || Number.isNaN(date)) return null;
    return { date, animal: parts[1] };
  }
  // `date, animal_name, epoch, tag = path.stem.split("_")` — exactly four parts.
  if (parts.length !== 4) return null;
  if (!/^[+-]?\d+$/.test(parts[0].trim())) return null;
  return { date: Number.parseInt(parts[0], 10), animal: parts[1] };
}

describe('recordingDateToken', () => {
  it('emits the converter integer date token', () => {
    expect(recordingDateToken('2023-06-22')).toBe('20230622');
  });
  it('rejects a non-ISO date rather than emitting a wrong token', () => {
    expect(() => recordingDateToken('06/22/2023')).toThrow(/ISO/);
    expect(() => recordingDateToken('06222023')).toThrow(/ISO/);
  });
});

describe('formatRecordingMetadataFilename', () => {
  it('uses YYYYMMDD and the exact subject token', () => {
    expect(formatRecordingMetadataFilename({ date: '2023-06-22', subjectId: 'Sample' })).toBe(
      '20230622_Sample_metadata.yml'
    );
  });
  it('does not case-fold the subject (the scanner is case-sensitive)', () => {
    expect(formatRecordingMetadataFilename({ date: '2023-11-08', subjectId: 'BS28' })).toBe(
      '20231108_BS28_metadata.yml'
    );
  });
});

describe('converter grouping contract (scanner port)', () => {
  const recording = '20230622_Sample_01_a1.rec';

  it('the app filename lands in the same scanner group as the recording', () => {
    const yml = formatRecordingMetadataFilename({ date: '2023-06-22', subjectId: 'Sample' });
    expect(converterGroupKey(yml)).toEqual(converterGroupKey(recording));
  });

  it('the previous MMDDYYYY / lower-cased spelling did NOT group with the recording (regression pin)', () => {
    expect(converterGroupKey('06222023_sample_metadata.yml')).not.toEqual(converterGroupKey(recording));
    expect(converterGroupKey('20230622_sample_metadata.yml')).not.toEqual(converterGroupKey(recording));
  });

  it('the real sample fixture names group with each other', () => {
    expect(converterGroupKey('20230622_sample_metadata.yml')).toEqual(
      converterGroupKey('20230622_sample_01_a1.rec')
    );
  });

  it('an underscore in the subject makes the scanner skip the metadata file', () => {
    expect(converterGroupKey('20230622_my_rat_metadata.yml')).toBeNull();
  });
});

describe('recordingFilenameIssue', () => {
  it('accepts every real corpus-style token (letters, digits, hyphens, mixed case)', () => {
    for (const id of ['remy', 'BS28', 'CH5', 'SC38', 'sc-92', 'Sample']) {
      expect(recordingFilenameIssue(id)).toBeNull();
    }
  });
  it('blocks an underscore with a converter-specific explanation', () => {
    const issue = recordingFilenameIssue('my_rat');
    expect(issue?.code).toBe('subject_id_not_recording_compatible');
    expect(issue?.message).toMatch(/underscore/);
  });
  it('blocks whitespace and other unsafe characters', () => {
    expect(recordingFilenameIssue('rat 1')?.message).toMatch(/whitespace/);
    expect(recordingFilenameIssue('rat/1')?.code).toBe('subject_id_not_recording_compatible');
  });
  it('blocks a missing subject id', () => {
    expect(recordingFilenameIssue('')?.code).toBe('subject_id_missing');
    expect(recordingFilenameIssue(undefined)?.code).toBe('subject_id_missing');
  });
});

describe('subjectMatchesRecordingToken', () => {
  it('is exact and case-sensitive like the scanner', () => {
    expect(subjectMatchesRecordingToken('Sample', 'Sample')).toBe(true);
    expect(subjectMatchesRecordingToken('sample', 'Sample')).toBe(false);
  });
});
