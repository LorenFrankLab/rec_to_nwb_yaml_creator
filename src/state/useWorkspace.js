import { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import {
  generateDayId,
  assertIsoDate,
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
  createSnapshotAndApplyForward,
  rebuildConfigurationHistoryForAnimal,
  createDayRecord,
  applyDayUpdates,
  nextConfigurationVersion,
  sortDayIdsByDate,
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

  /**
   * Apply a workspace updater while keeping `workspaceRef.current` in LOCKSTEP with the change.
   *
   * A single action can read the ref straight from the last render, but a COMPOSITE batch of
   * actions in one tick — e.g. a replace-import's `deleteAnimal` → `createAnimal` →
   * `createConfigurationSnapshotAndApplyForward`, all before React commits — needs each step to see
   * the prior step's result synchronously. Without this, a later step reserves state (like the next
   * configuration version) from the STALE pre-batch animal, which can duplicate version 1 and pin
   * days to the wrong hardware config.
   *
   * The updater is run once here against the ref and again inside `setWorkspace` (React may also
   * re-invoke it under batching/StrictMode), so it MUST be pure for value fields — a captured
   * timestamp differs by a tick between the two runs, but only the React-committed copy persists
   * (the ref is overwritten on the next render) and the version reservation reads
   * `configurationHistory`, not timestamps, so that difference is inert.
   *
   * @param {(prev: object) => object} updater - Workspace transform.
   */
  const commitWorkspace = (updater) => {
    workspaceRef.current = updater(workspaceRef.current);
    setWorkspace(updater);
  };

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
    let retryTimer = null;
    // One bounded automatic retry after a transient failure, so recovery doesn't depend solely on
    // the user noticing the SaveIndicator (a later edit, or Ctrl/Cmd+S, also re-attempts). Bounded
    // by `retriesLeft` so a persistent failure (e.g. quota) can't become a save storm; both timers
    // are cleared on cleanup, and a workspace change re-runs the effect from scratch.
    const attempt = (retriesLeft) => {
      try {
        saveWorkspace(workspace);
        setLastSaved(new Date().toISOString());
        setSaveError(null);
        // Clear the pending flag ONLY on a confirmed write. Leaving it set on failure
        // keeps the beforeunload guard armed so unsaved work isn't lost on navigation.
        setHasPendingWrite(false);
      } catch (err) {
        setSaveError(`Could not save workspace: ${err.message}`);
        if (retriesLeft > 0) {
          retryTimer = setTimeout(() => attempt(retriesLeft - 1), 2000);
        }
      }
    };
    const timer = setTimeout(() => attempt(1), 500);

    return () => {
      clearTimeout(timer);
      if (retryTimer) clearTimeout(retryTimer);
    };
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
        // commitWorkspace (not setWorkspace) so a composite import batch reserves the next config
        // version from the freshly-created animal, not the stale pre-delete one.
        commitWorkspace((prev) => {
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
        // commitWorkspace (not setWorkspace) so a later step in the SAME tick (a replace-import's
        // create + snapshot) sees the deletion synchronously and can't reserve a config version
        // from the about-to-be-deleted animal.
        commitWorkspace((prev) => {
          if (!prev.animals[animalId]) {
            throw new Error(`Animal "${animalId}" not found`);
          }

          const animal = prev.animals[animalId];
          const updatedAnimals = { ...prev.animals };
          const updatedDays = { ...prev.days };

          // Delete only the day records that ACTUALLY BELONG to this animal. A wrong-owner index
          // entry (a record whose `animalId` names a different animal, accidentally listed here)
          // must NOT be deleted — that would destroy another animal's real recording day. A record
          // with no `animalId` is treated as this animal's (the index is the authority).
          getAnimalDayIds(animal).forEach((dayId) => {
            const record = updatedDays[dayId];
            const isRecordDay =
              record !== null && typeof record === 'object' && !Array.isArray(record);
            if (!isRecordDay || record.animalId == null || record.animalId === animalId) {
              delete updatedDays[dayId];
            }
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
       * Atomic reconfiguration: create a new configuration snapshot AND apply it forward to a
       * set of days in ONE transition. The single public entry point for reconfiguration
       * (the wizard's path). The version is derived once inside the transition and used for
       * both the snapshot and the day pins, so there is no version handed across two actions
       * to go stale. The returned version (for display/navigation) is the version created.
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
          // mis-pin to. The next render overwrites this with the committed state. Invariant: this
          // only replaces existing keys (never adds/removes one), so it can't diverge from
          // committed state unless an animal/day-removing action is composed in the same tick.
          const optimistic = createSnapshotAndApplyForward(
            current,
            workspaceRef.current.days,
            config,
            dayIds,
            now,
            createdVersion,
            animalId // the store KEY drives the day-ownership guard, not the record's id field
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
            createdVersion,
            animalId // the store KEY drives the day-ownership guard, not the record's id field
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
       * @param {object} [options] - Creation options.
       * @param {string} [options.carryForwardFromDayId] - If set, seed the new day's day-owned
       *   content (tasks, behavioral_events, keywords, technical, session.experiment_description /
       *   weight) from this prior day. An unknown id resolves to a blank day (no throw).
       * @throws {Error} If animal does not exist or day already exists
       */
      createDay: (animalId, date, session, options = {}) => {
        setWorkspace((prev) => {
          if (!prev.animals[animalId]) {
            throw new Error(`Animal "${animalId}" not found`);
          }

          // Reject a non-ISO date before it can corrupt the lexicographically-sorted index.
          assertIsoDate(date);

          const dayId = generateDayId(animalId, date);

          if (prev.days[dayId]) {
            throw new Error(`Day "${dayId}" already exists`);
          }

          const animal = prev.animals[animalId];
          const now = getCurrentTimestamp();

          // Resolve the optional carry-forward source. An unknown id → null → blank day.
          const carryFrom = options.carryForwardFromDayId
            ? prev.days[options.carryForwardFromDayId] || null
            : null;

          // Pure transition: builds the day pinned to the latest configuration version,
          // technical seeded from the animal defaults (see workspaceTransitions.createDayRecord).
          const day = createDayRecord(animal, animalId, dayId, date, session, now, carryFrom);

          // Build the next days map first, then sort the index by date so the STORED
          // `animal.days` is canonically date-ordered (a day created out of chronological
          // order must not leave the index unordered). Sort-on-read selectors are kept as
          // redundant defense-in-depth.
          const nextDays = { ...prev.days, [dayId]: day };
          const updatedAnimal = {
            ...animal,
            days: sortDayIdsByDate([...getAnimalDayIds(animal), dayId], nextDays),
          };

          return {
            ...prev,
            animals: {
              ...prev.animals,
              [animalId]: updatedAnimal,
            },
            days: nextDays,
            lastModified: now,
          };
        });
      },

      /**
       * Duplicates an existing recording day to a new date ("same protocol, next session").
       *
       * This is NOT a byte-exact clone of the source day. CARRIED (deep-cloned via
       * {@link createDayRecord}'s carry path, plus the explicit config/override copy below):
       * tasks, behavioral_events, keywords, technical, session.experiment_description /
       * session.weight, the SOURCE's `configurationVersion` (NOT the animal's latest), and the
       * source's `deviceOverrides` (bad channels) — the config pin + overrides are always safe
       * because a duplicate is, by construction, the same configuration as its source.
       * NOT carried: session_id / session_description are date-derived from the new date
       * (session_description defaults to the source's); and `associated_files`,
       * `associated_video_files`, `fs_gui_yamls`, and `cameras_used` start empty/unset (they are
       * session-specific and must be re-entered for the new day).
       *
       * @param {string} sourceDayId - The day to clone.
       * @param {string} newDate - Date in YYYY-MM-DD for the new day.
       * @throws {Error} If the source day or its animal does not exist, or the target day already exists.
       */
      duplicateDay: (sourceDayId, newDate) => {
        setWorkspace((prev) => {
          const source = prev.days[sourceDayId];
          if (!source) {
            throw new Error(`Day "${sourceDayId}" not found`);
          }

          const animalId = source.animalId;
          const animal = prev.animals[animalId];
          if (!animal) {
            throw new Error(`Animal "${animalId}" not found`);
          }

          // Reject a non-ISO date before it can corrupt the lexicographically-sorted index.
          assertIsoDate(newDate);

          const dayId = generateDayId(animalId, newDate);
          if (prev.days[dayId]) {
            throw new Error(`Day "${dayId}" already exists`);
          }

          const now = getCurrentTimestamp();

          // Carry day-owned content from the source (deep-cloned by createDayRecord), with a
          // date-derived session id and the source's session description.
          const built = createDayRecord(
            animal,
            animalId,
            dayId,
            newDate,
            {
              session_id: `${animalId}_${newDate.replace(/-/g, '')}`,
              session_description: source.session?.session_description ?? '',
            },
            now,
            source
          );
          // A duplicate is the SAME configuration version as its source by construction, so we
          // override createDayRecord's latest-pin with the source's version and carry the
          // source's bad-channel overrides directly (no version guard needed).
          const day = {
            ...built,
            configurationVersion: source.configurationVersion,
            deviceOverrides: source.deviceOverrides
              ? structuredClone(source.deviceOverrides)
              : built.deviceOverrides,
          };

          // Sort the index by date on write (see createDay): duplicating to an EARLIER date
          // must not leave the STORED `animal.days` out of chronological order.
          const nextDays = { ...prev.days, [dayId]: day };
          const updatedAnimal = {
            ...animal,
            days: sortDayIdsByDate([...getAnimalDayIds(animal), dayId], nextDays),
          };

          return {
            ...prev,
            animals: {
              ...prev.animals,
              [animalId]: updatedAnimal,
            },
            days: nextDays,
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
       * Deletes a recording day and removes its id from the owning animal's index.
       *
       * The owning animal is resolved robustly rather than trusting `record.animalId`: a
       * corrupt/partial import can leave an OK day (the index is the authority) with no `animalId`,
       * and `prev.animals[undefined]` would then write a junk `animals[undefined]` entry AND leave
       * a dangling reference in the real owner's index. Prefer the caller-supplied `ownerAnimalId`,
       * then the record's `animalId`, then a scan of which animal indexes this day.
       *
       * @param {string} dayId - Day identifier.
       * @param {string} [ownerAnimalId] - The owning animal id when the caller knows it (the UI
       *   deletes from a selected animal). Used in preference to the record's `animalId`.
       * @throws {Error} If day does not exist.
       */
      deleteDay: (dayId, ownerAnimalId) => {
        setWorkspace((prev) => {
          if (!prev.days[dayId]) {
            throw new Error(`Day "${dayId}" not found`);
          }

          const record = prev.days[dayId];
          // Resolve the owner to a REAL animal key; never index by undefined/null.
          const ownerKey =
            ownerAnimalId != null && prev.animals[ownerAnimalId]
              ? ownerAnimalId
              : record.animalId != null && prev.animals[record.animalId]
                ? record.animalId
                : Object.keys(prev.animals).find((aid) =>
                    getAnimalDayIds(prev.animals[aid]).includes(dayId)
                  );

          const updatedDays = { ...prev.days };
          delete updatedDays[dayId];

          const updatedAnimals = { ...prev.animals };
          if (ownerKey != null && updatedAnimals[ownerKey]) {
            updatedAnimals[ownerKey] = {
              ...updatedAnimals[ownerKey],
              days: getAnimalDayIds(updatedAnimals[ownerKey]).filter((id) => id !== dayId),
            };
          }

          return {
            ...prev,
            animals: updatedAnimals,
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
       * Re-link an ORPHANED day record: add `dayId` back to its owning animal's `days` index.
       * The repair for a record that exists in `workspace.days` but is not listed by its animal
       * (the "not in day list" rows the ValidationSummary surfaces, e.g. after a corrupt/missing
       * index). Deduped; tolerates a corrupt (non-array) index via `getAnimalDayIds`. No-op for an
       * unknown animal, a missing day record, or an already-linked id.
       *
       * @param {string} animalId - The owning animal's id.
       * @param {string} dayId - The orphaned day record's id to re-link.
       */
      relinkDayReference: (animalId, dayId) => {
        setWorkspace((prev) => {
          const animal = prev.animals[animalId];
          if (!animal) return prev;
          const daysIsRecord =
            prev.days !== null && typeof prev.days === 'object' && !Array.isArray(prev.days);
          if (!daysIsRecord) return prev;
          // The id must resolve to a real day RECORD that actually belongs to this animal —
          // never re-link a non-record leftover or a record owned by a different animal.
          const record = prev.days[dayId];
          const isRecordDay =
            record !== null && typeof record === 'object' && !Array.isArray(record);
          if (!isRecordDay || record.animalId !== animalId) return prev;
          const current = getAnimalDayIds(animal);
          if (current.includes(dayId)) return prev;
          return {
            ...prev,
            animals: {
              ...prev.animals,
              [animalId]: { ...animal, days: [...current, dayId] },
            },
            lastModified: getCurrentTimestamp(),
          };
        });
      },

      /**
       * Unlink a day reference from an animal's index WITHOUT deleting the day record. The
       * repair for a `wrong_owner` reference (an animal indexing a record that belongs to a
       * DIFFERENT animal): dropping the reference must NOT destroy the record (unlike
       * {@link removeDayReference}, which deletes dangling/corrupt leftovers) — the record is
       * valid and belongs to someone else, so it survives and resurfaces under its real owner as
       * `recovered_unlinked`, to be re-linked there. No-op for an unknown animal or absent ref.
       *
       * @param {string} animalId - The animal to unlink the reference from.
       * @param {string} dayId - The day id to unlink (the record is preserved).
       */
      unlinkDayReference: (animalId, dayId) => {
        setWorkspace((prev) => {
          const animal = prev.animals[animalId];
          if (!animal) return prev;
          const current = getAnimalDayIds(animal);
          if (!current.includes(dayId)) return prev;
          // Only unlink a genuine WRONG-OWNER reference: the record must exist AND explicitly
          // belong to a DIFFERENT animal. This guards the public action so an accidental/mistaken
          // call can't strand a valid day (one this animal owns, or with no declared owner) into
          // recovered-unlinked state — the repair must only ever drop a misfiled reference.
          const record = prev.days?.[dayId];
          const isRecordDay =
            record !== null && typeof record === 'object' && !Array.isArray(record);
          if (!isRecordDay || record.animalId == null || record.animalId === animalId) {
            return prev;
          }
          return {
            ...prev,
            animals: {
              ...prev.animals,
              [animalId]: { ...animal, days: current.filter((id) => id !== dayId) },
            },
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

        // Tolerate corrupt persisted state AND enforce ownership: keep only resolvable day
        // RECORDS that actually belong to this animal — a record whose `animalId` names a
        // DIFFERENT animal (a wrong-owner index entry) must NOT be returned, or reconfiguration
        // could move another animal's day. A record with no `animalId` is kept (the index is the
        // authority). Order by a string-coerced date so a numeric/missing `date` can't throw.
        const orderKey = (value) => (typeof value === 'string' ? value : String(value ?? ''));
        return getAnimalDayIds(animal)
          .map((dayId) => workspace.days[dayId])
          .filter(
            (day) =>
              day !== null &&
              typeof day === 'object' &&
              !Array.isArray(day) &&
              (day.animalId == null || day.animalId === animalId)
          )
          .sort((a, b) => orderKey(a.date).localeCompare(orderKey(b.date)));
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
