/**
 * @fileoverview Utility functions for workspace operations
 *
 * This module provides pure utility functions for working with animal/day data,
 * particularly the critical mergeDayMetadata function that combines animal defaults
 * with day-specific data to produce complete NWB metadata for YAML export.
 *
 * @see docs/ANIMAL_WORKSPACE_DESIGN.md §5 YAML Export Flow
 */

import {
  normalizeDevices,
  normalizeElectrodeGroup,
  normalizeNtrodeMap,
} from '../utils/deviceNormalization';

// Canonical key orders, mirroring the legacy `formData` shape in
// `src/valueList.js` (`defaultYMLValues` / `arrayDefaultValues`). `encodeYaml`
// preserves insertion order, so emitting keys in these orders makes the new
// export path byte-for-byte identical to the legacy export for equivalent data.
const SUBJECT_ORDER = ['description', 'genotype', 'sex', 'species', 'subject_id', 'date_of_birth', 'weight'];
const DEVICE_ORDER = ['name'];
const UNITS_ORDER = ['analog', 'behavioral_events'];
const DATA_ACQ_DEVICE_ORDER = ['name', 'system', 'amplifier', 'adc_circuit'];
const CAMERA_ORDER = ['id', 'meters_per_pixel', 'manufacturer', 'model', 'lens', 'camera_name'];
const TASK_ORDER = ['task_name', 'task_description', 'task_environment', 'camera_id', 'task_epochs'];
const ASSOCIATED_FILE_ORDER = ['name', 'description', 'path', 'task_epochs'];
const ASSOCIATED_VIDEO_FILE_ORDER = ['name', 'camera_id', 'task_epochs'];
const BEHAVIORAL_EVENT_ORDER = ['description', 'name'];
const ELECTRODE_GROUP_ORDER = ['id', 'location', 'device_type', 'description', 'targeted_location', 'targeted_x', 'targeted_y', 'targeted_z', 'units'];
const NTRODE_ORDER = ['ntrode_id', 'electrode_group_id', 'bad_channels', 'map'];
const OPTO_EXCITATION_SOURCE_ORDER = ['name', 'model_name', 'description', 'wavelength_in_nm', 'power_in_W', 'intensity_in_W_per_m2'];
const OPTICAL_FIBER_ORDER = ['name', 'hardware_name', 'implanted_fiber_description', 'location', 'hemisphere', 'ap_in_mm', 'ml_in_mm', 'dv_in_mm', 'roll_in_deg', 'pitch_in_deg', 'yaw_in_deg', 'reference', 'excitation_source'];
const VIRUS_INJECTION_ORDER = ['name', 'description', 'hemisphere', 'location', 'ap_in_mm', 'ml_in_mm', 'dv_in_mm', 'roll_in_deg', 'pitch_in_deg', 'yaw_in_deg', 'reference', 'virus_name', 'titer_in_vg_per_ml', 'volume_in_uL'];
const FS_GUI_YAML_ORDER = ['name', 'epochs', 'power_in_mW', 'dio_output_name', 'state_script_parameters', 'pulseLength'];

/**
 * Whether `value` is a plain object record (not null, not an array). Used to guard
 * nested record dereferences in the merge so a malformed import can't crash it.
 *
 * @param {*} value - Candidate record.
 * @returns {boolean} True for a non-null, non-array object.
 */
function isPlainRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

/**
 * Reorder each item of an array to match a key template (lossless). Non-array
 * inputs pass through unchanged.
 *
 * @param {Array} arr - Array of plain objects.
 * @param {string[]} order - Canonical key sequence for each item.
 * @returns {Array} New array with each item's keys reordered.
 */
function reorderItems(arr, order) {
  return Array.isArray(arr) ? arr.map((item) => reorderKeys(item, order)) : arr;
}

/**
 * Return a new object with `obj`'s keys ordered to match `order`. Known keys come
 * first in `order` sequence; any keys NOT in the template are appended in their
 * original order — so reordering is lossless (a field the template doesn't know
 * about is preserved, never dropped). Non-object inputs are returned unchanged.
 *
 * @param {object} obj - Object to reorder.
 * @param {string[]} order - Canonical key sequence.
 * @returns {object} Reordered shallow copy (or `obj` if not a plain object).
 */
function reorderKeys(obj, order) {
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return obj;
  const result = {};
  for (const key of order) {
    if (Object.hasOwn(obj, key)) result[key] = obj[key];
  }
  for (const key of Object.keys(obj)) {
    if (!Object.hasOwn(result, key)) result[key] = obj[key];
  }
  return result;
}

