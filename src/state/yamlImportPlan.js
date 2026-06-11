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
import { findIdentityDivergence } from './identityDivergence';
import { getAnimalCameras, getDataAcqDevices } from './workspaceSelectors';

/**
 * Derive a recording day's ISO date (`YYYY-MM-DD`) for an imported flat model. The flat
 * YAML carries NO date field, so it is reconstructed from naming conventions:
 *
 *  - PRIMARY: the `{mmddYYYY}_{subject}_metadata.yml` filename convention (the exact
 *    inverse of {@link module:io/yaml.formatDeterministicFilename}). e.g.
 *    `06222023_remy_metadata.yml` → `2023-06-22`.
 *  - FALLBACK: a `session_id` of the form `{anything}_{YYYYMMDD}`, e.g. `remy_20230622`
 *    → `2023-06-22`.
 *
 * Returns `null` when neither yields a VALID calendar date (the caller treats a dateless
 * file as unimportable with a clear reason). Shape-safe: never throws on a non-object
 * model or an odd `sourceName`.
 *
 * @param {object} flatModel - Decoded flat YAML model.
 * @param {string} [sourceName] - The source filename (used for the primary convention).
 * @returns {(string|null)} ISO `YYYY-MM-DD`, or `null` when no valid date is derivable.
 */
