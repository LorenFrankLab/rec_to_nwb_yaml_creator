/**
 * The legacy download's warning gate, exercised against the REAL validation (no mocked `validate`).
 * Each change below gives no error and one warning: it used to block the download outright. Now the
 * download asks once, listing the warning, and downloads only on OK.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { exportAll } from '../importExport';
import { decodeYaml, downloadYamlFile } from '../../io/yaml';

vi.mock('../../io/yaml', async (importOriginal) => {
  const actual = await importOriginal();
  return { ...actual, downloadYamlFile: vi.fn() };
});

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** The realistic workspace export (a clean, complete session), with an ISO age so it has no warning. */
function cleanSession() {
  const model = decodeYaml(
    fs.readFileSync(
      path.join(__dirname, '../../__tests__/fixtures/golden/workspace-export.realistic.yml'),
      'utf8'
    )
  );
  model.subject.age = 'P164D';
  return model;
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
    ['an experimenter name with a middle initial', 'experimenter_name_shape', (m) => { m.experimenter_name = ['Guidera, Jennifer A.']; }],
    ['a strain written as the genotype', 'subject_genotype_strain', (m) => { m.subject.genotype = 'Long Evans'; }],
    ['an unusual camera calibration', 'camera_meters_per_pixel_implausible', (m) => { m.cameras[0].meters_per_pixel = 0.0003; }],
    ['a relative associated-file path', 'associated_file_path_shape', (m) => { m.associated_files[0].path = 'notes/day1.txt'; }],
    ['a placeholder subject id', 'placeholder_subject_id', (m) => { m.subject.subject_id = '54321'; }],
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
    model.subject.subject_id = '54321';
    vi.spyOn(window, 'confirm').mockReturnValue(false);

    const result = exportAll(model);

    expect(result.success).toBe(false);
    expect(result.cancelled).toBe(true);
    expect(downloadYamlFile).not.toHaveBeenCalled();
  });
});
