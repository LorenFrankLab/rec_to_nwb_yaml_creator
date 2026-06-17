/**
 * @fileoverview Recovery-review view-model builder (epoch-editor Phase 8).
 *
 * `buildRecoveryReviewViewModel(workspace, notice?)` turns the workspace into the data the
 * recovery-review screen renders: the auto-recovered FYI notice (the persistence load notice, passed
 * in — it is a runtime concern, not derivable from the workspace), and the "needs review" records
 * each with a concrete repair action.
 *
 * It RENDERS the existing day-recovery classification — it does NOT recompute or extend it. The
 * needs-review rows are the non-`ok` rows of the shared {@link buildValidationSummaryViewModel}
 * (which composes `classifyWorkspaceDays` + the shared `buildDayRowViewModel`), so the recovery
 * screen, the Validation summary, and the Animal day list all surface ONE classification and emit
 * the SAME repair commands (`removeDayReference` / `relinkDayReference` / `unlinkDayReference`).
 * Adding a recovery class or a repair belongs in the domain classifier / the day-row builder, never
 * here.
 *
 * Pure and React-free.
 */

import { buildValidationSummaryViewModel } from './validationSummaryViewModel';
import type { DayStatusRowViewModel } from './validationSummaryViewModel';
import type { DayStatus, WorkflowCommand } from './types';

/** One needs-review record: a non-`ok` classified day decorated with title/detail + its repair. */
export interface RecoveryRowViewModel {
  /** The day's id (store map key). */
  dayId: string;
  /** The owning-animal index key — the repair-command target. */
  animalKey: string;
  /** The Animal label (subject id). */
  subjectLabel: string;
  /** The day's date, when the record carries one (absent for a dangling reference). */
  date?: string;
  /** The recovery classification — never `'ok'` (those are filtered out). */
  recovery: DayStatus;
  /** A one-line title, e.g. `remy · 2023-06-22 — not in day list`. */
  title: string;
  /** A sentence explaining the issue and the resolution options. */
  detail: string;
  /**
   * The repair affordance — the EXISTING `recoveryDetail.repair.command` carried verbatim, with the
   * single destructive repair flagged (`removeDayReference`, which deletes the corrupt leftover).
   * Absent for `orphan_no_owner`, which has no in-app repair.
   */
  repair?: { label: string; command: WorkflowCommand; destructive: boolean };
  /** For `orphan_no_owner` (no repair command): the explanatory message. */
  message?: string;
}

/** The recovery-review page view-model. */
export interface RecoveryReviewViewModel {
  /** The auto-recovered / discard load notice (passed in from persistence), when present. */
  notice?: string;
  /** The needs-review records (every non-`ok` classified day), in the classifier's table order. */
  needsReview: RecoveryRowViewModel[];
  /** `needsReview.length` — the "Needs review" count badge. */
  reviewCount: number;
  /** True when there is nothing to review (no needs-review records). */
  allClear: boolean;
}

/** The single destructive recovery repair: removing a dangling reference deletes the corrupt leftover. */
const DESTRUCTIVE_RECOVERIES: ReadonlySet<DayStatus> = new Set<DayStatus>(['dangling_reference']);

/**
 * The display date for a row — the record's date, or the day id as a last resort so a dangling
 * reference (no record, no date) still reads as a concrete thing rather than a blank.
 *
 * @param row - The classified day row.
 * @returns A non-empty label.
 */
function rowDateLabel(row: DayStatusRowViewModel): string {
  return row.date && row.date.length > 0 ? row.date : row.dayId;
}

/**
 * Compose the title + detail for one non-`ok` row from its classification. This is PRESENTATION over
 * the existing classification (it reads `row.recovery` + `row.recoveryDetail`), not a re-derivation
 * of what kind of day it is.
 *
 * @param row - The classified day row (already known to be non-`ok`).
 * @returns The row's `{ title, detail }`.
 */
function describeRow(row: DayStatusRowViewModel): { title: string; detail: string } {
  const who = row.subjectLabel || row.animalKey;
  const when = rowDateLabel(row);
  const owner = row.recoveryDetail?.ownerDescription;
  switch (row.recovery) {
    case 'dangling_reference':
      return {
        title: `${who} · ${when} — missing record`,
        detail:
          'An index entry points to a saved day record that is missing or corrupt. Nothing usable ' +
          'remains to open — remove the reference, or recreate the day.',
      };
    case 'recovered_unlinked':
      return {
        title: `${who} · ${when} — not in day list`,
        detail:
          `This day record exists but is not listed in ${who}'s recording days (the index was ` +
          'missing or corrupt). It is preserved — re-link it to restore it to the animal.',
      };
    case 'wrong_owner':
      return {
        title: `${who} · ${when} — belongs to ${owner}`,
        detail:
          `This day is listed under ${who}, but its record declares ${owner} as its owner. It is ` +
          `NOT exported with ${who}'s metadata — remove it here so it returns to ${owner} to be re-linked.`,
      };
    case 'orphan_no_owner':
      // The "no in-app repair — re-create / re-import" guidance is carried by the row's `message`
      // (rendered in the actions slot, where a repair button would otherwise be), so the detail here
      // only states the problem — avoiding a duplicated instruction.
      return {
        title: `${who} · ${when} — no owning animal`,
        detail: 'This day record exists, but its owning animal is no longer in the workspace.',
      };
    default:
      // Unreachable: callers filter to non-`ok` rows, and the four cases above are the closed non-`ok`
      // set. A defensive fallback keeps the function total rather than returning undefined.
      return { title: `${who} · ${when}`, detail: 'This record needs review.' };
  }
}

/**
 * Translate one non-`ok` {@link DayStatusRowViewModel} into a {@link RecoveryRowViewModel}, carrying
 * its EXISTING repair command verbatim (or the orphan message when there is no command).
 *
 * @param row - The classified day row.
 * @returns The recovery-review row.
 */
function toRecoveryRow(row: DayStatusRowViewModel): RecoveryRowViewModel {
  const { title, detail } = describeRow(row);
  const out: RecoveryRowViewModel = {
    dayId: row.dayId,
    animalKey: row.animalKey,
    subjectLabel: row.subjectLabel,
    recovery: row.recovery,
    title,
    detail,
  };
  if (row.date && row.date.length > 0) out.date = row.date;

  const repairAction = row.recoveryDetail?.repair;
  if (repairAction?.command) {
    out.repair = {
      label: repairAction.label,
      command: repairAction.command,
      destructive: DESTRUCTIVE_RECOVERIES.has(row.recovery),
    };
  } else if (row.recoveryDetail?.message) {
    // No executable repair (orphan_no_owner): surface the classifier's message so the record is
    // never silently dropped.
    out.message = row.recoveryDetail.message;
  }
  return out;
}

/**
 * Build the recovery-review view-model.
 *
 * @param workspace - `model.workspace` ({ animals, days }) — tolerated when malformed.
 * @param notice - The persistence load notice (auto-recovered / discard), when one is present.
 * @returns The page view-model — pure data, no React.
 */
export function buildRecoveryReviewViewModel(
  workspace: unknown,
  notice?: string | null
): RecoveryReviewViewModel {
  // Reuse the shared classification + repair affordances; filter to the records that need review.
  const days = buildValidationSummaryViewModel(workspace).days;
  const needsReview = days.filter((row) => row.recovery !== 'ok').map(toRecoveryRow);

  const vm: RecoveryReviewViewModel = {
    needsReview,
    reviewCount: needsReview.length,
    allClear: needsReview.length === 0,
  };
  if (notice) vm.notice = notice;
  return vm;
}
