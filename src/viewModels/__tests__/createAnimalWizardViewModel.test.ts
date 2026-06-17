/**
 * Unit tests for the pure create-animal wizard view-model.
 *
 * The wizard is a presentation layer over the SAME substrate the rest of the app uses: identity
 * validity reuses the DANDI predicates (`isValidSpecies`/`idHasSlash`) + the case-collision /
 * subject_id checks the retired AnimalCreationForm did, the commit payload reuses
 * `buildAnimalFromForm` (so the wizard and any other entry build an IDENTICAL animal), and the
 * optogenetics step's all-or-nothing meter reuses `optoFieldsPresence`. These tests pin the step
 * order, the per-step completeness, the required-for-export markers, identity validity, and the
 * commit payload — all React-free.
 */
import { describe, it, expect } from 'vitest';
import {
  WIZARD_STEPS,
  WIZARD_STEP_KEYS,
  validateWizardIdentity,
  validateWizardTeam,
  buildWizardCommitPayload,
  computeStepStatuses,
  buildCreateAnimalWizardViewModel,
} from '../createAnimalWizardViewModel';
import { buildAnimalFromForm } from '../../domain/animalCreation';

/** A fully-valid identity draft (the wizard's step-1 local state). */
function validIdentity(overrides = {}) {
  return {
    subject_id: 'laurent',
    species: 'Rattus norvegicus',
    speciesCustom: '',
    sex: 'M',
    genotype: 'Wild-type',
    date_of_birth: '2025-01-02',
    weight: '450',
    description: '',
    ...overrides,
  };
}

/** A minimal animal record (post-create) with the given setup slices. */
function makeAnimal(overrides = {}) {
  return {
    id: 'laurent',
    subject: { subject_id: 'laurent', species: 'Rattus norvegicus', sex: 'M' },
    devices: {
      data_acq_device: [{ name: 'SpikeGadgets', system: 'SpikeGadgets' }],
      device: { name: ['Trodes'] },
      electrode_groups: [],
      ntrode_electrode_group_channel_map: [],
    },
    cameras: [],
    experimenters: { experimenter_name: [], lab: '', institution: '' },
    taskTypes: [],
    optogenetics: undefined,
    ...overrides,
  };
}

describe('WIZARD_STEPS — step order + markers', () => {
  it('orders the seven steps Identity → Electrodes → Cameras → Optogenetics → Tasks → Recording system → Team', () => {
    expect(WIZARD_STEP_KEYS).toEqual([
      'identity',
      'electrodes',
      'cameras',
      'optogenetics',
      'tasks',
      'recording-system',
      'team',
    ]);
  });

  it('numbers the steps 1..7 in display order', () => {
    expect(WIZARD_STEPS.map((s) => s.number)).toEqual([1, 2, 3, 4, 5, 6, 7]);
  });

  it('marks ONLY optogenetics optional (the mockup tags it "optional"; the rest are standard setup)', () => {
    const optional = WIZARD_STEPS.filter((s) => s.optional).map((s) => s.key);
    expect(optional).toEqual(['optogenetics']);
  });

  it('marks identity, electrodes, recording-system and team required-for-export', () => {
    const required = WIZARD_STEPS.filter((s) => s.requiredForExport).map((s) => s.key);
    expect(required).toEqual(['identity', 'electrodes', 'recording-system', 'team']);
  });
});

