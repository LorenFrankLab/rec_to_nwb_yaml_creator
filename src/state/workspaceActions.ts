import { RIG_FALLBACK } from '../domain/rigConstants';
import {
  generateDayId,
  assertIsoDate,
  getCurrentTimestamp,
  getCurrentDate,
} from './workspaceUtils';
import { getAnimalDayIds, getConfigHistory, getAnimalNtrodeMaps } from './workspaceSelectors';
import { normalizeDevices } from '../utils/deviceNormalization';
import { nearestEarlierDayId } from '../domain/dayCarryPolicy';
import { subjectIdCollision } from '../domain/animalCreation';
import {
  applyAnimalUpdates,
  createSnapshotAndApplyForward,
  rebuildConfigurationHistoryForAnimal,
  createDayRecord,
  reseedDayFromSource,
  applyDayUpdates,
  nextConfigurationVersion,
  sortDayIdsByDate,
  withoutUnknownFacts,
} from './workspaceTransitions';
import type { AnimalUpdates, ConfigSnapshotInput, DayUpdates } from './workspaceTransitions';
import type {
  Workspace,
  NtrodeMap,
  SubjectMetadata,
  ExperimenterInfo,
  Camera,
  TechnicalDefaults,
  OptogeneticsConfig,
  SessionMetadata,
  WorkspaceSettings,
} from './workspaceTypes';

/**
 * The store commit primitives injected into {@link createWorkspaceActions}. `commitWorkspace` is
 * the ONLY mutation path (ownership is enforced there); `workspaceRef` is the live committed
 * workspace, read synchronously.
 */
export interface WorkspaceActionPrimitives {
  /** Ref-lockstep commit (keeps `workspaceRef.current` in step for same-tick composite batches). */
  commitWorkspace: (updater: (prev: Workspace) => Workspace) => void;
  /** Live ref to the always-current committed workspace. */
  workspaceRef: { current: Workspace };
}

/** Optional extra metadata accepted by `createAnimal` (each field defaults when omitted). */
export interface CreateAnimalMetadata {
  /** Experimenter info; defaults to the workspace settings' defaults when omitted. */
  experimenters?: ExperimenterInfo;
  /** Raw device payload (normalized by `normalizeDevices`). */
  devices?: Record<string, unknown>;
  /** Camera catalog for the new animal. */
  cameras?: Camera[];
  /** Animal-level technical defaults seeded into each new day. */
  technicalDefaults?: TechnicalDefaults;
  /** Optogenetics setup (`null`/absent = none). */
  optogenetics?: OptogeneticsConfig | null;
  /** Animal-level default experiment description for new days. */
  experiment_description?: string;
}

/** Options for `createDay`. */
export interface CreateDayOptions {
  /**
   * Explicit carry-forward source: seed the new day's stable day-owned content (tasks, DIO events,
   * keywords, technical, experiment description, team, opto snapshot, rig choice; NOT the weight,
   * files, or review state — see `createDayRecord`) from this prior day. `'auto'` uses the nearest
   * EARLIER day (never a later one); omitted / `null` starts blank (the import path creates days
   * without options and then writes each file's own facts). An unknown id resolves to blank.
   */
  carryForwardFromDayId?: string | null | 'auto';
}

/**
 * Builds the workspace mutation actions (animal/day management) as a pure factory over the
 * store's commit primitives. Extracted from the former inline `useWorkspace` memo; the action
 * bodies are unchanged, only their home moved.
 *
 * The same-tick contract is preserved by the injected primitives, NOT by this factory:
 *   - `commitWorkspace(updater)` applies an updater while keeping `workspaceRef.current` in
 *     LOCKSTEP, so a COMPOSITE batch (a replace-import's deleteAnimal → createAnimal →
 *     createConfigurationSnapshotAndApplyForward → updateDay, all in one tick) sees each prior
 *     step synchronously, and so a field draft flushed right before an explicit save is in the
 *     ref when the synchronous write runs. EVERY record-mutating action uses it, and it refuses
 *     in a read-only tab (`ReadOnlyWorkspaceError`).
 *   - `workspaceRef` is the always-current committed workspace, read synchronously where an
 *     action must reserve state (e.g. the next configuration version) from authoritative state.
 *
 * @param primitives - The store commit primitives ({@link WorkspaceActionPrimitives}).
 * @param primitives.commitWorkspace - Ref-lockstep commit.
 * @param primitives.workspaceRef - Live ref to the committed workspace.
 * @returns The workspace actions object (createAnimal, updateAnimal, … updateWorkspaceSettings).
 */
