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
import {
  getAnimalCameras,
  getConfigHistory,
  getDataAcqDevices,
  getAnimalDevices,
  getAnimalExperimenters,
  getAnimalSubject,
  getDaySession,
  getDayTasks,
  getDayAssociatedFiles,
  getDayAssociatedVideos,
  getDayBehavioralEvents,
  getDayKeywords,
  getDayFsGuiYamls,
  getProbeElectrodeGroups,
  getProbeNtrodeMaps,
} from './workspaceSelectors';

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
// camera_id is schema-required (nwb_schema.json fs_gui_yamls item) and read by the
// converter; state_script_parameters is a legacy UI-control key with no schema property
// and is dropped by the sanitizer below (reorderKeys is lossless, so listing it out of
// the order is not enough).
const FS_GUI_YAML_ORDER = ['name', 'epochs', 'power_in_mW', 'dio_output_name', 'camera_id', 'pulseLength'];
// fs_gui UI-control keys with no schema property; explicitly stripped from exported items.
const FS_GUI_NON_SCHEMA_KEYS = ['state_script_parameters'];

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
 * Emit virus_injection items carrying BOTH volume spellings with one value.
 *
 * trodes_to_nwb reads `volume_in_uL` (capital L); the bundled schema requires
 * `volume_in_ul` (lowercase). Emitting both — derived from whichever spelling the
 * stored data carried — lets the same YAML pass app AJV and convert without the
 * converter silently dropping the whole optogenetics block. The duplicate is a
 * deliberate, documented compatibility shim until the schema and converter agree on one
 * canonical spelling (see docs/REFACTOR_CHANGELOG.md and docs/PIPELINE_REQUIREMENTS.md).
 *
 * @param {Array} items - Raw virus_injection items.
 * @returns {Array} Reordered items with both `volume_in_uL` and `volume_in_ul` set.
 */
function emitVirusInjections(items) {
  if (!Array.isArray(items)) return items;
  return items.map((item) => {
    const reordered = reorderKeys(item, VIRUS_INJECTION_ORDER);
    if (!isPlainRecord(reordered)) return reordered;
    const volume = reordered.volume_in_uL ?? reordered.volume_in_ul;
    if (volume !== undefined) {
      reordered.volume_in_uL = volume;
      reordered.volume_in_ul = volume;
    }
    return reordered;
  });
}

/**
 * Emit fs_gui_yamls items reordered and stripped of non-schema UI-control keys.
 *
 * `reorderKeys` is lossless (it preserves keys outside the order template), so a legacy
 * UI-only key like `state_script_parameters` would otherwise survive into the export.
 * Strip it explicitly here. `camera_id` (schema-required, converter-read) stays.
 *
 * @param {Array} items - Raw fs_gui_yamls items.
 * @returns {Array} Reordered, sanitized items.
 */
