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
import { buildImportRepairPlan, applyImportRepairs } from '../importRepair';
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
});
