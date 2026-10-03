import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { importFiles, exportAll } from '../importExport';
import { validate } from '../../validation';
import { encodeYaml, formatDeterministicFilename, downloadYamlFile } from '../../io/yaml';
import { emptyFormData } from '../../valueList';

/**
 * Import/Export Logic Tests
 *
 * Tests for extracted import/export functions from App.js.
 * These functions handle:
 * - importFiles: Parse YAML, validate, and prepare form data
 * - exportAll: Validate form data and generate YAML for download
 *
 * Following TDD approach: Tests written FIRST, implementation SECOND.
 */

// Mock dependencies
vi.mock('../../validation', () => ({
  validate: vi.fn(),
}));

vi.mock('../../io/yaml', async (importOriginal) => ({
  encodeYaml: vi.fn(),
  formatDeterministicFilename: vi.fn(),
  // importFiles reads the file with the real decoder; only the export side is mocked.
  decodeYaml: (await importOriginal()).decodeYaml,
  downloadYamlFile: vi.fn(),
}));

vi.mock('../../valueList', () => ({
  emptyFormData: {
    lab: '',
    institution: '',
    experimenter_name: [],
    session_id: '',
    subject: {
      subject_id: '',
      species: '',
      sex: 'U',
    },
    cameras: [],
    electrode_groups: [],
  },
  genderAcronym: () => ['M', 'F', 'U', 'O'],
}));

/** Every message for an import that fails says the loaded form was left as it was. */
const FORM_NOT_CHANGED = 'The form was not changed.';

