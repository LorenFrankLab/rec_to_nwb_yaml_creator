import { useCallback } from 'react';
import {
  formatCommaSeparatedString,
  commaSeparatedStringToNumber,
} from '../utils/stringFormatting';
import { stringToInteger } from '../utils';

/**
 * Custom hook for managing form field updates with proper immutability.
 *
 * Provides functions for updating form state with various patterns:
 * - Simple key-value updates
 * - Nested object updates
 * - Array item updates
 * - Checkbox multi-selection updates
 * - Input transformation on blur (number parsing, comma-separated strings)
 *
 * @param {object} formData - Current form state
 * @param {Function} setFormData - State setter function from useState
 * @returns {object} Form update functions
 *
 * @example
 * const [formData, setFormData] = useState(defaultFormData);
 * const { updateFormData, updateFormArray, onBlur, handleChange } = useFormUpdates(formData, setFormData);
 *
 * // Simple update
 * updateFormData('lab', 'New Lab Name');
 *
 * // Nested object update
 * updateFormData('species', 'Rattus norvegicus', 'subject');
 *
 * // Array item update
 * updateFormData('id', 'camera_01', 'cameras', 0);
 *
 * // Checkbox multi-selection
 * updateFormArray('camera_ids', 'camera_01', 'tasks', 0, true);
 */
