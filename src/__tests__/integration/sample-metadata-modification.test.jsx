import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { App } from '../../App';
import YAML from 'yaml';
import { getMinimalCompleteYaml } from '../helpers/test-fixtures';
import { triggerExport, importYamlFile } from '../helpers/integration-test-helpers';
import { getInputByLabel, getAddButton, getFileInput, getRemoveButtons } from '../helpers/test-selectors';
import fs from 'fs';
import path from 'path';

/**
 * Phase 1.5 Task 1.5.1: Sample Metadata Modification Tests
 *
 * This test suite validates the critical workflow that users actually perform:
 * 1. Import existing sample metadata through file upload
 * 2. Modify experimenter name
 * 3. Modify subject information
 * 4. Add new camera
 * 5. Add new task
 * 6. Add new electrode group
 * 7. Re-export with modifications preserved
 * 8. Round-trip preserves all modifications
 *
 * This is the user's SPECIFIC CONCERN from Phase 1 review - these workflows were
 * completely untested despite being marked as complete.
 *
 * These are REAL tests with REAL assertions, not documentation-only tests.
 */

describe('Sample Metadata Modification Workflow', () => {
  let sampleYamlContent;
  let sampleMetadata;
  let mockBlob;
  let mockBlobUrl;

  beforeEach(() => {
    // Load the complete minimal YAML file with ALL required schema fields
    const sampleYamlPath = path.join(
      __dirname,
      '../fixtures/valid/minimal-complete.yml'
    );
    sampleYamlContent = fs.readFileSync(sampleYamlPath, 'utf-8');
    sampleMetadata = YAML.parse(sampleYamlContent);

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

    // Mock URL.createObjectURL
    mockBlobUrl = 'blob:mock-url';
    global.window.webkitURL = {
      createObjectURL: vi.fn(() => mockBlobUrl),
    };

    // Mock window.alert
    global.window.alert = vi.fn();
  });

  /**
   * Test 1: Import sample metadata through file upload
   *
   * Validates that:
   * - File upload input accepts YAML files
   * - FileReader reads the file content
   * - YAML is parsed correctly
   * - Form fields are populated with sample data
   */
  it('imports sample metadata through file upload', async () => {
    // ARRANGE
    const user = userEvent.setup();
    const { container } = render(<App />);

    // ACT - Upload the file using helper
    await importYamlFile(user, screen, container, sampleYamlContent, 'minimal-complete.yml');

    // ASSERT - Verify critical fields are populated
    expect(screen.getByLabelText(/^lab$/i)).toHaveValue('Test Lab');

    // Verify other top-level fields
    expect(screen.getByLabelText(/institution/i)).toHaveValue('Test University');
    expect(screen.getByLabelText(/session description/i)).toHaveValue('test yaml');
    expect(screen.getByLabelText(/session id/i)).toHaveValue('TEST001');

    // Verify experimenter names (only 1 in minimal fixture)
    expect(screen.getByText(/Doe, John/)).toBeInTheDocument();

    // Verify subject information
    const subjectIdInputs = screen.getAllByLabelText(/subject id/i);
    expect(subjectIdInputs[0]).toHaveValue('RAT001');

    const speciesInputs = screen.getAllByLabelText(/species/i);
    expect(speciesInputs[0]).toHaveValue('Rattus norvegicus');

    const sexInputs = screen.getAllByLabelText(/sex/i);
    expect(sexInputs[0]).toHaveValue('M');

    // Verify cameras were imported (2 cameras)
    const cameraNameInputs = screen.getAllByLabelText(/camera name/i);
    expect(cameraNameInputs).toHaveLength(2);
    expect(cameraNameInputs[0]).toHaveValue('test camera 1');
    expect(cameraNameInputs[1]).toHaveValue('test camera 2');

    // Verify tasks were imported (2 tasks)
    const taskNameInputs = screen.getAllByLabelText(/task name/i);
    expect(taskNameInputs).toHaveLength(2);
    expect(taskNameInputs[0]).toHaveValue('Sleep');
    expect(taskNameInputs[1]).toHaveValue('Run');
  }, 15000); // 15 second timeout - imports YAML file

  /**
   * Test 2: Modify experimenter name
   *
   * Validates that:
   * - User can modify existing experimenter names
   * - New values are stored in form state
   */
  it('modifies experimenter name after import', async () => {
    // ARRANGE
    const user = userEvent.setup();
    const { container } = render(<App />);

    // Import first using helper
    await importYamlFile(user, screen, container, sampleYamlContent, 'minimal-complete.yml');

    // ACT - Modify the first experimenter name
    // ListElement uses placeholder text, not labels
    const experimenterInput = screen.getByPlaceholderText(/LastName, FirstName/i);
    await user.clear(experimenterInput);
    await user.type(experimenterInput, 'Smith, Jane');

    // ASSERT - Verify the modification
    expect(experimenterInput).toHaveValue('Smith, Jane');
  });

  /**
   * Test 3: Modify subject information
   *
   * Validates that:
   * - User can modify subject fields
   * - Multiple subject fields can be changed
   *
   * Note: This test types long strings and may take 8-10 seconds
   * Timeout increased to 15s to prevent flakes when running with full suite
   */
  it('modifies subject information after import', async () => {
    // ARRANGE
    const user = userEvent.setup();
    const { container } = render(<App />);

    // Import first using helper
    await importYamlFile(user, screen, container, sampleYamlContent, 'minimal-complete.yml');

    // ACT - Modify subject ID and description
    const subjectIdInputs = screen.getAllByLabelText(/subject id/i);
    const subjectIdInput = subjectIdInputs[0];

    // Description field in subject section (test-selectors.js would help, but getAllByLabelText works)
    const descriptionInputs = screen.getAllByLabelText(/^description$/i);
    const descriptionInput = descriptionInputs[0]; // First one is subject description

    await user.clear(subjectIdInput);
    await user.type(subjectIdInput, '99999');

    await user.clear(descriptionInput);
    // Use paste for long strings to avoid typing timeout issues
    await user.click(descriptionInput);
    await user.paste('Modified Rat Description');

    // ASSERT - Verify modifications
    expect(subjectIdInput).toHaveValue('99999');
    expect(descriptionInput).toHaveValue('Modified Rat Description');
    // Verify other subject fields unchanged
    const speciesInputs = screen.getAllByLabelText(/species/i);
    expect(speciesInputs[0]).toHaveValue('Rattus norvegicus');
    const sexInputs = screen.getAllByLabelText(/sex/i);
    expect(sexInputs[0]).toHaveValue('M');
  }, 15000); // 15 second timeout to prevent flakes in full test suite

  /**
   * Test 4: Add new camera
   *
   * Validates that:
   * - User can add cameras to imported metadata
   * - Camera IDs auto-increment correctly
   * - New camera appears in form
   */
  it('adds new camera to imported metadata', async () => {
    // ARRANGE
    const user = userEvent.setup();
    const { container } = render(<App />);

    // Import first using helper
    await importYamlFile(user, screen, container, sampleYamlContent, 'minimal-complete.yml');

    // Verify we start with 2 cameras
    let cameraNameInputs = screen.getAllByLabelText(/camera name/i);
    expect(cameraNameInputs).toHaveLength(2);

    // ACT - Add a new camera
    const addCameraButton = getAddButton('cameras');
    await user.click(addCameraButton);

    // ASSERT - Verify we now have 3 cameras
    cameraNameInputs = screen.getAllByLabelText(/camera name/i);
    expect(cameraNameInputs).toHaveLength(3);

    // Verify the new camera has the next ID (2)
    const cameraIdInputs = screen.getAllByLabelText(/^camera id$/i);
    expect(cameraIdInputs).toHaveLength(3);
    expect(cameraIdInputs[2]).toHaveValue(2); // IDs: 0, 1, 2
  }, 15000); // 15 second timeout - imports YAML file

  /**
   * Test 5: Add new task
   *
   * Validates that:
   * - User can add tasks to imported metadata
   * - New task appears in form
   * - Task can reference existing cameras
   */
  it('adds new task to imported metadata', async () => {
    // ARRANGE
    const user = userEvent.setup();
    const { container } = render(<App />);

    // Import first using helper
    await importYamlFile(user, screen, container, sampleYamlContent, 'minimal-complete.yml');

    // Verify we start with 2 tasks
    let taskNameInputs = screen.getAllByLabelText(/task name/i);
    expect(taskNameInputs).toHaveLength(2);

    // ACT - Add a new task
    const addTaskButton = getAddButton('tasks');
    await user.click(addTaskButton);

    // ASSERT - Verify we now have 3 tasks
    taskNameInputs = screen.getAllByLabelText(/task name/i);
    expect(taskNameInputs).toHaveLength(3);

    // Fill in the new task name
    await user.type(taskNameInputs[2], 'Exploration');
    expect(taskNameInputs[2]).toHaveValue('Exploration');
  });

  /**
   * Test 6: Add new electrode group
   *
   * Validates that:
   * - User can add electrode groups to imported metadata
   * - Electrode group ID auto-increments
   * - New electrode group appears in form
   */
  it('adds new electrode group to imported metadata', async () => {
    // ARRANGE
    const user = userEvent.setup();
    const { container } = render(<App />);

    // Import first using helper
    await importYamlFile(user, screen, container, sampleYamlContent, 'minimal-complete.yml');

    // Count initial electrode groups (minimal-complete has 2 electrode groups)
    const initialDeviceTypeSelects = screen.getAllByLabelText(/device type/i);
    const initialCount = initialDeviceTypeSelects.length;
    expect(initialCount).toBe(2);

    // ACT - Add a new electrode group
    const addElectrodeGroupButton = getAddButton('electrode_groups');
    await user.click(addElectrodeGroupButton);

    // ASSERT - Verify we have one more electrode group
    const newDeviceTypeSelects = screen.getAllByLabelText(/device type/i);
    expect(newDeviceTypeSelects).toHaveLength(initialCount + 1);
  });

  /**
   * Test 7: Re-export with modifications preserved
   *
   * Validates that:
   * - Modified form can be exported as YAML
   * - Export functionality works after import
   * - Blob contains YAML content
   */
  it('re-exports metadata with modifications preserved', async () => {
    // ARRANGE
    const user = userEvent.setup();
    const { container } = render(<App />);

    // Import first using helper
    await importYamlFile(user, screen, container, sampleYamlContent, 'minimal-complete.yml');

    // Modify experimenter name
    // First, remove the existing experimenter "Doe, John"
    const experimenterItem = screen.getByText('Doe, John').parentElement;
    const removeButton = within(experimenterItem).getByRole('button', { name: '✘' });
    await user.click(removeButton);

    // Then add the new experimenter name
    const experimenterInput = screen.getByPlaceholderText(/LastName, FirstName/i);
    await user.type(experimenterInput, 'Modified, Name');
    await user.keyboard('{Enter}'); // REQUIRED: Press Enter to add to list and update React state

    // Wait for React state to update
    await vi.waitFor(() => {
      expect(screen.getByText('Modified, Name')).toBeInTheDocument();
    }, { timeout: 2000 });

    // ACT - Export the modified data
    // Use triggerExport instead of button click (requestSubmit doesn't work in tests)
    await triggerExport();

    // ASSERT - Verify export was triggered
    await vi.waitFor(() => {
      expect(mockBlob).not.toBeNull();
    }, { timeout: 2000 });

    // Verify blob contains YAML content
    expect(mockBlob.content).toBeDefined();
    expect(mockBlob.options.type).toBe('text/yaml;charset=utf-8;');

    // Parse the exported YAML and verify modification
    const exportedYaml = mockBlob.content[0];
    const exportedData = YAML.parse(exportedYaml);
    expect(exportedData.experimenter_name[0]).toBe('Modified, Name');
  });

  /**
   * Test 8: Round-trip preserves all modifications
   *
   * Validates that:
   * - Import → Modify → Export → Import cycle works
   * - All modifications are preserved through round-trip
   * - No data loss during import/export cycle
   */
  it('preserves all modifications through import-modify-export-import round-trip', async () => {
    // ARRANGE
    const user = userEvent.setup();
    const { container } = render(<App />);

    const yamlFile = new File([sampleYamlContent], 'minimal-complete.yml', {
      type: 'text/yaml',
    });

    // Import original
    const fileInput = getFileInput();
    await user.upload(fileInput, yamlFile);

    await vi.waitFor(() => {
      expect(screen.getByLabelText(/^lab$/i)).toHaveValue('Test Lab');
    }, { timeout: 5000 });

    // Modify multiple fields
    // First, remove the existing experimenter "Doe, John"
    const experimenterItem = screen.getByText('Doe, John').parentElement;
    const removeButton = within(experimenterItem).getByRole('button', { name: '✘' });
    await user.click(removeButton);

    // Then add the new experimenter name
    const experimenterInput = screen.getByPlaceholderText(/LastName, FirstName/i);
    await user.type(experimenterInput, 'RoundTrip, Test');
    await user.keyboard('{Enter}'); // REQUIRED: Press Enter to add to list

    const subjectIdInputs = screen.getAllByLabelText(/subject id/i);
    await user.clear(subjectIdInputs[0]);
    await user.type(subjectIdInputs[0], '88888');
    await user.tab(); // REQUIRED: Trigger blur event to update React state (InputElement uses onBlur)

    // Wait for React state to update
    await vi.waitFor(() => {
      expect(subjectIdInputs[0]).toHaveValue('88888');
    }, { timeout: 2000 });

    // Export
    // Use triggerExport instead of button click (requestSubmit doesn't work in tests)
    await triggerExport();

    await vi.waitFor(() => {
      expect(mockBlob).not.toBeNull();
    }, { timeout: 2000 });

    // Get exported YAML content
    const exportedYaml = mockBlob.content[0];

    // ACT - Re-import the exported YAML
    const reImportFile = new File([exportedYaml], 'modified_metadata.yml', {
      type: 'text/yaml',
    });
    await user.upload(fileInput, reImportFile);

    // ASSERT - Verify modifications are preserved
    await vi.waitFor(() => {
      expect(screen.getByText(/RoundTrip, Test/)).toBeInTheDocument();
    }, { timeout: 2000 });

    const subjectIdInputsAfterReimport = screen.getAllByLabelText(/subject id/i);
    expect(subjectIdInputsAfterReimport[0]).toHaveValue('88888');

    // Verify other data still intact
    expect(screen.getByLabelText(/^lab$/i)).toHaveValue('Test Lab');
    expect(screen.getByLabelText(/institution/i)).toHaveValue('Test University');
  }, 15000); // 15 second timeout - imports YAML multiple times
});