export function createWorkspaceActions({
  commitWorkspace,
  workspaceRef,
}: WorkspaceActionPrimitives) {
  return {
    /**
     * Creates a new animal with shared metadata
     *
     * @param animalId - Unique animal identifier
     * @param subject - Subject metadata (species, sex, genotype, DOB, description)
     * @param metadata - Optional additional metadata (devices, cameras, experimenters, optogenetics)
     * @throws If animal ID already exists
     */
    createAnimal: (
      animalId: string,
      subject: Partial<SubjectMetadata>,
      metadata: CreateAnimalMetadata = {}
    ) => {
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
          // `withoutUnknownFacts` so a caller that spells an unknown fact as an explicit
          // `undefined` (the shared `buildAnimalFromForm` glue does) yields a record with NO such
          // key — the same "undefined means absent" rule `applyAnimalUpdates` applies to a later
          // edit, and the shape JSON persistence round-trips.
          subject: withoutUnknownFacts({
            subject_id: animalId,
            // Schema-required fallback for callers that omit it; the creation form collects a real
            // description (or derives one from genotype + species).
            // NOTE: weight is deliberately NOT seeded. It is a MEASUREMENT — a fabricated baseline
            // would be a number nobody weighed. An omitted weight stays absent; the exported weight
            // is the recording day's own `session.weight`.
            description: 'Subject',
            ...subject,
            // The caller may pass a partial subject; the store seeds valid-enough defaults and
            // validation gates true completeness, so trust the shape here.
          }) as SubjectMetadata,
          devices,
          cameras: metadata.cameras || [],
          experimenters,
          experiment_description: metadata.experiment_description || '',
          technicalDefaults: metadata.technicalDefaults || {
            raw_data_to_volts: RIG_FALLBACK.raw_data_to_volts,
            times_period_multiplier: 1.5,
          },
          optogenetics: metadata.optogenetics,
          days: [],
          created: now,
          lastModified: now,
          configurationHistory: [
            {
              version: 1,
              // Stamped with the ENTRY date: nobody has told us when this setup became effective,
              // so a day before today must ask for confirmation rather than assume (the setup card
              // lets the scientist record the real effective date).
              date: today,
              effectiveDateKnown: false,
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

    /** Correct mapping IDs and preserve failed-channel references in the same transaction. */
    correctChannelMaps: (animalId: string, maps: NtrodeMap[]) => {
      commitWorkspace((prev) => {
        const animal = prev.animals[animalId];
        if (!animal) throw new Error(`Animal "${animalId}" not found`);
        const original = getAnimalNtrodeMaps(animal);
        if (original.length !== maps.length || new Set(maps.map((map) => map.ntrode_id)).size !== maps.length) {
          throw new Error('A mapping correction must preserve rows and use unique ntrode IDs.');
        }
        const renames = new Map(original.map((map, index) => [String(map.ntrode_id), String(maps[index].ntrode_id)]));
        const version = getConfigHistory(animal).slice(-1)[0]?.version;
        const now = getCurrentTimestamp();
        const updated = applyAnimalUpdates(animal, { devices: { ntrode_electrode_group_channel_map: maps } }, now);
        const days = { ...prev.days };
        Object.entries(days).forEach(([id, day]) => {
          const overrides = day.deviceOverrides;
          if (day.animalId !== animalId || day.configurationVersion !== version || !overrides?.bad_channels
            || overrides.ntrode_electrode_group_channel_map !== undefined) return;
          const duplicateSource = original.find((map, index) => original.findIndex((other) => other.ntrode_id === map.ntrode_id) !== index);
          if (duplicateSource && Object.prototype.hasOwnProperty.call(overrides.bad_channels, String(duplicateSource.ntrode_id))) {
            throw new Error('Duplicate original ntrode IDs make failed-channel ownership ambiguous. Correct the affected recording’s failed-channel references before renaming these ntrodes.');
          }
          // Rename by original row identity, atomically (including swapped IDs). Probe-local failed
          // electrode indices stay attached to the same probe. Independent day geometry is untouched.
          const badChannels = Object.fromEntries(Object.entries(overrides.bad_channels).map(([key, value]) => [renames.get(key) ?? key, value]));
          if (Object.keys(badChannels).length !== Object.keys(overrides.bad_channels).length) {
            throw new Error('Resolve stale failed-channel references before renaming ntrodes.');
          }
          days[id] = { ...day, deviceOverrides: { ...overrides, bad_channels: badChannels }, lastModified: now };
        });
        return { ...prev, animals: { ...prev.animals, [animalId]: updated }, days, lastModified: now };
      });
    },

    /**
     * Updates animal metadata
     *
     * @param animalId - Animal identifier
     * @param updates - Partial updates to apply
     * @throws If animal does not exist
     */
    updateAnimal: (animalId: string, updates: AnimalUpdates) => {
      // commitWorkspace (ref-lockstep) so a draft flushed right before an explicit save is visible to
      // the synchronous write that follows (persistence's saveNow reads `workspaceRef.current`).
      commitWorkspace((prev) => {
        if (!prev.animals[animalId]) {
          throw new Error(`Animal "${animalId}" not found`);
        }
        // The subject id is the scientific identity AND the export filename token: two animals
        // sharing one would produce identical `{date}_{subject}_metadata.yml` files and merge
        // downstream. Refused at the mutation boundary (the profile editor also says so inline).
        const nextSubjectId = updates.subject?.subject_id;
        if (typeof nextSubjectId === 'string') {
          const taken = subjectIdCollision(nextSubjectId, prev.animals, animalId);
          if (taken) {
            throw new Error(`Subject ID "${nextSubjectId}" is already used by animal "${taken}"`);
          }
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
     * @param animalId - Animal identifier
     * @throws If animal does not exist
     */
    deleteAnimal: (animalId: string) => {
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
     * @param animalId - Animal identifier.
     * @param config - `{ date, description, devices }` for the new snapshot.
     * @param dayIds - Day ids to move onto the new version.
     * @returns The version number created.
     * @throws If animal does not exist.
     */
    createConfigurationSnapshotAndApplyForward: (
      animalId: string,
      config: ConfigSnapshotInput,
      dayIds: string[]
    ) => {
      const now = getCurrentTimestamp();
      const current = workspaceRef.current.animals[animalId];
      // Reserve the version synchronously from the authoritative cached store; `commitWorkspace`
      // advances the ref in lockstep, so a second synchronous call reserves the NEXT version (two
      // calls in one event get distinct versions, and the second never appends a duplicate the
      // first-match resolver would mis-pin to).
      const createdVersion = current
        ? nextConfigurationVersion(getConfigHistory(current))
        : undefined;

      commitWorkspace((prev) => {
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
     * @param animalId - Animal identifier.
     */
    rebuildConfigurationHistory: (animalId: string) => {
      commitWorkspace((prev) => {
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
     * @param animalId - Parent animal identifier
     * @param date - Date in YYYY-MM-DD format
     * @param session - Session metadata (session_id, session_description, etc.)
     * @param options - Creation options. `carryForwardFromDayId`, if set, seeds the new day's
     *   day-owned content (tasks, behavioral_events, keywords, technical,
     *   session.experiment_description / weight) from this prior day. An unknown id resolves to a
     *   blank day (no throw).
     * @throws If animal does not exist or day already exists
     */
    createDay: (
      animalId: string,
      date: string,
      session: SessionMetadata,
      options: CreateDayOptions = {}
    ) => {
      commitWorkspace((prev) => {
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

        // Resolve the carry-forward source: an explicit day id, `null` for a blank start, or the
        // nearest EARLIER day (never the latest day overall — a backfill must not inherit a later
        // session's facts; finding F2). An unknown id → blank day (no throw).
        const requested = options.carryForwardFromDayId ?? null;
        const sourceId = requested === 'auto' ? nearestEarlierDayId(animal, prev.days, date) : requested;
        const carryFrom = sourceId ? prev.days[sourceId] || null : null;

        // Pure transition: pins the configuration effective on `date`, applies the field-specific
        // carry policy and records provenance (see workspaceTransitions.createDayRecord).
        const day = createDayRecord(animal, animalId, dayId, date, session, now, { carryFrom });

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
     * @param sourceDayId - The day to clone.
     * @param newDate - Date in YYYY-MM-DD for the new day.
     * @throws If the source day or its animal does not exist, or the target day already exists.
     */
    duplicateDay: (sourceDayId: string, newDate: string) => {
      commitWorkspace((prev) => {
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
        // date-derived session id and the source's session description. The SOURCE of the copy and
        // the SETUP of the new day are separate questions: the configuration is chosen by the new
        // recording date exactly as for a created day (a July 5 duplicate of a June 22 day gets the
        // July 1 reconfiguration), and bad-channel marks carry only when that choice is the source's
        // version. The weight is NOT copied.
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
          { carryFrom: source }
        );
        const day = built;

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
     * EXPLICIT correction: copy the animal's current default team / optogenetics setup / experiment
     * description onto the named days. Editing an animal default never reaches existing days on its
     * own (they own their copies); this is the one deliberate path that does, and it names the days
     * it touches. Each day's provenance records the field as `animal-default`.
     *
     * @param animalId - Animal identifier.
     * @param dayIds - The days to update (unknown / foreign ids are skipped).
     * @param fields - Which defaults to apply.
     */
    applyAnimalDefaultsToDays: (
      animalId: string,
      dayIds: string[],
      fields: Array<'experimenters' | 'optogenetics' | 'experiment_description'>
    ) => {
      commitWorkspace((prev) => {
        const animal = prev.animals[animalId];
        if (!animal) return prev;
        const now = getCurrentTimestamp();
        const nextDays = { ...prev.days };
        let changed = false;
        for (const dayId of new Set(dayIds)) {
          const day = prev.days[dayId];
          if (!day || (day.animalId != null && day.animalId !== animalId)) continue;
          const updates: DayUpdates = { provenance: { fields: {} } };
          if (fields.includes('experimenters')) {
            updates.experimenters = structuredClone(animal.experimenters);
            updates.provenance!.fields!.experimenters = 'animal-default';
          }
          if (fields.includes('optogenetics')) {
            updates.optogenetics = structuredClone(animal.optogenetics ?? null);
            updates.provenance!.fields!.optogenetics = 'animal-default';
          }
          if (fields.includes('experiment_description')) {
            updates.session = { experiment_description: animal.experiment_description ?? '' };
            updates.provenance!.fields!['session.experiment_description'] = 'animal-default';
          }
          nextDays[dayId] = applyDayUpdates(day, updates, now);
          changed = true;
        }
        return changed ? { ...prev, days: nextDays, lastModified: now } : prev;
      });
    },

    /**
     * Acknowledge that a download receipt's YAML bytes were durably stored — for THAT receipt only
     * (matched by content hash + export time). A metadata-only write: it touches no modification
     * stamp, so an edit made while the store was still writing keeps reading "Changed since
     * download", and a late acknowledgement of an older download never replaces a newer receipt.
     *
     * @param dayId - Day identifier.
     * @param identity - The receipt to acknowledge.
     * @param identity.contentHash - Its content hash.
     * @param identity.exportedAt - Its export timestamp.
     */
    acknowledgeReceiptStorage: (dayId: string, identity: { contentHash: string; exportedAt: string }) => {
      commitWorkspace((prev) => {
        const day = prev.days[dayId];
        const receipt = day?.exportReceipt;
        if (
          !receipt ||
          receipt.contentHash !== identity.contentHash ||
          receipt.exportedAt !== identity.exportedAt ||
          receipt.yamlStored === true
        ) {
          return prev;
        }
        return {
          ...prev,
          days: { ...prev.days, [dayId]: { ...day, exportReceipt: { ...receipt, yamlStored: true } } },
        };
      });
    },

    /**
     * Record WHEN a probe configuration version became effective (the setup effective date — distinct
     * from any recording date and from the entry timestamp). Marks the date as known, so days from that
     * date on select it automatically and earlier days no longer need per-day confirmation.
     *
     * @param animalId - Animal identifier.
     * @param version - The configuration version.
     * @param date - The effective date, ISO `YYYY-MM-DD`, or null when the date is unknown.
     * @throws If the animal or version does not exist, or the date is not ISO.
     */
    setConfigurationEffectiveDate: (animalId: string, version: number, date: string | null) => {
      commitWorkspace((prev) => {
        const animal = prev.animals[animalId];
        if (!animal) throw new Error(`Animal "${animalId}" not found`);
        if (date !== null) assertIsoDate(date);
        const history = getConfigHistory(animal);
        if (!history.some((s) => s.version === version)) {
          throw new Error(`Configuration version "${version}" not found for animal "${animalId}"`);
        }
        const now = getCurrentTimestamp();
        const updated = {
          ...animal,
          configurationHistory: history.map((s) =>
            s.version === version ? { ...s, ...(date === null ? { effectiveDateKnown: false } : { date, effectiveDateKnown: true }) } : s
          ),
          lastModified: now,
        };
        return { ...prev, animals: { ...prev.animals, [animalId]: updated }, lastModified: now };
      });
    },

    /**
     * "Start from a different day": re-copy the carry-forward fields of an existing day from another
     * day of the same animal (see `reseedDayFromSource` for exactly what is and is not copied).
     *
     * @param dayId - The day to re-seed.
     * @param sourceDayId - The day to copy from.
     * @throws If either day (or the animal) does not exist, or they belong to different animals.
     */
    reseedDayFrom: (dayId: string, sourceDayId: string) => {
      commitWorkspace((prev) => {
        const day = prev.days[dayId];
        const source = prev.days[sourceDayId];
        if (!day) throw new Error(`Day "${dayId}" not found`);
        if (!source) throw new Error(`Day "${sourceDayId}" not found`);
        const animal = prev.animals[day.animalId];
        if (!animal) throw new Error(`Animal "${day.animalId}" not found`);
        if (source.animalId !== day.animalId) throw new Error('Days belong to different animals');
        const now = getCurrentTimestamp();
        return { ...prev, days: { ...prev.days, [dayId]: reseedDayFromSource(animal, day, source, now) }, lastModified: now };
      });
    },

    /**
     * Updates day metadata
     *
     * @param dayId - Day identifier
     * @param updates - Partial updates to apply
     * @throws If day does not exist
     */
    updateDay: (dayId: string, updates: DayUpdates) => {
      // commitWorkspace (ref-lockstep): see updateAnimal.
      commitWorkspace((prev) => {
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
     * @param dayId - Day identifier.
     * @param ownerAnimalId - The owning animal id when the caller knows it (the UI deletes from a
     *   selected animal). Used in preference to the record's `animalId`.
     * @throws If day does not exist.
     */
    deleteDay: (dayId: string, ownerAnimalId?: string) => {
      commitWorkspace((prev) => {
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
     * @param animalId - The animal whose `days` array holds the dangling reference.
     * @param dayId - The dangling day id to remove.
     */
    removeDayReference: (animalId: string, dayId: string) => {
      commitWorkspace((prev) => {
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
     * @param animalId - The owning animal's id.
     * @param dayId - The orphaned day record's id to re-link.
     */
    relinkDayReference: (animalId: string, dayId: string) => {
      commitWorkspace((prev) => {
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
     * @param animalId - The animal to unlink the reference from.
     * @param dayId - The day id to unlink (the record is preserved).
     */
    unlinkDayReference: (animalId: string, dayId: string) => {
      commitWorkspace((prev) => {
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
     * @param settings - Partial settings updates
     */
    updateWorkspaceSettings: (settings: Partial<WorkspaceSettings>) => {
      commitWorkspace((prev) => ({
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
