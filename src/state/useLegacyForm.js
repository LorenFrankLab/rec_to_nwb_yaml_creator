import { useState, useMemo, useRef, useCallback } from 'react';
import { useArrayManagement } from '../hooks/useArrayManagement';
import { useFormUpdates } from '../hooks/useFormUpdates';
import { useElectrodeGroups } from '../hooks/useElectrodeGroups';
import { defaultYMLValues } from '../valueList';

/**
 * Owns the legacy single-session form slice of the store: the `formData` state, the
 * three delegated form hooks, and the legacy selectors. Extracted verbatim from the
 * former monolithic `useStore` so the composed public API is unchanged.
 *
 * @param {object|null} initialState - Optional initial form state (defaults to
 *   `defaultYMLValues`). A `{ workspace }`-only initial state still falls back to the
 *   defaults for the form fields, matching the original behavior.
 * @returns {{ formData: object, setFormData: Function, lastLoad: { current: object|null },
 *   legacyActions: object, legacySelectors: object }} `setFormData` is the raw state setter the
 *   form hooks edit through; `lastLoad` records the most recent whole-form load for the
 *   reference cleanup hooks (`useEpochCleanup`, `useCameraReferenceCleanup`).
 */
export function useLegacyForm(initialState = null) {
  const [formData, setFormData] = useState(initialState || defaultYMLValues);

  // The most recent whole-form load: a new object for each one, so the reference cleanup can
  // tell a load from an edit. `keepReferences` is true for an imported file.
  const lastLoad = useRef(null);
  const loadFormData = useCallback((newFormData, keepReferences) => {
    lastLoad.current = { keepReferences };
    setFormData(newFormData);
  }, []);

  // Delegate to existing hooks
  const arrayActions = useArrayManagement(formData, setFormData);
  const formActions = useFormUpdates(formData, setFormData);
  const electrodeActions = useElectrodeGroups(formData, setFormData);

  const legacyActions = useMemo(
    () => ({
      // Array management actions
      ...arrayActions,

      // Form update actions
      ...formActions,

      // Electrode group actions
      ...electrodeActions,

      /**
       * Updates an item after selection (e.g., from DataListElement).
       * Convenience wrapper around updateFormData with optional type parsing.
       *
       * @param {object} e - Event object
       * @param {object} metaData - Metadata { key, index, type }
       */
      itemSelected: (e, metaData) => {
        const { target } = e;
        const { name, value } = target;
        const { key, index, type } = metaData || {};
        const inputValue = type === 'number' ? parseInt(value, 10) : value;

        formActions.updateFormData(name, inputValue, key, index);
      },

      /**
       * Replaces the entire form state, e.g. to clear the form. References to cameras or task
       * epochs that the new state does not define are cleared.
       * Use sparingly - prefer individual field updates for most cases.
       *
       * @param {object} newFormData - Complete new form state
       */
      setFormData: (newFormData) => loadFormData(newFormData, false),

      /**
       * Replaces the entire form state with an imported file (`importFiles`' `formData`).
       * Unlike `setFormData`, references to cameras or task epochs the form does not define are
       * kept: they point into a section the import left out, and validation reports them until
       * that section is fixed.
       *
       * @param {object} newFormData - The imported form state
       */
      loadImportedFormData: (newFormData) => loadFormData(newFormData, true),
    }),
    [arrayActions, formActions, electrodeActions, loadFormData]
  );

  const legacySelectors = useMemo(
    () => ({
      /**
       * Get all camera IDs, filtering out NaN values.
       * Used for dropdown options in tasks, associated_video_files, etc.
       *
       * @returns {string[]} Array of camera IDs as strings (for CheckboxList compatibility)
       */
      getCameraIds: () => {
        if (!formData.cameras) return [];
        const cameraIds = formData.cameras.map((camera) => camera.id);
        // Deduplicate, filter out NaN values, and convert to strings for CheckboxList
        return [...new Set(cameraIds)]
          .filter((c) => !Number.isNaN(c))
          .map(String);
      },

      /**
       * Get all task epochs from all tasks, flattened, deduplicated, and sorted.
       * Used for dropdown options in associated_files, associated_video_files, etc.
       *
       * @returns {number[]} Array of task epochs
       */
      getTaskEpochs: () => {
        if (!formData.tasks) return [];
        const taskEpochs = formData.tasks
          .map((task) => task.task_epochs || [])
          .flat();
        // Deduplicate and sort
        return [...new Set(taskEpochs)].sort((a, b) => a - b);
      },

      /**
       * Get all behavioral event names (DIO events).
       * Used for dropdown options in fs_gui_yamls.
       *
       * @returns {string[]} Array of event names
       */
      getDioEvents: () => {
        if (!formData.behavioral_events) return [];
        return formData.behavioral_events.map((event) => event.name);
      },
    }),
    [formData]
  );

  return { formData, setFormData, lastLoad, legacyActions, legacySelectors };
}
