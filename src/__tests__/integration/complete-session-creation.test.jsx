import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within, waitFor, fireEvent } from '@testing-library/react';
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
 * SOLUTION: ListElement fields CAN be queried by placeholder text!
 * - Cannot use getAllByLabelText() because input lacks id attribute
 * - CAN use screen.getByPlaceholderText() - each field has unique placeholder
 * - After typing, press Enter to add item to list
 *
 * Verified with test_listelement_query.test.jsx ✓
 */

/**
 * Helper: Add item to ListElement (like experimenter_name, keywords)
 *
 * @param {Object} user - userEvent instance
 * @param {Object} screen - Testing Library screen object
 * @param {string} placeholder - Unique placeholder text (e.g., 'LastName, FirstName')
 * @param {string} value - Value to add to the list
 */
async function addListItem(user, screen, placeholder, value) {
  const input = screen.getByPlaceholderText(placeholder);
  await user.type(input, value);
  await user.keyboard('{Enter}'); // Add to list
}

/**
 * ListElement placeholder mappings (for easy reference)
 */
const LIST_PLACEHOLDERS = {
  experimenter_name: 'LastName, FirstName',
  keywords: 'Type Keywords', // Default computed from title
};

/**
 * Helper: Fill all HTML5-required fields to pass browser validation
 *
 * These fields are REQUIRED by HTML5 validation (required + pattern attributes)
 * and MUST be filled for export to work. Missing any will cause silent export failure.
 *
 * See docs/TESTING_PATTERNS.md for full explanation.
 */
