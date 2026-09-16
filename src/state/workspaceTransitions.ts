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
import { continuesHardware, hardwareIdentity } from '../domain/hardwareContinuity';
import { changedTaskContext } from '../domain/copiedTaskContext';
import { RIG_FALLBACK } from '../domain/rigConstants';

import { formatExperimentDate } from './workspaceUtils';
import {
  getAnimalDevices,
  getAnimalNtrodeMaps,
  getProbeNtrodeMaps,
  getAnimalTaskTypes,
  getAnimalExperimenters,
  getConfigHistory,
  getDayTasks,
  getDayTaskInstances,
  getDayKeywords,
  getDayBehavioralEvents,
  getDayBadChannelOverrides,
  getDayDataAcqDeviceName,
  getDaySession,
} from './workspaceSelectors';
import { selectConfigurationForDate } from '../domain/configurationSelection';
import { stripTaskContext } from './taskCatalog';
import { deriveDataFolderForDate } from '../domain/dayCarryPolicy';
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
  DayProvenance,
  DayFactSource,
  ExportReceipt,
} from './workspaceTypes';

/**
 * Partial-update payload accepted by {@link applyAnimalUpdates}. Each recognized key is applied
 * only when present (see the function for the exact present-vs-truthy semantics); `optogenetics`
 * accepts an explicit `null` (the editor's "disable" sentinel).
 */
export interface AnimalUpdates {
  recordingModalities?: Animal['recordingModalities'];
  subject?: Partial<SubjectMetadata>;
  experimenters?: Partial<ExperimenterInfo>;
  devices?: Partial<DeviceConfiguration>;
  cameras?: Camera[];
  data_acq_device?: DataAcqDevice[];
  technicalDefaults?: Partial<TechnicalDefaults>;
  behavioral_events?: BehavioralEvent[];
  taskTypes?: TaskType[];
  taskTemplateDefaults?: { sleep?: string; run?: string };
  optogenetics?: OptogeneticsConfig | null;
  optogeneticsDraft?: OptogeneticsConfig | null;
  recordingSystemReviewed?: string;
  experiment_description?: string;
}

/** `{ date, description, devices }` for a new configuration snapshot; `devices` is normalized. */
export interface ConfigSnapshotInput {
  /** Explicit physical continuity choice; omitted preserves the existing action contract. */
  failurePolicy?: 'same-hardware' | 'replacement';
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
  /** The day's actual team (+ lab / institution). */
  experimenters?: ExperimenterInfo;
  /** The day's optogenetics setup snapshot (`null` = none). PRESENCE-gated: an explicit `null` persists. */
  optogenetics?: OptogeneticsConfig | null;
  /** Off-export provenance (deep-merged). */
  provenance?: Partial<DayProvenance>;
  /** The last download receipt (off-export; replaced). */
  exportReceipt?: ExportReceipt;
}

/**
 * How an update key decides it was "given". Declared per key (below) rather than re-decided per
 * `if` branch — this file has twice shipped a silently-dropped write because a key had no branch.
 *   - `defined` — `!== undefined`: `null`, `[]` and `''` are real writes (clear-to-empty persists).
 *   - `nonNull` — `!= null`: a `null` is ignored (the pre-table truthiness gate for these arrays).
 *   - `present` — `key in updates`: an explicit `undefined` is itself a write (clears the field).
 */
type UpdateGate = 'defined' | 'nonNull' | 'present';

const isPlainRecordValue = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value);

function isGiven(updates: object, key: PropertyKey, gate: UpdateGate): boolean {
  if (gate === 'present') return key in updates;
  const value = (updates as Record<PropertyKey, unknown>)[key];
  return gate === 'defined' ? value !== undefined : value != null;
}

/**
 * Day keys whose update REPLACES the field wholesale (no merge, no normalization). Every other
 * `DayUpdates` key is handled by name in {@link applyDayUpdates}; the type assertion after the
 * table makes "added a field to `DayUpdates` but forgot to route it" a typecheck failure.
 */
