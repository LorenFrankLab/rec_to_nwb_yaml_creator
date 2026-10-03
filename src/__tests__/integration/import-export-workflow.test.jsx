import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import fs from 'fs';
import path from 'path';
import { App } from '../../App';
import { StoreProvider } from '../../state/StoreContext';
import YAML from 'yaml';
import { getMinimalCompleteYaml } from '../helpers/test-fixtures';
import { triggerExport } from '../helpers/integration-test-helpers';
import { getFileInput } from '../helpers/test-selectors';

/**
 * Phase 1.5 Task 1.5.4: Import/Export Workflow Integration Tests
 *
 * REWRITTEN to actually test import/export functionality (was documentation-only).
 *
 * This test suite validates:
 * 1. YAML file import → form population
 * 2. Form data → YAML export generation
 * 3. Round-trip data preservation (import → export)
 * 4. Error handling for invalid YAML
 *
 * Previous version: 16 tests that only checked `expect(container).toBeInTheDocument()`
 * New version: ~17 tests that validate actual import/export behavior
 *
 * Uses patterns from Task 1.5.1 (sample-metadata-modification.test.jsx)
 */

describe('Import/Export Workflow Integration', () => {
  let mockBlob;
  let mockBlobUrl;

  beforeEach(() => {
    // Mock Blob for export functionality
    mockBlob = null;
    global.Blob = class {
      constructor(content, options) {
        mockBlob = { content, options };
        this.content = content;
        this.options = options;
        this.size = content[0] ? content[0].length : 0;
        this.type = options ? options.type : '';
      }
    };

    // Mock URL.createObjectURL (standard API, not vendor-prefixed)
    mockBlobUrl = 'blob:mock-url';
    vi.spyOn(URL, 'createObjectURL').mockReturnValue(mockBlobUrl);
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});

    // Mock window.alert
    global.window.alert = vi.fn();

    // The minimal session lists no video files, which the download warns about (trodes_to_nwb
    // fails on an empty video list); accept that warning so the file downloads.
    vi.spyOn(window, 'confirm').mockReturnValue(true);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Import Workflow - Valid YAML', () => {
    /**
     * Test 1: Import minimal valid YAML and verify form population
     */
    it('imports minimal valid YAML and populates form fields', { timeout: 30000 }, async () => {
      // ARRANGE
      const user = userEvent.setup();
      render(
      <StoreProvider>
        <App />
      </StoreProvider>
    );

      // Complete minimal YAML with all required fields
      const yamlContent = getMinimalCompleteYaml();

      const yamlFile = new File([yamlContent], 'test.yml', { type: 'text/yaml' });

      // ACT - Upload file
      // Note: The file input doesn't have a text label, only an icon, so we query by ID
      const fileInput = getFileInput();
      await user.upload(fileInput, yamlFile);

      // Wait for import to complete - wait for lab to be populated
      await waitFor(() => {
        expect(screen.getByLabelText(/^lab$/i)).toHaveValue('Test Lab');
      }, { timeout: 5000 });

      // ASSERT - Verify form fields populated
      expect(screen.getByLabelText(/^lab$/i)).toHaveValue('Test Lab');
      expect(screen.getByLabelText(/institution/i)).toHaveValue('Test University');
      expect(screen.getByLabelText(/session id/i)).toHaveValue('TEST001');

      // Verify experimenter name added to list
      expect(screen.getByText(/Doe, John/)).toBeInTheDocument();

      // Verify subject fields
      // Note: subject_id from YAML gets converted to uppercase by the form
      const subjectIdInputs = screen.getAllByLabelText(/subject id/i);
      expect(subjectIdInputs[0].value).toBeTruthy(); // First check if it has any value
      // The YAML has subject_id: RAT001, which gets capitalized to RAT001
      expect(subjectIdInputs[0]).toHaveValue('RAT001');

      const speciesInputs = screen.getAllByLabelText(/species/i);
      expect(speciesInputs[0]).toHaveValue('Rattus norvegicus');

      const sexInputs = screen.getAllByLabelText(/sex/i);
      expect(sexInputs[0]).toHaveValue('M');
    }, 15000); // 15 second timeout - imports YAML file

    /**
     * Test 2: Import YAML with arrays and verify array population
     */
    it('imports YAML with arrays (cameras, tasks) and populates correctly', { timeout: 30000 }, async () => {
      // ARRANGE
      const user = userEvent.setup();
      render(
      <StoreProvider>
        <App />
      </StoreProvider>
    );

      // Complete YAML with arrays - added required fields
      const yamlContent = getMinimalCompleteYaml();

      const yamlFile = new File([yamlContent], 'test.yml', { type: 'text/yaml' });

      // ACT - Upload file
      // Note: The file input doesn't have a text label, only an icon, so we query by ID
      const fileInput = getFileInput();
      await user.upload(fileInput, yamlFile);

      // Wait for import to complete
      await waitFor(() => {
        const labInput = screen.getByLabelText(/^lab$/i);
        expect(labInput).toHaveValue('Test Lab');
      }, { timeout: 5000 });

      // ASSERT - Verify arrays populated
      // Should have 2 experimenters
      expect(screen.getByText(/Doe, John/)).toBeInTheDocument();
      // Fixture only has one experimenter

      // Wait a bit more for arrays to populate
      await waitFor(() => {
        const cameraNameInputs = screen.queryAllByLabelText(/camera name/i);
        expect(cameraNameInputs.length).toBeGreaterThanOrEqual(2);
      }, { timeout: 5000 });

      // Should have 2 cameras
      const cameraNameInputs = screen.getAllByLabelText(/camera name/i);
      expect(cameraNameInputs).toHaveLength(2);
      expect(cameraNameInputs[0]).toHaveValue("test camera 1");
      expect(cameraNameInputs[1]).toHaveValue("test camera 2");

      // Should have 1 task
      const taskNameInputs = screen.getAllByLabelText(/task name/i);
      expect(taskNameInputs).toHaveLength(2);
      expect(taskNameInputs[0]).toHaveValue("Sleep");
    }, 15000); // 15 second timeout - imports YAML file

    /**
     * Test 3: Import YAML and verify nested object structure (subject)
     */
    it('imports YAML with nested objects and preserves structure', { timeout: 30000 }, async () => {
      // ARRANGE
      const user = userEvent.setup();
      render(
      <StoreProvider>
        <App />
      </StoreProvider>
    );

      // Complete YAML with nested objects - added remaining required fields
      const yamlContent = getMinimalCompleteYaml();

      const yamlFile = new File([yamlContent], 'test.yml', { type: 'text/yaml' });

      // ACT
      const fileInput = getFileInput();
      await user.upload(fileInput, yamlFile);

      await waitFor(() => {
        const labInput = screen.getByLabelText(/^lab$/i);
        expect(labInput).toHaveValue('Test Lab');
      });

      // ASSERT - Verify nested subject object
      const subjectIdInputs = screen.getAllByLabelText(/subject id/i);
      expect(subjectIdInputs[0]).toHaveValue('RAT001');

      const weightInputs = screen.getAllByLabelText(/weight/i);
      expect(weightInputs[0]).toHaveValue(300);

      const sexInputs = screen.getAllByLabelText(/sex/i);
      expect(sexInputs[0]).toHaveValue("M");

      // Query for subject description (first one is subject, not session)
      const descriptionInputs = screen.getAllByLabelText(/^description$/i);
      expect(descriptionInputs[0]).toHaveValue("Test Rat");
    });
  });

  describe('Export Workflow', () => {
    /**
     * Test 4: Export form data and verify YAML structure
     *
     * Note: This test is limited because we can't easily fill all required fields
     * without running into the field selector issues from Task 1.5.2.
     * We'll use import → export instead for comprehensive testing.
     */
    it('exports form data as valid YAML with correct structure', { timeout: 30000 }, async () => {
      // ARRANGE
      const user = userEvent.setup();
      render(
      <StoreProvider>
        <App />
      </StoreProvider>
    );

      // Import a complete valid session first - added all required fields
      const yamlContent = getMinimalCompleteYaml();

      const yamlFile = new File([yamlContent], 'test.yml', { type: 'text/yaml' });
      const fileInput = getFileInput();
      await user.upload(fileInput, yamlFile);

      await waitFor(() => {
        const labInput = screen.getByLabelText(/^lab$/i);
        expect(labInput).toHaveValue('Test Lab');
      });

      // Wait for all fields to populate (cameras indicate full import)
      await waitFor(() => {
        const cameraInputs = screen.getAllByLabelText(/camera name/i);
        expect(cameraInputs).toHaveLength(2);
      });

      // ACT - Export
      // Use triggerExport instead of button click (requestSubmit doesn't work in tests)
      await triggerExport();

      // ASSERT - Verify export succeeded
      await waitFor(() => {
        expect(mockBlob).not.toBeNull();
      });

      // Parse exported YAML
      const exportedYaml = mockBlob.content[0];
      const exportedData = YAML.parse(exportedYaml);

      // Verify structure
      expect(exportedData.lab).toBe('Test Lab');
      expect(exportedData.session_id).toBe('TEST001');
      expect(exportedData.subject).toBeDefined();
      expect(exportedData.subject.subject_id).toBe('RAT001');
      expect(exportedData.data_acq_device).toHaveLength(1);
    });

    /**
     * Test 5: Verify export Blob properties
     */
    it('creates Blob with correct MIME type and content', { timeout: 30000 }, async () => {
      // ARRANGE
      const user = userEvent.setup();
      render(
      <StoreProvider>
        <App />
      </StoreProvider>
    );

      // Complete YAML for Blob test - added all required fields
      const yamlContent = getMinimalCompleteYaml();

      const yamlFile = new File([yamlContent], 'test.yml', { type: 'text/yaml' });
      const fileInput = getFileInput();
      await user.upload(fileInput, yamlFile);

      await waitFor(() => {
        const labInput = screen.getByLabelText(/^lab$/i);
        expect(labInput).toHaveValue('Test Lab');
      });

      // ACT
      // Use triggerExport instead of button click (requestSubmit doesn't work in tests)
      await triggerExport();

      // ASSERT
      await waitFor(() => {
        expect(mockBlob).not.toBeNull();
      });

      expect(mockBlob.options.type).toBe('text/yaml;charset=utf-8;');
      expect(mockBlob.content).toHaveLength(1);
      expect(typeof mockBlob.content[0]).toBe('string');
      expect(mockBlob.content[0]).toContain('lab: Test Lab');
    });

    // A warning (here: no video files) asks once; Cancel keeps the form and downloads nothing.
    it('downloads nothing when the warning is cancelled', { timeout: 30000 }, async () => {
      const user = userEvent.setup();
      render(
        <StoreProvider>
          <App />
        </StoreProvider>
      );
      await user.upload(
        getFileInput(),
        new File([getMinimalCompleteYaml()], 'test.yml', { type: 'text/yaml' })
      );
      await waitFor(() => {
        expect(screen.getByLabelText(/^lab$/i)).toHaveValue('Test Lab');
      });
      window.confirm.mockReturnValue(false);

      await triggerExport();

      await waitFor(() => {
        expect(window.confirm).toHaveBeenCalledWith(expect.stringContaining('No video files are listed'));
      });
      expect(window.confirm).toHaveBeenCalledTimes(1);
      expect(mockBlob).toBeNull();
    });
  });

  describe('Round-trip Data Preservation', () => {
    /**
     * Test 6: Import → Export → verify data preservation
     */
    it('preserves all data through import → export cycle', { timeout: 30000 }, async () => {
      // ARRANGE
      const user = userEvent.setup();
      render(
      <StoreProvider>
        <App />
      </StoreProvider>
    );

      // Complete YAML for round-trip test - added all required fields
      const yamlContent = getMinimalCompleteYaml();

      const yamlFile = new File([yamlContent], 'test.yml', { type: 'text/yaml' });

      // ACT - Import
      const fileInput = getFileInput();
      await user.upload(fileInput, yamlFile);

      await waitFor(() => {
        const labInput = screen.getByLabelText(/^lab$/i);
        expect(labInput).toHaveValue('Test Lab');
      });

      // ACT - Export
      // Use triggerExport instead of button click (requestSubmit doesn't work in tests)
      await triggerExport();

      await waitFor(() => {
        expect(mockBlob).not.toBeNull();
      });

      // ASSERT - Parse and compare
      const exportedYaml = mockBlob.content[0];
      const exportedData = YAML.parse(exportedYaml);
      const originalData = YAML.parse(yamlContent);

      // Verify key fields preserved
      expect(exportedData.experimenter_name).toEqual(originalData.experimenter_name);
      expect(exportedData.lab).toBe(originalData.lab);
      expect(exportedData.session_id).toBe(originalData.session_id);
      expect(exportedData.subject.subject_id).toBe(originalData.subject.subject_id);
      expect(exportedData.subject.weight).toBe(originalData.subject.weight);
      expect(exportedData.cameras).toHaveLength(2); // minimal-complete.yml has 2 cameras
      expect(exportedData.cameras[0].camera_name).toBe("test camera 1");
      expect(exportedData.cameras[1].camera_name).toBe("test camera 2");
    });

    /**
     * Test 7: Import → Modify → Export → verify modifications
     */
    it('preserves modifications after import and re-export', { timeout: 30000 }, async () => {
      // ARRANGE
      const user = userEvent.setup();
      render(
      <StoreProvider>
        <App />
      </StoreProvider>
    );

      // Complete YAML for modification test - added all required fields
      const yamlContent = getMinimalCompleteYaml();

      const yamlFile = new File([yamlContent], 'test.yml', { type: 'text/yaml' });

      // ACT - Import
      const fileInput = getFileInput();
      await user.upload(fileInput, yamlFile);

      await waitFor(() => {
        const labInput = screen.getByLabelText(/^lab$/i);
        expect(labInput).toHaveValue('Test Lab');
      });

      // ACT - Modify lab field
      const labInput = screen.getByLabelText(/^lab$/i);
      await user.clear(labInput); await waitFor(() => expect(labInput).toHaveValue(""));
      await user.type(labInput, 'Modified Lab');
      await user.tab(); // REQUIRED: Trigger blur to update React state (uses onBlur)

      // ACT - Export
      // Use triggerExport instead of button click (requestSubmit doesn't work in tests)
      await triggerExport();

      await waitFor(() => {
        expect(mockBlob).not.toBeNull();
      });

      // ASSERT
      const exportedYaml = mockBlob.content[0];
      const exportedData = YAML.parse(exportedYaml);

      expect(exportedData.lab).toBe('Modified Lab'); // Modified value
      expect(exportedData.session_id).toBe('TEST001'); // Original value preserved
    });
  });

  /**
   * A scientist edits a downloaded file in a text editor and uploads it into the page that still
   * has the previous file loaded.
   */
  describe('Importing another file into an open form', () => {
    const sampleModel = () => {
      const model = YAML.parse(
        fs.readFileSync(path.join(__dirname, '../fixtures/valid/20230622_sample_metadata.yml'), 'utf8')
      );
      model.subject.subject_id = 'sample-rat';
      return model;
    };
    const yamlFile = (model, name) => new File([YAML.stringify(model)], name, { type: 'text/yaml' });

    it("shows and exports the second file's DIO description", { timeout: 30000 }, async () => {
      // ARRANGE - a file whose first DIO event is Din1 is loaded
      const user = userEvent.setup();
      render(
        <StoreProvider>
          <App />
        </StoreProvider>
      );
      const edited = sampleModel();
      edited.behavioral_events[0].description = 'Dout9';
      const dioType = () => document.querySelector('#behavioral_events-description-0-list');
      const dioIndex = () => document.querySelector('#behavioral_events-description-0');

      await user.upload(getFileInput(), yamlFile(sampleModel(), 'first.yml'));
      await waitFor(() => expect(dioIndex()).toHaveValue(1));

      // ACT - load the edited file into the same page
      await user.upload(getFileInput(), yamlFile(edited, 'edited.yml'));

      // ASSERT - the field shows the edited value...
      await waitFor(() => expect(dioType()).toHaveValue('Dout'));
      expect(dioIndex()).toHaveValue(9);

      // ...and leaving the field, which saves what it shows, keeps it
      fireEvent.blur(dioIndex());
      await triggerExport();
      await waitFor(() => expect(mockBlob).not.toBeNull());
      expect(YAML.parse(mockBlob.content[0]).behavioral_events[0].description).toBe('Dout9');
    });

    it('keeps the loaded form when an uploaded file cannot be read', { timeout: 30000 }, async () => {
      // ARRANGE - a valid file is loaded
      const user = userEvent.setup();
      render(
        <StoreProvider>
          <App />
        </StoreProvider>
      );
      await user.upload(
        getFileInput(),
        new File([getMinimalCompleteYaml()], 'good.yml', { type: 'text/yaml' })
      );
      await waitFor(() => expect(screen.getByLabelText(/^lab$/i)).toHaveValue('Test Lab'));

      // ACT - upload a file that TextEdit saved as rich text
      const richText = [
        '{\\rtf1\\ansi\\ansicpg1252\\cocoartf2761',
        '\\cocoatextscaling0\\cocoaplatform0{\\fonttbl\\f0\\fswiss\\fcharset0 Helvetica;}',
        '\\f0\\fs24 \\cf0 lab: Other Lab\\',
        '}',
      ].join('\n');
      await user.upload(getFileInput(), new File([richText], 'edited.yml', { type: 'text/yaml' }));
      await waitFor(() =>
        expect(window.alert).toHaveBeenCalledWith(expect.stringContaining('Make Plain Text'))
      );
      // Let the import finish before checking what the form holds.
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 100));
      });

      // ASSERT - the loaded form is unchanged
      expect(screen.getByLabelText(/^lab$/i)).toHaveValue('Test Lab');
    });

    // A camera missing a required field makes the import leave out the cameras. The camera
    // cleanup used to drop the tasks' camera links in response, and an empty camera list is valid,
    // so the loss was silent: adding the cameras back left every task unlinked.
    it('keeps the task camera links when the cameras are left out', { timeout: 30000 }, async () => {
      const user = userEvent.setup();
      render(
        <StoreProvider>
          <App />
        </StoreProvider>
      );
      const session = YAML.parse(getMinimalCompleteYaml());
      delete session.cameras[0].lens;

      await user.upload(getFileInput(), yamlFile(session, 'edited.yml'));
      await waitFor(() => expect(screen.getByLabelText(/^lab$/i)).toHaveValue('Test Lab'));
      await user.click(screen.getByRole('button', { name: /close alert/i }));
      expect(screen.queryAllByLabelText(/camera name/i)).toHaveLength(0);

      // New cameras are numbered 0, then 1: the ids the tasks were linked to.
      await user.click(screen.getByTitle(/Add cameras/i));
      await user.click(screen.getByTitle(/Add cameras/i));
      await waitFor(() => expect(screen.queryAllByLabelText(/camera name/i)).toHaveLength(2));

      // Task 0 (Sleep) used camera 0 and task 1 (Run) used camera 1.
      expect(document.getElementById('tasks-camera_id-0-0')).toBeChecked();
      expect(document.getElementById('tasks-camera_id-0-1')).not.toBeChecked();
      expect(document.getElementById('tasks-camera_id-1-0')).not.toBeChecked();
      expect(document.getElementById('tasks-camera_id-1-1')).toBeChecked();
    });
  });

  /**
   * PyYAML writes one anchored block (&id001) and aliases (*id001) when a lab script dumps the
   * same channel map for every ntrode. Each ntrode must stay its own: marking a bad channel or
   * unmapping a channel on one tetrode used to change it on every tetrode.
   */
  describe('Importing a file whose ntrodes share an anchored channel map', () => {
    const anchoredYaml = () => {
      const yaml = getMinimalCompleteYaml();
      return `${yaml.slice(0, yaml.indexOf('ntrode_electrode_group_channel_map:'))}ntrode_electrode_group_channel_map:
  - ntrode_id: 0
    electrode_group_id: 0
    bad_channels: &id001 []
    map: &id002
      "0": 0
      "1": 1
      "2": 2
      "3": 3
  - ntrode_id: 1
    electrode_group_id: 1
    bad_channels: *id001
    map: *id002
`;
    };
    const badChannel = (ntrodeIndex, channel) =>
      document.getElementById(`ntrode_electrode_group_channel_map-bad_channels-${ntrodeIndex}-${channel}`);
    // Each tetrode group renders its one shank with the same id; the first is electrode group 0.
    const channelZeroMaps = () =>
      document.querySelectorAll('[id="ntrode_electrode_group_channel_map-map-0-0-0"]');

    const importAnchoredFile = async (user) => {
      render(
        <StoreProvider>
          <App />
        </StoreProvider>
      );
      await user.upload(getFileInput(), new File([anchoredYaml()], 'shared.yml', { type: 'text/yaml' }));
      await waitFor(() => expect(screen.getByLabelText(/^lab$/i)).toHaveValue('Test Lab'));
      await waitFor(() => expect(badChannel(1, 2)).not.toBeNull());
    };

    it('marks a bad channel on one tetrode only', { timeout: 30000 }, async () => {
      const user = userEvent.setup();
      await importAnchoredFile(user);

      await user.click(badChannel(0, 2));

      await waitFor(() => expect(badChannel(0, 2)).toBeChecked());
      expect(badChannel(1, 2)).not.toBeChecked();

      await triggerExport();
      await waitFor(() => expect(mockBlob).not.toBeNull());
      const exported = mockBlob.content[0];
      expect(exported).not.toMatch(/[&*]a\d/);
      const ntrodes = YAML.parse(exported).ntrode_electrode_group_channel_map;
      expect(ntrodes[0].bad_channels).toEqual([2]);
      expect(ntrodes[1].bad_channels).toEqual([]);
    });

    it('unmaps a channel on one tetrode only', { timeout: 30000 }, async () => {
      const user = userEvent.setup();
      await importAnchoredFile(user);
      expect(channelZeroMaps()).toHaveLength(2);

      fireEvent.change(channelZeroMaps()[0], { target: { value: '-1' } });

      await waitFor(() => expect(channelZeroMaps()[0].value).toBe('-1'));
      expect(channelZeroMaps()[1].value).toBe('0');
    });
  });
});
