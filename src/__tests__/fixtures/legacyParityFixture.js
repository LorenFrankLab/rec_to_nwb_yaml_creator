/**
 * Legacy-export reference harness for byte-for-byte parity tests.
 *
 * `buildLegacyFormData` constructs a fully-filled, schema-valid legacy `formData`
 * object in EXACTLY `defaultYMLValues` key order (top-level and nested) — i.e. the
 * shape the legacy single-page form holds and `exportAll` encodes. Encoding it with
 * `encodeYaml` reproduces the bytes a real legacy export would produce for this data.
 *
 * `buildEquivalentWorkspace` constructs the workspace `animal` + `day` that represent
 * the SAME recording session, so that `mergeDayMetadata(animal, day)` must encode to
 * byte-identical output once the merge's key order is aligned to the legacy form.
 *
 * The dataset is a fully-filled, NON-optogenetics session (so the always-on opto /
 * fs_gui keys are present-but-empty, matching legacy) with keywords / units /
 * default_header_file_path all filled (so it is genuinely legacy-exportable — the
 * minimal golden fixtures are not, because legacy validation blocks empty
 * keywords/units/header).
 *
 * Values are deterministic (no Date.now / Math.random).
 *
 * @module __tests__/fixtures/legacyParityFixture
 */

const TS = '2023-06-22T12:00:00.000Z';

const SUBJECT = {
  description: 'Long Evans Rat from Charles River',
  genotype: 'Wild Type',
  sex: 'M',
  species: 'Rattus norvegicus',
  subject_id: 'rat1',
  date_of_birth: '2023-01-10T00:00:00',
  weight: 450,
};

const DATA_ACQ_DEVICE = [
  { name: 'SpikeGadgets', system: 'SpikeGadgets', amplifier: 'Intan', adc_circuit: 'Intan' },
];

const CAMERAS = [
  { id: 0, meters_per_pixel: 0.00085, manufacturer: 'Allied Vision', model: 'Mako G-158', lens: 'Fujinon HF16HA-1B', camera_name: 'overhead_camera' },
  { id: 1, meters_per_pixel: 0.0009, manufacturer: 'Allied Vision', model: 'Mako G-158', lens: 'Fujinon HF16HA-1B', camera_name: 'side_camera' },
];

const TASKS = [
  { task_name: 'sleep', task_description: 'Pre-task rest in home cage', task_environment: 'home cage', camera_id: [0], task_epochs: [1] },
  { task_name: 'w_alternation', task_description: 'W-track continuous alternation', task_environment: 'elevated W-track', camera_id: [0, 1], task_epochs: [2] },
];

const ASSOCIATED_FILES = [
  { name: 'probe_adjustment_log', description: 'Daily probe depth adjustments', path: '/data/rat1/logs/20230101_adjustments.txt', task_epochs: 1 },
];

const ASSOCIATED_VIDEO_FILES = [
  { name: 'overhead_video_epoch2', camera_id: 0, task_epochs: 2 },
];

const BEHAVIORAL_EVENTS = [
  { description: 'Din1', name: 'reward_left' },
  { description: 'Din2', name: 'reward_right' },
];

const ELECTRODE_GROUPS = [
  { id: 0, location: 'CA1', device_type: 'tetrode_12.5', description: 'CA1 tetrode 1', targeted_location: 'CA1', targeted_x: 3, targeted_y: 2.5, targeted_z: 2, units: 'mm' },
  { id: 1, location: 'CA1', device_type: 'tetrode_12.5', description: 'CA1 tetrode 2', targeted_location: 'CA1', targeted_x: 3.1, targeted_y: 2.5, targeted_z: 2, units: 'mm' },
];

// Each tetrode group is an independent probe → electrode ids reset to 0..3 per
// group (designs.md#channel-map-semantics); the legacy globally-incrementing
// 0..7 map was a known-invalid workspace now caught by Phase 6's channel-bounds rule.
const NTRODE_MAP = [
  { ntrode_id: 1, electrode_group_id: 0, bad_channels: [], map: { 0: 0, 1: 1, 2: 2, 3: 3 } },
  { ntrode_id: 2, electrode_group_id: 1, bad_channels: [], map: { 0: 0, 1: 1, 2: 2, 3: 3 } },
];

