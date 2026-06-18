/**
 * Unit tests for the pure Import & Repair spine ({@link module:state/importRepair}).
 *
 * The repair screen does not own a second validator: every flagged field comes from the SAME
 * `validate(model)` the export gate uses, and every SUGGESTED value is gated by the SAME predicate
 * that flagged it (a species suggestion must pass `isValidSpecies`, a sex suggestion must be in the
 * schema enum). Nothing is silently dropped — each item carries the original value verbatim, and
 * unmappable values surface as user-input rows rather than being auto-erased.
 */
import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { decodeYaml } from '../../io/yaml';
import { validate } from '../../validation';
import { isValidSpecies } from '../../validation/dandiSubject';
import {
  buildImportRepairPlan,
  applyImportRepairs,
  collectExistingAnimalCatalogAdditions,
  existingAnimalCatalogResolutionBlocker,
} from '../importRepair';
import type { RepairItem } from '../importRepair';

const fixtureDir = path.join(__dirname, '../../__tests__/fixtures/import');

/**
 * Decode the committed non-conforming fixture into a flat model.
 * @returns The decoded flat metadata object.
 */
function loadNonconforming(): Record<string, unknown> {
  const text = fs.readFileSync(path.join(fixtureDir, 'nonconforming-remy.yml'), 'utf8');
  return decodeYaml(text) as Record<string, unknown>;
}

/**
 * Decode a clean app export fixture into a flat model.
 * @returns The decoded flat metadata object.
 */
function loadCleanExport(): Record<string, unknown> {
  const text = fs.readFileSync(
    path.join(__dirname, '../../__tests__/fixtures/golden/workspace-export.realistic.yml'),
    'utf8'
  );
  return decodeYaml(text) as Record<string, unknown>;
}

/**
 * Find the single repair item at a dot/bracket path.
 * @param items - The plan's repair items.
 * @param itemPath - The path to look up (e.g. `subject.species`).
 * @returns The matching item, or undefined.
 */
function itemAt(items: RepairItem[], itemPath: string): RepairItem | undefined {
  return items.find((i) => i.path === itemPath);
}

describe('buildImportRepairPlan — flags each non-conforming field from the shared validator', () => {
  it('suggests the canonical species from the same predicate that flagged it', () => {
    const plan = buildImportRepairPlan(loadNonconforming(), 'nonconforming-remy.yml', { animals: {} });
    const species = itemAt(plan.items, 'subject.species');
    expect(species).toBeDefined();
    expect(species!.kind).toBe('suggestion');
    expect(species!.was).toBe('Rat');
    expect(species!.suggested).toBe('Rattus norvegicus');
    // The suggestion is validated by the SAME predicate that flagged the original.
    expect(isValidSpecies(species!.suggested)).toBe(true);
  });

  it('suggests the single-letter sex from the schema enum', () => {
    const plan = buildImportRepairPlan(loadNonconforming(), 'nonconforming-remy.yml', { animals: {} });
    const sex = itemAt(plan.items, 'subject.sex');
    expect(sex).toBeDefined();
    expect(sex!.kind).toBe('suggestion');
    expect(sex!.was).toBe('Male');
    expect(sex!.suggested).toBe('M');
  });

  it('suggests the numeric weight parsed from a "541g"-style string', () => {
    const plan = buildImportRepairPlan(loadNonconforming(), 'nonconforming-remy.yml', { animals: {} });
    const weight = itemAt(plan.items, 'subject.weight');
    expect(weight).toBeDefined();
    expect(weight!.kind).toBe('suggestion');
    expect(weight!.was).toBe('485g');
    expect(weight!.suggested).toBe(485);
  });

  it('suggests wrapping a scalar experimenter_name into a list, preserving the name verbatim', () => {
    const plan = buildImportRepairPlan(loadNonconforming(), 'nonconforming-remy.yml', { animals: {} });
    const exp = itemAt(plan.items, 'experimenter_name');
    expect(exp).toBeDefined();
    expect(exp!.kind).toBe('suggestion');
    expect(exp!.was).toBe('Guidera, Jennifer');
    // No laundering of the name order — only the list-wrapping is suggested.
    expect(exp!.suggested).toEqual(['Guidera, Jennifer']);
  });

  it('flags an empty electrode-group location as a user-input row (never auto-filled)', () => {
    const plan = buildImportRepairPlan(loadNonconforming(), 'nonconforming-remy.yml', { animals: {} });
    const loc = itemAt(plan.items, 'electrode_groups[0].location');
    expect(loc).toBeDefined();
    expect(loc!.kind).toBe('input');
    expect(loc!.suggested).toBeUndefined();
    expect(loc!.group).toBe('attention');
  });

  it('blocks on a required-but-missing date_of_birth', () => {
    const plan = buildImportRepairPlan(loadNonconforming(), 'nonconforming-remy.yml', { animals: {} });
    const dob = itemAt(plan.items, 'subject.date_of_birth');
    expect(dob).toBeDefined();
    expect(dob!.group).toBe('required');
    expect(dob!.kind).toBe('input');
    expect(dob!.inputType).toBe('date');
    expect(plan.hasErrors).toBe(true);
  });

  it('never silently drops a value: every flagged item carries the original value', () => {
    const plan = buildImportRepairPlan(loadNonconforming(), 'nonconforming-remy.yml', { animals: {} });
    // Every "attention" item (one that had an original value) preserves it verbatim.
    for (const item of plan.items.filter((i) => i.group === 'attention')) {
      expect('was' in item).toBe(true);
    }
  });
});

