/**
 * Checked-in workspace builders for export-parity tests.
 *
 * `buildRealisticWorkspace` constructs an `animal` + `day` whose
 * `mergeDayMetadata` output, once encoded, is semantically parity-equal to the
 * hand-authored `realistic-session.yml` golden fixture (the same metadata after
 * `decodeYaml`, modulo the always-on keys the merge always adds). This proves
 * the build → merge → encode chain is lossless. It is deliberately NOT
 * byte-identical to the hand-authored fixture (key order and the always-on key
 * set differ; `encodeYaml` preserves insertion order). The new path's own byte
 * regression guard is the captured snapshot in
 * `golden/workspace-export.realistic.yml`.
 *
 * Values are deterministic (fixed timestamps, no Date.now / Math.random).
 *
 * @module __tests__/fixtures/workspaceBuilders
 */

import { migrateTasksToCatalogV2ToV3 } from '../../state/taskCatalogMigration';

const TS = '2023-06-22T12:00:00.000Z';

/**
 * The keys `mergeDayMetadata` always adds that are absent from
 * `realistic-session.yml`. Tests augment the parsed fixture with these to form
 * the fully-enumerated expected object for a key-set-exact deep-equal.
 *
 * The merge omits empty optional keys (keywords / units / default_header_file_path),
 * so for this empty-on-those-fields day it adds `device` plus the always-on
 * optogenetics / fs_gui keys the legacy `formData` always carries (emitted empty
 * for a non-optogenetics session — see the byte-for-byte legacy parity work).
 *
 * @type {{ device: object, opto_excitation_source: [], optical_fiber: [], virus_injection: [], fs_gui_yamls: [], optogenetic_stimulation_software: string }}
 */
export const REALISTIC_ALWAYS_ON_KEYS = {
  device: { name: ['Trodes'] },
  opto_excitation_source: [],
  optical_fiber: [],
  virus_injection: [],
  fs_gui_yamls: [],
  optogenetic_stimulation_software: '',
};

/**
 * Build an animal + day equivalent to `realistic-session.yml`.
 *
 * @returns {{ animal: object, day: object }}
 */
