/**
 * @fileoverview Shared view-model vocabulary for the modern workspace surfaces.
 *
 * These are the plain-data types the page view-models are assembled from. A view-model builder
 * returns one of these (or a page-specific composite of them); a React component renders it. The
 * point is that the workflow decisions a page used to discover inline — section status, export
 * readiness, blocking vs warning, the next repair target, inherited/default field values, button
 * enabled/disabled reasons, recovery states — become data produced by a pure, testable builder, so
 * the page is a thin renderer.
 *
 * Hard rule — these are PLAIN DATA. No React, no DOM, no CSS class names, no callbacks/functions,
 * no `href` construction that assumes a router beyond the existing `#/…` hash strings. If a field
 * would hold a function, it belongs in the command layer (a {@link WorkflowCommand} descriptor),
 * not here. Presentation derived purely from a field (a status glyph or CSS class picked from a
 * {@link WorkflowSeverity}) stays in the component.
 *
 * These do NOT replace the domain enums ({@link module:domain/dayLifecycle},
 * {@link module:domain/sectionStatus}, {@link module:domain/dayRecovery}); builders MAP those onto
 * this vocabulary — see {@link WorkflowSeverity}. Types are compile-time only; this module emits no
 * runtime code.
 */

import type { StepStatus } from '../domain/stepStatus';
import type { WorkflowCategory } from '../domain/workflowCategories';
import type { WorkflowCommandId } from './commands/commandCatalog';

/**
 * The single severity vocabulary the modern UI renders. It does not replace the domain status enums
 * — builders map those onto it and must not re-derive readiness. The canonical mapping (each builder
 * applies it; see the per-builder severity tests):
 *
 * | Source (existing domain truth)                                              | → WorkflowSeverity |
 * | -------------------------------------------------------------------------- | ------------------ |
 * | `DAY_LIFECYCLE.READY` / `.VALIDATED` / `.EXPORTED`                          | `ready`            |
 * | `DAY_LIFECYCLE.DRAFT` (no blocking error)                                   | `todo`             |
 * | `DAY_LIFECYCLE.NEEDS_FIXING` / any live blocking issue                      | `error`            |
 * | `SECTION_STATUS.TODO`                                                       | `todo`             |
 * | configured section with no blocking issue                                   | `ready`            |
 * | a section returned by `getAnimalBlockingSections(...)`                      | `error`            |
 * | a non-blocking advisory (e.g. a bad-channel warning)                        | `warning`          |
 *
 * `todo` renders NEUTRAL (a "not set up yet" cue, no warning color) — distinct from `warning`, which
 * flags a non-blocking problem.
 *
 * Source enums: `DAY_LIFECYCLE` (src/domain/dayLifecycle.ts), `SECTION_STATUS` /
 * `getAnimalBlockingSections` (src/domain/sectionStatus.ts), `DAY_STATUS` (src/domain/dayRecovery.ts).
 */
export type WorkflowSeverity = 'ready' | 'todo' | 'warning' | 'error';

/**
 * A recording day's recovery classification — the closed `DAY_STATUS` set (src/domain/dayRecovery).
 * The view-model freezes it as a union; a builder translates the domain enum (whose values are typed
 * as `string`) onto it at the boundary.
 */
export type DayStatus =
  | 'ok'
  | 'dangling_reference'
  | 'recovered_unlinked'
  | 'orphan_no_owner'
  | 'wrong_owner';

/**
 * Re-export of the day-editor step status (src/domain/stepStatus) so the step view-model can carry the
 * stepper's full 4-state fidelity (`valid` ✓ / `incomplete` ⚠ / `error` ✗ / `pending` ○) rather than
 * collapsing `incomplete` and `pending` into one {@link WorkflowSeverity}.
 */
export type { StepStatus };

/** Re-export the closed command-id union so consumers can constrain dispatch from the vocabulary hub. */
export type { WorkflowCommandId };

/**
 * Plain-data command metadata carried by a write-style {@link WorkflowAction}. Lets a page invoke
 * user intent (`createRecordingDay`, `deleteDay`, `exportValidOnly`, …) without re-discovering the
 * write's target. The builder supplies the stable target/context; the component supplies only
 * transient user-entered values (e.g. a typed date) at call time.
 */
