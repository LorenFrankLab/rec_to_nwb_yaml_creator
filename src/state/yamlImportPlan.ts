/**
 * @fileoverview The PURE reconciliation core of YAML import: turn a SET of parsed
 * flat NWB YAML files into an import PLAN the executor can write into the workspace
 * store. No store coupling, no UI — `planImport` is a pure function of its inputs.
 *
 * This consumes {@link module:state/yamlImport.decomposeYaml} (the inverse of the
 * export merge) to attribute each file's fields back to animal-level facts, day-owned
 * content, and an electrode configuration. It then:
 *   - derives each file's recording date (the flat model carries none — see
 *     {@link extractRecordingDate}),
 *   - groups files by subject into per-animal plans,
 *   - infers configuration VERSIONS within a subject (runs of files with the same electrode
 *     config, in date order),
 *   - resolves animal-level facts with an explicit default policy, surfacing every
 *     disagreement as a `divergence` flag (never a silent pick),
 *   - flags conflicts with animals already in the workspace (never overwrites silently).
 *
 * The executor that writes a plan into the live store is {@link module:state/yamlImportApply}.
 *
 * @module state/yamlImportPlan
 */

import { decomposeYaml } from './yamlImport';
import type { DecomposeResult } from './yamlImport';
import { findIdentityDivergence, valuesEqual } from './identityDivergence';
import type { IdentityRegistryEntry } from './identityDivergence';
import { getAnimalCameras, getAnimalSubject, getDataAcqDevices } from './workspaceSelectors';
import type { DataAcqDevice } from './workspaceTypes';
import type { ValidationModel } from '../validation/issueTypes';
import { isBlockingIssue } from '../validation/issueTypes';
import { canonicalJson } from '../utils/canonicalJson';
import { importTaskDescriptionDivergences } from '../domain/taskIdentity';
import { remapCameraRefs } from './cameraUsage';
import {
  allocateSplitName,
  analyzeCameraCalibrations,
  applyCameraConflictResolutions,
  describeCameraConflict,
  isSplitNameOf,
} from './cameraCalibrationConflicts';
import type {
  CameraCalibrationConflict,
  CameraConflictResolution,
} from './cameraCalibrationConflicts';

export type {
  CameraCalibrationCandidate,
  CameraCalibrationConflict,
  CameraConflictResolution,
} from './cameraCalibrationConflicts';

/** A single surfaced disagreement across a subject's files. */
export interface Divergence {
  /** The diverging field (e.g. `cameras`, `subject`). */
  field: string;
  /** A human-readable description of the disagreement. */
  detail: string;
  /**
   * The resolution of an EXISTING animal the note is about, when it is about only one: `add`
   * compares the files with the animal, `replace` describes the files alone where that differs
   * (the animal is deleted). Absent ⇒ it holds either way.
   */
  scope?: 'add' | 'replace';
}

/** One resolved configuration version within a subject (a run of files with one electrode config). */
export interface ConfigVersion {
  /** Sequential version number (1 = the earliest run). */
  version: number;
  /** The run's first recording date — the version's effective date. */
  date: string;
  /** Display description. */
  description: string;
  /** The probe devices (electrode groups + ntrode map) for this config. */
  devices: { electrode_groups: any; ntrode_electrode_group_channel_map: any };
  /** The dates that pin this version. */
  dayDates: string[];
}

/** A decomposed + dated source file, grouped per subject. */
interface FileEntry {
  /** Source filename. */
  sourceName: string;
  /** Caller-unique identity for this file (defaults to `sourceName`); see {@link ImportPlanDay.sourceKey}. */
  sourceKey: string;
  /** ISO `YYYY-MM-DD` recording date. */
  date: string;
  /** Animal-owned facts from {@link decomposeYaml}. */
  animalFacts: Record<string, any>;
  /** Day-owned facts from {@link decomposeYaml}. */
  dayFacts: Record<string, any>;
  /** The probe configuration from {@link decomposeYaml}. */
  configuration: Record<string, any>;
  /** The existing-animal camera ids Import & Repair MAPPED this file's references onto. */
  mappedCameraIds: unknown[];
  /** The existing-animal recording-system names Import & Repair MAPPED this file's system onto. */
  mappedDataAcqDeviceNames: unknown[];
  /**
   * How this file's camera rows were rewritten by the calibration analysis (see
   * {@link module:state/cameraCalibrationConflicts}); absent when nothing was rewritten.
   */
  cameraRewrite?: {
    /**
     * The FILE-space ids whose row was RE-IDENTIFIED (split out, or routed onto an existing camera
     * of another name). Such a row means a specific camera, so it must not be short-circuited as
     * "an id the existing animal already has".
     */
    reidentifiedIds: Set<unknown>;
    /** The rows' names BEFORE the rewrite — what the file itself declared. */
    originalNames: string[];
  };
}

/** Files grouped under the first-seen spelling of a case-insensitive subject id. */
interface SubjectBatch {
  /** First-seen subject-id spelling; this becomes the planned animal id. */
  subjectId: string;
  /** Files belonging to that normalized identity. */
  entries: FileEntry[];
}

/** A subject's resolved animal-level facts (latest-date-wins) plus surfaced divergences. */
interface ResolvedAnimalFacts {
  /** Per file (by index into the date-sorted entries): that file's camera id → the catalog id, per resolution. */
  cameraIdRemaps: { add: Array<Map<unknown, unknown>>; replace: Array<Map<unknown, unknown>> };
  /** Per file: that file's recording-system name → the catalog name, per resolution. */
  dataAcqDeviceRenames: { add: Array<Map<string, string>>; replace: Array<Map<string, string>> };
  /** The rows the files bring that `existing` did not already hold (see `ImportPlanAnimal.catalogAdditions`). */
  catalogAdditions: { cameras: any[]; data_acq_device: any[] };
  subject: any;
  experimenters: any;
  optogenetics: any;
  devices: { data_acq_device: any[]; device: any };
  cameras: any[];
  /** The same-name/different-calibration conflicts and how this plan resolved them. */
  cameraConflicts: CameraCalibrationConflict[];
  /** The conflicts the `'replace'` catalog resolved (the files alone). */
  replaceCameraConflicts: CameraCalibrationConflict[];
  divergences: Divergence[];
}

/**
 * Derive a recording day's ISO date (`YYYY-MM-DD`) for an imported flat model. The flat
 * YAML carries NO date field, so it is reconstructed from naming conventions:
 *
 *  - PRIMARY: the `{mmddYYYY}_{subject}_metadata.yml` name earlier versions of the legacy
 *    form's download used, e.g. `06222023_remy_metadata.yml` → `2023-06-22`; and the
 *    `{YYYYMMDD}_{subject}...yml` convention trodes_to_nwb uses (and the app now writes, see
 *    {@link module:io/yaml.formatDeterministicFilename}), e.g. `20231108_bs28.yml` →
 *    `2023-11-08`. A name is never read both ways: a YYYYMMDD name starting 19/20 is not a
 *    valid month.
 *  - FALLBACK: a `session_id` of the form `{anything}_{YYYYMMDD}`, e.g. `remy_20230622`
 *    → `2023-06-22`.
 *  - IMPORT-REPAIR FALLBACK: `__importRepair.recording_date`, written only by the
 *    Import & Repair manual date row.
 *
 * Returns `null` when neither yields a VALID calendar date (the caller treats a dateless
 * file as unimportable with a clear reason). Shape-safe: never throws on a non-object
 * model or an odd `sourceName`.
 *
 * @param flatModel - Decoded flat YAML model.
 * @param sourceName - The source filename (used for the primary convention).
 * @returns ISO `YYYY-MM-DD`, or `null` when no valid date is derivable.
 */
