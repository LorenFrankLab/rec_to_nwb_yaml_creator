/**
 * Semantic Query Helpers for Testing
 *
 * These helpers replace brittle CSS selectors with semantic queries
 * that test user behavior instead of implementation details.
 *
 * WHY: CSS selectors break when HTML structure changes during refactoring.
 * Semantic queries are resilient to structural changes.
 */

import { screen, within } from '@testing-library/react';

/**
 * Find file input for YAML import
 *
 * @returns {HTMLInputElement} The file input element
 *
 * BEFORE: container.querySelector('#importYAMLFile')
 * AFTER: getFileInput()
 *
 * NOTE: File input only has icon label (FontAwesome icon), no text label.
 * Using ID is safe here - it's the only file input in the app.
 */
export function getFileInput() {
  return document.getElementById('importYAMLFile');
}

/**
 * Find the main form element
 *
 * @returns {HTMLFormElement} The form element
 *
 * BEFORE: container.querySelector('form')
 * AFTER: getMainForm()
 */
export function getMainForm() {
  return document.querySelector('form'); // Safe: only one form in app
}

/**
 * Find add button for array sections (cameras, tasks, electrode groups, etc.)
 *
 * @param {string} sectionName - Name of the section (e.g., "cameras", "tasks")
 * @returns {HTMLButtonElement} The add button
 *
 * BEFORE: container.querySelector('button[title="Add cameras"]')
 * AFTER: getAddButton('cameras')
 *
 * NOTE: Add buttons only have "+" symbol as accessible name, but title attribute
 * for tooltip. Using title attribute via getAllByRole + find is more semantic
 * than querySelector.
 */
export function getAddButton(sectionName) {
  const allButtons = screen.getAllByRole('button');
  return allButtons.find((btn) => {
    const title = btn.getAttribute('title');
    return title && title.toLowerCase().includes(`add ${sectionName.toLowerCase()}`);
  });
}

/**
 * Find input by label text (preferred method)
 *
 * @param {string|RegExp} labelText - Label text or regex
 * @returns {HTMLElement} The input element
 *
 * BEFORE: container.querySelector('#subject-description')
 * AFTER: getInputByLabel(/description/i)
 */
export function getInputByLabel(labelText) {
  return screen.getByLabelText(labelText);
}

/**
 * Find all remove buttons (dangerous actions, usually red)
 *
 * @returns {HTMLButtonElement[]} Array of remove buttons
 *
 * BEFORE: container.querySelectorAll('.button-danger')
 * AFTER: getRemoveButtons()
 */
export function getRemoveButtons() {
  // Remove buttons have accessible name like "Remove" or contain "×"
  const allButtons = screen.getAllByRole('button');
  return allButtons.filter(
    (btn) =>
      btn.textContent.includes('×') ||
      btn.textContent.toLowerCase().includes('remove') ||
      btn.title?.toLowerCase().includes('remove')
  );
}

/**
 * Find duplicate buttons for array items
 *
 * @returns {HTMLButtonElement[]} Array of duplicate buttons
 *
 * BEFORE: container.querySelectorAll('button[title*="Duplicate"]')
 * AFTER: getDuplicateButtons()
 */
export function getDuplicateButtons() {
  const allButtons = screen.getAllByRole('button');
  return allButtons.filter(
    (btn) =>
      btn.textContent.toLowerCase().includes('duplicate') ||
      btn.title?.toLowerCase().includes('duplicate')
  );
}

/**
 * Find a specific field within an array section by index
 * Useful for dynamic fields like electrode_groups[0], electrode_groups[1]
 *
 * @param {string} sectionName - Section name (e.g., "electrode_groups")
 * @param {number} index - Item index
 * @param {string} fieldLabel - Field label text
 * @returns {HTMLElement} The field element
 *
 * BEFORE: container.querySelector('#electrode_groups-device_type-0')
 * AFTER: getArrayField('electrode_groups', 0, /device type/i)
 */
export function getArrayField(sectionName, index, fieldLabel) {
  // Find all fields matching the label
  const allFields = screen.queryAllByLabelText(fieldLabel);

  if (allFields.length === 0) {
    throw new Error(`No fields found with label: ${fieldLabel}`);
  }

  // If index specified and exists, return that specific field
  if (index !== undefined && allFields[index]) {
    return allFields[index];
  }

  // Otherwise return first match
  return allFields[0];
}

/**
 * Find the section container for array items (electrode groups, cameras, tasks)
 *
 * @param {string} sectionName - Section name
 * @returns {HTMLElement} The section container
 *
 * BEFORE: container.querySelector('#electrode_groups-area')
 * AFTER: getSectionContainer('electrode_groups')
 */
export function getSectionContainer(sectionName) {
  // Look for heading with section name
  const heading = screen.getByRole('heading', { name: new RegExp(sectionName, 'i') });

  // Return closest details/section parent
  return heading.closest('details, section');
}

/**
 * Count items in an array section
 *
 * @param {string} sectionName - Section name
 * @returns {number} Number of items
 *
 * BEFORE: container.querySelectorAll('.array-item').length
 * AFTER: countArrayItems('electrode_groups')
 */
export function countArrayItems(sectionName) {
  const container = getSectionContainer(sectionName);

  // Count remove buttons as proxy for item count
  const removeButtons = within(container).queryAllByRole('button', { name: /remove|×/i });
  return removeButtons.length;
}

/**
 * Wait for file to be imported and form to update
 * Helper for import workflows
 *
 * @param {File} file - File object to upload
 * @param {UserEvent} user - User event instance
 * @returns {Promise<void>}
 */
export async function uploadFile(file, user) {
  const fileInput = getFileInput();
  await user.upload(fileInput, file);

  // Wait for import to process
  await new Promise(resolve => setTimeout(resolve, 100));
}

/**
 * Trigger form export (submit)
 * Direct React fiber approach (works in jsdom)
 *
 * @returns {void}
 *
 * BEFORE: form.requestSubmit() (doesn't work in jsdom)
 * AFTER: triggerExport()
 */
export function triggerExport() {
  const form = getMainForm();
  const fiberKey = Object.keys(form).find(key => key.startsWith('__reactFiber'));
  const fiber = form[fiberKey];
  const onSubmitHandler = fiber?.memoizedProps?.onSubmit;

  if (!onSubmitHandler) {
    throw new Error('Could not find React onSubmit handler on form element');
  }

  const event = {
    preventDefault: () => {},
    target: form,
    currentTarget: form,
  };

  onSubmitHandler(event);
}

/**
 * Get form field by ID (for unit tests that need exact element)
 *
 * @param {string} id - Element ID
 * @returns {HTMLElement} The element
 *
 * BEFORE: container.querySelector('#session_id')
 * AFTER: getById('session_id')
 *
 * NOTE: Use this for unit tests that test implementation details.
 * For integration tests, prefer getByLabelText().
 */
export function getById(id) {
  return document.getElementById(id);
}

/**
 * Get elements by class name
 *
 * @param {string} className - Class name (without dot)
 * @returns {HTMLElement[]} Array of elements
 *
 * BEFORE: container.querySelectorAll('.array-item__controls')
 * AFTER: getByClass('array-item__controls')
 */
export function getByClass(className) {
  return Array.from(document.getElementsByClassName(className));
}

/**
 * Get elements by name attribute
 *
 * @param {string} name - Name attribute value
 * @returns {HTMLElement[]} Array of elements
 *
 * BEFORE: container.querySelectorAll('input[name="ntrode_id"]')
 * AFTER: getByName('ntrode_id')
 */
export function getByName(name) {
  return Array.from(document.getElementsByName(name));
}