/**
 * Resolve a day's **effective** probe configuration: the electrode groups and
 * channel map that actually apply to this recording day.
 *
 * Configuration snapshots are the authoritative source the export resolves from;
 * the day pins which version applies. Selection rule (the single source of truth,
 * shared with {@link mergeDayMetadata}): day `deviceOverrides` > the snapshot the day
 * is pinned to (`day.configurationVersion`) > an empty list. A pinned version with no
 * matching snapshot is persisted-state corruption and **fails closed** (throws) — it
 * never silently falls back to a different version, which would export the wrong
 * probe geometry. An unpinned day (no `configurationVersion`) uses the latest
 * snapshot, the editor default. Day-level `deviceOverrides.bad_channels` are merged
 * onto the resolved ntrode map. Factoring this here keeps the merge and the
 * reconfiguration wizard from diverging.
 *
 * Returns normalized owned device objects; callers that persist the result can do so
 * without carrying legacy string IDs or non-schema electrode keys forward.
 *
 * @param {import('./workspaceTypes').Animal} animal - Parent animal with snapshots.
 * @param {import('./workspaceTypes').Day} day - Recording day.
 * @returns {{ electrode_groups: object[], ntrode_electrode_group_channel_map: object[], configurationVersion: (number|undefined) }}
 *   `configurationVersion` is the version of the snapshot actually resolved (the
 *   latest, for an unpinned day) — callers that surface the version must use this,
 *   not the day's pin, to stay consistent with what is exported.
 * @throws {Error} If the animal has no configuration history, or the day pins a
 *   version with no matching snapshot.
 */
export function resolveDayConfig(animal, day) {
  const history = animal.configurationHistory;
  if (!Array.isArray(history) || history.length === 0) {
    throw new Error(
      `Cannot resolve device configuration for day "${day?.id}": animal "${animal?.id}" has no configuration history.`
    );
  }

  // The day is the source of truth for WHICH snapshot to use. A day that pins a
  // specific version must resolve THAT snapshot — never a silent fallback to a
  // different version, which would export the wrong probe geometry. A pin with no
  // matching snapshot is persisted-state corruption and fails closed. An unpinned
  // day (no configurationVersion — only legacy/test data; `createDay` always pins)
  // uses the latest snapshot, the editor default.
  const hasPin = day.configurationVersion != null;
  const config = hasPin
    ? history.find((c) => c.version === day.configurationVersion)
    : history[history.length - 1];

  if (!config || !config.devices) {
    throw new Error(
      hasPin
        ? `Cannot resolve device configuration for day "${day?.id}": animal "${animal?.id}" has no snapshot for configuration version "${day?.configurationVersion}".`
        : `Cannot resolve device configuration for day "${day?.id}": animal "${animal?.id}" has no usable configuration history.`
    );
  }

  // Prefer the day's deviceOverrides ONLY when they are well-formed arrays. A
  // malformed (non-array) override is corrupt persisted state; using it would
  // crash the `.map` below, so fall back to the snapshot (fail-closed) rather than
  // crash before the repair UI can render.
  const electrodeGroups = Array.isArray(day.deviceOverrides?.electrode_groups)
    ? day.deviceOverrides.electrode_groups
    : (config.devices.electrode_groups || []);
  const baseNtrodes = Array.isArray(day.deviceOverrides?.ntrode_electrode_group_channel_map)
    ? day.deviceOverrides.ntrode_electrode_group_channel_map
    : (config.devices.ntrode_electrode_group_channel_map || []);

  // Apply day-level bad-channel overrides onto the resolved ntrode map. The override
  // map is keyed by ntrode_id; a present entry REPLACES that ntrode's `bad_channels`.
  // A corrupt (non-array) override value is PRESERVED as-is — never spread (a string
  // "23" would become ['2','3'], a number would throw) — so the schema/rules surface
  // it instead of laundering or crashing. An override keyed to an absent ntrode_id is
  // a stale reference surfaced by `dayOverrideIssues`, not applied here.
  const overrides = day.deviceOverrides?.bad_channels;
  const baseArray = Array.isArray(baseNtrodes) ? baseNtrodes : [];
  const ntrodes = overrides && typeof overrides === 'object'
    ? baseArray.map((n) => {
        if (!Object.hasOwn(overrides, String(n.ntrode_id))) return n;
        const ov = overrides[String(n.ntrode_id)];
        return { ...n, bad_channels: Array.isArray(ov) ? [...ov] : ov };
      })
    : baseArray;

  return {
    electrode_groups: (Array.isArray(electrodeGroups) ? electrodeGroups : []).map((group, index) =>
      normalizeElectrodeGroup(group, index)
    ),
    ntrode_electrode_group_channel_map: ntrodes.map((ntrode, index) =>
      normalizeNtrodeMap(ntrode, index)
    ),
    configurationVersion: config.version,
  };
}

