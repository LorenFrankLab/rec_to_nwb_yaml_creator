import { useState, useMemo } from 'react';
import { useArrayManagement } from '../hooks/useArrayManagement';
import { useFormUpdates } from '../hooks/useFormUpdates';
import { useElectrodeGroups } from '../hooks/useElectrodeGroups';
import { defaultYMLValues } from '../valueList';

/**
 * Lightweight store facade that provides unified access to form state, actions, and selectors.
 *
 * This facade wraps existing hooks (useArrayManagement, useFormUpdates, useElectrodeGroups)
 * and provides a clean API for components. It enables future migration to useReducer without
 * changing component code.
 *
 * **IMPORTANT:** This store currently does NOT include side effect logic from App.js (lines 274-315).
 * The useEffect that clears task epochs from dependent fields (associated_files, associated_video_files,
 * fs_gui_yamls) when epochs are deleted is still in App.js. This will need to be moved when App.js
 * is refactored to use this store.
 *
 * @returns {Object} Store object
 * @returns {Object} return.model - The current form state (WARNING: NOT deep-frozen, do not mutate directly)
 * @returns {Object} return.actions - All state mutation functions
 * @returns {Object} return.selectors - Computed/derived data functions
 *
 * @example
 * // In a component
 * const { model, actions, selectors } = useStore();
 *
 * // Access state (read-only)
 * const sessionId = model.session_id;
 *
 * // Dispatch actions (correct way to update state)
 * actions.updateFormData('session_id', 'experiment_001');
 * actions.addArrayItem('cameras', 1);
 *
 * // Use selectors for computed values
 * const cameraIds = selectors.getCameraIds();
 * const taskEpochs = selectors.getTaskEpochs();
 */
export function useStore() {
  const [formData, setFormData] = useState(defaultYMLValues);

  // Delegate to existing hooks
  const arrayActions = useArrayManagement(formData, setFormData);
  const formActions = useFormUpdates(formData, setFormData);
  const electrodeActions = useElectrodeGroups(formData, setFormData);

  /**
   * Selectors provide computed/derived data from the state.
   * These are memoized to avoid recalculation on every render.
   */
  const selectors = useMemo(
    () => ({
      /**
       * Get all camera IDs, filtering out NaN values.
       * Used for dropdown options in tasks, associated_video_files, etc.
       *
       * @returns {number[]} Array of camera IDs
       */
      getCameraIds: () => {
        if (!formData.cameras) return [];
        const cameraIds = formData.cameras.map((camera) => camera.id);
        // Deduplicate and filter out NaN values
        return [...new Set(cameraIds)].filter((c) => !Number.isNaN(c));
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

  /**
   * Actions combine all mutation functions from the hooks.
   * Components use these to update state.
   */
  const actions = useMemo(
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
       * @param {Object} e - Event object
       * @param {Object} metaData - Metadata { key, index, type }
       */
      itemSelected: (e, metaData) => {
        const { target } = e;
        const { name, value } = target;
        const { key, index, type } = metaData || {};
        const inputValue = type === 'number' ? parseInt(value, 10) : value;

        formActions.updateFormData(name, inputValue, key, index);
      },
    }),
    [arrayActions, formActions, electrodeActions]
  );

  return {
    model: formData,
    selectors,
    actions,
  };
}
