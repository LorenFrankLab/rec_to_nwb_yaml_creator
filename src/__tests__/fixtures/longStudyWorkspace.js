/**
 * A synthetic REPRESENTATIVE long-study workspace for storage-budget and save-latency checks:
 * several animals, each with a multi-month run of recording days on a high-channel-count implant,
 * every day fully populated (epochs, videos, files, DIO, keywords, bad channels, an export receipt).
 *
 * Deterministic (no Date.now / Math.random). The shape mirrors what the real builders produce;
 * sizes are deliberately on the heavy side (32 tetrodes = 128 channels, 8 epochs, 19 DIO lines,
 * receipt YAML kept) so the budget check has headroom in the pessimistic direction.
 *
 * @module __tests__/fixtures/longStudyWorkspace
 */

const TS = '2026-01-01T12:00:00.000Z';

/**
 * ISO date `days` after 2025-01-01.
 * @param {number} offset - Day offset.
 * @returns {string} `YYYY-MM-DD`.
 */
function isoDate(offset) {
  const d = new Date(Date.UTC(2025, 0, 1 + offset));
  return d.toISOString().slice(0, 10);
}

/**
 * Build the electrode groups + channel map for `nTetrodes` tetrodes.
 * @param {number} nTetrodes - Tetrode count.
 * @returns {{electrode_groups: object[], ntrode_electrode_group_channel_map: object[]}}
 */
function buildProbe(nTetrodes) {
  const regions = ['CA1', 'CA3', 'PFC', 'DG'];
  const electrode_groups = [];
  const ntrode_electrode_group_channel_map = [];
  for (let i = 0; i < nTetrodes; i += 1) {
    const location = regions[i % regions.length];
    electrode_groups.push({
      id: i,
      location,
      device_type: 'tetrode_12.5',
      description: `${location} tetrode ${i + 1} (right hemisphere, 12.5 um wire)`,
      targeted_location: location,
      targeted_x: 3 + i * 0.05,
      targeted_y: 2.5,
      targeted_z: 2 + (i % 4) * 0.1,
      units: 'mm',
    });
    ntrode_electrode_group_channel_map.push({
      ntrode_id: i + 1,
      electrode_group_id: i,
      bad_channels: [],
      map: { 0: 0, 1: 1, 2: 2, 3: 3 },
    });
  }
  return { electrode_groups, ntrode_electrode_group_channel_map };
}

/**
 * Build the synthetic long-study workspace.
 *
 * @param {object} [opts]
 * @param {number} [opts.animals=3] - Number of animals.
 * @param {number} [opts.daysPerAnimal=200] - Recording days per animal.
 * @param {number} [opts.tetrodes=32] - Tetrodes per animal (4 channels each).
 * @param {number} [opts.epochsPerDay=8] - Epochs per day.
 * @param {boolean} [opts.withReceipts=true] - Attach an export receipt (with YAML bytes) to every day.
 * @param {(animalId: string, day: object) => string} [opts.receiptYaml] - Produces the receipt YAML for a day.
 * @returns {object} A workspace slice (`{ version, lastModified, animals, days, settings }`).
 */
