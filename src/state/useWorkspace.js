import { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import {
  generateDayId,
  getCurrentTimestamp,
  getCurrentDate,
  createDefaultWorkspace,
} from './workspaceUtils';
import { FLAGS } from '../featureFlags';
import { loadWorkspace, saveWorkspace, clearWorkspace } from './persistence';
import {
  getAnimalDayIds,
  getConfigHistory,
} from './workspaceSelectors';
import {
  normalizeDevices,
  normalizeWorkspaceDevices,
} from '../utils/deviceNormalization';
import {
  applyAnimalUpdates,
  addConfigurationSnapshotToAnimal,
  applyConfigurationForwardToAnimal,
  createSnapshotAndApplyForward,
  rebuildConfigurationHistoryForAnimal,
  createDayRecord,
  applyDayUpdates,
  nextConfigurationVersion,
} from './workspaceTransitions';

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
  const initialRecoverRef = useRef(null);

  const [workspace, setWorkspace] = useState(() => {
    const fallback = createDefaultWorkspace();

    if (initialState?.workspace) return normalizeWorkspaceDevices(initialState.workspace); // tests win
    if (!FLAGS.localStoragePersistence) return fallback;

    const loaded = loadWorkspace();
    if (loaded == null) return fallback; // clean first run
    if (loaded.workspace) {
      // Structurally valid but missing required sections → restored to defaults; the
      // missing keys drive a recovery notice after mount (not a discard).
      if (loaded.recovered) initialRecoverRef.current = loaded.recovered;
      return loaded.workspace; // hydrated (possibly shape-repaired)
    }
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
    } else if (initialRecoverRef.current) {
      // Salvaged a structurally-incomplete blob: its data was kept, only the missing
      // top-level sections were restored. Name them so the recovery is never silent.
      const missing = initialRecoverRef.current.missingKeys.join(', ');
      setLoadNotice(
        `Saved workspace was missing required sections (${missing}); they were ` +
          'restored to empty so your existing data could be loaded. Please review before exporting.'
      );
      initialRecoverRef.current = null;
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
        // Clear the pending flag ONLY on a confirmed write. Leaving it set on failure
        // keeps the beforeunload guard armed so unsaved work isn't lost on navigation.
        setHasPendingWrite(false);
      } catch (err) {
        setSaveError(`Could not save workspace: ${err.message}`);
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

          // Pure transition: applies the updates and mirrors a `devices` edit into the
          // latest configuration snapshot (see workspaceTransitions.applyAnimalUpdates).
          const updated = applyAnimalUpdates(prev.animals[animalId], updates, getCurrentTimestamp());

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
       * Append a new configuration snapshot (a low-level primitive) and return the created
       * version. Prefer {@link createConfigurationSnapshotAndApplyForward} for the
       * reconfiguration flow — it appends AND pins the affected days in one transition, so no
       * version is handed across two actions.
       *
       * The version is RESERVED synchronously: it is `max(existing version) + 1`
       * ({@link nextConfigurationVersion}), passed explicitly to the append helper, and the
       * cached workspace (`workspaceRef`) is advanced optimistically so two calls in the same
       * event reserve DISTINCT versions (the return is always the version actually appended,
       * never a stale guess or a duplicate of a non-contiguous history).
       *
       * @param {string} animalId - Animal identifier
       * @param {object} config - Configuration data (date, description, devices)
       * @returns {number} The version number assigned to the created snapshot.
       * @throws {Error} If animal does not exist
       */
      addConfigurationSnapshot: (animalId, config) => {
        const now = getCurrentTimestamp();
        const current = workspaceRef.current.animals[animalId];
        // Reserve the version synchronously from the authoritative cached store.
        const createdVersion = current
          ? nextConfigurationVersion(getConfigHistory(current))
          : undefined;
        if (current) {
          // Optimistically advance the cached workspace so a second synchronous call reserves
          // the NEXT version (distinct returns; no stale guess across queued calls). The next
          // render overwrites this with the committed state. Invariant: this only REPLACES an
          // existing animal (never adds/removes a key), so it can't diverge from committed
          // state — unless an animal-REMOVING action (deleteAnimal) were composed in the same
          // synchronous tick, which no UI path does.
          workspaceRef.current = {
            ...workspaceRef.current,
            animals: {
              ...workspaceRef.current.animals,
              [animalId]: addConfigurationSnapshotToAnimal(current, config, now, createdVersion),
            },
          };
        }

        setWorkspace((prev) => {
          if (!prev.animals[animalId]) {
            throw new Error(`Animal "${animalId}" not found`);
          }
          // Append the RESERVED version explicitly so return === appended (no independent
          // re-derive between caller and updater).
          const updated = addConfigurationSnapshotToAnimal(
            prev.animals[animalId],
            config,
            now,
            createdVersion
          );
          return {
            ...prev,
            animals: { ...prev.animals, [animalId]: updated },
            lastModified: updated.lastModified,
          };
        });

        return createdVersion;
      },

      /**
       * Atomic reconfiguration: create a new configuration snapshot AND apply it forward to a
       * set of days in ONE transition. The public entry point for the reconfiguration wizard.
       * The version is derived once inside the transition and used for both the snapshot and
       * the day pins, so — unlike composing {@link addConfigurationSnapshot} with
       * {@link applyConfigurationForward} — there is no version handed across two actions to go
       * stale. The returned version (for display/navigation) is the version created.
       *
       * @param {string} animalId - Animal identifier.
       * @param {object} config - `{ date, description, devices }` for the new snapshot.
       * @param {string[]} dayIds - Day ids to move onto the new version.
       * @returns {number} The version number created.
       * @throws {Error} If animal does not exist.
       */
      createConfigurationSnapshotAndApplyForward: (animalId, config, dayIds) => {
        const now = getCurrentTimestamp();
        const current = workspaceRef.current.animals[animalId];
        // Reserve the version synchronously from the authoritative cached store.
        const createdVersion = current
          ? nextConfigurationVersion(getConfigHistory(current))
          : undefined;
        if (current) {
          // Optimistically advance the cached workspace (animal history + day pins) so a second
          // synchronous call reserves the NEXT version — two calls in one event get distinct
          // versions, and the second never appends a duplicate the first-match resolver would
          // mis-pin to. The next render overwrites this with the committed state. Same invariant
          // as addConfigurationSnapshot: it only replaces existing keys, so it can't diverge from
          // committed state unless an animal/day-removing action is composed in the same tick.
          const optimistic = createSnapshotAndApplyForward(
            current,
            workspaceRef.current.days,
            config,
            dayIds,
            now,
            createdVersion
          );
          workspaceRef.current = {
            ...workspaceRef.current,
            animals: { ...workspaceRef.current.animals, [animalId]: optimistic.animal },
            days: optimistic.days,
          };
        }

        setWorkspace((prev) => {
          if (!prev.animals[animalId]) {
            throw new Error(`Animal "${animalId}" not found`);
          }
          const { animal, days } = createSnapshotAndApplyForward(
            prev.animals[animalId],
            prev.days,
            config,
            dayIds,
            now,
            createdVersion
          );
          return {
            ...prev,
            animals: { ...prev.animals, [animalId]: animal },
            days,
            lastModified: now,
          };
        });

        return createdVersion;
      },

      /**
       * Applies an EXISTING configuration snapshot forward to a set of days: points each
       * listed day at `snapshotVersion` and keeps each snapshot's `appliedToDays` a
       * partition (a day appears in at most one snapshot's list). A standalone primitive for
       * re-pinning days onto an already-created version. The reconfiguration wizard does NOT
       * use this — it creates and applies in one transition via
       * {@link createConfigurationSnapshotAndApplyForward} (no version handed across actions).
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

          const now = getCurrentTimestamp();
          // Pure transition: moves the days onto the version and keeps appliedToDays a
          // clean partition (see workspaceTransitions.applyConfigurationForwardToAnimal).
          // Throws if the snapshot version does not exist (same timing as before).
          const { animal, days } = applyConfigurationForwardToAnimal(
            prev.animals[animalId],
            prev.days,
            snapshotVersion,
            dayIds,
            now
          );

          return {
            ...prev,
            animals: { ...prev.animals, [animalId]: animal },
            days,
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

          const now = getCurrentTimestamp();
          // Pure transition: rebuilds history to a single v1 snapshot from current devices
          // (see workspaceTransitions.rebuildConfigurationHistoryForAnimal).
          const updated = rebuildConfigurationHistoryForAnimal(
            prev.animals[animalId],
            now,
            getCurrentDate()
          );

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

          // Pure transition: builds the day pinned to the latest configuration version,
          // technical seeded from the animal defaults (see workspaceTransitions.createDayRecord).
          const day = createDayRecord(animal, animalId, dayId, date, session, now);

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

          // Pure transition: applies the updates, guarding a malformed nested session
          // (see workspaceTransitions.applyDayUpdates).
          const updated = applyDayUpdates(prev.days[dayId], updates, getCurrentTimestamp());

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
       * Removes a DANGLING day reference: drops `dayId` from the animal's `days` array and
       * deletes any corrupt leftover `days[dayId]` record. Unlike {@link deleteDay} (which
       * throws on a missing record and assumes a well-formed day with an `animalId`), this is
       * the repair for a reference that resolves to a MISSING or non-record day — the kind the
       * ValidationSummary surfaces as an "Error — missing day record" row. The owning animal
       * id is passed explicitly (a corrupt record has no `animalId` to read it from). No-op for
       * an unknown animal (the reference's owner is gone — nothing to repair).
       *
       * @param {string} animalId - The animal whose `days` array holds the dangling reference.
       * @param {string} dayId - The dangling day id to remove.
       */
      removeDayReference: (animalId, dayId) => {
        setWorkspace((prev) => {
          const animal = prev.animals[animalId];
          if (!animal) return prev;

          const updatedAnimal = {
            ...animal,
            days: getAnimalDayIds(animal).filter((id) => id !== dayId),
          };
          // Guard the days map: a corrupt non-record `days` (the whole-map corruption this
          // repair is also reachable from) must normalize to `{}`, not be spread into a
          // char-indexed object. There is no valid day record inside a non-record map to lose.
          const daysIsRecord =
            prev.days !== null && typeof prev.days === 'object' && !Array.isArray(prev.days);
          const updatedDays = daysIsRecord ? { ...prev.days } : {};
          delete updatedDays[dayId];

          return {
            ...prev,
            animals: { ...prev.animals, [animalId]: updatedAnimal },
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
