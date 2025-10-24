import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { App } from '../../App';
import YAML from 'yaml';

/**
 * Phase 1.5 Task 1.5.2: End-to-End Workflow Tests
 *
 * This test suite validates complete user journeys from blank form to exported YAML.
 * These tests ensure that users can successfully:
 * 1. Create a minimal valid session from blank form
 * 2. Create a complete session with all optional fields
 * 3. Add and configure all major components (experimenters, subject, cameras, tasks, etc.)
 * 4. Trigger ntrode generation
 * 5. Successfully validate and export YAML
 *
 * These workflows were marked as complete in Phase 1 but were not actually tested.
 * This fills a critical gap in test coverage for real user workflows.
 *
 * NOTE: ListElement fields (like experimenter_name) use a different structure:
 * - They have an input with name attribute but no matching id for the label
 * - Cannot use getByLabelText, must use container.querySelector('input[name="..."]')
 * - After typing, must press Enter to add item to list
 */

/**
 * Helper: Add item to ListElement (like experimenter_name)
 * @param {Object} user - userEvent instance
 * @param {HTMLElement} container - DOM container
 * @param {string} name - Name attribute of the input
 * @param {string} value - Value to add
 */
async function addListItem(user, container, name, value) {
  const input = container.querySelector(`input[name="${name}"]`);
  await user.type(input, value);
  await user.keyboard('{Enter}'); // Add to list
}

