/**
 * The download's warning gate, exercised against the REAL validation (no mocked `validate`). Each
 * change below gives no error and one warning: the download asks once, listing the warning, and
 * downloads only on OK.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'fs';
import path from 'path';
import YAML from 'yaml';
import { exportAll } from '../importExport';
import { downloadYamlFile } from '../../io/yaml';

vi.mock('../../io/yaml', async (importOriginal) => {
  const actual = await importOriginal();
  return { ...actual, downloadYamlFile: vi.fn() };
});

/** The trodes_to_nwb sample session (complete, no warnings). */
function cleanSession() {
  return YAML.parse(
    fs.readFileSync(
      path.join(__dirname, '../../__tests__/fixtures/golden/20230622_sample_metadata.yml'),
      'utf8'
    )
  );
}

describe('exportAll warning gate (real validation)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('downloads a clean session without asking', () => {
    const confirmSpy = vi.spyOn(window, 'confirm');

    const result = exportAll(cleanSession());

    expect(result.validationIssues).toEqual([]);
    expect(result.warnings).toEqual([]);
    expect(result.success).toBe(true);
    expect(confirmSpy).not.toHaveBeenCalled();
    expect(downloadYamlFile).toHaveBeenCalledTimes(1);
  });

  it.each([
    ['an age that is not ISO 8601', 'subject_age_format', (m) => { m.subject.age = 'P164'; }],
    ['an empty video list', 'no_associated_videos', (m) => { m.associated_video_files = []; }],
    ['a second virus injection', 'multiple_virus_injections', (m) => {
      m.virus_injection.push({ ...m.virus_injection[0], name: 'Injection 2' });
    }],
    ['a subject id with an underscore', 'subject_id_not_recording_compatible', (m) => { m.subject.subject_id = 'rat_01'; }],
  ])('asks once about %s and downloads on OK', (_label, code, change) => {
    const model = cleanSession();
    change(model);
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);

    const result = exportAll(model);

    expect(result.validationIssues).toEqual([]);
    expect(result.warnings.map((warning) => warning.code)).toEqual([code]);
    expect(confirmSpy).toHaveBeenCalledTimes(1);
    expect(confirmSpy.mock.calls[0][0]).toContain(result.warnings[0].message);
    expect(result.success).toBe(true);
    expect(downloadYamlFile).toHaveBeenCalledTimes(1);
  });

  it('downloads nothing when the warning is cancelled', () => {
    const model = cleanSession();
    model.subject.age = 'P164';
    vi.spyOn(window, 'confirm').mockReturnValue(false);

    const result = exportAll(model);

    expect(result.success).toBe(false);
    expect(result.cancelled).toBe(true);
    expect(downloadYamlFile).not.toHaveBeenCalled();
  });
});