export function buildLongStudyWorkspace({
  animals = 3,
  daysPerAnimal = 200,
  tetrodes = 32,
  epochsPerDay = 8,
  withReceipts = true,
  receiptYaml = undefined,
} = {}) {
  const workspace = {
    version: '1.0.0',
    lastModified: TS,
    animals: {},
    days: {},
    settings: {
      defaultLab: 'Loren Frank Lab',
      defaultInstitution: 'University of California, San Francisco',
      defaultExperimenters: ['Doe, Jane'],
      autoSaveInterval: 30000,
      shadowExportEnabled: true,
    },
  };

  const dio = [];
  for (let i = 0; i < 19; i += 1) {
    dio.push({ description: `Din${i + 1}`, name: i < 8 ? `Poke${i + 1}` : i < 16 ? `Pump${i - 7}` : `Light${i - 15}` });
  }

  for (let a = 0; a < animals; a += 1) {
    const animalId = `Rat${a + 1}`;
    const probe = buildProbe(tetrodes);
    const taskTypes = [
      { id: 'tasktype-0', task_name: 'sleep', task_description: 'Rest in home cage', task_environment: 'home cage', camera_id: [0] },
      { id: 'tasktype-1', task_name: 'w_alternation', task_description: 'W-track continuous alternation for reward', task_environment: 'elevated W-track', camera_id: [0, 1] },
    ];
    const history = [1, 2, 3].map((version) => ({
      version,
      date: isoDate((version - 1) * 60),
      description: version === 1 ? 'Initial implant' : `Lowered tetrodes (${version})`,
      devices: {
        electrode_groups: probe.electrode_groups.map((g) => ({ ...g, targeted_z: g.targeted_z + (version - 1) * 0.04 })),
        ntrode_electrode_group_channel_map: probe.ntrode_electrode_group_channel_map.map((n) => ({ ...n })),
      },
      appliedToDays: [],
    }));
    const dayIds = [];
    for (let d = 0; d < daysPerAnimal; d += 1) {
      const date = isoDate(d);
      const dayId = `${animalId}-${date}`;
      dayIds.push(dayId);
      const version = 1 + Math.min(2, Math.floor(d / 60));
      const compact = date.replace(/-/g, '');
      const taskInstances = [];
      const videos = [];
      const files = [];
      const badChannels = {};
      for (let e = 1; e <= epochsPerDay; e += 1) {
        const isRun = e % 2 === 0;
        taskInstances.push({ taskTypeId: isRun ? 'tasktype-1' : 'tasktype-0', task_epochs: [e] });
        const tag = isRun ? `r${e / 2}` : `s${Math.ceil(e / 2)}`;
        videos.push({ name: `${compact}_${animalId}_${String(e).padStart(2, '0')}_${tag}.1.h264`, camera_id: isRun ? 1 : 0, task_epochs: e });
        files.push({
          name: 'statescript',
          description: 'Statescript log for this epoch',
          path: `/stelmo/lab/${animalId}/${compact}/${compact}_${animalId}_${String(e).padStart(2, '0')}_${tag}.stateScriptLog`,
          task_epochs: e,
        });
      }
      for (let n = 1; n <= tetrodes; n += 1) {
        if ((n + d) % 7 === 0) badChannels[String(n)] = [(n + d) % 4];
      }
      const day = {
        id: dayId,
        animalId,
        date,
        experimentDate: `${date.slice(5, 7)}${date.slice(8, 10)}${date.slice(0, 4)}`,
        session: {
          session_id: `${animalId}_${compact}`,
          session_description: `Day ${d + 1} of W-track alternation with interleaved sleep`,
          experiment_description: 'Chronic tetrode recording in hippocampus and prefrontal cortex during spatial navigation',
          weight: 400 + (d % 30),
        },
        experimenters: { experimenter_name: ['Doe, Jane', 'Roe, Richard'], lab: 'Loren Frank Lab', institution: 'University of California, San Francisco' },
        keywords: ['hippocampus', 'spatial navigation', 'replay'],
        tasks: [],
        taskInstances,
        behavioral_events: dio,
        associated_files: files,
        associated_video_files: videos,
        fs_gui_yamls: [],
        cameras_used: [0, 1],
        data_acq_device_name: 'SpikeGadgets',
        dataFolder: `/stelmo/lab/${animalId}/${compact}/`,
        technical: { times_period_multiplier: 1.5, raw_data_to_volts: 0.195, default_header_file_path: '', units: undefined },
        deviceOverrides: Object.keys(badChannels).length > 0 ? { bad_channels: badChannels } : undefined,
        state: { draft: false, validated: true, exported: true, exportedAt: TS },
        created: TS,
        lastModified: TS,
        configurationVersion: version,
      };
      workspace.days[dayId] = day;
      history[version - 1].appliedToDays.push(dayId);
    }
    workspace.animals[animalId] = {
      id: animalId,
      subject: {
        description: 'Long Evans Rat from Charles River',
        genotype: 'Wild Type',
        species: 'Rattus norvegicus',
        sex: 'M',
        subject_id: animalId,
        weight: 400,
        date_of_birth: '2024-06-01T00:00:00',
      },
      devices: {
        data_acq_device: [{ name: 'SpikeGadgets', system: 'SpikeGadgets', amplifier: 'Intan', adc_circuit: 'Intan' }],
        device: { name: ['Trodes'] },
        electrode_groups: history[2].devices.electrode_groups,
        ntrode_electrode_group_channel_map: history[2].devices.ntrode_electrode_group_channel_map,
      },
      cameras: [
        { id: 0, meters_per_pixel: 0.00085, manufacturer: 'Allied Vision', model: 'Mako G-158', lens: 'Fujinon HF16HA-1B', camera_name: 'overhead_camera' },
        { id: 1, meters_per_pixel: 0.0009, manufacturer: 'Allied Vision', model: 'Mako G-158', lens: 'Fujinon HF16HA-1B', camera_name: 'side_camera' },
      ],
      experimenters: { experimenter_name: ['Doe, Jane', 'Roe, Richard'], lab: 'Loren Frank Lab', institution: 'University of California, San Francisco' },
      experiment_description: 'Chronic tetrode recording in hippocampus and prefrontal cortex during spatial navigation',
      technicalDefaults: { raw_data_to_volts: 0.195, times_period_multiplier: 1.5 },
      optogenetics: null,
      taskTypes,
      days: dayIds,
      created: TS,
      lastModified: TS,
      configurationHistory: history,
    };
  }

  if (withReceipts && receiptYaml) {
    for (const day of Object.values(workspace.days)) {
      const yaml = receiptYaml(day.animalId, day);
      day.exportReceipt = {
        filename: `${day.date.replace(/-/g, '')}_${day.animalId}_metadata.yml`,
        exportedAt: TS,
        contentHash: 'sha256:' + '0'.repeat(64),
        appVersion: '3.0.0',
        schemaVersion: 4,
        yaml,
      };
    }
  }

  return workspace;
}
