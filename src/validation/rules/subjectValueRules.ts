/**
 * @fileoverview Subject values pynwb rejects.
 *
 * trodes_to_nwb builds the NWB subject as `Subject(**metadata["subject"])` after formatting the
 * weight, so the subject must hold only fields pynwb's `Subject` knows, each of the type it
 * accepts, and `date_of_birth` must load (PyYAML) as a datetime. Otherwise the conversion stops
 * with a TypeError or ValueError. These values mostly arrive in imported files. A non-empty `age`
 * must also be an ISO 8601 duration, or DANDI's NWB Inspector rejects the file (advisory). Pure.
 */

import type { ValidationIssue, ValidationModel } from '../issueTypes';

import JsonSchema from '../../nwb_schema.json';

/**
 * The fields pynwb's `Subject` accepts (pynwb 3.1.3). Any other field stops the conversion.
 */
export const NWB_SUBJECT_FIELDS: readonly string[] = [
  'age', 'age__reference', 'description', 'genotype', 'sex', 'species', 'subject_id', 'weight',
  'date_of_birth', 'strain',
];

/**
 * The fields of a subject that pynwb's `Subject` does not accept. A field whose value is
 * `undefined` is not written to the file, so it does not count.
 *
 * @param subject - The subject object (anything else has none).
 * @returns The unknown field names, in object order.
 */
export function unknownSubjectFields(subject: unknown): string[] {
  if (subject === null || typeof subject !== 'object' || Array.isArray(subject)) return [];
  const record = subject as Record<string, unknown>;
  return Object.keys(record).filter(
    (key) => record[key] !== undefined && !NWB_SUBJECT_FIELDS.includes(key)
  );
}

// PyYAML (which trodes_to_nwb reads the file with) loads a plain timestamp with a time of day as
// a datetime; anything else stays text, and a date alone loads as a date. Mirrors its resolver.
const PYYAML_DATETIME =
  /^(\d{4})-(\d{1,2})-(\d{1,2})(?:[Tt]|[ \t]+)(\d{1,2}):(\d{2}):(\d{2})(?:\.\d*)?(?:[ \t]*(?:Z|[-+](\d{1,2})(?::(\d{2}))?))?$/;

// The schema's own (unanchored) date_of_birth pattern: a value it rejects gets its message.
const SCHEMA_DATE_OF_BIRTH = new RegExp(
  JsonSchema.properties.subject.properties.date_of_birth.pattern
);

/**
 * Whether trodes_to_nwb reads a date_of_birth value as a datetime, which pynwb's `Subject`
 * requires. An impossible date or time (2023-02-30, 24:00) is not one: PyYAML fails to read the
 * whole file.
 *
 * @param value - The date_of_birth value.
 * @returns True when it loads as a valid datetime.
 */
export function readsAsDatetime(value: unknown): boolean {
  const match = typeof value === 'string' ? PYYAML_DATETIME.exec(value) : null;
  if (!match) return false;
  const [year, month, day, hour, minute, second, zoneHours, zoneMinutes] = match
    .slice(1)
    .map((part) => Number(part ?? 0));
  const leap = (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
  const monthDays = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1];
  return (
    year >= 1 && month >= 1 && month <= 12 && day >= 1 && day <= monthDays &&
    hour <= 23 && minute <= 59 && second <= 59 && zoneHours * 60 + zoneMinutes < 24 * 60
  );
}

// An ISO 8601 duration, exactly as NWB Inspector's check_subject_age reads it (CRITICAL under
// the DANDI configuration).
const ISO_DURATION =
  /^P(?!$)(\d+(?:\.\d+)?Y)?(\d+(?:\.\d+)?M)?(\d+(?:\.\d+)?W)?(\d+(?:\.\d+)?D)?(T(?=\d)(\d+(?:\.\d+)?H)?(\d+(?:\.\d+)?M)?(\d+(?:\.\d+)?S)?)?$/;

/**
 * Whether a subject age passes NWB Inspector's check_subject_age: an ISO 8601 duration, or a
 * range "lower/upper" of them where either side may be blank.
 *
 * @param age - The age text.
 * @returns True when the inspector accepts it.
 */
export function isIsoAge(age: string): boolean {
  if (ISO_DURATION.test(age)) return true;
  const bounds = age.split('/');
  return bounds.length === 2 && bounds.every((bound) => bound === '' || ISO_DURATION.test(bound));
}

const AGE_UNITS: Readonly<Record<string, string>> = {
  d: 'D', day: 'D', days: 'D',
  w: 'W', wk: 'W', wks: 'W', week: 'W', weeks: 'W',
  mo: 'M', month: 'M', months: 'M',
  y: 'Y', yr: 'Y', yrs: 'Y', year: 'Y', years: 'Y',
};

/**
 * The ISO 8601 duration an age most likely means (`P164` or `164` → `P164D`, `6 weeks` → `P6W`),
 * or null when that cannot be told. A bare number is read as days.
 *
 * @param age - The age as written.
 * @returns The suggested duration, or null.
 */
