/**
 * Byte-for-byte legacy-export parity tests.
 *
 * Proves the new workspace export path produces bytes identical to the legacy
 * single-page form's export for the same session — i.e. `encodeYaml(mergeDayMetadata
 * (animal, day))` equals `encodeYaml(legacyFormData)`, key-for-key, byte-for-byte.
 *
 * The legacy reference is a fully-filled, schema-valid, non-optogenetics session
 * (the minimal golden fixtures are NOT legacy-exportable — legacy validation blocks
 * empty keywords/units/header — so they cannot serve as a byte target). The
 * reference is also grounded against a checked-in artifact so the harness compares
 * the new path to a stable captured legacy export, not just a second derivation of
 * the same code path.
 */
import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { encodeYaml, decodeYaml } from '../../../io/yaml';
import { validate } from '../../../validation';
import { mergeDayMetadata } from '../../../state/workspaceUtils';
import {
  buildLegacyFormData,
  buildEquivalentWorkspace,
} from '../../../__tests__/fixtures/legacyParityFixture';

const referenceArtifact = fs.readFileSync(
  path.join(__dirname, '../../../__tests__/fixtures/golden/legacy-export.reference.yml'),
  'utf8'
);

describe('legacy-export reference harness', () => {
  it('the legacy reference formData is schema-valid (genuinely legacy-exportable)', () => {
    expect(validate(buildLegacyFormData())).toEqual([]);
  });

  it('the harness reproduces the checked-in legacy-export artifact (not a tautology)', () => {
    expect(encodeYaml(buildLegacyFormData())).toBe(referenceArtifact);
  });
});

describe('byte-for-byte legacy parity', () => {
  it('new export path is byte-identical to the legacy export for the same session', () => {
    const { animal, day } = buildEquivalentWorkspace();

    const legacyBytes = encodeYaml(buildLegacyFormData());
    const newBytes = encodeYaml(mergeDayMetadata(animal, day));

    expect(newBytes).toBe(legacyBytes);
    // Cross-check against the checked-in legacy artifact too.
    expect(newBytes).toBe(referenceArtifact);
  });

  it('behavior preserved: only key order changed, no value drift', () => {
    const { animal, day } = buildEquivalentWorkspace();

    expect(decodeYaml(encodeYaml(mergeDayMetadata(animal, day)))).toEqual(
      decodeYaml(encodeYaml(buildLegacyFormData()))
    );
  });
});

describe('nested key order matches legacy formData', () => {
  const { animal, day } = buildEquivalentWorkspace();
  const merged = mergeDayMetadata(animal, day);

  it('top-level key order matches the legacy formData', () => {
    expect(Object.keys(merged)).toEqual(Object.keys(buildLegacyFormData()));
  });

  it('subject keys are in legacy order', () => {
    expect(Object.keys(merged.subject)).toEqual([
      'description', 'genotype', 'sex', 'species', 'subject_id', 'date_of_birth', 'weight',
    ]);
  });

  it('units keys are in legacy order', () => {
    expect(Object.keys(merged.units)).toEqual(['analog', 'behavioral_events']);
  });

  it('a data_acq_device item is in legacy order', () => {
    expect(Object.keys(merged.data_acq_device[0])).toEqual([
      'name', 'system', 'amplifier', 'adc_circuit',
    ]);
  });

  it('a cameras item is in legacy order', () => {
    expect(Object.keys(merged.cameras[0])).toEqual([
      'id', 'meters_per_pixel', 'manufacturer', 'model', 'lens', 'camera_name',
    ]);
  });

  it('a tasks item is in legacy order', () => {
    expect(Object.keys(merged.tasks[0])).toEqual([
      'task_name', 'task_description', 'task_environment', 'camera_id', 'task_epochs',
    ]);
  });

  it('an electrode_groups item is in legacy order', () => {
    expect(Object.keys(merged.electrode_groups[0])).toEqual([
      'id', 'location', 'device_type', 'description', 'targeted_location',
      'targeted_x', 'targeted_y', 'targeted_z', 'units',
    ]);
  });

  it('an ntrode item is in legacy order', () => {
    expect(Object.keys(merged.ntrode_electrode_group_channel_map[0])).toEqual([
      'ntrode_id', 'electrode_group_id', 'bad_channels', 'map',
    ]);
  });
});

describe('always-on key set matches legacy (non-optogenetics day)', () => {
  it('emits the empty optogenetics / fs_gui keys legacy always carries', () => {
    const { animal, day } = buildEquivalentWorkspace();
    const merged = mergeDayMetadata(animal, day);

    expect(merged.opto_excitation_source).toEqual([]);
    expect(merged.optical_fiber).toEqual([]);
    expect(merged.virus_injection).toEqual([]);
    expect(merged.fs_gui_yamls).toEqual([]);
    expect(merged.optogenetic_stimulation_software).toBe('');
  });
});

describe('lossless reordering', () => {
  it('preserves a nested key the canonical template does not know about', () => {
    const { animal, day } = buildEquivalentWorkspace();
    animal.subject.age = 'P164'; // a field absent from the legacy subject template

    const merged = mergeDayMetadata(animal, day);

    // Unknown keys are appended after the known ones, never dropped.
    expect(merged.subject.age).toBe('P164');
    expect(Object.keys(merged.subject)).toEqual([
      'description', 'genotype', 'sex', 'species', 'subject_id', 'date_of_birth', 'weight', 'age',
    ]);
  });
});