describe('validateWizardIdentity — identity validity', () => {
  it('accepts a complete, well-formed identity', () => {
    expect(validateWizardIdentity(validIdentity(), {}).valid).toBe(true);
  });

  it('rejects a free-text species (NCBI/binomial only) via isValidSpecies', () => {
    const result = validateWizardIdentity(
      validIdentity({ species: 'other', speciesCustom: 'Rat' }),
      {}
    );
    expect(result.valid).toBe(false);
    expect(result.errors.speciesCustom).toMatch(/scientific name|NCBI|binomial/i);
  });

  it('accepts a custom Latin binomial species via isValidSpecies', () => {
    const result = validateWizardIdentity(
      validIdentity({ species: 'other', speciesCustom: 'Homo sapiens' }),
      {}
    );
    expect(result.valid).toBe(true);
  });

  it('rejects a subject_id containing a slash via idHasSlash (DANDI)', () => {
    const result = validateWizardIdentity(validIdentity({ subject_id: 'a/b' }), {});
    expect(result.valid).toBe(false);
    expect(result.errors.subject_id).toMatch(/\//);
  });

  it('rejects a subject_id that collides with an existing animal (case-insensitive store key)', () => {
    const result = validateWizardIdentity(validIdentity({ subject_id: 'Laurent' }), {
      laurent: {},
    });
    expect(result.valid).toBe(false);
    expect(result.errors.subject_id).toMatch(/already exists/i);
  });

  it('flags missing required identity fields', () => {
    const result = validateWizardIdentity(
      validIdentity({ subject_id: '', genotype: '', weight: '', date_of_birth: '' }),
      {}
    );
    expect(result.valid).toBe(false);
    expect(Object.keys(result.errors)).toEqual(
      expect.arrayContaining(['subject_id', 'genotype', 'weight', 'date_of_birth'])
    );
  });

  it('rejects a future date of birth', () => {
    const result = validateWizardIdentity(validIdentity({ date_of_birth: '2999-01-01' }), {});
    expect(result.valid).toBe(false);
    expect(result.errors.date_of_birth).toMatch(/future/i);
  });

  it('rejects a negative weight', () => {
    const result = validateWizardIdentity(validIdentity({ weight: '-5' }), {});
    expect(result.valid).toBe(false);
    expect(result.errors.weight).toBeTruthy();
  });
});

describe('buildWizardCommitPayload — the createAnimal payload', () => {
  it('delegates to buildAnimalFromForm so the wizard builds an IDENTICAL animal to any other entry', () => {
    const identity = validIdentity({ subject_id: 'Laurent', weight: '450', description: '' });
    const payload = buildWizardCommitPayload(identity);
    // Same shape the shared glue produces from an AnimalCreationForm payload (lower-cased key,
    // numeric weight, derived description). Experimenters seed from defaults later (Team step).
    const expected = buildAnimalFromForm({
      subject_id: 'Laurent',
      species: 'Rattus norvegicus',
      sex: 'M',
      genotype: 'Wild-type',
      date_of_birth: new Date('2025-01-02').toISOString(),
      weight: 450,
      description: '',
      experimenter_names: [],
      lab: '',
      institution: '',
      experiment_description: '',
    });
    expect(payload.animalId).toBe('laurent');
    expect(payload.subject).toEqual(expected.subject);
  });

  it('resolves a custom species to its trimmed value', () => {
    const payload = buildWizardCommitPayload(
      validIdentity({ species: 'other', speciesCustom: '  Homo sapiens  ' })
    );
    expect(payload.subject.species).toBe('Homo sapiens');
  });
});

describe('computeStepStatuses — per-step completeness', () => {
  it('identity is complete only when the draft is valid', () => {
    expect(
      computeStepStatuses(null, { identityValid: true, behaviorOnly: false }).identity
    ).toBe('complete');
    expect(
      computeStepStatuses(null, { identityValid: false, behaviorOnly: false }).identity
    ).toBe('incomplete');
  });

  it('electrodes is complete with ≥1 group, skipped when behavior-only, else incomplete', () => {
    const withGroups = makeAnimal({
      devices: { electrode_groups: [{ id: 0 }], ntrode_electrode_group_channel_map: [], data_acq_device: [], device: { name: ['Trodes'] } },
    });
    expect(
      computeStepStatuses(withGroups, { identityValid: true, behaviorOnly: false }).electrodes
    ).toBe('complete');
    expect(
      computeStepStatuses(makeAnimal(), { identityValid: true, behaviorOnly: true }).electrodes
    ).toBe('skipped');
    expect(
      computeStepStatuses(makeAnimal(), { identityValid: true, behaviorOnly: false }).electrodes
    ).toBe('incomplete');
  });

  it('team is complete only when an experimenter name + experiment description + lab + institution are present', () => {
    const complete = makeAnimal({
      experiment_description: 'Chronic tetrode recording during spatial navigation',
      experimenters: { experimenter_name: ['Doe, Jane'], lab: 'Frank', institution: 'UCSF' },
    });
    expect(
      computeStepStatuses(complete, { identityValid: true, behaviorOnly: false }).team
    ).toBe('complete');
    expect(
      computeStepStatuses(makeAnimal(), { identityValid: true, behaviorOnly: false }).team
    ).toBe('incomplete');
  });

  it('recording-system is complete with ≥1 data_acq_device (seeded by default)', () => {
    expect(
      computeStepStatuses(makeAnimal(), { identityValid: true, behaviorOnly: false })['recording-system']
    ).toBe('complete');
  });
});

describe('validateWizardTeam — first-day required metadata', () => {
  it('requires experiment description, lab, and institution before finishing', () => {
    const result = validateWizardTeam({ experiment_description: '', lab: '', institution: '' });
    expect(result.valid).toBe(false);
    expect(result.errors.experiment_description).toMatch(/required/i);
    expect(result.errors.lab).toMatch(/required/i);
    expect(result.errors.institution).toMatch(/required/i);
  });

  it('accepts the Frank Lab defaults plus an experiment description', () => {
    expect(
      validateWizardTeam({
        experiment_description: 'Chronic tetrode recording during spatial navigation',
        lab: 'Loren Frank Lab',
        institution: 'University of California, San Francisco',
      }).valid
    ).toBe(true);
  });
});

describe('optogenetics step — all-or-nothing via optoFieldsPresence', () => {
  const enabledOpto = (count: number): Record<string, unknown> => {
    const opto: Record<string, unknown> = {};
    const lists = ['opto_excitation_source', 'optical_fiber', 'virus_injection'];
    lists.slice(0, Math.min(count, 3)).forEach((k) => {
      opto[k] = [{}];
    });
    if (count >= 4) opto.optogenetic_stimulation_software = 'fsgui';
    return opto;
  };

  it('is optional (neutral) when no opto fields are present', () => {
    expect(
      computeStepStatuses(makeAnimal({ optogenetics: undefined }), {
        identityValid: true,
        behaviorOnly: false,
      }).optogenetics
    ).toBe('optional');
  });

  it('is complete when all four opto sections are present', () => {
    expect(
      computeStepStatuses(makeAnimal({ optogenetics: enabledOpto(4) }), {
        identityValid: true,
        behaviorOnly: false,
      }).optogenetics
    ).toBe('complete');
  });

  it('is incomplete (blocking) when only some of the four are present (partial drops all opto)', () => {
    expect(
      computeStepStatuses(makeAnimal({ optogenetics: enabledOpto(2) }), {
        identityValid: true,
        behaviorOnly: false,
      }).optogenetics
    ).toBe('incomplete');
  });
});

describe('buildCreateAnimalWizardViewModel — the assembled view-model', () => {
  it('exposes the steps with their resolved status + the active step', () => {
    const vm = buildCreateAnimalWizardViewModel({
      currentStepKey: 'electrodes',
      identity: validIdentity(),
      existingAnimals: {},
      animal: makeAnimal(),
      behaviorOnly: false,
    });
    expect(vm.steps.map((s) => s.key)).toEqual(WIZARD_STEP_KEYS);
    expect(vm.steps.find((s) => s.key === 'electrodes')?.isActive).toBe(true);
    expect(vm.steps.find((s) => s.key === 'identity')?.status).toBe('complete');
  });

  it('labels the footer "Create animal" on the last step and "Next" elsewhere', () => {
    const base = {
      identity: validIdentity(),
      existingAnimals: {},
      animal: makeAnimal(),
      behaviorOnly: false,
    };
    expect(
      buildCreateAnimalWizardViewModel({ ...base, currentStepKey: 'identity' }).nextLabel
    ).toMatch(/next/i);
    expect(
      buildCreateAnimalWizardViewModel({ ...base, currentStepKey: 'team' }).nextLabel
    ).toMatch(/create animal/i);
  });

  it('keeps the identity step complete once the animal exists (a self-collision must not regress it)', () => {
    // After create, the draft id matches the just-created animal, so the live uniqueness check would
    // (correctly) flag a self-collision — the identity step must stay complete regardless.
    const vm = buildCreateAnimalWizardViewModel({
      currentStepKey: 'electrodes',
      identity: validIdentity({ subject_id: 'laurent' }),
      existingAnimals: { laurent: {} },
      animal: makeAnimal(),
      behaviorOnly: false,
    });
    expect(vm.steps.find((s) => s.key === 'identity')?.status).toBe('complete');
  });

  it('reports identity validity (gates leaving step 1) and exposes the opto meter', () => {
    const vm = buildCreateAnimalWizardViewModel({
      currentStepKey: 'identity',
      identity: validIdentity({ subject_id: '' }),
      existingAnimals: {},
      animal: null,
      behaviorOnly: false,
    });
    expect(vm.identity.valid).toBe(false);
    expect(vm.opto.count).toBe(0);
  });
});
