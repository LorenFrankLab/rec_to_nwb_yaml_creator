/**
 * Round-trip gate for the YAML decompose module.
 *
 * The corpus is GENUINE MERGE OUTPUTS: `f = encodeYaml(mergeDayMetadata(animal, day))`
 * over representative workspaces (plus one committed merge-output snapshot). For each
 * member we assert the inverse re-composes to byte-identical YAML:
 *
 *   const r = decomposeYaml(decodeYaml(f));
 *   const { animal: a2, day: d2 } = recomposeDayModel(r);
 *   expect(encodeYaml(mergeDayMetadata(a2, d2))).toBe(f);
 *
 * This proves "decompose produces data that re-merges to the original". The four
 * legacy golden fixtures are deliberately NOT in this corpus — their baseline only
 * checks encoder determinism, and one is a known-invalid workspace the merge does
 * not reproduce (see exportParity.integration.test.js).
 */
import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { encodeYaml, decodeYaml } from '../../io/yaml';
import { mergeDayMetadata } from '../workspaceUtils';
import { normalizeWorkspaceDevices } from '../../utils/deviceNormalization';
import { decomposeYaml, recomposeDayModel } from '../yamlImport';
import { buildRealisticWorkspace } from '../../__tests__/fixtures/workspaceBuilders';

/**
 * Re-merge a recomposed animal+day through the real LOAD path. `recomposeDayModel`
 * places imported channel-map `bad_channels` on the configuration snapshot (its base),
 * but the export merge resolves bad_channels from the DAY OVERRIDE only. The load step
 * (`normalizeWorkspaceDevices`, which runs the bad-channel migration) is what moves
 * those base marks down into the day override — so a faithful round-trip re-merges
 * through it, exactly as production hydration does.
 *
 * @param {object} animal - Recomposed animal.
 * @param {object} day - Recomposed day.
 * @returns {string} The encoded YAML of the loaded merge.
 */
function reExport(animal, day) {
  const loaded = normalizeWorkspaceDevices({
    animals: { [animal.id]: animal },
    days: { [day.id]: day },
  });
  return encodeYaml(mergeDayMetadata(loaded.animals[animal.id], loaded.days[day.id]));
}

const TS = '2023-06-22T12:00:00.000Z';

const goldenDir = path.join(__dirname, '../../__tests__/fixtures/golden');
const realisticSnapshot = fs.readFileSync(
  path.join(goldenDir, 'workspace-export.realistic.yml'),
  'utf8'
);

/**
 * A minimal valid animal + day: one config snapshot, a subject, one data_acq_device,
 * no opto, no cameras — but complete enough that the merge output validates clean.
 *
 * @returns {{ animal: object, day: object }}
 */
function buildReconfigWorkspace() {
  // A probe-reconfiguration animal with TWO config snapshots whose channel maps are
  // VALID (electrode ids reset to 0..3 per tetrode group). The day pins the NON-latest
  // snapshot (v1; the animal's latest is v2), so its exported config differs from the
  // animal's current devices — exercising decompose of a non-latest pin.
  //
  // NB: the committed `reconfigWorkspace.js` fixture is deliberately NOT used here. It
  // was authored for the reconfig WORKFLOW/diff tests (which never validate channel
  // bounds) and encodes globally-incrementing channel maps ({0:4,1:5,…}) on EVERY
  // snapshot. Those are a known-invalid workspace under the per-group channel-bounds
  // rule, so every one of its `mergeDayMetadata` outputs carries a
  // `channel_value_out_of_range` ERROR — which `decomposeYaml` (by contract) rejects
  // with `ok:false`. It therefore cannot be a genuine (valid) merge-output corpus
  // member. recompose collapses to a single snapshot regardless, so the multi-snapshot
  // source is immaterial to byte-identity; only the non-latest-pin property matters,
  // which this valid inline workspace reproduces.
  const animalId = 'reconfig';
  const dayId = `${animalId}-2023-06-22`;
  const v1Groups = [
    { id: 0, location: 'CA1', device_type: 'tetrode_12.5', description: 'CA1 tetrode 1', targeted_location: 'CA1', targeted_x: 3, targeted_y: 2.5, targeted_z: 2, units: 'mm' },
    { id: 1, location: 'CA1', device_type: 'tetrode_12.5', description: 'CA1 tetrode 2', targeted_location: 'CA1', targeted_x: 3.1, targeted_y: 2.5, targeted_z: 2, units: 'mm' },
  ];
  const v1Ntrodes = [
    { ntrode_id: 1, electrode_group_id: 0, bad_channels: [], map: { 0: 0, 1: 1, 2: 2, 3: 3 } },
    { ntrode_id: 2, electrode_group_id: 1, bad_channels: [], map: { 0: 0, 1: 1, 2: 2, 3: 3 } },
  ];
  const v2Groups = [
    ...v1Groups,
    { id: 2, location: 'CA3', device_type: 'tetrode_12.5', description: 'CA3 tetrode 1', targeted_location: 'CA3', targeted_x: 3.5, targeted_y: 3, targeted_z: 2.2, units: 'mm' },
  ];
  const v2Ntrodes = [
    { ntrode_id: 1, electrode_group_id: 0, bad_channels: [], map: { 0: 0, 1: 1, 2: 2, 3: 3 } },
    { ntrode_id: 2, electrode_group_id: 1, bad_channels: [2], map: { 0: 0, 1: 1, 2: 2, 3: 3 } },
    { ntrode_id: 3, electrode_group_id: 2, bad_channels: [], map: { 0: 0, 1: 1, 2: 2, 3: 3 } },
  ];

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
      // Live editable config mirrors the LATEST snapshot (v2).
      electrode_groups: v2Groups,
      ntrode_electrode_group_channel_map: v2Ntrodes,
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
    days: [dayId],
    configurationHistory: [
      { version: 1, devices: { electrode_groups: v1Groups, ntrode_electrode_group_channel_map: v1Ntrodes }, appliedToDays: [dayId] },
      { version: 2, devices: { electrode_groups: v2Groups, ntrode_electrode_group_channel_map: v2Ntrodes }, appliedToDays: [] },
    ],
  };

  const day = {
    id: dayId,
    animalId,
    date: '2023-06-22',
    session: {
      session_id: 'reconfig_20230622',
      session_description: 'Recording on v1 config',
      experiment_description: 'Chronic tetrode recording',
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
    created: TS,
    lastModified: TS,
    // Pin the NON-latest snapshot.
    configurationVersion: 1,
  };

  return { animal, day };
}

