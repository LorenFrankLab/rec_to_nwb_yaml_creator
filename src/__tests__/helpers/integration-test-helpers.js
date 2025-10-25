/**
 * Integration Test Helpers
 *
 * Reusable helper functions for integration tests that interact with the App component.
 *
 * Philosophy (Testing Library best practices):
 * - Extract technical implementation details (blur timing, React fiber access)
 * - Extract repetitive setup patterns (adding array items)
 * - Keep test assertions visible in tests (don't hide intent)
 * - Make helpers composable (small, focused functions)
 *
 * @see https://testing-library.com/docs/react-testing-library/setup
 */

import { waitFor, fireEvent, act } from '@testing-library/react';
import { expect } from 'vitest';

/**
 * Apply blur + delay to allow React reconciliation
 *
 * React re-renders create new DOM nodes after state updates. This function
 * forces React to re-render NOW (via blur) and waits for reconciliation (~45-90ms).
 *
 * See docs/TESTING_PATTERNS.md#step-3-handle-react-timing
 *
 * @param {HTMLElement} element - Element to blur
 * @param {number} delayMs - Delay in milliseconds (default: 100)
 */
export async function blurAndWait(element, delayMs = 100) {
  element.blur();
  await act(async () => {
    await new Promise(resolve => setTimeout(resolve, delayMs));
  });
}

/**
 * Type into field and wait for React reconciliation
 *
 * Combines user.type() with blur + delay pattern to prevent stale element references.
 *
 * @param {Object} user - userEvent instance
 * @param {HTMLElement} element - Element to type into
 * @param {string} value - Value to type
 */
export async function typeAndWait(user, element, value) {
  await user.type(element, value);
  await blurAndWait(element);
}

/**
 * Select option and wait for React reconciliation
 *
 * @param {Object} user - userEvent instance
 * @param {HTMLElement} element - Select element
 * @param {string} value - Option value to select
 */
export async function selectAndWait(user, element, value) {
  await user.selectOptions(element, value);
  await blurAndWait(element);
}

/**
 * Get last element from query results
 *
 * Common pattern when adding array items - we want to interact with the most recently added item.
 *
 * @param {Array<HTMLElement>} elements - Array of elements
 * @returns {HTMLElement} Last element
 */
export function getLast(elements) {
  return elements[elements.length - 1];
}

/**
 * Helper: Add item to ListElement (like experimenter_name, keywords)
 *
 * ListElement components require typing + Enter key to add items.
 *
 * @param {Object} user - userEvent instance
 * @param {Object} screen - Testing Library screen object
 * @param {string} placeholder - Unique placeholder text (e.g., 'LastName, FirstName')
 * @param {string} value - Value to add to the list
 */
export async function addListItem(user, screen, placeholder, value) {
  const input = screen.getByPlaceholderText(placeholder);
  await user.type(input, value);
  await user.keyboard('{Enter}'); // Add to list
}

/**
 * Helper: Trigger export using React fiber approach
 *
 * Standard form submission methods don't work in jsdom (user.click, dispatchEvent, etc.)
 * We must access React's internal fiber tree and call the onSubmit handler directly.
 *
 * See docs/TESTING_PATTERNS.md#special-case-3-form-export-trigger
 *
 * @param {Object|null} mockEvent - Optional mock event object
 */
export async function triggerExport(mockEvent = null) {
  // Blur the currently focused element to ensure onBlur fires
  if (document.activeElement && document.activeElement !== document.body) {
    await act(async () => {
      fireEvent.blur(document.activeElement);
      await new Promise(resolve => setTimeout(resolve, 50));
    });
  }

  const form = document.querySelector('form');
  const fiberKey = Object.keys(form).find(key => key.startsWith('__reactFiber'));
  const fiber = form[fiberKey];
  const onSubmitHandler = fiber?.memoizedProps?.onSubmit;

  if (!onSubmitHandler) {
    throw new Error('Could not find React onSubmit handler on form element');
  }

  const event = mockEvent || {
    preventDefault: () => {},
    target: form,
    currentTarget: form,
  };

  onSubmitHandler(event);
}

