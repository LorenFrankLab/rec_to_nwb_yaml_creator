import { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import {
  generateDayId,
  formatExperimentDate,
  getCurrentTimestamp,
  getCurrentDate,
} from './workspaceUtils';
import { FLAGS } from '../featureFlags';
import { loadWorkspace, saveWorkspace, clearWorkspace } from './persistence';
import {
  getAnimalDayIds,
  getAnimalDevices,
  getConfigHistory,
} from './workspaceSelectors';
import {
  normalizeDeviceOverrides,
  normalizeDevices,
  normalizeProbeConfigDevices,
  normalizeWorkspaceDevices,
} from '../utils/deviceNormalization';

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

    if (initialState?.workspace) return normalizeWorkspaceDevices(initialState.workspace); // tests win
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

          const devices = normalizeDevices(metadata.devices);
          const animal = {
            id: animalId,
            subject: {
              subject_id: animalId,
              // Schema-required fallbacks for callers that omit them; the creation
              // form collects a real weight and a description (or derives one).
              weight: 100,
              description: 'Subject',
              ...subject,
            },
            devices,
            cameras: metadata.cameras || [],
            experimenters,
            technicalDefaults: metadata.technicalDefaults || {
              raw_data_to_volts: 0.195,
              times_period_multiplier: 1.5,
            },
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
                  electrode_groups: structuredClone(devices.electrode_groups),
                  ntrode_electrode_group_channel_map: structuredClone(
                    devices.ntrode_electrode_group_channel_map
                  ),
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
            updated.devices = normalizeDevices({ ...getAnimalDevices(updated), ...updates.devices });
            // `animal.devices` is the editor's mirror of the LATEST configuration
            // snapshot, which is the authoritative source the export resolves. Write
            // the edit into that snapshot too, so probes configured after animal
            // creation actually reach `resolveDayConfig` (otherwise the day exports
            // empty electrode_groups). Reconfiguration forks a new latest version
            // BEFORE editing, so this only ever rewrites the current latest — never a
            // historical, frozen snapshot.
            const history = getConfigHistory(updated);
            if (history.length > 0) {
              const latest = history[history.length - 1];
              latest.devices = {
                ...latest.devices,
                electrode_groups: structuredClone(updated.devices.electrode_groups),
                ntrode_electrode_group_channel_map: structuredClone(
                  updated.devices.ntrode_electrode_group_channel_map
                ),
              };
            }
          }
          if (updates.cameras) {
            updated.cameras = updates.cameras;
          }
          // Data-acq hardware is an animal-level device. The export reads
          // `animal.devices.data_acq_device`, so route the update there (a write to a
          // top-level `data_acq_device` would never reach the export).
          if (updates.data_acq_device) {
            updated.devices = normalizeDevices({
              ...getAnimalDevices(updated),
              data_acq_device: updates.data_acq_device,
            });
          }
          // Animal-level technical DEFAULTS only (seeded into each day's `technical` at
          // createDay and overridable per day). These are never exported directly — the
          // exported values live on `day.technical` — so there is no `animal.technical`.
          if (updates.technicalDefaults) {
            updated.technicalDefaults = { ...updated.technicalDefaults, ...updates.technicalDefaults };
          }
          // Animal-level behavioral events are an editable reference; the exported
          // source is the day's `behavioral_events`. Persist them so the editor and the
          // model agree (previously this write was silently dropped).
          if (updates.behavioral_events) {
            updated.behavioral_events = updates.behavioral_events;
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
          getAnimalDayIds(animal).forEach((dayId) => {
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
        const currentHistory = getConfigHistory(current);
        const createdVersion = current ? currentHistory.length + 1 : undefined;

        setWorkspace((prev) => {
          if (!prev.animals[animalId]) {
            throw new Error(`Animal "${animalId}" not found`);
          }

          const animal = prev.animals[animalId];
          const updated = structuredClone(animal);
          const history = getConfigHistory(updated);

          const newVersion = {
            version: history.length + 1,
            date: config.date,
            description: config.description,
            devices: normalizeProbeConfigDevices(config.devices),
            appliedToDays: [],
          };

          updated.configurationHistory = [...history, newVersion];
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
          const history = getConfigHistory(animal);
          const target = history.find((s) => s.version === snapshotVersion);
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
          history.forEach((snapshot) => {
            snapshot.appliedToDays = (snapshot.appliedToDays || []).filter((id) => !moving.has(id));
          });
          // (2) Add them to the target snapshot's list (dedup, stable order).
          target.appliedToDays = [
            ...target.appliedToDays.filter((id) => !moving.has(id)),
            ...validDayIds,
          ];
          animal.configurationHistory = history;

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
       * Rebuilds a corrupt or missing `configurationHistory` from scratch: replaces it
       * with a single version-1 snapshot derived from the animal's CURRENT `devices`
       * (the editor's mirror of the latest configuration). This is the executable repair
       * for a raw-shape `malformed_animal_collection` on `configurationHistory` — a
       * restored/imported non-array history that shadows valid data and blocks export.
       *
       * Tolerates any start shape (non-array, missing); `getAnimalDevices` / the
       * `structuredClone` of the (possibly-empty) electrode arrays never throw. No-op for
       * an unknown animal (the repair surface is gone — nothing to fix).
       *
       * Scope: this clears the raw-shape `configurationHistory` corruption (the issue the
       * repair command carries). It does NOT re-pin days that referenced a now-gone version
       * > 1 — those still fail closed in `resolveDayConfig` until re-applied — so it is one
       * step toward export-readiness, not a guarantee of it.
       *
       * @param {string} animalId - Animal identifier.
       */
      rebuildConfigurationHistory: (animalId) => {
        setWorkspace((prev) => {
          if (!prev.animals[animalId]) return prev;

          const animal = prev.animals[animalId];
          const updated = structuredClone(animal);
          const devices = getAnimalDevices(updated);
          const now = getCurrentTimestamp();

          updated.configurationHistory = [
            {
              version: 1,
              date: getCurrentDate(),
              description: 'Rebuilt configuration',
              devices: {
                electrode_groups: structuredClone(
                  Array.isArray(devices.electrode_groups) ? devices.electrode_groups : []
                ),
                ntrode_electrode_group_channel_map: structuredClone(
                  Array.isArray(devices.ntrode_electrode_group_channel_map)
                    ? devices.ntrode_electrode_group_channel_map
                    : []
                ),
              },
              appliedToDays: [],
            },
          ];
          updated.lastModified = now;

          return {
            ...prev,
            animals: { ...prev.animals, [animalId]: updated },
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
              // Seeded from the animal's technical DEFAULTS (the rig is constant per
              // animal but occasionally varies per day, so these are overridable on the
              // day). Falls back to the standard values when no defaults are set.
              times_period_multiplier: animal.technicalDefaults?.times_period_multiplier ?? 1.5,
              raw_data_to_volts: animal.technicalDefaults?.raw_data_to_volts ?? 0.195,
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
            configurationVersion: getConfigHistory(animal).length, // Latest version
          };

          const updatedAnimal = { ...animal, days: [...getAnimalDayIds(animal), dayId] };

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
          // FsGUI protocol files are a day-owned collection the export merge reads
          // (workspaceUtils `mergeDayMetadata`). Without this branch a write — including
          // the raw-shape `resetDayCollection` repair — would be silently dropped, so the
          // corruption it is meant to clear would persist.
          if (updates.fs_gui_yamls !== undefined) {
            updated.fs_gui_yamls = updates.fs_gui_yamls;
          }
          if (updates.technical) {
            updated.technical = { ...updated.technical, ...updates.technical };
          }
          if (updates.deviceOverrides) {
            updated.deviceOverrides = normalizeDeviceOverrides(updates.deviceOverrides);
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
            days: getAnimalDayIds(animal).filter((id) => id !== dayId),
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

        return getAnimalDayIds(animal)
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
