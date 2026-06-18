/**
 * @fileoverview DANDI subject-conformance rules (extracted from rulesValidation.js, Phase split).
 *
 * The NWB files publish to DANDI, whose Inspector (dandi config) makes these Subject checks
 * CRITICAL/blocking: a free-text species and slashes in subject_id / session_id are rejected.
 * Pure; moved verbatim.
 */

import type { ValidationIssue, ValidationModel } from '../issueTypes';

import { isValidSpecies, idHasSlash } from '../dandiSubject';

const PLACEHOLDER_SUBJECT_IDS = new Set(['12345', '54321', 'subject_id']);
const STRAIN_IN_GENOTYPE_RE = /\b(?:long[\s-]?evans|sprague(?:[\s-]?dawley)?|wistar)\b/i;

/**
 * Rule 8: DANDI subject conformance (species is a Latin binomial / NCBI URI; ids carry no slash).
 *
 * @param model - The form data to validate.
 * @returns Validation issues.
 */
export function dandiSubjectConformance(model: ValidationModel): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  const subject = model.subject;
  if (subject && typeof subject === 'object') {
    // species: a present-but-invalid value (free text like "Rat") is rejected.
    // An empty/missing species is left to the schema's required + pattern check.
    const sp = subject.species;
    if (typeof sp === 'string' && sp.trim() !== '' && !isValidSpecies(sp)) {
      issues.push({
        path: 'subject.species',
        code: 'invalid_species',
        repairSurface: 'animal',
        severity: 'error',
        message:
          `Species "${sp}" is not DANDI-valid. Use a Latin binomial (e.g. ` +
          `"Rattus norvegicus") or an NCBI Taxonomy URI — DANDI rejects free text.`,
      });
    }

    if (idHasSlash(subject.subject_id)) {
      issues.push({
        path: 'subject.subject_id',
        code: 'subject_id_slash',
        repairSurface: 'none',
        severity: 'error',
        message:
          `Subject ID "${subject.subject_id}" must not contain "/" (DANDI rejects slashes). ` +
          `The Subject ID is the animal's identity and can't be edited here — recreate the ` +
          `animal with a slash-free ID.`,
      });
    }

    if (typeof subject.subject_id === 'string') {
      const subjectId = subject.subject_id.trim();
      if (subjectId !== '' && PLACEHOLDER_SUBJECT_IDS.has(subjectId.toLowerCase())) {
        issues.push({
          path: 'subject.subject_id',
          field: 'subject_id',
          step: 'overview',
          actionLabel: 'Set the real subject id',
          code: 'placeholder_subject_id',
          repairSurface: 'animal',
          severity: 'warning',
          message:
            `Subject ID "${subject.subject_id}" looks like a template placeholder. ` +
            'Set the real subject id so the animal identity matches the recording files.',
        });
      }
    }

    if (
      typeof subject.genotype === 'string' &&
      subject.genotype.trim() !== '' &&
      STRAIN_IN_GENOTYPE_RE.test(subject.genotype)
    ) {
      issues.push({
        path: 'subject.genotype',
        field: 'genotype',
        step: 'overview',
        actionLabel: 'Review genotype vs strain',
        code: 'subject_genotype_strain',
        repairSurface: 'animal',
        severity: 'warning',
        message:
          `Subject genotype "${subject.genotype}" looks like an animal strain/background. ` +
          'Put strain information in subject.description and reserve genotype for genetic modifications.',
      });
    }
  }

  if (idHasSlash(model.session_id)) {
    issues.push({
      path: 'session_id',
      code: 'session_id_slash',
      repairSurface: 'none',
      severity: 'error',
      message:
        `Session ID "${model.session_id}" must not contain "/" (DANDI rejects slashes). ` +
        `The Session ID is derived from the Subject ID and date — fix the Subject ID (by ` +
        `recreating the animal with a slash-free ID).`,
    });
  }

  return issues;
}