async function fillRequiredFields(user, screen) {
  // 1. Experimenter name (ListElement)
  await addListItem(user, screen, LIST_PLACEHOLDERS.experimenter_name, 'Test, User');

  // 2. Lab
  const labInput = screen.getByLabelText(/^lab$/i);
  await user.clear(labInput);
  await user.type(labInput, 'Test Lab');

  // 3. Institution
  const institutionInput = screen.getByLabelText(/institution/i);
  await user.clear(institutionInput);
  await user.type(institutionInput, 'Test Institution');

  // 4. Experiment description (required, non-whitespace pattern)
  const experimentDescInput = screen.getByLabelText(/experiment description/i);
  await user.type(experimentDescInput, 'Test experiment');

  // 5. Session description (required, non-whitespace pattern)
  const sessionDescInput = screen.getByLabelText(/session description/i);
  await user.type(sessionDescInput, 'Test session');

  // 6. Session ID (required, non-whitespace pattern)
  const sessionIdInput = screen.getByLabelText(/session id/i);
  await user.type(sessionIdInput, 'TEST01');

  // 7. Keywords (required - minItems: 1)
  await addListItem(user, screen, LIST_PLACEHOLDERS.keywords, 'test');

  // 8. Subject ID (required, non-whitespace pattern)
  const subjectIdInput = screen.getByLabelText(/subject id/i);
  await user.type(subjectIdInput, 'test_subject');

  // 9. Subject genotype (required, non-whitespace pattern)
  const genotypeInput = screen.getByLabelText(/genotype/i);
  await user.clear(genotypeInput);
  await user.type(genotypeInput, 'Wild Type');

  // 10. Subject date_of_birth (required, date format)
  const dobInput = screen.getByLabelText(/date of birth/i);
  await user.type(dobInput, '2024-01-01');

  // 11. Units analog (required, non-whitespace pattern)
  const unitsAnalogInput = screen.getByLabelText(/^analog$/i);
  await user.clear(unitsAnalogInput);
  await user.type(unitsAnalogInput, 'volts');

  // 12. Units behavioral_events (required, non-whitespace pattern)
  const unitsBehavioralInput = screen.getByLabelText(/behavioral events/i);
  await user.clear(unitsBehavioralInput);
  await user.type(unitsBehavioralInput, 'n/a');

  // 13. Default header file path (required, non-whitespace pattern)
  const headerPathInput = screen.getByLabelText(/^default header file path$/i);
  await user.clear(headerPathInput);
  await user.type(headerPathInput, 'header.h');

  // 14. Data acq device (required - minItems: 1)
  const addDataAcqDeviceButton = screen.getByTitle(/Add data_acq_device/i);
  await user.click(addDataAcqDeviceButton);

  // Wait for item to render
  await waitFor(() => {
    expect(screen.queryByText(/Item #1/)).toBeInTheDocument();
  });

  // Verify default values are set (from arrayDefaultValues in valueList.js)
  const deviceNameInput = screen.getByPlaceholderText(/typically a number/i);
  expect(deviceNameInput).toHaveValue('SpikeGadgets');
}

/**
 * Helper: Trigger export using React fiber approach
 *
 * Standard form submission methods don't work in jsdom (user.click, dispatchEvent, etc.)
 * We must access React's internal fiber tree and call the onSubmit handler directly.
 *
 * See docs/TESTING_PATTERNS.md for full explanation.
 */
async function triggerExport(mockEvent = null) {
  const form = document.querySelector('form');
  const fiberKey = Object.keys(form).find(key => key.startsWith('__reactFiber'));
  const fiber = form[fiberKey];
  const onSubmitHandler = fiber?.memoizedProps?.onSubmit;

  if (!onSubmitHandler) {
    throw new Error('Could not find React onSubmit handler on form element');
  }

  const event = mockEvent || {
    preventDefault: vi.fn(),
    target: form,
    currentTarget: form,
  };

  onSubmitHandler(event);
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
    const createObjectURLSpy = vi.fn(() => mockBlobUrl);
    global.window.webkitURL = {
      createObjectURL: createObjectURLSpy,
    };
    global.createObjectURLSpy = createObjectURLSpy; // Store for debugging

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
    render(<App />);

    // Verify we start with default values (not empty)
    const labInput = screen.getByLabelText(/^lab$/i);
    expect(labInput).toHaveValue('Loren Frank Lab'); // Default value from valueList.js

    // ACT - Fill required fields
    // 1. Experimenter name - use helper with placeholder
    await addListItem(user, screen, LIST_PLACEHOLDERS.experimenter_name, 'Doe, John');

    // Verify experimenter was added
    expect(screen.getByText(/Doe, John/)).toBeInTheDocument();

    // 2. Lab (update from default)
    await user.clear(labInput);
    await user.type(labInput, 'Test Lab');

    // 3. Institution (DataListElement - has proper id/label)
    const institutionInput = screen.getByLabelText(/institution/i);
    await user.clear(institutionInput);
    await user.type(institutionInput, 'Test University');

    // 4. Keywords (required - must have at least 1 item)
    await addListItem(user, screen, LIST_PLACEHOLDERS.keywords, 'spatial navigation');

    // 5. Experiment description (required, non-whitespace pattern)
    const experimentDescInput = screen.getByLabelText(/experiment description/i);
    await user.type(experimentDescInput, 'Minimal test experiment');

    // 6. Session description (required, non-whitespace pattern)
    const sessionDescInput = screen.getByLabelText(/session description/i);
    await user.type(sessionDescInput, 'Minimal test session');

    // 7. Session ID (required, non-whitespace pattern)
    const sessionIdInput = screen.getByLabelText(/session id/i);
    await user.type(sessionIdInput, 'TEST001');

    // 8. Subject fields
    const subjectIdInput = screen.getByLabelText(/subject id/i);
    await user.type(subjectIdInput, 'test_subject_001'); // Must match non-whitespace pattern

    const genotypeInput = screen.getByLabelText(/genotype/i);
    await user.clear(genotypeInput); // Clear default value
    await user.type(genotypeInput, 'Wild Type'); // Non-whitespace pattern

    const dobInput = screen.getByLabelText(/date of birth/i);
    await user.type(dobInput, '2024-01-01'); // ISO 8601 format

    // 7. Units (required fields with pattern validation)
    const unitsAnalogInput = screen.getByLabelText(/^analog$/i);
    await user.clear(unitsAnalogInput);
    await user.type(unitsAnalogInput, 'volts'); // Non-whitespace pattern

    const unitsBehavioralInput = screen.getByLabelText(/behavioral events/i);
    await user.clear(unitsBehavioralInput);
    await user.type(unitsBehavioralInput, 'n/a'); // Non-whitespace pattern

    // 8. Default header file path (required with non-whitespace pattern)
    const headerPathInput = screen.getByLabelText(/^default header file path$/i);
    await user.clear(headerPathInput);
    await user.type(headerPathInput, 'header.h'); // Non-whitespace pattern (no slashes which might cause issues)

    // 9. Data acq device (must have at least 1 item)
    // Default from valueList.js is empty array [], so we need to add an item
    // ArrayUpdateMenu buttons only have title attribute, not accessible name
    const addDataAcqDeviceButton = screen.getByTitle(/Add data_acq_device/i);

    await user.click(addDataAcqDeviceButton);

    // Wait for the new data acq device item to render
    // Look for the "Item #1" summary text that appears when item is added
    await waitFor(() => {
      expect(screen.queryByText(/Item #1/)).toBeInTheDocument();
    });

    // Fill required fields for the data acq device
    // NOTE: arrayDefaultValues in valueList.js provides defaults:
    //   name: 'SpikeGadgets', system: 'SpikeGadgets', amplifier: 'Intan', adc_circuit: 'Intan'
    // So we can skip filling these - they already have the right values!
    // Just verify they exist and have defaults
    const deviceNameInput = screen.getByPlaceholderText(/typically a number/i);
    expect(deviceNameInput).toHaveValue('SpikeGadgets');

    const deviceSystemInput = screen.getByPlaceholderText(/system of device/i);
    expect(deviceSystemInput).toHaveValue('SpikeGadgets');

    const deviceAmplifierInput = screen.getByPlaceholderText(/type to find an amplifier/i);
    expect(deviceAmplifierInput).toHaveValue('Intan');

    const deviceAdcInput = screen.getByPlaceholderText(/type to find an adc circuit/i);
    expect(deviceAdcInput).toHaveValue('Intan');

    // All required fields are now filled - ready to export!

    // ACT - Export the minimal session
    // ROOT CAUSE IDENTIFIED:
    // - Button has type="button" (not "submit")
    // - onClick calls submitForm() → form.requestSubmit()
    // - form.requestSubmit() doesn't trigger React onSubmit in jsdom
    // - fireEvent.submit(form) also doesn't trigger React synthetic events
    //
    // SOLUTION: Access the React fiber and call onSubmit handler directly
    const form = document.querySelector('form');

    // Get the React fiber from the DOM element
    const fiberKey = Object.keys(form).find(key => key.startsWith('__reactFiber'));
    const fiber = form[fiberKey];

    // Get the onSubmit handler from React props
    const onSubmitHandler = fiber?.memoizedProps?.onSubmit;

    if (!onSubmitHandler) {
      throw new Error('Could not find React onSubmit handler on form element');
    }

    // Create a mock event object
    const mockEvent = {
      preventDefault: vi.fn(),
      target: form,
      currentTarget: form,
    };

    // Call the React onSubmit handler directly
    onSubmitHandler(mockEvent);

    // ASSERT - Verify export succeeded
    await waitFor(() => {
      expect(mockBlob).not.toBeNull();
    });

    // Parse exported YAML
    const exportedYaml = mockBlob.content[0];
    const exportedData = YAML.parse(exportedYaml);

    // Verify required fields are present with expected values
    expect(exportedData.experimenter_name).toEqual(['Doe, John']);
    expect(exportedData.lab).toBe('Test Lab');
    expect(exportedData.institution).toBe('Test University');
    expect(exportedData.experiment_description).toBe('Minimal test experiment');
    expect(exportedData.session_description).toBe('Minimal test session');
    expect(exportedData.session_id).toBe('TEST001');
    expect(exportedData.keywords).toEqual(['spatial navigation']);

    expect(exportedData.subject).toBeDefined();
    expect(exportedData.subject.subject_id).toBe('test_subject_001');
    expect(exportedData.subject.genotype).toBe('Wild Type');
    // Date gets converted to ISO timestamp format
    expect(exportedData.subject.date_of_birth).toBe('2024-01-01T00:00:00.000Z');

    expect(exportedData.data_acq_device).toBeDefined();
    expect(exportedData.data_acq_device[0].name).toBe('SpikeGadgets');
    expect(exportedData.data_acq_device[0].system).toBe('SpikeGadgets');
    expect(exportedData.data_acq_device[0].amplifier).toBe('Intan');
    expect(exportedData.data_acq_device[0].adc_circuit).toBe('Intan');

    expect(exportedData.units.analog).toBe('volts');
    expect(exportedData.units.behavioral_events).toBe('n/a');
    expect(exportedData.default_header_file_path).toBe('header.h');

    // Default values from valueList.js
    expect(exportedData.times_period_multiplier).toBe(1.0);
    expect(exportedData.raw_data_to_volts).toBe(1.0);
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

    // ACT - Fill all required fields using helper
    await fillRequiredFields(user, screen);

    // Override/customize some fields for this test
    const labInput = screen.getByLabelText(/^lab$/i);
    await user.clear(labInput);
    await user.type(labInput, 'Frank Lab');

    const institutionInput = screen.getByLabelText(/institution/i);
    await user.clear(institutionInput);
    await user.type(institutionInput, 'UCSF');

    const experimentDescInput = screen.getByLabelText(/experiment description/i);
    await user.clear(experimentDescInput);
    await user.type(experimentDescInput, 'Spatial navigation with rewards');

    const sessionDescInput = screen.getByLabelText(/session description/i);
    await user.clear(sessionDescInput);
    await user.type(sessionDescInput, 'W-track alternation task');

    const sessionIdInput = screen.getByLabelText(/session id/i);
    await user.clear(sessionIdInput);
    await user.type(sessionIdInput, 'beans_01');

    // Update keywords
    await addListItem(user, screen, LIST_PLACEHOLDERS.keywords, 'spatial navigation');
    await addListItem(user, screen, LIST_PLACEHOLDERS.keywords, 'hippocampus');

    // Update subject information
    const subjectIdInputs = screen.getAllByLabelText(/subject id/i);
    await user.clear(subjectIdInputs[0]);
    await user.type(subjectIdInputs[0], 'beans');

    const speciesInputs = screen.getAllByLabelText(/species/i);
    await user.clear(speciesInputs[0]);
    await user.type(speciesInputs[0], 'Rattus norvegicus');

    const sexInputs = screen.getAllByLabelText(/sex/i);
    await user.selectOptions(sexInputs[0], 'M');

    const descriptionInputs = screen.getAllByLabelText(/description/i);
    await user.type(descriptionInputs[0], 'Long Evans Rat');

    // Add camera
    const addCameraButton = screen.getByTitle(/Add cameras/i);
    await user.click(addCameraButton);

    await waitFor(() => {
      const cameraNameInputs = screen.queryAllByLabelText(/camera name/i);
      expect(cameraNameInputs.length).toBeGreaterThan(0);
    });

    const cameraNameInputs = screen.getAllByLabelText(/camera name/i);
    await user.type(cameraNameInputs[0], 'overhead_camera');

    const cameraIdInputs = screen.getAllByLabelText(/^camera id$/i);
    expect(cameraIdInputs[0]).toHaveValue(0); // Auto-assigned ID

    // Add task
    const addTaskButton = screen.getByTitle(/Add tasks/i);
    await user.click(addTaskButton);

    await waitFor(() => {
      const taskItems = screen.queryAllByText(/Item #1/);
      expect(taskItems.length).toBeGreaterThan(1); // cameras + tasks
    });

    const taskNameInputs = screen.getAllByLabelText(/task name/i);
    await user.type(taskNameInputs[0], 'sleep');

    const taskDescInputs = screen.getAllByLabelText(/task description/i);
    await user.type(taskDescInputs[0], 'Rest session before task');

    // ACT - Export using React fiber approach
    await triggerExport();

    // ASSERT - Verify export succeeded
    await waitFor(() => {
      expect(mockBlob).not.toBeNull();
    });

    // Parse exported YAML
    const exportedYaml = mockBlob.content[0];
    const exportedData = YAML.parse(exportedYaml);

    // Verify all filled fields are present
    expect(exportedData.experimenter_name).toEqual(['Test, User']);
    expect(exportedData.lab).toBe('Frank Lab');
    expect(exportedData.institution).toBe('UCSF');
    expect(exportedData.experiment_description).toBe('Spatial navigation with rewards');
    expect(exportedData.session_description).toBe('W-track alternation task');
    expect(exportedData.session_id).toBe('beans_01');
    expect(exportedData.keywords).toContain('spatial navigation');
    expect(exportedData.keywords).toContain('hippocampus');

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

    // ACT - Fill required fields first
    await fillRequiredFields(user, screen);

    // Add second experimenter using ListElement pattern
    await addListItem(user, screen, LIST_PLACEHOLDERS.experimenter_name, 'Guidera, Jennifer');
    await addListItem(user, screen, LIST_PLACEHOLDERS.experimenter_name, 'Comrie, Alison');

    // Export using React fiber approach
    await triggerExport();

    // ASSERT - Verify export succeeded
    await waitFor(() => {
      expect(mockBlob).not.toBeNull();
    });

    const exportedYaml = mockBlob.content[0];
    const exportedData = YAML.parse(exportedYaml);

    // Verify multiple experimenters are in the array (includes the one from fillRequiredFields)
    expect(exportedData.experimenter_name).toContain('Test, User');
    expect(exportedData.experimenter_name).toContain('Guidera, Jennifer');
    expect(exportedData.experimenter_name).toContain('Comrie, Alison');
    expect(exportedData.experimenter_name).toHaveLength(3);
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

    // ACT - Fill required fields first
    await fillRequiredFields(user, screen);

    // Update subject fields with specific test data
    const subjectIdInputs = screen.getAllByLabelText(/subject id/i);
    const subjectIdInput = subjectIdInputs[0];
    await user.clear(subjectIdInput);
    await user.type(subjectIdInput, 'RAT001');

    const speciesInputs = screen.getAllByLabelText(/species/i);
    const speciesInput = speciesInputs[0];
    await user.clear(speciesInput);
    await user.type(speciesInput, 'Rattus norvegicus');

    const sexInputs = screen.getAllByLabelText(/sex/i);
    const sexInput = sexInputs[0];
    await user.selectOptions(sexInput, 'F');

    const descriptionInputs = screen.getAllByLabelText(/description/i);
    const descriptionInput = descriptionInputs[0];
    await user.type(descriptionInput, 'Long Evans female rat');

    const weightInputs = screen.getAllByLabelText(/weight/i);
    const weightInput = weightInputs[0];
    await user.type(weightInput, '350');

    // Export using React fiber approach
    await triggerExport();

    // ASSERT - Verify export succeeded
    await waitFor(() => {
      expect(mockBlob).not.toBeNull();
    });

    const exportedYaml = mockBlob.content[0];
    const exportedData = YAML.parse(exportedYaml);

    // Verify all subject fields
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

    // ACT - Fill required fields (includes 1 data_acq_device with defaults)
    await fillRequiredFields(user, screen);

    // Verify default values from fillRequiredFields
    const deviceNameInput = screen.getByPlaceholderText(/typically a number/i);
    expect(deviceNameInput).toHaveValue('SpikeGadgets');

    // Update the device name
    await user.clear(deviceNameInput);
    await user.type(deviceNameInput, 'Custom SpikeGadgets');

    // Export using React fiber approach
    await triggerExport();

    // ASSERT - Verify export succeeded
    await waitFor(() => {
      expect(mockBlob).not.toBeNull();
    });

    const exportedYaml = mockBlob.content[0];
    const exportedData = YAML.parse(exportedYaml);

    // Verify device structure
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

    // ACT - Fill required fields first
    await fillRequiredFields(user, screen);

    // Add first camera
    const addCameraButton = screen.getByTitle(/Add cameras/i);
    await user.click(addCameraButton);

    await waitFor(() => {
      expect(screen.queryByText(/Item #1/)).toBeInTheDocument();
    });

    let cameraNameInputs = screen.getAllByLabelText(/camera name/i);
    await user.type(cameraNameInputs[0], 'overhead_camera');

    // Verify first camera has ID 0
    let cameraIdInputs = screen.getAllByLabelText(/^camera id$/i);
    expect(cameraIdInputs[0]).toHaveValue(0);

    // Add second camera
    await user.click(addCameraButton);

    await waitFor(() => {
      const items = screen.queryAllByText(/Item #2/);
      expect(items.length).toBeGreaterThan(0);
    });

    cameraNameInputs = screen.getAllByLabelText(/camera name/i);
    await user.type(cameraNameInputs[1], 'side_camera');

    // Verify second camera has ID 1
    cameraIdInputs = screen.getAllByLabelText(/^camera id$/i);
    expect(cameraIdInputs[1]).toHaveValue(1);

    // Export using React fiber approach
    await triggerExport();

    // ASSERT - Verify export succeeded
    await waitFor(() => {
      expect(mockBlob).not.toBeNull();
    });

    const exportedYaml = mockBlob.content[0];
    const exportedData = YAML.parse(exportedYaml);

    // Verify camera structure
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

    // ACT - Fill required fields first
    await fillRequiredFields(user, screen);

    // Add a camera to reference
    const addCameraButton = screen.getByTitle(/Add cameras/i);
    await user.click(addCameraButton);

    await waitFor(() => {
      expect(screen.queryByText(/Item #1/)).toBeInTheDocument();
    });

    const cameraNameInputs = screen.getAllByLabelText(/camera name/i);
    await user.type(cameraNameInputs[0], 'overhead_camera');

    // Add a task
    const addTaskButton = screen.getByTitle(/Add tasks/i);
    await user.click(addTaskButton);

    await waitFor(() => {
      const items = screen.queryAllByText(/Item #1/);
      expect(items.length).toBeGreaterThan(1); // cameras + tasks
    });

    const taskNameInputs = screen.getAllByLabelText(/task name/i);
    await user.type(taskNameInputs[0], 'sleep');

    const taskDescInputs = screen.getAllByLabelText(/task description/i);
    await user.type(taskDescInputs[0], 'Rest session');

    const taskEnvInputs = screen.getAllByLabelText(/task environment/i);
    await user.type(taskEnvInputs[0], 'home cage');

    const taskEpochInputs = screen.getAllByLabelText(/task epochs/i);
    await user.type(taskEpochInputs[0], '1, 3');
    await user.tab(); // Trigger onBlur

    // Export using React fiber approach
    await triggerExport();

    // ASSERT - Verify export succeeded
    await waitFor(() => {
      expect(mockBlob).not.toBeNull();
    });

    const exportedYaml = mockBlob.content[0];
    const exportedData = YAML.parse(exportedYaml);

    // Verify task structure
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

    // ACT - Fill required fields first
    await fillRequiredFields(user, screen);

    // Add behavioral events
    const addBehavioralEventButton = screen.getByTitle(/Add behavioral_events/i);
    await user.click(addBehavioralEventButton);

    await waitFor(() => {
      expect(screen.queryByText(/Item #1/)).toBeInTheDocument();
    });

    const eventDescInputs = screen.getAllByLabelText(/event description/i);
    await user.type(eventDescInputs[0], 'Poke event');

    const eventNameInputs = screen.getAllByLabelText(/^event name$/i);
    await user.type(eventNameInputs[0], 'Din1');

    // Export using React fiber approach
    await triggerExport();

    // ASSERT - Verify export succeeded
    await waitFor(() => {
      expect(mockBlob).not.toBeNull();
    });

    const exportedYaml = mockBlob.content[0];
    const exportedData = YAML.parse(exportedYaml);

    // Verify behavioral events structure
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

    // ACT - Fill required fields first
    await fillRequiredFields(user, screen);

    // Add electrode group
    const addElectrodeGroupButton = screen.getByTitle(/Add electrode_groups/i);
    await user.click(addElectrodeGroupButton);

    await waitFor(() => {
      expect(screen.queryByText(/Item #1/)).toBeInTheDocument();
    });

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

    // Export using React fiber approach
    await triggerExport();

    // ASSERT - Verify export succeeded
    await waitFor(() => {
      expect(mockBlob).not.toBeNull();
    });

    const exportedYaml = mockBlob.content[0];
    const exportedData = YAML.parse(exportedYaml);

    // Verify electrode group structure
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

    // ACT - Fill required fields first
    await fillRequiredFields(user, screen);

    // Add electrode group and select device type
    const addElectrodeGroupButton = screen.getByTitle(/Add electrode_groups/i);
    await user.click(addElectrodeGroupButton);

    await waitFor(() => {
      expect(screen.queryByText(/Item #1/)).toBeInTheDocument();
    });

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

    // Export using React fiber approach
    await triggerExport();

    // ASSERT - Verify export succeeded
    await waitFor(() => {
      expect(mockBlob).not.toBeNull();
    });

    const exportedYaml = mockBlob.content[0];
    const exportedData = YAML.parse(exportedYaml);

    // Verify ntrode structure
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

    // ACT - Fill required fields first
    await fillRequiredFields(user, screen);

    // Customize fields for this comprehensive test
    await addListItem(user, screen, LIST_PLACEHOLDERS.experimenter_name, 'Guidera, Jennifer');

    const labInput = screen.getByLabelText(/^lab$/i);
    await user.clear(labInput);
    await user.type(labInput, 'Frank Lab');

    const institutionInput = screen.getByLabelText(/institution/i);
    await user.clear(institutionInput);
    await user.type(institutionInput, 'UCSF');

    const sessionIdInput = screen.getByLabelText(/session id/i);
    await user.clear(sessionIdInput);
    await user.type(sessionIdInput, 'test_session_001');

    const subjectIdInputs = screen.getAllByLabelText(/subject id/i);
    await user.clear(subjectIdInputs[0]);
    await user.type(subjectIdInputs[0], 'RAT001');

    const speciesInputs = screen.getAllByLabelText(/species/i);
    await user.clear(speciesInputs[0]);
    await user.type(speciesInputs[0], 'Rattus norvegicus');

    const sexInputs = screen.getAllByLabelText(/sex/i);
    await user.selectOptions(sexInputs[0], 'M');

    // Add camera
    const addCameraButton = screen.getByTitle(/Add cameras/i);
    await user.click(addCameraButton);

    await waitFor(() => {
      const cameraNameInputs = screen.queryAllByLabelText(/camera name/i);
      expect(cameraNameInputs.length).toBeGreaterThan(0);
    });

    const cameraNameInputs = screen.getAllByLabelText(/camera name/i);
    await user.type(cameraNameInputs[0], 'overhead_camera');

    // Add task
    const addTaskButton = screen.getByTitle(/Add tasks/i);
    await user.click(addTaskButton);

    await waitFor(() => {
      const items = screen.queryAllByText(/Item #1/);
      expect(items.length).toBeGreaterThan(1); // cameras + tasks
    });

    const taskNameInputs = screen.getAllByLabelText(/task name/i);
    await user.type(taskNameInputs[0], 'w_track');

    // Add electrode group
    const addElectrodeGroupButton = screen.getByTitle(/Add electrode_groups/i);
    await user.click(addElectrodeGroupButton);

    await waitFor(() => {
      const items = screen.queryAllByText(/Item #1/);
      expect(items.length).toBeGreaterThan(2); // cameras + tasks + electrode_groups
    });

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

    // Export using React fiber approach
    await triggerExport();

    // ASSERT - Verify export succeeded (validation passed)
    await waitFor(() => {
      expect(mockBlob).not.toBeNull();
    });

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

    // Verify values (includes experimenters from both fillRequiredFields and addListItem)
    expect(exportedData.experimenter_name).toContain('Guidera, Jennifer');
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
