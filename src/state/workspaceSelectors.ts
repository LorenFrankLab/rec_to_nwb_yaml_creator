/**
 * @fileoverview Shape-safe canonical read layer for raw workspace state.
 *
 * Raw persisted state (animal / day records) MAY be corrupt after an import, migration,
 * or an old save: a `cameras` that is a string, a `configurationHistory` that is `{}`, a
 * `session` that is `null`. The app's invariant is that **canonical UI state must be safe
 * to render** even when raw state is not — but it must NEVER decide export validity (a
 * corrupt field is still flagged by raw-shape validation and blocks export).
 *
 * This module is the SINGLE place those guards live. Every component and the export merge
 * read raw collections/records through these selectors instead of ad-hoc `x || []` /
 * `Array.isArray(x) ? x : []`. That makes the recurring "one component still used `|| []`"
 * bug structurally impossible: there is no ad-hoc access left to get wrong, and
 * `workspaceSelectors.guard.test.js` forbids it from creeping back in.
 *
 * Selectors NEVER mutate, NEVER throw, and ALWAYS return a safe value (an array for list
 * fields, a record `{}` for object fields). A well-formed value is returned by reference
 * so callers can rely on identity where they did before.
 *
 * **Type contract — container shape, NOT deep element validity.** Inputs are `unknown`
 * (raw state can be anything); outputs are the app's canonical container types (`Camera[]`,
 * `ConfigurationSnapshot[]`, `Day[]`, `Record<string, number[]>`, …). The promise is that the
 * CONTAINER is normalized (always an array / record), not that every ELEMENT is valid — a
 * malformed element can still slip through typed as its clean shape. The single shape-trust
 * assertion lives here (`asArray`/`asRecord`'s `as T`), so consumers don't repeat
 * `getX(animal) as Foo[]` at every call site. **Element validity remains validation's
 * responsibility** (raw-shape + business rules prove exportability). A reader that must
 * inspect raw element corruption should read raw state directly (or via a specifically-named
 * raw helper), NOT through these clean consumer selectors.
 */

import type {
  Animal,
  Camera,
  TaskType,
  BehavioralEvent,
  ConfigurationSnapshot,
  DeviceConfiguration,
  DataAcqDevice,
  ElectrodeGroup,
  NtrodeMap,
  SubjectMetadata,
  ExperimenterInfo,
  DayId,
  SessionMetadata,
  Task,
  TaskInstance,
  AssociatedVideoFile,
  AssociatedFile,
  FsGuiYaml,
  Day,
  Workspace,
} from './workspaceTypes';

/**
 * @param value
 * @returns `value` as `T[]` if it is an array, else a fresh empty array. Guarantees array
 *   SHAPE only — the elements are trusted as `T`, not verified (see the module contract).
 */
function asArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

/**
 * @param value
 * @returns `value` as `T` if it is a plain object record (not null/array), else `{}` as `T`.
 *   Guarantees record SHAPE only — the contents are trusted, not verified.
 */
function asRecord<T extends object = Record<string, unknown>>(value: unknown): T {
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? (value as T) : ({} as T);
}

// ── Animal-owned collections / records ──────────────────────────────────────────────

/** The animal's cameras (always an array). */
export const getAnimalCameras = (animal: unknown): Camera[] =>
  asArray<Camera>(asRecord(animal).cameras);

/** The animal's task-type catalog (always an array). */
export const getAnimalTaskTypes = (animal: unknown): TaskType[] =>
  asArray<TaskType>(asRecord(animal).taskTypes);

/**
 * VESTIGIAL: the animal-level behavioral-events library was retired — behavioral events are now
 * day-owned (`day.behavioral_events`, the only ones exported). `animal.behavioral_events` is left
 * in the persisted blob for backward/forward compatibility but is no longer read by the app. This
 * selector is retained (no consumer beyond its own test) so a future migration could relocate the
 * field; see `.claude/docs/plans/dio-per-day-sets/phase-2b-retire-animal-library.md`.
 *
 * @param animal @returns The animal's (vestigial) behavioral events.
 */
export const getAnimalBehavioralEvents = (animal: unknown): BehavioralEvent[] =>
  asArray<BehavioralEvent>(asRecord(animal).behavioral_events);

/** The animal's configuration history. */
export const getConfigHistory = (animal: unknown): ConfigurationSnapshot[] =>
  asArray<ConfigurationSnapshot>(asRecord(animal).configurationHistory);

