/**
 * Shared fixtures for the Tasks & Files / epoch-grid tests.
 *
 * Synthesizes an animal that owns two cameras and two behavioral events, plus a
 * day belonging to it with one task that references one of those cameras and has
 * two epoch numbers. Values are deterministic (fixed timestamps, no Date.now /
 * Math.random) so the fixture is stable across runs. Each call returns a fresh
 * clone so a test mutating the result can't leak into another test.
 *
 * @module taskFixtures
 */

import { mergeDayMetadata } from '../../../state/workspaceUtils';

const TS = '2023-06-22T12:00:00.000Z';

/**
 * Build an animal (2 cameras + 2 behavioral events) and a day (1 task) that
 * belongs to it, plus the merged metadata for the pair.
 *
 * @param {object} [overrides] - Optional shallow overrides:
 *   `{ animal?, day? }` merged onto the generated animal/day respectively.
 * @returns {{ animal: object, day: object, mergedDay: object }}
 */
export function makeAnimalWithCamerasAndDay(overrides = {}) {
  const animalId = 'remy';
  const dayId = 'remy_20230622';

  const animal = {
    id: animalId,
    subject: {
      subject_id: animalId,
      species: 'Rattus norvegicus',
      sex: 'M',
      genotype: 'Wild Type',
      date_of_birth: '2023-01-01T00:00:00.000Z',
      weight: 400,
      description: 'Test subject',
    },
    devices: {
      data_acq_device: [
        { name: 'SpikeGadgets', system: 'MCU', amplifier: 'Intan', adc_circuit: 'Intan' },
      ],
      device: { name: ['Trodes'] },
      electrode_groups: [],
      ntrode_electrode_group_channel_map: [],
    },
    cameras: [
      { id: 0, camera_name: 'overhead', meters_per_pixel: 0.001, manufacturer: 'Allied', model: 'Mako', lens: '8mm' },
      { id: 1, camera_name: 'sleepbox', meters_per_pixel: 0.0012, manufacturer: 'Allied', model: 'Mako', lens: '8mm' },
    ],
    experimenters: {
      experimenter_name: ['Doe, Jane'],
      lab: 'Frank Lab',
      institution: 'UCSF',
    },
    optogenetics: undefined,
    behavioral_events: [
      { name: 'reward_well', description: 'Reward delivered at well' },
      { name: 'stim_trigger', description: 'Stimulation trigger' },
    ],
    days: [dayId],
    created: TS,
    lastModified: TS,
    configurationHistory: [
      {
        version: 1,
        date: '2023-06-22',
        description: 'Initial configuration',
        devices: {
          electrode_groups: [
            { id: 0, location: 'CA1', device_type: 'tetrode_12.5', description: 'Tetrode', targeted_location: 'CA1', units: 'um' },
          ],
          ntrode_electrode_group_channel_map: [
            { ntrode_id: 1, electrode_group_id: 0, bad_channels: [], map: { 0: 0, 1: 1, 2: 2, 3: 3 } },
          ],
        },
        appliedToDays: [],
      },
    ],
    ...overrides.animal,
  };

  const day = {
    id: dayId,
    animalId,
    date: '2023-06-22',
    experimentDate: '06222023',
    session: {
      session_id: 'TEST001',
      session_description: 'Test session',
      experiment_description: 'Test experiment',
      weight: 405,
    },
    tasks: [
      {
        task_name: 'sleep',
        task_description: 'The animal rests in a box',
        task_environment: 'HomeBox',
        camera_id: [1],
        task_epochs: [1, 3],
      },
    ],
    behavioral_events: [],
    associated_files: [],
    associated_video_files: [],
    technical: {
      times_period_multiplier: 1.5,
      raw_data_to_volts: 0.195,
      default_header_file_path: '',
      units: undefined,
    },
    state: {
      draft: true,
      validated: false,
      exported: false,
    },
    created: TS,
    lastModified: TS,
    configurationVersion: 1,
    ...overrides.day,
  };

  const mergedDay = mergeDayMetadata(animal, day);

  return { animal, day, mergedDay };
}