/**
 * Merges animal defaults with day-specific data to produce complete NWB metadata.
 *
 * This is the MOST CRITICAL function in the workspace architecture - it must produce
 * EXACTLY the same YAML structure as the legacy single-session exporter. Any deviation
 * will corrupt the trodes_to_nwb pipeline and Spyglass database ingestion.
 *
 * Inheritance Rules:
 * - Animal provides: subject, devices, cameras, experimenters, optogenetics (if present)
 * - Day provides: session, tasks, epochs, files, technical parameters
 * - Day OVERRIDES: weight, experiment_description, cameras, electrode_groups (if specified)
 * - Configuration versions: Day references specific probe configuration from animal history
 *   (resolved by {@link resolveDayConfig}).
 *
 * Key order & always-on keys (byte-for-byte legacy parity):
 * - The merged object's top-level and nested key order mirrors the legacy
 *   `formData` (`defaultYMLValues`), so `encodeYaml(mergeDayMetadata(...))` is
 *   byte-identical to a legacy export of the same session.
 * - The optogenetics keys (`opto_excitation_source`, `optical_fiber`,
 *   `virus_injection`, `optogenetic_stimulation_software`) and `fs_gui_yamls` are
 *   emitted UNCONDITIONALLY — empty (`[]` / `''`) when absent — because the legacy
 *   `formData` always carries them and they are schema-valid when empty.
 * - `keywords`, `units`, and `default_header_file_path` are the exception: they are
 *   omitted when empty (the schema rejects them present-but-empty). In any genuinely
 *   exportable session they are filled, so the bytes still match legacy; only an
 *   incomplete (non-exportable) session differs, and neither path ships it.
 *
 * @param {import('./workspaceTypes').Animal} animal - Parent animal with shared metadata
 * @param {import('./workspaceTypes').Day} day - Recording day with session-specific data
 * @returns {object} Complete NWB metadata ready for YAML export
 *
 * @example
 * const animal = workspace.animals['remy'];
 * const day = workspace.days['remy-2023-06-22'];
 * const metadata = mergeDayMetadata(animal, day);
 * const yaml = encodeYaml(metadata); // Ready for export
 */
