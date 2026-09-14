/**
 * @fileoverview The shared issue-family + model vocabulary for the custom business rules.
 *
 * This is the "one shared issue-family type" the `validation/taskCatalogValidation.ts` header
 * anticipated: the `validation/rules/*` families and the `rulesValidation` composer now produce
 * a typed {@link ValidationIssue}. The shape is the exact superset the rules emit (a subset of
 * `domain/repairRouting`'s permissive `RepairableIssue`, which READS issues from heterogeneous
 * sources including AJV schema errors) — kept self-contained here so the validation layer carries
 * no cross-layer type import; `ValidationIssue` is structurally assignable to `RepairableIssue`, so
 * `validate()`'s combined output still flows into the routing/status consumers unchanged.
 */

/** Issue severity. Every rule emits one of these. */
export type RuleSeverity = 'error' | 'warning';

/** The minimum shape the severity predicates read — every issue type in the app satisfies it. */
export interface SeverityCarrier {
  severity?: string;
}

/**
 * Whether an issue blocks export. Decided HERE, once: only an explicit `'error'` blocks. A warning
 * is advisory, and so is an issue with no severity at all (permissive sources such as
 * `RepairableIssue` type it optional) — the export gate fails open on an unlabelled issue rather
 * than blocking a scientist on a bookkeeping gap. Every gate in the app must call this rather than
 * compare the string itself, so that policy cannot be re-decided per call site.
 *
 * @param issue - Any issue-shaped value.
 * @returns True when the issue blocks export.
 */
export function isBlockingIssue(issue: SeverityCarrier | null | undefined): boolean {
  return issue?.severity === 'error';
}

/**
 * Whether an issue is advisory: surfaced to the user, never blocking export.
 *
 * @param issue - Any issue-shaped value.
 * @returns True for warning-severity issues.
 */
export function isAdvisoryIssue(issue: SeverityCarrier | null | undefined): boolean {
  return issue?.severity === 'warning';
}

/**
 * The blocking subset of an issue list.
 *
 * @param issues - Issues from any producer.
 * @returns Only the issues that block export, in their original order.
 */
export function blockingIssues<T extends SeverityCarrier>(issues: readonly T[]): T[] {
  return issues.filter((issue) => isBlockingIssue(issue));
}

/** The editable owner a rule routes its repair to. */
export type RuleRepairSurface = 'animal' | 'day' | 'none';

/**
 * A validation issue produced by the custom business rules. `code` / `path` / `message` /
 * `severity` are set by every rule; the repair-routing fields are set where the rule has a
 * specific surface/step/action (they are optional because not every issue carries all of them).
 */
export interface ValidationIssue {
  /** Stable app-rule code (e.g. `missing_camera`). */
  code: string;
  /** Normalized dotted path (e.g. `cameras`, `tasks[0].camera_id`). */
  path: string;
  /** Human-readable explanation. */
  message: string;
  /** Issue severity. */
  severity: RuleSeverity;
  /** The editable owner of the issue (day / animal / none). */
  repairSurface?: RuleRepairSurface;
  /** Offending field name. */
  field?: string;
  /** Day-Editor step the repair routes to. */
  step?: string;
  /** Short repair call-to-action. */
  actionLabel?: string;
  /** Original AJV instance path (schema issues only, e.g. `/subject/weight`). */
  instancePath?: string;
  /** Original AJV schema path (schema issues only, for debugging). */
  schemaPath?: string;
}

/**
 * The validated form model the rules probe. Intentionally permissive (`any`-valued reads): the
 * rules defensively handle ARBITRARY, possibly-corrupt input at RUNTIME (Array.isArray / typeof /
 * optional chaining / `=== null`), so compile-time narrowing of each access would force guard churn
 * without adding safety. The typed guarantee of this layer is the produced {@link ValidationIssue}[],
 * not the untyped external input. (Matches the deviceOverrideMerge "tolerant read" stance, scaled to
 * a much larger read surface.)
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type ValidationModel = Record<string, any>;
