/**
 * Import must tolerate YAML files whose camera_id references point at cameras
 * that no longer exist (a state the app itself used to produce). The stale
 * references are dropped and the rest of the section is imported intact,
 * rather than the whole section being excluded by validation.
 */

import { describe, it, expect } from 'vitest';
import { importFiles } from '../importExport';

const yamlWithStaleCamera = `
experimenter_name:
  - Doe, Jane
lab: Test Lab
institution: Test Institution
experiment_description: d
session_description: d
session_id: "1"
subject:
  description: rat
  genotype: WT
  sex: M
  species: Rattus norvegicus
  subject_id: r1
  date_of_birth: 2026-01-05T00:00:00.000Z
  weight: 400
data_acq_device:
  - name: SpikeGadgets
    system: SpikeGadgets
    amplifier: NA
    adc_circuit: NA
cameras:
  - id: 4
    meters_per_pixel: 0.0014
    manufacturer: m
    model: m
    lens: l
    camera_name: cam4
tasks:
  - task_name: Run
    task_description: d
    task_environment: e
    camera_id:
      - 0
      - 4
      - 7
    task_epochs:
      - 2
associated_video_files:
  - name: v.mp4
    camera_id: 7
    task_epochs: 2
units:
  analog: "-1"
  behavioral_events: "-1"
times_period_multiplier: 1.5
raw_data_to_volts: 1.95e-7
default_header_file_path: default_header.xml
behavioral_events: []
device:
  name:
    - Trodes
electrode_groups: []
ntrode_electrode_group_channel_map: []
`;

const withoutVideos = yamlWithStaleCamera.replace(
  /associated_video_files:[\s\S]*?units:/,
  'associated_video_files: []\nunits:'
);

const withMalformedCameras = withoutVideos.replace(
  /cameras:[\s\S]*?tasks:/,
  'cameras:\n  id: 4\ntasks:'
);

const withMalformedTasks = withoutVideos.replace(
  /tasks:[\s\S]*?associated_video_files:/,
  'tasks:\n  camera_id: [4]\nassociated_video_files:'
);

describe('importFiles - stale camera references', () => {
  it('imports tasks with stale camera ids removed instead of excluding the section', async () => {
    const file = new File([withoutVideos], 'test.yml', { type: 'text/yaml' });
    const result = await importFiles(file);

    expect(result.success).toBe(true);
    expect(result.importSummary.excludedFields).toEqual([]);
    expect(result.formData.tasks).toHaveLength(1);
    expect(result.formData.tasks[0].camera_id).toEqual([4]);
  });

  it('excludes only associated_video_files when a video references a missing camera', async () => {
    // A video file needs an integer camera_id, so a stale single-valued
    // reference has no valid replacement; that section is excluded and
    // reported, while tasks still import with their stale ids dropped.
    const file = new File([yamlWithStaleCamera], 'test.yml', { type: 'text/yaml' });
    const result = await importFiles(file);

    expect(result.success).toBe(true);
    expect(result.importSummary.excludedFields.map((f) => f.field)).toEqual(['associated_video_files']);
    expect(result.formData.tasks[0].camera_id).toEqual([4]);
    expect(result.formData.associated_video_files).toEqual([]);
  });
});

describe('importFiles - nested required field', () => {
  it('excludes the cameras section (not a phantom "id" field) when a camera lacks its id', async () => {
    const yaml = withoutVideos.replace('  - id: 4\n    meters_per_pixel', '  - meters_per_pixel');
    expect(yaml).not.toContain('id: 4');
    const file = new File([yaml], 'test.yml', { type: 'text/yaml' });
    const result = await importFiles(file);

    expect(result.success).toBe(true);
    expect(result.importSummary.excludedFields.map((f) => f.field)).toContain('cameras');
    expect(result.formData.cameras).toEqual([]);
  });
});

describe('importFiles - schema-invalid camera section shapes', () => {
  it.each([
    ['cameras', withMalformedCameras],
    ['tasks', withMalformedTasks],
  ])('returns validation exclusions when %s is not an array', async (section, yaml) => {
    const file = new File([yaml], 'test.yml', { type: 'text/yaml' });
    const result = await importFiles(file);

    expect(result.success).toBe(true);
    expect(result.importSummary.excludedFields.map((field) => field.field)).toContain(section);
  });
});
