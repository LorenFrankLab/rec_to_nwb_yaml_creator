import { useState, useMemo, useEffect, useRef } from 'react';
import { useArrayManagement } from '../hooks/useArrayManagement';
import { useFormUpdates } from '../hooks/useFormUpdates';
import { useElectrodeGroups } from '../hooks/useElectrodeGroups';
import { defaultYMLValues } from '../valueList';
import {
  generateDayId,
  formatExperimentDate,
  getCurrentTimestamp,
  getCurrentDate,
} from './workspaceUtils';

/**
 * Lightweight store facade that provides unified access to form state, actions, and selectors.
 *
 * This facade wraps existing hooks (useArrayManagement, useFormUpdates, useElectrodeGroups)
 * and provides a clean API for components. It enables future migration to useReducer without
 * changing component code.
 *
 * **M3 Extension:** Now includes workspace state for multi-animal, multi-day management.
 * - Legacy mode: model.{field} accesses single-session form (backward compatible)
 * - Workspace mode: model.workspace.{animals|days} accesses multi-animal data
 *
 * Includes critical data integrity logic:
 * - Task epoch cleanup: Automatically clears orphaned task_epochs from associated_files and
 *   associated_video_files when tasks are deleted. This prevents invalid YAML exports that
 *   corrupt the trodes_to_nwb pipeline and Spyglass database.
 *
 * @param {object} initialState - Optional initial state (defaults to defaultYMLValues)
 * @returns {object} Store object
 * @returns {object} return.model - The current form state (WARNING: NOT deep-frozen, do not mutate directly)
 * @returns {object} return.model.workspace - Workspace state (animals, days, settings)
 * @returns {object} return.actions - All state mutation functions
 * @returns {object} return.selectors - Computed/derived data functions
 *
 * @example
 * // Legacy single-session mode (backward compatible)
 * const { model, actions, selectors } = useStore();
 * const sessionId = model.session_id;
 * actions.updateFormData('session_id', 'experiment_001');
 *
 * @example
 * // Workspace mode (M3+)
 * const { model, actions, selectors } = useStore();
 * const animal = model.workspace.animals['remy'];
 * actions.createAnimal('remy', { species: 'Rattus norvegicus', ... });
 * const days = selectors.getAnimalDays('remy');
 */
