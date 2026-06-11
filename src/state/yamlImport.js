/**
 * @fileoverview Internal YAML decompose module — the inverse of the export merge.
 *
 * `mergeDayMetadata` ({@link module:state/workspaceUtils}) composes a flat NWB YAML
 * object from an animal (shared facts: subject, devices, cameras, experimenters,
 * optogenetics) and a day (session, tasks, files, technical params, fs_gui, config
 * pin). This module inverts that: given a flat YAML model, it ATTRIBUTES each field
 * back to the layer the merge reads it from, then rebuilds a minimal animal + day
 * whose re-merge reproduces the original flat model byte-for-byte.
 *
 * Two stages; the second is exercised by the import round-trip gate:
 *   1. {@link decomposeYaml} — validate + attribute → a typed result carrying
 *      `animalFacts` / `dayFacts` / `configuration` (no live store coupling).
 *   2. {@link recomposeDayModel} — rebuild the minimal `{ animal, day }` in the exact
 *      shapes the merge reads (per the round-trip landmines documented inline).
 *
 * The round-trip gate is byte-identity over GENUINE merge outputs:
 *   `f = encodeYaml(mergeDayMetadata(animal, day))`;
 *   `recomposeDayModel(decomposeYaml(decodeYaml(f)))` re-merges to exactly `f`.
 *
 * NOT in scope (callers handle these): multi-file grouping, config-version inference
 * across dates, conflict handling, the import UI, importing into the live store.
 *
 * @module state/yamlImport
 */

import { validate } from '../validation';

/**
 * Whether the flat model carries an optogenetics session.
 *
 * This app's OWN export emits the compatibility key `opto_software` only for an opto session
 * (deleted otherwise), so its presence is authoritative for files this app wrote. But a LEGACY or
 * externally-produced file may carry real opto data (`optogenetic_stimulation_software` + populated
 * `opto_excitation_source` / `optical_fiber` / `virus_injection`) WITHOUT `opto_software` — relying
 * on `opto_software` alone silently drops that animal-level opto metadata on import. So treat the
 * model as opto when ANY authoritative signal is present.
 *
 * Uses NON-EMPTY array checks and a non-blank software string so the inverse holds: a non-opto
 * export (the merge emits empty `[]` opto arrays and `optogenetic_stimulation_software: ''`, with
 * `opto_software` absent) correctly reads as non-opto, preserving round-trip byte identity.
 *
 * @param {object} flatModel - Decoded flat YAML model.
 * @returns {boolean} True when the model represents an optogenetics session.
 */
function hasOpto(flatModel) {
  if (flatModel === null || typeof flatModel !== 'object') return false;
  const nonEmptyArray = (key) => Array.isArray(flatModel[key]) && flatModel[key].length > 0;
  return (
    Object.hasOwn(flatModel, 'opto_software') ||
    (typeof flatModel.optogenetic_stimulation_software === 'string' &&
      flatModel.optogenetic_stimulation_software.trim() !== '') ||
    nonEmptyArray('opto_excitation_source') ||
    nonEmptyArray('optical_fiber') ||
    nonEmptyArray('virus_injection')
  );
}

/**
 * Attribute the animal-owned optogenetics facts from a flat model, or `null` when
 * the model is non-opto.
 *
 * CRITICAL (round-trip landmine 1): a non-opto model MUST yield `null`, never `{}`.
 * An empty object is truthy, so the merge's `animal.optogenetics || null` test would
 * treat `{}` as present and emit the opto keys + `opto_software`, breaking byte
 * identity for a non-opto export. `fs_gui_yamls` is DAY-owned (landmine 2) and is
 * deliberately NOT placed here.
 *
 * @param {object} flatModel - Decoded flat YAML model.
 * @returns {(object|null)} Populated optogenetics facts, or `null` for a non-opto model.
 */
function decomposeOptogenetics(flatModel) {
  if (!hasOpto(flatModel)) return null;
  return {
    opto_excitation_source: flatModel.opto_excitation_source ?? [],
    optical_fiber: flatModel.optical_fiber ?? [],
    virus_injection: flatModel.virus_injection ?? [],
    // Prefer the converter spelling; fall back to the schema-spelling duplicate.
    optogenetic_stimulation_software:
      flatModel.optogenetic_stimulation_software ?? flatModel.opto_software,
  };
}