export function buildRealisticWorkspace() {
  const animalId = 'remy';
  const dayId = 'remy-2023-06-22';

  const electrodeGroups = [
    { id: 0, location: 'CA1', device_type: 'tetrode_12.5', description: 'Dorsal CA1 right hemisphere tetrode 1', targeted_location: 'CA1', targeted_x: 3, targeted_y: 2.5, targeted_z: 2, units: 'mm' },
    { id: 1, location: 'CA1', device_type: 'tetrode_12.5', description: 'Dorsal CA1 right hemisphere tetrode 2', targeted_location: 'CA1', targeted_x: 3.1, targeted_y: 2.5, targeted_z: 2, units: 'mm' },
    { id: 2, location: 'CA1', device_type: 'tetrode_12.5', description: 'Dorsal CA1 right hemisphere tetrode 3', targeted_location: 'CA1', targeted_x: 3.2, targeted_y: 2.5, targeted_z: 2, units: 'mm' },
    { id: 3, location: 'CA1', device_type: 'tetrode_12.5', description: 'Dorsal CA1 right hemisphere tetrode 4', targeted_location: 'CA1', targeted_x: 3.3, targeted_y: 2.5, targeted_z: 2, units: 'mm' },
    { id: 4, location: 'CA3', device_type: 'tetrode_12.5', description: 'CA3 right hemisphere tetrode 1', targeted_location: 'CA3', targeted_x: 3.5, targeted_y: 3, targeted_z: 2.2, units: 'mm' },
    { id: 5, location: 'CA3', device_type: 'tetrode_12.5', description: 'CA3 right hemisphere tetrode 2', targeted_location: 'CA3', targeted_x: 3.6, targeted_y: 3, targeted_z: 2.2, units: 'mm' },
    { id: 6, location: 'PFC', device_type: 'tetrode_12.5', description: 'Medial prefrontal cortex tetrode 1', targeted_location: 'mPFC', targeted_x: 0.5, targeted_y: 3.2, targeted_z: 4, units: 'mm' },
    { id: 7, location: 'PFC', device_type: 'tetrode_12.5', description: 'Medial prefrontal cortex tetrode 2', targeted_location: 'mPFC', targeted_x: 0.6, targeted_y: 3.2, targeted_z: 4, units: 'mm' },
  ];

  // Each tetrode is its own probe (device_type tetrode_12.5, 4 electrode ids), so
  // every group's channel map resets to local electrode ids 0..3 — values are NOT
  // global hardware channels (see designs.md#channel-map-semantics). Phase 6's
  // channel-bounds rule enforces this; the earlier globally-incrementing 0..31 map
  // was a known-invalid workspace (it still lives, frozen, in the legacy golden
  // realistic-session.yml, which is byte-baselined but never validated).
  const ntrodeMap = [
    { ntrode_id: 1, electrode_group_id: 0, bad_channels: [], map: { 0: 0, 1: 1, 2: 2, 3: 3 } },
    { ntrode_id: 2, electrode_group_id: 1, bad_channels: [], map: { 0: 0, 1: 1, 2: 2, 3: 3 } },
    { ntrode_id: 3, electrode_group_id: 2, bad_channels: [2], map: { 0: 0, 1: 1, 2: 2, 3: 3 } },
    { ntrode_id: 4, electrode_group_id: 3, bad_channels: [], map: { 0: 0, 1: 1, 2: 2, 3: 3 } },
    { ntrode_id: 5, electrode_group_id: 4, bad_channels: [], map: { 0: 0, 1: 1, 2: 2, 3: 3 } },
    { ntrode_id: 6, electrode_group_id: 5, bad_channels: [3], map: { 0: 0, 1: 1, 2: 2, 3: 3 } },
    { ntrode_id: 7, electrode_group_id: 6, bad_channels: [], map: { 0: 0, 1: 1, 2: 2, 3: 3 } },
    { ntrode_id: 8, electrode_group_id: 7, bad_channels: [], map: { 0: 0, 1: 1, 2: 2, 3: 3 } },
  ];

  const animal = {
    id: animalId,
    subject: {
      description: 'Long Evans Rat from Charles River',
      genotype: 'Wild Type',
      species: 'Rattus norvegicus',
      sex: 'M',
      subject_id: 'remy',
      weight: 485,
      date_of_birth: '2023-01-10T00:00:00',
      age: 'P164',
    },
    devices: {
      data_acq_device: [
        { name: 'SpikeGadgets', system: 'SpikeGadgets', amplifier: 'Intan', adc_circuit: 'Intan' },
      ],
      device: { name: ['Trodes'] },
      electrode_groups: [],
      ntrode_electrode_group_channel_map: [],
    },
    cameras: [
      { id: 0, meters_per_pixel: 0.00085, manufacturer: 'Allied Vision', model: 'Mako G-158', lens: 'Fujinon HF16HA-1B', camera_name: 'overhead_camera' },
      { id: 1, meters_per_pixel: 0.0009, manufacturer: 'Allied Vision', model: 'Mako G-158', lens: 'Fujinon HF16HA-1B', camera_name: 'side_camera' },
    ],
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
        date: '2023-06-22',
        description: 'Initial configuration',
        devices: {
          electrode_groups: electrodeGroups,
          ntrode_electrode_group_channel_map: ntrodeMap,
        },
        appliedToDays: [],
      },
    ],
  };

  const day = {
    id: dayId,
    animalId,
    date: '2023-06-22',
    experimentDate: '06222023',
    session: {
      session_id: 'remy_20230622',
      session_description: 'Day 45 of chronic recording, W-track alternation',
      experiment_description: 'Chronic tetrode recording during spatial navigation',
      weight: undefined, // inherit animal weight (485)
    },
    // The two 'sleep' tasks share ONE task_description — Spyglass treats task_name
    // as an identity with one description per name (designs.md / Spyglass
    // naming-identity contract). The legacy golden realistic-session.yml encodes
    // epoch-specific descriptions ("Pre-task"/"Post-task") for the same name, which
    // is a known-invalid divergence; it stays frozen there (never validated) while
    // the builder is the corrected source of truth.
    tasks: [
      { task_name: 'sleep', task_description: 'Rest in home cage', task_environment: 'home cage', camera_id: [0], task_epochs: [1] },
      { task_name: 'w_alternation', task_description: 'W-track continuous alternation for reward', task_environment: 'elevated W-track (180cm arms)', camera_id: [0, 1], task_epochs: [2, 4] },
      { task_name: 'sleep', task_description: 'Rest in home cage', task_environment: 'home cage', camera_id: [0], task_epochs: [3, 5] },
    ],
    behavioral_events: [
      { description: 'Reward delivery at left arm', name: 'reward_left' },
      { description: 'Reward delivery at right arm', name: 'reward_right' },
      { description: 'Trial start at center arm', name: 'trial_start' },
    ],
    associated_files: [
      { name: 'probe_adjustment_log', description: 'Daily probe depth adjustments and observations', path: '/data/remy/probe_logs/20230622_adjustments.txt', task_epochs: 1 },
      { name: 'behavioral_notes', description: 'Experimenter behavioral observations', path: '/data/remy/behavior/20230622_notes.txt', task_epochs: 2 },
    ],
    associated_video_files: [
      { name: 'overhead_video_epoch2', camera_id: 0, task_epochs: 2 },
      { name: 'overhead_video_epoch4', camera_id: 0, task_epochs: 4 },
      { name: 'side_view_video_epoch2', camera_id: 1, task_epochs: 2 },
      { name: 'side_view_video_epoch4', camera_id: 1, task_epochs: 4 },
    ],
    technical: {
      times_period_multiplier: 1.5,
      raw_data_to_volts: 0.195,
      default_header_file_path: '',
      units: undefined,
    },
    state: { draft: true, validated: false, exported: false },
    created: TS,
    lastModified: TS,
    configurationVersion: 1,
  };

  return { animal, day };
}

/**
 * The MIGRATED v3 shape of {@link buildRealisticWorkspace}: the animal owns a `taskTypes` catalog and
 * the day references it via `taskInstances` with NO inline `tasks` — exactly what a v2→v3 persisted
 * blob hydrates to. Use this (not the inline builder) for tests that must exercise the real catalog
 * day shape; the inline builder is silently *derived* by the Day Editor and so hides catalog-only
 * regressions in step status, camera resolution, carry-forward, and raw-shape validation.
 *
 * @returns {{ animal: object, day: object }} A catalog-shaped animal + day.
 */
export function buildCatalogWorkspace() {
  const { animal, day } = buildRealisticWorkspace();
  const ws = migrateTasksToCatalogV2ToV3({
    animals: { [animal.id]: { ...animal, days: [day.id] } },
    days: { [day.id]: { ...day, animalId: animal.id } },
  });
  return { animal: ws.animals[animal.id], day: ws.days[day.id] };
}