export interface WorkflowCommand {
  /**
   * Intent identifier resolved by the command layer — a member of the closed
   * {@link WorkflowCommandId} set (the keys of `WORKFLOW_COMMAND_CATALOG`), so a typo'd or invented
   * id is a compile error, not a silent runtime miss. E.g. `deleteDay`, `exportValidOnly`.
   */
  id: WorkflowCommandId;
  /** Stable target/context known by the builder: animal id, day id, section key, field path. */
  target?: {
    animalId?: string;
    dayId?: string;
    section?: string;
    fieldPath?: string;
  };
  /** Optional plain-data payload known at render time. A component may merge in transient values. */
  payload?: Record<string, unknown>;
  /**
   * User-facing caveat to surface before a destructive command runs, e.g. that already-downloaded
   * files are not deleted. Present only when the command has a consequence worth confirming.
   */
  confirmCaveat?: string;
}

/**
 * A user-facing action a surface can offer (a link or a write).
 *
 * `href` and `command` are mutually informative: a link-style action sets `href` (a `#/…` hash
 * route); a write-style action sets `command` (a descriptor the command layer resolves to a bound
 * handler — the component maps `command.id`, the builder never holds a function). When
 * `disabledReason` is present the action is rendered disabled and the string is the user-facing
 * reason (drives `aria-describedby` + `title`).
 */
export interface WorkflowAction {
  /** Button/link text, e.g. 'Set up', 'Fix', 'Export Valid Only'. */
  label: string;
  /** Hash route to navigate to, e.g. `#/animal/remy/electrode-groups?field=…`. */
  href?: string;
  /** Intent descriptor resolved by the command layer (NOT a function). */
  command?: WorkflowCommand;
  /** When present the action is disabled and this is the user-facing reason. */
  disabledReason?: string;
  /**
   * The kind of setup action this is, distinct from its label — lets a renderer style/announce the
   * verb consistently: `setup` (not started), `fix` (blocking error), `review` (done).
   */
  intent?: 'fix' | 'setup' | 'review';
}

/**
 * One validation/export issue, already classified — replaces the per-component decision of "is this
 * blocking?" and "what's the repair?". Only blocking (`error`) and non-blocking (`warning`) issues
 * are surfaced as issues.
 */
export interface IssueViewModel {
  /** Blocking (`error`) vs non-blocking (`warning`). */
  severity: 'error' | 'warning';
  /** Display message — already humanized (no raw snake_case schema keys). */
  message: string;
  /** Schema path for deep-link/scroll anchoring, e.g. `electrode_groups[0].targeted_x`. */
  fieldPath?: string;
  /** Ownership pattern from `ownershipForIssue` (src/domain/workflowOwnership). Verbatim string. */
  ownership: string;
  /**
   * The ownership pattern's primary action ("Fix shared animal setup", "Select the item used on this
   * day", …), from `ownershipForIssue().primaryAction` — the text `IssueOwnershipHint` renders. Set
   * by the day-editor issue list (`toIssueViewModel`); omitted by synthetic gate issues that are not
   * rendered through the ownership hint.
   */
  ownershipAction?: string;
  /** True when fixing this reaches beyond the day in front of the user (blast-radius cue). */
  reachesBeyondDay: boolean;
  /**
   * Workflow category (`workflowCategoryForIssue`) — the bucket the repair/validation list groups by.
   * Set for every rendered day-editor issue; omitted by synthetic gate issues not shown in the list.
   */
  category?: WorkflowCategory;
  /** User-facing category label (`WORKFLOW_CATEGORY_LABELS[category]`) — the group heading. */
  categoryLabel?: string;
  /** Where to go to fix it (route + label), from `repairTargetForIssue` (src/domain/repairRouting). */
  repair?: WorkflowAction;
  /**
   * The editable surface of the repair (`'animal'` | `'day'`) — drives the repair button's
   * `data-repair-surface` and (for a navigate repair) the nav target. Absent when there is no repair
   * (`repairTargetForIssue` surface `'none'`).
   */
  repairSurface?: 'animal' | 'day';
  /**
   * Whether the repair runs a serializable command in place (`'execute'`) or navigates to the owning
   * surface (`'navigate'`). Mirrors `RepairActionButton`'s precedence: an issue carrying a
   * `repairCommand` is executable; otherwise it navigates. Absent when there is no repair.
   */
  repairKind?: 'execute' | 'navigate';
  /**
   * The focus target a navigate repair hands to the owning surface (the control to highlight) —
   * `issue.focusPath || issue.path`. Absent for an executable repair or when there is no anchor.
   */
  repairFocusPath?: string;
  /**
   * Collapse key for the repair BUTTON: several issues can share one underlying fix, so every message
   * shows but only one button per unique (surface, step, focus, command) renders. Mirrors
   * `RepairActions`' `repairButtonKey`. Absent when there is no repair.
   */
  repairDedupKey?: string;
}

