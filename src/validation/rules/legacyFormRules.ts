/**
 * @fileoverview Rules for the single-file legacy form only.
 *
 * The workspace enforces these through its own day model, so they are NOT part of the shared
 * `rulesValidation` that the workspace day validation also runs:
 *  - a day with no tasks is "incomplete" there (its Tasks & Epochs step), which already locks
 *    export, so a shared error would only re-badge a fresh day as broken;
 *  - its export blocks a subject id the converter cannot group (`recordingFilenameIssues`).
 * The legacy form has neither, so `features/importExport` adds these rules to its validation. Pure.
 */

import type { ValidationIssue, ValidationModel } from '../issueTypes';

import { recordingFilenameIssue } from '../../domain/recordingFilename';

/**
 * Legacy-form rules: at least one task (blocking) and a subject id the converter can group with its
 * recordings (advisory).
 *
 * @param model - The legacy form data.
 * @returns Validation issues.
 */
export function legacyFormRules(model: ValidationModel | null | undefined): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  if (!model || typeof model !== 'object') return issues;

  // trodes_to_nwb always builds the position data from the tasks' epochs and fails when the list
  // is empty.
  if (Array.isArray(model.tasks) && model.tasks.length === 0) {
    issues.push({
      path: 'tasks',
      code: 'no_tasks',
      repairSurface: 'day',
      severity: 'error',
      message:
        'Add at least one task (with its epochs). trodes_to_nwb builds the position data ' +
        'from the tasks and fails when there are none.',
    });
  }

  // trodes_to_nwb finds a session's files by splitting their names on "_", so a subject id with
  // anything but letters, digits and hyphens (RECORDING_SUBJECT_TOKEN_PATTERN) cannot be grouped
  // with its recordings. Advisory here: the downloaded file can still be renamed. A blank id is the
  // schema's required check.
  const subjectId = model.subject?.subject_id;
  if (typeof subjectId === 'string' && subjectId.trim() !== '') {
    const problem = recordingFilenameIssue(subjectId);
    if (problem) {
      issues.push({
        path: 'subject.subject_id',
        field: 'subject_id',
        code: problem.code,
        repairSurface: 'animal',
        severity: 'warning',
        message: problem.message,
      });
    }
  }

  return issues;
}