/**
 * Decompose a flat NWB YAML model into the layered facts the export merge reads,
 * the inverse of {@link module:state/workspaceUtils.mergeDayMetadata}.
 *
 * Validates the model first (schema + business rules). If ANY issue has
 * `severity === 'error'`, returns `{ ok: false, issues }` and NO partial result —
 * a corrupt import must be rejected wholesale, never half-attributed. On success
 * returns `{ ok: true, subjectId, animalFacts, dayFacts, configuration }`.
 *
 * NOTE: an `ok: true` result may still have `subjectId: undefined` — a model can pass
 * validation yet carry no `subject.subject_id`, making it un-attributable to an animal.
 * `planImport` re-checks this and routes such a file to `unimportable`.
 *
 * Ownership: on success the returned pieces are DEEP-CLONED from the input (the
 * function `structuredClone`s `flatModel` once, after the rejection check, and
 * attributes everything from the clone). The returned `animalFacts` / `dayFacts` /
 * `configuration` therefore OWN their nested arrays/objects — they do not alias
 * `flatModel`. A consumer may mutate the result without corrupting the caller's
 * input (and vice-versa), mirroring `mergeDayMetadata`'s own `structuredClone`
 * boundary. The rejection path does NOT clone (no need to clone rejected input).
 *
 * Attribution (mirrors the merge's read sources — see the merge JSDoc):
 * - animalFacts ← experimenters / subject (incl. weight, which the day overrides) /
 *   data_acq_device catalog / cameras / device / optogenetics (null when absent).
 * - dayFacts ← session (description, id, experiment_description, weight) / keywords /
 *   tasks / associated_files / associated_video_files / behavioral_events / technical
 *   params / fs_gui_yamls (DAY-owned) / data_acq_device_name / cameras_used /
 *   deviceOverrides.bad_channels (DAY-owned — extracted from the ntrode rows).
 * - configuration ← electrode_groups + ntrode_electrode_group_channel_map (with
 *   bad_channels emptied — they are day-owned, not snapshot-base).
 *
 * @param {object} flatModel - Decoded flat YAML metadata (a `mergeDayMetadata` output).
 * @returns {{ ok: true, subjectId: (string|undefined), animalFacts: object, dayFacts: object, configuration: object }
 *   | { ok: false, issues: import('../validation').Issue[] }}
 *   The typed decompose result, or a rejection carrying the blocking issues.
 */