export function useFormUpdates(formData, setFormData) {
  /**
   * Updates a single form field with proper immutability.
   *
   * Supports three patterns:
   * 1. Simple key-value: updateFormData('lab', 'My Lab')
   * 2. Nested object: updateFormData('species', 'Rat', 'subject')
   * 3. Array item: updateFormData('id', 'camera_01', 'cameras', 0)
   *
   * @param {string} name - Field name to update
   * @param {*} value - New value for the field
   * @param {string} [key] - Parent object/array key (optional)
   * @param {number} [index] - Array index (optional)
   *
   * @example
   * // Update top-level field
   * updateFormData('lab', 'Frank Lab');
   *
   * // Update nested object field
   * updateFormData('subject_id', 'rat_01', 'subject');
   *
   * // Update array item field
   * updateFormData('id', 'camera_01', 'cameras', 0);
   */
  const updateFormData = useCallback(
    (name, value, key, index) => {
      // Use callback form to ensure we always work with latest state
      // This prevents race conditions when multiple rapid updates occur
      setFormData((prevFormData) => {
        const form = structuredClone(prevFormData);

        if (key === undefined) {
          // Simple key-value pair (top-level field)
          form[name] = value;
        } else if (index === undefined) {
          // Nested object field (e.g., subject.species)
          form[key][name] = value;
        } else {
          // Array item field (e.g., cameras[0].id)
          form[key][index] = form[key][index] || {};
          form[key][index][name] = value;
        }

        return form;
      });
    },
    [setFormData] // Include setFormData in dependencies for exhaustive-deps compliance
  );

  /**
   * Updates array fields with checkbox-style multi-selection.
   *
   * Manages arrays of values where users can check/uncheck items.
   * Automatically deduplicates and sorts the resulting array.
   *
   * @param {string} name - Field name containing the array
   * @param {string} value - Value to add or remove
   * @param {string} key - Parent array key (e.g., 'tasks')
   * @param {number} index - Array index (e.g., 0 for tasks[0])
   * @param {boolean} [checked=true] - Add (true) or remove (false) the value
   * @returns {null} Returns null if name or key is missing
   *
   * @example
   * // Add camera_id to task's camera_ids array
   * updateFormArray('camera_ids', 'camera_01', 'tasks', 0, true);
   *
   * // Remove camera_id from task's camera_ids array
   * updateFormArray('camera_ids', 'camera_01', 'tasks', 0, false);
   */
  const updateFormArray = useCallback(
    (name, value, key, index, checked = true) => {
      if (!name || !key) {
        return null;
      }

      const form = structuredClone(formData);

      // Ensure array item and field exist
      form[key][index] = form[key][index] || {};
      form[key][index][name] = form[key][index][name] || [];

      if (checked) {
        // Add value to array
        form[key][index][name].push(value);
      } else {
        // Remove value from array
        form[key][index][name] = form[key][index][name].filter(
          (v) => v !== value
        );
      }

      // Deduplicate and sort
      form[key][index][name] = [...new Set(form[key][index][name])];
      form[key][index][name].sort();

      setFormData(form);
      return null;
    },
    [formData, setFormData]
  );

  /**
   * Processes input transformations when user leaves a field.
   *
   * Handles special input transformations:
   * - Number inputs: Converts string to float
   * - Comma-separated strings: Converts to array of strings
   * - Comma-separated numbers: Converts to array of integers
   *
   * For controlled inputs, only updates if the value changed due to special
   * processing or if we're doing special formatting.
   *
   * @param {Event} e - Blur event object
   * @param {object} [metaData] - Optional transformation metadata
   * @param {string} [metaData.key] - Parent object/array key
   * @param {number} [metaData.index] - Array index
   * @param {boolean} [metaData.isCommaSeparatedString] - Convert to string array
   * @param {boolean} [metaData.isCommaSeparatedStringToNumber] - Convert to int array
   *
   * @example
   * // Number input transformation
   * <input type="number" onBlur={(e) => onBlur(e, {})} />
   *
   * // Comma-separated string to array
   * <input onBlur={(e) => onBlur(e, { isCommaSeparatedString: true })} />
   *
   * // Comma-separated integers to array
   * <input onBlur={(e) => onBlur(e, { isCommaSeparatedStringToNumber: true })} />
   *
   * // Nested object field
   * <input onBlur={(e) => onBlur(e, { key: 'subject' })} />
   *
   * // Array item field
   * <input onBlur={(e) => onBlur(e, { key: 'cameras', index: 0 })} />
   */
  const onBlur = useCallback(
    (e, metaData) => {
      const { target } = e;
      const { name, value, type } = target;
      const {
        key,
        index,
        isCommaSeparatedStringToNumber,
        isCommaSeparatedString,
      } = metaData || {};
      let inputValue = '';

      // Apply transformations based on metadata flags
      if (isCommaSeparatedString) {
        inputValue = formatCommaSeparatedString(value);
      } else if (isCommaSeparatedStringToNumber) {
        inputValue = commaSeparatedStringToNumber(value);
      } else {
        // Parse numbers, pass through strings
        inputValue = type === 'number' ? parseFloat(value) : value;
      }

      // Get current value from form state
      const currentValue =
        key === undefined
          ? formData[name]
          : index === undefined
            ? formData[key]?.[name]
            : formData[key]?.[index]?.[name];

      // Only update if we did special processing OR value changed
      const didSpecialProcessing =
        isCommaSeparatedString || isCommaSeparatedStringToNumber;

      if (didSpecialProcessing || inputValue !== currentValue) {
        updateFormData(name, inputValue, key, index);
      }
    },
    [formData, updateFormData]
  );

  /**
   * Creates onChange handler for controlled inputs.
   *
   * Helper factory function that creates properly-scoped onChange handlers
   * with bound name, key, and index parameters.
   *
   * @param {string} name - Field name
   * @param {string} [key] - Parent object/array key
   * @param {number} [index] - Array index
   * @returns {Function} onChange handler function
   *
   * @example
   * // Simple field
   * <input onChange={handleChange('lab')} />
   *
   * // Nested object field
   * <input onChange={handleChange('species', 'subject')} />
   *
   * // Array item field
   * <input onChange={handleChange('id', 'cameras', 0)} />
   */
  const handleChange = useCallback(
    (name, key, index) => (e) => {
      updateFormData(name, e.target.value, key, index);
    },
    [updateFormData]
  );

  /**
   * Updates ntrode channel map values for electrode groups.
   *
   * Handles special cases:
   * - Treats empty strings, '-1', and whitespace as -1 (unmapped channel)
   * - Updates the specific map entry for a shank within an electrode group
   * - Filters ntrodes by electrode_group_id to find the right shank
   *
   * @param {Event} e - Change event from the input
   * @param {object} metaData - Metadata for locating the map entry
   * @param {string} metaData.key - Form key ('ntrode_electrode_group_channel_map')
   * @param {number} metaData.index - Map index (which channel in the map)
   * @param {number} metaData.shankNumber - Which shank (ntrode) in the electrode group
   * @param {number} metaData.electrodeGroupId - Electrode group ID to filter by
   * @param {string} metaData.emptyOption - Empty option text to treat as -1
   * @returns {null} Returns null if no ntrodes found
   *
   * @example
   * // In ChannelMap component
   * <select
   *   onChange={(e) => onMapInput(e, {
   *     key: 'ntrode_electrode_group_channel_map',
   *     index: 0,
   *     shankNumber: 0,
   *     electrodeGroupId: 1,
   *     emptyOption: '-- Select --'
   *   })}
   * />
   */
  const onMapInput = useCallback(
    (e, metaData) => {
      const { key, index, shankNumber, electrodeGroupId, emptyOption } = metaData;
      const { target } = e;
      let { value } = target;

      // Treat empty options, -1, or empty strings as -1 (unmapped)
      if ([emptyOption, -1, ''].includes(value?.trim())) {
        value = -1;
      }

      const form = structuredClone(formData);
      const nTrodes = form[key].filter(
        (item) => item.electrode_group_id === electrodeGroupId
      );

      if (nTrodes.length === 0) {
        return null;
      }

      // Update the specific map entry for this shank
      nTrodes[shankNumber].map[index] = stringToInteger(value);

      // Update the entire ntrode_electrode_group_channel_map array
      updateFormData(key, form[key]);
      return null;
    },
    [formData, updateFormData]
  );

  return {
    updateFormData,
    updateFormArray,
    onBlur,
    handleChange,
    onMapInput,
  };
}
