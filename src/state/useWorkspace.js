import { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import {
  generateDayId,
  formatExperimentDate,
  getCurrentTimestamp,
  getCurrentDate,
} from './workspaceUtils';
import { FLAGS } from '../featureFlags';
import { loadWorkspace, saveWorkspace, clearWorkspace } from './persistence';

/**
 * Owns the workspace slice of the store: multi-animal/day state, its localStorage
 * hydration + debounced autosave, the eight workspace mutation actions, the
 * `getAnimalDays` selector, and the persistence status object that drives the
 * SaveIndicator and beforeunload guard.
 *
 * Extracted verbatim from the former monolithic `useStore`. The `setWorkspace`
 * functional-update form (rather than a reducer) is kept deliberately so the
 * duplicate-id `throw`s surface with the same timing the existing tests assert.
 *
 * @param {object|null} initialState - Optional initial state; `initialState.workspace`
 *   (test-provided) wins over localStorage hydration.
 * @returns {{ workspace: object, setWorkspace: Function, workspaceActions: object, workspaceSelectors: object, persistence: object }}
 */
export function useWorkspace(initialState = null) {
  // Hydrate from localStorage when persistence is enabled and no test-provided
  // workspace was supplied. Any discard reason is captured for a post-mount notice
  // (we cannot call setState during render).
  const initialDiscardRef = useRef(null);

  const [workspace, setWorkspace] = useState(() => {
    const fallback = {
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
    };

    if (initialState?.workspace) return initialState.workspace; // tests win
    if (!FLAGS.localStoragePersistence) return fallback;

    const loaded = loadWorkspace();
    if (loaded == null) return fallback; // clean first run
    if (loaded.workspace) return loaded.workspace; // hydrated
    initialDiscardRef.current = loaded.discarded; // unusable blob → notice after mount
    return fallback;
  });

  // Latest committed workspace, refreshed every render. Lets the memoized actions and
  // `saveNow` read the authoritative current state synchronously (the `setWorkspace`
  // updater is deferred under React batching, so its result is not available at the
  // moment an action returns).
  const workspaceRef = useRef(workspace);
  workspaceRef.current = workspace;

  // Persistence status: drives the truthful SaveIndicator and the beforeunload guard.
  const [lastSaved, setLastSaved] = useState(null); // ISO string of last confirmed write, or null
  const [saveError, setSaveError] = useState(null); // user-facing save-failure message, or null
  const [hasPendingWrite, setHasPendingWrite] = useState(false); // debounce in flight
  const [loadNotice, setLoadNotice] = useState(null); // discard notice for the UI, or null

  // Surface a discard notice after mount when a saved blob could not be restored,
  // and clear the unusable blob so it isn't re-read.
  useEffect(() => {
    if (initialDiscardRef.current) {
      setLoadNotice(
        'Saved workspace data could not be restored (it was from an incompatible ' +
          'or corrupted version) and was discarded. Starting with an empty workspace.'
      );
      initialDiscardRef.current = null;
      clearWorkspace();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Debounced autosave on workspace change only (never on legacy formData edits).
  // Skip the initial render so we don't immediately rewrite what we just hydrated.
  const didMountAutosaveRef = useRef(false);

  useEffect(() => {
    if (!FLAGS.localStoragePersistence) return undefined;

    if (!didMountAutosaveRef.current) {
      didMountAutosaveRef.current = true;
      return undefined;
    }

    setHasPendingWrite(true);
    const timer = setTimeout(() => {
      try {
        saveWorkspace(workspace);
        setLastSaved(new Date().toISOString());
        setSaveError(null);
      } catch (err) {
        setSaveError(`Could not save workspace: ${err.message}`);
      } finally {
        setHasPendingWrite(false);
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [workspace]);

  /**
   * Workspace actions for animal/day management.
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
       * Adds a new configuration snapshot to track probe changes and returns the
       * created version number. The version is assigned from the authoritative store
       * state inside the `setWorkspace` updater (not from a possibly-stale caller
       * snapshot), so the reconfiguration wizard can apply the snapshot forward to
       * exactly the version it just created — no cross-action re-derivation.
       *
       * @param {string} animalId - Animal identifier
       * @param {object} config - Configuration data (date, description, devices)
       * @returns {number} The version number assigned to the created snapshot.
       * @throws {Error} If animal does not exist
       */
      addConfigurationSnapshot: (animalId, config) => {
        // The version is assigned from `prev` inside the updater so sequential adds
        // number correctly (1→2→3). The returned value is derived from the authoritative
        // current store (workspaceRef) rather than the deferred updater, because React
        // batches the updater and its result is not available when this action returns.
        // For a single add per tick — the wizard's create-then-apply path — the two
        // agree: no intervening update changes the history length between them.
        const current = workspaceRef.current.animals[animalId];
        const createdVersion = current ? current.configurationHistory.length + 1 : undefined;

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

        return createdVersion;
      },

      /**
       * Applies a configuration snapshot forward to a set of days: points each
       * listed day at `snapshotVersion` and keeps each snapshot's `appliedToDays`
       * a partition (a day appears in at most one snapshot's list). Used by the
       * reconfiguration wizard AFTER it has created the snapshot via
       * {@link addConfigurationSnapshot}; creation and assignment stay separate so
       * each action's `setWorkspace` is self-contained.
       *
       * @param {string} animalId - Animal identifier.
       * @param {number} snapshotVersion - Existing snapshot version to apply.
       * @param {string[]} dayIds - Day ids to move onto that version.
       * @throws {Error} If the animal or the snapshot version does not exist.
       */
      applyConfigurationForward: (animalId, snapshotVersion, dayIds) => {
        setWorkspace((prev) => {
          if (!prev.animals[animalId]) {
            throw new Error(`Animal "${animalId}" not found`);
          }

          const animal = structuredClone(prev.animals[animalId]);
          const target = animal.configurationHistory.find((s) => s.version === snapshotVersion);
          if (!target) {
            throw new Error(
              `Configuration version "${snapshotVersion}" not found for animal "${animalId}"`
            );
          }

          const now = getCurrentTimestamp();
          // Only real, deduped days move — a day id not in the workspace must never
          // leak into appliedToDays (which would pollute the usage view).
          const validDayIds = [...new Set(dayIds)].filter((id) => prev.days[id]);
          const moving = new Set(validDayIds);

          // (3) Remove the moving days from EVERY snapshot's list first, so the
          // result is a clean partition regardless of stale stored lists.
          animal.configurationHistory.forEach((snapshot) => {
            snapshot.appliedToDays = (snapshot.appliedToDays || []).filter((id) => !moving.has(id));
          });
          // (2) Add them to the target snapshot's list (dedup, stable order).
          target.appliedToDays = [
            ...target.appliedToDays.filter((id) => !moving.has(id)),
            ...validDayIds,
          ];

          // (1) Point each listed day at the target version.
          const updatedDays = { ...prev.days };
          validDayIds.forEach((dayId) => {
            updatedDays[dayId] = {
              ...structuredClone(prev.days[dayId]),
              configurationVersion: snapshotVersion,
              lastModified: now,
            };
          });

          animal.lastModified = now;

          return {
            ...prev,
            animals: { ...prev.animals, [animalId]: animal },
            days: updatedDays,
            lastModified: now,
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
            keywords: [],
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
          // Probe-reconfiguration: point this day at a different configuration
          // snapshot version. NOTE: setting it here does NOT reconcile snapshots'
          // `appliedToDays` — use applyConfigurationForward (which the reconfig wizard
          // calls) when the stored partition must stay in sync; `reconcileAppliedToDays`
          // derives the trustworthy view from each day's version regardless.
          if (updates.configurationVersion !== undefined) {
            updated.configurationVersion = updates.configurationVersion;
          }
          // Day-level keywords (written by the Overview keywords editor through the
          // stepper). Without this branch the user's keywords are silently dropped.
          if (updates.keywords !== undefined) {
            updated.keywords = updates.keywords;
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

  const workspaceSelectors = useMemo(
    () => ({
      /**
       * Get all days for a specific animal, sorted by date
       *
       * @param {string} animalId - Animal identifier
       * @returns {Array} Array of day objects sorted by date
       */
      getAnimalDays: (animalId) => {
        const animal = workspace.animals[animalId];
        if (!animal) return [];

        return (animal.days || [])
          .map((dayId) => workspace.days[dayId])
          .filter(Boolean)
          .sort((a, b) => a.date.localeCompare(b.date));
      },
    }),
    [workspace]
  );

  const dismissLoadNotice = useCallback(() => setLoadNotice(null), []);

  // Force an immediate write (Ctrl/Cmd+S), bypassing the autosave debounce. No-op
  // when persistence is disabled. Mirrors the autosave's success/error bookkeeping.
  const saveNow = useCallback(() => {
    if (!FLAGS.localStoragePersistence) return;
    try {
      saveWorkspace(workspaceRef.current);
      setLastSaved(new Date().toISOString());
      setSaveError(null);
      setHasPendingWrite(false);
    } catch (err) {
      setSaveError(`Could not save workspace: ${err.message}`);
    }
  }, []);

  // Real persistence status (never part of `model` — must not reach YAML).
  // Memoized so the StoreContext value's identity is stable when nothing changed,
  // preserving the provider's re-render optimization.
  const persistence = useMemo(
    () => ({
      enabled: FLAGS.localStoragePersistence,
      lastSaved,
      saveError,
      hasPendingWrite,
      loadNotice,
      dismissLoadNotice,
      saveNow,
    }),
    [lastSaved, saveError, hasPendingWrite, loadNotice, dismissLoadNotice, saveNow]
  );

  return { workspace, setWorkspace, workspaceActions, workspaceSelectors, persistence };
}
