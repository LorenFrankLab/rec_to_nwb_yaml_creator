/**
 * Importing a file whose problems are business-rule errors, against the REAL validation.
 *
 * A section is left out of an import only for a SCHEMA error. A rule error the form can fix (a
 * repeated name, a stale DIO choice, a duplicate ntrode id) is loaded, and the download gate blocks
 * it until it is fixed: leaving out the whole section lost every item in it, the channel maps'
 * bad channels included. A rule problem the form cannot fix is repaired (or just the offending
 * item or field is left out) at import, and the import summary names it.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'fs';
import path from 'path';
import YAML from 'yaml';
import { importFiles, exportAll } from '../importExport';
import { encodeYaml } from '../../io/yaml';

vi.mock('../../io/yaml', async (importOriginal) => {
  const actual = await importOriginal();
  return { ...actual, downloadYamlFile: vi.fn() };
});

/** The trodes_to_nwb sample session (complete, no issues). */
function sampleSession() {
  return YAML.parse(
    fs.readFileSync(
      path.join(__dirname, '../../__tests__/fixtures/golden/20230622_sample_metadata.yml'),
      'utf8'
    )
  );
}

/** Imports the sample session after `change` edits it. */
async function importChanged(change) {
  const session = sampleSession();
  change(session);
  return importFiles(new File([encodeYaml(session)], 'session.yml', { type: 'text/yaml' }));
}

/** The codes of the errors that block downloading `formData`. */
function blockingCodes(formData) {
  return exportAll(formData).validationIssues.map((issue) => issue.code);
}

describe('importFiles - rule errors the form can fix are loaded, not left out', () => {
  beforeEach(() => {
    vi.spyOn(window, 'alert').mockImplementation(() => {});
    vi.spyOn(window, 'confirm').mockReturnValue(true);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('imports the sample session whole', async () => {
    const result = await importChanged(() => {});

    expect(result.importSummary.excludedFields).toEqual([]);
    expect(result.formData.ntrode_electrode_group_channel_map).toHaveLength(32);
  });

  it.each([
    [
      'two optical fibers with one name',
      'duplicate_opto_device_name',
      (s) => { s.optical_fiber.push({ ...s.optical_fiber[0] }); },
      (fd) => expect(fd.optical_fiber).toHaveLength(2),
    ],
    [
      'two virus injections with one name',
      'duplicate_opto_device_name',
      (s) => { s.virus_injection.push({ ...s.virus_injection[0], hemisphere: 'left' }); },
      (fd) => expect(fd.virus_injection).toHaveLength(2),
    ],
    [
      'a date of birth without seconds',
      'subject_date_of_birth_format',
      (s) => { s.subject.date_of_birth = '2023-01-10T00:00'; },
      (fd) => expect(fd.subject.subject_id).toBe('54321'),
    ],
    [
      'an FsGUI DIO output no event defines',
      'dangling_dio_output',
      (s) => { s.fs_gui_yamls[0].dio_output_name = 'gone'; },
      (fd) => expect(fd.fs_gui_yamls).toHaveLength(2),
    ],
    [
      'two behavioral events with one description',
      'duplicate_behavioral_event_description',
      (s) => { s.behavioral_events.push({ ...s.behavioral_events[0], name: 'zzz' }); },
      (fd) => expect(fd.behavioral_events).toHaveLength(4),
    ],
    [
      'no tasks',
      'no_tasks',
      (s) => { s.tasks = []; },
      (fd) => expect(fd.fs_gui_yamls).toHaveLength(2),
    ],
  ])('loads %s and blocks the download', async (_label, code, change, check) => {
    const result = await importChanged(change);

    expect(result.importSummary.excludedFields).toEqual([]);
    check(result.formData);
    expect(blockingCodes(result.formData)).toContain(code);
  });

  it('loads every channel map, bad channels included, when two ntrodes share an id', async () => {
    const result = await importChanged((s) => {
      s.ntrode_electrode_group_channel_map[1].ntrode_id = s.ntrode_electrode_group_channel_map[0].ntrode_id;
      s.ntrode_electrode_group_channel_map[5].bad_channels = [2];
    });

    expect(result.importSummary.excludedFields).toEqual([]);
    const maps = result.formData.ntrode_electrode_group_channel_map;
    expect(maps).toHaveLength(32);
    expect(maps[5].bad_channels).toEqual([2]);
    expect(blockingCodes(result.formData)).toContain('duplicate_ntrode_id');
  });

  it('still leaves out a section that breaks the schema', async () => {
    const result = await importChanged((s) => { s.cameras[0].meters_per_pixel = 'not a number'; });

    expect(result.importSummary.excludedFields.map((entry) => entry.field)).toEqual(['cameras']);
    expect(result.formData.cameras).toEqual([]);
  });
});

describe('importFiles - rule problems the form cannot fix are repaired at import', () => {
  beforeEach(() => {
    vi.spyOn(window, 'alert').mockImplementation(() => {});
    vi.spyOn(window, 'confirm').mockReturnValue(true);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('leaves out only a channel-map row whose electrode group the file does not define', async () => {
    const result = await importChanged((s) => {
      s.ntrode_electrode_group_channel_map.push({
        ...s.ntrode_electrode_group_channel_map[0],
        ntrode_id: 99,
        electrode_group_id: 77,
      });
    });

    const maps = result.formData.ntrode_electrode_group_channel_map;
    expect(maps).toHaveLength(32);
    expect(maps.map((n) => n.ntrode_id)).not.toContain(99);
    expect(result.importSummary.excludedFields).toEqual([
      expect.objectContaining({
        field: 'ntrode_electrode_group_channel_map (ntrode 99)',
        reason: expect.stringContaining('electrode group 77'),
      }),
    ]);
    expect(blockingCodes(result.formData)).toEqual([]);
  });

  it.each([
    ['optical_fiber', 'removed', (item) => { delete item.reference; }],
    ['virus_injection', 'blank', (item) => { item.reference = '  '; }],
  ])('gives a %s whose reference is %s the reference the form writes', async (key, _how, change) => {
    const result = await importChanged((s) => { change(s[key][0]); });

    expect(result.formData[key]).toHaveLength(1);
    expect(result.formData[key][0].reference).toBe('Bregma at the cortical surface');
    expect(result.importSummary.excludedFields).toEqual([]);
    expect(result.importSummary.changedFields).toEqual([
      expect.objectContaining({
        field: `${key}[0].reference`,
        reason: expect.stringContaining('Bregma at the cortical surface'),
      }),
    ]);
    expect(blockingCodes(result.formData)).toEqual([]);
  });

  it.each([
    ['age', 164],
    ['age__reference', 'conception'],
    ['strain', 5],
  ])('leaves out a subject %s of %j and keeps the rest of the subject', async (field, value) => {
    const result = await importChanged((s) => { s.subject[field] = value; });

    expect(result.formData.subject).not.toHaveProperty(field);
    expect(result.formData.subject.subject_id).toBe('54321');
    expect(result.importSummary.excludedFields).toEqual([
      expect.objectContaining({ field: `subject.${field}`, reason: expect.stringContaining(JSON.stringify(value)) }),
    ]);
    expect(blockingCodes(result.formData)).toEqual([]);
  });
});