const UNITS = { analog: 'unspecified', behavioral_events: 'unspecified' };
const KEYWORDS = ['spatial', 'w-track'];
const DEFAULT_HEADER_FILE_PATH = 'default_header.xml';

/**
 * Build the legacy `formData` in `defaultYMLValues` key order, fully filled and
 * schema-valid. Encoding this reproduces the legacy export bytes for this session.
 *
 * @returns {object} Legacy formData (deep-cloned literal).
 */
export function buildLegacyFormData() {
  return structuredClone({
    experimenter_name: ['Guidera, Jennifer', 'Comrie, Alison'],
    lab: 'Frank',
    institution: 'University of California, San Francisco',
    experiment_description: 'Chronic tetrode recording during spatial navigation',
    session_description: 'W-track alternation, day 1',
    session_id: 'rat1_20230101',
    keywords: KEYWORDS,
    subject: SUBJECT,
    data_acq_device: DATA_ACQ_DEVICE,
    cameras: CAMERAS,
    tasks: TASKS,
    associated_files: ASSOCIATED_FILES,
    associated_video_files: ASSOCIATED_VIDEO_FILES,
    units: UNITS,
    times_period_multiplier: 1.5,
    raw_data_to_volts: 0.195,
    default_header_file_path: DEFAULT_HEADER_FILE_PATH,
    behavioral_events: BEHAVIORAL_EVENTS,
    device: { name: ['Trodes'] },
    opto_excitation_source: [],
    optical_fiber: [],
    virus_injection: [],
    fs_gui_yamls: [],
    optogenetic_stimulation_software: '',
    electrode_groups: ELECTRODE_GROUPS,
    ntrode_electrode_group_channel_map: NTRODE_MAP,
  });
}

/**
 * Build the workspace `animal` + `day` representing the same session.
 *
 * @returns {{ animal: object, day: object }}
 */
export function buildEquivalentWorkspace() {
  const animalId = 'rat1';
  const dayId = 'rat1-2023-01-01';

  const animal = {
    id: animalId,
    subject: structuredClone(SUBJECT),
    devices: {
      data_acq_device: structuredClone(DATA_ACQ_DEVICE),
      device: { name: ['Trodes'] },
      electrode_groups: [],
      ntrode_electrode_group_channel_map: [],
    },
    cameras: structuredClone(CAMERAS),
    experimenters: {
      experimenter_name: ['Guidera, Jennifer', 'Comrie, Alison'],
      lab: 'Frank',
      institution: 'University of California, San Francisco',
    },
    optogenetics: undefined,
    behavioral_events: [],
    days: [dayId],
    created: TS,
    lastModified: TS,
    configurationHistory: [
      {
        version: 1,
        date: '2023-01-01',
        description: 'Initial configuration',
        devices: {
          electrode_groups: structuredClone(ELECTRODE_GROUPS),
          ntrode_electrode_group_channel_map: structuredClone(NTRODE_MAP),
        },
        appliedToDays: [],
      },
    ],
  };

  const day = {
    id: dayId,
    animalId,
    date: '2023-01-01',
    experimentDate: '01012023',
    session: {
      session_id: 'rat1_20230101',
      session_description: 'W-track alternation, day 1',
      experiment_description: 'Chronic tetrode recording during spatial navigation',
      weight: undefined, // inherit animal weight (450)
    },
    keywords: structuredClone(KEYWORDS),
    tasks: structuredClone(TASKS),
    behavioral_events: structuredClone(BEHAVIORAL_EVENTS),
    associated_files: structuredClone(ASSOCIATED_FILES),
    associated_video_files: structuredClone(ASSOCIATED_VIDEO_FILES),
    technical: {
      times_period_multiplier: 1.5,
      raw_data_to_volts: 0.195,
      default_header_file_path: DEFAULT_HEADER_FILE_PATH,
      units: structuredClone(UNITS),
    },
    state: { draft: true, validated: false, exported: false },
    created: TS,
    lastModified: TS,
    configurationVersion: 1,
  };

  return { animal, day };
}