/** The animal's devices record. */
export const getAnimalDevices = (animal: unknown): DeviceConfiguration =>
  asRecord<DeviceConfiguration>(asRecord(animal).devices);

/** The animal's data-acquisition devices. */
export const getDataAcqDevices = (animal: unknown): DataAcqDevice[] =>
  asArray<DataAcqDevice>(getAnimalDevices(animal).data_acq_device);

/** The animal's electrode groups. */
export const getAnimalElectrodeGroups = (animal: unknown): ElectrodeGroup[] =>
  asArray<ElectrodeGroup>(getAnimalDevices(animal).electrode_groups);

/** The animal's ntrode channel maps. */
export const getAnimalNtrodeMaps = (animal: unknown): NtrodeMap[] =>
  asArray<NtrodeMap>(getAnimalDevices(animal).ntrode_electrode_group_channel_map);

/**
 * Electrode groups of a ProbeConfiguration — the shape that exposes `electrode_groups` at
 * its TOP level. Pass a ProbeConfiguration, OR a snapshot's `.devices` (which IS one) — NOT
 * a whole snapshot `{version, devices}` (that would silently yield `[]`).
 * @param probeConfig - A ProbeConfiguration (or snapshot.devices).
 */
export const getProbeElectrodeGroups = (probeConfig: unknown): ElectrodeGroup[] =>
  asArray<ElectrodeGroup>(asRecord(probeConfig).electrode_groups);

/**
 * Ntrode channel maps of a ProbeConfiguration (top-level `ntrode_electrode_group_channel_map`).
 * Pass a ProbeConfiguration or a snapshot's `.devices`, NOT a whole snapshot.
 * @param probeConfig - A ProbeConfiguration (or snapshot.devices).
 */
export const getProbeNtrodeMaps = (probeConfig: unknown): NtrodeMap[] =>
  asArray<NtrodeMap>(asRecord(probeConfig).ntrode_electrode_group_channel_map);

/** The animal's subject record (always a record). */
export const getAnimalSubject = (animal: unknown): SubjectMetadata =>
  asRecord<SubjectMetadata>(asRecord(animal).subject);

/** The animal's experimenters record. */
export const getAnimalExperimenters = (animal: unknown): ExperimenterInfo =>
  asRecord<ExperimenterInfo>(asRecord(animal).experimenters);

/** The experimenter_name list (always an array). */
export const getExperimenterNames = (animal: unknown): string[] =>
  asArray<string>(getAnimalExperimenters(animal).experimenter_name);

/** The animal's day ids (always an array). */
export const getAnimalDayIds = (animal: unknown): DayId[] =>
  asArray<DayId>(asRecord(animal).days);

/**
 * Whether the animal's recording-day index is present but corrupt — a value that is not a list.
 * {@link getAnimalDayIds} deliberately launders such an index to `[]` so callers render safely, which
 * would otherwise hide the corruption behind a misleading "No recording days yet". This DETECTS it so a
 * review surface can surface the corrupt-index notice. (A detector, not a laundering read — its home is
 * here alongside the canonical selectors, per the read-layer guard.)
 *
 * @param animal - The animal record.
 * @returns True when the `days` index is present and not an array.
 */
export const isAnimalDaysIndexCorrupt = (animal: unknown): boolean => {
  const index = asRecord(animal).days;
  return index != null && !Array.isArray(index);
};

/** A resolved recording-day owner: the store key its animal is indexed by, plus the animal record. */
export interface ResolvedDayOwner {
  /** The store key the day's owning animal is indexed by; null when no owner could be resolved. */
  ownerKey: string | null;
  /** The owning animal record; null when unresolvable. */
  animal: Animal | null;
}

/** Whether `value` is a non-null, non-array object record. */
const isRecordValue = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value);

/**
 * Resolve a recording day's owning animal the way the Day Editor opens it. A string `day.animalId`
 * is the owner; a day that declares NO owner (`animalId == null`, a recovered record with a
 * missing/dropped id) falls back to whichever animal's index references this day's store key; a
 * PRESENT-but-unresolvable owner (a non-string `animalId`, or a "ghost"/wrong-owner id) stays
 * unresolved, so a wrong-owner day dead-ends on "Animal not found" rather than opening under the
 * wrong subject. Tolerates a missing day / malformed workspace (returns no owner).
 *
 * Extracted from the Day-Editor stepper's + view-model's previously-duplicated inline copies so both
 * read one truth — a recovered/imported day resolves its owner identically wherever it is opened.
 *
 * @param workspace - `{ animals, days }`.
 * @param dayId - The day's store key (the id the URL / an animal's index holds).
 * @returns The resolved owner key + animal (both null when unresolvable).
 */
