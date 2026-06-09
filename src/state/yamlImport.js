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
 * Two stages so phase-6b can reuse the second:
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
 * Whether the flat model carries an optogenetics session. The merge emits the
 * compatibility key `opto_software` ONLY for an opto session (and deletes it
 * otherwise), so its mere presence is the authoritative opto-vs-not signal — more
 * robust than inspecting the (always-present-but-possibly-empty) opto arrays.
 *
 * @param {object} flatModel - Decoded flat YAML model.
 * @returns {boolean} True when the model represents an optogenetics session.
 */
function hasOpto(flatModel) {
  return Object.hasOwn(flatModel, 'opto_software');
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
 * Attribution (mirrors the merge's read sources — see the merge JSDoc):
 * - animalFacts ← experimenters / subject (incl. weight, which the day overrides) /
 *   data_acq_device catalog / cameras / device / optogenetics (null when absent).
 * - dayFacts ← session (description, id, experiment_description, weight) / keywords /
 *   tasks / associated_files / associated_video_files / behavioral_events / technical
 *   params / fs_gui_yamls (DAY-owned) / data_acq_device_name / cameras_used.
 * - configuration ← electrode_groups + ntrode_electrode_group_channel_map.
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

  const subjectId = flatModel.subject?.subject_id;

  // The animal's data_acq_device CATALOG is the one device the flat model carries
  // (the merge exports exactly one); the day references it by name. Keep both in
  // sync so the re-merge resolves the same single device.
  const dataAcqDevice = flatModel.data_acq_device ?? [];

  const animalFacts = {
    experimenters: {
      experimenter_name: flatModel.experimenter_name,
      lab: flatModel.lab,
      institution: flatModel.institution,
    },
    subject: flatModel.subject,
    devices: {
      data_acq_device: dataAcqDevice,
      device: flatModel.device,
    },
    cameras: flatModel.cameras ?? [],
    optogenetics: decomposeOptogenetics(flatModel),
  };

  const dayFacts = {
    session: {
      session_description: flatModel.session_description,
      session_id: flatModel.session_id,
      // experiment_description is attributed to the DAY (landmine 5); the animal-level
      // default is left undefined so the merge's `day || animal || ''` re-emits this.
      experiment_description: flatModel.experiment_description,
      // weight is a day override of the subject weight (landmine 4).
      weight: flatModel.subject?.weight,
    },
    // keywords is OMITTED-when-empty by the merge; recompose with `?? []` so the
    // merge re-omits when it was absent (landmine 8).
    keywords: flatModel.keywords ?? [],
    tasks: flatModel.tasks ?? [],
    associated_files: flatModel.associated_files ?? [],
    associated_video_files: flatModel.associated_video_files ?? [],
    behavioral_events: flatModel.behavioral_events ?? [],
    technical: {
      // units / default_header_file_path are OMITTED-when-empty by the merge; pass
      // through as-is (units may be undefined; header defaults to '') so it re-omits.
      units: flatModel.units,
      times_period_multiplier: flatModel.times_period_multiplier,
      raw_data_to_volts: flatModel.raw_data_to_volts,
      default_header_file_path: flatModel.default_header_file_path ?? '',
    },
    // fs_gui_yamls is DAY-owned (landmine 2) — never inside optogenetics.
    fs_gui_yamls: flatModel.fs_gui_yamls ?? [],
    // The day references its single recording system by name; the catalog above holds it.
    data_acq_device_name: dataAcqDevice?.[0]?.name,
    // cameras_used pins exactly the exported camera set in catalog order (landmine 3),
    // so `resolveDayCameraUsage` re-emits exactly these cameras.
    cameras_used: (flatModel.cameras ?? []).map((camera) => camera.id),
  };

  const configuration = {
    electrode_groups: flatModel.electrode_groups ?? [],
    ntrode_electrode_group_channel_map: flatModel.ntrode_electrode_group_channel_map ?? [],
  };

  return { ok: true, subjectId, animalFacts, dayFacts, configuration };
}

/**
 * Rebuild the minimal `{ animal, day }` the export merge reads, from a successful
 * {@link decomposeYaml} result. Exported so phase-6b (import-into-store) can reuse it.
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
 *
 * @param {{ subjectId: (string|undefined), animalFacts: object, dayFacts: object, configuration: object }} decomposed
 *   A successful decompose result.
 * @returns {{ animal: object, day: object }} The minimal animal + day re-mergeable to the
 *   original flat model.
 */
export function recomposeDayModel({ subjectId, animalFacts, dayFacts, configuration }) {
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

  return { animal, day };
}
