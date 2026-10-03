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
  existingAnimalCatalogResolutionBlocker,
  numericResolutionBlocker,
} from '../importRepair';
import type { RepairItem } from '../importRepair';
import { classifyCameraAgainstCatalog } from '../cameraCalibrationConflicts';
import { planImport } from '../yamlImportPlan';

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
    expect(loc!.context).toBe('Electrode group 0');
  });

  it('surfaces camera placeholder names and nonpositive calibration as repair rows', () => {
    const model = loadCleanExport();
    model.cameras = [
      {
        id: 0,
        camera_name: 'XXX',
        meters_per_pixel: 0,
        manufacturer: 'Allied Vision',
        model: 'Manta G-158C',
        lens: 'Theia SL183M',
      },
    ];

    const plan = buildImportRepairPlan(model, '06222023_remy_metadata.yml', { animals: {} });
    const name = itemAt(plan.items, 'cameras[0].camera_name');
    const mpp = itemAt(plan.items, 'cameras[0].meters_per_pixel');

    expect(name).toMatchObject({
      code: 'placeholder_camera_name',
      kind: 'input',
      inputType: 'text',
      was: 'XXX',
      context: 'Camera 0 — XXX',
    });
    expect(mpp).toMatchObject({
      code: 'camera_meters_per_pixel_nonpositive',
      kind: 'input',
      inputType: 'number',
      was: 0,
    });
  });

  it('identifies repeated rows and lets duplicate associated-file values be edited inline', () => {
    const model = loadCleanExport();
    const files = model.associated_files as Array<Record<string, unknown>>;
    files[1].name = files[0].name;
    files[1].path = files[0].path;

    const plan = buildImportRepairPlan(model, '06222023_remy_metadata.yml', { animals: {} });
    expect(itemAt(plan.items, 'associated_files[1].name')).toMatchObject({
      code: 'duplicate_associated_file_name',
      kind: 'input',
      context: 'Associated file 2 — probe_adjustment_log',
    });
    expect(itemAt(plan.items, 'associated_files[1].path')).toMatchObject({
      code: 'duplicate_associated_file_path',
      kind: 'input',
      context: 'Associated file 2 — probe_adjustment_log',
    });
    expect(
      plan.blockers.some((blocker) => blocker.path.startsWith('associated_files[1]'))
    ).toBe(false);
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

/**
 * "Apply safe suggestions" accepts every suggestion unread, so a suggestion must be exactly what the
 * file meant. A value that needs a guess (a unit, a decimal comma, one species out of several)
 * becomes a row the user answers, with the original shown.
 */
describe('buildImportRepairPlan — a suggestion is offered only when the value is unambiguous', () => {
  /**
   * The repair row at a path after changing a clean export.
   * @param itemPath - The row's path.
   * @param mutate - Changes the clean model before planning.
   * @returns The row, or undefined.
   */
  function rowFor(itemPath: string, mutate: (model: Record<string, any>) => void): RepairItem | undefined {
    const model = loadCleanExport();
    mutate(model);
    return itemAt(buildImportRepairPlan(model, '06222023_remy_metadata.yml', { animals: {} }).items, itemPath);
  }

  it.each(['0.45 kg', '7.2 kg', '1,250 g', '1.1 lb', '450 mg', 'about 450 g', 'Unknown'])(
    'weight %j is a number input with no suggestion (never a guessed unit)',
    (weight) => {
      const row = rowFor('subject.weight', (m) => {
        m.subject.weight = weight;
      });
      expect(row).toMatchObject({ kind: 'input', inputType: 'number', was: weight });
      expect(row!.suggested).toBeUndefined();
    }
  );

  it.each([
    ['485g', 485],
    ['485 g', 485],
    ['485 grams', 485],
    ['485 Gram', 485],
    ['485', 485],
    [' 412.5 G ', 412.5],
  ])('weight %j (grams, or no unit) suggests %d', (weight, grams) => {
    const row = rowFor('subject.weight', (m) => {
      m.subject.weight = weight;
    });
    expect(row).toMatchObject({ kind: 'suggestion', suggested: grams, was: weight });
  });

  it.each(['1,5', '1.5cd', '1.5 x', 'not_a_number'])(
    'times_period_multiplier %j is a number input with no suggestion',
    (value) => {
      const row = rowFor('times_period_multiplier', (m) => {
        m.times_period_multiplier = value;
      });
      expect(row).toMatchObject({ kind: 'input', inputType: 'number', was: value });
      expect(row!.suggested).toBeUndefined();
    }
  );

  it('times_period_multiplier "1.5" (a plain number stored as text) suggests 1.5', () => {
    const row = rowFor('times_period_multiplier', (m) => {
      m.times_period_multiplier = '1.5';
    });
    expect(row).toMatchObject({ kind: 'suggestion', suggested: 1.5, was: '1.5' });
  });

  it.each(['macaque', 'Macaque', 'marmoset'])(
    'species %j names several species, so it is an input with no suggestion',
    (species) => {
      const row = rowFor('subject.species', (m) => {
        m.subject.species = species;
      });
      expect(row).toMatchObject({ kind: 'input', was: species });
      expect(row!.suggested).toBeUndefined();
    }
  );

  it.each([
    ['rhesus macaque', 'Macaca mulatta'],
    ['common marmoset', 'Callithrix jacchus'],
    ['Long-Evans', 'Rattus norvegicus'],
    ['mouse', 'Mus musculus'],
  ])('species %j names one species and suggests %j', (species, binomial) => {
    const row = rowFor('subject.species', (m) => {
      m.subject.species = species;
    });
    expect(row).toMatchObject({ kind: 'suggestion', suggested: binomial });
    expect(isValidSpecies(row!.suggested)).toBe(true);
  });

  it('accepting every suggestion for a "0.45 kg" weight never imports 0.45 g', () => {
    const model = loadCleanExport();
    (model.subject as Record<string, unknown>).weight = '0.45 kg';
    const plan = buildImportRepairPlan(model, '06222023_remy_metadata.yml', { animals: {} });
    // What the page's "Apply safe suggestions" button resolves.
    const accepted = Object.fromEntries(
      plan.items.filter((i) => i.kind === 'suggestion').map((i) => [i.path, i.suggested])
    );
    expect(accepted).toEqual({});
    const repaired = applyImportRepairs(model, accepted);
    expect((repaired.subject as Record<string, unknown>).weight).toBe('0.45 kg');
    // The weight still needs an answer, so the file cannot be imported with a wrong number.
    const importPlan = planImport(
      [{ sourceName: '06222023_remy_metadata.yml', flatModel: repaired }],
      { animals: {} }
    );
    expect(importPlan.animals).toEqual([]);
  });
});

/**
 * A missing required NUMBER must be answerable on this screen: a text input stored the typed value
 * as a string, so the repaired file failed "must be number" however it was answered.
 */
describe('buildImportRepairPlan — a missing required number is answered with a number', () => {
  type Model = Record<string, any>;
  const MISSING_NUMBERS: Array<[string, (m: Model) => void, string, (m: Model) => unknown]> = [
    ['raw_data_to_volts', (m) => delete m.raw_data_to_volts, '0.195', (m) => m.raw_data_to_volts],
    [
      'times_period_multiplier',
      (m) => delete m.times_period_multiplier,
      '1.5',
      (m) => m.times_period_multiplier,
    ],
    [
      'electrode_groups[0].targeted_x',
      (m) => delete m.electrode_groups[0].targeted_x,
      '-3.25e0',
      (m) => m.electrode_groups[0].targeted_x,
    ],
  ];

  /**
   * A clean export with one field removed.
   * @param remove - Removes the field.
   * @returns The model.
   */
  function cleanWithout(remove: (m: Model) => void): Model {
    const model = loadCleanExport();
    remove(model);
    return model;
  }

  /**
   * Whether a repaired model imports as one day.
   * @param repaired - The repaired model.
   * @returns The planner's refusals (empty when importable).
   */
  function refusals(repaired: Record<string, unknown>): string[] {
    return planImport([{ sourceName: '06222023_remy_metadata.yml', flatModel: repaired }], {
      animals: {},
    }).unimportable.map((u) => u.reason);
  }

  it.each(MISSING_NUMBERS)('%s is a number input (the schema type at that path)', (itemPath, remove) => {
    const plan = buildImportRepairPlan(cleanWithout(remove), '06222023_remy_metadata.yml', { animals: {} });
    expect(itemAt(plan.items, itemPath)).toMatchObject({
      kind: 'input',
      group: 'required',
      inputType: 'number',
    });
  });

  it.each(MISSING_NUMBERS)('%s: the number typed into the row makes the file importable', (itemPath, remove, typed, read) => {
    const model = cleanWithout(remove);
    // What RepairRow stores for a number input.
    const repaired = applyImportRepairs(model, { [itemPath]: Number(typed) });
    expect(read(repaired)).toBe(Number(typed));
    expect(refusals(repaired)).toEqual([]);
  });

  it.each(MISSING_NUMBERS)('%s: numeric text is stored as a number when the repair is applied', (itemPath, remove, typed, read) => {
    const repaired = applyImportRepairs(cleanWithout(remove), { [itemPath]: typed });
    expect(read(repaired)).toBe(Number(typed));
    expect(refusals(repaired)).toEqual([]);
  });

  it('an integer field (a video file epoch) is a number input too', () => {
    const plan = buildImportRepairPlan(
      { associated_video_files: [{ name: 'v', camera_id: 0 }] },
      'f.yml',
      { animals: {} }
    );
    expect(itemAt(plan.items, 'associated_video_files[0].task_epochs')!.inputType).toBe('number');
  });

  it('rejects text that is not a number with a clear message, and accepts real numbers', () => {
    const plan = buildImportRepairPlan(
      cleanWithout((m) => delete m.raw_data_to_volts),
      '06222023_remy_metadata.yml',
      { animals: {} }
    );
    expect(numericResolutionBlocker(plan, { raw_data_to_volts: '0,195' })).toBe(
      'Raw data to volts must be a number; “0,195” is not one.'
    );
    expect(numericResolutionBlocker(plan, { raw_data_to_volts: 'abc' })).toMatch(/must be a number/);
    expect(numericResolutionBlocker(plan, { raw_data_to_volts: 0.195 })).toBeNull();
    expect(numericResolutionBlocker(plan, { raw_data_to_volts: '1.95e-7' })).toBeNull();
    // An unanswered row is counted by the screen's "still need a response", not here.
    expect(numericResolutionBlocker(plan, {})).toBeNull();
  });

  it('rejects a fraction where the schema wants a whole number', () => {
    const plan = buildImportRepairPlan(
      { associated_video_files: [{ name: 'v', camera_id: 0 }] },
      'f.yml',
      { animals: {} }
    );
    expect(
      numericResolutionBlocker(plan, { 'associated_video_files[0].task_epochs': 1.5 })
    ).toMatch(/must be a whole number; “1\.5” is not one/);
    expect(
      numericResolutionBlocker(plan, { 'associated_video_files[0].task_epochs': 2 })
    ).toBeNull();
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

  // pynwb's Subject fails on any field it does not know, and no workspace editor can remove one, so
  // the import leaves such a field out, and lists it rather than dropping it silently.
  it('leaves out subject fields the NWB subject does not have, and lists each one', () => {
    const model = loadCleanExport();
    (model.subject as Record<string, unknown>).weight_unit = 'g';

    const plan = buildImportRepairPlan(model, '20230622_remy_metadata.yml', { animals: {} });

    expect(plan.blockers.some((b) => b.path.startsWith('subject.'))).toBe(false);
    expect(plan.benign).toContainEqual(
      expect.objectContaining({
        path: 'subject.weight_unit',
        detail: expect.stringContaining('"weight_unit"'),
      })
    );
    const repaired = applyImportRepairs(model, {});
    expect(repaired.subject).not.toHaveProperty('weight_unit');
    expect(repaired.subject).toHaveProperty('subject_id', 'remy');
    expect(validate(repaired).some((issue) => issue.code === 'unknown_subject_field')).toBe(false);
    // The input is not changed.
    expect(model.subject).toHaveProperty('weight_unit', 'g');
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
  it('asks for times_period_multiplier when a legacy string has suffix text (no guessed prefix)', () => {
    const model = loadNonconforming();
    model.times_period_multiplier = '1.5cd';

    const plan = buildImportRepairPlan(model, 'nonconforming-remy.yml', { animals: {} });
    const item = itemAt(plan.items, 'times_period_multiplier');
    expect(item).toBeDefined();
    // A numeric prefix is not a safe suggestion ("1,5" would read as 1), so the row is a number
    // input showing the original value.
    expect(item!.kind).toBe('input');
    expect(item!.inputType).toBe('number');
    expect(item!.was).toBe('1.5cd');
    expect(item!.suggested).toBeUndefined();
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
          cameras: [
            {
              id: 0,
              camera_name: 'existing_cam',
              meters_per_pixel: 0.002,
              manufacturer: 'Allied',
              model: 'Mako',
              lens: '8mm',
            },
          ],
          devices: { data_acq_device: model.data_acq_device },
        },
      },
    };

    const plan = buildImportRepairPlan(model, '06222023_remy_metadata.yml', workspace);

    // The name is reused with a different calibration, which is the batch preview's split/unify
    // question — not an identity mapping the scientist must answer first (R3). The row is left for
    // that decision rather than being demanded here or silently collapsed onto the animal's camera.
    expect(plan.items.some((item) => item.code === 'divergent_camera_identity')).toBe(false);
    expect(plan.items.some((item) => item.code === 'existing_animal_missing_camera')).toBe(false);
    expect(existingAnimalCatalogResolutionBlocker(plan, {})).toBeNull();
    expect(
      classifyCameraAgainstCatalog(
        (model.cameras as Array<Record<string, unknown>>)[0],
        workspace.animals.remy
      )
    ).toBe('conflict');

    // A mapping is still AVAILABLE as a manual repair path elsewhere; nothing about the file is
    // rewritten without one.
    const repaired = applyImportRepairs(model, {}) as {
      cameras: Array<Record<string, unknown>>;
      tasks: Array<Record<string, unknown>>;
      associated_video_files: Array<Record<string, unknown>>;
    };
    expect(repaired.cameras[0].id).toBe(3);
    expect(repaired.tasks[0].camera_id).toEqual([3]);
    expect(repaired.associated_video_files[0].camera_id).toBe(3);
  });

  it('does not surface cross-day camera divergence when identity fields match', () => {
    const model = loadCleanExport();
    model.cameras = [
      {
        id: 0,
        camera_name: 'maze_camera',
        meters_per_pixel: 0.0025,
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
        camera_id: [0],
        task_epochs: [1],
      },
    ];
    const workspace = {
      animals: {
        remy: {
          id: 'remy',
          subject: { subject_id: 'remy' },
          cameras: [
            {
              id: 0,
              camera_name: 'maze_camera',
              meters_per_pixel: 0.0025,
              manufacturer: 'Allied',
              model: 'Mako',
              lens: '8mm',
            },
          ],
          devices: { data_acq_device: model.data_acq_device },
        },
      },
    };

    const plan = buildImportRepairPlan(model, '06222023_remy_metadata.yml', workspace);

    expect(plan.items.some((item) => item.code === 'divergent_camera_identity')).toBe(false);
    expect(plan.items.some((item) => item.code === 'existing_animal_missing_camera')).toBe(false);
  });

  it('surfaces same-id camera-name reuse with different calibration before import', () => {
    const model = loadCleanExport();
    model.cameras = [
      {
        id: 0,
        camera_name: 'maze_camera',
        meters_per_pixel: 0.0016,
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
        camera_id: [0],
        task_epochs: [1],
      },
    ];
    const workspace = {
      animals: {
        remy: {
          id: 'remy',
          subject: { subject_id: 'remy' },
          cameras: [
            {
              id: 0,
              camera_name: 'maze_camera',
              meters_per_pixel: 0.0025,
              manufacturer: 'Allied',
              model: 'Mako',
              lens: '8mm',
            },
          ],
          devices: { data_acq_device: model.data_acq_device },
        },
      },
    };

    const plan = buildImportRepairPlan(model, '06222023_remy_metadata.yml', workspace);

    // Same camera_name, same id, different calibration: the preview asks which calibration each day
    // exports (split by default), so this file is ready to reach that question (R3).
    expect(plan.items.some((item) => item.code === 'divergent_camera_identity')).toBe(false);
    expect(existingAnimalCatalogResolutionBlocker(plan, {})).toBeNull();
    expect(
      classifyCameraAgainstCatalog(
        (model.cameras as Array<Record<string, unknown>>)[0],
        workspace.animals.remy
      )
    ).toBe('conflict');
  });

  it('still demands a mapping when the reused name matches with a DIFFERENT id only', () => {
    // Identical calibration under one name, but the file numbers it differently AND that id is
    // another of the animal's cameras: nothing the calibration analysis resolves, so the identity
    // mapping is still the repair.
    const model = loadCleanExport();
    model.cameras = [
      {
        id: 1,
        camera_name: 'maze_camera',
        meters_per_pixel: 0.0025,
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
        camera_id: [1],
        task_epochs: [1],
      },
    ];
    const existingCameras = [
      {
        id: 0,
        camera_name: 'maze_camera',
        meters_per_pixel: 0.0025,
        manufacturer: 'Allied',
        model: 'Mako',
        lens: '8mm',
      },
      {
        id: 1,
        camera_name: 'side_camera',
        meters_per_pixel: 0.0009,
        manufacturer: 'Allied',
        model: 'Mako',
        lens: '8mm',
      },
    ];
    const workspace = {
      animals: {
        remy: {
          id: 'remy',
          subject: { subject_id: 'remy' },
          cameras: existingCameras,
          devices: { data_acq_device: model.data_acq_device },
        },
      },
    };

    const plan = buildImportRepairPlan(model, '06222023_remy_metadata.yml', workspace);
    const camera = plan.items.find((item) => item.code === 'divergent_camera_identity');

    expect(camera).toMatchObject({ kind: 'input', was: 'camera id 1 (maze_camera)' });
    expect(classifyCameraAgainstCatalog(
        (model.cameras as Array<Record<string, unknown>>)[0],
        workspace.animals.remy
      )).toBeNull();
    expect(existingAnimalCatalogResolutionBlocker(plan, {})).toMatch(/Resolve Camera 1/);
    expect(existingAnimalCatalogResolutionBlocker(plan, { [camera!.path]: 0 })).toBeNull();
  });

  it('asks about a camera that reuses an existing camera id under a different name (W3)', () => {
    const model = loadCleanExport();
    model.cameras = [
      {
        id: 0,
        camera_name: 'sleep_box_camera',
        meters_per_pixel: 0.0021,
        manufacturer: 'Basler',
        model: 'acA1300',
        lens: 'Computar 4mm',
      },
    ];
    model.tasks = [
      {
        task_name: 'sleep',
        task_description: 'rest',
        task_environment: 'sleep box',
        camera_id: [0],
        task_epochs: [1],
      },
    ];
    model.associated_files = [];
    model.associated_video_files = [{ name: 'sleep_video', camera_id: 0, task_epochs: 1 }];
    const workspace = {
      animals: {
        remy: {
          id: 'remy',
          subject: { subject_id: 'remy' },
          cameras: [{ id: 0, camera_name: 'overhead_camera', meters_per_pixel: 0.00085 }],
          devices: { data_acq_device: model.data_acq_device },
        },
      },
    };

    const plan = buildImportRepairPlan(model, '06232023_remy_metadata.yml', workspace);
    const camera = plan.items.find((item) => item.code === 'existing_animal_camera_id_taken');
    expect(camera).toMatchObject({
      kind: 'choice',
      suggested: 'Bring referenced catalog entry',
      was: 'camera id 0 (sleep_box_camera)',
      action: { catalog: 'cameras', canBring: true, missingValue: 0, validMapValues: [0] },
    });
    expect(camera!.why).toMatch(/uses camera id 0 for a different camera \("overhead_camera"\)/);
    expect(existingAnimalCatalogResolutionBlocker(plan, {})).toMatch(/Resolve Camera 0/);

    // Bringing it leaves the file as it is; mapping it onto the animal's camera 0 records the
    // mapping, so the planner keeps the day on that camera although the row keeps its own name.
    expect(applyImportRepairs(model, { [camera!.path]: camera!.suggested })).toEqual(model);
    const mapped = applyImportRepairs(model, { [camera!.path]: 0 }) as Record<string, unknown>;
    expect(mapped.__importRepair).toEqual({ mappedCameraIds: [0] });
    expect((mapped.cameras as Array<Record<string, unknown>>)[0]).toMatchObject({
      id: 0,
      camera_name: 'sleep_box_camera',
    });
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
  });
});

describe('a file listing more than one recording system — ask which one the day used (W8)', () => {
  const systems = [
    { name: 'SpikeGadgets', system: 'SpikeGadgets', amplifier: 'Intan', adc_circuit: 'Intan' },
    { name: 'Behavior DAQ', system: 'NI', amplifier: 'none', adc_circuit: 'NI-6008' },
  ];

  it('asks, naming every system and what happens to the others', () => {
    const model = loadCleanExport();
    model.data_acq_device = structuredClone(systems);

    const plan = buildImportRepairPlan(model, '06222023_remy_metadata.yml', { animals: {} });
    const row = plan.items.find((item) => item.code === 'multiple_data_acq_devices');
    expect(row).toMatchObject({
      path: '__importRepair.day_data_acq_device',
      kind: 'choice',
      was: ['SpikeGadgets', 'Behavior DAQ'],
      suggested: 'SpikeGadgets',
      action: { kind: 'file_choice', validValues: ['SpikeGadgets', 'Behavior DAQ'] },
    });
    expect(row!.why).toMatch(/exports one recording system/);
    expect(row!.why).toMatch(/left out of this day's YAML/);
    expect(plan.hasErrors).toBe(true);
  });

  it('accepts only a system the file lists, and records the choice without reordering them', () => {
    const model = loadCleanExport();
    model.data_acq_device = structuredClone(systems);
    const plan = buildImportRepairPlan(model, '06222023_remy_metadata.yml', { animals: {} });
    const row = plan.items.find((item) => item.code === 'multiple_data_acq_devices')!;

    expect(existingAnimalCatalogResolutionBlocker(plan, { [row.path]: 'Rig C' })).toMatch(
      /SpikeGadgets, Behavior DAQ/
    );
    expect(existingAnimalCatalogResolutionBlocker(plan, { [row.path]: 'Behavior DAQ' })).toBeNull();
    expect(existingAnimalCatalogResolutionBlocker(plan, { [row.path]: row.suggested })).toBeNull();

    const chosen = applyImportRepairs(model, { [row.path]: 'Behavior DAQ' });
    expect(chosen.data_acq_device).toEqual(systems);
    expect(chosen.__importRepair).toEqual({ day_data_acq_device: 'Behavior DAQ' });
  });

  it('does not ask when the file lists one system', () => {
    const plan = buildImportRepairPlan(loadCleanExport(), '06222023_remy_metadata.yml', { animals: {} });
    expect(plan.items.some((item) => item.code === 'multiple_data_acq_devices')).toBe(false);
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

  // Older versions of this app saved a fixed `volume_in_uL: 0.45` beside the volume entered in the
  // form (`volume_in_ul`), and trodes_to_nwb reads `volume_in_uL`: 147 corpus files record 0.45 µL
  // instead of the injected volume. The entered volume is the real one, so that is the suggestion
  // ("accept all suggestions" takes it without the row being read).
  it('suggests the entered volume over the old fixed 0.45, and sets both keys to it', () => {
    const model = { virus_injection: [{ name: 'v', volume_in_uL: 0.45, volume_in_ul: 100 }] };
    const plan = buildImportRepairPlan(model, 'f.yml', { animals: {} });
    const item = itemAt(plan.items, 'virus_injection[0].volume_in_uL');
    expect(item).toMatchObject({
      code: 'volume_shim_conflict',
      kind: 'suggestion',
      was: 0.45,
      suggested: 100,
    });
    expect(item!.why).toMatch(/0\.45/);

    const repaired = applyImportRepairs(model, { [item!.path]: item!.suggested }) as {
      virus_injection: Array<Record<string, unknown>>;
    };
    // Both keys retained, reconciled to the entered volume.
    expect(repaired.virus_injection[0].volume_in_uL).toBe(100);
    expect(repaired.virus_injection[0].volume_in_ul).toBe(100);
  });

  // With neither value the old fixed default, nothing says which one is right: no suggestion, so
  // "accept all suggestions" cannot pick one, and the import waits for the user's value.
  it('asks for the volume when the two spellings hold other values', () => {
    const model = { virus_injection: [{ name: 'v', volume_in_uL: 0.5, volume_in_ul: 0.6 }] };
    const plan = buildImportRepairPlan(model, 'f.yml', { animals: {} });
    const item = itemAt(plan.items, 'virus_injection[0].volume_in_uL');
    expect(item).toMatchObject({ code: 'volume_shim_conflict', kind: 'input', was: 0.5 });
    expect(item!.suggested).toBeUndefined();
    expect(item!.why).toMatch(/0\.5\b/);
    expect(item!.why).toMatch(/0\.6\b/);

    const repaired = applyImportRepairs(model, { [item!.path]: 0.6 }) as {
      virus_injection: Array<Record<string, unknown>>;
    };
    expect(repaired.virus_injection[0].volume_in_uL).toBe(0.6);
    expect(repaired.virus_injection[0].volume_in_ul).toBe(0.6);
  });

  it('asks for the volume when the entered value beside the old 0.45 is not a number', () => {
    const model = { virus_injection: [{ name: 'v', volume_in_uL: 0.45, volume_in_ul: '' }] };
    const plan = buildImportRepairPlan(model, 'f.yml', { animals: {} });
    const item = itemAt(plan.items, 'virus_injection[0].volume_in_uL');
    expect(item).toMatchObject({ code: 'volume_shim_conflict', kind: 'input' });
    expect(item!.suggested).toBeUndefined();
  });

  it('sets both keys from a resolution under either spelling', () => {
    const model = { virus_injection: [{ name: 'v', volume_in_uL: 0.5, volume_in_ul: 0.6 }] };
    const repaired = applyImportRepairs(model, { 'virus_injection[0].volume_in_ul': 0.7 }) as {
      virus_injection: Array<Record<string, unknown>>;
    };
    expect(repaired.virus_injection[0].volume_in_uL).toBe(0.7);
    expect(repaired.virus_injection[0].volume_in_ul).toBe(0.7);
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