export function mergeDayMetadata(animal, day) {
  // Resolve the day's effective probe config (snapshot selection + deviceOverrides
  // precedence) via the shared helper, so the merge and the reconfig wizard's
  // notion of "effective config" cannot drift.
  const { electrode_groups: electrodeGroups, ntrode_electrode_group_channel_map: ntrodeMap } =
    resolveDayConfig(animal, day);

  const devices = normalizeDevices(animal.devices);
  const cameras = Array.isArray(animal.cameras) ? animal.cameras : [];
  const opto = animal.optogenetics || null;
  // Guard nested OBJECT records the same way the array fields are guarded: a
  // malformed import (e.g. day.session a string, animal.experimenters undefined)
  // must produce validation issues downstream, not crash the merge here. Missing
  // leaf fields then surface as schema 'required'/type errors at the export gate.
  const experimenters = isPlainRecord(animal.experimenters) ? animal.experimenters : {};
  const session = isPlainRecord(day.session) ? day.session : {};
  const technical = isPlainRecord(day.technical) ? day.technical : {};
  const subject = isPlainRecord(animal.subject) ? animal.subject : {};

  // Build the merged object in legacy `defaultYMLValues` key order. keywords /
  // units / default_header_file_path are placed at their canonical positions here
  // and deleted below when empty (delete preserves the order of surviving keys).
  const merged = {
    // === From Animal: Experimenters ===
    experimenter_name: experimenters.experimenter_name,
    lab: experimenters.lab,
    institution: experimenters.institution,

    // === From Day: Session ===
    // Per-day value wins; fall back to the animal-level default (what the
    // OverviewStep "leave blank to use animal's default" hint promises).
    experiment_description:
      session.experiment_description || animal.experiment_description || '',
    session_description: session.session_description,
    session_id: session.session_id,
    keywords: Array.isArray(day.keywords) ? day.keywords : [],

    // === From Animal: Subject (with day weight override) ===
    subject: reorderKeys(
      {
        ...subject,
        weight: session.weight !== undefined ? session.weight : subject.weight,
      },
      SUBJECT_ORDER
    ),

    // === From Animal: Data Acquisition ===
    data_acq_device: (Array.isArray(devices.data_acq_device) ? devices.data_acq_device : []).map((d) =>
      reorderKeys(d, DATA_ACQ_DEVICE_ORDER)
    ),

    // === From Animal: Cameras ===
    cameras: cameras.map((c) => reorderKeys(c, CAMERA_ORDER)),

    // === From Day: Behavioral Protocol ===
    tasks: (Array.isArray(day.tasks) ? day.tasks : []).map((t) => reorderKeys(t, TASK_ORDER)),

    // === From Day: Data Files ===
    associated_files: (Array.isArray(day.associated_files) ? day.associated_files : []).map((f) =>
      reorderKeys(f, ASSOCIATED_FILE_ORDER)
    ),
    associated_video_files: (Array.isArray(day.associated_video_files) ? day.associated_video_files : []).map((v) =>
      reorderKeys(v, ASSOCIATED_VIDEO_FILE_ORDER)
    ),

    // === From Day: Technical Parameters ===
    units: reorderKeys(technical.units, UNITS_ORDER),
    times_period_multiplier: technical.times_period_multiplier,
    raw_data_to_volts: technical.raw_data_to_volts,
    default_header_file_path: technical.default_header_file_path,

    // === From Day: Behavioral Events ===
    behavioral_events: (Array.isArray(day.behavioral_events) ? day.behavioral_events : []).map((e) =>
      reorderKeys(e, BEHAVIORAL_EVENT_ORDER)
    ),

    // === From Animal: Device ===
    device: reorderKeys(devices.device, DEVICE_ORDER),

    // === Optogenetics: always present (empty when no opto), matching legacy formData.
    // Nested items are reordered to legacy item order too, so an opto session is
    // also byte-identical to a legacy opto export. ===
    opto_excitation_source: opto ? reorderItems(opto.opto_excitation_source, OPTO_EXCITATION_SOURCE_ORDER) : [],
    optical_fiber: opto ? reorderItems(opto.optical_fiber, OPTICAL_FIBER_ORDER) : [],
    virus_injection: opto ? reorderItems(opto.virus_injection, VIRUS_INJECTION_ORDER) : [],
    fs_gui_yamls: day.fs_gui_yamls && day.fs_gui_yamls.length > 0 ? reorderItems(day.fs_gui_yamls, FS_GUI_YAML_ORDER) : [],
    optogenetic_stimulation_software: opto ? opto.optogenetic_stimulation_software : '',

    // === From Configuration Version (or Day Override): Electrode Groups ===
    electrode_groups: electrodeGroups.map((g) => reorderKeys(g, ELECTRODE_GROUP_ORDER)),
    ntrode_electrode_group_channel_map: ntrodeMap.map((n) => reorderKeys(n, NTRODE_ORDER)),
  };

  // Omit the optional schema-constrained keys when empty. The schema permits them
  // ABSENT but rejects them present-but-empty (keywords minItems, units required
  // analog, default_header_file_path non-empty pattern), so emitting an empty value
  // would make a complete day fail validation. `delete` preserves the insertion
  // order of the remaining keys, so the legacy byte order is unaffected.
  if (!(Array.isArray(day.keywords) && day.keywords.length > 0)) {
    delete merged.keywords;
  }
  if (!(technical.units && Object.keys(technical.units).length > 0)) {
    delete merged.units;
  }
  if (!technical.default_header_file_path) {
    delete merged.default_header_file_path;
  }

  // Return owned data: the assignments above alias nested animal/config arrays and
  // objects. Cloning ensures downstream mutation cannot corrupt animal/config state.
  return structuredClone(merged);
}

/**
 * Formats date in mmddYYYY format for YAML filename
 *
 * @param {string} isoDate - Date in YYYY-MM-DD format
 * @returns {string} Date in mmddYYYY format
 *
 * @example
 * formatExperimentDate('2023-06-22') // => '06222023'
 */
export function formatExperimentDate(isoDate) {
  const [year, month, day] = isoDate.split('-');
  return `${month}${day}${year}`;
}

/**
 * Generates day ID from animal ID and date
 *
 * @param {string} animalId - Animal identifier
 * @param {string} date - Date in YYYY-MM-DD format
 * @returns {string} Day ID in format "{animalId}-{date}"
 *
 * @example
 * generateDayId('remy', '2023-06-22') // => 'remy-2023-06-22'
 */
export function generateDayId(animalId, date) {
  return `${animalId}-${date}`;
}

/**
 * Gets current ISO timestamp
 *
 * @returns {string} ISO 8601 timestamp
 *
 * @example
 * getCurrentTimestamp() // => '2023-06-22T14:30:00.000Z'
 */
export function getCurrentTimestamp() {
  return new Date().toISOString();
}

/**
 * Gets current date in YYYY-MM-DD format
 *
 * @returns {string} Date in YYYY-MM-DD format
 *
 * @example
 * getCurrentDate() // => '2023-06-22'
 */
export function getCurrentDate() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}
