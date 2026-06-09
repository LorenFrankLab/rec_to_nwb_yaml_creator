/**
 * Unit tests for `extractRecordingDate` — deriving a recording day's ISO date from
 * an imported flat YAML model (which carries NO date field of its own).
 */
import { describe, it, expect } from 'vitest';
import { extractRecordingDate } from '../yamlImportPlan';

describe('extractRecordingDate', () => {
  it('parses the {mmddYYYY}_{subject}_metadata.yml filename convention (primary)', () => {
    expect(extractRecordingDate({}, '06222023_remy_metadata.yml')).toBe('2023-06-22');
  });

  it('parses the filename even when session_id is present (filename wins)', () => {
    expect(
      extractRecordingDate({ session_id: 'remy_19991231' }, '06222023_remy_metadata.yml')
    ).toBe('2023-06-22');
  });

  it('falls back to session_id of the form {anything}_{YYYYMMDD}', () => {
    expect(extractRecordingDate({ session_id: 'remy_20230622' }, 'weird-name.yml')).toBe(
      '2023-06-22'
    );
  });

  it('falls back to session_id when the filename has no date', () => {
    expect(extractRecordingDate({ session_id: 'totoro_20240115' }, null)).toBe('2024-01-15');
  });

  it('returns null when neither filename nor session_id yields a valid date', () => {
    expect(extractRecordingDate({ session_id: 'no_date_here' }, 'nope.yml')).toBeNull();
    expect(extractRecordingDate({}, undefined)).toBeNull();
  });

  it('rejects an invalid calendar date in the filename (month 13)', () => {
    expect(extractRecordingDate({}, '13012023_remy_metadata.yml')).toBeNull();
  });

  it('rejects an invalid calendar date in session_id (day 32)', () => {
    expect(extractRecordingDate({ session_id: 'remy_20230632' }, 'x.yml')).toBeNull();
  });

  it('never throws on a non-object flatModel or odd sourceName', () => {
    expect(extractRecordingDate(null, null)).toBeNull();
    expect(extractRecordingDate(undefined, 123)).toBeNull();
    expect(extractRecordingDate('str', {})).toBeNull();
  });
});