export function decomposeYaml(flatModel) {
  const issues = validate(flatModel);
  const errors = issues.filter((issue) => issue.severity === 'error');
  if (errors.length > 0) {
    return { ok: false, issues };
  }

  // Deep-clone once (only after the rejection check passes) so the returned pieces
  // OWN their nested arrays/objects rather than aliasing the caller's `flatModel`.
  // Mirrors `mergeDayMetadata`'s final `structuredClone(merged)` ownership boundary.
  const model = structuredClone(flatModel);

  const subjectId = model.subject?.subject_id;

  // Bad channels are DAY-OWNED: the export merge (`resolveDayConfig`) reads each
  // ntrode's effective `bad_channels` from `day.deviceOverrides.bad_channels`
  // ONLY — never from the config-snapshot base. Attribute the flat model's marks
  // to the day override up front (keyed by `ntrode_id`, only non-empty arrays get
  // an entry) and EMPTY the snapshot base rows, so the recomposed model is
  // self-consistent without depending on the load-time base→day migration. This
  // matches the post-migration shape the merge expects.
  const importedNtrodes = Array.isArray(model.ntrode_electrode_group_channel_map)
    ? model.ntrode_electrode_group_channel_map
    : [];
  const dayBadChannels = {};
  for (const ntrode of importedNtrodes) {
    if (ntrode === null || typeof ntrode !== 'object') continue;
    const marks = ntrode.bad_channels;
    if (Array.isArray(marks) && marks.length > 0) {
      dayBadChannels[String(ntrode.ntrode_id)] = [...marks];
    }
    // Strip the base row's marks so the config snapshot carries none (day-owned).
    ntrode.bad_channels = [];
  }

  // The animal's data_acq_device CATALOG is the one device the flat model carries
  // (the merge exports exactly one); the day references it by name. Keep both in
  // sync so the re-merge resolves the same single device.
  const dataAcqDevice = model.data_acq_device ?? [];

  const animalFacts = {
    experimenters: {
      experimenter_name: model.experimenter_name,
      lab: model.lab,
      institution: model.institution,
    },
    subject: model.subject,
    devices: {
      data_acq_device: dataAcqDevice,
      device: model.device,
    },
    cameras: model.cameras ?? [],
    optogenetics: decomposeOptogenetics(model),
  };

  const dayFacts = {
    session: {
      session_description: model.session_description,
      session_id: model.session_id,
      // experiment_description is attributed to the DAY (landmine 5); the animal-level
      // default is left undefined so the merge's `day || animal || ''` re-emits this.
      experiment_description: model.experiment_description,
      // weight is a day override of the subject weight (landmine 4).
      weight: model.subject?.weight,
    },
    // keywords is OMITTED-when-empty by the merge; recompose with `?? []` so the
    // merge re-omits when it was absent (landmine 8).
    keywords: model.keywords ?? [],
    tasks: model.tasks ?? [],
    associated_files: model.associated_files ?? [],
    associated_video_files: model.associated_video_files ?? [],
    behavioral_events: model.behavioral_events ?? [],
    technical: {
      // units / default_header_file_path are OMITTED-when-empty by the merge; pass
      // through as-is (units may be undefined; header defaults to '') so it re-omits.
      units: model.units,
      times_period_multiplier: model.times_period_multiplier,
      raw_data_to_volts: model.raw_data_to_volts,
      default_header_file_path: model.default_header_file_path ?? '',
    },
    // fs_gui_yamls is DAY-owned (landmine 2) — never inside optogenetics.
    fs_gui_yamls: model.fs_gui_yamls ?? [],
    // The day references its single recording system by name; the catalog above holds it.
    data_acq_device_name: dataAcqDevice?.[0]?.name,
    // cameras_used pins exactly the exported camera set in catalog order (landmine 3),
    // so `resolveDayCameraUsage` re-emits exactly these cameras.
    cameras_used: (model.cameras ?? []).map((camera) => camera.id),
    // Bad channels are DAY-OWNED (the merge reads only the day override). Carry the
    // per-ntrode marks extracted above; `undefined` when none so recompose can omit
    // an empty override entirely.
    deviceOverrides:
      Object.keys(dayBadChannels).length > 0 ? { bad_channels: dayBadChannels } : undefined,
  };

  const configuration = {
    electrode_groups: model.electrode_groups ?? [],
    ntrode_electrode_group_channel_map: model.ntrode_electrode_group_channel_map ?? [],
  };

  return { ok: true, subjectId, animalFacts, dayFacts, configuration };
}

