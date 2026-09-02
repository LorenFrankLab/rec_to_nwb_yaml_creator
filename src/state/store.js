import { useState, useMemo, useEffect } from 'react';
import { useArrayManagement } from '../hooks/useArrayManagement';
import { useFormUpdates } from '../hooks/useFormUpdates';
import { useElectrodeGroups } from '../hooks/useElectrodeGroups';
import { defaultYMLValues } from '../valueList';
import { removeStaleCameraReferences } from '../utils/cameraReferences';

/**
 * Lightweight store facade that provides unified access to form state, actions, and selectors.
 *
 * This facade wraps existing hooks (useArrayManagement, useFormUpdates, useElectrodeGroups)
 * and provides a clean API for components. It enables future migration to useReducer without
 * changing component code.
 *
 * Includes critical data integrity logic:
 * - Task epoch cleanup: Automatically clears orphaned task_epochs from associated_files and
 *   associated_video_files when tasks are deleted. This prevents invalid YAML exports that
 *   corrupt the trodes_to_nwb pipeline and Spyglass database.
 *
 * @param {Object} initialState - Optional initial state (defaults to defaultYMLValues)
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
export function useStore(initialState = null) {
  const [formData, setFormData] = useState(initialState || defaultYMLValues);

  // Delegate to existing hooks
  const arrayActions = useArrayManagement(formData, setFormData);
  const formActions = useFormUpdates(formData, setFormData);
  const electrodeActions = useElectrodeGroups(formData, setFormData);

  /**
   * Critical data integrity: Clean up orphaned task epochs
   *
   * When tasks are deleted, references in associated_files,
   * associated_video_files, and fs_gui_yamls become invalid. This useEffect
   * automatically clears these orphaned references to prevent YAML export
   * corruption.
   *
   * Migrated from App.js (lines 274-315) during StoreContext refactor.
   *
   * IMPORTANT: no loop guard is needed because the update below returns the
   * current state object unchanged when there is nothing to clean, so React
   * bails out of the render. An earlier version skipped the check whenever the
   * set of valid epochs was unchanged, which let an orphan survive in a file
   * loaded on top of one that defined the same epochs.
   */
  useEffect(() => {
    // Get currently valid task epochs from all tasks
    const validTaskEpochs = (Array.isArray(formData.tasks) ? formData.tasks : [])
      .flatMap((task) => task?.task_epochs || [])
      .filter((epoch) => epoch !== '' && epoch !== undefined && epoch !== null);
    const isSet = (epoch) => epoch !== '' && epoch !== undefined && epoch !== null;
    const isStale = (epoch) => isSet(epoch) && !validTaskEpochs.includes(epoch);

    // Use callback form to get latest state at update time
    setFormData((currentFormData) => {
      // Check if any cleanup is needed
      const hasOrphanedEpochsInFiles = (
        Array.isArray(currentFormData.associated_files)
          ? currentFormData.associated_files
          : []
      ).some(
        (file) => isStale(file?.task_epochs)
      );
      const hasOrphanedEpochsInVideos = (
        Array.isArray(currentFormData.associated_video_files)
          ? currentFormData.associated_video_files
          : []
      ).some(
        (file) => isStale(file?.task_epochs)
      );
      const hasOrphanedEpochsInFsGui = (
        Array.isArray(currentFormData.fs_gui_yamls)
          ? currentFormData.fs_gui_yamls
          : []
      ).some(
        (item) => Array.isArray(item?.epochs) && item.epochs.some(isStale)
      );

      if (
        !hasOrphanedEpochsInFiles &&
        !hasOrphanedEpochsInVideos &&
        !hasOrphanedEpochsInFsGui
      ) {
        return currentFormData; // No changes needed
      }

      // Clone and clean up
      const updated = structuredClone(currentFormData);

      // Clean up associated_files
      if (Array.isArray(updated.associated_files)) {
        updated.associated_files.forEach((file) => {
          if (isStale(file?.task_epochs)) {
            file.task_epochs = '';
          }
        });
      }

      // Clean up associated_video_files
      if (Array.isArray(updated.associated_video_files)) {
        updated.associated_video_files.forEach((file) => {
          if (isStale(file?.task_epochs)) {
            file.task_epochs = '';
          }
        });
      }

      // Clean up fs_gui_yamls, whose epochs field is multi-valued
      if (Array.isArray(updated.fs_gui_yamls)) {
        updated.fs_gui_yamls.forEach((item) => {
          if (Array.isArray(item?.epochs)) {
            item.epochs = item.epochs.filter((epoch) => !isStale(epoch));
          }
        });
      }

      return updated;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formData.tasks]); // Cleanup only needed when tasks change; callback form guarantees latest state access

  /**
   * Critical data integrity: Clean up orphaned camera_id references
   *
   * When a camera is removed or its id is changed, camera_id references in
   * tasks, associated_video_files, and fs_gui_yamls become invalid. The form
   * only renders checkboxes for cameras that exist, so such references are
   * invisible to the user and would be exported silently. Drop them whenever
   * the cameras list changes (including on import).
   *
   * removeStaleCameraReferences returns the same object when nothing is
   * stale, so React bails out of the update and no re-render loop occurs.
   */
  useEffect(() => {
    setFormData((currentFormData) => removeStaleCameraReferences(currentFormData));
  }, [formData.cameras]);

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

      /**
       * Replaces entire form state (for bulk imports).
       * Use sparingly - prefer individual field updates for most cases.
       *
       * @param {Object} newFormData - Complete new form state
       */
      setFormData,
    }),
    [arrayActions, formActions, electrodeActions, setFormData]
  );

  return {
    model: formData,
    selectors,
    actions,
  };
}
