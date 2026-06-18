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
 *   - infers configuration VERSIONS within a subject (distinct electrode configs in
 *     date order),
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
import { findIdentityDivergence } from './identityDivergence';
import type { IdentityRegistryEntry } from './identityDivergence';
import { getAnimalCameras, getDataAcqDevices } from './workspaceSelectors';
import type { ValidationModel } from '../validation/issueTypes';

/** A single surfaced disagreement across a subject's files. */
export interface Divergence {
  /** The diverging field (e.g. `cameras`, `subject`). */
  field: string;
  /** A human-readable description of the disagreement. */
  detail: string;
}

/** One resolved configuration version within a subject (a distinct electrode config in date order). */
export interface ConfigVersion {
  /** Sequential version number (1 = earliest distinct config). */
  version: number;
  /** The earliest date that introduced this config. */
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
  /** ISO `YYYY-MM-DD` recording date. */
  date: string;
  /** Animal-owned facts from {@link decomposeYaml}. */
  animalFacts: Record<string, any>;
  /** Day-owned facts from {@link decomposeYaml}. */
  dayFacts: Record<string, any>;
  /** The probe configuration from {@link decomposeYaml}. */
  configuration: Record<string, any>;
}

/** A subject's resolved animal-level facts (latest-date-wins) plus surfaced divergences. */
interface ResolvedAnimalFacts {
  subject: any;
  experimenters: any;
  optogenetics: any;
  devices: { data_acq_device: any[]; device: any };
  cameras: any[];
  divergences: Divergence[];
}

/**
 * Derive a recording day's ISO date (`YYYY-MM-DD`) for an imported flat model. The flat
 * YAML carries NO date field, so it is reconstructed from naming conventions:
 *
 *  - PRIMARY: the `{mmddYYYY}_{subject}_metadata.yml` filename convention (the exact
 *    inverse of {@link module:io/yaml.formatDeterministicFilename}). e.g.
 *    `06222023_remy_metadata.yml` → `2023-06-22`; and the common legacy
 *    `{YYYYMMDD}_{subject}.yml` convention, e.g. `20231108_bs28.yml` → `2023-11-08`.
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
  // PRIMARY: filename {mmddYYYY}_{subject}_metadata.yml.
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
  /** Source filename. */
  sourceName: string;
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
  /** Resolved device catalogs. */
  devices: { data_acq_device: any[]; device: any };
  /** Resolved union camera catalog. */
  cameras: any[];
  configVersions: ConfigVersion[];
  days: ImportPlanDay[];
  divergences: Divergence[];
}

/** The full import plan: per-animal plans, the unimportable files, and a summary. */
export interface ImportPlan {
  animals: ImportPlanAnimal[];
  unimportable: Array<{ sourceName: string; reason: string }>;
  summary: { fileCount: number; animalCount: number; dayCount: number };
}

/**
 * A stable JSON serialization usable as a deep-equality key for a configuration's
 * `{ electrode_groups, ntrode_electrode_group_channel_map }`. Keys are sorted recursively
 * so two configs that differ only in key insertion order hash to the same string (a config
 * is a value, not an ordered record). Arrays keep their order (electrode order is meaningful).
 *
 * @param value - Any JSON-serializable value.
 * @returns A deterministic serialization.
 */
