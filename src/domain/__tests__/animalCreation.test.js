/**
 * Tests for the shared animal-creation glue (Phase 4b). The subject/metadata builder and the
 * default-experimenter resolver were inlined in the Home container; they are extracted here so the
 * workspace's inline "+ New Animal" panel and the Home route build identical animals from one truth
 * (no fork). These pin the exact shapes `createAnimal` is called with.
 */
import { describe, it, expect } from 'vitest';
import { buildAnimalFromForm, getDefaultExperimenters, subjectLookupKey, findAnimalIdByLookup, subjectIdCollision } from '../animalCreation';

/** A fully-processed form payload (AnimalCreationForm trims/filters/numbers before onSubmit). */
const baseForm = {
  subject_id: 'Remy',
  species: 'Rattus norvegicus',
  sex: 'M',
  genotype: 'Wild-type',
  date_of_birth: '2024-01-02T00:00:00.000Z',
  weight: 450,
  description: '',
  experimenter_names: ['Alice Jones'],
  lab: 'Frank Lab',
  institution: 'UCSF',
  experiment_description: 'Chronic tetrode recording',
};

describe('buildAnimalFromForm', () => {
  it('trims the subject_id into the store key and subject_id, preserving its case', () => {
    // The exported subject_id must match the recording filenames' animal token exactly (the
    // converter scanner is case-sensitive), so creation never case-folds it.
    const { animalId, subject } = buildAnimalFromForm({ ...baseForm, subject_id: '  Remy  ' });
    expect(animalId).toBe('Remy');
    expect(subject.subject_id).toBe('Remy');
  });

  it('subjectLookupKey / findAnimalIdByLookup match case-insensitively without changing identity', () => {
    expect(subjectLookupKey('  Remy ')).toBe('remy');
    expect(findAnimalIdByLookup('REMY', { Remy: {} })).toBe('Remy');
    expect(findAnimalIdByLookup('Remy', { Remy: {}, remy: {} })).toBe('Remy');
    expect(findAnimalIdByLookup('bean', { Remy: {} })).toBeNull();
  });

  it('findAnimalIdByLookup finds an animal by its STORED subject id, not only by its store key (a renamed animal)', () => {
    const animals = { remy: { subject: { subject_id: 'OtherRat' } } };
    expect(findAnimalIdByLookup('OtherRat', animals)).toBe('remy');
    expect(findAnimalIdByLookup('otherrat', animals)).toBe('remy');
    expect(findAnimalIdByLookup('remy', animals)).toBe('remy'); // the key still resolves (import by key)
  });

  it('subjectIdCollision names another animal already using the subject id, and ignores the animal being edited', () => {
    const animals = {
      remy: { subject: { subject_id: 'remy' } },
      other: { subject: { subject_id: 'OtherRat' } },
    };
    expect(subjectIdCollision('OtherRat', animals, 'remy')).toBe('other');
    expect(subjectIdCollision('otherrat', animals, 'remy')).toBe('other');
    expect(subjectIdCollision('Remy', animals, 'remy')).toBeNull(); // a case correction of itself
    expect(subjectIdCollision('bean', animals, 'remy')).toBeNull();
  });

  it('carries species, sex, genotype, dob and weight straight onto the subject', () => {
    const { subject } = buildAnimalFromForm(baseForm);
    expect(subject).toMatchObject({
      species: 'Rattus norvegicus',
      sex: 'M',
      genotype: 'Wild-type',
      date_of_birth: '2024-01-02T00:00:00.000Z',
      weight: 450,
    });
  });

  it('marks an unknown weight / date_of_birth as undefined (never a fabricated value)', () => {
    const { subject } = buildAnimalFromForm({ ...baseForm, weight: undefined, date_of_birth: '' });
    // Never 0 g and never an empty-string date. The explicit `undefined` is the store's "this fact
    // is unknown" spelling: `createAnimal` / `applyAnimalUpdates` land it as an ABSENT key, so the
    // same payload both creates a draft without the fact and CLEARS it on a later edit.
    expect(subject.weight).toBeUndefined();
    expect(subject.date_of_birth).toBeUndefined();
    // The rest of the identity is untouched.
    expect(subject.species).toBe('Rattus norvegicus');
  });

  it('auto-generates a description from genotype + species when blank', () => {
    const { subject } = buildAnimalFromForm({ ...baseForm, description: '' });
    expect(subject.description).toBe('Wild-type Rattus norvegicus');
  });

  it('keeps a provided description (trimmed)', () => {
    const { subject } = buildAnimalFromForm({ ...baseForm, description: '  Long Evans  ' });
    expect(subject.description).toBe('Long Evans');
  });

  it('builds metadata with experimenters, seeded devices, empty cameras and technical defaults', () => {
    const { metadata } = buildAnimalFromForm({
      ...baseForm,
      experimenter_names: ['Alice Jones', '', '  '],
    });
    expect(metadata.experimenters).toEqual({
      experimenter_name: ['Alice Jones'], // blank/whitespace names filtered out
      lab: 'Frank Lab',
      institution: 'UCSF',
    });
    expect(metadata.experiment_description).toBe('Chronic tetrode recording');
    expect(metadata.devices).toEqual({
      // Seeded with the lab-standard recording system (every golden fixture uses it) so a new animal
      // starts with one — consistent with "every animal needs ≥1 recording system". Editable on the
      // Recording System tab.
      data_acq_device: [
        { name: 'SpikeGadgets', system: 'SpikeGadgets', amplifier: 'Intan', adc_circuit: 'Intan' },
      ],
      device: { name: ['Trodes'] },
      electrode_groups: [],
      ntrode_electrode_group_channel_map: [],
    });
    expect(metadata.cameras).toEqual([]);
    expect(metadata.technicalDefaults).toEqual({
      raw_data_to_volts: 0.195,
      times_period_multiplier: 1.5,
    });
  });
});