export function extractRecordingDate(
  flatModel: ValidationModel,
  sourceName?: string
): string | null {
  // PRIMARY: filename {mmddYYYY}_{subject}_metadata.yml (earlier app downloads).
  if (typeof sourceName === 'string') {
    const match = sourceName.match(/^(\d{2})(\d{2})(\d{4})_.+_metadata\.ya?ml$/i);
    if (match) {
      const [, mm, dd, yyyy] = match;
      const iso = toIsoDate(yyyy, mm, dd);
      if (iso) return iso;
    }

    const ymdMatch = sourceName.match(/^(\d{4})(\d{2})(\d{2})_.+\.ya?ml$/i);
    if (ymdMatch) {
      const [, yyyy, mm, dd] = ymdMatch;
      const iso = toIsoDate(yyyy, mm, dd);
      if (iso) return iso;
    }
  }

  // FALLBACK: session_id of the form {anything}_{YYYYMMDD}.
  const sessionId =
    flatModel !== null && typeof flatModel === 'object' ? flatModel.session_id : undefined;
  if (typeof sessionId === 'string') {
    const match = sessionId.match(/_(\d{4})(\d{2})(\d{2})$/);
    if (match) {
      const [, yyyy, mm, dd] = match;
      const iso = toIsoDate(yyyy, mm, dd);
      if (iso) return iso;
    }
  }

  const manualDate =
    flatModel !== null && typeof flatModel === 'object'
      ? flatModel.__importRepair?.recording_date
      : undefined;
  if (typeof manualDate === 'string') {
    const match = manualDate.match(/^(\d{4})-(\d{2})-(\d{2})(?:T.*)?$/);
    if (match) {
      const [, yyyy, mm, dd] = match;
      const iso = toIsoDate(yyyy, mm, dd);
      if (iso) return iso;
    }
  }

  return null;
}

/**
 * The key under `__importRepair` where Import & Repair records the existing-animal camera ids the
 * user mapped a file's camera references onto (`applyImportRepairs` writes it; the planner reads it).
 */
export const IMPORT_REPAIR_MAPPED_CAMERA_IDS = 'mappedCameraIds';

/**
 * The key under `__importRepair` where Import & Repair records the existing-animal recording-system
 * names the user mapped a file's recording system onto.
 */
export const IMPORT_REPAIR_MAPPED_DATA_ACQ_NAMES = 'mappedDataAcqDeviceNames';

/**
 * The existing-animal catalog entries Import & Repair mapped this file's references onto, under one
 * `__importRepair` key. A mapped camera row keeps the FILE's name, and a mapped recording system
 * keeps the FILE's hardware, so without this record either would read as a different entry.
 *
 * @param flatModel - Decoded (repaired) flat YAML model.
 * @param key - {@link IMPORT_REPAIR_MAPPED_CAMERA_IDS} or {@link IMPORT_REPAIR_MAPPED_DATA_ACQ_NAMES}.
 * @returns The mapped values (empty when the user mapped none).
 */
function repairMappingsOf(flatModel: unknown, key: string): unknown[] {
  const marker =
    flatModel !== null && typeof flatModel === 'object'
      ? (flatModel as { __importRepair?: Record<string, unknown> }).__importRepair
      : undefined;
  const mapped = marker?.[key];
  return Array.isArray(mapped) ? mapped : [];
}

/**
 * Build a validated ISO date string from year/month/day parts, returning `null` if the
 * parts do not form a real calendar date (e.g. month 13, day 32). Round-trips through a
 * UTC Date so impossible dates (which JS would otherwise roll over) are rejected.
 *
 * @param yyyy - Four-digit year.
 * @param mm - Two-digit month.
 * @param dd - Two-digit day.
 * @returns `YYYY-MM-DD`, or `null` when invalid.
 */
function toIsoDate(yyyy: string, mm: string, dd: string): string | null {
  const year = Number(yyyy);
  const month = Number(mm);
  const day = Number(dd);
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) {
    return null;
  }
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }
  return `${yyyy}-${mm}-${dd}`;
}

/** A planned recording day for import, pinned to a resolved configuration version. */
export interface ImportPlanDay {
  /** ISO `YYYY-MM-DD` recording date. */
  date: string;
  /** Source filename (display). */
  sourceName: string;
  /**
   * The identity the caller gave this file (`sourceKey` on the input), or `sourceName` when it gave
   * none. Two selected files can share a basename; a caller that must match a planned day back to
   * the file it came from (e.g. to collect that file's accepted catalog additions) matches on this.
   */
  sourceKey: string;
  /**
   * This file's camera id → the catalog id, for each resolution, as `[from, to]` pairs. The day's
   * references below are in the FILE's own id space; {@link materializePlanDay} applies the pair
   * list for the resolution the executor is committing. Two lists because the answers differ:
   * under `'add'` an id the animal already has IS that camera (an explicit repair mapping), while
   * under `'replace'` the files are self-describing and two files' "id 0" may be two cameras.
   */
  cameraIdRemap: { add: Array<[unknown, unknown]>; replace: Array<[unknown, unknown]> };
  /**
   * This file's recording-system name → the catalog name, for each resolution, as `[from, to]`
   * pairs: a name the file shares with OTHER hardware is kept apart under a dated name (W5), and
   * `materializePlanDay` points `data_acq_device_name` at it.
   */
  dataAcqDeviceRename: { add: Array<[string, string]>; replace: Array<[string, string]> };
  /** Day session facts (description, id, experiment_description, weight). */
  session: Record<string, any>;
  keywords: any[];
  tasks: any[];
  associated_files: any[];
  associated_video_files: any[];
  behavioral_events: any[];
  fs_gui_yamls: any[];
  technical: Record<string, any>;
  data_acq_device_name: string | undefined;
  cameras_used: any[];
  /** Day-owned bad-channel override (keyed by ntrode_id), or undefined when the source had none. */
  deviceOverrides: { bad_channels: Record<string, number[]> } | undefined;
  /** Which configVersion this day pins. */
  configurationVersion: number;
  /**
   * THIS FILE's team (experimenter names + lab + institution) — a day-owned fact preserved per
   * file (finding F5); the animal-level value is only the default for new days.
   */
  experimenters: Record<string, any>;
  /** THIS FILE's optogenetics setup (`null` when the file had none) — preserved per file. */
  optogenetics: Record<string, any> | null;
}