export function likelyIsoAge(age: unknown): string | null {
  const match = /^\s*P?\s*(\d+(?:\.\d+)?)\s*([a-z]*)\s*$/i.exec(String(age));
  if (!match) return null;
  const unit = match[2] === '' ? 'D' : AGE_UNITS[match[2].toLowerCase()];
  return unit ? `P${match[1]}${unit}` : null;
}

/**
 * Subject values pynwb rejects (blocking) and a non-ISO age (advisory).
 *
 * @param model - The form data to validate.
 * @returns Validation issues.
 */
export function subjectValueRules(model: ValidationModel): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const subject = model.subject;
  if (subject === null || typeof subject !== 'object' || Array.isArray(subject)) return issues;

  // date_of_birth must load as a datetime. The schema's pattern is not anchored and also allows a
  // time without seconds (2023-01-10T00:00), which PyYAML keeps as text: pynwb then raises a
  // TypeError. Values the schema rejects (including a blank one) are left to its message.
  const dateOfBirth = subject.date_of_birth;
  if (
    typeof dateOfBirth === 'string' &&
    SCHEMA_DATE_OF_BIRTH.test(dateOfBirth) &&
    !readsAsDatetime(dateOfBirth)
  ) {
    const minutesOnly = /^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2})(Z|[+-]\d{2}:\d{2})?$/.exec(dateOfBirth);
    const withSeconds = minutesOnly ? `${minutesOnly[1]}:00${minutesOnly[2] ?? ''}` : null;
    const suggestion =
      withSeconds !== null && readsAsDatetime(withSeconds) ? withSeconds : '2023-01-10T00:00:00.000Z';
    issues.push({
      path: 'subject.date_of_birth',
      field: 'date_of_birth',
      code: 'subject_date_of_birth_format',
      repairSurface: 'animal',
      severity: 'error',
      message:
        `Date of birth "${dateOfBirth}" must be a real date with a time to the second, such as ` +
        `"${suggestion}". trodes_to_nwb cannot read this one as a date and time, so it fails ` +
        `to create the NWB subject.`,
    });
  }

  // Any field pynwb's Subject does not know stops the conversion. The imports leave such fields
  // out; this catches one that reaches an export another way. No in-app editor removes one.
  unknownSubjectFields(subject).forEach((key) => {
    issues.push({
      path: `subject.${key}`,
      field: key,
      code: 'unknown_subject_field',
      repairSurface: 'none',
      severity: 'error',
      message:
        `Subject field "${key}" is not part of the NWB subject (allowed: ` +
        `${NWB_SUBJECT_FIELDS.join(', ')}). trodes_to_nwb fails on it. Remove it (importing ` +
        `the file again leaves it out).`,
    });
  });

  // pynwb accepts only text for age and strain, and only "birth" or "gestational" for
  // age__reference. The app has no editor for these fields.
  if (subject.age !== undefined && subject.age !== null && typeof subject.age !== 'string') {
    const likely = likelyIsoAge(subject.age);
    issues.push({
      path: 'subject.age',
      field: 'age',
      code: 'subject_value_type',
      repairSurface: 'none',
      severity: 'error',
      message:
        `Subject age ${JSON.stringify(subject.age)} is not text. trodes_to_nwb fails on it; ` +
        `write it as an ISO 8601 duration${likely ? `, e.g. "${likely}"` : ' such as "P90D"'}.`,
    });
  }
  if (subject.strain !== undefined && subject.strain !== null && typeof subject.strain !== 'string') {
    issues.push({
      path: 'subject.strain',
      field: 'strain',
      code: 'subject_value_type',
      repairSurface: 'none',
      severity: 'error',
      message:
        `Subject strain ${JSON.stringify(subject.strain)} is not text. trodes_to_nwb fails on ` +
        `it — write the strain as text.`,
    });
  }
  if (
    subject.age__reference !== undefined &&
    subject.age__reference !== 'birth' &&
    subject.age__reference !== 'gestational'
  ) {
    issues.push({
      path: 'subject.age__reference',
      field: 'age__reference',
      code: 'subject_value_type',
      repairSurface: 'none',
      severity: 'error',
      message:
        `Subject age__reference ${JSON.stringify(subject.age__reference)} must be "birth" or ` +
        `"gestational". trodes_to_nwb fails on any other value.`,
    });
  }

  // A non-empty age must be an ISO 8601 duration, or DANDI's NWB Inspector rejects the file
  // (check_subject_age). Advisory: the conversion itself succeeds.
  if (typeof subject.age === 'string' && subject.age.trim() !== '' && !isIsoAge(subject.age)) {
    const likely = likelyIsoAge(subject.age);
    issues.push({
      path: 'subject.age',
      field: 'age',
      code: 'subject_age_format',
      repairSurface: 'none',
      severity: 'warning',
      message:
        `Subject age "${subject.age}" is not an ISO 8601 duration, so DANDI's NWB Inspector ` +
        `rejects it. ${likely ? `Did you mean "${likely}"?` : 'Use e.g. "P90D" (90 days) or "P12W" (12 weeks); a range such as "P90D/P120D" is allowed.'}`,
    });
  }

  return issues;
}
