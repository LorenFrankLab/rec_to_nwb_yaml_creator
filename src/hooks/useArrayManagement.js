/**
 * @file useArrayManagement.js
 * @description Custom React hook for managing array fields in form data
 *
 * Extracted from App.js to improve code organization and testability.
 * Provides functions for adding, removing, and duplicating array items.
 *
 * @module hooks/useArrayManagement
 */

import { arrayDefaultValues } from '../valueList';

/**
 * Custom hook for managing array operations in form data
 *
 * @param {object} formData - Current form state
 * @param {Function} setFormData - State setter function
 * @returns {object} Object containing array management functions
 *
 * @example
 * const { addArrayItem, removeArrayItem, duplicateArrayItem } = useArrayManagement(formData, setFormData);
 * addArrayItem('cameras', 2); // Add 2 cameras
 * removeArrayItem(0, 'tasks'); // Remove first task
 * duplicateArrayItem(1, 'electrode_groups'); // Duplicate second electrode group
 */
export function useArrayManagement(formData, setFormData) {
  /**
   * Add new items to an array field
   *
   * Behavior:
   * 1. Clones formData using structuredClone for immutability
   * 2. Gets default value template from arrayDefaultValues[key]
   * 3. Creates count number of items from template
   * 4. Auto-increments IDs if template has id field
   * 5. Pushes new items to form[key] array
   * 6. Updates formData state
   *
   * ID Management:
   * - If arrayDefaultValue has id field: auto-increment from max existing ID
   * - Starts from 0 if array is empty
   * - Increments by 1 for each new item
   * - Example: existing IDs [0, 1, 2] → new items get IDs [3, 4, 5]
   *
   * @param {string} key - Array field name (e.g., 'cameras', 'tasks', 'electrode_groups')
   * @param {number} count - Number of items to add (default: 1)
   *
   * @example
   * addArrayItem('cameras'); // Add 1 camera
   * addArrayItem('tasks', 5); // Add 5 tasks
   */
  const addArrayItem = (key, count = 1) => {
    const form = structuredClone(formData);
    const arrayDefaultValue = arrayDefaultValues[key];
    const items = Array(count).fill({ ...arrayDefaultValue });
    const formItems = form[key];
    const idValues = formItems
      .map((formItem) => formItem.id)
      .filter((formItem) => formItem !== undefined);

    // -1 means no id field, else there it exist and get max
    let maxId = -1;

    if (arrayDefaultValue?.id !== undefined) {
      maxId = idValues.length > 0 ? Math.max(...idValues) + 1 : 0;
    }

    items.forEach((item) => {
      const selectedItem = { ...item }; // best never to directly alter iterator

      // if id exist, increment to avoid duplicates
      if (maxId !== -1) {
        selectedItem.id = maxId;
        maxId += 1;
      }

      formItems.push(selectedItem);
    });

    setFormData(form);
  };

  /**
   * Remove an item from an array field
   *
   * Displays a confirmation dialog before removal.
   * Does nothing if array is empty or index is invalid.
   *
   * @param {number} index - Array index to remove
   * @param {string} key - Array field name
   *
   * @example
   * removeArrayItem(0, 'cameras'); // Remove first camera
   */
  const removeArrayItem = (index, key) => {
    // window.confirm is appropriate here - simple confirmation before destructive action
    // eslint-disable-next-line no-restricted-globals
    if (window.confirm(`Remove index ${index} from ${key}?`)) {
      const form = structuredClone(formData);
      const items = form[key]; // Already a clone from structuredClone(formData) above

      if (!items || items.length === 0) {
        return null;
      }

      items.splice(index, 1);
      form[key] = items;
      setFormData(form);
    }
  };

  /**
   * Duplicate an array item
   *
   * Creates a copy of the item at the specified index and inserts it
   * immediately after the original. If the item has an 'id' field,
   * it will be auto-incremented to avoid collisions.
   *
   * ID Handling:
   * - Detects 'id' or ' id' fields (case-insensitive)
   * - Sets new id to max(existing ids) + 1
   * - Works with any case variation of 'id' field name
   *
   * @param {number} index - Array index to duplicate
   * @param {string} key - Array field name
   *
   * @example
   * duplicateArrayItem(0, 'cameras'); // Duplicate first camera
   */
  const duplicateArrayItem = (index, key) => {
    const form = structuredClone(formData);
    const item = structuredClone(form[key][index]);

    // Guard clause: return early if invalid index
    if (!item) {
      console.warn(`duplicateArrayItem: Invalid index ${index} for key "${key}"`);
      return;
    }

    // Set id to max(existing ids) + 1 if id field exists
    const keys = Object.keys(item);
    keys.forEach((keyItem) => {
      const keyLowerCase = keyItem.toLowerCase(); // normalize case for comparison
      if (['id', ' id'].includes(keyLowerCase)) {
        const ids = form[key].map((formKey) => {
          return formKey[keyLowerCase];
        });

        const maxId = Math.max(...ids);
        item[keyItem] = maxId + 1;
      }
    });

    form[key].splice(index + 1, 0, item);
    setFormData(form);
  };

  return {
    addArrayItem,
    removeArrayItem,
    duplicateArrayItem,
  };
}