function emitFsGuiYamls(items) {
  if (!Array.isArray(items)) return items;
  return items.map((item) => {
    const reordered = reorderKeys(item, FS_GUI_YAML_ORDER);
    if (!isPlainRecord(reordered)) return reordered;
    FS_GUI_NON_SCHEMA_KEYS.forEach((key) => delete reordered[key]);
    return reordered;
  });
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
  const history = getConfigHistory(animal);
  if (history.length === 0) {
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
    : getProbeElectrodeGroups(config.devices);
  const baseNtrodes = Array.isArray(day.deviceOverrides?.ntrode_electrode_group_channel_map)
    ? day.deviceOverrides.ntrode_electrode_group_channel_map
    : getProbeNtrodeMaps(config.devices);

  // Apply day-level bad-channel overrides onto the resolved ntrode map. The override
  // map is keyed by ntrode_id; a present, WELL-FORMED (array) entry REPLACES that
  // ntrode's `bad_channels`. Anything malformed is NOT applied to the geometry row:
  //  - a non-record container (e.g. scalar "2.9") is ignored wholesale;
  //  - a non-array value under a valid key is declined (the base row is kept) — we do
  //    NOT smear the scalar onto the row, because that surfaces as an Animal-Editor
  //    schema error on a field the user can't reach there. The corruption is instead
  //    surfaced by `dayOverrideIssues` as a day-routed blocker (which reads the raw
  //    override directly), so it is neither laundered nor hidden — just routed to its
  //    real owner. An override keyed to an absent ntrode_id is likewise left to
  //    `dayOverrideIssues`, not applied here.
  const overrides = day.deviceOverrides?.bad_channels;
  const baseArray = Array.isArray(baseNtrodes) ? baseNtrodes : [];
  const ntrodes = isPlainRecord(overrides)
    ? baseArray.map((n) => {
        if (!Object.hasOwn(overrides, String(n.ntrode_id))) return n;
        const ov = overrides[String(n.ntrode_id)];
        return Array.isArray(ov) ? { ...n, bad_channels: [...ov] } : n;
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

  const devices = normalizeDevices(getAnimalDevices(animal));
  // Raw animal/day fields read through the canonical shape-safe selectors — the single
  // place these guards live, so the merge can't drift from the editors. A malformed
  // import still surfaces as a validation issue downstream (normalization never decides
  // export validity); it just can't crash the merge here.
  const cameras = getAnimalCameras(animal);
  const opto = animal.optogenetics || null;
  const experimenters = getAnimalExperimenters(animal);
  const session = getDaySession(day);
  const technical = isPlainRecord(day.technical) ? day.technical : {};
  const subject = getAnimalSubject(animal);

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
    keywords: getDayKeywords(day),

    // === From Animal: Subject (with day weight override) ===
    subject: reorderKeys(
      {
        ...subject,
        weight: session.weight !== undefined ? session.weight : subject.weight,
      },
      SUBJECT_ORDER
    ),

    // === From Animal: Data Acquisition ===
    // Read from RAW animal (not the normalized `devices` above): byte-safe ONLY because
    // normalizeDevices does not transform data_acq_device items (it structuredClones them).
    // If the normalizer ever starts normalizing these, route this through `devices` instead.
    data_acq_device: getDataAcqDevices(animal).map((d) =>
      reorderKeys(d, DATA_ACQ_DEVICE_ORDER)
    ),

    // === From Animal: Cameras ===
    cameras: cameras.map((c) => reorderKeys(c, CAMERA_ORDER)),

    // === From Day: Behavioral Protocol ===
    tasks: getDayTasks(day).map((t) => reorderKeys(t, TASK_ORDER)),

    // === From Day: Data Files ===
    associated_files: getDayAssociatedFiles(day).map((f) =>
      reorderKeys(f, ASSOCIATED_FILE_ORDER)
    ),
    associated_video_files: getDayAssociatedVideos(day).map((v) =>
      reorderKeys(v, ASSOCIATED_VIDEO_FILE_ORDER)
    ),

    // === From Day: Technical Parameters ===
    units: reorderKeys(technical.units, UNITS_ORDER),
    times_period_multiplier: technical.times_period_multiplier,
    raw_data_to_volts: technical.raw_data_to_volts,
    default_header_file_path: technical.default_header_file_path,

    // === From Day: Behavioral Events ===
    behavioral_events: getDayBehavioralEvents(day).map((e) =>
      reorderKeys(e, BEHAVIORAL_EVENT_ORDER)
    ),

    // === From Animal: Device ===
    device: reorderKeys(devices.device, DEVICE_ORDER),

    // === Optogenetics: always present (empty when no opto), matching legacy formData.
    // Nested items are reordered to legacy item order too, so an opto session is
    // also byte-identical to a legacy opto export. ===
    opto_excitation_source: opto ? reorderItems(opto.opto_excitation_source, OPTO_EXCITATION_SOURCE_ORDER) : [],
    optical_fiber: opto ? reorderItems(opto.optical_fiber, OPTICAL_FIBER_ORDER) : [],
    virus_injection: opto ? emitVirusInjections(opto.virus_injection) : [],
    fs_gui_yamls: getDayFsGuiYamls(day).length > 0 ? emitFsGuiYamls(getDayFsGuiYamls(day)) : [],
    // Converter gate key (trodes_to_nwb reads this) + schema spelling (`opto_software`),
    // emitted with the same value for an opto session. `opto_software` is deleted below
    // for a no-opto session so non-opto exports stay byte-identical to legacy.
    optogenetic_stimulation_software: opto ? opto.optogenetic_stimulation_software : '',
    opto_software: opto ? opto.optogenetic_stimulation_software : '',

    // === From Configuration Version (or Day Override): Electrode Groups ===
    electrode_groups: electrodeGroups.map((g) => reorderKeys(g, ELECTRODE_GROUP_ORDER)),
    ntrode_electrode_group_channel_map: ntrodeMap.map((n) => reorderKeys(n, NTRODE_ORDER)),
  };

  // Omit the optional schema-constrained keys when empty. The schema permits them
  // ABSENT but rejects them present-but-empty (keywords minItems, units required
  // analog, default_header_file_path non-empty pattern), so emitting an empty value
  // would make a complete day fail validation. `delete` preserves the insertion
  // order of the remaining keys, so the legacy byte order is unaffected.
  if (getDayKeywords(day).length === 0) {
    delete merged.keywords;
  }
  if (!(technical.units && Object.keys(technical.units).length > 0)) {
    delete merged.units;
  }
  if (!technical.default_header_file_path) {
    delete merged.default_header_file_path;
  }
  // The schema-spelling opto software key is a compatibility duplicate only meaningful
  // for an opto session; drop it when there is no optogenetics so a non-opto export is
  // byte-identical to the legacy formData shape (which has no `opto_software`).
  if (!opto) {
    delete merged.opto_software;
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

/**
 * Builds an empty workspace in the canonical default shape: the three required
 * top-level sections (`animals`, `days`, `settings`) plus `version`/`lastModified`.
 *
 * Single source of truth for the "fresh / empty workspace" structure, shared by the
 * store's hydration fallback and the persistence layer's empty-blob repair, so the
 * default settings shape can never drift between those two paths.
 *
 * @returns {{ version: string, lastModified: string, animals: object, days: object, settings: object }}
 */
export function createDefaultWorkspace() {
  return {
    version: '1.0.0',
    lastModified: getCurrentTimestamp(),
    animals: {},
    days: {},
    settings: {
      defaultLab: '',
      defaultInstitution: '',
      defaultExperimenters: [],
      autoSaveInterval: 30000,
      shadowExportEnabled: true,
    },
  };
}
