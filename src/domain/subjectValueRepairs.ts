/**
 * @fileoverview Workspace repairs for the subject values pynwb rejects.
 *
 * The shared rule ({@link module:validation/rules/subjectValueRules}) reports them with no in-app
 * fix, which is right for the legacy form (importing the file again leaves them out). In the
 * workspace an EARLIER import may have stored such a value on an existing animal, where every day
 * then inherits it and re-importing does not help. This pass gives each a fix where it lives:
 *
 *  - an unknown subject field, or a strain / age__reference of a type pynwb rejects, is on the
 *    animal's subject → a one-click `removeSubjectField` repair (animal surface).
 *
 * Pure.
 */

import { NWB_SUBJECT_FIELDS } from '../validation/rules/subjectValueRules';
import type { RepairableIssue } from './repairRouting';

/** The subject fields the schema requires: never removable by the subject-field repair. */
const REQUIRED_SUBJECT_FIELDS: ReadonlySet<string> = new Set([
  'description', 'genotype', 'sex', 'species', 'subject_id', 'weight', 'date_of_birth',
]);

/**
 * Whether the `removeSubjectField` repair may delete this subject field: any field other than the
 * schema-required ones (deleting one of those would trade one export block for another).
 *
 * @param field - The subject field name.
 * @returns True when removable.
 */
export function isRemovableSubjectField(field: unknown): field is string {
  return typeof field === 'string' && field !== '' && !REQUIRED_SUBJECT_FIELDS.has(field);
}

/**
 * Give a subject-value issue its workspace repair. Other issues pass through unchanged.
 *
 * @param issue - A validation issue from the merged-model validation.
 * @returns The issue, re-routed with its repair when it is one of the subject-value codes.
 */
export function withSubjectValueRepair(issue: RepairableIssue): RepairableIssue {
  const field = issue.field;
  if (
    (issue.code === 'unknown_subject_field' || issue.code === 'subject_value_type') &&
    isRemovableSubjectField(field)
  ) {
    const reason =
      issue.code === 'unknown_subject_field'
        ? `Subject field "${field}" is not part of the NWB subject (allowed: ` +
          `${NWB_SUBJECT_FIELDS.join(', ')}). trodes_to_nwb fails on it.`
        : issue.message ?? '';
    return {
      ...issue,
      repairSurface: 'animal',
      repairCommand: { type: 'removeSubjectField', field },
      actionLabel: `Remove "${field}" from the subject`,
      message:
        `${reason} An earlier import saved it on this animal, so every recording day exports it. ` +
        "Remove it from the animal's subject (this applies to all of its recording days).",
    };
  }
  return issue;
}
