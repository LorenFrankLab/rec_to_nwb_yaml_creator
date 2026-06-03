/**
 * Test fixture helpers for integration tests
 *
 * Provides utilities for loading complete, valid YAML fixtures
 * that pass schema validation for import testing.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Load the minimal-complete.yml fixture
 * This fixture has ALL required fields to pass validation
 * but is stripped down to minimal arrays for fast testing
 *
 * @returns {string} YAML content
 */
export function getMinimalCompleteYaml() {
  const fixturePath = path.join(__dirname, '../fixtures/valid/minimal-complete.yml');
  return fs.readFileSync(fixturePath, 'utf-8');
}

/**
 * Load minimal-complete.yml and customize specific fields
 * Useful for testing variations without duplicating the entire YAML
 *
 * @param {object} overrides - Fields to override (uses simple string replacement)
 * @returns {string} Customized YAML content
 *
 * @example
 * const yaml = getCustomizedYaml({
 *   lab: 'Custom Lab',
 *   session_id: 'CUSTOM001'
 * });
 */
export function getCustomizedYaml(overrides = {}) {
  let yaml = getMinimalCompleteYaml();

  // Simple string replacement for common fields
  if (overrides.lab) {
    yaml = yaml.replace(/lab: Test Lab/, `lab: ${overrides.lab}`);
  }
  if (overrides.institution) {
    yaml = yaml.replace(/institution: Test University/, `institution: ${overrides.institution}`);
  }
  if (overrides.session_id) {
    yaml = yaml.replace(/session_id: TEST001/, `session_id: ${overrides.session_id}`);
  }
  if (overrides.subject_id) {
    yaml = yaml.replace(/subject_id: RAT001/, `subject_id: ${overrides.subject_id}`);
  }
  if (overrides.experimenter_name) {
    yaml = yaml.replace(/- Doe, John/, `- ${overrides.experimenter_name}`);
  }

  return yaml;
}

/**
 * Build a minimal, valid workspace object (one animal + one day) matching the
 * shape produced by the store's createAnimal/createDay actions.
 *
 * Values are deterministic (fixed timestamps, no Date.now/Math.random) so the
 * fixture is stable across runs. The single electrode group / channel-map entry
 * lets ownership tests mutate nested config data and assert the source is intact.
 *
 * @param {object} [overrides] - Optional shallow overrides merged onto the workspace.
 * @returns {object} A workspace slice: { version, lastModified, animals, days, settings }.
 */
export function makeTestWorkspace(overrides = {}) {
  const animalId = 'remy';
  const dayId = 'remy_20230622';
  const ts = '2023-06-22T12:00:00.000Z';

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
      data_acq_device: [{ name: 'SpikeGadgets', system: 'MCU', amplifier: 'Intan', adc_circuit: 'Intan' }],
      device: { name: ['Trodes'] },
      electrode_groups: [],
      ntrode_electrode_group_channel_map: [],
    },
    cameras: [
      { id: 0, camera_name: 'overhead', meters_per_pixel: 0.001, manufacturer: 'Allied', model: 'Mako', lens: '8mm' },
    ],
    experimenters: {
      experimenter_name: ['Doe, Jane'],
      lab: 'Frank Lab',
      institution: 'UCSF',
    },
    optogenetics: undefined,
    days: [dayId],
    created: ts,
    lastModified: ts,
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
    tasks: [],
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
    created: ts,
    lastModified: ts,
    configurationVersion: 1,
  };

  return {
    version: '1.0.0',
    lastModified: ts,
    animals: { [animalId]: animal },
    days: { [dayId]: day },
    settings: {
      defaultLab: 'Frank Lab',
      defaultInstitution: 'UCSF',
      defaultExperimenters: ['Doe, Jane'],
      autoSaveInterval: 30000,
      shadowExportEnabled: true,
    },
    ...overrides,
  };
}
