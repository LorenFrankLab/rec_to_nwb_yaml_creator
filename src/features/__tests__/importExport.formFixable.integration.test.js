/**
 * A legacy upload keeps a value the form can fix, and the download blocks until it is fixed.
 *
 * Exercised against the REAL validation (no mocked `validate`), starting from the sample session
 * with one change each. These values stop trodes_to_nwb, so the download is blocked, but the user
 * can fix each one in the form (rename the fiber, pick the date of birth again, choose a hemisphere,
 * add a task, retype the age): leaving out the whole section they sit in threw away the rest of a
 * valid section. Values the form has no field for are left out on their own and named in the
 * summary.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import YAML from 'yaml';
import { importFiles, exportAll } from '../importExport';
import { downloadYamlFile } from '../../io/yaml';

vi.mock('../../io/yaml', async (importOriginal) => {
  const actual = await importOriginal();
  return { ...actual, downloadYamlFile: vi.fn() };
});

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** The sample session as parsed from its file. */
function sampleSession() {
  return YAML.parse(
    fs.readFileSync(
      path.join(__dirname, '../../__tests__/fixtures/golden/20230622_sample_metadata.yml'),
      'utf8'
    )
  );
}

/**
 * Uploads a session through the legacy import.
 *
 * @param {object} session - The parsed session to write to the file.
 * @returns {Promise<object>} The import result.
 */
function upload(session) {
  return importFiles(new File([YAML.stringify(session)], 'session.yml', { type: 'text/yaml' }));
}

/**
 * The sections and fields the import left out.
 *
 * @param {object} result - The import result.
 * @returns {string[]} The excluded section and field names.
 */
const excluded = (result) => result.importSummary.excludedFields.map((entry) => entry.field);

describe('legacy upload of values the form can fix (real validation)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.window.alert = vi.fn();
    // The sample's placeholder subject id warns; accept warnings so only errors block.
    vi.spyOn(window, 'confirm').mockReturnValue(true);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('keeps two optical fibers with the same name, and blocks the download until one is renamed', async () => {
    const session = sampleSession();
    session.optical_fiber = [session.optical_fiber[0], { ...session.optical_fiber[0] }];

    const result = await upload(session);

    expect(result.formData.optical_fiber).toHaveLength(2);
    expect(excluded(result)).not.toContain('optical_fiber');
    expect(result.importSummary.toFix).toEqual([
      expect.objectContaining({ code: 'duplicate_opto_device_name', path: 'optical_fiber' }),
    ]);

    const blocked = exportAll(result.formData);
    expect(blocked.success).toBe(false);
    expect(blocked.validationIssues).toEqual([
      expect.objectContaining({
        code: 'duplicate_opto_device_name',
        message: expect.stringContaining('More than one optical fiber is named "Fiber 1"'),
      }),
    ]);
    expect(downloadYamlFile).not.toHaveBeenCalled();

    result.formData.optical_fiber[1].name = 'Fiber 2';
    expect(exportAll(result.formData).success).toBe(true);
    expect(downloadYamlFile).toHaveBeenCalledTimes(1);
  });

  it('keeps the subject when its date of birth has no seconds, and blocks the download until it is picked again', async () => {
    const session = sampleSession();
    session.subject.date_of_birth = '2023-01-10T00:00';

    const result = await upload(session);

    expect(result.formData.subject).toEqual(session.subject);
    expect(excluded(result)).not.toContain('subject');

    const blocked = exportAll(result.formData);
    expect(blocked.success).toBe(false);
    expect(blocked.validationIssues).toEqual([
      expect.objectContaining({
        code: 'subject_date_of_birth_format',
        message: expect.stringContaining('"2023-01-10T00:00:00"'),
      }),
    ]);

    // What the form's date field writes when the date is picked again.
    result.formData.subject.date_of_birth = new Date('2023-01-10').toISOString();
    expect(exportAll(result.formData).success).toBe(true);
  });

  it('keeps the subject and a numeric age, and blocks the download until the age is written as text', async () => {
    const session = sampleSession();
    session.subject.age = 164;

    const result = await upload(session);

    expect(result.formData.subject).toEqual(session.subject);
    expect(excluded(result)).not.toContain('subject');

    const blocked = exportAll(result.formData);
    expect(blocked.success).toBe(false);
    expect(blocked.validationIssues).toEqual([
      expect.objectContaining({ code: 'subject_value_type', message: expect.stringContaining('"P164D"') }),
    ]);

    // The Age field writes text.
    result.formData.subject.age = 'P164D';
    expect(exportAll(result.formData).success).toBe(true);
  });

  it('leaves out only the subject values the form has no field for, and names them', async () => {
    const session = sampleSession();
    session.subject.age = ['P164D'];
    session.subject.strain = 42;
    session.subject.age__reference = 'adult';

    const result = await upload(session);

    const { age, strain, age__reference: ageReference, ...rest } = session.subject;
    expect(result.formData.subject).toEqual(rest);
    expect(excluded(result)).not.toContain('subject');
    expect(result.importSummary.excludedFields).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ field: 'subject.age', reason: expect.stringMatching(/^Left out: /) }),
        expect.objectContaining({ field: 'subject.strain', reason: expect.stringContaining('42') }),
        expect.objectContaining({ field: 'subject.age__reference', reason: expect.stringContaining('"adult"') }),
      ])
    );
    expect(exportAll(result.formData).success).toBe(true);
  });

  it('keeps a virus injection with an unknown hemisphere, and blocks the download until one is chosen', async () => {
    const session = sampleSession();
    session.virus_injection[0].hemisphere = 'bilateral';

    const result = await upload(session);

    expect(result.formData.virus_injection).toEqual(session.virus_injection);
    expect(excluded(result)).not.toContain('virus_injection');

    const blocked = exportAll(result.formData);
    expect(blocked.success).toBe(false);
    expect(blocked.validationIssues).toEqual([
      expect.objectContaining({
        code: 'invalid_injection_hemisphere',
        message: expect.stringContaining('hemisphere "bilateral"'),
      }),
    ]);

    result.formData.virus_injection[0].hemisphere = 'left';
    expect(exportAll(result.formData).success).toBe(true);
  });

  it('does not report an empty task list as left out, and blocks the download until a task is added', async () => {
    const session = sampleSession();
    const { tasks } = session;
    session.tasks = [];

    const result = await upload(session);

    expect(result.formData.tasks).toEqual([]);
    expect(excluded(result)).not.toContain('tasks');
    expect(result.importSummary.toFix.map((issue) => issue.code)).toContain('no_tasks');

    const blocked = exportAll(result.formData);
    expect(blocked.success).toBe(false);
    expect(blocked.validationIssues.map((issue) => issue.code)).toContain('no_tasks');

    result.formData.tasks = tasks;
    expect(exportAll(result.formData).success).toBe(true);
  });

  it('still leaves out a section for an error the form cannot fix in place', async () => {
    const session = sampleSession();
    const fiber = session.optical_fiber[0];
    session.optical_fiber = [{ ...fiber, name: '' }, fiber, { ...fiber }];

    const result = await upload(session);

    // The blank name is a schema error: the section is left out, as before.
    expect(excluded(result)).toContain('optical_fiber');
    expect(result.formData.optical_fiber).toEqual([]);
  });
});
