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
 *   - PERSISTED history — was the validation/export **saved**? ("Validated" / "Exported")
 *
 * Live state always wins when it conflicts with a saved flag (a day saved as "validated" that is
 * now live-broken reads the honest "Needs fixing"); that precedence lives in the consuming
 * helpers (`workflowStatus.getDayRowStatus`, the Validation Summary chip), which call into this
 * vocabulary rather than re-coining strings. This module is pure data + one pure resolver — it
 * never computes validation and never touches the export (it is display-only, so it cannot affect
 * YAML byte-identity).
 */

/**
 * The five day-lifecycle variants. Frozen to the closed-enum convention used across the
 * domain/state layers.
 */
export const DAY_LIFECYCLE = Object.freeze({
  NEEDS_FIXING: 'needs_fixing',
  DRAFT: 'draft',
  READY: 'ready',
  VALIDATED: 'validated',
  EXPORTED: 'exported',
} as const);

/** The closed set of day-lifecycle values. */
export type DayLifecycle = typeof DAY_LIFECYCLE[keyof typeof DAY_LIFECYCLE];

/** The valid/exportable lifecycle subset returned by {@link lifecycleForValidDay}. */
export type ValidDayLifecycle = (typeof DAY_LIFECYCLE)['READY' | 'VALIDATED' | 'EXPORTED'];

/**
 * The canonical plain-language label for each variant — the word every surface shows. Kept short
 * so each surface can add its own descriptive suffix (e.g. Animal Days appends "— not yet
 * validated" to the Draft label) without re-coining the base word.
 */
export const DAY_LIFECYCLE_LABEL = Object.freeze({
  needs_fixing: 'Needs fixing',
  draft: 'Draft',
  ready: 'Ready to export',
  validated: 'Validated',
  exported: 'Exported',
}) satisfies Readonly<Record<DayLifecycle, string>>;

/**
 * A one-line explanation of each variant, for the shared legend and tooltips. These make the
 * live-vs-persisted distinction legible: "Ready to export" passes the checks now; "Validated" was
 * saved.
 */
export const DAY_LIFECYCLE_DESCRIPTION = Object.freeze({
  needs_fixing: 'Has a blocking issue — resolve it before exporting.',
  draft: 'Not yet ready — still missing required information.',
  ready: 'Passes every check right now, but the result has not been saved yet.',
  validated: 'Validation was saved, and the day still passes every check.',
  exported: 'Its YAML has been downloaded; it still passes every check.',
}) satisfies Readonly<Record<DayLifecycle, string>>;

/**
 * Legend reading order — the lifecycle progression a day moves through, with the off-path
 * "Needs fixing" last. Drives the shared {@link DayLifecycleLegend}.
 */
export const DAY_LIFECYCLE_ORDER = Object.freeze([
  DAY_LIFECYCLE.DRAFT,
  DAY_LIFECYCLE.READY,
  DAY_LIFECYCLE.VALIDATED,
  DAY_LIFECYCLE.EXPORTED,
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
 * @returns The lifecycle variant (`'ready'` | `'validated'` | `'exported'`) for a live-valid day.
 */
export function lifecycleForValidDay(state: unknown): ValidDayLifecycle {
  const s: Record<string, unknown> = isRecord(state) ? state : {};
  if (s.exported) return DAY_LIFECYCLE.EXPORTED;
  if (s.validated) return DAY_LIFECYCLE.VALIDATED;
  return DAY_LIFECYCLE.READY;
}