/** A planned animal for import: resolved facts, configuration versions, days, and divergences. */
export interface ImportPlanAnimal {
  subjectId: string;
  conflict: 'none' | 'exists';
  existingAnimalId: string | null;
  /**
   * `'add'` for a conflicting (`conflict: 'exists'`) animal; `null` for a new (`conflict: 'none'`)
   * animal (its resolution is unused — a new animal is always created).
   */
  defaultResolution: 'add' | null;
  /** Resolved subject scalar facts (latest-date-wins). */
  subject: any;
  /** Resolved experimenters (latest-date-wins). */
  experimenters: any;
  /** Resolved optogenetics (latest-date-wins), or null. */
  optogenetics: any;
  /**
   * The IMPORTED device catalogs — what the files declare, unioned by name with every file-vs-file
   * disagreement flagged in `divergences`. For a new animal this is the animal's catalog; for an
   * existing one it is what `'replace'` recreates the animal from (the files' fields win over the
   * old rows; rows the files never mention are not carried over).
   */
  devices: { data_acq_device: any[]; device: any };
  /**
   * The IMPORTED camera catalog, allocated with the files treated as self-describing (identity by
   * name, ids allocated among the files alone) — the catalog `'create'` / `'replace'` commit. Day
   * references reach it through `ImportPlanDay.cameraIdRemap.replace`.
   */
  cameras: any[];
  /**
   * The subset of `cameras` / `devices.data_acq_device` an EXISTING animal does not already have,
   * with the ids the plan allocated for them (free in existing ∪ additions). Empty for a new
   * animal. This is what the executor adds on `'add'`, and it is the same catalog the days'
   * references were remapped against, so a saved reference can never point past what was saved.
   */
  catalogAdditions: { cameras: any[]; data_acq_device: any[] };
  /**
   * The `camera_name`s this batch records with MORE THAN ONE calibration, each with one candidate
   * per distinct calibration and the resolution this plan applied (`split` by default — a different
   * calibration is a different camera). The preview renders these; a caller changes one by
   * re-planning with {@link PlanImportOptions.cameraConflictResolutions}. For an existing animal
   * these are the `'add'` questions: the animal's own rows take part.
   */
  cameraConflicts: CameraCalibrationConflict[];
  /**
   * The questions the `'replace'` result answers: the files' calibrations among themselves, since
   * the animal being replaced is deleted (W4). Keyed apart from `cameraConflicts`, so each is
   * answered for its own resolution. For a new animal, the same list as `cameraConflicts`.
   */
  replaceCameraConflicts: CameraCalibrationConflict[];
  configVersions: ConfigVersion[];
  days: ImportPlanDay[];
  divergences: Divergence[];
}

/** Options for {@link planImport}. */
export interface PlanImportOptions {
  /**
   * How to resolve each camera calibration conflict, keyed by
   * `ImportPlanAnimal.cameraConflicts[].key` / `replaceCameraConflicts[].key`. Absent (or an entry
   * absent) ⇒ `{ kind: 'split' }`.
   */
  cameraConflictResolutions?: Record<string, CameraConflictResolution>;
}

/** The full import plan: per-animal plans, the unimportable files, and a summary. */
export interface ImportPlan {
  animals: ImportPlanAnimal[];
  unimportable: Array<{ sourceName: string; sourceKey: string; reason: string }>;
  summary: { fileCount: number; animalCount: number; dayCount: number };
}

/**
 * Find the existing workspace animal whose identity matches `subjectId`, either by the
 * animals-map KEY or by a record's `subject.subject_id`. Returns the matching animal's
 * store key (its `existingAnimalId`), or `null` when none matches.
 *
 * Matching is NORMALIZED (trim + lower-case) on both sides: an imported `Remy` must route to an
 * existing `remy` (whether that animal was keyed by the lower-cased wizard id or a raw import id) so
 * a case/whitespace variant becomes an "add a recording day", not a duplicate animal — which would
 * fragment the subject downstream in Spyglass. The imported subject_id is preserved verbatim
 * elsewhere (no laundering); only this comparison is normalized.
 *
 * @param subjectId - The imported subject id.
 * @param workspace - The existing workspace slice (`{ animals }`).
 * @returns The conflicting animal's store key, or null.
 */
export function findExistingAnimalId(
  subjectId: string,
  workspace: { animals?: unknown } | null | undefined
): string | null {
  const animals = workspace?.animals;
  if (animals === null || typeof animals !== 'object') return null;
  const norm = (value: unknown): string => (typeof value === 'string' ? value.trim().toLowerCase() : '');
  const target = norm(subjectId);
  if (target === '') return null;
  // `Object.prototype.hasOwnProperty.call` is the pre-ES2022 form of `Object.hasOwn` (ES2020 lib).
  if (Object.prototype.hasOwnProperty.call(animals, subjectId)) return subjectId;
  for (const [key, animal] of Object.entries(animals)) {
    if (norm(key) === target || norm(animal?.subject?.subject_id) === target) return key;
  }
  return null;
}

/**
 * The subject scalar fields whose disagreement across a subject's files is surfaced as a
 * `subject` divergence (latest-date-wins resolution). Identity-only / structural fields
 * (subject_id, weight) are excluded — weight is a per-day override, not an animal scalar.
 */
const SUBJECT_SCALAR_FIELDS: ReadonlyArray<string> = ['species', 'sex', 'genotype', 'description', 'date_of_birth'];

/**
 * Resolve a subject's configuration VERSIONS from its date-ordered files: each run of consecutive
 * files with the same electrode configuration (deep-equal by {@link canonicalJson}) is one version,
 * effective from its first file's date until the next run starts, numbered 1..K in date order
 * (1 = the earliest). A configuration that RECURS after a change (A → B → A) starts a new version
 * rather than reusing the first one: versions are effective-date periods, so only a new one can
 * say that the later days (and the days logged after them) are back on A. Returns the version list
 * plus a per-file version map.
 *
 * @param entries - Date-sorted file entries.
 * @returns The version list plus a per-file version map.
 */
function resolveConfigVersions(entries: FileEntry[]): {
  configVersions: ConfigVersion[];
  versionByDate: Record<string, number>;
} {
  const configVersions: ConfigVersion[] = [];
  const firstVersionByKey = new Map<string, number>();
  const versionByDate: Record<string, number> = {};
  let previousKey: string | null = null;

  for (const entry of entries) {
    const devices = {
      electrode_groups: entry.configuration.electrode_groups ?? [],
      ntrode_electrode_group_channel_map:
        entry.configuration.ntrode_electrode_group_channel_map ?? [],
    };
    const key = canonicalJson(devices);
    if (key !== previousKey) {
      const version = configVersions.length + 1;
      const sameAs = firstVersionByKey.get(key);
      if (sameAs === undefined) firstVersionByKey.set(key, version);
      configVersions.push({
        version,
        date: entry.date,
        description:
          version === 1
            ? 'Initial configuration'
            : sameAs === undefined
              ? `Configuration ${version}`
              : `Configuration ${version} (same as configuration ${sameAs})`,
        devices,
        dayDates: [],
      });
      previousKey = key;
    }
    const current = configVersions[configVersions.length - 1];
    current.dayDates.push(entry.date);
    versionByDate[entry.date] = current.version;
  }

  return { configVersions, versionByDate };
}

