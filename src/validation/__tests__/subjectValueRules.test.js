/**
 * Subject values pynwb's Subject rejects (they mostly arrive in imported files) and an age DANDI
 * rejects. trodes_to_nwb builds the NWB subject as `Subject(**subject)`.
 */
import { describe, it, expect } from 'vitest';
import { rulesValidation } from '../rulesValidation';
import { validate } from '../index';
import { unknownSubjectFields } from '../rules/subjectValueRules';

describe('subject values', () => {
  const subject = (overrides) => ({
    subject: {
      description: 'Long-Evans Rat',
      genotype: 'Wild Type',
      sex: 'M',
      species: 'Rattus norvegicus',
      subject_id: 'rat01',
      date_of_birth: '2023-01-10T00:00:00.000Z',
      weight: 300,
      ...overrides,
    },
  });
  const codes = (issues) => issues.map((i) => i.code);

  describe('date_of_birth', () => {
    it.each([
      '2023-01-10T00:00:00.000Z',
      '2023-01-10T00:00:00',
      '2023-01-10T05:30:59+02:00',
      '2024-02-29T00:00:00Z',
    ])('accepts %s, which PyYAML reads as a datetime', (dateOfBirth) => {
      expect(codes(rulesValidation(subject({ date_of_birth: dateOfBirth }))))
        .not.toContain('subject_date_of_birth_format');
    });

    it('blocks a time without seconds, which the schema allows but PyYAML keeps as text', () => {
      const model = subject({ date_of_birth: '2023-01-10T00:00' });
      expect(validate(model).filter((i) => i.path === 'subject.date_of_birth')).toEqual([
        expect.objectContaining({
          code: 'subject_date_of_birth_format',
          severity: 'error',
          message: expect.stringContaining('"2023-01-10T00:00:00"'),
        }),
      ]);
    });

    it.each([
      ['an impossible date (PyYAML cannot read the file)', '2023-02-30T00:00:00Z'],
      ['an impossible time', '2023-01-10T24:00:00'],
      ['text after the timestamp (the schema pattern is not anchored)', '2023-01-10T00:00:00 approx'],
    ])('blocks %s', (_label, dateOfBirth) => {
      expect(rulesValidation(subject({ date_of_birth: dateOfBirth }))).toContainEqual(
        expect.objectContaining({ path: 'subject.date_of_birth', code: 'subject_date_of_birth_format', severity: 'error' })
      );
    });

    it('leaves an empty or schema-invalid date to the schema message', () => {
      expect(codes(rulesValidation(subject({ date_of_birth: '' })))).not.toContain('subject_date_of_birth_format');
      expect(codes(rulesValidation(subject({ date_of_birth: '2023-01-10' })))).not.toContain('subject_date_of_birth_format');
    });
  });

  describe('unknown subject fields', () => {
    it('blocks a field pynwb Subject does not accept', () => {
      expect(rulesValidation(subject({ weight_unit: 'g', nickname: null }))).toEqual([
        expect.objectContaining({ path: 'subject.weight_unit', code: 'unknown_subject_field', severity: 'error' }),
        expect.objectContaining({ path: 'subject.nickname', code: 'unknown_subject_field', severity: 'error' }),
      ]);
    });

    it('accepts every field pynwb Subject knows', () => {
      expect(rulesValidation(subject({ age: 'P90D', age__reference: 'birth', strain: 'Long-Evans' }))).toEqual([]);
    });

    it('lists the unknown fields of a subject', () => {
      expect(unknownSubjectFields({ subject_id: 'a', foo: 1, age: 'P1D', bar: undefined })).toEqual(['foo']);
      expect(unknownSubjectFields('not an object')).toEqual([]);
      expect(unknownSubjectFields(null)).toEqual([]);
    });
  });

  describe('age', () => {
    it.each(['P90D', 'P2Y', 'P23W', 'P1Y2M3DT4H', 'P1D/P3D', 'P90Y/', '/P3D'])('accepts the ISO 8601 age %s', (age) => {
      expect(rulesValidation(subject({ age }))).toEqual([]);
    });

    it('warns, with the likely fix, on an age that is not an ISO 8601 duration', () => {
      expect(rulesValidation(subject({ age: 'P164' }))).toEqual([
        expect.objectContaining({
          path: 'subject.age',
          code: 'subject_age_format',
          severity: 'warning',
          message: expect.stringContaining('"P164D"'),
        }),
      ]);
      expect(rulesValidation(subject({ age: '12 weeks' }))[0].message).toContain('"P12W"');
      expect(rulesValidation(subject({ age: 'adult' }))[0].message).toContain('"P90D"');
    });

    it('does not warn on an empty age', () => {
      expect(rulesValidation(subject({ age: '' }))).toEqual([]);
      expect(rulesValidation(subject({ age: null }))).toEqual([]);
    });

    it('blocks values pynwb rejects outright', () => {
      expect(rulesValidation(subject({ age: 164 }))).toEqual([
        expect.objectContaining({
          path: 'subject.age',
          code: 'subject_value_type',
          severity: 'error',
          message: expect.stringContaining('"P164D"'),
        }),
      ]);
      expect(codes(rulesValidation(subject({ strain: 5 })))).toEqual(['subject_value_type']);
      expect(codes(rulesValidation(subject({ age__reference: 'Birth' })))).toEqual(['subject_value_type']);
      expect(codes(rulesValidation(subject({ age__reference: null })))).toEqual(['subject_value_type']);
    });
  });

  it('routes the date of birth to the animal profile, and the fields no editor holds to no in-app fix', () => {
    const issues = rulesValidation(subject({ date_of_birth: '2023-01-10T00:00', nickname: 'x', age: 'P164' }));
    expect(issues.find((i) => i.code === 'subject_date_of_birth_format').repairSurface).toBe('animal');
    expect(issues.find((i) => i.code === 'unknown_subject_field').repairSurface).toBe('none');
    expect(issues.find((i) => i.code === 'subject_age_format').repairSurface).toBe('none');
  });
});
