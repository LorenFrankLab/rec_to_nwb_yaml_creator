import type { RepairableIssue } from './repairRouting';

/** Off-export day-state flags that control when validation results are surfaced. */
interface PresentationState {
  validationDeferred?: unknown;
  deferredEpochs?: unknown;
}

/** Whether a value is a non-null, non-array object. */
function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

/** Read the day.state record tolerantly. */
function dayState(day: unknown): PresentationState {
  return isRecord(day) && isRecord(day.state) ? (day.state as PresentationState) : {};
}

/** Integer-normalized, de-duplicated list from an off-export state array. */
function integerList(value: unknown): number[] {
  const seen = new Set<number>();
  (Array.isArray(value) ? value : []).forEach((item) => {
    const n = Number(item);
    if (Number.isInteger(n)) seen.add(n);
  });
  return [...seen].sort((a, b) => a - b);
}

/**
 * True only for app-created empty scaffolds whose validation should stay quiet until first open/edit.
 * Imported/loaded days lack this additive off-export flag, so their issues surface immediately.
 */
export function isDayValidationDeferred(day: unknown): boolean {
  return dayState(day).validationDeferred === true;
}

/** Epochs whose fresh missing-video errors are presentation-deferred until opened/edited. */
export function getDeferredEpochs(day: unknown): number[] {
  return integerList(dayState(day).deferredEpochs);
}

/** Extract the epoch number from an epoch-level issue focus path. */
function epochFromIssue(issue: RepairableIssue): number | null {
  const match = /^epoch-(\d+)-/.exec(String(issue.focusPath ?? ''));
  return match ? Number(match[1]) : null;
}

/** Whether this error is the missing-video rule for a still-deferred epoch. */
function isDeferredEpochVideoIssue(issue: RepairableIssue, deferredEpochs: Set<number>): boolean {
  if (issue.severity !== 'error' || issue.code !== 'epoch_video_undeclared') return false;
  const epoch = epochFromIssue(issue);
  return epoch != null && deferredEpochs.has(epoch);
}

/**
 * Presentation-only issue filtering. The raw validation/export gate remains unchanged; this only
 * decides which already-computed issues the day-list row and Day Editor banner surface.
 */
export function presentValidationIssues(
  issues: RepairableIssue[],
  day: unknown
): RepairableIssue[] {
  if (isDayValidationDeferred(day)) {
    return issues.filter((issue) => issue.severity !== 'error');
  }
  const deferredEpochs = new Set(getDeferredEpochs(day));
  if (deferredEpochs.size === 0) return issues;
  return issues.filter((issue) => !isDeferredEpochVideoIssue(issue, deferredEpochs));
}

/** True when every raw blocking issue has been presentation-deferred. */
export function allBlockingIssuesDeferred(
  issues: RepairableIssue[],
  day: unknown
): boolean {
  const rawBlocking = issues.filter((issue) => issue.severity === 'error');
  if (rawBlocking.length === 0) return false;
  const presentedBlocking = presentValidationIssues(issues, day).filter(
    (issue) => issue.severity === 'error'
  );
  return presentedBlocking.length === 0;
}