/** One camera-catalog resolution: the rows the files declare, what they bring, and per-file remaps. */
interface CameraUnion {
  /** The imported catalog: the files' rows under the ids this union allocated. */
  imported: any[];
  /** The subset of `imported` an existing animal does not already have (all of it for `existing = null`). */
  added: any[];
  /** Per file (by index into `entries`): that file's camera id → this union's id. */
  remaps: Array<Map<unknown, unknown>>;
}

/**
 * Union the files' cameras into one catalog and record, per file, how its ids map onto it.
 *
 * A camera is IDENTIFIED by its name; its id is the first-seen id, or a fresh one when a later
 * file's new-by-name camera collides with an id already taken. When `existing` is given, the
 * animal's own catalog seeds IDENTITY only — its ids (a file row with one of them is a reference to
 * that camera when it carries the same name, or when Import & Repair recorded the user's mapping onto
 * it; a differently named row is a camera the animal does not have) and its names (a brought row
 * with an existing name routes onto that camera) — while `imported` still holds the files' rows for
 * those ids, never the existing rows themselves.
 *
 * @param entries - Date-sorted file entries.
 * @param existing - The existing animal to allocate against, or null to treat the files alone.
 * @param divergences - Receives file-vs-file field disagreements and per-file remap notes.
 * @returns The union.
 */
function unionCameras(entries: FileEntry[], existing: unknown, divergences: Divergence[]): CameraUnion {
  // --- cameras: union by camera_name, first-seen order. A camera is IDENTIFIED by its name; its
  // id in the union is the first-seen id, or a fresh one when a later file's new-by-name camera
  // collides with an id the union already assigned. Every later file's day references are then
  // remapped by name onto the union ids (see `cameraIdRemaps`), so an "overhead" video stays an
  // overhead video even when its file numbered the cameras differently. ---
  const cameraRegistry: IdentityRegistryEntry[] = [];
  const cameraSets: string[] = [];
  const cameraIdRemaps: Array<Map<unknown, unknown>> = [];
  const unionIdByName = new Map<string, unknown>();
  const usedIds = new Set<unknown>();
  const existingCameraIds = new Set<unknown>();
  const existingNameById = new Map<unknown, string>();
  const addedCameras: any[] = [];
  const nextFreeId = (): number => {
    let candidate = 0;
    while (usedIds.has(candidate)) candidate += 1;
    return candidate;
  };
  // The IMPORTED row for each existing id the files re-declare (first-seen). Under 'add' the
  // executor keeps the animal's own row for that id; under 'replace' it recreates the animal from
  // `cameras`, which must be what the files say — the imported calibration/name, never the old.
  const importedByExistingId = new Map<unknown, any>();
  // Seed IDENTITY only from what the animal already holds — its ids (a file row naming one is a
  // reference to it, not a new camera) and its names (a brought row with an existing name routes
  // onto that camera). The existing ROWS themselves are never part of the plan's catalog.
  for (const camera of getAnimalCameras(existing)) {
    const name = String(camera.camera_name ?? '').trim();
    cameraRegistry.push({
      name,
      fields: {
        id: camera.id,
        meters_per_pixel: camera.meters_per_pixel,
        lens: camera.lens,
        model: camera.model,
        manufacturer: camera.manufacturer,
      },
    });
    if (!unionIdByName.has(name)) unionIdByName.set(name, camera.id);
    if (!existingNameById.has(camera.id)) existingNameById.set(camera.id, name);
    usedIds.add(camera.id);
    existingCameraIds.add(camera.id);
  }
  for (const entry of entries) {
    const { animalFacts } = entry;
    // Treat imported cameras as loose data: `camera_name` is the identity key here (a string in
    // imported YAML), but the `Camera` type declares it `number` — `findIdentityDivergence` coerces
    // either via `String(...)`, so widen to avoid a spurious number-vs-string mismatch.
    const fileCameras: any[] = getAnimalCameras(animalFacts);
    // The set is compared on what the FILE declared: a row this plan renamed (a split, or a route
    // onto a camera the animal already has) is the same camera the file named, so it must not read
    // back as "these files carry different camera sets".
    cameraSets.push(
      (entry.cameraRewrite?.originalNames ?? fileCameras.map((c) => c.camera_name))
        .map((name) => String(name ?? ''))
        .sort()
        .join('|')
    );
    const remap = new Map<unknown, unknown>();
    const remapped: string[] = [];
    for (const camera of fileCameras) {
      const name = String(camera.camera_name ?? '').trim();
      // An id the animal already has is a reference to that camera when the file uses the animal's
      // numbering for it (the same name) or the user mapped it there in Import & Repair — never
      // re-identified by name. A DIFFERENTLY named row under that id is a camera the animal does not
      // have (W3): collapsing it onto the existing row would export the wrong camera and calibration,
      // so it is identified by name below (a new one gets a free id, and the day's references follow
      // it). Likewise a row a SPLIT calibration conflict renamed (finding F1).
      if (
        existingCameraIds.has(camera.id) &&
        entry.cameraRewrite?.reidentifiedIds.has(camera.id) !== true &&
        (existingNameById.get(camera.id) === name ||
          entry.mappedCameraIds.some((id) => Object.is(id, camera.id)))
      ) {
        if (!importedByExistingId.has(camera.id)) importedByExistingId.set(camera.id, structuredClone(camera));
        continue;
      }
      const candidateFields = {
        id: camera.id,
        meters_per_pixel: camera.meters_per_pixel,
        lens: camera.lens,
        model: camera.model,
        manufacturer: camera.manufacturer,
      };
      const divergence = findIdentityDivergence(
        camera.camera_name,
        candidateFields,
        cameraRegistry
      );
      if (divergence) {
        const nonIdFields = divergence.differingFields.filter((field) => field !== 'id');
        if (nonIdFields.length > 0) {
          pushDivergence(divergences, {
            field: 'cameras',
            detail: `Camera "${camera.camera_name}" differs across files in: ${nonIdFields.join(', ')}`,
          });
        }
        // keep the first-seen identity; do not add a conflicting duplicate.
      } else if (!unionIdByName.has(name)) {
        const id = usedIds.has(camera.id) ? nextFreeId() : camera.id;
        cameraRegistry.push({ name: camera.camera_name, fields: { ...candidateFields, id } });
        const row = { ...structuredClone(camera), id };
        addedCameras.push(row);
        unionIdByName.set(name, id);
        usedIds.add(id);
      }
      const unionId = unionIdByName.get(name);
      if (existingCameraIds.has(unionId) && !importedByExistingId.has(unionId)) {
        // Routed by name onto an existing camera: this row is what the files say that camera is.
        importedByExistingId.set(unionId, { ...structuredClone(camera), id: unionId });
      }
      if (camera.id !== undefined && camera.id !== null && !Object.is(unionId, camera.id)) {
        remap.set(camera.id, unionId);
        remapped.push(`"${camera.camera_name}" ${String(camera.id)} → ${String(unionId)}`);
      }
    }
    cameraIdRemaps.push(remap);
    if (remapped.length > 0) {
      pushDivergence(divergences, {
        field: 'cameras',
        detail: `${entry.sourceName} numbers its cameras differently; its references were mapped to the combined catalog (${remapped.join(', ')}).`,
      });
    }
  }
  // Differing camera SETS across files (even without per-camera field drift) → flag.
  if (new Set(cameraSets).size > 1) {
    pushDivergence(divergences, {
      field: 'cameras',
      detail: 'Files carry different camera sets; the import unions them.',
    });
  }

  return {
    imported: [...importedByExistingId.values(), ...addedCameras],
    added: addedCameras,
    remaps: cameraIdRemaps,
  };
}

