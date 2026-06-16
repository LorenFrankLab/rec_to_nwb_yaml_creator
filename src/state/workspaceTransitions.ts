/**
 * @fileoverview Pure workspace state transitions.
 *
 * The riskiest animal/day mutation recipes, extracted out of `useWorkspace` so their
 * invariants are testable outside React: updating animal devices while MIRRORING the edit
 * into the latest configuration snapshot, adding/applying/rebuilding configuration history,
 * creating a day pinned to the latest version, and safely updating a (possibly malformed)
 * day record. These are pure — they take the current record(s) + a timestamp and return the
 * next record(s); they never read the clock, touch localStorage, or call `setState`. The
 * hook keeps the side effects (hydration, autosave, debounce) and the existence-check throws.
 *
 * Typing contract: the record-producing functions take the canonical `Animal`/`Day` interfaces
 * (their output) and a typed `Record<string, Day>` days map; corruption tolerance lives in the
 * body's `unknown`-accepting selectors (`getConfigHistory`, `getAnimalDevices`, `getDayTasks`, …),
 * exactly as before. `nextConfigurationVersion` stays shape-agnostic (`unknown`).
 */

import { formatExperimentDate } from './workspaceUtils';
import {
  getAnimalDevices,
  getConfigHistory,
  getDayTasks,
  getDayTaskInstances,
  getDayKeywords,
  getDayBehavioralEvents,
  getDayBadChannelOverrides,
} from './workspaceSelectors';
import {
  normalizeDeviceOverrides,
  normalizeDevices,
  normalizeProbeConfigDevices,
} from '../utils/deviceNormalization';
import type {
  Animal,
  Day,
  SessionMetadata,
  SubjectMetadata,
  ExperimenterInfo,
  DeviceConfiguration,
  DataAcqDevice,
  Camera,
  TechnicalDefaults,
  TechnicalParameters,
  OptogeneticsConfig,
  BehavioralEvent,
  Task,
  TaskInstance,
  TaskType,
  AssociatedFile,
  AssociatedVideoFile,
  FsGuiYaml,
  DeviceOverrides,
  DayState,
} from './workspaceTypes';

/**
 * Partial-update payload accepted by {@link applyAnimalUpdates}. Each recognized key is applied
 * only when present (see the function for the exact present-vs-truthy semantics); `optogenetics`
 * accepts an explicit `null` (the editor's "disable" sentinel).
 */
export interface AnimalUpdates {
  subject?: Partial<SubjectMetadata>;
  experimenters?: Partial<ExperimenterInfo>;
  devices?: Partial<DeviceConfiguration>;
  cameras?: Camera[];
  data_acq_device?: DataAcqDevice[];
  technicalDefaults?: Partial<TechnicalDefaults>;
  behavioral_events?: BehavioralEvent[];
  taskTypes?: TaskType[];
  optogenetics?: OptogeneticsConfig | null;
}

/** `{ date, description, devices }` for a new configuration snapshot; `devices` is normalized. */
export interface ConfigSnapshotInput {
  date: string;
  description: string;
  /** Raw device payload (a devices object); `normalizeProbeConfigDevices` tolerates the contents. */
  devices: Record<string, unknown>;
}

/**
 * Partial-update payload accepted by {@link applyDayUpdates}. Recognized keys only; `session`,
 * `technical`, and `state` are deep-merged (with malformed-current guards for `session`/`state`),
 * the collections replace on `!== undefined`, and `data_acq_device_name` is matched by presence
 * (so an explicit `undefined` clears it back to the animal default).
 */
export interface DayUpdates {
  session?: Partial<SessionMetadata>;
  tasks?: Task[];
  taskInstances?: TaskInstance[];
  behavioral_events?: BehavioralEvent[];
  associated_files?: AssociatedFile[];
  associated_video_files?: AssociatedVideoFile[];
  fs_gui_yamls?: FsGuiYaml[];
  technical?: Partial<TechnicalParameters>;
  deviceOverrides?: DeviceOverrides;
  state?: Partial<DayState>;
  configurationVersion?: number;
  keywords?: string[];
  data_acq_device_name?: string;
  cameras_used?: Array<number | string>;
  /** Day-level data folder (off-export; replaced on `!== undefined`). */
  dataFolder?: string;
}