function stableStringify(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(',')}]`;
  }
  if (value !== null && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    const keys = Object.keys(record).sort();
    return `{${keys.map((k) => `${JSON.stringify(k)}:${stableStringify(record[k])}`).join(',')}}`;
  }
  return JSON.stringify(value);
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
 * Resolve a subject's configuration VERSIONS from its date-ordered files: the DISTINCT
 * electrode configurations (deep-equal by {@link stableStringify}), numbered 1..K in date
 * order (1 = earliest distinct config). Returns the version list plus a per-file version map.
 *
 * @param entries - Date-sorted file entries.
 * @returns The version list plus a per-file version map.
 */
function resolveConfigVersions(entries: FileEntry[]): {
  configVersions: ConfigVersion[];
  versionByDate: Record<string, number>;
} {
  const configVersions: ConfigVersion[] = [];
  const keyToVersion = new Map<string, number>();
  const versionByDate: Record<string, number> = {};

  for (const entry of entries) {
    const devices = {
      electrode_groups: entry.configuration.electrode_groups ?? [],
      ntrode_electrode_group_channel_map:
        entry.configuration.ntrode_electrode_group_channel_map ?? [],
    };
    const key = stableStringify(devices);
    let version = keyToVersion.get(key);
    if (version === undefined) {
      version = configVersions.length + 1;
      keyToVersion.set(key, version);
      configVersions.push({
        version,
        date: entry.date,
        description: version === 1 ? 'Initial configuration' : `Configuration ${version}`,
        devices,
        dayDates: [],
      });
    }
    configVersions[version - 1].dayDates.push(entry.date);
    versionByDate[entry.date] = version;
  }

  return { configVersions, versionByDate };
}

/**
 * Resolve a subject's animal-level facts from its date-ordered files, pushing a divergence
 * flag for every disagreement (never a silent pick). Resolution policy:
 *  - cameras: UNION by `camera_name` in first-seen (earliest-date) order; same name with
 *    different dependent fields, OR differing camera SETS across files → `cameras` flag.
 *  - data_acq_device: UNION by `name`; divergent dependent fields → `data_acq_device` flag.
 *  - subject scalars: latest-date-wins; any difference → `subject` flag (lists the keys).
 *  - experimenters / optogenetics / device: latest-date-wins; differences → a flag.
 *
 * @param entries - Date-sorted file entries.
 * @returns The resolved animal-level facts plus the surfaced divergences.
 */
function resolveAnimalFacts(entries: FileEntry[]): ResolvedAnimalFacts {
  const divergences: Divergence[] = [];
  const latest = entries[entries.length - 1].animalFacts;

  // --- cameras: union by camera_name, first-seen order ---
  const cameras: any[] = [];
  const cameraRegistry: IdentityRegistryEntry[] = [];
  const cameraSets: string[] = [];
  for (const { animalFacts } of entries) {
    // Treat imported cameras as loose data: `camera_name` is the identity key here (a string in
    // imported YAML), but the `Camera` type declares it `number` — `findIdentityDivergence` coerces
    // either via `String(...)`, so widen to avoid a spurious number-vs-string mismatch.
    const fileCameras: any[] = getAnimalCameras(animalFacts);
    cameraSets.push(fileCameras.map((c) => c.camera_name).sort().join('|'));
    for (const camera of fileCameras) {
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
        divergences.push({
          field: 'cameras',
          detail: `Camera "${camera.camera_name}" differs across files in: ${divergence.differingFields.join(', ')}`,
        });
        continue; // keep the first-seen identity; do not add a conflicting duplicate.
      }
      if (!cameraRegistry.some((e) => e.name === camera.camera_name)) {
        cameraRegistry.push({ name: camera.camera_name, fields: candidateFields });
        cameras.push(structuredClone(camera));
      }
    }
  }
  // Differing camera SETS across files (even without per-camera field drift) → flag.
  if (new Set(cameraSets).size > 1) {
    divergences.push({
      field: 'cameras',
      detail: 'Files carry different camera sets; the import unions them.',
    });
  }

  // --- data_acq_device: union by name ---
  const dataAcqDevice: any[] = [];
  const dataAcqRegistry: IdentityRegistryEntry[] = [];
  for (const { animalFacts } of entries) {
    const fileDevices = getDataAcqDevices(animalFacts);
    for (const device of fileDevices) {
      const candidateFields = {
        system: device.system,
        amplifier: device.amplifier,
        adc_circuit: device.adc_circuit,
      };
      const divergence = findIdentityDivergence(device.name, candidateFields, dataAcqRegistry);
      if (divergence) {
        divergences.push({
          field: 'data_acq_device',
          detail: `Recording system "${device.name}" differs across files in: ${divergence.differingFields.join(', ')}`,
        });
        continue;
      }
      if (!dataAcqRegistry.some((e) => e.name === device.name)) {
        dataAcqRegistry.push({ name: device.name, fields: candidateFields });
        dataAcqDevice.push(structuredClone(device));
      }
    }
  }

  // --- subject scalars: latest-date-wins, flag any difference ---
  const differingSubjectKeys = SUBJECT_SCALAR_FIELDS.filter((field) => {
    const values = new Set(
      entries.map(({ animalFacts }) => stableStringify(animalFacts.subject?.[field] ?? null))
    );
    return values.size > 1;
  });
  if (differingSubjectKeys.length > 0) {
    divergences.push({
      field: 'subject',
      detail: `Subject fields differ across files (latest date wins): ${differingSubjectKeys.join(', ')}`,
    });
  }

  // --- experimenters: latest-date-wins, flag differences ---
  const experimenterKeys = new Set(
    entries.map(({ animalFacts }) => stableStringify(animalFacts.experimenters ?? null))
  );
  if (experimenterKeys.size > 1) {
    divergences.push({
      field: 'experimenters',
      detail: 'Experimenters differ across files (latest date wins).',
    });
  }

  // --- optogenetics: latest-date-wins, flag differences ---
  const optoKeys = new Set(
    entries.map(({ animalFacts }) => stableStringify(animalFacts.optogenetics ?? null))
  );
  if (optoKeys.size > 1) {
    divergences.push({
      field: 'optogenetics',
      detail: 'Optogenetics metadata differs across files (latest date wins).',
    });
  }

  return {
    subject: structuredClone(latest.subject),
    experimenters: structuredClone(latest.experimenters),
    optogenetics: latest.optogenetics ? structuredClone(latest.optogenetics) : null,
    devices: {
      data_acq_device: dataAcqDevice,
      device: structuredClone(latest.devices?.device),
    },
    cameras,
    divergences,
  };
}

/**
 * Build an {@link ImportPlanDay} from a decomposed file entry, pinning it to the resolved
 * configuration version for its date. Deep-clones every day-owned field so the plan never
 * aliases the decompose result.
 *
 * @param entry - File entry.
 * @param configurationVersion - The version this day pins.
 * @returns The planned import day.
 */
function buildPlanDay(entry: FileEntry, configurationVersion: number): ImportPlanDay {
  const { dayFacts } = entry;
  return {
    date: entry.date,
    sourceName: entry.sourceName,
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
 * @returns The import plan.
 */
export function planImport(
  decodedFiles: unknown,
  existingWorkspace: { animals?: unknown } | null | undefined
): ImportPlan {
  const files = Array.isArray(decodedFiles) ? decodedFiles : [];
  const unimportable: Array<{ sourceName: string; reason: string }> = [];
  /** subjectId → date-ordered file entries */
  const bySubject = new Map<string, FileEntry[]>();
  /**
   * `${subjectId} ${date}` → the sourceName of the FIRST (input/source order) file that
   * claimed that (subject, date). Used to dedup intra-plan duplicates so `planImport` never
   * emits two days with the same `generateDayId` for one subject (which would otherwise make
   * the executor's second `createDay` throw inside the store reducer and crash the render).
   */
  const keptByDayKey = new Map<string, string>();

  for (const file of files) {
    const sourceName = file?.sourceName;
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
        reason: `Could not analyze file: ${(error as Error)?.message ?? String(error)}`,
      });
      continue;
    }
    if (!decomposed.ok) {
      const reason = decomposed.issues?.find((i) => i.severity === 'error')?.message
        ? `Validation failed: ${decomposed.issues.find((i) => i.severity === 'error')?.message}`
        : 'File failed schema/business-rule validation and cannot be imported.';
      unimportable.push({ sourceName, reason });
      continue;
    }

    const date = extractRecordingDate(flatModel, sourceName);
    if (date === null) {
      unimportable.push({
        sourceName,
        reason:
          'Could not determine the recording date from the filename ' +
          '({mmddYYYY}_{subject}_metadata.yml) or session_id ({subject}_{YYYYMMDD}).',
      });
      continue;
    }

    const subjectId = decomposed.subjectId;
    if (!subjectId) {
      unimportable.push({
        sourceName,
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
    // NB: this intra-batch grouping (here and the `bySubject` keying below) compares the RAW
    // subjectId — unlike the existing-animal match (`findExistingAnimalId`), which is normalized. A
    // multi-file batch carrying both `Remy` and `remy` would therefore plan two separate animals.
    // This is currently unreachable: the sole caller imports ONE file at a time (Import & Repair,
    // post-Phase-7), so a batch never holds two subject ids. If a multi-file import path returns,
    // normalize the grouping key here (trim+lower-case, first-seen raw id wins) to keep the
    // no-fragmentation guarantee the normalized matcher provides.
    const dayKey = `${subjectId} ${date}`;
    const keptSourceName = keptByDayKey.get(dayKey);
    if (keptSourceName !== undefined) {
      unimportable.push({
        sourceName,
        reason: `Duplicate recording date ${date} for subject "${subjectId}" (already provided by ${keptSourceName}).`,
      });
      continue;
    }
    keptByDayKey.set(dayKey, sourceName);

    const entry: FileEntry = {
      sourceName,
      date,
      animalFacts: decomposed.animalFacts,
      dayFacts: decomposed.dayFacts,
      configuration: decomposed.configuration,
    };
    if (!bySubject.has(subjectId)) bySubject.set(subjectId, []);
    bySubject.get(subjectId)!.push(entry);
  }

  const animals: ImportPlanAnimal[] = [];
  let dayCount = 0;
  for (const [subjectId, rawEntries] of bySubject) {
    // Date order (stable): the version-1 = earliest config and first-seen camera ordering
    // both depend on a deterministic earliest-first sort.
    const entries = [...rawEntries].sort((a, b) => a.date.localeCompare(b.date));

    const { configVersions, versionByDate } = resolveConfigVersions(entries);
    const facts = resolveAnimalFacts(entries);
    const existingAnimalId = findExistingAnimalId(subjectId, existingWorkspace);

    const days = entries.map((entry) => buildPlanDay(entry, versionByDate[entry.date]));
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
      subject: facts.subject,
      experimenters: facts.experimenters,
      optogenetics: facts.optogenetics,
      devices: facts.devices,
      cameras: facts.cameras,
      configVersions,
      days,
      divergences: facts.divergences,
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