export function extractRecordingDate(flatModel, sourceName) {
  // PRIMARY: filename {mmddYYYY}_{subject}_metadata.yml.
  if (typeof sourceName === 'string') {
    const match = sourceName.match(/^(\d{2})(\d{2})(\d{4})_.+_metadata\.ya?ml$/i);
    if (match) {
      const [, mm, dd, yyyy] = match;
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

  return null;
}

/**
 * Build a validated ISO date string from year/month/day parts, returning `null` if the
 * parts do not form a real calendar date (e.g. month 13, day 32). Round-trips through a
 * UTC Date so impossible dates (which JS would otherwise roll over) are rejected.
 *
 * @param {string} yyyy - Four-digit year.
 * @param {string} mm - Two-digit month.
 * @param {string} dd - Two-digit day.
 * @returns {(string|null)} `YYYY-MM-DD`, or `null` when invalid.
 */
function toIsoDate(yyyy, mm, dd) {
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

/**
 * @typedef {object} ImportPlanDay
 * @property {string} date - ISO `YYYY-MM-DD` recording date.
 * @property {string} sourceName - Source filename.
 * @property {object} session - Day session facts (description, id, experiment_description, weight).
 * @property {Array} keywords
 * @property {Array} tasks
 * @property {Array} associated_files
 * @property {Array} associated_video_files
 * @property {Array} behavioral_events
 * @property {Array} fs_gui_yamls
 * @property {object} technical
 * @property {(string|undefined)} data_acq_device_name
 * @property {number[]} cameras_used
 * @property {({ bad_channels: Record<string, number[]> }|undefined)} deviceOverrides - Day-owned
 *   bad-channel override (keyed by ntrode_id), or undefined when the source carried none.
 * @property {number} configurationVersion - Which configVersion this day pins.
 */

/**
 * @typedef {object} ImportPlanAnimal
 * @property {string} subjectId
 * @property {'none'|'exists'} conflict
 * @property {(string|null)} existingAnimalId
 * @property {('add'|null)} defaultResolution - `'add'` for a conflicting (`conflict: 'exists'`) animal; `null` for a new (`conflict: 'none'`) animal (its resolution is unused — a new animal is always created).
 * @property {object} subject - Resolved subject scalar facts (latest-date-wins).
 * @property {object} experimenters - Resolved experimenters (latest-date-wins).
 * @property {(object|null)} optogenetics - Resolved opto (latest-date-wins) or null.
 * @property {{ data_acq_device: Array, device: * }} devices - Resolved catalogs.
 * @property {Array} cameras - Resolved union camera catalog.
 * @property {Array<{ version: number, date: string, description: string, devices: object, dayDates: string[] }>} configVersions
 * @property {ImportPlanDay[]} days
 * @property {Array<{ field: string, detail: string }>} divergences
 */

/**
 * @typedef {object} ImportPlan
 * @property {ImportPlanAnimal[]} animals
 * @property {Array<{ sourceName: string, reason: string }>} unimportable
 * @property {{ fileCount: number, animalCount: number, dayCount: number }} summary
 */

/**
 * A stable JSON serialization usable as a deep-equality key for a configuration's
 * `{ electrode_groups, ntrode_electrode_group_channel_map }`. Keys are sorted recursively
 * so two configs that differ only in key insertion order hash to the same string (a config
 * is a value, not an ordered record). Arrays keep their order (electrode order is meaningful).
 *
 * @param {*} value - Any JSON-serializable value.
 * @returns {string} A deterministic serialization.
 */
function stableStringify(value) {
  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(',')}]`;
  }
  if (value !== null && typeof value === 'object') {
    const keys = Object.keys(value).sort();
    return `{${keys.map((k) => `${JSON.stringify(k)}:${stableStringify(value[k])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

/**
 * Find the existing workspace animal whose identity matches `subjectId`, either by the
 * animals-map KEY or by a record's `subject.subject_id`. Returns the matching animal's
 * store key (its `existingAnimalId`), or `null` when none matches.
 *
 * @param {string} subjectId - The imported subject id.
 * @param {object} workspace - The existing workspace slice (`{ animals }`).
 * @returns {(string|null)} The conflicting animal's store key, or null.
 */
function findExistingAnimalId(subjectId, workspace) {
  const animals = workspace?.animals;
  if (animals === null || typeof animals !== 'object') return null;
  if (Object.hasOwn(animals, subjectId)) return subjectId;
  for (const [key, animal] of Object.entries(animals)) {
    if (animal?.subject?.subject_id === subjectId) return key;
  }
  return null;
}

/**
 * The subject scalar fields whose disagreement across a subject's files is surfaced as a
 * `subject` divergence (latest-date-wins resolution). Identity-only / structural fields
 * (subject_id, weight) are excluded — weight is a per-day override, not an animal scalar.
 *
 * @type {ReadonlyArray<string>}
 */
const SUBJECT_SCALAR_FIELDS = ['species', 'sex', 'genotype', 'description', 'date_of_birth'];

/**
 * Resolve a subject's configuration VERSIONS from its date-ordered files: the DISTINCT
 * electrode configurations (deep-equal by {@link stableStringify}), numbered 1..K in date
 * order (1 = earliest distinct config). Returns the version list plus a per-file version map.
 *
 * @param {Array<{ date: string, configuration: object }>} entries - Date-sorted file entries.
 * @returns {{ configVersions: Array<{ version: number, date: string, description: string, devices: object, dayDates: string[] }>, versionByDate: Record<string, number> }}
 */
function resolveConfigVersions(entries) {
  const configVersions = [];
  const keyToVersion = new Map();
  const versionByDate = {};

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
 * @param {Array<{ date: string, animalFacts: object }>} entries - Date-sorted file entries.
 * @returns {{ subject: object, experimenters: object, optogenetics: (object|null), devices: object, cameras: Array, divergences: Array<{ field: string, detail: string }> }}
 */
function resolveAnimalFacts(entries) {
  const divergences = [];
  const latest = entries[entries.length - 1].animalFacts;

  // --- cameras: union by camera_name, first-seen order ---
  const cameras = [];
  const cameraRegistry = [];
  const cameraSets = [];
  for (const { animalFacts } of entries) {
    const fileCameras = getAnimalCameras(animalFacts);
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
  const dataAcqDevice = [];
  const dataAcqRegistry = [];
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
 * @param {{ date: string, sourceName: string, dayFacts: object }} entry - File entry.
 * @param {number} configurationVersion - The version this day pins.
 * @returns {ImportPlanDay}
 */
function buildPlanDay(entry, configurationVersion) {
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
 * @param {Array<{ sourceName: string, flatModel: object }>} decodedFiles - Parsed files.
 * @param {object} existingWorkspace - The current workspace slice (`{ animals }`), read-only.
 * @returns {ImportPlan}
 */
export function planImport(decodedFiles, existingWorkspace) {
  const files = Array.isArray(decodedFiles) ? decodedFiles : [];
  const unimportable = [];
  /** @type {Map<string, Array<object>>} subjectId → date-ordered file entries */
  const bySubject = new Map();
  /**
   * `${subjectId} ${date}` → the sourceName of the FIRST (input/source order) file that
   * claimed that (subject, date). Used to dedup intra-plan duplicates so `planImport` never
   * emits two days with the same `generateDayId` for one subject (which would otherwise make
   * the executor's second `createDay` throw inside the store reducer and crash the render).
   * @type {Map<string, string>}
   */
  const keptByDayKey = new Map();

  for (const file of files) {
    const sourceName = file?.sourceName;
    const flatModel = file?.flatModel;

    // Per-file resilience: a single pathological file must NOT abort the whole import
    // preview. If decompose/validate THROWS on this file (e.g. a malformed parse with a
    // throwing accessor), route it to `unimportable` with a clear reason and continue.
    let decomposed;
    try {
      decomposed = decomposeYaml(flatModel);
    } catch (error) {
      unimportable.push({
        sourceName,
        reason: `Could not analyze file: ${error?.message ?? String(error)}`,
      });
      continue;
    }
    if (!decomposed.ok) {
      const reason = decomposed.issues?.find((i) => i.severity === 'error')?.message
        ? `Validation failed: ${decomposed.issues.find((i) => i.severity === 'error').message}`
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

    const entry = {
      sourceName,
      date,
      animalFacts: decomposed.animalFacts,
      dayFacts: decomposed.dayFacts,
      configuration: decomposed.configuration,
    };
    if (!bySubject.has(subjectId)) bySubject.set(subjectId, []);
    bySubject.get(subjectId).push(entry);
  }

  const animals = [];
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
