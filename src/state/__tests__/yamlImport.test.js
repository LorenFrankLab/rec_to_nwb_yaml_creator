/**
 * Attribution + rejection unit tests for the YAML decompose module.
 *
 * These assert WHERE each flat field lands (animalFacts vs dayFacts vs configuration)
 * and the opto null-vs-object / fs_gui day-ownership invariants — complementing the
 * byte-identity round-trip gate in yamlImport.roundtrip.test.js.
 */
import { describe, it, expect } from 'vitest';
import { encodeYaml, decodeYaml } from '../../io/yaml';
import { mergeDayMetadata } from '../workspaceUtils';
import { decomposeYaml, recomposeDayModel } from '../yamlImport';
import { buildRealisticWorkspace } from '../../__tests__/fixtures/workspaceBuilders';

/**
 * Decompose a genuine merge output of the realistic workspace.
 *
 * @returns {{ flat: object, result: object }} The decoded flat model and the decompose result.
 */
function decomposeRealistic() {
  const { animal, day } = buildRealisticWorkspace();
  const flat = decodeYaml(encodeYaml(mergeDayMetadata(animal, day)));
  const result = decomposeYaml(flat);
  expect(result.ok).toBe(true);
  return { flat, result };
}

describe('decomposeYaml attribution', () => {
  it('attributes subject / devices / cameras to animalFacts', () => {
    const { flat, result } = decomposeRealistic();
    expect(result.animalFacts.subject).toEqual(flat.subject);
    expect(result.animalFacts.devices.device).toEqual(flat.device);
    expect(result.animalFacts.devices.data_acq_device).toEqual(flat.data_acq_device);
    expect(result.animalFacts.cameras).toEqual(flat.cameras);
    expect(result.animalFacts.experimenters).toEqual({
      experimenter_name: flat.experimenter_name,
      lab: flat.lab,
      institution: flat.institution,
    });
  });

  it('exposes subjectId from the subject', () => {
    const { flat, result } = decomposeRealistic();
    expect(result.subjectId).toBe(flat.subject.subject_id);
  });

  it('attributes session / tasks / files / technical to dayFacts', () => {
    const { flat, result } = decomposeRealistic();
    expect(result.dayFacts.session.session_description).toBe(flat.session_description);
    expect(result.dayFacts.session.session_id).toBe(flat.session_id);
    expect(result.dayFacts.session.experiment_description).toBe(flat.experiment_description);
    expect(result.dayFacts.session.weight).toBe(flat.subject.weight);
    expect(result.dayFacts.tasks).toEqual(flat.tasks);
    expect(result.dayFacts.associated_files).toEqual(flat.associated_files);
    expect(result.dayFacts.associated_video_files).toEqual(flat.associated_video_files);
    expect(result.dayFacts.behavioral_events).toEqual(flat.behavioral_events);
    expect(result.dayFacts.technical.times_period_multiplier).toBe(flat.times_period_multiplier);
    expect(result.dayFacts.technical.raw_data_to_volts).toBe(flat.raw_data_to_volts);
  });

  it('attributes the single data_acq_device to the animal catalog AND day reference', () => {
    const { flat, result } = decomposeRealistic();
    expect(result.animalFacts.devices.data_acq_device).toEqual(flat.data_acq_device);
    expect(result.dayFacts.data_acq_device_name).toBe(flat.data_acq_device[0].name);
  });

  it('attributes electrode_groups + ntrode map to configuration', () => {
    const { flat, result } = decomposeRealistic();
    expect(result.configuration.electrode_groups).toEqual(flat.electrode_groups);
    expect(result.configuration.ntrode_electrode_group_channel_map).toEqual(
      flat.ntrode_electrode_group_channel_map
    );
  });

  it('sets cameras_used to the exported camera ids in order', () => {
    const { flat, result } = decomposeRealistic();
    expect(result.dayFacts.cameras_used).toEqual(flat.cameras.map((c) => c.id));
  });

  it('yields optogenetics === null for an opto-absent input', () => {
    const { result } = decomposeRealistic();
    expect(result.animalFacts.optogenetics).toBe(null);
    // fs_gui_yamls is day-owned even when empty.
    expect(result.dayFacts.fs_gui_yamls).toEqual([]);
    expect('fs_gui_yamls' in result.animalFacts).toBe(false);
  });

  it('populates optogenetics for an opto-present input, with fs_gui_yamls NOT inside it', () => {
    // Build a VALID opto merge output: opto present (so `opto_software` is emitted, the
    // presence signal) and a day-owned fs_gui_yamls protocol whose dio_output_name names
    // an existing behavioral event.
    const { animal: base, day: baseDay } = buildRealisticWorkspace();
    const animal = {
      ...base,
      optogenetics: {
        opto_excitation_source: [
          { name: 'laser_473', model_name: 'OBIS 473', description: 'Blue laser', wavelength_in_nm: 473, power_in_W: 0.01, intensity_in_W_per_m2: 100 },
        ],
        optical_fiber: [
          { name: 'fiber_CA1', hardware_name: 'Doric', implanted_fiber_description: '200um', location: 'CA1', hemisphere: 'right', ap_in_mm: 3, ml_in_mm: 2.5, dv_in_mm: 2, roll_in_deg: 0, pitch_in_deg: 0, yaw_in_deg: 0, reference: 'bregma', excitation_source: 'laser_473' },
        ],
        virus_injection: [
          { name: 'virus_CA1', description: 'ChR2', hemisphere: 'right', location: 'CA1', ap_in_mm: 3, ml_in_mm: 2.5, dv_in_mm: 2, roll_in_deg: 0, pitch_in_deg: 0, yaw_in_deg: 0, reference: 'bregma', virus_name: 'AAV-ChR2', titer_in_vg_per_ml: 1000000000000, volume_in_uL: 0.5 },
        ],
        optogenetic_stimulation_software: 'FsGui',
      },
    };
    const day = {
      ...baseDay,
      behavioral_events: [{ description: 'Stim trigger', name: 'stim_out' }],
      fs_gui_yamls: [
        { name: 'stim_protocol', epochs: [1], power_in_mW: 5, dio_output_name: 'stim_out', camera_id: 0, pulseLength: 10 },
      ],
    };

    const flat = decodeYaml(encodeYaml(mergeDayMetadata(animal, day)));
    const result = decomposeYaml(flat);
    expect(result.ok).toBe(true);

    const opto = result.animalFacts.optogenetics;
    expect(opto).not.toBe(null);
    expect(opto.optogenetic_stimulation_software).toBe('FsGui');
    expect(opto.opto_excitation_source).toEqual(flat.opto_excitation_source);
    expect(opto.virus_injection).toEqual(flat.virus_injection);
    // virus_injection carries BOTH volume spellings.
    expect(opto.virus_injection[0].volume_in_uL).toBe(0.5);
    expect(opto.virus_injection[0].volume_in_ul).toBe(0.5);
    // fs_gui_yamls is DAY-owned, never inside optogenetics.
    expect('fs_gui_yamls' in opto).toBe(false);
    expect(result.dayFacts.fs_gui_yamls).toEqual(flat.fs_gui_yamls);
  });
});