export const DAY_REPLACE_KEYS = {
  tasks: 'defined',
  // The day's ordered references into the animal `taskTypes` catalog (read by `mergeDayMetadata`).
  taskInstances: 'defined',
  behavioral_events: 'defined',
  associated_files: 'defined',
  associated_video_files: 'defined',
  // FsGUI protocol files: a day-owned collection the export merge reads.
  fs_gui_yamls: 'defined',
  // Probe-reconfiguration: points the day at another snapshot version. Snapshots' `appliedToDays`
  // are NOT eagerly reconciled here; `reconcileAppliedToDays` derives them from each day's version.
  configurationVersion: 'defined',
  keywords: 'defined',
  // Per-day recording-system selection. PRESENCE, not `defined`: the "Default" option clears back
  // to the animal default by writing `data_acq_device_name: undefined`, and that clear MUST persist.
  data_acq_device_name: 'present',
  // Explicit per-day "cameras used" (UNIONed with inferred refs by `referencedCameraKeys`). Cleared
  // to `[]`, never undefined; absent for all existing data so the export stays byte-identical.
  cameras_used: 'defined',
  // Off-export data folder; `''` persists (the user explicitly cleared it).
  dataFolder: 'defined',
  // The day-owned team copy (the exported experimenter list).
  experimenters: 'defined',
  // The day-owned opto snapshot: `null` ("none used") is a real write, so PRESENCE.
  optogenetics: 'present',
  // The last download receipt.
  exportReceipt: 'defined',
} as const satisfies Partial<Record<keyof DayUpdates, UpdateGate>>;

/** Day keys `applyDayUpdates` merges/normalizes by name rather than replacing. */
const DAY_MERGED_KEYS = ['session', 'technical', 'deviceOverrides', 'state', 'provenance'] as const;

// Every `DayUpdates` key is either replaced by the table or merged by name — or this fails to compile.
type UnroutedDayKey = Exclude<keyof DayUpdates, keyof typeof DAY_REPLACE_KEYS | (typeof DAY_MERGED_KEYS)[number]>;
true satisfies [UnroutedDayKey] extends [never] ? true : never;

/** Animal keys whose update REPLACES the field wholesale. See {@link DAY_REPLACE_KEYS}. */
export const ANIMAL_REPLACE_KEYS = {
  recordingModalities: 'defined',
  experiment_description: 'defined',
  cameras: 'nonNull',
  // Animal-level behavioral events are an editable reference; the exported source is the day's.
  behavioral_events: 'nonNull',
  // The define-once task-type catalog day `taskInstances` reference. `defined` so a delete-last-type
  // (`taskTypes: []`) persists, never a silent no-op.
  taskTypes: 'defined',
  taskTemplateDefaults: 'defined',
  // `defined` so an explicit `null` CLEARS opto (the editor's disable sentinel).
  optogenetics: 'defined',
  optogeneticsDraft: 'defined',
  recordingSystemReviewed: 'defined',
} as const satisfies Partial<Record<keyof AnimalUpdates, UpdateGate>>;

/**
 * Merge a partial subject onto the current one, treating an explicit `undefined` value as a
 * REMOVAL of that key rather than as "no change".
 *
 * A subject fact can legitimately become unknown again — a date of birth entered from the wrong
 * cage card, a baseline weight that was never actually measured. The editor shows a blank field for
 * that, so the record must not keep the old value: every day's export reads this one subject, and a
 * stale value behind a blank field is a valid-but-WRONG export. Removing the key (rather than
 * storing `undefined`) also keeps the in-memory shape equal to the persisted JSON one, which drops
 * undefined-valued keys — otherwise `'weight' in subject` would flip across a reload.
 *
 * A key the payload does not mention is untouched, so partial writes (the profile dialog saves only
 * its changed fields) keep working exactly as before.
 *
 * @param current - The animal's current subject.
 * @param updates - The partial subject payload.
 * @returns The merged subject, without any key the payload set to `undefined`.
 */
function mergeSubject(
  current: SubjectMetadata,
  updates: Partial<SubjectMetadata>
): SubjectMetadata {
  return withoutUnknownFacts({ ...current, ...updates }) as SubjectMetadata;
}