/**
 * Rebuild the minimal `{ animal, day }` the export merge reads, from a successful
 * {@link decomposeYaml} result. Exported for the import round-trip gate
 * (`yamlImport.roundtrip.test.js`), which proves `decomposeYaml` inverts the merge:
 * `recomposeDayModel(decomposeYaml(decodeYaml(f)))` re-merges to exactly `f`. The
 * importer itself builds its plan directly from `decomposeYaml` and does NOT call this.
 *
 * The shapes here are intentionally minimal but EXACT — every field the merge reads
 * is placed where the merge (and its selectors / `resolveDayConfig` /
 * `resolveDayDataAcqDevice` / `resolveDayCameraUsage`) expects it, so re-merging the
 * result is byte-identical to the original flat model. Identity-only fields the merge
 * never reads (`day.date`, ids, timestamps) use stable placeholders.
 *
 * Round-trip landmines honored:
 *  1. `animal.optogenetics` is the `null`-or-populated value from decompose (never `{}`).
 *  2. `fs_gui_yamls` lives on the DAY.
 *  3. `day.cameras_used` pins the exact exported camera set in order.
 *  4. `day.session.weight` carries the subject-weight override.
 *  5. `day.session.experiment_description` holds it; `animal.experiment_description`
 *     stays undefined.
 *  6. `animal.devices.data_acq_device` is the catalog; `day.data_acq_device_name` refs it.
 *  7. A single config snapshot (`version: 1`) holds the electrode groups + ntrode map;
 *     `day.configurationVersion = 1` pins it. Merge normalize/reorder is idempotent on
 *     genuine merge output.
 *  8. Omitted-when-empty fields (`keywords`/`units`/`default_header_file_path`) are passed
 *     through so the merge re-omits them.
 *  9. `bad_channels` are DAY-OWNED on `day.deviceOverrides.bad_channels` (keyed by
 *     `ntrode_id`); the snapshot base rows are empty. The merge reads the day override
 *     only, so this reproduces the source marks without the load-time migration.
 *
 * Precondition: pass a SUCCESSFUL ({@link decomposeYaml} `ok: true`) result. A
 * failed result (`ok: false`) is rejected up front with a clear error rather than
 * throwing an opaque destructuring error deeper in the function.
 *
 * @param {{ ok?: boolean, subjectId: (string|undefined), animalFacts: object, dayFacts: object, configuration: object }} decomposed
 *   A successful decompose result.
 * @returns {{ animal: object, day: object }} The minimal animal + day re-mergeable to the
 *   original flat model.
 * @throws {Error} If handed a failed (`ok: false`) decompose result.
 */
export function recomposeDayModel(decomposed) {
  if (decomposed?.ok === false) {
    throw new Error('recomposeDayModel requires a successful decomposeYaml result');
  }
  const { subjectId, animalFacts, dayFacts, configuration } = decomposed;
  const animalId = subjectId ?? 'imported-animal';
  // Identity-only placeholders: the merge never reads day.date / ids / timestamps,
  // so any stable value is fine and keeps the result deterministic.
  const date = '1970-01-01';
  const dayId = `${animalId}-${date}`;

  const animal = {
    id: animalId,
    subject: animalFacts.subject,
    experimenters: animalFacts.experimenters,
    devices: {
      data_acq_device: animalFacts.devices.data_acq_device,
      device: animalFacts.devices.device,
      // The live editable config mirrors the (only) snapshot; not read by the merge
      // (it resolves from configurationHistory), included only for shape completeness.
      electrode_groups: configuration.electrode_groups,
      ntrode_electrode_group_channel_map: configuration.ntrode_electrode_group_channel_map,
    },
    cameras: animalFacts.cameras,
    // null-or-populated, never `{}` (landmine 1).
    optogenetics: animalFacts.optogenetics,
    // experiment_description deliberately left undefined (landmine 5).
    days: [dayId],
    configurationHistory: [
      {
        version: 1,
        devices: {
          electrode_groups: configuration.electrode_groups,
          ntrode_electrode_group_channel_map: configuration.ntrode_electrode_group_channel_map,
        },
        appliedToDays: [],
      },
    ],
  };

  const day = {
    id: dayId,
    animalId,
    date,
    session: dayFacts.session,
    keywords: dayFacts.keywords,
    tasks: dayFacts.tasks,
    associated_files: dayFacts.associated_files,
    associated_video_files: dayFacts.associated_video_files,
    behavioral_events: dayFacts.behavioral_events,
    technical: dayFacts.technical,
    fs_gui_yamls: dayFacts.fs_gui_yamls,
    data_acq_device_name: dayFacts.data_acq_device_name,
    cameras_used: dayFacts.cameras_used,
    configurationVersion: 1,
  };

  // Bad channels are DAY-OWNED (landmine 9): the merge reads `bad_channels` from the
  // day override ONLY, so place the decomposed per-ntrode marks here. Omitted when
  // the source carried none, so the override stays absent (and the merge re-emits []).
  if (dayFacts.deviceOverrides) {
    day.deviceOverrides = dayFacts.deviceOverrides;
  }

  return { animal, day };
}