export const resolveDayOwner = (
  workspace: unknown,
  dayId: string | null | undefined
): ResolvedDayOwner => {
  const ws = asRecord(workspace);
  const animalsMap = asRecord<Record<string, unknown>>(ws.animals);
  const daysMap = asRecord<Record<string, unknown>>(ws.days);
  const day = dayId != null ? daysMap[dayId] : undefined;
  const declared = asRecord(day).animalId;

  // A non-string `animalId` is treated as "no resolvable owner" — coercing one (object/number) to a
  // property name would invent a phantom key and diverge from dayRecovery's WRONG_OWNER classification.
  let ownerKey: string | null = typeof declared === 'string' ? declared : null;
  let animal: unknown = ownerKey != null ? animalsMap[ownerKey] : null;

  // ONLY the truly owner-less case (`animalId == null`) takes the indexing-animal fallback. A present
  // but unresolvable owner must NOT open under whichever animal happens to index it (that would let a
  // wrong-owner day export as the wrong subject). Match by the store MAP KEY (`dayId`), what an
  // animal's `days` index actually holds.
  if (!isRecordValue(animal) && declared == null && isRecordValue(day) && dayId != null) {
    const indexingKey = Object.keys(animalsMap).find((key) =>
      getAnimalDayIds(animalsMap[key]).includes(dayId)
    );
    if (indexingKey != null) {
      ownerKey = indexingKey;
      animal = animalsMap[indexingKey];
    }
  }

  return { ownerKey, animal: isRecordValue(animal) ? (animal as unknown as Animal) : null };
};

/**
 * The id of the animal's latest-dated day present in `days`, or null. Day dates are `YYYY-MM-DD`
 * (lexicographic compare == chronological). Tolerates a corrupt animal, a missing `days` map, a
 * dangling id, or a record without a string `date`.
 * @param animal
 * @param days
 */
export const getMostRecentDayId = (animal: unknown, days: unknown): string | null => {
  const present = getAnimalDayIds(animal)
    .map((id) => (days && typeof days === 'object' ? (days as Record<string, unknown>)[id] : undefined))
    .filter(
      (d): d is { id: string; date: string } =>
        !!d &&
        typeof (d as { id?: unknown }).id === 'string' &&
        typeof (d as { date?: unknown }).date === 'string'
    );
  if (present.length === 0) return null;
  present.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
  return present[0].id;
};

/**
 * Other animals whose recording has a non-empty behavioral-event (DIO) set to copy from, for
 * bootstrapping a new animal's first day. For each qualifying animal (≠ `currentAnimalId`), returns
 * its MOST-RECENT day's set (the current rig wiring; sets are near-constant across an animal's days,
 * so the latest is representative). Animals with no day or no named events are omitted. Tolerates a
 * corrupt/missing workspace shape.
 *
 * @param workspace - The workspace (`{ animals, days }`).
 * @param currentAnimalId - The animal being edited (excluded from the result).
 */
export const getCopyableDioSources = (
  workspace: unknown,
  currentAnimalId: string
): Array<{ id: string; name: string; date: string; events: BehavioralEvent[] }> => {
  const animals = asRecord(asRecord(workspace).animals);
  const days = asRecord(asRecord(workspace).days);
  // Only NAMED events are real (a blank channel is unused and is excluded from export), so a source
  // copies and counts named events only — matching what the day would actually export.
  const namedEvents = (day: unknown): BehavioralEvent[] =>
    getDayBehavioralEvents(day).filter((e) => typeof e?.name === 'string' && e.name.trim() !== '');
  const sources: Array<{ id: string; name: string; date: string; events: BehavioralEvent[] }> = [];
  Object.entries(animals).forEach(([animalId, animal]) => {
    if (animalId === currentAnimalId) return;
    const withDio = getAnimalDayIds(animal)
      .map((id) => days[id])
      .filter((d): d is { date: string } => !!d && typeof (d as { date?: unknown }).date === 'string')
      .map((day) => ({ day, events: namedEvents(day) }))
      .filter((x) => x.events.length > 0);
    if (withDio.length === 0) return;
    withDio.sort((a, b) => (a.day.date < b.day.date ? 1 : a.day.date > b.day.date ? -1 : 0));
    const top = withDio[0];
    sources.push({
      id: animalId,
      name: getAnimalSubject(animal).subject_id || animalId,
      date: top.day.date,
      events: top.events,
    });
  });
  return sources;
};