/** The hardware that makes a recording system the device it is (its name aside). */
const DATA_ACQ_HARDWARE_FIELDS = ['system', 'amplifier', 'adc_circuit'] as const;

/** One recording-system catalog resolution: the systems the files bring, and per-file renames. */
interface DataAcqUnion {
  /** The files' systems in first-seen order, each under the name this union gave it. */
  catalog: any[];
  /** The subset of `catalog` an existing animal does not already hold (all of it for `existing = null`). */
  added: any[];
  /** Per file (by index into `entries`): a recording-system name the file used → its catalog name. */
  renames: Array<Map<string, string>>;
}

/**
 * Union the files' recording systems into one catalog and record, per file, how its names map
 * onto it.
 *
 * A system is IDENTIFIED by its name AND its hardware (`system`, `amplifier`, `adc_circuit`): a day
 * references it by name and the export resolves that name in the animal's catalog, so other
 * hardware under a reused name is a DIFFERENT system (W5). The first hardware recorded under a name
 * keeps the name; other hardware is kept as its own entry under `${name}_${YYYYMMDD}` of the date it
 * was first recorded (like a split camera), and that file's day references it. When `existing` is
 * given, the animal's own catalog takes part: its entries keep their names, a file system with the
 * same name and hardware — or one the user mapped onto it in Import & Repair — IS that entry, and
 * hardware the animal already holds under a dated name routes onto that entry (a re-import does not
 * split twice).
 *
 * @param entries - Date-sorted file entries.
 * @param existing - The existing animal to allocate against, or null to treat the files alone.
 * @param divergences - Receives a note for every system kept apart under a new name.
 * @param scope - The resolution the notes are about (see `Divergence.scope`), when only one.
 * @returns The union.
 */
function unionDataAcqDevices(
  entries: FileEntry[],
  existing: unknown,
  divergences: Divergence[],
  scope?: Divergence['scope']
): DataAcqUnion {
  const nameOf = (device: Record<string, unknown>): string => String(device.name ?? '').trim();
  const hardwareOf = (device: Record<string, unknown>): string =>
    JSON.stringify(DATA_ACQ_HARDWARE_FIELDS.map((field) => String(device[field] ?? '').trim()));
  const devicesOf = (owner: unknown): Array<Record<string, unknown>> =>
    getDataAcqDevices(owner).filter(
      (device): device is DataAcqDevice & Record<string, unknown> =>
        device !== null && typeof device === 'object'
    );
  const existingDevices = devicesOf(existing);
  const existingNames = new Set(existingDevices.map(nameOf));
  // A dated name never takes one the animal or any of the files already uses.
  const taken = new Set([
    ...existingNames,
    ...entries.flatMap((entry) => devicesOf(entry.animalFacts).map(nameOf)),
  ]);
  /** name → hardware → the catalog name holding that hardware. */
  const known = new Map<string, Map<string, string>>();
  /** name → the system the bare name stands for (what other hardware is compared against). */
  const base = new Map<string, { device: Record<string, unknown>; fromExisting: boolean }>();
  for (const device of existingDevices) {
    const name = nameOf(device);
    // The export resolves a name to the FIRST catalog entry carrying it.
    if (known.has(name)) continue;
    known.set(name, new Map([[hardwareOf(device), name]]));
    base.set(name, { device, fromExisting: true });
  }

  const catalog: any[] = [];
  const added: any[] = [];
  const renames: Array<Map<string, string>> = [];
  for (const entry of entries) {
    const rename = new Map<string, string>();
    const seen = new Set<string>();
    for (const device of devicesOf(entry.animalFacts)) {
      const name = nameOf(device);
      const hardware = hardwareOf(device);
      const variants = known.get(name);
      let catalogName = variants?.get(hardware);
      if (
        catalogName === undefined &&
        existingNames.has(name) &&
        entry.mappedDataAcqDeviceNames.includes(name)
      ) {
        catalogName = name; // the user mapped this file's system onto the animal's own
      }
      if (catalogName === undefined) {
        // An earlier import already kept this hardware apart under a dated name: it IS that entry.
        const held = existingDevices.find(
          (candidate) => hardwareOf(candidate) === hardware && isSplitNameOf(nameOf(candidate), name)
        );
        if (held) catalogName = nameOf(held);
      }
      if (catalogName === undefined) {
        const row = structuredClone(device);
        if (variants === undefined) {
          catalogName = name;
          known.set(name, new Map([[hardware, name]]));
          base.set(name, { device, fromExisting: false });
        } else {
          catalogName = allocateSplitName(name, entry.date, taken);
          variants.set(hardware, catalogName);
          row.name = catalogName;
          const original = base.get(name)!;
          const fields = DATA_ACQ_HARDWARE_FIELDS.filter(
            (field) => !valuesEqual(device[field], original.device[field])
          ).join(', ');
          pushDivergence(divergences, {
            field: 'data_acq_device',
            detail: original.fromExisting
              ? `Recording system "${name}" in ${entry.sourceName} differs from the animal's in: ${fields}; adding keeps it as its own recording system "${catalogName}", which that day uses.`
              : `Recording system "${name}" differs across files in: ${fields}; ${entry.sourceName}'s is kept as its own recording system "${catalogName}", which its day uses.`,
            ...(scope ? { scope } : {}),
          });
        }
        catalog.push(row);
        if (!existingNames.has(catalogName)) added.push(row);
      }
      // A day uses its file's FIRST system of a name (the merge resolves names to the first entry).
      if (!seen.has(name) && catalogName !== name) rename.set(name, catalogName);
      seen.add(name);
    }
    renames.push(rename);
  }
  return { catalog, added, renames };
}

/** Push a divergence unless an identical one is already listed (the two camera spaces overlap). */
function pushDivergence(divergences: Divergence[], divergence: Divergence): void {
  if (
    !divergences.some(
      (d) =>
        d.field === divergence.field && d.detail === divergence.detail && d.scope === divergence.scope
    )
  ) {
    divergences.push(divergence);
  }
}

/**
 * Resolve a subject's animal-level facts from its date-ordered files, pushing a divergence
 * flag for every disagreement (never a silent pick). Resolution policy:
 *  - cameras: two allocations (see {@link unionCameras}) because the user picks Add or Replace
 *    AFTER planning and the answers differ: the `add` space allocates against the existing
 *    animal (an existing id with the same name IS that camera; brought rows get ids free in
 *    existing ∪ additions), the `replace` space treats the files as self-describing (the only space
 *    for a new animal), calibration conflicts included. Each day carries both remaps;
 *    `materializePlanDay` applies the committed one.
 *  - data_acq_device: identity is name + hardware (see {@link unionDataAcqDevices}); other hardware
 *    under a reused name becomes its own dated entry the day references → `data_acq_device` flag.
 *  - subject scalars: latest-date-wins; any difference → `subject` flag (lists the keys); for an
 *    existing animal, a file fact that differs from the animal's (which adding keeps) → `subject`
 *    flag naming both values.
 *  - experimenters / optogenetics / device: latest-date-wins; differences → a flag.
 *
 * @param entries - Date-sorted file entries.
 * @param subjectId - The planned animal id (namespaces the camera-conflict keys).
 * @param existing - The existing animal record when the subject is already in the workspace.
 * @param cameraConflictResolutions - Caller-chosen camera-conflict resolutions, keyed by conflict key.
 * @returns The resolved animal-level facts plus the surfaced divergences.
 */
