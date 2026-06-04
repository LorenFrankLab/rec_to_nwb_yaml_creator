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

const NTRODE_MAP = [
  { ntrode_id: 1, electrode_group_id: 0, bad_channels: [], map: { 0: 0, 1: 1, 2: 2, 3: 3 } },
  { ntrode_id: 2, electrode_group_id: 1, bad_channels: [], map: { 0: 4, 1: 5, 2: 6, 3: 7 } },
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
