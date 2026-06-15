/**
 * @fileoverview Shared recording-day row view-model builder.
 *
 * One place that turns a classified recording day into a {@link DayRowViewModel} — the row shape the
 * AnimalWorkspace day list and the ValidationSummary table both render. It centralizes the parts that
 * are genuinely the same across those surfaces: the severity mapping, the recovery classification +
 * its repair affordance, the editor link, export-eligibility, and the lifecycle refinement.
 *
 * The per-surface STATUS WORD legitimately differs today and is preserved as-is: the ValidationSummary
 * table reads a non-valid day as 'Error' / 'Incomplete' (its chip vocabulary) while the day list reads
 * it as 'Needs fixing — …' / 'Draft — incomplete' (the lifecycle vocabulary). So each surface computes
 * its own display `{ variant, label }` (via `dayChipDisplay` or `getDayRowStatus`) and passes it in;
 * this helper maps the variant onto one {@link WorkflowSeverity} and assembles everything else. For a
 * fully-valid day the two surfaces already agree (both read 'Ready to export' / 'Validated' / …).
 *
 * Pure and React-free. Composes domain truth (`describeOwner`, `lifecycleForValidDay`); it does not
 * re-derive recovery or readiness.
 */

import { describeOwner } from '../domain/dayRecovery';
import { lifecycleForValidDay } from '../domain/dayLifecycle';
import type { DayRowViewModel, DayStatus, WorkflowSeverity } from './types';

/** The inputs the shared row builder needs, gathered by each surface from its own data. */
export interface DayRowInput {
  /** Recording-day id. */
  dayId: string;
  /** Display date string (already resolved; the surface decides any '—' fallback). */
  date: string;
  /** First line of the session description, when present. */
  sessionDescription?: string;
  /** The day's recovery classification (DAY_STATUS). */
  recovery: DayStatus;
  /** The display variant + label the surface already computed (`dayChipDisplay` / `getDayRowStatus`). */
  display: { variant: string; label: string };
  /** True when the underlying validation chip is 'valid' (drives export-eligibility + lifecycle). */
  valid: boolean;
  /** Persisted `day.state` (for the ready → validated/exported lifecycle refinement). */
  state?: unknown;
  /** The animal key the day is listed under (repair-command target + editor link owner). */
  animalKey: string;
  /** For a wrong-owner row: the record's declared owner id (for the owner description). */
  declaredOwner?: unknown;
}

/**
 * Map a day's display variant (either the chip vocabulary `valid`/`error`/`incomplete` or the
 * {@link DAY_LIFECYCLE} vocabulary `ready`/`validated`/`exported`/`needs_fixing`/`draft`) onto the
 * single {@link WorkflowSeverity} the UI renders. Exported so the severity invariant has direct
 * coverage independent of constructing fragile per-state day fixtures.
 */
export function variantToSeverity(variant: string): WorkflowSeverity {
  switch (variant) {
    case 'ready':
    case 'validated':
    case 'exported':
      return 'ready';
    case 'error':
    case 'needs_fixing':
      return 'error';
    case 'incomplete':
    case 'draft':
    default:
      // Incomplete/draft (and any unexpected variant) read as a neutral "not done yet" todo, never a
      // false error or false ready.
      return 'todo';
  }
}

/**
 * Build the shared {@link DayRowViewModel} for one classified recording day.
 *
 * @param input - The day's identity, recovery classification, and the surface's display result.
 * @returns The shared row view-model (page-specific extras are added by the caller's composite).
 */
export function buildDayRowViewModel(input: DayRowInput): DayRowViewModel {
  const { dayId, date, sessionDescription, recovery, display, valid, state, animalKey, declaredOwner } = input;

  // The editor link exists only for rows that resolve to an openable day: a normal day ('ok') or a
  // recovered-but-unlinked day (still has its record + owner). Dangling references, wrong-owner rows,
  // and owner-missing orphans have no editor to open (they offer a repair instead).
  const openable = recovery === 'ok' || recovery === 'recovered_unlinked';
  const href = openable ? `#/day/${dayId}` : undefined;

  // Lifecycle + export-eligibility are meaningful only for a metadata-valid day. A valid day in its
  // normal place is exportable and carries the ready/validated/exported word; a valid recovered day is
  // valid metadata but blocked until it is re-linked into its animal's day list.
  const lifecycle =
    valid && recovery === 'ok'
      ? (lifecycleForValidDay(state) as 'ready' | 'validated' | 'exported')
      : undefined;
  const exportEligibility = valid
    ? recovery === 'recovered_unlinked'
      ? ('blocked-needs-relink' as const)
      : ('eligible' as const)
    : undefined;

  const row: DayRowViewModel = {
    dayId,
    date,
    href,
    status: variantToSeverity(display.variant),
    statusLabel: display.label,
    // The un-collapsed display variant for the status CSS class — `status` (severity) is lossy.
    chipVariant: display.variant,
    sessionDescription,
    recovery,
    actions: [],
  };
  if (lifecycle) row.lifecycle = lifecycle;
  if (exportEligibility) row.exportEligibility = exportEligibility;

  const recoveryDetail = buildRecoveryDetail(recovery, dayId, animalKey, declaredOwner);
  if (recoveryDetail) row.recoveryDetail = recoveryDetail;

  return row;
}

/**
 * Assemble the structured recovery detail (owner description + repair affordance) for a row that is
 * not in its normal place. Returns undefined for an `ok` row.
 */
function buildRecoveryDetail(
  recovery: DayStatus,
  dayId: string,
  animalKey: string,
  declaredOwner: unknown
): DayRowViewModel['recoveryDetail'] {
  const target = { animalId: animalKey, dayId };
  switch (recovery) {
    case 'dangling_reference':
      return {
        status: recovery,
        repair: { label: 'Remove day reference', command: { id: 'removeDayReference', target } },
      };
    case 'orphan_no_owner':
      return {
        status: recovery,
        message: 'No owning animal — re-create the animal or re-import its data.',
      };
    case 'wrong_owner': {
      const owner = describeOwner(declaredOwner);
      return {
        status: recovery,
        ownerDescription: owner,
        message: `belongs to ${owner}`,
        repair: { label: 'Remove from this animal', command: { id: 'unlinkDayReference', target } },
      };
    }
    case 'recovered_unlinked':
      // An owner-missing orphan is classified `orphan_no_owner`, so a `recovered_unlinked` row always
      // has a present owner and a real re-link target.
      return {
        status: recovery,
        message: 'not in day list',
        repair: { label: 'Add to day list', command: { id: 'relinkDayReference', target } },
      };
    case 'ok':
    default:
      return undefined;
  }
}