/**
 * A configurable section (an animal-setup tab) reduced to what the nav renders: its status ring, a
 * one-line summary, a count, and an optional set-up/fix/review action.
 */
export interface SectionViewModel {
  /** Route `:tab` segment, e.g. 'electrode-groups'. */
  key: string;
  /** Display label, e.g. 'Electrode Groups'. */
  label: string;
  /** Mapped from `getAnimalSectionStatus`/`getAnimalBlockingSections` per the {@link WorkflowSeverity} invariant. */
  status: WorkflowSeverity;
  /** One-line state, e.g. '1 group · CA1' or 'Needs fixing — Targeted x is required'. */
  summary: string;
  /** Number of issues attributed to this section. */
  issueCount: number;
  /** 'Set up' / 'Fix' / 'Review' link to the section route. */
  action?: WorkflowAction;
  /**
   * A pre-rendered count token for sections whose count is not the numeric `issueCount` — e.g.
   * 'N ready' for export, or 'used' / 'incomplete' for optogenetics. Absent when `issueCount` (or
   * no count) is the display.
   */
  countLabel?: string;
  /** Whether the nav shows a count at all — a not-started (`todo`) section hides it. */
  showCount?: boolean;
}

/**
 * Structured recovery detail for a day row that is not in its normal place (dangling reference,
 * recovered-but-unlinked, wrong owner). Complements {@link DayRowViewModel.recovery} (the bare
 * status string) with the owner description and the repair affordance to surface.
 */
export interface DayRecoveryViewModel {
  /** DAY_STATUS classification (src/domain/dayRecovery). */
  status: DayStatus;
  /** 'Belongs to <owner>'-style description, from `describeOwner`. */
  ownerDescription?: string;
  /** The recovery note shown on the row. */
  message?: string;
  /** The repair affordance (re-link / unlink / remove reference). */
  repair?: WorkflowAction;
}

/**
 * A recording-day row — identical core shape whether rendered in the AnimalWorkspace day list or the
 * ValidationSummary table. Page-specific extras (table scan cells) are added by the per-page
 * composite that extends this; the status/label/recovery/actions are the shared core.
 */
export interface DayRowViewModel {
  /** Recording-day id. */
  dayId: string;
  /** Human date string as shown in the row. */
  date: string;
  /** `#/day/<id>` — absent for unresolvable rows. */
  href?: string;
  /** Mapped from `getDayRowStatus`/`DAY_LIFECYCLE` per the {@link WorkflowSeverity} invariant. */
  status: WorkflowSeverity;
  /** 'Ready to export' | 'Needs fixing — …' | 'Re-link to export' | 'Missing record' | …. */
  statusLabel: string;
  /**
   * The surface's own display variant for the status CSS class — the un-collapsed variant the
   * surface's status function returned (`dayChipDisplay` / `getDayRowStatus`), e.g. `ready` /
   * `validated` / `exported` / `error` / `incomplete` / `needs_fixing` / `draft`. Distinct from the
   * lossy {@link WorkflowSeverity} `status`: a `validated` and an `exported` day both map to `ready`
   * severity, so the chip class needs this un-collapsed value to stay visually distinct.
   */
  chipVariant: string;
  /** First line of the session description, when present. */
  sessionDescription?: string;
  /** Day classification from `classifyAnimalDays` / `DAY_STATUS` (src/domain/dayRecovery). */
  recovery: DayStatus;
  /** Row actions (duplicate / delete / unlink / re-link), with `disabledReason` where relevant. */
  actions: WorkflowAction[];
  /**
   * Lifecycle refinement when `status` is `ready`: a live-valid day reads `ready`, a day with a
   * saved validation reads `validated`, and a downloaded day reads `exported`. Lets the row show the
   * persisted-history word that `status` alone (all three map to `ready`) cannot express.
   */
  lifecycle?: 'ready' | 'validated' | 'exported';
  /**
   * Whether a metadata-valid day is actually exportable: `eligible`, or `blocked-needs-relink` for a
   * recovered-but-unlinked day that must be re-linked into its animal's day list before export.
   */
  exportEligibility?: 'eligible' | 'blocked-needs-relink';
  /** Structured recovery detail for non-`ok` rows (owner description + repair affordance). */
  recoveryDetail?: DayRecoveryViewModel;
}