/**
 * All day RECORDS for an animal, sorted by date. Tolerates corrupt day RECORDS (a dangling id, a
 * non-object record) AND enforces ownership: keeps only resolvable records that actually belong to
 * this animal — a record whose `animalId` names a DIFFERENT animal (a wrong-owner index entry) is
 * excluded, or reconfiguration could move another animal's day. A record with no `animalId` is kept
 * (the index is the authority). Order by a string-coerced date so a numeric/missing `date` can't
 * throw. Returns a fresh array; `[]` for an unknown animal. (Like the former hook selector, it
 * assumes well-formed `workspace.animals` / `workspace.days` containers.)
 *
 * @param workspace - The workspace (`{ animals, days }`).
 * @param animalId - Animal identifier.
 */
export const getAnimalDays = (workspace: unknown, animalId: string): Day[] => {
  const ws = workspace as Workspace;
  const animal = ws.animals[animalId];
  if (!animal) return [];

  const orderKey = (value: unknown): string => (typeof value === 'string' ? value : String(value ?? ''));
  return getAnimalDayIds(animal)
    .map((dayId) => ws.days[dayId])
    .filter(
      (day) =>
        day !== null &&
        typeof day === 'object' &&
        !Array.isArray(day) &&
        (day.animalId == null || day.animalId === animalId)
    )
    .sort((a, b) => orderKey(a.date).localeCompare(orderKey(b.date)));
};

// ── Day-owned collections / records ─────────────────────────────────────────────────

/** The day's session record (always a record). */
export const getDaySession = (day: unknown): SessionMetadata =>
  asRecord<SessionMetadata>(asRecord(day).session);

/** The day's inline tasks (legacy/compat shape; always an array). */
export const getDayTasks = (day: unknown): Task[] => asArray<Task>(asRecord(day).tasks);

/**
 * The day's catalog task instances, or `null` when the day is not catalog-shaped. Distinguishes
 * "catalog day with zero tasks" (`[]`) from "legacy inline day" (`null`) so the export merge knows
 * whether to resolve the catalog or fall back to inline `day.tasks`.
 *
 * @param day
 * @returns The ordered task instances, or null if `taskInstances` is absent.
 */
export const getDayTaskInstances = (day: unknown): TaskInstance[] | null => {
  const instances = asRecord(day).taskInstances;
  return Array.isArray(instances) ? (instances as TaskInstance[]) : null;
};

/** The day's associated video files. */
export const getDayAssociatedVideos = (day: unknown): AssociatedVideoFile[] =>
  asArray<AssociatedVideoFile>(asRecord(day).associated_video_files);

/** The day's associated files. */
export const getDayAssociatedFiles = (day: unknown): AssociatedFile[] =>
  asArray<AssociatedFile>(asRecord(day).associated_files);

/** The day's behavioral events. */
export const getDayBehavioralEvents = (day: unknown): BehavioralEvent[] =>
  asArray<BehavioralEvent>(asRecord(day).behavioral_events);

/** The day's keywords. */
export const getDayKeywords = (day: unknown): string[] => asArray<string>(asRecord(day).keywords);

/** The day's FsGUI protocol files. */
export const getDayFsGuiYamls = (day: unknown): FsGuiYaml[] =>
  asArray<FsGuiYaml>(asRecord(day).fs_gui_yamls);

/** The day's used-camera ids (always an array). */
export const getDayCamerasUsed = (day: unknown): Array<number | string> =>
  asArray<number | string>(asRecord(day).cameras_used);

/**
 * @param day
 * @returns The day's per-ntrode bad-channel overrides as a record (always a record — `{}` when
 *   absent/corrupt). Bad channels are day-owned.
 */
export const getDayBadChannelOverrides = (day: unknown): Record<string, number[]> =>
  asRecord<Record<string, number[]>>(asRecord(asRecord(day).deviceOverrides).bad_channels);

/**
 * @param day
 * @returns The day's recording-system catalog reference, or `undefined` when absent/non-string.
 */
export const getDayDataAcqDeviceName = (day: unknown): string | undefined => {
  const name = asRecord(day).data_acq_device_name;
  return typeof name === 'string' ? name : undefined;
};
