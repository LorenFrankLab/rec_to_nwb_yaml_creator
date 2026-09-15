/**
 * @fileoverview Shared day-lifecycle vocabulary (Phase 8A-1).
 *
 * ONE source of truth for the words every surface uses to describe where a recording day sits in
 * the validate → export lifecycle. Before this module, Animal Days, Day Validation, Day Export,
 * and the Validation Summary each coined their own phrases — so the SAME day could read "Ready to
 * export" (Animal Days, from the persisted `state.validated` flag), "Valid" (Validation Summary,
 * computed live), and "Ready to export — all checks pass" (Day Validation, also live) with no way
 * for the user to tell persisted history from live readiness. This module fixes that by naming the
 * states once and distinguishing two axes that were previously conflated:
 *
 *   - LIVE readiness — does the day pass every check **right now**? ("Ready to export")
 *   - DOWNLOAD history — was it downloaded, and does the current export still match that download?
 *     ("Downloaded" / "Changed since download", derived from the export receipt)
 *
 * Live state always wins when it conflicts with a saved flag (a day saved as "validated" that is
 * now live-broken reads the honest "Needs fixing"); that precedence lives in the consuming
 * helpers (`workflowStatus.getDayRowStatus`, the Validation Summary chip), which call into this
 * vocabulary rather than re-coining strings. This module is pure data + one pure resolver — it
 * never computes validation and never touches the export (it is display-only, so it cannot affect
 * YAML byte-identity).
 */

/**
 * The five day-lifecycle variants — Draft · Ready to export · Downloaded · Changed since download ·
 * Needs attention. Frozen to the closed-enum convention used across the domain/state layers. (The
 * former `validated` word is retired: a saved validation is not a step scientists perform, so it
 * reads as ready.)
 */
export const DAY_LIFECYCLE = Object.freeze({
  NEEDS_FIXING: 'needs_fixing',
  DRAFT: 'draft',
  READY: 'ready',
  EXPORTED: 'exported',
  /** Downloaded before, but the current effective export differs from that download (F6). */
  CHANGED_SINCE_EXPORT: 'changed_since_export',
} as const);

/** The closed set of day-lifecycle values. */
export type DayLifecycle = typeof DAY_LIFECYCLE[keyof typeof DAY_LIFECYCLE];

/** The valid/exportable lifecycle subset returned by {@link lifecycleForValidDay}. */
export type ValidDayLifecycle = (typeof DAY_LIFECYCLE)['READY' | 'EXPORTED' | 'CHANGED_SINCE_EXPORT'];

/**
 * The canonical plain-language label for each variant — the word every surface shows. Kept short
 * so each surface can add its own descriptive suffix (e.g. Animal Days appends "— not yet
 * validated" to the Draft label) without re-coining the base word.
 */
export const DAY_LIFECYCLE_LABEL = Object.freeze({
  needs_fixing: 'Needs attention',
  draft: 'Draft',
  ready: 'Ready to export',
  exported: 'Downloaded',
  changed_since_export: 'Changed since download',
}) satisfies Readonly<Record<DayLifecycle, string>>;

/**
 * A one-line explanation of each variant, for the shared legend and tooltips. These make the
 * live-vs-persisted distinction legible: "Ready to export" passes the checks now; "Validated" was
 * saved.
 */
export const DAY_LIFECYCLE_DESCRIPTION = Object.freeze({
  needs_fixing: 'Has a blocking issue — resolve it before exporting.',
  draft: 'Not yet ready — still missing required information.',
  ready: 'Passes every check right now.',
  exported: 'Its YAML has been downloaded and nothing has changed since. A download is not proof the conversion succeeded.',
  changed_since_export: 'Its YAML was downloaded, but the export (content or filename) has changed since — download it again.',
}) satisfies Readonly<Record<DayLifecycle, string>>;

/**
 * Legend reading order — the lifecycle progression a day moves through, with the off-path
 * "Needs fixing" last. Drives the shared {@link DayLifecycleLegend}.
 */
export const DAY_LIFECYCLE_ORDER = Object.freeze([
  DAY_LIFECYCLE.DRAFT,
  DAY_LIFECYCLE.READY,
  DAY_LIFECYCLE.EXPORTED,
  DAY_LIFECYCLE.CHANGED_SINCE_EXPORT,
  DAY_LIFECYCLE.NEEDS_FIXING,
] as const) satisfies ReadonlyArray<DayLifecycle>;

/**
 * True only for a plain object — not null, not an array. A corrupt import can persist `day.state`
 * as a scalar/array; treat anything non-plain as "no saved flags" rather than throwing.
 * @param value
 * @returns True for a non-null, non-array object.
 */
const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value);

/**
 * Resolve the lifecycle variant of a day that is **already known to be live-valid** from its
 * persisted state: export history outranks a saved validation, which outranks a merely-passing
 * (unsaved) day. The caller decides liveness (a live error/incomplete day must NOT be passed
 * here — it is `needs_fixing`/`draft`, never `validated`); this only refines the passing bucket so
 * persisted validation is visually distinct from live-valid readiness.
 *
 * @param state - The day's persisted `state` (may be malformed).
 * @param freshness - The download freshness from `exportFreshness` (`current` when the last
 *   download equals the current effective export; anything else demotes "Downloaded").
 * @returns The lifecycle variant for a live-valid day.
 */
export function lifecycleForValidDay(
  state: unknown,
  freshness: 'never' | 'current' | 'changed' | 'unverified' = 'current'
): ValidDayLifecycle {
  const s: Record<string, unknown> = isRecord(state) ? state : {};
  if (s.exported) {
    // "Downloaded" while the current effective export still equals the last download. A download
    // whose content cannot be compared (pre-receipt data) is still a download — it reads Downloaded,
    // with the unverifiable receipt surfaced separately as a review note.
    return freshness === 'changed' ? DAY_LIFECYCLE.CHANGED_SINCE_EXPORT : DAY_LIFECYCLE.EXPORTED;
  }
  // `state.validated` (a saved validation) is not a separate step scientists perform; it reads as
  // ready — live readiness is what matters.
  return DAY_LIFECYCLE.READY;
}