/**
 * What a single day will contribute to a batch export — the "what this file will contain" scan shown
 * in the batch-export preflight. Counts are plain numbers; `warnings` are the non-blocking issues the
 * user must acknowledge before confirming.
 */
export interface DayPreflightViewModel {
  dayId: string;
  /** The day's display label (subject + date). */
  label: string;
  /** Config-version label, e.g. 'config v2 (latest)'. */
  configLabel: string;
  /** Electrode-group count. */
  groups: number;
  /** Failed-channel count. */
  failedChannels: number;
  /** Camera count. */
  cameras: number;
  /** Optogenetics state label. */
  opto: string;
  /** Non-blocking issues to acknowledge before export. */
  warnings: IssueViewModel[];
  /** Set when the day could not be merged/scanned (corrupt config). */
  error?: string;
}

/** One bucket of a batch run's per-day outcomes. */
export interface BatchRunReportViewModel {
  /** Outcome kind. */
  kind: 'skipped' | 'overridden' | 'failed' | 'stale' | 'validate-error';
  items: Array<{ dayId: string; subjectId: string; date: string; detail?: string }>;
}

/** The result of a validate-all or batch-export run: a summary message plus per-outcome reports. */
export interface BatchRunResultViewModel {
  /** Pluralized summary line, e.g. 'Exported 3 files. 1 day not exported.'. */
  message: string;
  reports: BatchRunReportViewModel[];
}

/**
 * One step of the day-editor stepper. Like a {@link SectionViewModel} but for a linear stepper: it
 * adds the `active` (current-step) flag, and carries the domain {@link StepStatus} (not
 * {@link WorkflowSeverity}) so the stepper keeps its full 4-state fidelity — `incomplete` (⚠) and
 * `pending` (○) are distinct, where both would otherwise collapse to one severity. The status glyph
 * and CSS class are derived from `status` by the component.
 */
export interface StepViewModel {
  /** Step key, e.g. 'overview' | 'devices' | 'validation' | 'export'. */
  key: string;
  /** Display label. */
  label: string;
  /** The per-step status (src/domain/stepStatus): 'valid' | 'incomplete' | 'error' | 'pending'. */
  status: StepStatus;
  /** Accessible status text, e.g. 'Complete' | 'Has errors' | 'Not started'. */
  statusLabel: string;
  /** Count shown on the step (e.g. the Validation step's 'N to fix'); absent when not shown. */
  issueCount?: number;
  /** Whether this is the current step. */
  active: boolean;
  /** `#/day/<id>/<step>` link when the step is independently addressable. */
  href?: string;
}

/**
 * A day-editor field whose effective value may come from the day, be inherited from the animal, fall
 * back to a default, or be derived. The `source` is surfaced (not hidden) so the UI can badge
 * "inherited from animal" / "default" without re-deriving from the merge.
 */
export interface FieldValueViewModel {
  /** Schema/field path, e.g. 'session.weight'. */
  fieldPath: string;
  /** Display label. */
  label: string;
  /** The effective value, already stringified for display. */
  value: string;
  /** Where the effective value came from. */
  source: 'day' | 'inherited' | 'default' | 'derived';
  /** When `source` is 'inherited', what it is inherited from (e.g. 'animal'). */
  inheritedFrom?: string;
  /** The fallback value shown as a placeholder when the day has none. */
  fallbackValue?: string;
  /** Help text shown beneath the field. */
  helpText?: string;
  /** Whether the field is read-only on this surface. */
  readOnly?: boolean;
  /** An issue attached to this field, when present. */
  issue?: IssueViewModel;
}