/**
 * Add camera with all required fields
 *
 * Cameras require 5 fields: name, manufacturer, model, lens, metersPerPixel
 *
 * @param {Object} user - userEvent instance
 * @param {Object} screen - Testing Library screen
 * @param {Object} camera - Camera data {name, manufacturer, model, lens, metersPerPixel}
 * @returns {Promise<number>} Index of the added camera
 */
export async function addCamera(user, screen, camera) {
  const addButton = screen.getByTitle(/Add cameras/i);
  let cameraNameInputs = screen.queryAllByLabelText(/camera name/i);
  const initialCount = cameraNameInputs.length;

  await user.click(addButton);

  await waitFor(() => {
    cameraNameInputs = screen.queryAllByLabelText(/camera name/i);
    expect(cameraNameInputs.length).toBe(initialCount + 1);
  });

  // Fill camera fields
  cameraNameInputs = screen.getAllByLabelText(/camera name/i);
  await user.type(cameraNameInputs[initialCount], camera.name);

  let manufacturerInputs = screen.getAllByLabelText(/manufacturer/i);
  await user.type(manufacturerInputs[initialCount], camera.manufacturer);

  let modelInputs = screen.getAllByLabelText(/model/i);
  await user.type(modelInputs[initialCount], camera.model);

  let lensInputs = screen.getAllByLabelText(/lens/i);
  await user.type(lensInputs[initialCount], camera.lens);

  let metersPerPixelInputs = screen.getAllByLabelText(/meters per pixel/i);
  await user.clear(metersPerPixelInputs[initialCount]);
  await user.type(metersPerPixelInputs[initialCount], camera.metersPerPixel);

  return initialCount;
}

/**
 * Add task with all required fields
 *
 * Tasks require: name, description, environment, epochs (array)
 *
 * @param {Object} user - userEvent instance
 * @param {Object} screen - Testing Library screen
 * @param {Object} task - Task data {name, description, environment, epochs}
 * @returns {Promise<number>} Index of the added task
 */
export async function addTask(user, screen, task) {
  const addButton = screen.getByTitle(/Add tasks/i);
  let taskNameInputs = screen.queryAllByLabelText(/task name/i);
  const initialCount = taskNameInputs.length;

  await user.click(addButton);

  await waitFor(() => {
    taskNameInputs = screen.queryAllByLabelText(/task name/i);
    expect(taskNameInputs.length).toBe(initialCount + 1);
  });

  // Fill task name
  taskNameInputs = screen.getAllByLabelText(/task name/i);
  await typeAndWait(user, taskNameInputs[initialCount], task.name);

  // Fill task description
  let taskDescInputs = screen.getAllByLabelText(/task description/i);
  await typeAndWait(user, taskDescInputs[initialCount], task.description);

  // Fill task environment
  let taskEnvInputs = screen.getAllByLabelText(/task environment/i);
  await typeAndWait(user, taskEnvInputs[initialCount], task.environment);

  // Add task epochs (ListElement)
  const taskEpochInput = screen.getByPlaceholderText(/Type Task Epochs/i);
  for (const epoch of task.epochs) {
    await user.type(taskEpochInput, String(epoch));
    await user.keyboard('{Enter}');
  }

  return initialCount;
}

/**
 * Add electrode group with all required fields
 *
 * Electrode groups require 8 fields: location, deviceType, description, targetedLocation,
 * targetedX, targetedY, targetedZ, units
 *
 * @param {Object} user - userEvent instance
 * @param {Object} screen - Testing Library screen
 * @param {Object} group - Electrode group data
 * @returns {Promise<number>} Index of the added electrode group
 */