/**
 * A minimal valid animal + day: one config snapshot, a subject, one data_acq_device,
 * no opto, no cameras — but complete enough that the merge output validates clean.
 *
 * @returns {{ animal: object, day: object }}
 */
function buildMinimalWorkspace() {
  const animalId = 'mini';
  const dayId = `${animalId}-2023-06-22`;
  const animal = {
    id: animalId,
    subject: {
      description: 'Long Evans Rat',
      genotype: 'Wild Type',
      species: 'Rattus norvegicus',
      sex: 'M',
      subject_id: animalId,
      weight: 400,
      date_of_birth: '2023-01-10T00:00:00',
    },
    devices: {
      data_acq_device: [
        { name: 'SpikeGadgets', system: 'SpikeGadgets', amplifier: 'Intan', adc_circuit: 'Intan' },
      ],
      device: { name: ['Trodes'] },
      electrode_groups: [],
      ntrode_electrode_group_channel_map: [],
    },
    cameras: [],
    experimenters: {
      experimenter_name: ['Doe, Jane'],
      lab: 'Frank',
      institution: 'University of California, San Francisco',
    },
    optogenetics: undefined,
    days: [dayId],
    configurationHistory: [
      {
        version: 1,
        devices: {
          electrode_groups: [
            { id: 0, location: 'CA1', device_type: 'tetrode_12.5', description: 'CA1 tetrode 1', targeted_location: 'CA1', targeted_x: 3, targeted_y: 2.5, targeted_z: 2, units: 'mm' },
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
    session: {
      session_id: 'mini_20230622',
      session_description: 'Minimal session',
      experiment_description: 'Minimal experiment',
      weight: undefined,
    },
    keywords: ['spatial'],
    tasks: [
      { task_name: 'sleep', task_description: 'Rest', task_environment: 'home cage', camera_id: [], task_epochs: [1] },
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
    created: TS,
    lastModified: TS,
    configurationVersion: 1,
  };

  return { animal, day };
}

/**
 * A small optogenetics animal + day: animal.optogenetics carries ≥1 of each opto
 * section (with `volume_in_uL` on the virus injection) plus a software string, and the
 * DAY carries ≥1 fs_gui_yamls entry. This is the most important attribution case:
 * opto null-vs-object, fs_gui day-ownership, dual volume spelling.
 *
 * @returns {{ animal: object, day: object }}
 */
function buildOptoWorkspace() {
  const animalId = 'opto';
  const dayId = `${animalId}-2023-06-22`;
  const animal = {
    id: animalId,
    subject: {
      description: 'Long Evans Rat',
      genotype: 'Wild Type',
      species: 'Rattus norvegicus',
      sex: 'M',
      subject_id: animalId,
      weight: 420,
      date_of_birth: '2023-01-10T00:00:00',
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
    ],
    experimenters: {
      experimenter_name: ['Doe, Jane'],
      lab: 'Frank',
      institution: 'University of California, San Francisco',
    },
    optogenetics: {
      opto_excitation_source: [
        {
          name: 'laser_473',
          model_name: 'OBIS 473',
          description: 'Blue laser',
          wavelength_in_nm: 473,
          power_in_W: 0.01,
          intensity_in_W_per_m2: 100,
        },
      ],
      optical_fiber: [
        {
          name: 'fiber_CA1',
          hardware_name: 'Doric',
          implanted_fiber_description: '200um core fiber',
          location: 'CA1',
          hemisphere: 'right',
          ap_in_mm: 3,
          ml_in_mm: 2.5,
          dv_in_mm: 2,
          roll_in_deg: 0,
          pitch_in_deg: 0,
          yaw_in_deg: 0,
          reference: 'bregma',
          excitation_source: 'laser_473',
        },
      ],
      virus_injection: [
        {
          name: 'virus_CA1',
          description: 'ChR2 injection',
          hemisphere: 'right',
          location: 'CA1',
          ap_in_mm: 3,
          ml_in_mm: 2.5,
          dv_in_mm: 2,
          roll_in_deg: 0,
          pitch_in_deg: 0,
          yaw_in_deg: 0,
          reference: 'bregma',
          virus_name: 'AAV-ChR2',
          titer_in_vg_per_ml: 1000000000000,
          volume_in_uL: 0.5,
        },
      ],
      optogenetic_stimulation_software: 'FsGui',
    },
    days: [dayId],
    configurationHistory: [
      {
        version: 1,
        devices: {
          electrode_groups: [
            { id: 0, location: 'CA1', device_type: 'tetrode_12.5', description: 'CA1 tetrode 1', targeted_location: 'CA1', targeted_x: 3, targeted_y: 2.5, targeted_z: 2, units: 'mm' },
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
    session: {
      session_id: 'opto_20230622',
      session_description: 'Opto session',
      experiment_description: 'Opto experiment',
      weight: undefined,
    },
    keywords: ['opto'],
    tasks: [
      { task_name: 'sleep', task_description: 'Rest', task_environment: 'home cage', camera_id: [0], task_epochs: [1] },
    ],
    // The fs_gui protocol's dio_output_name must name an existing behavioral event
    // (the dangling_dio_output rule blocks export otherwise), so define one here.
    behavioral_events: [
      { description: 'Optogenetic stimulation trigger', name: 'stim_out' },
    ],
    associated_files: [],
    associated_video_files: [],
    technical: {
      times_period_multiplier: 1.5,
      raw_data_to_volts: 0.195,
      default_header_file_path: 'default_header.xml',
      units: { analog: 'unspecified', behavioral_events: 'unspecified' },
    },
    fs_gui_yamls: [
      {
        name: 'stim_protocol',
        epochs: [1],
        power_in_mW: 5,
        dio_output_name: 'stim_out',
        camera_id: 0,
        pulseLength: 10,
      },
    ],
    created: TS,
    lastModified: TS,
    configurationVersion: 1,
  };

  return { animal, day };
}

/**
 * Build the corpus of (name, genuine merge output `f`) pairs.
 *
 * @returns {Array<{ name: string, f: string }>}
 */
function buildCorpus() {
  const corpus = [];

  {
    const { animal, day } = buildRealisticWorkspace();
    corpus.push({ name: 'realistic', f: encodeYaml(mergeDayMetadata(animal, day)) });
  }

  {
    // probe-reconfig pinned to the NON-latest snapshot (v1; the animal's latest is v2).
    const { animal, day } = buildReconfigWorkspace();
    corpus.push({ name: 'probe-reconfig (v1 pin)', f: encodeYaml(mergeDayMetadata(animal, day)) });
  }

  {
    const { animal, day } = buildOptoWorkspace();
    corpus.push({ name: 'opto', f: encodeYaml(mergeDayMetadata(animal, day)) });
  }

  {
    const { animal, day } = buildMinimalWorkspace();
    corpus.push({ name: 'minimal', f: encodeYaml(mergeDayMetadata(animal, day)) });
  }

  // Committed merge-output snapshot.
  corpus.push({ name: 'committed snapshot', f: realisticSnapshot });

  return corpus;
}

describe('yamlImport round-trip (genuine merge outputs)', () => {
  for (const { name, f } of buildCorpus()) {
    it(`round-trips byte-identically: ${name}`, () => {
      const r = decomposeYaml(decodeYaml(f));
      expect(r.ok).toBe(true);
      const { animal: a2, day: d2 } = recomposeDayModel(r);
      // Re-merge through the real load path (see reExport): the bad-channel migration
      // moves imported snapshot-base marks down into the day override, which the
      // day-only merge then reads back — reproducing the original bytes.
      expect(reExport(a2, d2)).toBe(f);
    });
  }
});