/**
 * The day-editor export gate: whether export is open, and if not, why — with the blocking issues and
 * blocking prerequisite steps that explain the block. Carries the export action (disabled with a
 * reason while blocked).
 */
export interface ExportGateViewModel {
  /** True when export is allowed. */
  open: boolean;
  /** Why export is blocked, when `open` is false. */
  reason?: 'validation-errors' | 'incomplete-steps' | 'merge-error' | 'unlinked-day';
  /** Blocking (error-severity) issues. */
  blockingIssues: IssueViewModel[];
  /** Prerequisite steps that are not yet complete. */
  blockingSteps: SectionViewModel[];
  /** The user-facing gate message. */
  message: string;
  /** The export action (with `disabledReason` while blocked). */
  action: WorkflowAction;
  /**
   * The lifecycle classification of an exportable day (`lifecycleForValidDay`) — only set when
   * `open`. Lets the readiness surfaces show the persisted-history word (`ready` is live-valid,
   * `validated` has a saved validation, `exported` has been downloaded) without re-deriving it.
   */
  lifecycle?: 'ready' | 'validated' | 'exported';
  /**
   * The short lifecycle status label ('Ready to export' | 'Validated' | 'Exported',
   * `DAY_LIFECYCLE_LABEL[lifecycle]`) — the Export step's status line. Only set when `open`.
   */
  lifecycleStatusLabel?: string;
  /**
   * The full readiness sentence the Validation summary shows when ready (e.g. 'Validated — all checks
   * pass. This validation has been saved.'). Only set when `open`.
   */
  readyMessage?: string;
}

/**
 * The per-channel state of a bad-channel mark in the day editor. `priorBad` + `requiresAck` capture
 * the monotonicity rule: un-marking a channel that was failed on an earlier same-config day needs an
 * explicit acknowledgement before export.
 */
export interface BadChannelMarkViewModel {
  /**
   * The ntrode (electrode group) id this channel belongs to. A string because bad-channel maps are
   * keyed by `String(ntrode_id)` at lookup (and recovered/imported maps are string-keyed at runtime).
   */
  ntrodeId: string;
  /** The probe-local channel index. */
  channel: number;
  /** Whether the channel is currently marked failed. */
  marked: boolean;
  /** Whether the channel was failed on an earlier same-config day. */
  priorBad: boolean;
  /** Whether un-marking this channel requires an off-export acknowledgement. */
  requiresAck: boolean;
  /** Whether the required acknowledgement has been recorded. */
  acked: boolean;
}

/** A breadcrumb trail, e.g. Workspace › Animal: remy › Day: 2023-06-22. The last item is current. */
export interface BreadcrumbViewModel {
  items: Array<{ label: string; href?: string }>;
}

/**
 * The day-editor shell's load state — distinct from a day row's recovery: this is whether the editor
 * could resolve a day to edit at all.
 */
export interface DayEditorShellViewModel {
  state: 'ok' | 'no-day-id' | 'day-not-found' | 'animal-not-found';
  /** User-facing message for a non-`ok` state. */
  message?: string;
  /** The resolved owner key when known. */
  ownerKey?: string;
}

/**
 * An advisory recovery/cleanup notice (a malformed collection, stale device override, or later-row
 * bad-channel corruption) with the command that repairs it. Not a severity-bearing issue — it is a
 * fix-this-data prompt rather than a validation failure.
 */
export interface RecoveryNoticeViewModel {
  /** Notice kind. */
  kind: 'malformed-collection' | 'stale-override' | 'badchannel-corruption';
  /** The user-facing notice text. */
  message: string;
  /** The repair button's label (e.g. 'Reset cameras', 'Rebuild device configuration history'). */
  actionLabel?: string;
  /** The repair command (e.g. reset the collection, remove the override). */
  repair: WorkflowCommand;
}