describe('decomposeYaml ownership (deep-cloned, non-aliasing output)', () => {
  it('returns pieces that do not alias the input model', () => {
    const { flat, result } = decomposeRealistic();
    // Nested objects/arrays are owned copies, not references into the input.
    expect(result.animalFacts.subject).not.toBe(flat.subject);
    expect(result.animalFacts.cameras).not.toBe(flat.cameras);
    expect(result.dayFacts.tasks).not.toBe(flat.tasks);
    expect(result.configuration.electrode_groups).not.toBe(flat.electrode_groups);
    // ...but they remain structurally equal.
    expect(result.animalFacts.subject).toEqual(flat.subject);
    expect(result.dayFacts.tasks).toEqual(flat.tasks);
    expect(result.configuration.electrode_groups).toEqual(flat.electrode_groups);
  });

  it('mutating a returned piece does not corrupt the caller input', () => {
    const { animal, day } = buildRealisticWorkspace();
    const input = decodeYaml(encodeYaml(mergeDayMetadata(animal, day)));
    const result = decomposeYaml(input);
    expect(result.ok).toBe(true);

    const tasksBefore = structuredClone(input.tasks);
    const weightBefore = input.subject.weight;

    // Mutate returned pieces (an array and a nested scalar).
    result.dayFacts.tasks.push({ task_name: 'INJECTED' });
    result.animalFacts.subject.weight = -999;

    // The caller's input object is untouched.
    expect(input.tasks).toEqual(tasksBefore);
    expect(input.subject.weight).toBe(weightBefore);
  });
});

describe('recomposeDayModel guard', () => {
  it('throws a clear error when handed a failed decompose result', () => {
    const failed = decomposeYaml({});
    expect(failed.ok).toBe(false);
    expect(() => recomposeDayModel(failed)).toThrow(
      'recomposeDayModel requires a successful decomposeYaml result'
    );
  });
});

describe('decomposeYaml rejection', () => {
  it('rejects a schema-invalid model with ok:false and issues (no partial result, no throw)', () => {
    const result = decomposeYaml({});
    expect(result.ok).toBe(false);
    expect(Array.isArray(result.issues)).toBe(true);
    expect(result.issues.length).toBeGreaterThan(0);
    expect(result.issues.some((i) => i.severity === 'error')).toBe(true);
    // No partial attribution leaked onto the rejection.
    expect(result.animalFacts).toBeUndefined();
    expect(result.dayFacts).toBeUndefined();
    expect(result.configuration).toBeUndefined();
  });
});
