import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { importFiles, exportAll } from '../importExport';
import { validate } from '../../validation';
import { encodeYaml, formatDeterministicFilename } from '../../io/yaml';
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

vi.mock('../../io/yaml', () => ({
  encodeYaml: vi.fn(),
  formatDeterministicFilename: vi.fn(),
  decodeYaml: vi.fn(),
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

      it('returns error and empty form data when file read fails', async () => {
        // ARRANGE
        const file = new File(['content'], 'test.yml', { type: 'text/yaml' });
        // Mock FileReader error
        const originalFileReader = global.FileReader;
        global.FileReader = class {
          readAsText() {
            setTimeout(() => this.onerror(new Error('Read error')), 0);
          }
        };

        // ACT
        const result = await importFiles(file);

        // ASSERT
        expect(result.success).toBe(false);
        expect(result.error).toContain('Error reading file');
        expect(result.formData).toEqual(emptyFormData);
        expect(mockAlert).toHaveBeenCalledWith('Error reading file. Please try again.');

        // Cleanup
        global.FileReader = originalFileReader;
      });

      it('returns error and empty form data when YAML parsing fails', async () => {
        // ARRANGE
        const invalidYaml = 'invalid: yaml: content: [unclosed';
        const file = new File([invalidYaml], 'test.yml', { type: 'text/yaml' });

        // ACT
        const result = await importFiles(file);

        // ASSERT
        expect(result.success).toBe(false);
        expect(result.error).toContain('Invalid YAML file');
        expect(result.formData).toEqual(emptyFormData);
        expect(mockAlert).toHaveBeenCalled();
        expect(mockAlert.mock.calls[0][0]).toContain('Invalid YAML file');
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
    });

    describe('Partial Import with Validation Errors', () => {
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
        expect(mockAlert).toHaveBeenCalledWith(
          expect.stringContaining('Entries Excluded')
        );
        expect(mockAlert.mock.calls[0][0]).toContain('cameras[0].id must be integer');
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