function resolveAnimalFacts(
  entries: FileEntry[],
  subjectId: string,
  existing: unknown = null,
  cameraConflictResolutions: Record<string, CameraConflictResolution> = {}
): ResolvedAnimalFacts {
  const divergences: Divergence[] = [];

  // --- cameras: same name, different calibration = a DIFFERENT camera (finding F1). Resolve every
  // such conflict BEFORE unioning, so the union sees rows that already say what they are: split
  // rows carry their own dated name, unified rows carry the chosen calibration. ---
  const addCalibrations = resolveCameraCalibrations(
    entries,
    subjectId,
    existing,
    cameraConflictResolutions
  );
  for (const conflict of addCalibrations.conflicts) {
    pushDivergence(divergences, {
      field: 'cameras',
      detail: describeCameraConflict(conflict),
      ...(existing ? { scope: 'add' as const } : {}),
    });
  }

  const latest = entries[entries.length - 1].animalFacts;
  const addSpace = unionCameras(addCalibrations.entries, existing, divergences);
  // For 'replace' the existing animal is discarded, so the files are self-describing: identity
  // is by name across files, ids are allocated among the files alone, and so are the calibration
  // conflicts (W4) — the animal being deleted is no candidate, so it can neither rename the files'
  // cameras nor lend them its calibration. Its questions are keyed apart from the add space's, so an
  // answer given for adding never answers one for replacing. For a new animal that is the only
  // space there is.
  const replaceCalibrations = existing
    ? resolveCameraCalibrations(entries, `${subjectId} (replace)`, null, cameraConflictResolutions)
    : addCalibrations;
  if (existing) {
    for (const conflict of replaceCalibrations.conflicts) {
      pushDivergence(divergences, {
        field: 'cameras',
        detail: describeCameraConflict(conflict),
        scope: 'replace',
      });
    }
  }
  const replaceSpace = existing
    ? unionCameras(replaceCalibrations.entries, null, divergences)
    : addSpace;

  // --- data_acq_device: identified by name AND hardware (W5), so each day exports the system its
  // own file recorded; other hardware under a reused name becomes its own dated entry. The same two
  // spaces as the cameras: 'add' against the existing animal, 'replace' among the files alone. ---
  const addSystems = unionDataAcqDevices(entries, existing, divergences, existing ? 'add' : undefined);
  const replaceSystems = existing
    ? unionDataAcqDevices(entries, null, divergences, 'replace')
    : addSystems;

  // --- subject scalars vs the EXISTING animal: adding keeps the animal's facts (all of its days
  // share them), so a file that records a different one is listed, never silently overridden (W5).
  // A fact the animal has not recorded yet disagrees with nothing (the export gate asks for it). ---
  if (existing) {
    const held = getAnimalSubject(existing) as unknown as Record<string, unknown>;
    const differences = SUBJECT_SCALAR_FIELDS.flatMap((field) => {
      const animalValue = held[field];
      if (animalValue === undefined || animalValue === null || animalValue === '') return [];
      const filesByValue = new Map<string, string[]>();
      for (const { animalFacts, sourceName } of entries) {
        const fileValue = animalFacts.subject?.[field] ?? null;
        if (canonicalJson(fileValue) === canonicalJson(animalValue)) continue;
        const shown = JSON.stringify(fileValue);
        filesByValue.set(shown, [...(filesByValue.get(shown) ?? []), sourceName]);
      }
      if (filesByValue.size === 0) return [];
      const inFiles = [...filesByValue].map(([value, names]) => `${value} in ${names.join(', ')}`);
      return [`${field} (${JSON.stringify(animalValue)} on the animal; ${inFiles.join('; ')})`];
    });
    if (differences.length > 0) {
      divergences.push({
        field: 'subject',
        scope: 'add',
        detail:
          `Subject facts differ from the existing animal's: ${differences.join(', ')}. Adding keeps ` +
          'the animal’s values, which all of its recording days share; if a file is right, ' +
          'correct the animal’s profile.',
      });
    }
  }

  // --- subject scalars: latest-date-wins, flag any difference ---
  const differingSubjectKeys = SUBJECT_SCALAR_FIELDS.filter((field) => {
    const values = new Set(
      entries.map(({ animalFacts }) => canonicalJson(animalFacts.subject?.[field] ?? null))
    );
    return values.size > 1;
  });
  if (differingSubjectKeys.length > 0) {
    divergences.push({
      field: 'subject',
      detail: `Subject fields differ across files (latest date wins): ${differingSubjectKeys.join(', ')}`,
    });
  }

  // --- experimenters: PRESERVED PER DAY (each planned day carries its own file's team); the
  // animal-level default for NEW days is the latest file's. Differences are informational. ---
  const experimenterKeys = new Set(
    entries.map(({ animalFacts }) => canonicalJson(animalFacts.experimenters ?? null))
  );
  if (experimenterKeys.size > 1) {
    divergences.push({
      field: 'experimenters',
      detail: 'Experimenters differ across files; each day keeps its own file\u2019s team (the latest file\u2019s becomes the default for new days).',
    });
  }

  // --- optogenetics: PRESERVED PER DAY likewise; the latest file's setup is the default. ---
  const optoKeys = new Set(
    entries.map(({ animalFacts }) => canonicalJson(animalFacts.optogenetics ?? null))
  );
  if (optoKeys.size > 1) {
    divergences.push({
      field: 'optogenetics',
      detail: 'Optogenetics setup differs across files; each day keeps its own file\u2019s setup (the latest file\u2019s becomes the default for new days).',
    });
  }

  return {
    subject: structuredClone(latest.subject),
    experimenters: structuredClone(latest.experimenters),
    optogenetics: latest.optogenetics ? structuredClone(latest.optogenetics) : null,
    devices: {
      data_acq_device: replaceSystems.catalog,
      device: structuredClone(latest.devices?.device),
    },
    cameras: replaceSpace.imported,
    cameraIdRemaps: { add: addSpace.remaps, replace: replaceSpace.remaps },
    dataAcqDeviceRenames: { add: addSystems.renames, replace: replaceSystems.renames },
    catalogAdditions: { cameras: addSpace.added, data_acq_device: addSystems.added },
    cameraConflicts: addCalibrations.conflicts,
    replaceCameraConflicts: replaceCalibrations.conflicts,
    divergences,
  };
}