// Optogenetics items in canonical legacy (arrayDefaultValues) key order.
const OPTO_EXCITATION_SOURCE = [
  { name: 'Omicron LuxX+ Blue', model_name: 'Omicron LuxX+ 488-100', description: 'Laser', wavelength_in_nm: 488.0, power_in_W: 0.077, intensity_in_W_per_m2: 1e10 },
];
const OPTICAL_FIBER = [
  { name: 'Optical fiber 1', hardware_name: 'optogenix_lambda_fiber', implanted_fiber_description: 'fiber', location: 'CA1', hemisphere: 'left', ap_in_mm: -3.5, ml_in_mm: 2.5, dv_in_mm: -2.0, roll_in_deg: 0.0, pitch_in_deg: 0.0, yaw_in_deg: 0.0, reference: 'Bregma at the cortical surface', excitation_source: 'Omicron LuxX+ Blue' },
];
const VIRUS_INJECTION = [
  { name: 'Injection 1', description: 'Viral injection', hemisphere: 'left', location: 'CA1', ap_in_mm: -3.5, ml_in_mm: 2.5, dv_in_mm: -2.5, roll_in_deg: 0.0, pitch_in_deg: 0.0, yaw_in_deg: 0.0, reference: 'Bregma at the cortical surface', virus_name: 'AAV-1-EF1a-DIO-ChRmine-mScarlet-WPRE', titer_in_vg_per_ml: 1e12, volume_in_uL: 0.45 },
];
const FS_GUI_YAMLS = [
  // camera_id is schema-required (and converter-read); state_script_parameters is a
  // legacy UI-only key the corrected new-path export strips.
  // dio_output_name must match a behavioral_events[].name (the converter indexes by it).
  { name: '/path/to/fs_gui.yaml', epochs: [1], power_in_mW: 0.0, dio_output_name: 'reward_left', camera_id: 0, state_script_parameters: false, pulseLength: 0 },
];

/**
 * Reverse the key order of each item in an array — used to scramble the workspace
 * opto items so the parity test proves `mergeDayMetadata` actually re-orders them
 * to legacy order (rather than passing whatever order it received).
 *
 * @param {Array} items - Array of plain objects.
 * @returns {Array} New array with each item's keys reversed.
 */
function reverseItemKeys(items) {
  return items.map((item) => {
    const out = {};
    for (const key of Object.keys(item).reverse()) out[key] = item[key];
    return out;
  });
}

/**
 * Build a legacy `formData` for an optogenetics session (opto arrays filled, in
 * legacy item order). Encoding it yields the legacy opto-export bytes.
 *
 * @returns {object} Legacy formData with optogenetics.
 */
export function buildOptoLegacyFormData() {
  const base = buildLegacyFormData();
  return structuredClone({
    ...base,
    opto_excitation_source: OPTO_EXCITATION_SOURCE,
    optical_fiber: OPTICAL_FIBER,
    virus_injection: VIRUS_INJECTION,
    fs_gui_yamls: FS_GUI_YAMLS,
    optogenetic_stimulation_software: 'fsgui',
  });
}

/**
 * Build the workspace `animal` + `day` for the same optogenetics session, with the
 * opto item keys deliberately SCRAMBLED (reversed) so a passing byte-parity test
 * proves the merge reorders them to legacy order.
 *
 * @returns {{ animal: object, day: object }}
 */
export function buildOptoWorkspace() {
  const { animal, day } = buildEquivalentWorkspace();
  animal.optogenetics = {
    opto_excitation_source: reverseItemKeys(OPTO_EXCITATION_SOURCE),
    optical_fiber: reverseItemKeys(OPTICAL_FIBER),
    virus_injection: reverseItemKeys(VIRUS_INJECTION),
    optogenetic_stimulation_software: 'fsgui',
  };
  day.fs_gui_yamls = reverseItemKeys(FS_GUI_YAMLS);
  return { animal, day };
}