/**
 * Order a list of day ids by their record's `date`, ascending. Day dates are ISO `YYYY-MM-DD`,
 * which sort lexicographically == chronologically, so a string compare is correct. Pure and
 * total: returns a NEW array (never mutates `ids`), coerces a missing record / missing date to
 * the empty string (which sorts first) so a corrupt index can't throw, and is stable for equal
 * dates (preserves insertion order). The store calls this on write in `createDay`/`duplicateDay`
 * so the stored `animal.days` index is canonically date-ordered (the sort-on-read selectors then
 * become redundant defense-in-depth).
 *
 * @param ids - Day ids to order.
 * @param daysById - The full days map (`{ [dayId]: dayRecord }`); read-only.
 * @returns A new array of the ids, ascending by `date`.
 */
export function sortDayIdsByDate(ids: string[], daysById: Record<string, Day>): string[] {
  return [...ids].sort((a, b) =>
    String(daysById[a]?.date ?? '').localeCompare(String(daysById[b]?.date ?? ''))
  );
}

/**
 * Apply partial updates to an animal and return the next animal record. A `devices` edit is
 * mirrored into the LATEST configuration snapshot (the authoritative source the export
 * resolves) so probes configured after creation actually reach `resolveDayConfig`;
 * reconfiguration forks a new latest version BEFORE editing, so this only ever rewrites the
 * current latest, never a frozen historical snapshot. An explicit `optogenetics: null`
 * clears opto (how the editor disables it).
 *
 * @param animal - The current animal record.
 * @param updates - Partial updates; recognized keys: `subject`, `experimenters`,
 *   `devices` (also mirrored into the latest snapshot), `cameras`, `data_acq_device` (routed
 *   onto `devices.data_acq_device`), `technicalDefaults`, `behavioral_events`, `taskTypes`,
 *   `optogenetics`. Note: `optogenetics: null` CLEARS opto (uses `!== undefined`, not
 *   truthiness), as does `taskTypes: []`; all other keys are applied only when truthy.
 * @param now - Timestamp to stamp `lastModified`.
 * @returns The next animal record (deep-cloned; input not mutated).
 */