/**
 * Analyze one subject's camera calibrations (see {@link analyzeCameraCalibrations}) and apply the
 * resolutions to its files' camera rows.
 *
 * @param entries - Date-sorted file entries.
 * @param conflictNamespace - Prefix of the conflict keys (the subject id, or a per-space variant).
 * @param existing - The animal whose catalog takes part in the analysis, or null for the files alone.
 * @param cameraConflictResolutions - Caller-chosen camera-conflict resolutions, keyed by conflict key.
 * @returns The entries with their camera rows rewritten, plus the conflicts found.
 */
function resolveCameraCalibrations(
  entries: FileEntry[],
  conflictNamespace: string,
  existing: unknown,
  cameraConflictResolutions: Record<string, CameraConflictResolution>
): { entries: FileEntry[]; conflicts: CameraCalibrationConflict[] } {
  const analysis = analyzeCameraCalibrations(
    conflictNamespace,
    entries.map((entry) => ({
      sourceName: entry.sourceName,
      date: entry.date,
      cameras: getAnimalCameras(entry.animalFacts) as unknown as Array<Record<string, unknown>>,
    })),
    existing,
    cameraConflictResolutions
  );
  if (analysis.conflicts.length === 0 && analysis.reroutes.size === 0) {
    return { entries, conflicts: analysis.conflicts };
  }
  return {
    conflicts: analysis.conflicts,
    entries: entries.map((entry) => {
      const { cameras, reidentifiedCameraIds, originalNames } = applyCameraConflictResolutions(
        getAnimalCameras(entry.animalFacts) as unknown as Array<Record<string, unknown>>,
        analysis
      );
      return {
        ...entry,
        animalFacts: { ...entry.animalFacts, cameras },
        cameraRewrite: { reidentifiedIds: reidentifiedCameraIds, originalNames },
      };
    }),
  };
}

/**
 * Build an {@link ImportPlanDay} from a decomposed file entry, pinning it to the resolved
 * configuration version for its date. Deep-clones every day-owned field so the plan never
 * aliases the decompose result.
 *
 * @param entry - File entry.
 * @param configurationVersion - The version this day pins.
 * @param cameraIdRemap - This file's camera id → catalog id, for each resolution.
 * @param dataAcqDeviceRename - This file's recording-system name → catalog name, for each resolution.
 * @returns The planned import day (references in the FILE's id space; see `materializePlanDay`).
 */
function buildPlanDay(
  entry: FileEntry,
  configurationVersion: number,
  cameraIdRemap: ImportPlanDay['cameraIdRemap'],
  dataAcqDeviceRename: ImportPlanDay['dataAcqDeviceRename']
): ImportPlanDay {
  const { dayFacts, animalFacts } = entry;
  return {
    date: entry.date,
    sourceName: entry.sourceName,
    sourceKey: entry.sourceKey,
    cameraIdRemap,
    dataAcqDeviceRename,
    // Per-file dated facts (finding F5): the team and opto setup as THIS file recorded them.
    experimenters: structuredClone(animalFacts.experimenters ?? {}),
    optogenetics: animalFacts.optogenetics ? structuredClone(animalFacts.optogenetics) : null,
    session: structuredClone(dayFacts.session),
    keywords: structuredClone(dayFacts.keywords ?? []),
    tasks: structuredClone(dayFacts.tasks ?? []),
    associated_files: structuredClone(dayFacts.associated_files ?? []),
    associated_video_files: structuredClone(dayFacts.associated_video_files ?? []),
    behavioral_events: structuredClone(dayFacts.behavioral_events ?? []),
    fs_gui_yamls: structuredClone(dayFacts.fs_gui_yamls ?? []),
    technical: structuredClone(dayFacts.technical ?? {}),
    data_acq_device_name: dayFacts.data_acq_device_name,
    cameras_used: structuredClone(dayFacts.cameras_used ?? []),
    // Bad channels are DAY-OWNED — carry the decomposed per-ntrode override so the
    // executor writes it onto the day (the export merge reads it from there only).
    // Omitted (undefined) when the source carried no marks.
    deviceOverrides: dayFacts.deviceOverrides
      ? structuredClone(dayFacts.deviceOverrides)
      : undefined,
    configurationVersion,
  };
}

/**
 * A planned day with its camera and recording-system references rewritten into the catalog the
 * executor will actually hold for `resolution`: the existing animal + additions for `'add'`, the
 * imported catalog for `'create'` / `'replace'`. The ONE place a plan's file-space references become
 * store references.
 *
 * @param day - A planned day (references in the file's id space).
 * @param resolution - How the animal is being committed.
 * @returns A new day with references in the committed catalog's id space.
 */
export function materializePlanDay(
  day: ImportPlanDay,
  resolution: 'add' | 'replace' | 'create'
): ImportPlanDay {
  const adding = resolution === 'add';
  const remapped = remapCameraRefs(
    day,
    new Map(adding ? day.cameraIdRemap.add : day.cameraIdRemap.replace)
  );
  const renames = new Map(adding ? day.dataAcqDeviceRename.add : day.dataAcqDeviceRename.replace);
  const name = remapped.data_acq_device_name;
  return name !== undefined && renames.has(name)
    ? { ...remapped, data_acq_device_name: renames.get(name) }
    : remapped;
}

/**
 * Turn a SET of parsed flat YAML files into an import {@link ImportPlan}. PURE: reads only
 * its arguments, deep-clones every output so it never aliases `decodedFiles` or
 * `existingWorkspace`, and NEVER touches the store.
 *
 * For each file: {@link module:state/yamlImport.decomposeYaml} attributes it; a `!ok` result
 * OR a null {@link extractRecordingDate} sends it to `unimportable` with a clear reason.
 * The ok+dated files are grouped by `subjectId` and resolved into per-animal plans
 * (config-version inference + animal-fact resolution with surfaced divergences + conflict
 * detection against the existing workspace). See the per-animal helpers for the policy.
 *
 * @param decodedFiles - Parsed files.
 * @param existingWorkspace - The current workspace slice (`{ animals }`), read-only.
 * @param options - Planning options ({@link PlanImportOptions}).
 * @param options.cameraConflictResolutions - How to resolve each camera calibration conflict
 *   (keyed by `ImportPlanAnimal.cameraConflicts[].key`). Absent ⇒ `split`. The plan is PURE, so a
 *   preview re-plans with an updated map rather than mutating the plan it is showing.
 * @returns The import plan.
 */