describe('buildImportRepairPlan — new-animal vs existing-day decision', () => {
  it('routes to a new animal when no animal matches the subject id', () => {
    const plan = buildImportRepairPlan(loadNonconforming(), 'nonconforming-remy.yml', { animals: {} });
    expect(plan.decision).toEqual({ kind: 'new', subjectId: 'remy' });
  });

  it('routes to the existing animal when one matches the subject id', () => {
    const workspace = { animals: { remy: { subject: { subject_id: 'remy' } } } };
    const plan = buildImportRepairPlan(loadNonconforming(), 'nonconforming-remy.yml', workspace);
    expect(plan.decision).toEqual({ kind: 'existing', subjectId: 'remy', existingAnimalId: 'remy' });
  });

  it('matches on a NORMALIZED subject id (a case/whitespace variant is the same animal)', () => {
    const model = loadNonconforming();
    (model.subject as { subject_id: string }).subject_id = '  Remy  ';
    const workspace = { animals: { remy: { subject: { subject_id: 'remy' } } } };
    const plan = buildImportRepairPlan(model, 'nonconforming-remy.yml', workspace);
    // "  Remy  " must route to the existing "remy" (add a day), never a duplicate animal.
    expect(plan.decision).toEqual({ kind: 'existing', subjectId: '  Remy  ', existingAnimalId: 'remy' });
  });
});

describe('buildImportRepairPlan — structured required-missing fields are fix-in-file blockers', () => {
  it('routes a missing experimenter_name / data_acq_device to blockers, not text inputs', () => {
    const model = loadNonconforming();
    delete (model as Record<string, unknown>).experimenter_name;
    delete (model as Record<string, unknown>).data_acq_device;
    const plan = buildImportRepairPlan(model, 'nonconforming-remy.yml', { animals: {} });
    // They are NOT offered as inline inputs (a single text value can't satisfy an array schema)…
    expect(plan.items.some((i) => i.path === 'experimenter_name')).toBe(false);
    expect(plan.items.some((i) => i.path === 'data_acq_device')).toBe(false);
    // …they are surfaced as fix-in-file blockers (which keep the import blocked).
    expect(plan.blockers.map((b) => b.path)).toEqual(
      expect.arrayContaining(['experimenter_name', 'data_acq_device'])
    );
  });

  it('routes a missing subject_id to a fix-in-file blocker, not a dead-end input', () => {
    const model = loadNonconforming();
    delete (model.subject as Record<string, unknown>).subject_id;
    const plan = buildImportRepairPlan(model, 'nonconforming-remy.yml', { animals: {} });
    // The identity id is NOT an editable row (filling it could never enable import — the decision
    // is computed once and would stay blocked); it is a fix-in-file blocker, and the decision is
    // blocked, so the two agree.
    expect(plan.items.some((i) => i.path === 'subject.subject_id')).toBe(false);
    expect(plan.blockers.some((b) => b.path === 'subject.subject_id')).toBe(true);
    expect(plan.decision.kind).toBe('blocked');
  });
});