describe('End-to-End Session Creation Workflow', () => {
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

    // Mock URL.createObjectURL
    mockBlobUrl = 'blob:mock-url';
    global.window.webkitURL = {
      createObjectURL: vi.fn(() => mockBlobUrl),
    };

    // Mock window.alert
    global.window.alert = vi.fn();
  });

  /**
   * Test 1: Create minimal valid session from blank form
   *
   * Validates that:
   * - User starts with blank form
   * - User fills only required fields
   * - Form validates successfully
   * - YAML can be exported
   * - Exported YAML contains only required fields
   */
  it('creates minimal valid session from blank form', async () => {
    // ARRANGE
    const user = userEvent.setup();
    const { container } = render(<App />);

    // Verify we start with default values (not empty)
    const labInput = screen.getByLabelText(/^lab$/i);
    expect(labInput).toHaveValue('Loren Frank Lab'); // Default value from valueList.js

    // ACT - Fill required fields
    // 1. Experimenter name - use name selector for ListElement input
    const experimenterInput = container.querySelector('input[name="experimenter_name"]');
    await user.type(experimenterInput, 'Doe, John');
    await user.keyboard('{Enter}'); // Add to list

    // 2. Lab (update from default)
    await user.clear(labInput);
    await user.type(labInput, 'Test Lab');

    // 3. Institution
    const institutionInput = screen.getByLabelText(/^institution$/i);
    await user.clear(institutionInput);
    await user.type(institutionInput, 'Test University');

    // 4. Data acquisition device (already has defaults)
    // Just verify the defaults are present
    const deviceNameInputs = screen.getAllByLabelText(/^name$/i);
    const dataAcqSection = deviceNameInputs.find(input =>
      input.closest('details')?.querySelector('summary')?.textContent?.includes('Data Acquisition')
    );
    expect(dataAcqSection).toHaveValue('SpikeGadgets');

    // 5. times_period_multiplier (already has default)
    const timesMultiplierInput = screen.getByLabelText(/times period multiplier/i);
    expect(timesMultiplierInput).toHaveValue(1.5);

    // 6. raw_data_to_volts (already has default)
    const rawDataToVoltsInput = screen.getByLabelText(/raw data to volts/i);
    expect(rawDataToVoltsInput).toHaveValue(0.195);

    // ACT - Export the minimal session
    const exportButton = screen.getByRole('button', { name: /generate yml file/i });
    await user.click(exportButton);

    // ASSERT - Verify export succeeded
    await waitFor(() => {
      expect(mockBlob).not.toBeNull();
    }, { timeout: 3000 });

    // Parse exported YAML
    const exportedYaml = mockBlob.content[0];
    const exportedData = YAML.parse(exportedYaml);

    // Verify required fields are present
    expect(exportedData.experimenter_name).toEqual(['Doe, John']);
    expect(exportedData.lab).toBe('Test Lab');
    expect(exportedData.institution).toBe('Test University');
    expect(exportedData.data_acq_device).toBeDefined();
    expect(exportedData.data_acq_device[0].name).toBe('SpikeGadgets');
    expect(exportedData.times_period_multiplier).toBe(1.5);
    expect(exportedData.raw_data_to_volts).toBe(0.195);
  });

  /**
   * Test 2: Create complete session with all optional fields
   *
   * Validates that:
   * - User can fill all optional fields
   * - All sections can be populated
   * - Form validates with complete data
   * - Exported YAML includes all fields
   */
  it('creates complete session with all optional fields', async () => {
    // ARRANGE
    const user = userEvent.setup();
    render(<App />);

    // ACT - Fill required fields
    const experimenterInputs = screen.getAllByLabelText(/experimenter name/i);
    await user.clear(experimenterInputs[0]);
    await user.type(experimenterInputs[0], 'Guidera, Jennifer');

    const labInput = screen.getByLabelText(/^lab$/i);
    await user.clear(labInput);
    await user.type(labInput, 'Frank Lab');

    const institutionInput = screen.getByLabelText(/^institution$/i);
    await user.clear(institutionInput);
    await user.type(institutionInput, 'UCSF');

    // Fill optional top-level fields
    const experimentDescInput = screen.getByLabelText(/experiment description/i);
    await user.type(experimentDescInput, 'Spatial navigation with rewards');

    const sessionDescInput = screen.getByLabelText(/session description/i);
    await user.type(sessionDescInput, 'W-track alternation task');

    const sessionIdInput = screen.getByLabelText(/session id/i);
    await user.type(sessionIdInput, 'beans_01');

    // Add keywords
    const keywordsInput = screen.getByLabelText(/^keywords$/i);
    await user.type(keywordsInput, 'spatial navigation, hippocampus');
    await user.tab(); // Trigger onBlur to convert to array

    // Fill subject information
    const subjectIdInput = screen.getByLabelText(/subject id/i);
    await user.type(subjectIdInput, 'beans');

    const speciesInput = screen.getByLabelText(/^species$/i);
    await user.clear(speciesInput);
    await user.type(speciesInput, 'Rattus norvegicus');

    const sexInput = screen.getByLabelText(/^sex$/i);
    await user.selectOptions(sexInput, 'M');

    const genotypeInput = screen.getByLabelText(/^genotype$/i);
    await user.type(genotypeInput, 'Wild Type');

    const descriptionInput = screen.getByLabelText(/^description$/i);
    await user.type(descriptionInput, 'Long Evans Rat');

    // Add camera
    const addCameraButton = screen.getByRole('button', { name: /add cameras/i });
    await user.click(addCameraButton);

    const cameraNameInputs = screen.getAllByLabelText(/camera name/i);
    await user.type(cameraNameInputs[0], 'overhead_camera');

    const cameraIdInputs = screen.getAllByLabelText(/^camera id$/i);
    expect(cameraIdInputs[0]).toHaveValue(0); // Auto-assigned ID

    // Add task
    const addTaskButton = screen.getByRole('button', { name: /add tasks/i });
    await user.click(addTaskButton);

    const taskNameInputs = screen.getAllByLabelText(/task name/i);
    await user.type(taskNameInputs[0], 'sleep');

    const taskDescInputs = screen.getAllByLabelText(/task description/i);
    await user.type(taskDescInputs[0], 'Rest session before task');

    // ACT - Export the complete session
    const exportButton = screen.getByRole('button', { name: /generate yml file/i });
    await user.click(exportButton);

    // ASSERT - Verify export succeeded
    await waitFor(() => {
      expect(mockBlob).not.toBeNull();
    }, { timeout: 3000 });

    // Parse exported YAML
    const exportedYaml = mockBlob.content[0];
    const exportedData = YAML.parse(exportedYaml);

    // Verify all filled fields are present
    expect(exportedData.experimenter_name).toEqual(['Guidera, Jennifer']);
    expect(exportedData.lab).toBe('Frank Lab');
    expect(exportedData.institution).toBe('UCSF');
    expect(exportedData.experiment_description).toBe('Spatial navigation with rewards');
    expect(exportedData.session_description).toBe('W-track alternation task');
    expect(exportedData.session_id).toBe('beans_01');
    expect(exportedData.keywords).toEqual(['spatial navigation', 'hippocampus']);

    expect(exportedData.subject).toBeDefined();
    expect(exportedData.subject.subject_id).toBe('beans');
    expect(exportedData.subject.species).toBe('Rattus norvegicus');
    expect(exportedData.subject.sex).toBe('M');
    expect(exportedData.subject.genotype).toBe('Wild Type');
    expect(exportedData.subject.description).toBe('Long Evans Rat');

    expect(exportedData.cameras).toBeDefined();
    expect(exportedData.cameras).toHaveLength(1);
    expect(exportedData.cameras[0].camera_name).toBe('overhead_camera');
    expect(exportedData.cameras[0].id).toBe(0);

    expect(exportedData.tasks).toBeDefined();
    expect(exportedData.tasks).toHaveLength(1);
    expect(exportedData.tasks[0].task_name).toBe('sleep');
    expect(exportedData.tasks[0].task_description).toBe('Rest session before task');
  });

  /**
   * Test 3: Add experimenter names
   *
   * Validates that:
   * - User can add multiple experimenters
   * - Experimenter names are stored correctly
   * - Array structure is maintained
   */
  it('adds multiple experimenter names', async () => {
    // ARRANGE
    const user = userEvent.setup();
    render(<App />);

    // Get initial experimenter inputs (should have defaults)
    let experimenterInputs = screen.getAllByLabelText(/experimenter name/i);
    const initialCount = experimenterInputs.length;

    // ACT - Add a second experimenter
    const addExperimenterButton = screen.getByRole('button', { name: /add experimenter names/i });
    await user.click(addExperimenterButton);

    // Verify we now have one more experimenter
    experimenterInputs = screen.getAllByLabelText(/experimenter name/i);
    expect(experimenterInputs).toHaveLength(initialCount + 1);

    // Fill both experimenters
    await user.clear(experimenterInputs[0]);
    await user.type(experimenterInputs[0], 'Guidera, Jennifer');
    await user.clear(experimenterInputs[1]);
    await user.type(experimenterInputs[1], 'Comrie, Alison');

    // ASSERT - Fill required fields and export to verify array structure
    const labInput = screen.getByLabelText(/^lab$/i);
    await user.clear(labInput);
    await user.type(labInput, 'Test Lab');

    const institutionInput = screen.getByLabelText(/^institution$/i);
    await user.clear(institutionInput);
    await user.type(institutionInput, 'Test University');

    const exportButton = screen.getByRole('button', { name: /generate yml file/i });
    await user.click(exportButton);

    await waitFor(() => {
      expect(mockBlob).not.toBeNull();
    }, { timeout: 3000 });

    const exportedYaml = mockBlob.content[0];
    const exportedData = YAML.parse(exportedYaml);

    // Verify both experimenters are in the array
    expect(exportedData.experimenter_name).toEqual(['Guidera, Jennifer', 'Comrie, Alison']);
  });

  /**
   * Test 4: Add subject information
   *
   * Validates that:
   * - User can fill all subject fields
   * - Subject data is structured correctly
   * - Optional subject fields work
   */
  it('adds complete subject information', async () => {
    // ARRANGE
    const user = userEvent.setup();
    render(<App />);

    // ACT - Fill all subject fields
    const subjectIdInput = screen.getByLabelText(/subject id/i);
    await user.type(subjectIdInput, 'RAT001');

    const speciesInput = screen.getByLabelText(/^species$/i);
    await user.clear(speciesInput);
    await user.type(speciesInput, 'Rattus norvegicus');

    const sexInput = screen.getByLabelText(/^sex$/i);
    await user.selectOptions(sexInput, 'F');

    const genotypeInput = screen.getByLabelText(/^genotype$/i);
    await user.type(genotypeInput, 'Wild Type');

    const descriptionInput = screen.getByLabelText(/^description$/i);
    await user.type(descriptionInput, 'Long Evans female rat');

    const weightInput = screen.getByLabelText(/^weight$/i);
    await user.type(weightInput, '350');

    // Fill required fields for export
    const experimenterInputs = screen.getAllByLabelText(/experimenter name/i);
    await user.clear(experimenterInputs[0]);
    await user.type(experimenterInputs[0], 'Test, User');

    const labInput = screen.getByLabelText(/^lab$/i);
    await user.clear(labInput);
    await user.type(labInput, 'Test Lab');

    const institutionInput = screen.getByLabelText(/^institution$/i);
    await user.clear(institutionInput);
    await user.type(institutionInput, 'Test University');

    // Export to verify structure
    const exportButton = screen.getByRole('button', { name: /generate yml file/i });
    await user.click(exportButton);

    await waitFor(() => {
      expect(mockBlob).not.toBeNull();
    }, { timeout: 3000 });

    const exportedYaml = mockBlob.content[0];
    const exportedData = YAML.parse(exportedYaml);

    // ASSERT - Verify all subject fields
    expect(exportedData.subject).toBeDefined();
    expect(exportedData.subject.subject_id).toBe('RAT001');
    expect(exportedData.subject.species).toBe('Rattus norvegicus');
    expect(exportedData.subject.sex).toBe('F');
    expect(exportedData.subject.genotype).toBe('Wild Type');
    expect(exportedData.subject.description).toBe('Long Evans female rat');
    expect(exportedData.subject.weight).toBe(350); // Should be number
  });

  /**
   * Test 5: Add data acquisition device
   *
   * Validates that:
   * - Data acquisition device has correct structure
   * - All device fields are included
   * - Device array is formatted correctly
   */
  it('configures data acquisition device', async () => {
    // ARRANGE
    const user = userEvent.setup();
    render(<App />);

    // ACT - Verify and update data acquisition device
    // The form should have default values already
    const deviceNameInputs = screen.getAllByLabelText(/^name$/i);
    const dataAcqDeviceNameInput = deviceNameInputs.find(input =>
      input.closest('details')?.querySelector('summary')?.textContent?.includes('Data Acquisition')
    );

    // Verify default values
    expect(dataAcqDeviceNameInput).toHaveValue('SpikeGadgets');

    // Update the device name
    await user.clear(dataAcqDeviceNameInput);
    await user.type(dataAcqDeviceNameInput, 'Custom SpikeGadgets');

    // Fill required fields for export
    const experimenterInputs = screen.getAllByLabelText(/experimenter name/i);
    await user.clear(experimenterInputs[0]);
    await user.type(experimenterInputs[0], 'Test, User');

    const labInput = screen.getByLabelText(/^lab$/i);
    await user.clear(labInput);
    await user.type(labInput, 'Test Lab');

    const institutionInput = screen.getByLabelText(/^institution$/i);
    await user.clear(institutionInput);
    await user.type(institutionInput, 'Test University');

    // Export to verify
    const exportButton = screen.getByRole('button', { name: /generate yml file/i });
    await user.click(exportButton);

    await waitFor(() => {
      expect(mockBlob).not.toBeNull();
    }, { timeout: 3000 });

    const exportedYaml = mockBlob.content[0];
    const exportedData = YAML.parse(exportedYaml);

    // ASSERT - Verify device structure
    expect(exportedData.data_acq_device).toBeDefined();
    expect(exportedData.data_acq_device).toHaveLength(1);
    expect(exportedData.data_acq_device[0].name).toBe('Custom SpikeGadgets');
    expect(exportedData.data_acq_device[0].system).toBe('SpikeGadgets'); // Default
    expect(exportedData.data_acq_device[0].amplifier).toBe('Intan'); // Default
    expect(exportedData.data_acq_device[0].adc_circuit).toBe('Intan'); // Default
  });

  /**
   * Test 6: Add cameras with correct IDs
   *
   * Validates that:
   * - User can add multiple cameras
   * - Camera IDs auto-increment correctly
   * - Camera fields are populated
   * - Camera array structure is correct
   */
  it('adds cameras with auto-incrementing IDs', async () => {
    // ARRANGE
    const user = userEvent.setup();
    render(<App />);

    // ACT - Add first camera
    const addCameraButton = screen.getByRole('button', { name: /add cameras/i });
    await user.click(addCameraButton);

    let cameraNameInputs = screen.getAllByLabelText(/camera name/i);
    expect(cameraNameInputs).toHaveLength(1);

    await user.type(cameraNameInputs[0], 'overhead_camera');

    // Verify first camera has ID 0
    let cameraIdInputs = screen.getAllByLabelText(/^camera id$/i);
    expect(cameraIdInputs[0]).toHaveValue(0);

    // Add second camera
    await user.click(addCameraButton);

    cameraNameInputs = screen.getAllByLabelText(/camera name/i);
    expect(cameraNameInputs).toHaveLength(2);

    await user.type(cameraNameInputs[1], 'side_camera');

    // Verify second camera has ID 1
    cameraIdInputs = screen.getAllByLabelText(/^camera id$/i);
    expect(cameraIdInputs[1]).toHaveValue(1);

    // Fill required fields for export
    const experimenterInputs = screen.getAllByLabelText(/experimenter name/i);
    await user.clear(experimenterInputs[0]);
    await user.type(experimenterInputs[0], 'Test, User');

    const labInput = screen.getByLabelText(/^lab$/i);
    await user.clear(labInput);
    await user.type(labInput, 'Test Lab');

    const institutionInput = screen.getByLabelText(/^institution$/i);
    await user.clear(institutionInput);
    await user.type(institutionInput, 'Test University');

    // Export to verify
    const exportButton = screen.getByRole('button', { name: /generate yml file/i });
    await user.click(exportButton);

    await waitFor(() => {
      expect(mockBlob).not.toBeNull();
    }, { timeout: 3000 });

    const exportedYaml = mockBlob.content[0];
    const exportedData = YAML.parse(exportedYaml);

    // ASSERT - Verify camera structure
    expect(exportedData.cameras).toBeDefined();
    expect(exportedData.cameras).toHaveLength(2);
    expect(exportedData.cameras[0].id).toBe(0);
    expect(exportedData.cameras[0].camera_name).toBe('overhead_camera');
    expect(exportedData.cameras[1].id).toBe(1);
    expect(exportedData.cameras[1].camera_name).toBe('side_camera');
  });

  /**
   * Test 7: Add tasks with camera references
   *
   * Validates that:
   * - User can add tasks
   * - Tasks can reference existing cameras
   * - Task epochs are formatted correctly
   * - Task structure is valid
   */
  it('adds tasks with camera references', async () => {
    // ARRANGE
    const user = userEvent.setup();
    render(<App />);

    // First, add a camera to reference
    const addCameraButton = screen.getByRole('button', { name: /add cameras/i });
    await user.click(addCameraButton);

    const cameraNameInputs = screen.getAllByLabelText(/camera name/i);
    await user.type(cameraNameInputs[0], 'overhead_camera');

    // ACT - Add a task
    const addTaskButton = screen.getByRole('button', { name: /add tasks/i });
    await user.click(addTaskButton);

    const taskNameInputs = screen.getAllByLabelText(/task name/i);
    await user.type(taskNameInputs[0], 'sleep');

    const taskDescInputs = screen.getAllByLabelText(/task description/i);
    await user.type(taskDescInputs[0], 'Rest session');

    const taskEnvInputs = screen.getAllByLabelText(/task environment/i);
    await user.type(taskEnvInputs[0], 'home cage');

    const taskEpochInputs = screen.getAllByLabelText(/task epochs/i);
    await user.type(taskEpochInputs[0], '1, 3');
    await user.tab(); // Trigger onBlur

    // Fill required fields for export
    const experimenterInputs = screen.getAllByLabelText(/experimenter name/i);
    await user.clear(experimenterInputs[0]);
    await user.type(experimenterInputs[0], 'Test, User');

    const labInput = screen.getByLabelText(/^lab$/i);
    await user.clear(labInput);
    await user.type(labInput, 'Test Lab');

    const institutionInput = screen.getByLabelText(/^institution$/i);
    await user.clear(institutionInput);
    await user.type(institutionInput, 'Test University');

    // Export to verify
    const exportButton = screen.getByRole('button', { name: /generate yml file/i });
    await user.click(exportButton);

    await waitFor(() => {
      expect(mockBlob).not.toBeNull();
    }, { timeout: 3000 });

    const exportedYaml = mockBlob.content[0];
    const exportedData = YAML.parse(exportedYaml);

    // ASSERT - Verify task structure
    expect(exportedData.tasks).toBeDefined();
    expect(exportedData.tasks).toHaveLength(1);
    expect(exportedData.tasks[0].task_name).toBe('sleep');
    expect(exportedData.tasks[0].task_description).toBe('Rest session');
    expect(exportedData.tasks[0].task_environment).toBe('home cage');
    expect(exportedData.tasks[0].task_epochs).toEqual([1, 3]);
    // camera_id should be present and reference the camera (0)
    expect(exportedData.tasks[0].camera_id).toBeDefined();
  });

  /**
   * Test 8: Add behavioral events
   *
   * Validates that:
   * - User can add behavioral events
   * - Event structure is correct
   * - Events array is formatted properly
   */
  it('adds behavioral events', async () => {
    // ARRANGE
    const user = userEvent.setup();
    render(<App />);

    // ACT - Add behavioral events
    const addBehavioralEventButton = screen.getByRole('button', { name: /add behavioral events/i });
    await user.click(addBehavioralEventButton);

    const eventDescInputs = screen.getAllByLabelText(/event description/i);
    await user.type(eventDescInputs[0], 'Poke event');

    const eventNameInputs = screen.getAllByLabelText(/^event name$/i);
    await user.type(eventNameInputs[0], 'Din1');

    // Fill required fields for export
    const experimenterInputs = screen.getAllByLabelText(/experimenter name/i);
    await user.clear(experimenterInputs[0]);
    await user.type(experimenterInputs[0], 'Test, User');

    const labInput = screen.getByLabelText(/^lab$/i);
    await user.clear(labInput);
    await user.type(labInput, 'Test Lab');

    const institutionInput = screen.getByLabelText(/^institution$/i);
    await user.clear(institutionInput);
    await user.type(institutionInput, 'Test University');

    // Export to verify
    const exportButton = screen.getByRole('button', { name: /generate yml file/i });
    await user.click(exportButton);

    await waitFor(() => {
      expect(mockBlob).not.toBeNull();
    }, { timeout: 3000 });

    const exportedYaml = mockBlob.content[0];
    const exportedData = YAML.parse(exportedYaml);

    // ASSERT - Verify behavioral events structure
    expect(exportedData.behavioral_events).toBeDefined();
    expect(exportedData.behavioral_events).toHaveLength(1);
    expect(exportedData.behavioral_events[0].description).toBe('Poke event');
    expect(exportedData.behavioral_events[0].name).toBe('Din1');
  });

  /**
   * Test 9: Add electrode groups with device types
   *
   * Validates that:
   * - User can add electrode groups
   * - Device type selection works
   * - Electrode group fields are populated
   * - Electrode group structure is correct
   */
  it('adds electrode groups with device types', async () => {
    // ARRANGE
    const user = userEvent.setup();
    render(<App />);

    // ACT - Add electrode group
    const addElectrodeGroupButton = screen.getByRole('button', { name: /add electrode groups/i });
    await user.click(addElectrodeGroupButton);

    const electrodeGroupIdInputs = screen.getAllByLabelText(/electrode group id/i);
    expect(electrodeGroupIdInputs[0]).toHaveValue(0); // Auto-assigned ID

    const locationInputs = screen.getAllByLabelText(/^location$/i);
    const electrodeGroupLocationInput = locationInputs.find(input =>
      input.closest('details')?.querySelector('summary')?.textContent?.includes('Electrode Groups')
    );
    await user.type(electrodeGroupLocationInput, 'CA1');

    const deviceTypeInputs = screen.getAllByLabelText(/device type/i);
    await user.selectOptions(deviceTypeInputs[0], 'tetrode_12.5');

    const descriptionInputs = screen.getAllByLabelText(/^description$/i);
    const electrodeGroupDescInput = descriptionInputs.find(input =>
      input.closest('details')?.querySelector('summary')?.textContent?.includes('Electrode Groups')
    );
    await user.type(electrodeGroupDescInput, 'Dorsal CA1 tetrode');

    // Fill required fields for export
    const experimenterInputs = screen.getAllByLabelText(/experimenter name/i);
    await user.clear(experimenterInputs[0]);
    await user.type(experimenterInputs[0], 'Test, User');

    const labInput = screen.getByLabelText(/^lab$/i);
    await user.clear(labInput);
    await user.type(labInput, 'Test Lab');

    const institutionInput = screen.getByLabelText(/^institution$/i);
    await user.clear(institutionInput);
    await user.type(institutionInput, 'Test University');

    // Export to verify
    const exportButton = screen.getByRole('button', { name: /generate yml file/i });
    await user.click(exportButton);

    await waitFor(() => {
      expect(mockBlob).not.toBeNull();
    }, { timeout: 3000 });

    const exportedYaml = mockBlob.content[0];
    const exportedData = YAML.parse(exportedYaml);

    // ASSERT - Verify electrode group structure
    expect(exportedData.electrode_groups).toBeDefined();
    expect(exportedData.electrode_groups).toHaveLength(1);
    expect(exportedData.electrode_groups[0].id).toBe(0);
    expect(exportedData.electrode_groups[0].location).toBe('CA1');
    expect(exportedData.electrode_groups[0].device_type).toBe('tetrode_12.5');
    expect(exportedData.electrode_groups[0].description).toBe('Dorsal CA1 tetrode');
  });

  /**
   * Test 10: Verify ntrode generation triggers
   *
   * Validates that:
   * - Selecting device type triggers ntrode generation
   * - Ntrode maps are created automatically
   * - Ntrode structure is correct
   * - Ntrode IDs are assigned properly
   */
  it('triggers ntrode generation when device type selected', async () => {
    // ARRANGE
    const user = userEvent.setup();
    render(<App />);

    // ACT - Add electrode group and select device type
    const addElectrodeGroupButton = screen.getByRole('button', { name: /add electrode groups/i });
    await user.click(addElectrodeGroupButton);

    const locationInputs = screen.getAllByLabelText(/^location$/i);
    const electrodeGroupLocationInput = locationInputs.find(input =>
      input.closest('details')?.querySelector('summary')?.textContent?.includes('Electrode Groups')
    );
    await user.type(electrodeGroupLocationInput, 'CA1');

    // Select device type to trigger ntrode generation
    const deviceTypeInputs = screen.getAllByLabelText(/device type/i);
    await user.selectOptions(deviceTypeInputs[0], 'tetrode_12.5');

    // Wait for ntrode generation (async operation)
    await waitFor(() => {
      const ntrodeIdInputs = screen.queryAllByLabelText(/^ntrode id$/i);
      expect(ntrodeIdInputs.length).toBeGreaterThan(0);
    }, { timeout: 2000 });

    // Verify ntrode ID was created
    const ntrodeIdInputs = screen.getAllByLabelText(/^ntrode id$/i);
    expect(ntrodeIdInputs).toHaveLength(1);
    expect(ntrodeIdInputs[0]).toHaveValue(1); // Ntrode IDs start at 1

    // Fill required fields for export
    const experimenterInputs = screen.getAllByLabelText(/experimenter name/i);
    await user.clear(experimenterInputs[0]);
    await user.type(experimenterInputs[0], 'Test, User');

    const labInput = screen.getByLabelText(/^lab$/i);
    await user.clear(labInput);
    await user.type(labInput, 'Test Lab');

    const institutionInput = screen.getByLabelText(/^institution$/i);
    await user.clear(institutionInput);
    await user.type(institutionInput, 'Test University');

    // Export to verify ntrode structure
    const exportButton = screen.getByRole('button', { name: /generate yml file/i });
    await user.click(exportButton);

    await waitFor(() => {
      expect(mockBlob).not.toBeNull();
    }, { timeout: 3000 });

    const exportedYaml = mockBlob.content[0];
    const exportedData = YAML.parse(exportedYaml);

    // ASSERT - Verify ntrode structure
    expect(exportedData.ntrode_electrode_group_channel_map).toBeDefined();
    expect(exportedData.ntrode_electrode_group_channel_map).toHaveLength(1);
    expect(exportedData.ntrode_electrode_group_channel_map[0].ntrode_id).toBe(1);
    expect(exportedData.ntrode_electrode_group_channel_map[0].electrode_group_id).toBe(0);
    expect(exportedData.ntrode_electrode_group_channel_map[0].bad_channels).toEqual([]);
    expect(exportedData.ntrode_electrode_group_channel_map[0].map).toBeDefined();
    // Tetrode should have 4 channels (0, 1, 2, 3)
    expect(Object.keys(exportedData.ntrode_electrode_group_channel_map[0].map)).toHaveLength(4);
  });

  /**
   * Test 11: Verify validation and export generates valid YAML
   *
   * Validates that:
   * - Complete session passes validation
   * - YAML export succeeds
   * - Exported YAML is well-formed
   * - All sections are present in export
   */
  it('validates and exports complete session as valid YAML', async () => {
    // ARRANGE
    const user = userEvent.setup();
    render(<App />);

    // ACT - Create a complete session
    // 1. Experimenters
    const experimenterInputs = screen.getAllByLabelText(/experimenter name/i);
    await user.clear(experimenterInputs[0]);
    await user.type(experimenterInputs[0], 'Guidera, Jennifer');

    // 2. Lab & Institution
    const labInput = screen.getByLabelText(/^lab$/i);
    await user.clear(labInput);
    await user.type(labInput, 'Frank Lab');

    const institutionInput = screen.getByLabelText(/^institution$/i);
    await user.clear(institutionInput);
    await user.type(institutionInput, 'UCSF');

    // 3. Session info
    const sessionIdInput = screen.getByLabelText(/session id/i);
    await user.type(sessionIdInput, 'test_session_001');

    // 4. Subject
    const subjectIdInput = screen.getByLabelText(/subject id/i);
    await user.type(subjectIdInput, 'RAT001');

    const speciesInput = screen.getByLabelText(/^species$/i);
    await user.clear(speciesInput);
    await user.type(speciesInput, 'Rattus norvegicus');

    const sexInput = screen.getByLabelText(/^sex$/i);
    await user.selectOptions(sexInput, 'M');

    // 5. Camera
    const addCameraButton = screen.getByRole('button', { name: /add cameras/i });
    await user.click(addCameraButton);

    const cameraNameInputs = screen.getAllByLabelText(/camera name/i);
    await user.type(cameraNameInputs[0], 'overhead_camera');

    // 6. Task
    const addTaskButton = screen.getByRole('button', { name: /add tasks/i });
    await user.click(addTaskButton);

    const taskNameInputs = screen.getAllByLabelText(/task name/i);
    await user.type(taskNameInputs[0], 'w_track');

    // 7. Electrode group
    const addElectrodeGroupButton = screen.getByRole('button', { name: /add electrode groups/i });
    await user.click(addElectrodeGroupButton);

    const locationInputs = screen.getAllByLabelText(/^location$/i);
    const electrodeGroupLocationInput = locationInputs.find(input =>
      input.closest('details')?.querySelector('summary')?.textContent?.includes('Electrode Groups')
    );
    await user.type(electrodeGroupLocationInput, 'CA1');

    const deviceTypeInputs = screen.getAllByLabelText(/device type/i);
    await user.selectOptions(deviceTypeInputs[0], 'tetrode_12.5');

    // Wait for ntrode generation
    await waitFor(() => {
      const ntrodeIdInputs = screen.queryAllByLabelText(/^ntrode id$/i);
      expect(ntrodeIdInputs.length).toBeGreaterThan(0);
    }, { timeout: 2000 });

    // ACT - Validate and export
    const exportButton = screen.getByRole('button', { name: /generate yml file/i });
    await user.click(exportButton);

    // ASSERT - Verify export succeeded (validation passed)
    await waitFor(() => {
      expect(mockBlob).not.toBeNull();
    }, { timeout: 3000 });

    // Parse and validate YAML structure
    const exportedYaml = mockBlob.content[0];
    expect(exportedYaml).toBeDefined();
    expect(typeof exportedYaml).toBe('string');
    expect(exportedYaml.length).toBeGreaterThan(0);

    const exportedData = YAML.parse(exportedYaml);

    // Verify all major sections are present
    expect(exportedData.experimenter_name).toBeDefined();
    expect(exportedData.lab).toBeDefined();
    expect(exportedData.institution).toBeDefined();
    expect(exportedData.session_id).toBeDefined();
    expect(exportedData.subject).toBeDefined();
    expect(exportedData.data_acq_device).toBeDefined();
    expect(exportedData.cameras).toBeDefined();
    expect(exportedData.tasks).toBeDefined();
    expect(exportedData.electrode_groups).toBeDefined();
    expect(exportedData.ntrode_electrode_group_channel_map).toBeDefined();

    // Verify values
    expect(exportedData.experimenter_name).toEqual(['Guidera, Jennifer']);
    expect(exportedData.lab).toBe('Frank Lab');
    expect(exportedData.institution).toBe('UCSF');
    expect(exportedData.session_id).toBe('test_session_001');
    expect(exportedData.subject.subject_id).toBe('RAT001');
    expect(exportedData.subject.species).toBe('Rattus norvegicus');
    expect(exportedData.subject.sex).toBe('M');
    expect(exportedData.cameras[0].camera_name).toBe('overhead_camera');
    expect(exportedData.tasks[0].task_name).toBe('w_track');
    expect(exportedData.electrode_groups[0].location).toBe('CA1');
    expect(exportedData.electrode_groups[0].device_type).toBe('tetrode_12.5');
    expect(exportedData.ntrode_electrode_group_channel_map[0].ntrode_id).toBe(1);
  });
});
