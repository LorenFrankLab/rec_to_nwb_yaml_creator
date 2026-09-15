/**
 * @fileoverview Validation of a day's DATED facts (fix plan, increment 2).
 *
 *  - `configuration_effective_date_unconfirmed` (blocking, day-owned): the pinned probe
 *    configuration's effective date does not cover the recording date and the user has not
 *    confirmed the choice — a backfill before every known setup, or a day (from older data) pinned
 *    to a version that became effective AFTER it. Never invents history: the repair is an explicit
 *    confirmation, a re-pin, or extending the version's effective date.
 *  - `weight_from_baseline` (BLOCKING, day-owned): the v3→v4 migration reproduced an earlier
 *    download's weight from the animal baseline (that is what the old export emitted) — the
 *    scientist should confirm it was a measurement or correct it.
 *
 * Both read the RAW day (provenance / pin), never the merged YAML. Pure.
 */

import { configurationChoiceStatus } from './configurationSelection';
import type { RepairableIssue } from './repairRouting';
import type { Day } from '../state/workspaceTypes';

/**
 * Blocking issue when the day's configuration choice is unconfirmed.
 *
 * @param day - The raw day record.
 * @param animal - The owning animal.
 * @returns Zero or one blocking issue.
 */
export function configurationChoiceIssues(day: unknown, animal: unknown): RepairableIssue[] {
  if (!animal || !day || typeof day !== 'object') return [];
  const status = configurationChoiceStatus(animal, day as Day);
  if (status.status !== 'unconfirmed') return [];
  const when = status.effectiveDate ? ` (effective from ${status.effectiveDate})` : '';
  const why =
    status.reason === 'unknown-period'
      ? `The probe setup v${status.version} was entered on ${status.effectiveDate ?? 'an unknown date'} and its effective period before that is not recorded, so it is not known to apply to this earlier recording.`
      : status.reason === 'superseded'
        ? `The probe setup v${status.version}${when} was chosen for this day automatically, but v${status.supersededBy} is now recorded as effective from ${status.supersededFrom ?? 'an earlier date'} — before this recording day.`
        : `The probe setup v${status.version}${when} became effective AFTER this recording day.`;
  return [
    {
      code: 'configuration_effective_date_unconfirmed',
      severity: 'error',
      step: 'devices',
      repairSurface: 'day',
      field: 'configurationVersion',
      focusPath: 'configurationVersion',
      actionLabel: 'Confirm this setup applies',
      message:
        `${why} Confirm that v${status.version} is the setup this day was recorded with, pick the ` +
        `right version, or set the version's effective date to cover ${String((day as Day).date ?? 'this day')}.`,
      repairCommand: { type: 'confirmConfigurationChoice' },
    } as RepairableIssue,
  ];
}

/**
 * Advisory issues from provenance review flags left by migration/import.
 *
 * @param day - The raw day record.
 * @returns Advisory issues.
 */
export function provenanceReviewIssues(day: unknown): RepairableIssue[] {
  if (!day || typeof day !== 'object') return [];
  const review = (day as Day).provenance?.review;
  if (!Array.isArray(review)) return [];
  const issues: RepairableIssue[] = [];
  if (review.includes('weight_from_baseline')) {
    issues.push({
      code: 'weight_from_baseline',
      severity: 'error',
      step: 'overview',
      repairSurface: 'day',
      field: 'session.weight',
      focusPath: 'session.weight',
      path: 'session.weight',
      actionLabel: 'Confirm this weight as measured',
      repairCommand: { type: 'confirmWeightMeasurement' },
      message:
        'This day’s weight is the animal baseline that its earlier download contained (filled in ' +
        'when the workspace was upgraded) — not a recorded measurement. Before downloading again, ' +
        'confirm it was the weight that day, or enter the measured weight.',
    } as RepairableIssue);
  }
  return issues;
}
