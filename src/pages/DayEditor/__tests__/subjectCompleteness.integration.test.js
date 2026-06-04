/**
 * Subject/session completeness + DANDI conformance tests for the workspace export.
 *
 * A genuinely-configured session must pass schema validation AND the in-app DANDI
 * subject rules (Latin-binomial species, no-slash ids). The actual NWB-Inspector /
 * `dandi validate` round-trip is deferred to the pre-cutover task.
 */
import { describe, it, expect } from 'vitest';
import { mergeDayMetadata } from '../../../state/workspaceUtils';
import { schemaValidation } from '../../../validation/schemaValidation';
import { validate } from '../../../validation';
import { buildRealisticWorkspace } from '../../../__tests__/fixtures/workspaceBuilders';

describe('subject/session completeness + DANDI rules', () => {
  it('a complete session is schema + DANDI-rule valid', () => {
    const { animal, day } = buildRealisticWorkspace();
    expect(validate(mergeDayMetadata(animal, day))).toEqual([]);
  });

  it('exports a non-empty subject.description, numeric weight, and timestamp DOB', () => {
    const { animal, day } = buildRealisticWorkspace();
    const merged = mergeDayMetadata(animal, day);
    expect(merged.subject.description.trim()).not.toBe('');
    expect(typeof merged.subject.weight).toBe('number');
    expect(merged.subject.date_of_birth).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/);
    expect(schemaValidation(merged)).toEqual([]);
  });

  it('blocks a free-text species (DANDI)', () => {
    const { animal, day } = buildRealisticWorkspace();
    animal.subject.species = 'Rat';
    const issues = validate(mergeDayMetadata(animal, day));
    expect(issues.some((i) => i.code === 'invalid_species' && i.severity === 'error')).toBe(true);
  });

  it('blocks a slash in subject_id / session_id (DANDI)', () => {
    const { animal, day } = buildRealisticWorkspace();
    animal.subject.subject_id = 'remy/1';
    day.session.session_id = 'remy/2023';
    const codes = validate(mergeDayMetadata(animal, day)).map((i) => i.code);
    expect(codes).toContain('subject_id_slash');
    expect(codes).toContain('session_id_slash');
  });

  it('blocks a date-only date_of_birth (schema needs a T-timestamp)', () => {
    const { animal, day } = buildRealisticWorkspace();
    animal.subject.date_of_birth = '2023-01-10';
    const issues = validate(mergeDayMetadata(animal, day));
    expect(issues.some((i) => i.path === 'subject.date_of_birth')).toBe(true);
  });

  it('blocks a missing weight (schema-required)', () => {
    const { animal, day } = buildRealisticWorkspace();
    delete animal.subject.weight;
    day.session.weight = undefined;
    const issues = validate(mergeDayMetadata(animal, day));
    expect(issues.some((i) => i.path === 'subject.weight')).toBe(true);
  });
});