describe('applyImportRepairs — accepting fixes yields a model that validates clean', () => {
  it('produces a zero-error model once every fix is accepted and required input supplied', () => {
    const model = loadNonconforming();
    const repaired = applyImportRepairs(model, {
      'subject.species': 'Rattus norvegicus',
      'subject.sex': 'M',
      'subject.weight': 485,
      experimenter_name: ['Guidera, Jennifer'],
      'subject.date_of_birth': '2023-01-10T00:00:00',
      'electrode_groups[0].location': 'CA1',
    });
    const errors = validate(repaired as never).filter((i) => i.severity === 'error');
    expect(errors).toEqual([]);
  });

  it('never mutates the input model', () => {
    const model = loadNonconforming();
    const before = JSON.stringify(model);
    applyImportRepairs(model, { 'subject.sex': 'M' });
    expect(JSON.stringify(model)).toBe(before);
  });
});

describe('benign normalizations — auto-applied and listed, never silent', () => {
  it('renames known legacy space-key schema fields before validation and attribution', () => {
    const model = loadNonconforming();
    const subject = model.subject as Record<string, unknown>;
    subject['subject id'] = subject.subject_id;
    delete subject.subject_id;
    model['data acq device'] = model.data_acq_device;
    delete model.data_acq_device;
    model['electrode groups'] = model.electrode_groups;
    delete model.electrode_groups;
    model['ntrode electrode group channel map'] = model.ntrode_electrode_group_channel_map;
    delete model.ntrode_electrode_group_channel_map;

    const plan = buildImportRepairPlan(model, 'legacy-space-keys.yml', { animals: {} });

    expect(plan.decision).toEqual({ kind: 'new', subjectId: 'remy' });
    expect(plan.blockers.some((b) => b.path === 'subject.subject_id')).toBe(false);
    expect(plan.benign.map((b) => b.label)).toEqual(
      expect.arrayContaining([
        'subject id → subject_id',
        'data acq device → data_acq_device',
        'electrode groups → electrode_groups',
        'ntrode electrode group channel map → ntrode_electrode_group_channel_map',
      ])
    );

    const repaired = applyImportRepairs(model, {});
    expect(repaired.subject).toHaveProperty('subject_id', 'remy');
    expect(repaired.subject).not.toHaveProperty('subject id');
    expect(repaired).toHaveProperty('data_acq_device');
    expect(repaired).not.toHaveProperty('data acq device');
    expect(repaired).toHaveProperty('electrode_groups');
    expect(repaired).not.toHaveProperty('electrode groups');
    expect(repaired).toHaveProperty('ntrode_electrode_group_channel_map');
    expect(repaired).not.toHaveProperty('ntrode electrode group channel map');
  });

  it('does not rewrite arbitrary space-containing keys', () => {
    const model = { subject: { subject_id: 'remy' }, 'custom legacy key': 'keep me' };

    const repaired = applyImportRepairs(model, {});

    expect(repaired).toHaveProperty('custom legacy key', 'keep me');
    expect(repaired).not.toHaveProperty('custom_legacy_key');
  });

  it('renames task_epoch (singular) to task_epochs and lists it', () => {
    const model = {
      associated_video_files: [{ name: 'v', camera_id: 0, task_epoch: 2 }],
    };
    const plan = buildImportRepairPlan(model, 'f.yml', { animals: {} });
    expect(plan.benign.some((b) => b.detail.includes('task_epoch'))).toBe(true);

    const repaired = applyImportRepairs(model, {}) as {
      associated_video_files: Array<Record<string, unknown>>;
    };
    expect(repaired.associated_video_files[0]).toHaveProperty('task_epochs', 2);
    expect(repaired.associated_video_files[0]).not.toHaveProperty('task_epoch');
  });

  it('normalizes one-item task_epochs lists to the scalar schema form and lists it', () => {
    const model = {
      associated_files: [{ name: 'statescript', task_epochs: [4] }],
      associated_video_files: [{ name: 'v', camera_id: 0, task_epochs: [4] }],
    };

    const plan = buildImportRepairPlan(model, 'f.yml', { animals: {} });
    expect(itemAt(plan.items, 'associated_files[0].task_epochs')).toBeUndefined();
    expect(itemAt(plan.items, 'associated_video_files[0].task_epochs')).toBeUndefined();
    expect(plan.benign.some((b) => b.label === 'task_epochs list → scalar')).toBe(true);

    const repaired = applyImportRepairs(model, {}) as {
      associated_files: Array<Record<string, unknown>>;
      associated_video_files: Array<Record<string, unknown>>;
    };
    expect(repaired.associated_files[0].task_epochs).toBe(4);
    expect(repaired.associated_video_files[0].task_epochs).toBe(4);
  });

  it('surfaces multi-item task_epochs lists as a repair item instead of silently picking one', () => {
    const model = {
      associated_files: [{ name: 'statescript', task_epochs: [4, 5] }],
    };

    const plan = buildImportRepairPlan(model, 'f.yml', { animals: {} });
    const item = itemAt(plan.items, 'associated_files[0].task_epochs');
    expect(item).toBeDefined();
    expect(item!.code).toBe('task_epochs_multi_value');
    expect(item!.kind).toBe('input');
    expect(item!.was).toEqual([4, 5]);
    expect(plan.blockers.some((blocker) => blocker.path === 'associated_files[0].task_epochs')).toBe(false);

    const unresolved = applyImportRepairs(model, {}) as {
      associated_files: Array<Record<string, unknown>>;
    };
    expect(unresolved.associated_files[0].task_epochs).toEqual([4, 5]);

    const repaired = applyImportRepairs(model, {
      'associated_files[0].task_epochs': 4,
    }) as { associated_files: Array<Record<string, unknown>> };
    expect(repaired.associated_files[0].task_epochs).toBe(4);
  });

  it('treats equal task_epoch / task_epochs values as benign', () => {
    const model = {
      associated_files: [{ name: 'statescript', task_epoch: 2, task_epochs: 2 }],
    };
    const plan = buildImportRepairPlan(model, 'f.yml', { animals: {} });

    expect(itemAt(plan.items, 'associated_files[0].task_epochs')).toBeUndefined();
    expect(plan.benign.some((b) => b.detail.includes('task_epoch'))).toBe(true);

    const repaired = applyImportRepairs(model, {}) as {
      associated_files: Array<Record<string, unknown>>;
    };
    expect(repaired.associated_files[0]).toEqual({ name: 'statescript', task_epochs: 2 });
  });

  it('treats task_epoch and one-item task_epochs list with the same value as benign', () => {
    const model = {
      associated_video_files: [{ name: 'v', camera_id: 0, task_epoch: 2, task_epochs: [2] }],
    };

    const plan = buildImportRepairPlan(model, 'f.yml', { animals: {} });
    expect(itemAt(plan.items, 'associated_video_files[0].task_epochs')).toBeUndefined();
    expect(plan.benign.map((b) => b.label)).toEqual(
      expect.arrayContaining(['task_epoch → task_epochs', 'task_epochs list → scalar'])
    );

    const repaired = applyImportRepairs(model, {}) as {
      associated_video_files: Array<Record<string, unknown>>;
    };
    expect(repaired.associated_video_files[0]).toEqual({ name: 'v', camera_id: 0, task_epochs: 2 });
  });

  it('surfaces different task_epoch / task_epochs values as a reconcile item, not benign', () => {
    const model = {
      associated_files: [{ name: 'statescript', task_epoch: 2, task_epochs: 3 }],
    };
    const plan = buildImportRepairPlan(model, 'f.yml', { animals: {} });
    const item = itemAt(plan.items, 'associated_files[0].task_epochs');

    expect(item).toBeDefined();
    expect(item!.code).toBe('task_epoch_conflict');
    expect(item!.was).toBe(2);
    expect(item!.suggested).toBe(3);
    expect(plan.benign.some((b) => b.detail.includes('task_epoch'))).toBe(false);

    const unresolved = applyImportRepairs(model, {}) as {
      associated_files: Array<Record<string, unknown>>;
    };
    expect(unresolved.associated_files[0]).toEqual({
      name: 'statescript',
      task_epoch: 2,
      task_epochs: 3,
    });

    const reconciled = applyImportRepairs(model, {
      'associated_files[0].task_epochs': 3,
    }) as { associated_files: Array<Record<string, unknown>> };
    expect(reconciled.associated_files[0]).toEqual({ name: 'statescript', task_epochs: 3 });
  });

  it('preserves a no-epoch video row as an explicit required repair, never auto-assigning it', () => {
    const model = {
      associated_video_files: [{ name: 'v', camera_id: 0 }],
    };

    const plan = buildImportRepairPlan(model, 'f.yml', { animals: {} });
    const item = itemAt(plan.items, 'associated_video_files[0].task_epochs');
    expect(item).toBeDefined();
    expect(item!.group).toBe('required');
    expect(item!.kind).toBe('input');

    const repaired = applyImportRepairs(model, {}) as {
      associated_video_files: Array<Record<string, unknown>>;
    };
    expect(repaired.associated_video_files[0]).not.toHaveProperty('task_epochs');
  });
});