export function useStore(initialState = null) {
  const [formData, setFormData] = useState(initialState || defaultYMLValues);

  // M3: Workspace state for multi-animal, multi-day management
  // If initialState.workspace is provided (e.g., in tests), use it; otherwise use defaults
  const [workspace, setWorkspace] = useState(
    initialState?.workspace || {
      version: '1.0.0',
      lastModified: getCurrentTimestamp(),
      animals: {},
      days: {},
      settings: {
        defaultLab: '',
        defaultInstitution: '',
        defaultExperimenters: [],
        autoSaveInterval: 30000,
        shadowExportEnabled: true,
      },
    }
  );

  // Delegate to existing hooks
  const arrayActions = useArrayManagement(formData, setFormData);
  const formActions = useFormUpdates(formData, setFormData);
  const electrodeActions = useElectrodeGroups(formData, setFormData);

  /**
   * Critical data integrity: Clean up orphaned task epochs
   *
   * When tasks are deleted, any task_epochs references in associated_files or
   * associated_video_files become invalid. This useEffect automatically clears
   * these orphaned references to prevent YAML export corruption.
   *
   * Migrated from App.js (lines 274-315) during StoreContext refactor.
   *
   * IMPORTANT: Uses a ref to track the last set of valid epochs to avoid infinite
   * loops. Only runs cleanup when the valid epochs actually change (when tasks change).
   */
  const lastValidEpochsRef = useRef('[]');

  useEffect(() => {
    // Get currently valid task epochs from all tasks
    const validTaskEpochs = (formData.tasks || [])
      .flatMap((task) => task.task_epochs || [])
      .filter(Boolean); // Remove empty/null values

    // Serialize for comparison
    const validEpochsStr = JSON.stringify([...validTaskEpochs].sort());

    // Only proceed if the set of valid epochs has changed
    if (validEpochsStr === lastValidEpochsRef.current) {
      return;
    }

    // Update ref to mark this epoch set as processed
    // Do this BEFORE the setFormData callback to prevent duplicate cleanup attempts
    lastValidEpochsRef.current = validEpochsStr;

    // Use callback form to get latest state at update time
    setFormData((currentFormData) => {
      // Check if any cleanup is needed
      const hasOrphanedEpochsInFiles = (currentFormData.associated_files || []).some(
        (file) => file.task_epochs && !validTaskEpochs.includes(file.task_epochs)
      );
      const hasOrphanedEpochsInVideos = (currentFormData.associated_video_files || []).some(
        (file) => file.task_epochs && !validTaskEpochs.includes(file.task_epochs)
      );

      if (!hasOrphanedEpochsInFiles && !hasOrphanedEpochsInVideos) {
        return currentFormData; // No changes needed
      }

      // Clone and clean up
      const updated = structuredClone(currentFormData);

      // Clean up associated_files
      if (updated.associated_files) {
        updated.associated_files.forEach((file) => {
          if (file.task_epochs && !validTaskEpochs.includes(file.task_epochs)) {
            file.task_epochs = '';
          }
        });
      }

      // Clean up associated_video_files
      if (updated.associated_video_files) {
        updated.associated_video_files.forEach((file) => {
          if (file.task_epochs && !validTaskEpochs.includes(file.task_epochs)) {
            file.task_epochs = '';
          }
        });
      }

      return updated;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formData.tasks]); // Cleanup only needed when tasks change; callback form guarantees latest state access

  /**
   * M3: Workspace actions for animal/day management
   */
  const workspaceActions = useMemo(
    () => ({
      /**
       * Creates a new animal with shared metadata
       *
       * @param {string} animalId - Unique animal identifier
       * @param {object} subject - Subject metadata (species, sex, genotype, DOB, description)
       * @param {object} [metadata] - Optional additional metadata (devices, cameras, experimenters, optogenetics)
       * @throws {Error} If animal ID already exists
       */
      createAnimal: (animalId, subject, metadata = {}) => {
        setWorkspace((prev) => {
          if (prev.animals[animalId]) {
            throw new Error(`Animal "${animalId}" already exists`);
          }

          const now = getCurrentTimestamp();
          const today = getCurrentDate();

          // Apply workspace defaults to experimenters if not provided
          const experimenters = metadata.experimenters || {
            experimenter_name: prev.settings.defaultExperimenters,
            lab: prev.settings.defaultLab,
            institution: prev.settings.defaultInstitution,
          };

          const animal = {
            id: animalId,
            subject: {
              subject_id: animalId,
              ...subject,
            },
            devices: metadata.devices || {
              data_acq_device: [],
              device: { name: [] },
              electrode_groups: [],
              ntrode_electrode_group_channel_map: [],
            },
            cameras: metadata.cameras || [],
            experimenters,
            optogenetics: metadata.optogenetics,
            days: [],
            created: now,
            lastModified: now,
            configurationHistory: [
              {
                version: 1,
                date: today,
                description: 'Initial configuration',
                devices: {
                  electrode_groups: metadata.devices?.electrode_groups || [],
                  ntrode_electrode_group_channel_map: metadata.devices?.ntrode_electrode_group_channel_map || [],
                },
                appliedToDays: [],
              },
            ],
          };

          return {
            ...prev,
            animals: {
              ...prev.animals,
              [animalId]: animal,
            },
            lastModified: now,
          };
        });
      },

      /**
       * Updates animal metadata
       *
       * @param {string} animalId - Animal identifier
       * @param {object} updates - Partial updates to apply
       * @throws {Error} If animal does not exist
       */
      updateAnimal: (animalId, updates) => {
        setWorkspace((prev) => {
          if (!prev.animals[animalId]) {
            throw new Error(`Animal "${animalId}" not found`);
          }

          const animal = prev.animals[animalId];
          const updated = structuredClone(animal);

          // Apply updates (deep merge for nested objects)
          if (updates.subject) {
            updated.subject = { ...updated.subject, ...updates.subject };
          }
          if (updates.experimenters) {
            updated.experimenters = { ...updated.experimenters, ...updates.experimenters };
          }
          if (updates.devices) {
            updated.devices = { ...updated.devices, ...updates.devices };
          }
          if (updates.cameras) {
            updated.cameras = updates.cameras;
          }
          if (updates.optogenetics) {
            updated.optogenetics = updates.optogenetics;
          }

          updated.lastModified = getCurrentTimestamp();

          return {
            ...prev,
            animals: {
              ...prev.animals,
              [animalId]: updated,
            },
            lastModified: updated.lastModified,
          };
        });
      },

      /**
       * Deletes animal and all associated days
       *
       * @param {string} animalId - Animal identifier
       * @throws {Error} If animal does not exist
       */
      deleteAnimal: (animalId) => {
        setWorkspace((prev) => {
          if (!prev.animals[animalId]) {
            throw new Error(`Animal "${animalId}" not found`);
          }

          const animal = prev.animals[animalId];
          const updatedAnimals = { ...prev.animals };
          const updatedDays = { ...prev.days };

          // Delete all days for this animal
          animal.days.forEach((dayId) => {
            delete updatedDays[dayId];
          });

          // Delete animal
          delete updatedAnimals[animalId];

          return {
            ...prev,
            animals: updatedAnimals,
            days: updatedDays,
            lastModified: getCurrentTimestamp(),
          };
        });
      },

      /**
       * Adds a new configuration snapshot to track probe changes
       *
       * @param {string} animalId - Animal identifier
       * @param {object} config - Configuration data (date, description, devices)
       * @throws {Error} If animal does not exist
       */
      addConfigurationSnapshot: (animalId, config) => {
        setWorkspace((prev) => {
          if (!prev.animals[animalId]) {
            throw new Error(`Animal "${animalId}" not found`);
          }

          const animal = prev.animals[animalId];
          const updated = structuredClone(animal);

          const newVersion = {
            version: updated.configurationHistory.length + 1,
            date: config.date,
            description: config.description,
            devices: config.devices,
            appliedToDays: [],
          };

          updated.configurationHistory.push(newVersion);
          updated.lastModified = getCurrentTimestamp();

          return {
            ...prev,
            animals: {
              ...prev.animals,
              [animalId]: updated,
            },
            lastModified: updated.lastModified,
          };
        });
      },

      /**
       * Creates a new recording day for an animal
       *
       * @param {string} animalId - Parent animal identifier
       * @param {string} date - Date in YYYY-MM-DD format
       * @param {object} session - Session metadata (session_id, session_description, etc.)
       * @throws {Error} If animal does not exist or day already exists
       */
      createDay: (animalId, date, session) => {
        setWorkspace((prev) => {
          if (!prev.animals[animalId]) {
            throw new Error(`Animal "${animalId}" not found`);
          }

          const dayId = generateDayId(animalId, date);

          if (prev.days[dayId]) {
            throw new Error(`Day "${dayId}" already exists`);
          }

          const animal = prev.animals[animalId];
          const now = getCurrentTimestamp();

          const day = {
            id: dayId,
            animalId,
            date,
            experimentDate: formatExperimentDate(date),
            session: {
              session_id: session.session_id,
              session_description: session.session_description,
              experiment_description: session.experiment_description,
              weight: session.weight,
            },
            tasks: [],
            behavioral_events: [],
            associated_files: [],
            associated_video_files: [],
            technical: {
              times_period_multiplier: 1.5,
              raw_data_to_volts: 0.195,
              default_header_file_path: '',
              units: undefined,
            },
            state: {
              draft: true,
              validated: false,
              exported: false,
            },
            created: now,
            lastModified: now,
            configurationVersion: animal.configurationHistory.length, // Latest version
          };

          const updatedAnimal = { ...animal, days: [...animal.days, dayId] };

          return {
            ...prev,
            animals: {
              ...prev.animals,
              [animalId]: updatedAnimal,
            },
            days: {
              ...prev.days,
              [dayId]: day,
            },
            lastModified: now,
          };
        });
      },

      /**
       * Updates day metadata
       *
       * @param {string} dayId - Day identifier
       * @param {object} updates - Partial updates to apply
       * @throws {Error} If day does not exist
       */
      updateDay: (dayId, updates) => {
        setWorkspace((prev) => {
          if (!prev.days[dayId]) {
            throw new Error(`Day "${dayId}" not found`);
          }

          const day = prev.days[dayId];
          const updated = structuredClone(day);

          // Apply updates (deep merge for nested objects)
          if (updates.session) {
            updated.session = { ...updated.session, ...updates.session };
          }
          if (updates.tasks !== undefined) {
            updated.tasks = updates.tasks;
          }
          if (updates.behavioral_events !== undefined) {
            updated.behavioral_events = updates.behavioral_events;
          }
          if (updates.associated_files !== undefined) {
            updated.associated_files = updates.associated_files;
          }
          if (updates.associated_video_files !== undefined) {
            updated.associated_video_files = updates.associated_video_files;
          }
          if (updates.technical) {
            updated.technical = { ...updated.technical, ...updates.technical };
          }
          if (updates.deviceOverrides) {
            updated.deviceOverrides = updates.deviceOverrides;
          }
          if (updates.state) {
            updated.state = { ...updated.state, ...updates.state };
          }

          updated.lastModified = getCurrentTimestamp();

          return {
            ...prev,
            days: {
              ...prev.days,
              [dayId]: updated,
            },
            lastModified: updated.lastModified,
          };
        });
      },

      /**
       * Deletes a recording day
       *
       * @param {string} dayId - Day identifier
       * @throws {Error} If day does not exist
       */
      deleteDay: (dayId) => {
        setWorkspace((prev) => {
          if (!prev.days[dayId]) {
            throw new Error(`Day "${dayId}" not found`);
          }

          const day = prev.days[dayId];
          const animal = prev.animals[day.animalId];
          const updatedAnimal = {
            ...animal,
            days: animal.days.filter((id) => id !== dayId),
          };

          const updatedDays = { ...prev.days };
          delete updatedDays[dayId];

          return {
            ...prev,
            animals: {
              ...prev.animals,
              [day.animalId]: updatedAnimal,
            },
            days: updatedDays,
            lastModified: getCurrentTimestamp(),
          };
        });
      },

      /**
       * Updates workspace settings
       *
       * @param {object} settings - Partial settings updates
       */
      updateWorkspaceSettings: (settings) => {
        setWorkspace((prev) => ({
          ...prev,
          settings: {
            ...prev.settings,
            ...settings,
          },
          lastModified: getCurrentTimestamp(),
        }));
      },
    }),
    []
  );

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

      /**
       * M3: Get all days for a specific animal, sorted by date
       *
       * @param {string} animalId - Animal identifier
       * @returns {Array} Array of day objects sorted by date
       */
      getAnimalDays: (animalId) => {
        const animal = workspace.animals[animalId];
        if (!animal) return [];

        return animal.days
          .map((dayId) => workspace.days[dayId])
          .filter(Boolean)
          .sort((a, b) => a.date.localeCompare(b.date));
      },
    }),
    [formData, workspace]
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

      // M3: Workspace actions
      ...workspaceActions,

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
       * Replaces entire form state (for bulk imports).
       * Use sparingly - prefer individual field updates for most cases.
       *
       * @param {object} newFormData - Complete new form state
       */
      setFormData,
    }),
    [arrayActions, formActions, electrodeActions, workspaceActions, setFormData]
  );

  // M3: Memoize model to prevent unnecessary re-renders
  // Only create new model object when formData or workspace actually change
  // IMPORTANT: Ensure formData is always defined before spreading
  const model = useMemo(
    () => {
      // Defensive check: ensure formData exists before creating model
      if (!formData) {
        console.warn('useStore: formData is undefined, using defaultYMLValues');
        return {
          ...defaultYMLValues,
          workspace,
        };
      }

      return {
        ...formData,
        workspace,
      };
    },
    [formData, workspace]
  );

  return {
    model,
    selectors,
    actions,
  };
}
