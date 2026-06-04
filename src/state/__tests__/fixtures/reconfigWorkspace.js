/**
 * Synthesized workspace fixture for probe-reconfiguration tests.
 *
 * One animal with TWO configuration snapshots and FOUR days spanning the change:
 * - v1: two electrode groups (0, 1) + two ntrodes (1→group 0, 2→group 1).
 * - v2: adds electrode group 2 + ntrode 3, and changes ntrode 2's `map` AND
 *   `bad_channels` (a clear, asserted v1→v2 delta).
 * - Days 1–2 use `configurationVersion: 1`; days 3–4 use `configurationVersion: 2`.
 *
 * Every day carries valid session/technical data so `mergeDayMetadata` produces
 * encodable output. The factory returns a fresh deep clone per call so tests never
 * share mutable state.
 *
 * @module state/__tests__/fixtures/reconfigWorkspace
 */

const TS = '2023-06-22T12:00:00.000Z';

const V1_GROUPS = [
  { id: 0, location: 'CA1', device_type: 'tetrode_12.5', description: 'CA1 tetrode 1', targeted_location: 'CA1', targeted_x: 3, targeted_y: 2.5, targeted_z: 2, units: 'mm' },
  { id: 1, location: 'CA1', device_type: 'tetrode_12.5', description: 'CA1 tetrode 2', targeted_location: 'CA1', targeted_x: 3.1, targeted_y: 2.5, targeted_z: 2, units: 'mm' },
];

const V1_NTRODES = [
  { ntrode_id: 1, electrode_group_id: 0, bad_channels: [], map: { 0: 0, 1: 1, 2: 2, 3: 3 } },
  { ntrode_id: 2, electrode_group_id: 1, bad_channels: [], map: { 0: 4, 1: 5, 2: 6, 3: 7 } },
];

// v2 = v1 + a new group (2) and ntrode (3), with ntrode 2's map + bad_channels changed.
const V2_GROUPS = [
  ...V1_GROUPS,
  { id: 2, location: 'CA3', device_type: 'tetrode_12.5', description: 'CA3 tetrode 1', targeted_location: 'CA3', targeted_x: 3.5, targeted_y: 3, targeted_z: 2.2, units: 'mm' },
];

const V2_NTRODES = [
  { ntrode_id: 1, electrode_group_id: 0, bad_channels: [], map: { 0: 0, 1: 1, 2: 2, 3: 3 } },
  { ntrode_id: 2, electrode_group_id: 1, bad_channels: [2], map: { 0: 8, 1: 9, 2: 10, 3: 11 } },
  { ntrode_id: 3, electrode_group_id: 2, bad_channels: [], map: { 0: 12, 1: 13, 2: 14, 3: 15 } },
];

/**
 * Build one valid, encodable day record on a given configuration version.
 *
 * @param {string} animalId - Parent animal id.
 * @param {string} date - YYYY-MM-DD recording date.
 * @param {string} experimentDate - mmddYYYY filename date.
 * @param {number} configurationVersion - Snapshot version this day uses.
 * @returns {object} A day record.
 */
function makeDay(animalId, date, experimentDate, configurationVersion) {
  return {
    id: `${animalId}-${date}`,
    animalId,
    date,
    experimentDate,
    session: {
      session_id: `${animalId}_${date.replace(/-/g, '')}`,
      session_description: `Recording on ${date}`,
      experiment_description: 'Chronic tetrode recording during spatial navigation',
      weight: undefined,
    },
    keywords: ['spatial'],
    tasks: [
      { task_name: 'sleep', task_description: 'Rest', task_environment: 'home cage', camera_id: [0], task_epochs: [1] },
    ],
    behavioral_events: [],
    associated_files: [],
    associated_video_files: [],
    technical: {
      times_period_multiplier: 1.5,
      raw_data_to_volts: 0.195,
      default_header_file_path: 'default_header.xml',
      units: { analog: 'unspecified', behavioral_events: 'unspecified' },
    },
    state: { draft: true, validated: false, exported: false },
    created: TS,
    lastModified: TS,
    configurationVersion,
  };
}

/**
 * Build a fresh reconfiguration workspace (deep-cloned per call).
 *
 * @returns {{
 *   workspace: object,
 *   animalId: string,
 *   dayIds: { day1: string, day2: string, day3: string, day4: string },
 *   v1: { electrode_groups: object[], ntrode_electrode_group_channel_map: object[] },
 *   v2: { electrode_groups: object[], ntrode_electrode_group_channel_map: object[] },
 * }}
 */
export function makeReconfigWorkspace() {
  const animalId = 'remy';

  const day1 = makeDay(animalId, '2023-06-22', '06222023', 1);
  const day2 = makeDay(animalId, '2023-06-23', '06232023', 1);
  const day3 = makeDay(animalId, '2023-06-24', '06242023', 2);
  const day4 = makeDay(animalId, '2023-06-25', '06252023', 2);

  const animal = {
    id: animalId,
    subject: {
      description: 'Long Evans Rat',
      genotype: 'Wild Type',
      species: 'Rattus norvegicus',
      sex: 'M',
      subject_id: animalId,
      weight: 485,
      date_of_birth: '2023-01-10T00:00:00',
    },
    devices: {
      data_acq_device: [
        { name: 'SpikeGadgets', system: 'SpikeGadgets', amplifier: 'Intan', adc_circuit: 'Intan' },
      ],
      device: { name: ['Trodes'] },
      // Live editable config mirrors the latest snapshot (v2).
      electrode_groups: V2_GROUPS,
      ntrode_electrode_group_channel_map: V2_NTRODES,
    },
    cameras: [
      { id: 0, meters_per_pixel: 0.00085, manufacturer: 'Allied Vision', model: 'Mako G-158', lens: 'Fujinon HF16HA-1B', camera_name: 'overhead_camera' },
    ],
    experimenters: {
      experimenter_name: ['Doe, Jane'],
      lab: 'Frank',
      institution: 'University of California, San Francisco',
    },
    optogenetics: undefined,
    behavioral_events: [],
    days: [day1.id, day2.id, day3.id, day4.id],
    created: TS,
    lastModified: TS,
    configurationHistory: [
      {
        version: 1,
        date: '2023-06-22',
        description: 'Initial configuration',
        devices: { electrode_groups: V1_GROUPS, ntrode_electrode_group_channel_map: V1_NTRODES },
        appliedToDays: [day1.id, day2.id],
      },
      {
        version: 2,
        date: '2023-06-24',
        description: 'Added CA3 tetrode; remapped shank 2',
        devices: { electrode_groups: V2_GROUPS, ntrode_electrode_group_channel_map: V2_NTRODES },
        appliedToDays: [day3.id, day4.id],
      },
    ],
  };

  const workspace = {
    version: '1.0.0',
    lastModified: TS,
    animals: { [animalId]: animal },
    days: {
      [day1.id]: day1,
      [day2.id]: day2,
      [day3.id]: day3,
      [day4.id]: day4,
    },
    settings: {
      defaultLab: 'Frank',
      defaultInstitution: 'University of California, San Francisco',
      defaultExperimenters: [],
      autoSaveInterval: 30000,
      shadowExportEnabled: true,
    },
  };

  return structuredClone({
    workspace,
    animalId,
    dayIds: { day1: day1.id, day2: day2.id, day3: day3.id, day4: day4.id },
    v1: { electrode_groups: V1_GROUPS, ntrode_electrode_group_channel_map: V1_NTRODES },
    v2: { electrode_groups: V2_GROUPS, ntrode_electrode_group_channel_map: V2_NTRODES },
  });
}