/**
 * Drop every key whose value is `undefined` — the shared "an unknown fact is an ABSENT key, not a
 * present-but-undefined one" normalization. Used by {@link mergeSubject} and by `createAnimal`, so
 * a subject built by the shared creation glue lands the same way whether it is created or edited.
 *
 * @param record - A subject-shaped record.
 * @returns A new record without the `undefined`-valued keys.
 */
export function withoutUnknownFacts<T extends object>(record: T): T {
  const out = { ...record } as Record<string, unknown>;
  for (const key of Object.keys(out)) {
    if (out[key] === undefined) delete out[key];
  }
  return out as T;
}

/** Animal keys `applyAnimalUpdates` merges/normalizes/routes by name rather than replacing. */
const ANIMAL_MERGED_KEYS = ['subject', 'experimenters', 'devices', 'data_acq_device', 'technicalDefaults'] as const;

type UnroutedAnimalKey = Exclude<keyof AnimalUpdates, keyof typeof ANIMAL_REPLACE_KEYS | (typeof ANIMAL_MERGED_KEYS)[number]>;
true satisfies [UnroutedAnimalKey] extends [never] ? true : never;

/** Apply every table-driven replacement whose key was given. */
function applyReplacements<T extends object>(
  target: T,
  updates: Partial<T>,
  table: Partial<Record<keyof T, UpdateGate>>
): void {
  for (const [key, gate] of Object.entries(table) as Array<[keyof T, UpdateGate]>) {
    if (isGiven(updates, key, gate)) target[key] = updates[key] as T[keyof T];
  }
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
 * @param updates - Partial updates. `subject` merges with removal semantics (an explicit
 *   `undefined` DELETES that fact — see {@link mergeSubject}); `experimenters` / `technicalDefaults` merge,
 *   `devices` normalizes (and mirrors into the latest snapshot), `data_acq_device` routes onto
 *   `devices.data_acq_device`; every other key replaces per {@link ANIMAL_REPLACE_KEYS}.
 * @param now - Timestamp to stamp `lastModified`.
 * @returns The next animal record (deep-cloned; input not mutated).
 */
export function applyAnimalUpdates(animal: Animal, updates: AnimalUpdates, now: string): Animal {
  const updated = structuredClone(animal);

  if (updates.subject) {
    updated.subject = mergeSubject(updated.subject, updates.subject);
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
  applyReplacements(updated, updates as Partial<Animal>, ANIMAL_REPLACE_KEYS);

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
  const previous = getConfigHistory(animal).slice(-1)[0];
  if (config.failurePolicy === 'same-hardware' && (!previous || hardwareIdentity(previous.devices) !== hardwareIdentity(config.devices))) {
    throw new Error('Keeping failed channels requires the same probe types, ntrode IDs and channel mapping. Choose replacement hardware if these changed.');
  }
  const created = version ?? nextConfigurationVersion(getConfigHistory(animal));
  const withSnapshot = addConfigurationSnapshotToAnimal(animal, config, now, created);
  const applied = applyConfigurationForwardToAnimal(withSnapshot, days, created, dayIds, now, ownerKey);
  const snapshot = getConfigHistory(applied.animal).find((entry) => entry.version === created)!;
  if (config.failurePolicy) applied.animal.devices = normalizeDevices({ ...getAnimalDevices(applied.animal), ...snapshot.devices });
  if (config.failurePolicy === 'same-hardware') snapshot.continuesHardwareFromVersion = previous.version;
  if (config.failurePolicy === 'replacement') {
    getProbeNtrodeMaps(snapshot.devices).forEach((map) => { map.bad_channels = []; });
    getAnimalNtrodeMaps(applied.animal).forEach((map) => { map.bad_channels = []; });
    Object.entries(applied.days).forEach(([id, moved]) => {
      if (moved === days[id] || moved.configurationVersion !== created) return;
      applied.days[id] = { ...moved, deviceOverrides: { ...moved.deviceOverrides, bad_channels: {} } };
    });
  }
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

/** Options for {@link createDayRecord}. */
export interface CreateDayRecordOptions {
  /** A prior day record to seed day-owned content from, or null (blank day). */
  carryFrom?: Day | null;
  /**
   * Pin this configuration version instead of the one effective on `date` (a duplicate-day copies
   * its source's pin; an import pins the inferred version). When given, the choice is recorded as
   * `copied` / `import` provenance and treated as confirmed only if the snapshot covers the date.
   */
  configurationVersion?: number;
  /** Provenance source for an explicitly supplied version (default `copied`). */
  configurationSource?: 'copied' | 'import' | 'explicit';
}

/**
 * Build a new recording-day record.
 *
 * **Configuration pin (finding F2):** the version whose effective date most recently precedes the
 * recording date (`selectConfigurationForDate`), never simply the newest. A date before every known
 * effective date is pinned to the earliest version with `provenance.configuration.confirmed: false`
 * — an export blocker until the user confirms the setup or extends its effective date.
 *
 * **Carry policy (finding F7)** when `carryFrom` is supplied — deep-cloned so the new record never
 * aliases the source:
 *  - copied: tasks (by shape: catalog `taskInstances` or legacy inline `tasks`), behavioral_events,
 *    keywords, technical, session.experiment_description, the chosen recording system
 *    (`data_acq_device_name`), the optogenetics snapshot;
 *  - animal default: experimenters, so a one-day exception does not carry forward;
 *  - NOT copied: `session.weight` (a measurement — shown as a dated suggestion instead),
 *    `session_id` / `session_description` (date-derived, from the caller), associated_files,
 *    associated_video_files, fs_gui_yamls, cameras_used, and every review/export state flag;
 *  - derived: `dataFolder` — the source date token rewritten to the new date, an undated folder
 *    copied, a folder dated for some OTHER day left blank (`deriveDataFolderForDate`);
 *  - guarded: `deviceOverrides.bad_channels` — carried ONLY when the source pins the SAME version
 *    the new day pins (marks are ntrode-keyed; a reconfiguration in between makes them stale).
 * Without `carryFrom`, the team / opto / experiment description are copied from the animal's
 * defaults. Every copied field's source is recorded in `provenance`.
 *
 * @param animal - The owning animal (defaults, technicalDefaults, configuration history).
 * @param animalId - The owning animal id.
 * @param dayId - The (already-validated) new day id.
 * @param date - Recording date, YYYY-MM-DD.
 * @param session - Session metadata (session_id, session_description, optional weight/description).
 * @param now - Timestamp for created/lastModified (the metadata-ENTRY time).
 * @param options - Carry source and/or an explicit configuration pin.
 * @returns The new day record.
 */
export function createDayRecord(
  animal: Animal,
  animalId: string,
  dayId: string,
  date: string,
  session: SessionMetadata,
  now: string,
  options: CreateDayRecordOptions | Day | null = null
): Day {
  // Back-compat: the 7th argument used to be the carry source itself (a day record). An options
  // bag is recognized by its own keys; anything else object-shaped is a source day.
  const OPTION_KEYS = ['carryFrom', 'configurationVersion', 'configurationSource'];
  const isOptionsBag = (value: object): value is CreateDayRecordOptions =>
    Object.keys(value).every((key) => OPTION_KEYS.includes(key));
  const opts: CreateDayRecordOptions =
    options && typeof options === 'object'
      ? isOptionsBag(options)
        ? options
        : { carryFrom: options as Day }
      : {};
  const carryFrom = opts.carryFrom ?? null;
  const fields: Record<string, DayFactSource> = {};

  // --- Configuration pin: by recording date, or the caller's explicit version. ---
  const history = getConfigHistory(animal);
  const byDate = selectConfigurationForDate(animal, date);
  let pinnedVersion: number;
  let configurationSource: DayProvenance['configuration']['source'];
  let confirmed: boolean;
  if (opts.configurationVersion != null) {
    pinnedVersion = opts.configurationVersion;
    configurationSource = opts.configurationSource ?? 'copied';
    const snapshot = history.find((c) => c.version === pinnedVersion);
    confirmed = configurationSource === 'explicit' || (snapshot ? snapshot.date <= date : false);
  } else if (byDate.version != null) {
    pinnedVersion = byDate.version;
    configurationSource = 'effective-date';
    confirmed = byDate.covered;
  } else {
    // No usable history (a brand-new animal without electrodes yet): the legacy latest-pin (0 when
    // empty) keeps the record shape stable; `unpinned_configuration` / resolveDayConfig gate it.
    pinnedVersion = history.length > 0 ? history[history.length - 1].version : 0;
    configurationSource = 'latest';
    confirmed = true;
  }

  // Animal-defaults technical seed: the no-carry path, and the fallback when carryFrom has no
  // technical record. Kept verbatim so a blank day stays byte-identical to today's output.
  const defaultTechnical = {
    // Seeded from the animal's technical DEFAULTS (overridable per day); falls back to
    // the standard values when no defaults are set.
    times_period_multiplier: animal.technicalDefaults?.times_period_multiplier ?? 1.5,
    raw_data_to_volts: animal.technicalDefaults?.raw_data_to_volts ?? RIG_FALLBACK.raw_data_to_volts,
    default_header_file_path: '',
    units: undefined,
  };
  const carryTechnical =
    carryFrom &&
    carryFrom.technical !== null &&
    typeof carryFrom.technical === 'object' &&
    !Array.isArray(carryFrom.technical);

  // Bad-channel carry-forward, guarded by config version (see the function doc).
  const carriedBadChannels: Record<string, number[]> =
    carryFrom && continuesHardware(history, pinnedVersion, carryFrom.configurationVersion)
      ? getDayBadChannelOverrides(carryFrom)
      : {};
  const deviceOverrides =
    Object.keys(carriedBadChannels).length > 0
      ? { bad_channels: structuredClone(carriedBadChannels) }
      : undefined;
  if (deviceOverrides) fields['deviceOverrides.bad_channels'] = 'copied';

  // Task carry-forward by SHAPE: a catalog source day carries its `taskInstances` (references into
  // the shared animal task-type catalog), with NO inline `tasks`; a legacy inline source carries its
  // `tasks`. A new (no-carry) day starts empty.
  //
  // What carries is the REFERENCE — which task types ran, in which epochs — not the prior day's own
  // recorded CONTEXT. `task_environment` / `camera_id` on an instance are that day's facts (where it
  // ran, what filmed it), so a new day defaults them from the task type instead: copying them would
  // make today export a room nobody chose for it, and would outlive a later change to the default
  // (F3: occurrences default their context at creation).
  const carriedInstances = carryFrom ? getDayTaskInstances(carryFrom) : null;
  const taskCarry =
    carriedInstances !== null
      ? { tasks: [], taskInstances: stripTaskContext(carriedInstances) }
      : { tasks: carryFrom ? structuredClone(getDayTasks(carryFrom)) : [] };
  if (carryFrom) fields.tasks = 'copied';

  // --- Stable team default and recording-specific opto / experiment context. ---
  // Experimenters are a stable animal default. A one-day exception must not become the
  // default for subsequent recordings merely because their epoch structure was copied.
  const experimenters: ExperimenterInfo = structuredClone(getAnimalExperimenters(animal));
  fields.experimenters = 'animal-default';
  const optogenetics: OptogeneticsConfig | null =
    carryFrom && 'optogenetics' in carryFrom
      ? structuredClone(carryFrom.optogenetics ?? null)
      : structuredClone(animal.optogenetics ?? null);
  fields.optogenetics = carryFrom && 'optogenetics' in carryFrom ? 'copied' : 'animal-default';
  let experimentDescription: string;
  if (session.experiment_description !== undefined) {
    experimentDescription = session.experiment_description;
    fields['session.experiment_description'] = 'entered';
  } else if (carryFrom?.session?.experiment_description) {
    experimentDescription = carryFrom.session.experiment_description;
    fields['session.experiment_description'] = 'copied';
  } else {
    experimentDescription = animal.experiment_description ?? '';
    fields['session.experiment_description'] = 'animal-default';
  }

  // --- Recording system: preserve the source day's rig choice (finding F7). ---
  const carriedRig = carryFrom ? getDayDataAcqDeviceName(carryFrom) : undefined;
  if (carriedRig) fields.data_acq_device_name = 'copied';

  // --- Data folder: date-aware derivation, never a silent copy of another day's dated folder. ---
  const folder = carryFrom
    ? deriveDataFolderForDate(carryFrom.dataFolder, String(carryFrom.date ?? ''), date)
    : { kind: 'none' as const, dataFolder: undefined };
  if (folder.kind === 'derived') fields.dataFolder = 'derived';
  if (folder.kind === 'copied') fields.dataFolder = 'copied';

  const provenance: DayProvenance = {
    origin: carryFrom ? 'copy' : 'blank',
    taskContextReset: carriedInstances ? changedTaskContext(carriedInstances, getAnimalTaskTypes(animal)) : undefined,
    enteredAt: now,
    copiedFromDayId: carryFrom ? String(carryFrom.id) : null,
    copiedFromDate: carryFrom ? String(carryFrom.date ?? '') || null : null,
    configuration: { source: configurationSource, confirmed },
    fields,
  };

  return {
    id: dayId,
    animalId,
    date,
    experimentDate: formatExperimentDate(date),
    session: {
      // Always date-derived from the caller — never carried.
      session_id: session.session_id,
      session_description: session.session_description,
      experiment_description: experimentDescription,
      // A MEASUREMENT: only the caller's explicit value, never the source day's.
      ...(session.weight !== undefined ? { weight: session.weight } : {}),
    },
    experimenters,
    optogenetics,
    keywords: carryFrom ? structuredClone(getDayKeywords(carryFrom)) : [],
    ...taskCarry,
    behavioral_events: carryFrom ? structuredClone(getDayBehavioralEvents(carryFrom)) : [],
    // Session-specific — never carried.
    associated_files: [],
    associated_video_files: [],
    // `carryTechnical` truthy ⇒ `carryFrom` is a non-null record (the non-null assertion is a
    // type-level no-op; the runtime guard is `carryTechnical` itself).
    technical: carryTechnical ? structuredClone(carryFrom!.technical) : defaultTechnical,
    ...(carriedRig ? { data_acq_device_name: carriedRig } : {}),
    // Only present when guarded bad-channel carry produced a non-empty map (see above); a blank
    // day omits the key entirely so it stays byte-identical to today's output.
    ...(deviceOverrides ? { deviceOverrides } : {}),
    ...(folder.dataFolder !== undefined ? { dataFolder: folder.dataFolder } : {}),
    // `state.badChannelRemovalAcks` (off-export acknowledgments of deliberate bad-channel
    // un-marks) is intentionally ABSENT on a fresh day: the monotonicity helpers and the
    // acknowledge repair command treat an absent container as "no acks" and create it on demand
    // via `applyDayUpdates`'s `state` deep-merge. `mergeDayMetadata` never reads `state`.
    state: {
      draft: true,
      validated: false,
      exported: false,
      validationDeferred: carryFrom == null,
    },
    provenance,
    created: now,
    lastModified: now,
    configurationVersion: pinnedVersion,
  };
}

/**
 * Re-copy the carry-forward fields of an EXISTING day from a different source day ("Start from a
 * different day"). Applies the same field policy as creation — stable definitions/references are
 * copied (tasks, DIO, keywords, technical, team, opto snapshot, rig, derived data folder, and the
 * experiment description ONLY when the day has none) while the day's own facts are kept: session
 * id / descriptions, the measured weight, files, videos, FsGUI protocols, review/export state, and
 * the configuration pin
 * (the source's version never overrides the date-selected probe setup; bad-channel marks are
 * re-copied only when the versions match). Provenance records the new source.
 *
 * @param animal - The owning animal.
 * @param day - The day being re-seeded.
 * @param source - The day to copy from.
 * @param now - Timestamp to stamp.
 * @returns The next day record.
 */
export function reseedDayFromSource(animal: Animal, day: Day, source: Day, now: string): Day {
  const seeded = createDayRecord(
    animal,
    day.animalId,
    day.id,
    day.date,
    { session_id: getDaySession(day).session_id ?? '', session_description: getDaySession(day).session_description ?? '' },
    now,
    { carryFrom: source, configurationVersion: day.configurationVersion, configurationSource: 'explicit' }
  );
  const seededProvenance = seeded.provenance as DayProvenance;
  const keepsDescription = Boolean(getDaySession(day).experiment_description);
  // A kept description keeps its own provenance; only re-copied fields take the source's.
  const seededFields: Record<string, DayFactSource> = { ...(seededProvenance.fields ?? {}) };
  if (day.experimenters) delete seededFields.experimenters;
  if (keepsDescription) delete seededFields['session.experiment_description'];
  const next: Day = {
    ...structuredClone(day),
    tasks: seeded.tasks,
    ...(seeded.taskInstances ? { taskInstances: seeded.taskInstances } : {}),
    behavioral_events: seeded.behavioral_events,
    keywords: seeded.keywords,
    technical: seeded.technical,
    experimenters: structuredClone(day.experimenters ?? seeded.experimenters),
    optogenetics: seeded.optogenetics,
    // The day's own recorded description is kept (the dialog promises "keeps this day's
    // descriptions"); only an EMPTY one is filled from the source.
    session: {
      ...getDaySession(day),
      experiment_description: getDaySession(day).experiment_description || seeded.session.experiment_description,
    },
    ...(seeded.data_acq_device_name ? { data_acq_device_name: seeded.data_acq_device_name } : {}),
    ...(seeded.dataFolder !== undefined ? { dataFolder: seeded.dataFolder } : {}),
    ...(seeded.deviceOverrides ? { deviceOverrides: seeded.deviceOverrides } : {}),
    provenance: {
      ...(day.provenance ?? seededProvenance),
      enteredAt: day.provenance?.enteredAt ?? seededProvenance.enteredAt,
      origin: 'copy',
      taskContextReset: seededProvenance.taskContextReset,
      copiedFromDayId: source.id,
      copiedFromDate: String(source.date ?? '') || null,
      configuration: day.provenance?.configuration ?? seededProvenance.configuration,
      fields: { ...(day.provenance?.fields ?? {}), ...seededFields },
    },
    lastModified: now,
  };
  // A taskInstances-less legacy source must not leave a stale catalog reference behind.
  if (!seeded.taskInstances) delete next.taskInstances;
  return next;
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
  const clearsValidationDeferral = Object.keys(updates).some((key) => key !== 'state');

  if (updates.session) {
    const currentSession =
      updated.session !== null &&
      typeof updated.session === 'object' &&
      !Array.isArray(updated.session)
        ? updated.session
        : {};
    updated.session = { ...currentSession, ...updates.session } as SessionMetadata;
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
  if (clearsValidationDeferral && updated.state) {
    updated.state.validationDeferred = false;
  }
  if (updates.provenance) {
    const current = isPlainRecordValue(updated.provenance) ? updated.provenance : ({} as DayProvenance);
    updated.provenance = {
      ...current,
      origin: current.origin ?? (current.configuration?.source === 'import' || Object.values(current.fields ?? {}).includes('import') ? 'import' : current.copiedFromDayId ? 'copy' : 'blank'),
      ...updates.provenance,
      configuration: { ...current.configuration, ...updates.provenance.configuration } as DayProvenance['configuration'],
      fields: { ...current.fields, ...updates.provenance.fields },
    };
  }
  // Entering a weight IS the correction the `weight_from_baseline` review asks for: the value is
  // now the scientist's, so the flag (and the migration source) no longer apply.
  if (updates.session && updates.session.weight !== undefined && isPlainRecordValue(updated.provenance)) {
    const review = Array.isArray(updated.provenance.review) ? updated.provenance.review : [];
    if (review.includes('weight_from_baseline')) {
      updated.provenance = {
        ...updated.provenance,
        review: review.filter((flag) => flag !== 'weight_from_baseline'),
        fields: { ...updated.provenance.fields, 'session.weight': 'entered' },
      };
    }
  }
  applyReplacements(updated, updates as Partial<Day>, DAY_REPLACE_KEYS);

  updated.lastModified = now;
  // A receipt written in this update describes THIS state of the day: stamp it with the same
  // `lastModified` so the freshness fast path (`exportReceipt.dayLastModified === day.lastModified`)
  // holds until the next real edit. The content hash stays authoritative.
  if (updates.exportReceipt && isPlainRecordValue(updated.exportReceipt)) {
    updated.exportReceipt = { ...updated.exportReceipt, dayLastModified: now };
  }
  return updated;
}