describe('import-only repair rows — scalar coercions and recording date', () => {
  it('suggests a numeric times_period_multiplier from a legacy string with suffix text', () => {
    const model = loadNonconforming();
    model.times_period_multiplier = '1.5cd';

    const plan = buildImportRepairPlan(model, 'nonconforming-remy.yml', { animals: {} });
    const item = itemAt(plan.items, 'times_period_multiplier');
    expect(item).toBeDefined();
    expect(item!.kind).toBe('suggestion');
    expect(item!.was).toBe('1.5cd');
    expect(item!.suggested).toBe(1.5);
  });

  it('surfaces a slash-containing session_id as a repair row, not a fix-in-file blocker', () => {
    const model = loadNonconforming();
    model.session_id = 'remy/20230622';

    const plan = buildImportRepairPlan(model, 'nonconforming-remy.yml', { animals: {} });
    const item = itemAt(plan.items, 'session_id');
    expect(item).toBeDefined();
    expect(item!.code).toBe('session_id_slash');
    expect(item!.suggested).toBe('remy_20230622');
    expect(plan.blockers.some((blocker) => blocker.path === 'session_id')).toBe(false);
  });

  it('adds a manual recording-date input when filename and session_id cannot supply one', () => {
    const model = loadCleanExport();
    model.session_id = 'remy';

    const plan = buildImportRepairPlan(model, 'metadata.yml', { animals: {} });
    const item = itemAt(plan.items, '__importRepair.recording_date');
    expect(item).toBeDefined();
    expect(item!.code).toBe('missing_recording_date');
    expect(item!.inputType).toBe('date');
    expect(item!.group).toBe('required');
  });

  it('applies the manual recording-date marker without changing exported model fields', () => {
    const model = loadCleanExport();
    model.session_id = 'remy';

    const repaired = applyImportRepairs(model, {
      '__importRepair.recording_date': '2023-06-22T00:00:00',
    });

    expect(repaired).toMatchObject({
      __importRepair: { recording_date: '2023-06-22T00:00:00' },
      session_id: 'remy',
    });
  });
});