export async function addElectrodeGroup(user, screen, group) {
  const addButton = screen.getByTitle(/Add electrode_groups/i);

  let idInputs = screen.queryAllByPlaceholderText(/typically a number/i);
  idInputs = idInputs.filter(input =>
    input.id && input.id.startsWith('electrode_groups-id-')
  );
  const initialCount = idInputs.length;

  await user.click(addButton);

  await waitFor(() => {
    let updatedInputs = screen.queryAllByPlaceholderText(/typically a number/i);
    updatedInputs = updatedInputs.filter(input =>
      input.id && input.id.startsWith('electrode_groups-id-')
    );
    expect(updatedInputs.length).toBe(initialCount + 1);
  });

  // Fill location
  let locationInputs = screen.queryAllByPlaceholderText(/type to find a location/i);
  await typeAndWait(user, getLast(locationInputs), group.location);

  // Fill device type
  let deviceTypeInputs = screen.queryAllByLabelText(/device type/i);
  await selectAndWait(user, getLast(deviceTypeInputs), group.deviceType);

  // Fill description
  let descriptionInputs = screen.queryAllByLabelText(/^description$/i);
  await typeAndWait(user, getLast(descriptionInputs), group.description);

  // Fill targeted location
  let targetedLocationInputs = screen.queryAllByLabelText(/targeted location/i);
  await typeAndWait(user, getLast(targetedLocationInputs), group.targetedLocation);

  // Fill coordinates (use correct label text from App.js)
  let targetedXInputs = screen.queryAllByLabelText(/ML from Bregma/i);
  await typeAndWait(user, getLast(targetedXInputs), group.targetedX);

  let targetedYInputs = screen.queryAllByLabelText(/AP to Bregma/i);
  await typeAndWait(user, getLast(targetedYInputs), group.targetedY);

  let targetedZInputs = screen.queryAllByLabelText(/DV to Cortical Surface/i);
  await typeAndWait(user, getLast(targetedZInputs), group.targetedZ);

  // Fill units
  let unitsInputs = screen.queryAllByPlaceholderText(/Distance units defining positioning/i);
  await user.type(getLast(unitsInputs), group.units);

  return initialCount;
}

/**
 * Import YAML file through file upload
 *
 * Simulates uploading a YAML file and waits for import to complete.
 * Used in sample metadata tests to set up baseline state.
 *
 * @param {Object} user - userEvent instance
 * @param {Object} screen - Testing Library screen
 * @param {Object} container - DOM container from render()
 * @param {string} yamlContent - YAML file content as string
 * @param {string} filename - Filename for the File object (default: 'test.yml')
 * @returns {Promise<void>}
 */
export async function importYamlFile(user, screen, container, yamlContent, filename = 'test.yml') {
  const yamlFile = new File([yamlContent], filename, {
    type: 'text/yaml',
  });

  const fileInput = container.querySelector('#importYAMLFile');
  await user.upload(fileInput, yamlFile);

  // Wait for FileReader to complete (async operation)
  await waitFor(() => {
    const labInput = screen.getByLabelText(/^lab$/i);
    expect(labInput.value).toBeTruthy(); // Verify import completed
  }, { timeout: 5000 });
}

/**
 * Fill all HTML5-required fields to pass browser validation
 *
 * These fields are REQUIRED by HTML5 validation (required + pattern attributes)
 * and MUST be filled for export to work. Missing any will cause silent export failure.
 *
 * See docs/TESTING_PATTERNS.md for full explanation.
 *
 * @param {Object} user - userEvent instance
 * @param {Object} screen - Testing Library screen
 */
export async function fillRequiredFields(user, screen) {
  // 1. Experimenter name (ListElement)
  await addListItem(user, screen, 'LastName, FirstName', 'Test, User');

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
  await addListItem(user, screen, 'Type Keywords', 'test');

  // 8. Subject ID (required, non-whitespace pattern)
  const subjectIdInput = screen.getByLabelText(/subject id/i);
  await user.type(subjectIdInput, 'test_subject');

  // 9. Subject genotype (required, non-whitespace pattern)
  const genotypeInput = screen.getByLabelText(/genotype/i);
  await user.clear(genotypeInput);
  await user.type(genotypeInput, 'Wild Type');

  // 10. Subject date_of_birth (required, type="date" input, onBlur converts to ISO 8601)
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