describe('importExport', () => {
  let mockAlert;
  let mockOnProgress;

  beforeEach(() => {
    // Mock window.alert
    mockAlert = vi.fn();
    global.window.alert = mockAlert;

    // Mock progress callback
    mockOnProgress = vi.fn();

    // Reset all mocks
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('importFiles', () => {
    describe('Error Handling', () => {
      it('returns error when no file provided', async () => {
        // ACT
        const result = await importFiles(null);

        // ASSERT
        expect(result.success).toBe(false);
        expect(result.error).toBe('No file provided');
        expect(result.formData).toBeNull();
      });

      it('returns error when file is undefined', async () => {
        // ACT
        const result = await importFiles(undefined);

        // ASSERT
        expect(result.success).toBe(false);
        expect(result.error).toBe('No file provided');
        expect(result.formData).toBeNull();
      });

      // A file that cannot be read leaves the form as it was: the page applies `formData` only
      // when it is set, so returning an empty form here would wipe what the user had loaded.
      it('returns error and leaves the form alone when file read fails', async () => {
        // ARRANGE
        const file = new File(['content'], 'test.yml', { type: 'text/yaml' });
        // Mock FileReader error
        const originalFileReader = global.FileReader;
        global.FileReader = class {
          readAsText() {
            setTimeout(() => this.onerror(new Error('Read error')), 0);
          }
        };

        try {
          // ACT
          const result = await importFiles(file);

          // ASSERT
          expect(result.success).toBe(false);
          expect(result.error).toContain('Error reading file');
          expect(result.formData).toBeNull();
          expect(mockAlert).toHaveBeenCalledTimes(1);
          expect(mockAlert.mock.calls[0][0]).toContain('Error reading file. Please try again.');
          expect(mockAlert.mock.calls[0][0]).toContain(FORM_NOT_CHANGED);
        } finally {
          // Restore even when an assertion fails, so later tests read files normally
          global.FileReader = originalFileReader;
        }
      });

      it('returns error and leaves the form alone when YAML parsing fails', async () => {
        // ARRANGE
        const invalidYaml = 'invalid: yaml: content: [unclosed';
        const file = new File([invalidYaml], 'test.yml', { type: 'text/yaml' });

        // ACT
        const result = await importFiles(file);

        // ASSERT
        expect(result.success).toBe(false);
        expect(result.error).toContain('Invalid YAML file');
        expect(result.formData).toBeNull();
        expect(mockAlert).toHaveBeenCalledTimes(1);
        expect(mockAlert.mock.calls[0][0]).toContain('Invalid YAML file');
        expect(mockAlert.mock.calls[0][0]).toContain(FORM_NOT_CHANGED);
      });

      // An alias inside the block its anchor names makes the data loop forever.
      it('returns error and leaves the form alone when an alias refers back to its own anchor', async () => {
        validate.mockReturnValue([]);
        const file = new File(['lab: Test Lab\nsubject: &s\n  self: *s\n'], 'test.yml', { type: 'text/yaml' });

        const result = await importFiles(file);

        expect(result.success).toBe(false);
        expect(result.error).toContain('Invalid YAML file');
        expect(result.error).toContain('refers to itself');
        expect(result.formData).toBeNull();
        expect(mockAlert).toHaveBeenCalledTimes(1);
        expect(mockAlert.mock.calls[0][0]).toContain('refers to itself');
        expect(mockAlert.mock.calls[0][0]).toContain(FORM_NOT_CHANGED);
      });

      // TextEdit saves a new document as rich text unless it is made plain text first.
      it('returns error and says how to save as plain text for a rich-text (RTF) file', async () => {
        const rtf =
          '{\\rtf1\\ansi\\ansicpg1252\\cocoartf2761\n' +
          '{\\fonttbl\\f0\\fswiss\\fcharset0 Helvetica;}\n' +
          '\\f0\\fs24 \\cf0 lab: Loren Frank Lab\\\n}';
        const file = new File([rtf], 'test.yml', { type: 'text/yaml' });

        const result = await importFiles(file);

        expect(result.success).toBe(false);
        expect(result.error).toContain('rich text');
        expect(result.formData).toBeNull();
        expect(mockAlert).toHaveBeenCalledTimes(1);
        expect(mockAlert.mock.calls[0][0]).toContain('Format > Make Plain Text');
        expect(mockAlert.mock.calls[0][0]).toContain(FORM_NOT_CHANGED);
      });

      it.each([
        ['an empty file', ''],
        ['only a comment', '# lab: Loren Frank Lab\n'],
        ['plain text', 'just some notes'],
        ['a list', '- a\n- b'],
        ['an empty mapping', '{}'],
        ['a mapping with none of the form fields', 'name: analysis\ndependencies:\n  - python=3.11\n'],
      ])('returns error and leaves the form alone for %s (no metadata)', async (_label, content) => {
        // A file that got past this check would be validated; report that as a passing file so a
        // regression fails on the result below instead of hanging.
        validate.mockReturnValue([]);
        const file = new File([content], 'test.yml', { type: 'text/yaml' });

        const result = await importFiles(file);

        expect(result.success).toBe(false);
        expect(result.error).toContain('metadata');
        expect(result.formData).toBeNull();
        expect(mockAlert).toHaveBeenCalledTimes(1);
        expect(mockAlert.mock.calls[0][0]).toContain('No metadata was found in this file');
        expect(mockAlert.mock.calls[0][0]).toContain(FORM_NOT_CHANGED);
      });

      // An error the import does not expect (e.g. from a rule meeting an odd value) must still
      // settle with a message: it used to leave the upload doing nothing at all.
      it('returns error and leaves the form alone when the import fails unexpectedly', async () => {
        validate.mockImplementation(() => {
          throw new TypeError('Cannot read properties of null');
        });
        const file = new File(['lab: Test Lab\n'], 'test.yml', { type: 'text/yaml' });

        const result = await Promise.race([
          importFiles(file),
          new Promise((resolve) => {
            setTimeout(() => resolve('the import never finished'), 1000);
          }),
        ]);

        expect(result).not.toBe('the import never finished');
        expect(result.success).toBe(false);
        expect(result.error).toContain('Cannot read properties of null');
        expect(result.formData).toBeNull();
        expect(mockAlert).toHaveBeenCalledTimes(1);
        expect(mockAlert.mock.calls[0][0]).toContain('Cannot read properties of null');
        expect(mockAlert.mock.calls[0][0]).toContain(FORM_NOT_CHANGED);
      });
    });

    describe('Valid YAML Import', () => {
      it('imports valid YAML with no validation errors', async () => {
        // ARRANGE
        const yamlContent = `
lab: Test Lab
institution: Test University
session_id: TEST001
experimenter_name:
  - Doe, John
subject:
  subject_id: RAT001
  species: Rattus norvegicus
  sex: M
`;
        const file = new File([yamlContent], 'test.yml', { type: 'text/yaml' });

        // Mock validation - no errors
        validate.mockReturnValue([]);

        // ACT
        const result = await importFiles(file);

        // ASSERT
        expect(result.success).toBe(true);
        expect(result.error).toBeNull();
        expect(result.formData).toBeDefined();
        expect(result.formData.lab).toBe('Test Lab');
        expect(result.formData.institution).toBe('Test University');
        expect(result.formData.session_id).toBe('TEST001');
        expect(result.formData.experimenter_name).toEqual(['Doe, John']);
        expect(result.formData.subject.subject_id).toBe('RAT001');
        expect(result.formData.subject.species).toBe('Rattus norvegicus');
        expect(result.formData.subject.sex).toBe('M');

        // Check import summary for successful import
        expect(result.importSummary).toBeDefined();
        expect(result.importSummary.hasExclusions).toBe(false);
        expect(result.importSummary.excludedFields).toHaveLength(0);
        expect(result.importSummary.importedFields).toContain('lab');
        expect(result.importSummary.importedFields).toContain('institution');
        expect(result.importSummary.importedFields).toContain('session_id');
        expect(result.importSummary.importedFields).toContain('experimenter_name');
      });

      it('fills in missing keys with emptyFormData defaults', async () => {
        // ARRANGE
        const minimalYaml = `
lab: Test Lab
institution: Test University
`;
        const file = new File([minimalYaml], 'test.yml', { type: 'text/yaml' });

        // Mock validation - no errors
        validate.mockReturnValue([]);

        // ACT
        const result = await importFiles(file);

        // ASSERT
        expect(result.success).toBe(true);
        expect(result.formData.lab).toBe('Test Lab');
        expect(result.formData.institution).toBe('Test University');
        // Should have defaults for missing keys
        expect(result.formData.session_id).toBe('');
        expect(result.formData.experimenter_name).toEqual([]);
        expect(result.formData.subject).toEqual(emptyFormData.subject);
      });

      // PyYAML writes &id001 / *id001 when a script dumps one dict in several places. Each place
      // must become its own object, or editing one camera would edit the other.
      it('imports each alias of an anchored block as a separate object', async () => {
        const yamlContent = `
lab: Test Lab
cameras:
  - &camera
    id: 0
    model: TestCam
  - *camera
`;
        validate.mockReturnValue([]);
        const file = new File([yamlContent], 'test.yml', { type: 'text/yaml' });

        const result = await importFiles(file);

        expect(result.success).toBe(true);
        expect(result.formData.cameras).toEqual([
          { id: 0, model: 'TestCam' },
          { id: 0, model: 'TestCam' },
        ]);
        expect(result.formData.cameras[1]).not.toBe(result.formData.cameras[0]);
      });
    });

    describe('Partial Import with Validation Errors', () => {
      it('imports a section whose only issues are warnings', async () => {
        // ARRANGE — a warning is advisory: the value is kept and flagged, never discarded.
        const yamlContent = `
lab: Test Lab
subject:
  subject_id: "54321"
  species: Rattus norvegicus
  sex: M
`;
        const file = new File([yamlContent], 'test.yml', { type: 'text/yaml' });

        validate.mockReturnValue([
          {
            path: 'subject.subject_id',
            code: 'placeholder_subject_id',
            severity: 'warning',
            message: 'Subject ID "54321" looks like a template placeholder.',
          },
        ]);

        // ACT
        const result = await importFiles(file);

        // ASSERT
        expect(result.success).toBe(true);
        expect(result.formData.subject.subject_id).toBe('54321');
        expect(result.importSummary.importedFields).toContain('subject');
        expect(result.importSummary.excludedFields).toEqual([]);
        expect(result.importSummary.hasExclusions).toBe(false);
      });

      it('still excludes a section that has an error alongside a warning', async () => {
        // ARRANGE
        const yamlContent = `
lab: Test Lab
subject:
  subject_id: "54321"
  species: rat
`;
        const file = new File([yamlContent], 'test.yml', { type: 'text/yaml' });

        validate.mockReturnValue([
          {
            path: 'subject.subject_id',
            code: 'placeholder_subject_id',
            severity: 'warning',
            message: 'Subject ID "54321" looks like a template placeholder.',
          },
          {
            path: 'subject.species',
            code: 'invalid_species',
            severity: 'error',
            message: 'Species "rat" is not DANDI-valid.',
          },
        ]);

        // ACT
        const result = await importFiles(file);

        // ASSERT
        expect(result.importSummary.excludedFields).toHaveLength(1);
        expect(result.importSummary.excludedFields[0].field).toBe('subject');
        expect(result.importSummary.excludedFields[0].reason).toContain('not DANDI-valid');
        expect(result.formData.subject).toEqual(emptyFormData.subject);
      });

      it('excludes fields with validation errors and imports valid fields', async () => {
        // ARRANGE
        const yamlContent = `
lab: Test Lab
institution: Test University
cameras:
  - id: 1.5
    manufacturer: BadCamera
`;
        const file = new File([yamlContent], 'test.yml', { type: 'text/yaml' });

        // Mock validation - errors in cameras
        validate.mockReturnValue([
          {
            path: 'cameras[0].id',
            code: 'type',
            severity: 'error',
            message: 'cameras[0].id must be integer',
          },
        ]);

        // ACT
        const result = await importFiles(file);

        // ASSERT
        expect(result.success).toBe(true);
        expect(result.error).toBeNull();
        expect(result.formData.lab).toBe('Test Lab');
        expect(result.formData.institution).toBe('Test University');
        // cameras should be excluded (has validation error)
        expect(result.formData.cameras).toEqual(emptyFormData.cameras || []);

        // Check import summary instead of alert
        expect(result.importSummary).toBeDefined();
        expect(result.importSummary.hasExclusions).toBe(true);
        expect(result.importSummary.excludedFields).toHaveLength(1);
        expect(result.importSummary.excludedFields[0].field).toBe('cameras');
        expect(result.importSummary.excludedFields[0].reason).toContain('cameras[0].id must be integer');
        expect(result.importSummary.importedFields).toContain('lab');
        expect(result.importSummary.importedFields).toContain('institution');
      });

      it('extracts top-level field from nested error paths', async () => {
        // ARRANGE
        const yamlContent = `
lab: Test Lab
electrode_groups:
  - id: 1
    location: CA1
    device_type: tetrode_12.5
`;
        const file = new File([yamlContent], 'test.yml', { type: 'text/yaml' });

        // Mock validation - nested error
        validate.mockReturnValue([
          {
            path: 'electrode_groups[0].device_type',
            code: 'pattern',
            severity: 'error',
            message: 'Invalid device type',
          },
        ]);

        // ACT
        const result = await importFiles(file);

        // ASSERT
        expect(result.success).toBe(true);
        // electrode_groups (top-level field) should be excluded
        expect(result.formData.electrode_groups).toEqual(emptyFormData.electrode_groups || []);
        expect(result.formData.lab).toBe('Test Lab'); // Valid field imported
      });

      it('handles type mismatch between YAML and emptyFormData (during partial import)', async () => {
        // ARRANGE
        const yamlContent = `
lab: Test Lab
experimenter_name: "Doe, John"
cameras:
  - id: 1.5
`;
        const file = new File([yamlContent], 'test.yml', { type: 'text/yaml' });

        // Mock validation - error in cameras (triggers partial import logic)
        validate.mockReturnValue([
          {
            path: 'cameras[0].id',
            code: 'type',
            severity: 'error',
            message: 'cameras[0].id must be integer',
          },
        ]);

        // ACT
        const result = await importFiles(file);

        // ASSERT
        expect(result.success).toBe(true);
        // experimenter_name should NOT be imported (type mismatch: string vs array)
        expect(result.formData.experimenter_name).toEqual([]);
        expect(result.formData.lab).toBe('Test Lab');
      });

      it('does not list a type-mismatched field as imported, and surfaces it as excluded', async () => {
        // ARRANGE: experimenter_name is a string but the form expects an array, so it is
        // skipped by the type-match gate. The summary must NOT claim it was imported, and
        // must not silently drop it either.
        const yamlContent = `
lab: Test Lab
experimenter_name: "Doe, John"
cameras:
  - id: 1.5
`;
        const file = new File([yamlContent], 'test.yml', { type: 'text/yaml' });

        validate.mockReturnValue([
          {
            path: 'cameras[0].id',
            code: 'type',
            severity: 'error',
            message: 'cameras[0].id must be integer',
          },
        ]);

        // ACT
        const result = await importFiles(file);

        // ASSERT
        expect(result.formData.experimenter_name).toEqual([]); // not actually imported
        expect(result.importSummary.importedFields).not.toContain('experimenter_name');
        expect(result.importSummary.importedFields).toContain('lab'); // genuinely imported
        const mismatch = result.importSummary.excludedFields.find(
          (entry) => entry.field === 'experimenter_name'
        );
        expect(mismatch).toBeDefined();
        expect(mismatch.reason).toMatch(/type/i);
      });

      it('surfaces a document-level issue AND a section exclusion together', async () => {
        // ARRANGE: the three excluded-field accumulation sites (section, document,
        // type-mismatch) feed one array; a section error and a document-level error must
        // coexist without shadowing each other.
        const yamlContent = `
lab: Test Lab
cameras:
  - id: 1.5
`;
        const file = new File([yamlContent], 'test.yml', { type: 'text/yaml' });

        validate.mockReturnValue([
          { path: 'cameras[0].camera_name', code: 'required', severity: 'error', message: 'camera_name is required' },
          { path: '', code: 'type', severity: 'error', message: 'must be object' },
        ]);

        // ACT
        const result = await importFiles(file);

        // ASSERT
        expect(result.importSummary.hasExclusions).toBe(true);
        const fields = result.importSummary.excludedFields.map((e) => e.field);
        expect(fields).toContain('cameras');
        expect(fields).toContain('document');
      });

      it('surfaces every type-mismatched field separately (one excluded entry each)', async () => {
        // ARRANGE: experimenter_name (expects array) as a string AND session_id (expects
        // string) as a number — both skipped on type mismatch, both must be surfaced.
        const yamlContent = `
lab: Test Lab
experimenter_name: "Doe, John"
session_id: 12345
cameras:
  - id: 1.5
`;
        const file = new File([yamlContent], 'test.yml', { type: 'text/yaml' });

        validate.mockReturnValue([
          { path: 'cameras[0].id', code: 'type', severity: 'error', message: 'cameras[0].id must be integer' },
        ]);

        // ACT
        const result = await importFiles(file);

        // ASSERT
        expect(result.formData.experimenter_name).toEqual([]);
        expect(result.formData.session_id).toBe('');
        const mismatched = result.importSummary.excludedFields.filter((e) =>
          /type mismatch/i.test(e.reason)
        );
        expect(mismatched.map((e) => e.field).sort()).toEqual(['experimenter_name', 'session_id']);
        expect(result.importSummary.importedFields).not.toContain('experimenter_name');
        expect(result.importSummary.importedFields).not.toContain('session_id');
      });

      it('fixes invalid subject.sex to U if not in valid list (during partial import)', async () => {
        // ARRANGE
        const yamlContent = `
lab: Test Lab
subject:
  subject_id: RAT001
  species: Rattus norvegicus
  sex: invalid
cameras:
  - id: 1.5
`;
        const file = new File([yamlContent], 'test.yml', { type: 'text/yaml' });

        // Mock validation - error in cameras (triggers partial import logic)
        validate.mockReturnValue([
          {
            path: 'cameras[0].id',
            code: 'type',
            severity: 'error',
            message: 'cameras[0].id must be integer',
          },
        ]);

        // ACT
        const result = await importFiles(file);

        // ASSERT
        expect(result.success).toBe(true);
        expect(result.formData.subject.sex).toBe('U'); // Fixed to U during partial import
        expect(result.formData.subject.subject_id).toBe('RAT001');
      });

      it('surfaces a document-level validation issue (empty path) instead of silently dropping it', async () => {
        // ARRANGE
        const yamlContent = `lab: Test Lab`;
        const file = new File([yamlContent], 'test.yml', { type: 'text/yaml' });

        // A root-level error has an empty top-level field; it must still be reported so
        // no validation issue is silently swallowed from the partial-import summary.
        validate.mockReturnValue([
          {
            path: '',
            code: 'type',
            severity: 'error',
            message: 'must be object',
          },
        ]);

        // ACT
        const result = await importFiles(file);

        // ASSERT
        expect(result.success).toBe(true);
        expect(result.importSummary.hasExclusions).toBe(true);
        const docEntry = result.importSummary.excludedFields.find(
          (entry) => entry.field === 'document'
        );
        expect(docEntry).toBeDefined();
        expect(docEntry.reason).toContain('must be object');
      });

      it('initializes subject if missing from YAML', async () => {
        // ARRANGE
        const yamlContent = `
lab: Test Lab
institution: Test University
`;
        const file = new File([yamlContent], 'test.yml', { type: 'text/yaml' });

        // Mock validation - no errors
        validate.mockReturnValue([]);

        // ACT
        const result = await importFiles(file);

        // ASSERT
        expect(result.success).toBe(true);
        expect(result.formData.subject).toEqual(emptyFormData.subject);
      });
    });

    // pynwb's Subject accepts only its own fields, and the form has no way to remove another one,
    // so the import leaves such a field out and says so in the summary.
    describe('Subject fields the NWB subject does not have', () => {
      const yamlContent = `
lab: Test Lab
subject:
  subject_id: RAT001
  species: Rattus norvegicus
  sex: M
  age: P90D
  weight_unit: g
  nickname: Remy
`;

      it('leaves them out of a clean import and names each one in the summary', async () => {
        const file = new File([yamlContent], 'test.yml', { type: 'text/yaml' });
        validate.mockReturnValue([]);

        const result = await importFiles(file);

        expect(result.success).toBe(true);
        expect(result.formData.subject).toEqual({
          subject_id: 'RAT001',
          species: 'Rattus norvegicus',
          sex: 'M',
          age: 'P90D',
        });
        // Validation ran on the subject without them, so they cannot exclude the whole subject.
        expect(validate.mock.calls[0][0].subject).not.toHaveProperty('weight_unit');
        expect(result.importSummary.importedFields).toContain('subject');
        expect(result.importSummary.hasExclusions).toBe(true);
        expect(result.importSummary.excludedFields).toEqual([
          expect.objectContaining({ field: 'subject.weight_unit', reason: expect.stringContaining('"weight_unit"') }),
          expect.objectContaining({ field: 'subject.nickname', reason: expect.stringContaining('"nickname"') }),
        ]);
      });

      it('lists them beside the sections a partial import leaves out', async () => {
        const file = new File([yamlContent], 'test.yml', { type: 'text/yaml' });
        validate.mockReturnValue([
          { path: 'lab', code: 'pattern', severity: 'error', message: 'lab is wrong' },
        ]);

        const result = await importFiles(file);

        expect(result.formData.subject).not.toHaveProperty('nickname');
        expect(result.importSummary.excludedFields.map((entry) => entry.field)).toEqual([
          'lab',
          'subject.weight_unit',
          'subject.nickname',
        ]);
      });
    });

    describe('Progress Callback', () => {
      it('calls onProgress callback during import', async () => {
        // ARRANGE
        const yamlContent = `lab: Test Lab`;
        const file = new File([yamlContent], 'test.yml', { type: 'text/yaml' });
        validate.mockReturnValue([]);

        // ACT
        const result = await importFiles(file, { onProgress: mockOnProgress });

        // ASSERT
        expect(result.success).toBe(true);
        expect(mockOnProgress).toHaveBeenCalled();
      });
    });
  });

  describe('exportAll', () => {
    const mockModel = {
      lab: 'Test Lab',
      institution: 'Test University',
      session_id: 'TEST001',
      experimenter_name: ['Doe, John'],
      subject: {
        subject_id: 'RAT001',
        species: 'Rattus norvegicus',
        sex: 'M',
      },
    };

    describe('Successful Export', () => {
      it('validates and exports model when no validation errors', () => {
        // ARRANGE
        validate.mockReturnValue([]); // No errors
        encodeYaml.mockReturnValue('encoded: yaml');
        formatDeterministicFilename.mockReturnValue('20230622_RAT001_metadata.yml');

        // ACT
        const result = exportAll(mockModel);

        // ASSERT
        expect(result.success).toBe(true);
        expect(result.error).toBeNull();
        expect(result.validationIssues).toEqual([]);
        expect(validate).toHaveBeenCalledWith(mockModel);
        expect(encodeYaml).toHaveBeenCalledWith(mockModel);
        expect(formatDeterministicFilename).toHaveBeenCalledWith(mockModel);
        expect(result.yaml).toBe('encoded: yaml');
        expect(result.filename).toBe('20230622_RAT001_metadata.yml');
      });

      it('calls onProgress callback during export', () => {
        // ARRANGE
        validate.mockReturnValue([]);
        encodeYaml.mockReturnValue('yaml');
        formatDeterministicFilename.mockReturnValue('test.yml');

        // ACT
        const result = exportAll(mockModel, { onProgress: mockOnProgress });

        // ASSERT
        expect(result.success).toBe(true);
        expect(mockOnProgress).toHaveBeenCalled();
      });

      it('does not mutate the original model', () => {
        // ARRANGE
        validate.mockReturnValue([]);
        encodeYaml.mockReturnValue('yaml');
        formatDeterministicFilename.mockReturnValue('test.yml');
        const originalModel = { ...mockModel };

        // ACT
        exportAll(mockModel);

        // ASSERT
        expect(mockModel).toEqual(originalModel);
      });
    });

    describe('Validation Errors', () => {
      it('returns validation issues when validation fails', () => {
        // ARRANGE
        const issues = [
          {
            path: 'lab',
            code: 'required',
            severity: 'error',
            message: 'lab is required',
            instancePath: '/lab',
          },
          {
            path: 'cameras',
            code: 'missing_camera',
            severity: 'error',
            message: 'cameras array required when camera_ids present',
          },
        ];
        validate.mockReturnValue(issues);

        // ACT
        const result = exportAll(mockModel);

        // ASSERT
        expect(result.success).toBe(false);
        expect(result.error).toBe('Validation failed');
        expect(result.validationIssues).toEqual(issues);
        expect(result.yaml).toBeNull();
        expect(result.filename).toBeNull();
        // Should not call encode/format when validation fails
        expect(encodeYaml).not.toHaveBeenCalled();
        expect(formatDeterministicFilename).not.toHaveBeenCalled();
      });

      it('categorizes schema vs rules validation issues', () => {
        // ARRANGE
        const issues = [
          {
            path: 'lab',
            code: 'required',
            severity: 'error',
            message: 'lab is required',
            instancePath: '/lab', // Schema validation
          },
          {
            path: 'cameras',
            code: 'missing_camera',
            severity: 'error',
            message: 'cameras required',
            // No instancePath = rules validation
          },
        ];
        validate.mockReturnValue(issues);

        // ACT
        const result = exportAll(mockModel);

        // ASSERT
        expect(result.success).toBe(false);
        expect(result.validationIssues).toHaveLength(2);
        // Both schema and rules errors should be returned
        const schemaError = result.validationIssues.find(i => i.instancePath);
        const rulesError = result.validationIssues.find(i => !i.instancePath);
        expect(schemaError).toBeDefined();
        expect(rulesError).toBeDefined();
      });
    });

    // Errors block the download; warnings are advisory and go into ONE confirm that lists them.
    describe('Warnings', () => {
      const error = {
        path: 'lab',
        code: 'required',
        severity: 'error',
        message: 'lab is required',
        instancePath: '/lab',
      };
      const subjectWarning = {
        path: 'subject.subject_id',
        code: 'placeholder_subject_id',
        severity: 'warning',
        message: 'Subject ID "54321" looks like a template placeholder.',
      };
      const cameraWarning = {
        path: 'cameras[0].meters_per_pixel',
        code: 'camera_meters_per_pixel_implausible',
        severity: 'warning',
        message: 'Confirm the tracking calibration.',
      };

      beforeEach(() => {
        encodeYaml.mockReturnValue('encoded: yaml');
        formatDeterministicFilename.mockReturnValue('20230622_RAT001_metadata.yml');
      });

      it('downloads without asking when there are no warnings', () => {
        validate.mockReturnValue([]);
        const confirmSpy = vi.spyOn(window, 'confirm');

        const result = exportAll(mockModel);

        expect(result.success).toBe(true);
        expect(confirmSpy).not.toHaveBeenCalled();
        expect(downloadYamlFile).toHaveBeenCalledTimes(1);
      });

      it('asks once, listing every warning on its own line, and downloads on OK', () => {
        validate.mockReturnValue([cameraWarning, subjectWarning]);
        const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);

        const result = exportAll(mockModel);

        expect(confirmSpy).toHaveBeenCalledTimes(1);
        const message = confirmSpy.mock.calls[0][0];
        const lines = message.split('\n');
        expect(lines).toContain(
          '- Cameras 1, meters per pixel: Confirm the tracking calibration.'
        );
        expect(lines).toContain(
          '- Subject, subject id: Subject ID "54321" looks like a template placeholder.'
        );
        expect(message).toMatch(/2 warnings/);
        expect(result.success).toBe(true);
        expect(result.warnings).toEqual([cameraWarning, subjectWarning]);
        expect(downloadYamlFile).toHaveBeenCalledTimes(1);
        expect(downloadYamlFile).toHaveBeenCalledWith('20230622_RAT001_metadata.yml', 'encoded: yaml');
      });

      it('does not download when the warnings are cancelled', () => {
        validate.mockReturnValue([subjectWarning]);
        const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);

        const result = exportAll(mockModel);

        expect(confirmSpy).toHaveBeenCalledTimes(1);
        expect(confirmSpy.mock.calls[0][0]).toMatch(/1 warning\b/);
        expect(result.success).toBe(false);
        expect(result.cancelled).toBe(true);
        // Nothing to mark on the form: the user chose to go back, no field is in error.
        expect(result.validationIssues).toEqual([]);
        expect(result.yaml).toBeNull();
        expect(encodeYaml).not.toHaveBeenCalled();
        expect(downloadYamlFile).not.toHaveBeenCalled();
      });

      it('blocks on errors without asking, and reports only the errors', () => {
        validate.mockReturnValue([error, subjectWarning]);
        const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);

        const result = exportAll(mockModel);

        expect(confirmSpy).not.toHaveBeenCalled();
        expect(result.success).toBe(false);
        expect(result.error).toBe('Validation failed');
        expect(result.validationIssues).toEqual([error]);
        expect(downloadYamlFile).not.toHaveBeenCalled();
      });
    });

    // The legacy form adds its own rules to the shared validation (see legacyFormRules).
    it('blocks a session with no tasks', () => {
      validate.mockReturnValue([]);
      const confirmSpy = vi.spyOn(window, 'confirm');

      const result = exportAll({ ...mockModel, tasks: [] });

      expect(result.success).toBe(false);
      expect(result.validationIssues).toEqual([
        expect.objectContaining({ path: 'tasks', code: 'no_tasks', severity: 'error' }),
      ]);
      expect(confirmSpy).not.toHaveBeenCalled();
      expect(downloadYamlFile).not.toHaveBeenCalled();
    });

    describe('Edge Cases', () => {
      it('handles null model gracefully', () => {
        // ARRANGE
        validate.mockReturnValue([
          {
            path: 'model',
            code: 'required',
            severity: 'error',
            message: 'Model is required',
          },
        ]);

        // ACT
        const result = exportAll(null);

        // ASSERT
        expect(result.success).toBe(false);
        expect(result.error).toBe('Validation failed');
      });

      it('handles undefined model gracefully', () => {
        // ARRANGE
        validate.mockReturnValue([
          {
            path: 'model',
            code: 'required',
            severity: 'error',
            message: 'Model is required',
          },
        ]);

        // ACT
        const result = exportAll(undefined);

        // ASSERT
        expect(result.success).toBe(false);
        expect(result.error).toBe('Validation failed');
      });

      it('handles empty object model', () => {
        // ARRANGE
        validate.mockReturnValue([]);
        encodeYaml.mockReturnValue('{}');
        formatDeterministicFilename.mockReturnValue('empty.yml');

        // ACT
        const result = exportAll({});

        // ASSERT
        expect(result.success).toBe(true);
        expect(result.yaml).toBe('{}');
      });
    });
  });

  describe('Integration: Import-Export Round Trip', () => {
    it('preserves data through import-export cycle', async () => {
      // ARRANGE
      const originalYaml = `
lab: Test Lab
institution: Test University
session_id: TEST001
experimenter_name:
  - Doe, John
subject:
  subject_id: RAT001
  species: Rattus norvegicus
  sex: M
`;
      const file = new File([originalYaml], 'test.yml', { type: 'text/yaml' });

      // Mock validation - no errors
      validate.mockReturnValue([]);
      encodeYaml.mockImplementation((model) => originalYaml.trim());

      // ACT - Import
      const importResult = await importFiles(file);

      // ACT - Export
      const exportResult = exportAll(importResult.formData);

      // ASSERT
      expect(importResult.success).toBe(true);
      expect(exportResult.success).toBe(true);
      expect(exportResult.yaml).toBe(originalYaml.trim());
    });
  });
});