describe('existing-animal add catalog refs — surface and resolve before import', () => {
  it('surfaces missing imported camera and recording-system refs as choice rows', () => {
    const model = loadCleanExport();
    model.cameras = [
      {
        id: 3,
        camera_name: 'arena_side',
        meters_per_pixel: 0.001,
        manufacturer: 'Allied',
        model: 'Mako',
        lens: '8mm',
      },
    ];
    model.data_acq_device = [
      { name: 'ImportedRig', system: 'MCU', amplifier: 'Intan', adc_circuit: 'Intan' },
    ];
    const workspace = {
      animals: {
        remy: {
          id: 'remy',
          subject: { subject_id: 'remy' },
          cameras: [{ id: 0, camera_name: 'existing_cam' }],
          devices: {
            data_acq_device: [
              { name: 'ExistingRig', system: 'MCU', amplifier: 'Intan', adc_circuit: 'Intan' },
            ],
          },
        },
      },
    };

    const plan = buildImportRepairPlan(model, '06222023_remy_metadata.yml', workspace);
    const camera = plan.items.find((item) => item.code === 'existing_animal_missing_camera');
    const device = plan.items.find(
      (item) => item.code === 'existing_animal_missing_data_acq_device'
    );

    expect(camera).toMatchObject({
      kind: 'choice',
      suggested: 'Bring referenced catalog entry',
    });
    expect(device).toMatchObject({
      kind: 'choice',
      suggested: 'Bring referenced catalog entry',
    });
    expect(existingAnimalCatalogResolutionBlocker(plan, {})).toMatch(/Resolve Camera 3/);

    const additions = collectExistingAnimalCatalogAdditions(plan, {
      [camera!.path]: camera!.suggested,
      [device!.path]: device!.suggested,
    });
    expect(additions.remy.cameras).toEqual([expect.objectContaining({ id: 3 })]);
    expect(additions.remy.data_acq_device).toEqual([
      expect.objectContaining({ name: 'ImportedRig' }),
    ]);
    expect(
      existingAnimalCatalogResolutionBlocker(plan, {
        [camera!.path]: camera!.suggested,
        [device!.path]: device!.suggested,
      })
    ).toBeNull();
  });

  it('forces map/fix when a missing camera id would collide by camera name', () => {
    const model = loadCleanExport();
    model.cameras = [
      {
        id: 3,
        camera_name: 'existing_cam',
        meters_per_pixel: 0.001,
        manufacturer: 'Allied',
        model: 'Mako',
        lens: '8mm',
      },
    ];
    model.tasks = [
      {
        task_name: 'Run',
        task_description: 'run',
        task_environment: 'maze',
        camera_id: [3],
        task_epochs: [1],
      },
    ];
    model.associated_video_files = [{ name: 'run_video', camera_id: 3, task_epochs: 1 }];
    const workspace = {
      animals: {
        remy: {
          id: 'remy',
          subject: { subject_id: 'remy' },
          cameras: [{ id: 0, camera_name: 'existing_cam' }],
          devices: { data_acq_device: model.data_acq_device },
        },
      },
    };

    const plan = buildImportRepairPlan(model, '06222023_remy_metadata.yml', workspace);
    const camera = plan.items.find((item) => item.code === 'existing_animal_missing_camera');
    expect(camera).toMatchObject({ kind: 'input', suggested: undefined });
    expect(existingAnimalCatalogResolutionBlocker(plan, { [camera!.path]: 99 })).toMatch(
      /existing camera id: 0/
    );
    expect(existingAnimalCatalogResolutionBlocker(plan, { [camera!.path]: 0 })).toBeNull();

    const repaired = applyImportRepairs(model, { [camera!.path]: 0 }) as {
      cameras: Array<Record<string, unknown>>;
      tasks: Array<Record<string, unknown>>;
      associated_video_files: Array<Record<string, unknown>>;
    };
    expect(repaired.cameras[0].id).toBe(0);
    expect(repaired.tasks[0].camera_id).toEqual([0]);
    expect(repaired.associated_video_files[0].camera_id).toBe(0);
    expect(collectExistingAnimalCatalogAdditions(plan, { [camera!.path]: 0 })).toEqual({});
  });

  it('maps a missing recording-system ref to an existing recording-system name', () => {
    const model = loadCleanExport();
    model.data_acq_device = [
      { name: 'ImportedRig', system: 'MCU', amplifier: 'Intan', adc_circuit: 'Intan' },
    ];
    const workspace = {
      animals: {
        remy: {
          id: 'remy',
          subject: { subject_id: 'remy' },
          cameras: model.cameras,
          devices: {
            data_acq_device: [
              { name: 'ExistingRig', system: 'MCU', amplifier: 'Intan', adc_circuit: 'Intan' },
            ],
          },
        },
      },
    };

    const plan = buildImportRepairPlan(model, '06222023_remy_metadata.yml', workspace);
    const device = plan.items.find(
      (item) => item.code === 'existing_animal_missing_data_acq_device'
    );
    expect(device).toMatchObject({
      kind: 'choice',
      suggested: 'Bring referenced catalog entry',
    });
    expect(
      existingAnimalCatalogResolutionBlocker(plan, { [device!.path]: 'BogusRig' })
    ).toMatch(/existing recording-system name: ExistingRig/);
    expect(
      existingAnimalCatalogResolutionBlocker(plan, { [device!.path]: 'ExistingRig' })
    ).toBeNull();

    const repaired = applyImportRepairs(model, { [device!.path]: 'ExistingRig' }) as {
      data_acq_device: Array<Record<string, unknown>>;
    };
    expect(repaired.data_acq_device[0].name).toBe('ExistingRig');
    expect(collectExistingAnimalCatalogAdditions(plan, { [device!.path]: 'ExistingRig' })).toEqual(
      {}
    );
  });
});

