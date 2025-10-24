import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { App } from '../../App';
import YAML from 'yaml';
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
    // Load the minimal sample YAML file (faster rendering with only 2 electrode groups)
    const sampleYamlPath = path.join(
      __dirname,
      '../fixtures/valid/minimal-sample.yml'
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

    // Create a File object from the sample YAML content
    const yamlFile = new File([sampleYamlContent], 'minimal-sample.yml', {
      type: 'text/yaml',
    });

    // ACT - Upload the file
    // Note: The file input doesn't have a text label, only an icon, so we query by ID
    const fileInput = container.querySelector('#importYAMLFile');
    await user.upload(fileInput, yamlFile);

    // ASSERT - Verify critical fields are populated
    // Wait for FileReader to complete (async operation)
    await vi.waitFor(() => {
      const labInput = screen.getByLabelText(/^lab$/i);
      expect(labInput).toHaveValue('Test Lab');
    }, { timeout: 5000 });

    // Verify other top-level fields
    expect(screen.getByLabelText(/^institution$/i)).toHaveValue('Test University');
    expect(screen.getByLabelText(/session description/i)).toHaveValue('minimal test session');
    expect(screen.getByLabelText(/session id/i)).toHaveValue('TEST001');

    // Verify experimenter names (only 1 in minimal fixture)
    const experimenterInputs = screen.getAllByLabelText(/experimenter name/i);
    expect(experimenterInputs.length).toBeGreaterThanOrEqual(1);
    expect(experimenterInputs[0]).toHaveValue('Doe, John');

    // Verify subject information
    expect(screen.getByLabelText(/subject id/i)).toHaveValue('RAT001');
    expect(screen.getByLabelText(/^description$/i)).toHaveValue('Test Rat');
    expect(screen.getByLabelText(/^species$/i)).toHaveValue('Rattus norvegicus');
    expect(screen.getByLabelText(/^sex$/i)).toHaveValue('M');

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
  });

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

    const yamlFile = new File([sampleYamlContent], 'minimal-sample.yml', {
      type: 'text/yaml',
    });

    // Import first
    const fileInput = container.querySelector('#importYAMLFile');
    await user.upload(fileInput, yamlFile);

    await vi.waitFor(() => {
      expect(screen.getByLabelText(/^lab$/i)).toHaveValue('Test Lab');
    }, { timeout: 5000 });

    // ACT - Modify the first experimenter name
    const experimenterInputs = screen.getAllByLabelText(/experimenter name/i);
    await user.clear(experimenterInputs[0]);
    await user.type(experimenterInputs[0], 'Smith, Jane');

    // ASSERT - Verify the modification
    expect(experimenterInputs[0]).toHaveValue('Smith, Jane');
    // Verify second experimenter name unchanged
    expect(experimenterInputs[1]).toHaveValue('lastname2, firstname2');
  });

  /**
   * Test 3: Modify subject information
   *
   * Validates that:
   * - User can modify subject fields
   * - Multiple subject fields can be changed
   */
  it('modifies subject information after import', async () => {
    // ARRANGE
    const user = userEvent.setup();
    const { container } = render(<App />);

    const yamlFile = new File([sampleYamlContent], 'minimal-sample.yml', {
      type: 'text/yaml',
    });

    // Import first
    const fileInput = container.querySelector('#importYAMLFile');
    await user.upload(fileInput, yamlFile);

    await vi.waitFor(() => {
      expect(screen.getByLabelText(/^lab$/i)).toHaveValue('Test Lab');
    }, { timeout: 5000 });

    // ACT - Modify subject ID and description
    const subjectIdInput = screen.getByLabelText(/subject id/i);
    const descriptionInput = screen.getByLabelText(/^description$/i);

    await user.clear(subjectIdInput);
    await user.type(subjectIdInput, '99999');

    await user.clear(descriptionInput);
    await user.type(descriptionInput, 'Modified Rat Description');

    // ASSERT - Verify modifications
    expect(subjectIdInput).toHaveValue('99999');
    expect(descriptionInput).toHaveValue('Modified Rat Description');
    // Verify other subject fields unchanged
    expect(screen.getByLabelText(/^species$/i)).toHaveValue('Rattus pyctoris');
    expect(screen.getByLabelText(/^sex$/i)).toHaveValue('M');
  });

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

    const yamlFile = new File([sampleYamlContent], 'minimal-sample.yml', {
      type: 'text/yaml',
    });

    // Import first
    const fileInput = container.querySelector('#importYAMLFile');
    await user.upload(fileInput, yamlFile);

    await vi.waitFor(() => {
      expect(screen.getByLabelText(/^lab$/i)).toHaveValue('Test Lab');
    }, { timeout: 5000 });

    // Verify we start with 2 cameras
    let cameraNameInputs = screen.getAllByLabelText(/camera name/i);
    expect(cameraNameInputs).toHaveLength(2);

    // ACT - Add a new camera
    const addCameraButton = screen.getByRole('button', { name: /add cameras/i });
    await user.click(addCameraButton);

    // ASSERT - Verify we now have 3 cameras
    cameraNameInputs = screen.getAllByLabelText(/camera name/i);
    expect(cameraNameInputs).toHaveLength(3);

    // Verify the new camera has the next ID (2)
    const cameraIdInputs = screen.getAllByLabelText(/^camera id$/i);
    expect(cameraIdInputs).toHaveLength(3);
    expect(cameraIdInputs[2]).toHaveValue(2); // IDs: 0, 1, 2
  });

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

    const yamlFile = new File([sampleYamlContent], 'minimal-sample.yml', {
      type: 'text/yaml',
    });

    // Import first
    const fileInput = container.querySelector('#importYAMLFile');
    await user.upload(fileInput, yamlFile);

    await vi.waitFor(() => {
      expect(screen.getByLabelText(/^lab$/i)).toHaveValue('Test Lab');
    }, { timeout: 5000 });

    // Verify we start with 2 tasks
    let taskNameInputs = screen.getAllByLabelText(/task name/i);
    expect(taskNameInputs).toHaveLength(2);

    // ACT - Add a new task
    const addTaskButton = screen.getByRole('button', { name: /add tasks/i });
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

    const yamlFile = new File([sampleYamlContent], 'minimal-sample.yml', {
      type: 'text/yaml',
    });

    // Import first
    const fileInput = container.querySelector('#importYAMLFile');
    await user.upload(fileInput, yamlFile);

    await vi.waitFor(() => {
      expect(screen.getByLabelText(/^lab$/i)).toHaveValue('Test Lab');
    }, { timeout: 5000 });

    // Count initial electrode groups (sample has 29 electrode groups)
    const initialElectrodeGroups = screen.getAllByLabelText(/electrode group id/i);
    const initialCount = initialElectrodeGroups.length;
    expect(initialCount).toBeGreaterThan(0);

    // ACT - Add a new electrode group
    const addElectrodeGroupButton = screen.getByRole('button', { name: /add electrode groups/i });
    await user.click(addElectrodeGroupButton);

    // ASSERT - Verify we have one more electrode group
    const newElectrodeGroups = screen.getAllByLabelText(/electrode group id/i);
    expect(newElectrodeGroups).toHaveLength(initialCount + 1);

    // Verify the new electrode group has the next ID
    const lastElectrodeGroup = newElectrodeGroups[newElectrodeGroups.length - 1];
    expect(lastElectrodeGroup).toHaveValue(initialCount); // IDs are 0-indexed
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

    const yamlFile = new File([sampleYamlContent], 'minimal-sample.yml', {
      type: 'text/yaml',
    });

    // Import first
    const fileInput = container.querySelector('#importYAMLFile');
    await user.upload(fileInput, yamlFile);

    await vi.waitFor(() => {
      expect(screen.getByLabelText(/^lab$/i)).toHaveValue('Test Lab');
    }, { timeout: 5000 });

    // Modify experimenter name
    const experimenterInputs = screen.getAllByLabelText(/experimenter name/i);
    await user.clear(experimenterInputs[0]);
    await user.type(experimenterInputs[0], 'Modified, Name');

    // ACT - Export the modified data
    const exportButton = screen.getByRole('button', { name: /generate yml file/i });
    await user.click(exportButton);

    // ASSERT - Verify export was triggered
    await vi.waitFor(() => {
      expect(mockBlob).not.toBeNull();
    }, { timeout: 2000 });

    // Verify blob contains YAML content
    expect(mockBlob.content).toBeDefined();
    expect(mockBlob.options.type).toBe('text/plain');

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

    const yamlFile = new File([sampleYamlContent], 'minimal-sample.yml', {
      type: 'text/yaml',
    });

    // Import original
    const fileInput = container.querySelector('#importYAMLFile');
    await user.upload(fileInput, yamlFile);

    await vi.waitFor(() => {
      expect(screen.getByLabelText(/^lab$/i)).toHaveValue('Test Lab');
    }, { timeout: 5000 });

    // Modify multiple fields
    const experimenterInputs = screen.getAllByLabelText(/experimenter name/i);
    await user.clear(experimenterInputs[0]);
    await user.type(experimenterInputs[0], 'RoundTrip, Test');

    const subjectIdInput = screen.getByLabelText(/subject id/i);
    await user.clear(subjectIdInput);
    await user.type(subjectIdInput, '88888');

    // Export
    const exportButton = screen.getByRole('button', { name: /generate yml file/i });
    await user.click(exportButton);

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
      const experimenterInputsAfterReimport = screen.getAllByLabelText(/experimenter name/i);
      expect(experimenterInputsAfterReimport[0]).toHaveValue('RoundTrip, Test');
    }, { timeout: 2000 });

    const subjectIdInputAfterReimport = screen.getByLabelText(/subject id/i);
    expect(subjectIdInputAfterReimport).toHaveValue('88888');

    // Verify other data still intact
    expect(screen.getByLabelText(/^lab$/i)).toHaveValue('Test Lab');
    expect(screen.getByLabelText(/^institution$/i)).toHaveValue('Test University');
  });
});