export function planImport(
  decodedFiles: unknown,
  existingWorkspace: { animals?: unknown } | null | undefined,
  { cameraConflictResolutions = {} }: PlanImportOptions = {}
): ImportPlan {
  const files = Array.isArray(decodedFiles) ? decodedFiles : [];
  const unimportable: Array<{ sourceName: string; sourceKey: string; reason: string }> = [];
  /** normalized subjectId → first-seen display id + date-ordered file entries */
  const bySubject = new Map<string, SubjectBatch>();
  /**
   * `${subjectId} ${date}` → the sourceName of the FIRST (input/source order) file that
   * claimed that (subject, date). Used to dedup intra-plan duplicates so `planImport` never
   * emits two days with the same `generateDayId` for one subject (which would otherwise make
   * the executor's second `createDay` throw inside the store reducer and crash the render).
   */
  const keptByDayKey = new Map<string, string>();

  for (const file of files) {
    const sourceName = file?.sourceName;
    const sourceKey: string = typeof file?.sourceKey === 'string' ? file.sourceKey : sourceName;
    const flatModel = file?.flatModel;

    // Per-file resilience: a single pathological file must NOT abort the whole import
    // preview. If decompose/validate THROWS on this file (e.g. a malformed parse with a
    // throwing accessor), route it to `unimportable` with a clear reason and continue.
    let decomposed: DecomposeResult;
    try {
      decomposed = decomposeYaml(flatModel);
    } catch (error) {
      unimportable.push({
        sourceName,
        sourceKey,
        reason: `Could not analyze file: ${(error as Error)?.message ?? String(error)}`,
      });
      continue;
    }
    if (!decomposed.ok) {
      const firstBlocking = decomposed.issues?.find(isBlockingIssue);
      const reason = firstBlocking
        ? `Validation failed: ${firstBlocking.message}`
        : 'File failed schema/business-rule validation and cannot be imported.';
      unimportable.push({ sourceName, sourceKey, reason });
      continue;
    }

    const date = extractRecordingDate(flatModel, sourceName);
    if (date === null) {
      unimportable.push({
        sourceName,
        sourceKey,
        reason:
          'Could not determine the recording date from the filename ' +
          '({YYYYMMDD}_{subject}_metadata.yml or {mmddYYYY}_{subject}_metadata.yml) ' +
          'or session_id ({subject}_{YYYYMMDD}).',
      });
      continue;
    }

    const subjectId = decomposed.subjectId;
    if (!subjectId) {
      unimportable.push({
        sourceName,
        sourceKey,
        reason: 'File has no subject_id; cannot attribute it to an animal.',
      });
      continue;
    }

    // The animal store key + hash-route param IS the subject_id, so it must be route-safe — the
    // SAME charset the create-animal forms enforce (`/^[a-zA-Z0-9_-]+$/`). A subject_id with a
    // space, `?`, `#`, `/`, etc. would import as valid data yet make the animal unreachable (the
    // hash router can't round-trip it) or resolve to the wrong/absent animal. Flag it with a clear,
    // actionable reason rather than silently creating an unreachable animal.
    if (!/^[a-zA-Z0-9_-]+$/.test(subjectId)) {
      unimportable.push({
        sourceName,
        sourceKey,
        reason:
          `Subject ID "${subjectId}" contains characters that aren't allowed in an animal id ` +
          `(use only letters, numbers, hyphen, or underscore). Rename the subject in the file and re-import.`,
      });
      continue;
    }

    // Intra-plan dedup: two ok+dated files resolving to the SAME (subject, date) would yield
    // two days with the same id. Keep the FIRST (input/source order); send the rest to
    // unimportable naming the collision.
    //
    // Batch identity is case-insensitive, matching the existing-workspace lookup. The first-seen
    // spelling wins for display/store identity, so `Remy` + `remy` cannot fragment into two animals.
    const subjectKey = subjectId.toLowerCase();
    const displaySubjectId = bySubject.get(subjectKey)?.subjectId ?? subjectId;
    const dayKey = `${subjectKey} ${date}`;
    const keptSourceName = keptByDayKey.get(dayKey);
    if (keptSourceName !== undefined) {
      unimportable.push({
        sourceName,
        sourceKey,
        reason: `Duplicate recording date ${date} for subject "${displaySubjectId}" (already provided by ${keptSourceName}).`,
      });
      continue;
    }
    keptByDayKey.set(dayKey, sourceName);

    const entry: FileEntry = {
      sourceName,
      sourceKey,
      date,
      animalFacts: decomposed.animalFacts,
      dayFacts: decomposed.dayFacts,
      configuration: decomposed.configuration,
      mappedCameraIds: repairMappingsOf(flatModel, IMPORT_REPAIR_MAPPED_CAMERA_IDS),
      mappedDataAcqDeviceNames: repairMappingsOf(flatModel, IMPORT_REPAIR_MAPPED_DATA_ACQ_NAMES),
    };
    if (!bySubject.has(subjectKey)) {
      bySubject.set(subjectKey, { subjectId, entries: [] });
    }
    bySubject.get(subjectKey)!.entries.push(entry);
  }

  const animals: ImportPlanAnimal[] = [];
  let dayCount = 0;
  for (const { subjectId, entries: rawEntries } of bySubject.values()) {
    // Date order (stable): the version-1 = earliest config and first-seen camera ordering
    // both depend on a deterministic earliest-first sort.
    const entries = [...rawEntries].sort((a, b) => a.date.localeCompare(b.date));

    const { configVersions, versionByDate } = resolveConfigVersions(entries);
    const existingAnimalId = findExistingAnimalId(subjectId, existingWorkspace);
    const existingAnimal = existingAnimalId
      ? (existingWorkspace?.animals as Record<string, unknown> | undefined)?.[existingAnimalId] ?? null
      : null;
    const facts = resolveAnimalFacts(
      entries,
      subjectId,
      existingAnimal,
      cameraConflictResolutions
    );

    const days = entries.map((entry, index) =>
      buildPlanDay(
        entry,
        versionByDate[entry.date],
        {
          add: [...facts.cameraIdRemaps.add[index]],
          replace: [...facts.cameraIdRemaps.replace[index]],
        },
        {
          add: [...facts.dataAcqDeviceRenames.add[index]],
          replace: [...facts.dataAcqDeviceRenames.replace[index]],
        }
      )
    );
    dayCount += days.length;

    animals.push({
      subjectId,
      conflict: existingAnimalId ? 'exists' : 'none',
      existingAnimalId: existingAnimalId ?? null,
      // Only a conflicting ('exists') animal has a meaningful default action ('add' the
      // imported days to the existing animal); a new ('none') animal is always created, so
      // its resolution is unused (`null`, not a dead 'add' literal). The executor/dialog
      // read this field only when `conflict === 'exists'`.
      defaultResolution: existingAnimalId ? 'add' : null,
      // Grouping is case-insensitive and the first-seen spelling is authoritative. Keep the
      // subject payload in lockstep with the animal/store id even when a later file uses `remy`
      // after the first file used `Remy`.
      subject: { ...facts.subject, subject_id: subjectId },
      experimenters: facts.experimenters,
      optogenetics: facts.optogenetics,
      devices: facts.devices,
      cameras: facts.cameras,
      catalogAdditions: facts.catalogAdditions,
      cameraConflicts: facts.cameraConflicts,
      replaceCameraConflicts: facts.replaceCameraConflicts,
      configVersions,
      days,
      // A task name described two ways is refused by Spyglass; list it with the other differences.
      divergences: [
        ...facts.divergences,
        ...importTaskDescriptionDivergences(
          entries.map((entry) => ({ sourceName: entry.sourceName, tasks: entry.dayFacts.tasks })),
          existingAnimalId ? { workspace: existingWorkspace, animalId: existingAnimalId } : null
        ),
      ],
    });
  }

  return {
    animals,
    unimportable,
    summary: {
      fileCount: files.length,
      animalCount: animals.length,
      dayCount,
    },
  };
}