describe('getDefaultExperimenters', () => {
  it('prefers non-empty workspace settings (camelCase keys)', () => {
    const result = getDefaultExperimenters({
      settings: {
        defaultLab: 'Test Lab',
        defaultInstitution: 'Test University',
        defaultExperimenters: ['Bob Smith'],
      },
      animals: {},
    });
    expect(result).toEqual({
      experimenter_names: ['Bob Smith'],
      lab: 'Test Lab',
      institution: 'Test University',
    });
  });

  it('falls back to the most-recent animal when settings are empty', () => {
    const result = getDefaultExperimenters({
      settings: {},
      animals: {
        remy: { experimenters: { experimenter_name: ['Alice Jones'], lab: 'Prev Lab', institution: 'Prev Inst' } },
      },
    });
    expect(result).toEqual({
      experimenter_names: ['Alice Jones'],
      lab: 'Prev Lab',
      institution: 'Prev Inst',
    });
  });

  it('falls back to hardcoded Frank Lab defaults with no settings and no animals', () => {
    const result = getDefaultExperimenters({ settings: {}, animals: {} });
    expect(result).toEqual({
      experimenter_names: [''],
      lab: 'Loren Frank Lab',
      institution: 'University of California, San Francisco',
    });
  });

  it('tolerates a missing animals map', () => {
    const result = getDefaultExperimenters({ settings: {} });
    expect(result.lab).toBe('Loren Frank Lab');
  });

  it('tolerates a most-recent animal that has no experimenters object (recovered/malformed)', () => {
    // The picker computes defaults over WHATEVER animals exist (incl. a recovered animal missing
    // `experimenters`); reading through it must not crash the whole workspace.
    const result = getDefaultExperimenters({
      settings: {},
      animals: { remy: { id: 'remy' } }, // no `experimenters`
    });
    expect(result).toEqual({ experimenter_names: [''], lab: '', institution: '' });
  });
});