export function applyAnimalUpdates(animal: Animal, updates: AnimalUpdates, now: string): Animal {
  const updated = structuredClone(animal);

  if (updates.subject) {
    updated.subject = { ...updated.subject, ...updates.subject };
  }
  if (updates.experimenters) {
    updated.experimenters = { ...updated.experimenters, ...updates.experimenters };
  }
  if (updates.devices) {
    updated.devices = normalizeDevices({ ...getAnimalDevices(updated), ...updates.devices });
    // Mirror the edit into the latest snapshot (see file/function header).
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
  // Data-acq hardware is an animal-level device read from `animal.devices.data_acq_device`.
  if (updates.data_acq_device) {
    updated.devices = normalizeDevices({
      ...getAnimalDevices(updated),
      data_acq_device: updates.data_acq_device,
    });
  }
  // Animal-level technical DEFAULTS only (seeded into each day's `technical` at createDay).
  if (updates.technicalDefaults) {
    updated.technicalDefaults = { ...updated.technicalDefaults, ...updates.technicalDefaults };
  }
  // Animal-level behavioral events are an editable reference; the exported source is the
  // day's `behavioral_events`. Persist them so the editor and the model agree.
  if (updates.behavioral_events) {
    updated.behavioral_events = updates.behavioral_events;
  }
  // Task-type catalog (Phase 8C): the animal's define-once catalog that day `taskInstances` reference
  // (read by `mergeDayMetadata`'s `resolveDayTasks`). The sibling of `applyDayUpdates`' taskInstances
  // branch — without it every Task Types add/edit/delete AND the Day Editor's inline→catalog
  // conversion / quick-add is silently dropped, leaving days pointing at task types the catalog never
  // saved. `!== undefined` so a delete-last-type (`taskTypes: []`) persists, never a silent no-op.
  if (updates.taskTypes !== undefined) {
    updated.taskTypes = updates.taskTypes;
  }
  // `!== undefined` (not truthiness) so an explicit `null` CLEARS opto (editor disable).
  if (updates.optogenetics !== undefined) {
    updated.optogenetics = updates.optogenetics;
  }

  updated.lastModified = now;
  return updated;
}

/**
 * The next configuration version to allocate for an animal's history: `max(existing) + 1`
 * (or 1 for an empty/missing history). Using the max — not the count — guarantees a UNIQUE
 * version even for a non-contiguous imported/repaired history (e.g. `[1, 3]` → 4, not a
 * duplicate 3), so `applyConfigurationForwardToAnimal`/`resolveDayConfig`'s first-match
 * `.find()` can never resolve to the wrong snapshot.
 *
 * @param history - The animal's configuration history (any shape tolerated).
 * @returns The next version number.
 */
export function nextConfigurationVersion(history: unknown): number {
  // Versions are integers; ignore any non-integer (a corrupt import like `2.5` must not
  // yield a fractional next version such as `3.5`).
  const versions = (Array.isArray(history) ? history : [])
    .map((s) => s?.version)
    .filter((v) => Number.isInteger(v));
  return versions.length > 0 ? Math.max(...versions) + 1 : 1;
}

/**
 * Append a new configuration snapshot to an animal's history and return the next animal
 * record. The version is `max(existing version) + 1` (see {@link nextConfigurationVersion})
 * so it is unique even for a non-contiguous history. The atomic reconfiguration transition
 * {@link createSnapshotAndApplyForward} composes this with the forward-apply in one step.
 *
 * @param animal - The current animal record.
 * @param config - `{ date, description, devices }` for the new snapshot.
 * @param now - Timestamp to stamp `lastModified`.
 * @param version - The version to assign. Defaults to {@link nextConfigurationVersion}. Pass
 *   an explicit value so a caller that reserved the version synchronously appends exactly that
 *   version (return === appended, no re-derive).
 * @returns The next animal record.
 */
export function addConfigurationSnapshotToAnimal(
  animal: Animal,
  config: ConfigSnapshotInput,
  now: string,
  version?: number
): Animal {
  const updated = structuredClone(animal);
  const history = getConfigHistory(updated);

  const newVersion = {
    version: version ?? nextConfigurationVersion(history),
    date: config.date,
    description: config.description,
    devices: normalizeProbeConfigDevices(config.devices),
    appliedToDays: [],
  };

  updated.configurationHistory = [...history, newVersion];
  updated.lastModified = now;
  return updated;
}

/**
 * Atomic reconfiguration transition: append a NEW configuration snapshot AND apply it forward
 * to a set of days, deriving the version ONCE inside this single transition. This replaces the
 * fragile two-step compose (create-snapshot → read returned version → apply-forward), which
 * handed a version across two store actions and could target the wrong snapshot when the
 * returned version was stale. The snapshot and the day pins move together, so there is no
 * cross-action handoff to get wrong.
 *
 * @param animal - The current animal record.
 * @param days - The full `days` map (read-only; not mutated).
 * @param config - `{ date, description, devices }` for the new snapshot.
 * @param dayIds - Day ids to move onto the new version.
 * @param now - Timestamp to stamp moved days + the animal.
 * @param version - The version to assign (defaults to {@link nextConfigurationVersion}).
 * @param ownerKey - The animal's STORE KEY, used for the day-ownership guard so it doesn't
 *   depend on the (possibly stale) `animal.id` record field. Defaults to `animal.id`.
 * @returns The next animal + days map and the version that was created. (Superset of
 *   {@link applyConfigurationForwardToAnimal}'s `{animal, days}` — the extra `version` is the
 *   just-created snapshot.)
 */
export function createSnapshotAndApplyForward(
  animal: Animal,
  days: Record<string, Day>,
  config: ConfigSnapshotInput,
  dayIds: string[],
  now: string,
  version?: number,
  ownerKey?: string
): { animal: Animal; days: Record<string, Day>; version: number } {
  const created = version ?? nextConfigurationVersion(getConfigHistory(animal));
  const withSnapshot = addConfigurationSnapshotToAnimal(animal, config, now, created);
  const applied = applyConfigurationForwardToAnimal(withSnapshot, days, created, dayIds, now, ownerKey);
  return { animal: applied.animal, days: applied.days, version: created };
}

/**
 * Point a set of days at an existing snapshot version and keep each snapshot's
 * `appliedToDays` a clean partition (a day appears in at most one list). Returns the next
 * animal record + the next full days map. Throws if the snapshot version does not exist.
 *
 * @param animal - The current animal record.
 * @param days - The full `days` map (read-only; not mutated).
 * @param snapshotVersion - The existing snapshot version to apply.
 * @param dayIds - Day ids to move onto that version.
 * @param now - Timestamp to stamp moved days + the animal.
 * @param ownerKey - The animal's STORE KEY for the ownership guard (so it doesn't rely on the
 *   possibly-stale `animal.id` record field). Defaults to `animal.id`.
 * @returns The next animal + days map. (Returns NO `version` — use
 *   {@link createSnapshotAndApplyForward} if you also need the created version.)
 * @throws If `snapshotVersion` does not exist for the animal.
 */
export function applyConfigurationForwardToAnimal(
  animal: Animal,
  days: Record<string, Day>,
  snapshotVersion: number,
  dayIds: string[],
  now: string,
  ownerKey?: string
): { animal: Animal; days: Record<string, Day> } {
  const updatedAnimal = structuredClone(animal);
  const history = getConfigHistory(updatedAnimal);
  const target = history.find((s) => s.version === snapshotVersion);
  if (!target) {
    throw new Error(
      `Configuration version "${snapshotVersion}" not found for animal "${animal?.id}"`
    );
  }

  // Only real, deduped days that BELONG TO THIS ANIMAL move — a day id not in the workspace must
  // never leak into appliedToDays, and (defense in depth alongside the OK-only `getAnimalDays`
  // that feeds the wizard) a record explicitly owned by a DIFFERENT animal must never have its
  // `configurationVersion` rewritten by this animal's reconfiguration. A record with no
  // `animalId` is permitted (the index is the authority).
  const isRecordRow = (value: unknown): boolean =>
    value !== null && typeof value === 'object' && !Array.isArray(value);
  // Ownership is checked against the STORE KEY (ownerKey), not `updatedAnimal.id`, so a stale/
  // missing record id can't make the guard pass the wrong days or reject the right ones.
  const owner = ownerKey ?? updatedAnimal.id;
  const validDayIds = [...new Set(dayIds)].filter((id) => {
    const record = days[id];
    return isRecordRow(record) && (record.animalId == null || record.animalId === owner);
  });
  const moving = new Set(validDayIds);

  // Remove the moving days from EVERY snapshot's list first (clean partition), then add
  // them to the target's list (dedup, stable order).
  history.forEach((snapshot) => {
    snapshot.appliedToDays = (snapshot.appliedToDays || []).filter((id) => !moving.has(id));
  });
  target.appliedToDays = [
    ...target.appliedToDays.filter((id) => !moving.has(id)),
    ...validDayIds,
  ];
  updatedAnimal.configurationHistory = history;

  // Point each listed day at the target version.
  const updatedDays = { ...days };
  validDayIds.forEach((dayId) => {
    updatedDays[dayId] = {
      ...structuredClone(days[dayId]),
      configurationVersion: snapshotVersion,
      lastModified: now,
    };
  });

  updatedAnimal.lastModified = now;
  return { animal: updatedAnimal, days: updatedDays };
}

/**
 * Rebuild a corrupt/missing `configurationHistory` from scratch: a single version-1
 * snapshot derived from the animal's CURRENT `devices`. The executable repair for a
 * `malformed_animal_collection` on `configurationHistory`. Tolerates any start shape.
 *
 * Scope: this clears the raw-shape corruption (the carried command's issue). It does NOT
 * re-pin days that referenced a now-gone version > 1 — those still fail closed in
 * `resolveDayConfig` until re-applied — so it is one step toward export-readiness, not a
 * guarantee of it.
 *
 * @param animal - The current animal record.
 * @param now - Timestamp to stamp `lastModified`.
 * @param today - Date string for the rebuilt snapshot.
 * @returns The next animal record.
 */
export function rebuildConfigurationHistoryForAnimal(animal: Animal, now: string, today: string): Animal {
  const updated = structuredClone(animal);
  const devices = getAnimalDevices(updated);

  updated.configurationHistory = [
    {
      version: 1,
      date: today,
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
  return updated;
}

/**
 * Build a new recording-day record pinned to the animal's LATEST configuration version, with
 * `technical` seeded from the animal's technical defaults. The caller owns id generation and
 * the existence check.
 *
 * When `carryFrom` (a prior day record) is supplied, the day-owned content is SEEDED from it —
 * deep-cloned so the new record never aliases the source.
 *
 * Carried from `carryFrom`: tasks, behavioral_events, keywords, technical,
 * session.experiment_description, session.weight (each session field overridable by the caller's
 * `session`), AND `deviceOverrides.bad_channels` — but ONLY when the source pins the SAME (latest)
 * configuration version the new day pins. Bad channels are ntrode-id-keyed; if the source pins an
 * OLDER version the probe was reconfigured since, so those marks would target the WRONG electrodes
 * on the new config and are dropped as stale. ONLY `bad_channels` is carried — never a whole-map
 * `electrode_groups` / `ntrode_electrode_group_channel_map` override — and an empty bad-channel map
 * adds NO `deviceOverrides` container (a blank day stays byte-identical to today's output).
 *
 * Never carried: session_id / session_description (date-derived, always from the caller),
 * associated_files / associated_video_files / fs_gui_yamls / cameras_used (session-specific, left
 * unset/empty).
 *
 * @param animal - The owning animal (for technicalDefaults + the latest pin).
 * @param animalId - The owning animal id.
 * @param dayId - The (already-validated) new day id.
 * @param date - Date in YYYY-MM-DD.
 * @param session - Session metadata (session_id, session_description, etc.).
 * @param now - Timestamp for created/lastModified.
 * @param carryFrom - A prior day record to seed day-owned content from, or null.
 * @returns The new day record.
 */
export function createDayRecord(
  animal: Animal,
  animalId: string,
  dayId: string,
  date: string,
  session: SessionMetadata,
  now: string,
  carryFrom: Day | null = null
): Day {
  // Pin to the latest snapshot's ACTUAL version, not the count. An imported/repaired
  // history can be non-contiguous (e.g. [1, 3]) — there the count (2) names no real
  // snapshot, and `resolveDayConfig` (which matches by `version`) would fail closed on a
  // brand-new day. The last element is the latest snapshot everywhere else in the model
  // (mirroring in applyAnimalUpdates, the reconfig latest in DevicesStep).
  const history = getConfigHistory(animal);
  const latestVersion = history.length > 0 ? history[history.length - 1].version : 0;

  // Animal-defaults technical seed: the no-carry path, and the fallback when carryFrom has no
  // technical record. Kept verbatim so a blank day stays byte-identical to today's output.
  const defaultTechnical = {
    // Seeded from the animal's technical DEFAULTS (overridable per day); falls back to
    // the standard values when no defaults are set.
    times_period_multiplier: animal.technicalDefaults?.times_period_multiplier ?? 1.5,
    raw_data_to_volts: animal.technicalDefaults?.raw_data_to_volts ?? 0.195,
    default_header_file_path: '',
    units: undefined,
  };
  const carryTechnical =
    carryFrom &&
    carryFrom.technical !== null &&
    typeof carryFrom.technical === 'object' &&
    !Array.isArray(carryFrom.technical);

  // Bad-channel carry-forward, guarded by config version. Bad channels are MONOTONIC across a
  // study and ntrode-id-keyed. They are safe to carry ONLY when the source pins the SAME version
  // the new day pins (this latest one): the marks then still name the same electrodes. If the
  // source pins an older version the probe was reconfigured in between, so its marks are STALE
  // and must NOT be carried. We carry ONLY bad_channels (never a whole-map override), and skip an
  // empty map so a no-op carry stays byte-identical to a hand-entered/blank day.
  const carriedBadChannels: Record<string, number[]> =
    carryFrom && carryFrom.configurationVersion === latestVersion
      ? getDayBadChannelOverrides(carryFrom)
      : {};
  const deviceOverrides =
    Object.keys(carriedBadChannels).length > 0
      ? { bad_channels: structuredClone(carriedBadChannels) }
      : undefined;

  // Task carry-forward by SHAPE: a catalog source day carries its `taskInstances` (references into
  // the shared animal task-type catalog), with NO inline `tasks`; a legacy inline source carries its
  // `tasks`. A new (no-carry) day starts empty. Without this, carry-forward / Duplicate Day of a
  // migrated v3 day (taskInstances, no tasks) silently produced a blank-task day.
  const carriedInstances = carryFrom ? getDayTaskInstances(carryFrom) : null;
  const taskCarry =
    carriedInstances !== null
      ? { tasks: [], taskInstances: structuredClone(carriedInstances) }
      : { tasks: carryFrom ? structuredClone(getDayTasks(carryFrom)) : [] };

  return {
    id: dayId,
    animalId,
    date,
    experimentDate: formatExperimentDate(date),
    session: {
      // Always date-derived from the caller — never carried.
      session_id: session.session_id,
      session_description: session.session_description,
      // Prefer the caller's value when defined, else the carried value (else undefined).
      experiment_description:
        session.experiment_description !== undefined
          ? session.experiment_description
          : carryFrom?.session?.experiment_description,
      weight: session.weight !== undefined ? session.weight : carryFrom?.session?.weight,
    },
    keywords: carryFrom ? structuredClone(getDayKeywords(carryFrom)) : [],
    ...taskCarry,
    behavioral_events: carryFrom ? structuredClone(getDayBehavioralEvents(carryFrom)) : [],
    // Session-specific — never carried.
    associated_files: [],
    associated_video_files: [],
    // `carryTechnical` truthy ⇒ `carryFrom` is a non-null record (the non-null assertion is a
    // type-level no-op; the runtime guard is `carryTechnical` itself).
    technical: carryTechnical ? structuredClone(carryFrom!.technical) : defaultTechnical,
    // Only present when guarded bad-channel carry produced a non-empty map (see above); a blank
    // day omits the key entirely so it stays byte-identical to today's output.
    ...(deviceOverrides ? { deviceOverrides } : {}),
    // Data folder carries forward unconditionally (it is stable across a block of days — unlike the
    // date-derived filenames, which never carry). Off-export, so this can't move a baseline. The key
    // stays ABSENT when the source has none, keeping a no-carry/blank day's persisted shape unchanged.
    ...(carryFrom?.dataFolder !== undefined ? { dataFolder: carryFrom.dataFolder } : {}),
    // `state.badChannelRemovalAcks` (off-export acknowledgments of deliberate bad-channel
    // un-marks) is intentionally ABSENT on a fresh day: the monotonicity helpers and the
    // acknowledge repair command treat an absent container as "no acks" and create it on demand
    // via `applyDayUpdates`'s `state` deep-merge. Keeping it absent leaves a new day's persisted
    // shape unchanged. `mergeDayMetadata` never reads `state`, so it is invisible to the export.
    state: {
      draft: true,
      validated: false,
      exported: false,
    },
    created: now,
    lastModified: now,
    configurationVersion: latestVersion,
  };
}

/**
 * Apply partial updates to a day and return the next day record. A `session` merge guards a
 * malformed CURRENT session (a corrupt import can persist `session` as a scalar/array) to a
 * record before spreading, so `{...'corrupt'}` can't scatter char-indexed keys — the
 * resetDaySession repair relies on this to write a clean session over a malformed one.
 *
 * @param day - The current day record.
 * @param updates - Partial updates; recognized keys: `session` (deep-merged, with the
 *   malformed-guard above), `technical` (deep-merged), `state` (deep-merged), `deviceOverrides`
 *   (normalized), and the replace-on-`!== undefined` collections `tasks`, `taskInstances`,
 *   `behavioral_events`, `associated_files`, `associated_video_files`, `fs_gui_yamls`, `keywords`,
 *   `cameras_used`, plus `configurationVersion`, plus `data_acq_device_name` (the per-day
 *   recording-system choice — the one key matched by a PRESENCE check rather than `!== undefined`,
 *   so clearing it to `undefined` to revert to the animal default persists instead of being
 *   silently dropped). Note: setting `configurationVersion` here re-pins the day but does NOT
 *   eagerly reconcile snapshots' `appliedToDays` — `reconcileAppliedToDays` derives the
 *   trustworthy view from each day's version.
 * @param now - Timestamp to stamp `lastModified`.
 * @returns The next day record (deep-cloned; input not mutated).
 */
export function applyDayUpdates(day: Day, updates: DayUpdates, now: string): Day {
  const updated = structuredClone(day);

  if (updates.session) {
    const currentSession =
      updated.session !== null &&
      typeof updated.session === 'object' &&
      !Array.isArray(updated.session)
        ? updated.session
        : {};
    updated.session = { ...currentSession, ...updates.session } as SessionMetadata;
  }
  if (updates.tasks !== undefined) {
    updated.tasks = updates.tasks;
  }
  // Task-type catalog (Phase 8C): the day's ordered references into the animal `taskTypes` catalog,
  // read by `mergeDayMetadata`'s `resolveDayTasks`. Without this branch a Tasks & Epochs edit (pick /
  // order / assign epochs) would be silently dropped, exactly like the other day-owned collections.
  if (updates.taskInstances !== undefined) {
    updated.taskInstances = updates.taskInstances;
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
  // FsGUI protocol files are a day-owned collection the export merge reads; without this
  // branch a write (including the resetDayCollection repair) would be silently dropped.
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
    // Guard a malformed CURRENT state (a corrupt import can persist `state` as a scalar/array):
    // spreading a string would scatter char-indexed keys. Normalize to a record first so the
    // update writes clean draft/validated/exported flags over the corruption, not on top of it.
    const currentState =
      updated.state !== null && typeof updated.state === 'object' && !Array.isArray(updated.state)
        ? updated.state
        : {};
    updated.state = { ...currentState, ...updates.state } as DayState;
  }
  // Probe-reconfiguration: point this day at a different snapshot version. Setting it here
  // does NOT eagerly reconcile snapshots' `appliedToDays`; `reconcileAppliedToDays` derives
  // the trustworthy view from each day's version.
  if (updates.configurationVersion !== undefined) {
    updated.configurationVersion = updates.configurationVersion;
  }
  if (updates.keywords !== undefined) {
    updated.keywords = updates.keywords;
  }
  // Per-day recording-system selection (`day.data_acq_device_name`, read by `mergeDayMetadata`).
  // PRESENCE check, NOT `!== undefined`: the "Default" option clears back to the animal default by
  // writing `data_acq_device_name: undefined`, and that clear MUST persist (a `!== undefined` guard
  // would silently drop it, leaving the day pinned to a stale system). This is the one allow-list
  // key that supports clear-to-undefined.
  if ('data_acq_device_name' in updates) {
    updated.data_acq_device_name = updates.data_acq_device_name;
  }
  // Explicit per-day "cameras used" set (UNIONed with the inferred task/video/fs-gui references by
  // `referencedCameraKeys`). `!== undefined` like the other collections — it is cleared to `[]`,
  // never to undefined. Absent for all existing data (the baseline-safe default), so the export
  // stays byte-identical when no checklist additions are made.
  if (updates.cameras_used !== undefined) {
    updated.cameras_used = updates.cameras_used;
  }
  // Day-level data folder (off-export). `!== undefined` so emptying the field to '' persists (the
  // user explicitly cleared it); absent for all existing data, so the persisted shape is additive
  // and `mergeDayMetadata` never reads it — the exported YAML is byte-identical.
  if (updates.dataFolder !== undefined) {
    updated.dataFolder = updates.dataFolder;
  }

  updated.lastModified = now;
  return updated;
}
