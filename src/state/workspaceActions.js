import {
  generateDayId,
  assertIsoDate,
  getCurrentTimestamp,
  getCurrentDate,
} from './workspaceUtils';
import { getAnimalDayIds, getConfigHistory } from './workspaceSelectors';
import { normalizeDevices } from '../utils/deviceNormalization';
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
 * Builds the workspace mutation actions (animal/day management) as a pure factory over the
 * store's commit primitives. Extracted verbatim from the former inline `useWorkspace` memo so
 * the action bodies — and their exact `throw` timing — are unchanged; only their home moved.
 *
 * The same-tick contract is preserved by the injected primitives, NOT by this factory:
 *   - `commitWorkspace(updater)` applies an updater while keeping `workspaceRef.current` in
 *     LOCKSTEP, so a COMPOSITE batch (a replace-import's deleteAnimal → createAnimal →
 *     createConfigurationSnapshotAndApplyForward, all in one tick) sees each prior step
 *     synchronously. Used by the actions that participate in such a batch.
 *   - `setWorkspace(updater)` is the plain React state updater (deferred under batching) for
 *     actions that don't need a same-tick read.
 *   - `workspaceRef` is the always-current committed workspace, read synchronously where an
 *     action must reserve state (e.g. the next configuration version) from authoritative state.
 *
 * @param {object} primitives
 * @param {(updater: (prev: object) => object) => void} primitives.commitWorkspace - Ref-lockstep commit.
 * @param {Function} primitives.setWorkspace - React state updater for the workspace slice.
 * @param {{ current: object }} primitives.workspaceRef - Live ref to the committed workspace.
 * @returns {object} The workspace actions object (createAnimal, updateAnimal, … updateWorkspaceSettings).
 */
export function createWorkspaceActions({ commitWorkspace, setWorkspace, workspaceRef }) {
  return {
    /**
     * Creates a new animal with shared metadata
     *
     * @param {string} animalId - Unique animal identifier
     * @param {object} subject - Subject metadata (species, sex, genotype, DOB, description)
     * @param {object} [metadata] - Optional additional metadata (devices, cameras, experimenters, optogenetics)
     * @throws {Error} If animal ID already exists
     */
    createAnimal: (animalId, subject, metadata = {}) => {
      // commitWorkspace (not setWorkspace) so that within a composite import batch (a) the
      // duplicate-id check sees the preceding deleteAnimal, and (b) this animal's v1 history is
      // visible in the ref for the LATER snapshot step's version reservation. (createAnimal itself
      // hardcodes version 1; it reserves nothing.)
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
  };
}