describe('volume_in_uL / volume_in_ul shim — reconcile, never drop the shim key', () => {
  it('fills the missing lowercase spelling from the present one (benign)', () => {
    const model = { virus_injection: [{ name: 'v', volume_in_uL: 0.5 }] };
    const repaired = applyImportRepairs(model, {}) as {
      virus_injection: Array<Record<string, unknown>>;
    };
    expect(repaired.virus_injection[0].volume_in_uL).toBe(0.5);
    expect(repaired.virus_injection[0].volume_in_ul).toBe(0.5);
  });

  it('surfaces conflicting values as a reconcile suggestion (capital-L authoritative) and keeps both keys', () => {
    const model = { virus_injection: [{ name: 'v', volume_in_uL: 0.5, volume_in_ul: 0.6 }] };
    const plan = buildImportRepairPlan(model, 'f.yml', { animals: {} });
    const item = itemAt(plan.items, 'virus_injection[0].volume_in_ul');
    expect(item).toBeDefined();
    expect(item!.kind).toBe('suggestion');
    expect(item!.suggested).toBe(0.5);

    const repaired = applyImportRepairs(model, { 'virus_injection[0].volume_in_ul': 0.5 }) as {
      virus_injection: Array<Record<string, unknown>>;
    };
    // Both keys retained; reconciled to the capital-L value.
    expect(repaired.virus_injection[0].volume_in_uL).toBe(0.5);
    expect(repaired.virus_injection[0].volume_in_ul).toBe(0.5);
  });

  it('does NOT silently reconcile a conflict the user has not accepted', () => {
    const model = { virus_injection: [{ name: 'v', volume_in_uL: 0.5, volume_in_ul: 0.6 }] };
    // With no resolution, the conflicting values are left UNTOUCHED (the screen must require the
    // user to accept the reconcile — the gate enforces that, importRepair does not auto-launder).
    const repaired = applyImportRepairs(model, {}) as { virus_injection: Array<Record<string, unknown>> };
    expect(repaired.virus_injection[0].volume_in_uL).toBe(0.5);
    expect(repaired.virus_injection[0].volume_in_ul).toBe(0.6);
  });
});
