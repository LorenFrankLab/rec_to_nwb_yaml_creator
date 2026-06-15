/**
 * @fileoverview DayEditor view-model builder.
 *
 * `buildDayEditorViewModel(workspace, dayId)` turns the workspace into the data the day-editor
 * surface renders: the shell load-state, the breadcrumb trail, the section stepper (with per-step
 * status + the active step), the overall severity, the inherited/default/derived overview fields,
 * the classified-and-routed validation issues, the per-channel bad-channel mark state (with its
 * monotonicity ack blockers), the advisory recovery/cleanup notices, and the authoritative export
 * gate (open + reason + blocking issues/steps + the export action with its disabled reason).
 *
 * It COMPOSES domain truth rather than re-deriving it:
 *   - step status from `computeStepStatus` (with the editor's fail-closed fallback when the merge
 *     is unavailable), and the Validation step's "N to fix" from `validateDay`;
 *   - the export gate from `isExportEnabled` / `exportBlockReason` + the day-in-index policy
 *     (`getAnimalDayIds`) — the exact AND-of-three the Export step gates on;
 *   - issue ownership / reach from `ownershipForIssue`, repair routing from `repairTargetForIssue`,
 *     humanized text from `humanizeValidationMessage`;
 *   - the effective field values from `mergeDayMetadata` compared against the day override vs the
 *     animal value (never re-implementing the merge rules);
 *   - bad-channel marks + the un-mark-needs-ack monotonicity from `priorBadChannels` /
 *     `getBadChannelRemovalAcks` over the merged channel map;
 *   - the malformed-collection / stale-override / missing-config notices from the existing raw-shape
 *     and device-override detectors (`validateRawDay` / `validateRawAnimal` / `classifyDeviceOverrides`).
 *
 * `mergeDayMetadata` THROWS by design on a corrupt animal config; the builder catches it and
 * represents it as an `error`-severity state (a single error issue, the export gate closed with a
 * `merge-error` reason) — it never throws out of the builder, mirroring how the day-row surfaces
 * fail closed on an unreadable day.
 *
 * Pure and React-free; returns plain data only. Runtime-only slots (focus, transient confirm
 * dialogs, save status) are not represented — they belong to the page, not the view-model.
 */

import { mergeDayMetadata } from '../state/workspaceUtils';
import {
  getAnimalDayIds,
  getAnimalDays,
  getAnimalSubject,
  getAnimalExperimenters,
  getExperimenterNames,
  getDaySession,
  resolveDayOwner,
} from '../state/workspaceSelectors';
import { computeStepStatus } from '../domain/stepStatus';
import { isExportEnabled } from '../domain/stepGate';
import { validateDay } from '../domain/dayValidationComposer';
import { ownershipForIssue } from '../domain/workflowOwnership';
import {
  repairTargetForIssue,
  animalSetupTabForFieldPath,
  STEP_LABELS,
} from '../domain/repairRouting';
import type { RepairableIssue } from '../domain/repairRouting';
import {
  workflowCategoryForIssue,
  WORKFLOW_CATEGORY_LABELS,
} from '../domain/workflowCategories';
import { lifecycleForValidDay, DAY_LIFECYCLE_LABEL } from '../domain/dayLifecycle';
import { describeOwner } from '../domain/dayRecovery';
import { humanizeValidationMessage } from '../domain/humanizeValidationMessage';
import {
  priorBadChannels,
  getBadChannelRemovalAcks,
} from '../domain/badChannelMonotonicity';
import { isMultiShankGroup, validBadChannelIds } from '../domain/badChannels';
import { classifyDeviceOverrides } from '../domain/deviceOverrides';
import { validateRawDay, validateRawAnimal } from '../validation/rawShape';
import type { Animal, Day } from '../state/workspaceTypes';
import type {
  BadChannelMarkViewModel,
  BreadcrumbViewModel,
  DayEditorShellViewModel,
  ExportGateViewModel,
  FieldValueViewModel,
  IssueViewModel,
  RecoveryNoticeViewModel,
  SectionViewModel,
  StepStatus,
  StepViewModel,
  WorkflowAction,
  WorkflowCommand,
  WorkflowCommandId,
  WorkflowSeverity,
} from './types';

/** The full DayEditor page view-model. */
export interface DayEditorViewModel {
  /** Whether the editor could resolve a day to edit at all (ok / no-day-id / day-/animal-not-found). */
  shell: DayEditorShellViewModel;
  /** Workspace › Animal › Day trail (the last item is current). */
  breadcrumb: BreadcrumbViewModel;
  /** The section stepper, in display order, each with its domain step status + the active flag. */
  steps: StepViewModel[];
  /** The single severity the page banner renders (mapped from the step statuses / export gate). */
  overall: WorkflowSeverity;
  /** The Overview step's day / inherited / default / derived fields, surfaced not hidden. */
  overview: { fields: FieldValueViewModel[] };
  /** Every validation issue, classified (ownership + reach) and repair-routed. */
  issues: IssueViewModel[];
  /** Per-channel bad-channel mark state + the un-mark-needs-ack monotonicity blockers. */
  badChannels: { marks: BadChannelMarkViewModel[]; blockedRemovals: IssueViewModel[] };
  /** Advisory recovery/cleanup notices (malformed collection / stale override / config corruption). */
  notices: RecoveryNoticeViewModel[];
  /** The authoritative export gate (open + reason + blockers + the export action). */
  export: ExportGateViewModel;
}

/** Whether a value is a non-null, non-array object. */
function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

// ──────────────────────────────────────────────────────────────────────────────────────────
// Shared structure: section/step order + labels (mirrors DayEditorStepper's SECTION_GROUPS +
// stepOrder so the view-model and the stepper read one truth). Behavioral is its own step; the
// Validation step carries the "N to fix" count.
// ──────────────────────────────────────────────────────────────────────────────────────────

/** The section stepper order + labels, matching the day-editor stepper. */
const STEP_ORDER: ReadonlyArray<{ key: string; label: string }> = [
  { key: 'overview', label: 'Overview' },
  { key: 'devices', label: 'Devices & Failed Channels' },
  { key: 'epochs', label: 'Tasks & Epochs' },
  { key: 'behavioral', label: 'Behavioral Events' },
  { key: 'validation', label: 'Validation' },
  { key: 'export', label: 'Export' },
];

/** The default active step the editor opens on. */
const DEFAULT_STEP = 'overview';

/** The accessible status label per step status (matches DayEditorSectionNav's getStatusLabel). */
const STEP_STATUS_LABEL: Record<StepStatus, string> = {
  valid: 'Complete',
  incomplete: 'Incomplete',
  error: 'Has errors',
  pending: 'Not started',
};

/**
 * The fail-closed step-status map the editor uses when the day/merge is unavailable (corrupt
 * animal config, day not yet resolvable): every data-entry step reads `incomplete` and `export`
 * reads `error`, so a day that cannot be merged can never read ready. Mirrors the stepper's
 * hand-written fallback literal.
 */
const FAIL_CLOSED_STEP_STATUS: Record<string, StepStatus> = {
  overview: 'incomplete',
  devices: 'incomplete',
  epochs: 'incomplete',
  behavioral: 'incomplete',
  validation: 'incomplete',
  export: 'error',
};

// Owner resolution (shell) lives in `resolveDayOwner` (state/workspaceSelectors) — the SAME selector
// the day-editor stepper resolves with, so a recovered/imported day opens under one owner truth.

// ──────────────────────────────────────────────────────────────────────────────────────────
// Shell / steps / breadcrumb.
// ──────────────────────────────────────────────────────────────────────────────────────────

/**
 * Build the breadcrumb trail (Workspace › Animal: <owner> › Day: <date>), matching the items the
 * Overview step assembles inline. The first two crumbs link; the last (current) does not.
 */
function buildBreadcrumb(ownerKey: string | null, dayDate: unknown): BreadcrumbViewModel {
  const owner = ownerKey ?? '';
  const dateLabel = typeof dayDate === 'string' ? dayDate : String(dayDate ?? '');
  return {
    items: [
      { label: 'Workspace', href: '#/workspace' },
      { label: `Animal: ${owner}`, href: `#/animal/${owner}/days` },
      { label: `Day: ${dateLabel}` },
    ],
  };
}

/**
 * Build the section stepper. Each step carries the domain {@link StepStatus} (keeping the 4-state
 * fidelity ✓/⚠/✗/○), its accessible status label, and the active flag; the Validation step also
 * carries the "N to fix" count (the number of blocking issues). Steps carry NO `href` — the section
 * nav is button/local-state (there is no `#/day/:id/:step` route), so a renderer navigates locally
 * using `step.key`.
 */
function buildSteps(
  stepStatus: Record<string, StepStatus>,
  toFixCount: number,
  activeStep: string
): StepViewModel[] {
  return STEP_ORDER.map(({ key, label }) => {
    const status = stepStatus[key] ?? 'incomplete';
    const step: StepViewModel = {
      key,
      label,
      status,
      statusLabel: STEP_STATUS_LABEL[status],
      active: key === activeStep,
    };
    // The Validation step shows its blocking-issue count (the same validator the export block uses),
    // and only when there is at least one — mirroring the nav's "N to fix" affordance.
    if (key === 'validation' && toFixCount > 0) step.issueCount = toFixCount;
    return step;
  });
}

/**
 * Map the step statuses + export gate onto the single {@link WorkflowSeverity} the page banner
 * renders (the severity invariant): any blocking error (export step in error, or a live error
 * issue) → `error`; export open (every prerequisite valid) → `ready`; otherwise (incomplete steps,
 * no live error) → `todo`.
 */
function overallSeverity(
  stepStatus: Record<string, StepStatus>,
  hasBlockingIssue: boolean
): WorkflowSeverity {
  if (hasBlockingIssue || stepStatus.export === 'error') return 'error';
  if (isExportEnabled(stepStatus)) return 'ready';
  return 'todo';
}

// ──────────────────────────────────────────────────────────────────────────────────────────
// Overview field sources (day / inherited / default / derived).
//
// The effective value comes from `mergeDayMetadata`'s output compared against the day override
// vs the animal value — the merge rules are never re-implemented here. `source` is then surfaced:
//   - set on the DAY → 'day';
//   - unset on the day but present on the ANIMAL → 'inherited' (inheritedFrom: 'animal');
//   - computed from owner + date → 'derived' (session_id, read-only);
//   - unset everywhere → 'default'.
// Reproduces the actual fields + help text the Overview step renders.
// ──────────────────────────────────────────────────────────────────────────────────────────

/** Stringify a primitive value for display; `undefined`/`null` become ''. */
function asDisplay(value: unknown): string {
  if (value === undefined || value === null) return '';
  return String(value);
}

/**
 * Build the Overview step's field view-models. Effective values are read from `merged` (the
 * `mergeDayMetadata` output) so the merge rules are authoritative; `source` distinguishes a
 * day-set value from an inherited animal value, a derived value, or an unset default.
 */
function buildOverviewFields(
  ownerKey: string | null,
  day: Record<string, unknown>,
  animal: Animal,
  merged: Record<string, unknown>
): FieldValueViewModel[] {
  const daySession = getDaySession(day);
  const subject = getAnimalSubject(animal);
  const experimenters = getAnimalExperimenters(animal);
  const experimenterNames = getExperimenterNames(animal);
  const dayDateKey = String((day as { date?: unknown }).date ?? '').replace(/-/g, '');

  const fields: FieldValueViewModel[] = [];

  // Session ID — read-only, DERIVED from animal id + date (the Overview help text states the
  // formula). The merge carries the canonical value; the source is always 'derived'.
  fields.push({
    fieldPath: 'session.session_id',
    label: 'Session ID',
    value: asDisplay(merged.session_id ?? daySession.session_id),
    source: 'derived',
    readOnly: true,
    helpText: `Auto-generated from animal ID and date: ${ownerKey ?? ''}_${dayDateKey}`,
  });

  // Session Description — a day fact (required). Set on the day → 'day'; else unset → 'default'.
  fields.push({
    fieldPath: 'session.session_description',
    label: 'Session Description',
    value: asDisplay(merged.session_description ?? daySession.session_description),
    source: daySession.session_description != null && daySession.session_description !== ''
      ? 'day'
      : 'default',
  });

  // Experiment Description — day value preferred, else inherited from the animal's
  // experiment_description (the Overview defaultValue fallback), else unset default.
  const dayExperimentDesc = daySession.experiment_description;
  const animalExperimentDesc = (animal as { experiment_description?: unknown }).experiment_description;
  fields.push(
    fieldFromDayOrAnimal({
      fieldPath: 'session.experiment_description',
      label: 'Experiment Description',
      effective: merged.experiment_description,
      dayValue: dayExperimentDesc,
      animalValue: animalExperimentDesc,
      helpText:
        'Describes the overall experiment. Required for export and written to the NWB file.',
    })
  );

  // Recording-day weight — the day value is exported when set; otherwise the animal baseline weight
  // is the inherited fallback; otherwise unset. The merge prefers the day weight over the baseline
  // and emits the effective value under `subject.weight` (the export nests weight in the subject).
  const dayWeight = daySession.weight;
  const animalWeight = subject.weight;
  const mergedSubject = isRecord(merged.subject) ? merged.subject : {};
  fields.push(
    fieldFromDayOrAnimal({
      fieldPath: 'session.weight',
      label: 'Recording-day weight (grams)',
      effective: mergedSubject.weight,
      dayValue: dayWeight,
      animalValue: animalWeight,
      fallbackValue:
        typeof animalWeight === 'number' ? `${animalWeight} (animal baseline)` : undefined,
      helpText:
        dayWeight !== undefined
          ? 'Weight recorded for this session — the value exported for this day.'
          : typeof animalWeight === 'number'
            ? `No weight set for this day — the animal baseline (${animalWeight} g) will be `
              + `exported as a fallback. Enter this session's weight to set it for this day.`
            : 'Enter the weight recorded for this session (exported for this day).',
    })
  );

  // Read-only inherited subject identity facts (always animal-owned / inherited on this surface).
  fields.push(readOnlyInherited('subject.subject_id', 'Subject ID', subject.subject_id));
  fields.push(readOnlyInherited('subject.sex', 'Sex', subject.sex));
  fields.push(readOnlyInherited('subject.genotype', 'Genotype', subject.genotype));

  // Read-only inherited experimenter facts.
  fields.push(
    readOnlyInherited('experimenters.experimenter_name', 'Names', experimenterNames.join(', '))
  );
  fields.push(readOnlyInherited('experimenters.lab', 'Lab', experimenters.lab));
  fields.push(
    readOnlyInherited('experimenters.institution', 'Institution', experimenters.institution)
  );

  return fields;
}

/**
 * Build a field whose effective value may be day-set or inherited from the animal: a present day
 * value is `source: 'day'`; else a present animal value is `source: 'inherited'`
 * (inheritedFrom: 'animal'); else `source: 'default'`. The effective `value` is taken from the
 * merge so the merge rules stay authoritative.
 */
function fieldFromDayOrAnimal(opts: {
  fieldPath: string;
  label: string;
  effective: unknown;
  dayValue: unknown;
  animalValue: unknown;
  fallbackValue?: string;
  helpText?: string;
}): FieldValueViewModel {
  const { fieldPath, label, effective, dayValue, animalValue, fallbackValue, helpText } = opts;
  const dayHas = dayValue !== undefined && dayValue !== null && dayValue !== '';
  const animalHas = animalValue !== undefined && animalValue !== null && animalValue !== '';

  let source: FieldValueViewModel['source'];
  if (dayHas) source = 'day';
  else if (animalHas) source = 'inherited';
  else source = 'default';

  const field: FieldValueViewModel = {
    fieldPath,
    label,
    value: asDisplay(effective),
    source,
  };
  if (source === 'inherited') field.inheritedFrom = 'animal';
  if (fallbackValue != null) field.fallbackValue = fallbackValue;
  if (helpText != null) field.helpText = helpText;
  return field;
}

/** A read-only inherited animal fact (subject identity / experimenters): always inherited. */
function readOnlyInherited(fieldPath: string, label: string, value: unknown): FieldValueViewModel {
  return {
    fieldPath,
    label,
    value: asDisplay(value),
    source: 'inherited',
    inheritedFrom: 'animal',
    readOnly: true,
  };
}

// ──────────────────────────────────────────────────────────────────────────────────────────
// Issues / repair / export gate / notices.
// ──────────────────────────────────────────────────────────────────────────────────────────

/**
 * Translate one validation issue into the classified, repair-routed {@link IssueViewModel}: its
 * severity (error/warning — info is filtered out by the caller), humanized message, schema path,
 * the ownership pattern + reach from `ownershipForIssue`, and the repair affordance from
 * `repairTargetForIssue` (a route + label — an animal-surface fix deep-links the owning setup tab;
 * a day-surface fix points at the owning step; a none-surface issue carries no repair).
 */
export function toIssueViewModel(
  issue: RepairableIssue,
  dayId: string,
  ownerKey: string | null
): IssueViewModel {
  const ownership = ownershipForIssue(issue);
  const target = repairTargetForIssue(issue);
  const category = workflowCategoryForIssue(issue);
  const path = issue.path || issue.instancePath;

  const vm: IssueViewModel = {
    severity: issue.severity === 'warning' ? 'warning' : 'error',
    message: humanizeValidationMessage(issue.message),
    ownership: ownership.pattern,
    // The ownership pattern's primary action + reach + category are the data IssueOwnershipHint and
    // the category-grouped list render, surfaced so the component re-derives nothing.
    ownershipAction: ownership.primaryAction,
    reachesBeyondDay: ownership.reachesBeyondDay,
    category,
    categoryLabel: WORKFLOW_CATEGORY_LABELS[category],
  };
  if (path != null) vm.fieldPath = path;

  const repair = buildRepairAction(issue, target, dayId, ownerKey);
  if (repair) {
    vm.repair = repair;
    // Repair display metadata mirrors RepairActionButton: an issue carrying a repairCommand is
    // executable (runs in place); otherwise it navigates to the owning surface, carrying the focus
    // anchor. `repairDedupKey` mirrors RepairActions.repairButtonKey so several issues sharing one
    // underlying fix collapse to a single button (every message still shows).
    vm.repairSurface = target.surface as 'animal' | 'day';
    vm.repairKind = issue.repairCommand != null ? 'execute' : 'navigate';
    vm.repairDedupKey = repairDedupKey(issue, target.surface, target.step);
    if (vm.repairKind === 'navigate') {
      const focus = issue.focusPath || issue.path;
      if (focus != null) vm.repairFocusPath = focus;
    }
  }
  return vm;
}

/**
 * The collapse key for an issue's repair BUTTON — mirrors `RepairActions.repairButtonKey` so the
 * view-model and the (now VM-driven) repair list dedup identically: `surface:step:focus:command`,
 * where the executable command (type + key/field) is part of the key so two issues sharing a
 * destination but carrying DIFFERENT repairCommands are not collapsed.
 */
function repairDedupKey(issue: RepairableIssue, surface: string, step: string | null): string {
  const cmd = issue.repairCommand as { type?: unknown; key?: unknown; field?: unknown } | undefined;
  const command = cmd ? `${String(cmd.type ?? '')}:${String(cmd.key ?? cmd.field ?? '')}` : '';
  return `${surface}:${step ?? ''}:${issue.focusPath || issue.path || ''}:${command}`;
}

/**
 * Build the repair affordance for an issue from its resolved target. A `none`-surface issue has no
 * editable in-app target (no action). An `animal`-surface fix is a deep-link to the owning setup
 * tab (with `?field=` when the issue carries a path). A `day`-surface fix routes to the owning step.
 */
function buildRepairAction(
  issue: RepairableIssue,
  target: { surface: string; step: string | null; label: string },
  dayId: string,
  ownerKey: string | null
): WorkflowAction | undefined {
  if (target.surface === 'none') return undefined;
  const focusPath = issue.focusPath || issue.path || issue.instancePath;

  // Executable repair takes precedence (mirrors RepairActionButton): an issue carrying a serializable
  // repairCommand PERFORMS the documented reset in place rather than navigating to a destination that
  // may render a blank empty state — this is what keeps the merge-error/raw-shape repairs (rebuild
  // configuration history, reset cameras) as executable buttons, NOT animal-deep-link navigations. The
  // command id is the repairCommand type (the page maps it to its existing onRepair handler for now);
  // the label names exactly what is reset (`actionLabel`) so a destructive reset is never ambiguous.
  if (issue.repairCommand != null) {
    const cmd = issue.repairCommand as { type?: unknown; key?: unknown; field?: unknown; acks?: unknown };
    // A repairCommand with no `type` can't be executed; render no button (the message + ownership hint
    // still show) rather than an inert one with an un-catalogued empty id. Real repairCommands always
    // carry a `type` from REPAIR_COMMAND_TYPES (a catalogued WorkflowCommandId), so the cast is sound.
    if (cmd.type == null) return undefined;
    const command: WorkflowCommand = { id: String(cmd.type) as WorkflowCommandId, target: { dayId } };
    const payload: Record<string, unknown> = {};
    if (cmd.key != null) payload.key = cmd.key;
    if (cmd.field != null) payload.field = cmd.field;
    // The bad-channel ack repair carries `acks` ({ [ntrodeId]: channels }); carry it so the command
    // layer reaches the `acknowledgeBadChannelRemovals` executor instead of dispatching it acks-less
    // (a silent no-op). Same off-export ack the in-grid Devices flow records.
    if (cmd.acks != null) payload.acks = cmd.acks;
    if (Object.keys(payload).length > 0) command.payload = payload;
    return { label: issue.actionLabel || target.label, command, intent: 'fix' };
  }

  if (target.surface === 'animal') {
    if (ownerKey == null) {
      // An animal repair with no resolved owner can't deep-link; keep the label, no href.
      return { label: target.label, intent: 'fix' };
    }
    const { tab } = animalSetupTabForFieldPath(focusPath);
    const base = `#/animal/${encodeURIComponent(ownerKey)}`;
    const href = focusPath
      ? `${base}/${tab}?field=${encodeURIComponent(focusPath)}`
      : `${base}/days`;
    return { label: target.label, href, intent: 'fix' };
  }

  // Day surface: the editor navigates to the owning step LOCALLY (the section nav is button/local
  // state, not a route) and focuses the field — so this is a navigate-day-section command, not an
  // href (there is no `#/day/:id/:step` route). The component maps the command id to its local
  // setCurrentStep + focus handler.
  const step = target.step ?? 'validation';
  const command: WorkflowCommand = {
    id: 'navigateDaySection',
    target: { dayId, section: step, ...(focusPath ? { fieldPath: focusPath } : {}) },
  };
  return { label: target.label, command, intent: 'fix' };
}

/**
 * Build the export gate (the authoritative AND-of-three the Export step gates on): blocked when any
 * error-severity issue remains, OR the step gate is closed, OR the day is not in its animal's index.
 * Reproduces the four blocked-reason branches (merge-error / unlinked-day / validation-errors /
 * incomplete-steps) and the blocking-step list (a prerequisite step not valid, owner = animal/day).
 */
/**
 * The readiness fields for an OPEN export gate, from the day's persisted lifecycle
 * (`lifecycleForValidDay`): the lifecycle variant, its short status label
 * (`DAY_LIFECYCLE_LABEL`), and the full readiness sentence the Validation summary shows. The prose
 * is read verbatim from the lifecycle label so it can never drift from the other day surfaces.
 */
function buildReadiness(dayState: unknown): {
  lifecycle: 'ready' | 'validated' | 'exported';
  lifecycleStatusLabel: string;
  readyMessage: string;
} {
  const lifecycle = lifecycleForValidDay(dayState) as 'ready' | 'validated' | 'exported';
  let readyMessage: string;
  switch (lifecycle) {
    case 'exported':
      readyMessage = `${DAY_LIFECYCLE_LABEL.exported} — all checks still pass. This day’s YAML has been downloaded.`;
      break;
    case 'validated':
      readyMessage = `${DAY_LIFECYCLE_LABEL.validated} — all checks pass. This validation has been saved.`;
      break;
    default:
      readyMessage = `${DAY_LIFECYCLE_LABEL.ready} — all checks pass.`;
  }
  return { lifecycle, lifecycleStatusLabel: DAY_LIFECYCLE_LABEL[lifecycle], readyMessage };
}

function buildExportGate(opts: {
  mergeFailed: boolean;
  dayId: string;
  ownerKey: string | null;
  stepStatus: Record<string, StepStatus>;
  errorIssues: IssueViewModel[];
  dayExportable: boolean;
  merged: Record<string, unknown>;
  dayState: unknown;
}): ExportGateViewModel {
  const { mergeFailed, dayId, ownerKey, stepStatus, errorIssues, dayExportable, merged, dayState } = opts;

  const gateOpen = isExportEnabled(stepStatus);
  const open = errorIssues.length === 0 && gateOpen && dayExportable && !mergeFailed;

  // The export action — disabled with a reason while blocked. The command id matches the page's
  // download intent; transient values (none here) would be merged by the component at call time.
  const action: WorkflowAction = {
    label: 'Download YAML',
    command: { id: 'exportDay', target: { dayId } },
    intent: 'review',
  };

  if (open) {
    // An exportable day's persisted lifecycle (live-ready / saved-validated / downloaded-exported),
    // surfaced so the readiness surfaces render the persisted-history word without re-deriving it.
    const { lifecycle, lifecycleStatusLabel, readyMessage } = buildReadiness(dayState);
    return {
      open: true,
      blockingIssues: [],
      blockingSteps: [],
      message: 'Ready to export.',
      action,
      lifecycle,
      lifecycleStatusLabel,
      readyMessage,
    };
  }

  // Resolve the single blocking reason in the same priority the Export step renders its banners:
  // merge error (config corrupt) → unlinked day → validation errors → incomplete prerequisite steps.
  let reason: ExportGateViewModel['reason'];
  let message: string;
  if (mergeFailed) {
    reason = 'merge-error';
    message =
      "This day's metadata could not be assembled — its animal's device configuration is missing "
      + 'or corrupt. Repair it in Animal Setup, then return.';
  } else if (!dayExportable) {
    reason = 'unlinked-day';
    message =
      `This recording day is not in ${ownerKey ?? 'the animal'}'s day list (it was recovered but `
      + "not re-linked), so it can't be exported yet. Re-link it with the \"Add to day list\" action "
      + 'on the validation summary, then return.';
  } else if (errorIssues.length > 0) {
    reason = 'validation-errors';
    message = `Resolve ${errorIssues.length} validation ${
      errorIssues.length === 1 ? 'error' : 'errors'
    } before exporting.`;
  } else {
    reason = 'incomplete-steps';
    message = 'Complete the required setup shown below before exporting.';
  }

  action.disabledReason = message;

  // Blocking prerequisite steps: only when there are NO validation errors (the Export step shows the
  // step blockers ONLY in that case). A Devices step that is 'incomplete' routes to the animal owner
  // (geometry is animal-owned); every other not-valid prerequisite stays on its day step.
  const blockingSteps =
    !mergeFailed && dayExportable && errorIssues.length === 0
      ? buildBlockingSteps(stepStatus, dayId, ownerKey, merged)
      : [];

  // Blocking issues are the error-severity issues (raw issues mapped to view-models for the gate).
  const blockingIssues = mergeFailed ? mapMergeErrorIssue() : errorIssues;

  return { open: false, reason, blockingIssues, blockingSteps, message, action };
}

/**
 * The prerequisite steps that are not yet valid (overview / devices / epochs / validation), as
 * {@link SectionViewModel}s with the owner-routed fix action. A Devices step that is 'incomplete'
 * is an animal-owned fix (electrode geometry); the Electrode Groups field hint is included when
 * groups exist (so the deep-link highlights them). Every other not-valid step stays on its day step.
 */
function buildBlockingSteps(
  stepStatus: Record<string, StepStatus>,
  dayId: string,
  ownerKey: string | null,
  merged: Record<string, unknown>
): SectionViewModel[] {
  const groups = Array.isArray(merged.electrode_groups) ? merged.electrode_groups : [];
  const PREREQS: ReadonlyArray<'overview' | 'devices' | 'epochs' | 'validation'> = [
    'overview',
    'devices',
    'epochs',
    'validation',
  ];

  return PREREQS.filter((step) => stepStatus[step] !== 'valid').map((step) => {
    const status: WorkflowSeverity = stepStatus[step] === 'error' ? 'error' : 'todo';
    const label = STEP_LABELS[step] || step;

    if (step === 'devices' && stepStatus.devices === 'incomplete') {
      // Geometry is animal-owned: route to the Electrode Groups tab. With groups present, carry the
      // electrode_groups field hint so the deep-link highlights them; with none, no field hint.
      const field = groups.length === 0 ? undefined : 'electrode_groups';
      const base = ownerKey != null ? `#/animal/${encodeURIComponent(ownerKey)}` : undefined;
      const href = base
        ? field
          ? `${base}/electrode-groups?field=${encodeURIComponent(field)}`
          : `${base}/electrode-groups`
        : undefined;
      const action: WorkflowAction = { label: 'Fix in Animal Setup', intent: 'fix' };
      if (href) action.href = href;
      return {
        key: step,
        label,
        status,
        summary: `${label} — fix in Animal Setup`,
        issueCount: 0,
        action,
      };
    }

    return {
      key: step,
      label,
      status,
      summary: `${label} — needs completion`,
      issueCount: 0,
      action: {
        label: `Fix in ${label}`,
        command: { id: 'navigateDaySection', target: { dayId, section: step } },
        intent: 'fix',
      },
    };
  });
}

/** The single blocking issue surfaced when the merge failed (a corrupt-config error). */
function mapMergeErrorIssue(): IssueViewModel[] {
  return [
    {
      severity: 'error',
      message:
        "This day's metadata could not be assembled — its animal's device configuration is "
        + 'missing or corrupt.',
      ownership: 'recovered_data',
      reachesBeyondDay: true,
    },
  ];
}

/**
 * Build the advisory recovery / cleanup notices: malformed day collections (a non-array tasks/etc.
 * the merge would launder to empty), a missing/corrupt animal config history or other malformed
 * animal collection, and stale/malformed/shadowing device overrides. Each carries a plain-data
 * repair command (not a severity-bearing issue — a fix-this-data prompt). Detection composes the
 * existing raw-shape (`validateRawDay` / `validateRawAnimal`) and device-override
 * (`classifyDeviceOverrides`) detectors — no inline shape-checking.
 */
function buildNotices(
  day: Record<string, unknown>,
  animal: Animal,
  dayId: string,
  ownerKey: string | null,
  mergedNtrodeIds: Set<string>
): RecoveryNoticeViewModel[] {
  const notices: RecoveryNoticeViewModel[] = [];

  // Malformed day collections (tasks / keywords / behavioral_events / … loaded as non-array, and a
  // malformed session record) — each repaired by resetting that collection.
  for (const issue of validateRawDay(day)) {
    notices.push({
      kind: 'malformed-collection',
      message: issue.message,
      repair: {
        id: issue.code === 'malformed_day_session' ? 'resetDaySession' : 'resetDayCollection',
        target: { dayId, fieldPath: issue.field },
      },
    });
  }

  // Malformed / missing animal collections (cameras, configurationHistory, data_acq_device) — each
  // repaired by the raw-shape issue's executable command (reset / rebuild). A missing config history
  // is the corruption that makes the merge throw, so it reads as a config-corruption notice.
  for (const issue of validateRawAnimal(animal)) {
    const command = issue.repairCommand as { type?: string } | undefined;
    notices.push({
      kind:
        issue.code === 'missing_configuration_history' ? 'badchannel-corruption' : 'malformed-collection',
      message: issue.message,
      repair: {
        // A raw-animal repairCommand carries a catalogued reset type (resetAnimalCameras /
        // resetDataAcqDevice / rebuildConfigurationHistory); the fallback is the catalogued no-op id.
        id: (command?.type ?? 'repairAnimalCollection') as WorkflowCommandId,
        target: { animalId: ownerKey ?? undefined, fieldPath: issue.field },
      },
    });
  }

  // Stale / malformed / shadowing device overrides — each removable via the device-override classifier.
  const overrides = classifyDeviceOverrides(day, mergedNtrodeIds);
  if (overrides.hasOverrideCleanup) {
    if (overrides.wholeOverridesMalformed) {
      notices.push(staleOverrideNotice(dayId, 'deviceOverrides', 'Remove corrupt device overrides'));
    }
    for (const key of overrides.staleOverrideKeys) {
      notices.push(
        staleOverrideNotice(
          dayId,
          `deviceOverrides.bad_channels.${key}`,
          `Remove stale failed-channel override for ntrode ${key}`
        )
      );
    }
    for (const key of overrides.corruptValueKeys) {
      notices.push(
        staleOverrideNotice(
          dayId,
          `deviceOverrides.bad_channels.${key}`,
          `Remove corrupt failed-channel override for ntrode ${key}`
        )
      );
    }
    if (overrides.badChannelContainerMalformed) {
      notices.push(
        staleOverrideNotice(
          dayId,
          'deviceOverrides.bad_channels',
          'Remove corrupt failed-channel override'
        )
      );
    }
    for (const key of overrides.presentGeometryKeys) {
      const isArray = Array.isArray(overrides.overridesRecord?.[key]);
      notices.push(
        staleOverrideNotice(
          dayId,
          `deviceOverrides.${key}`,
          isArray
            ? `Remove ${key} override (revert to saved configuration)`
            : `Remove corrupt ${key} override`
        )
      );
    }
  }

  return notices;
}

/** A stale-override recovery notice with its remove-override command. */
function staleOverrideNotice(
  dayId: string,
  fieldPath: string,
  message: string
): RecoveryNoticeViewModel {
  return {
    kind: 'stale-override',
    message,
    repair: { id: 'removeDeviceOverride', target: { dayId, fieldPath } },
  };
}

// ──────────────────────────────────────────────────────────────────────────────────────────
// Bad-channel monotonicity / ack.
//
// Per-channel mark state comes from the merged channel map (the effective bad set the export
// encodes); `priorBad` / `requiresAck` / `acked` come from the monotonicity domain (earlier
// same-config days' bad set vs the off-export ack store). The export-blocking
// `bad_channel_unfailed_without_ack` issues become blockedRemovals with an ack command.
// ──────────────────────────────────────────────────────────────────────────────────────────

/**
 * Build the per-channel bad-channel mark state from the merged channel map + the monotonicity
 * domain. For each ntrode row, every CONVERTER-VALID channel id gets a mark VM — the row's `map`
 * keys for a single-shank (or multi-shank later) row, but the full probe-wide range `0..N-1` for a
 * multi-shank group's FIRST row (the ids trodes_to_nwb honors, via `validBadChannelIds`), so a
 * prior-bad channel on another shank is not dropped. Each mark carries `marked` from the row's
 * effective `bad_channels`; `priorBad` from the earlier-same-config union (`priorBadChannels`);
 * `acked` from the day's off-export ack store; `requiresAck` when a marked-bad-on-an-earlier-day
 * channel is now un-marked and not yet acknowledged (the monotonicity exception).
 */
function buildBadChannelMarks(
  animal: Animal,
  day: Record<string, unknown>,
  animalDays: unknown[],
  merged: Record<string, unknown>
): BadChannelMarkViewModel[] {
  const ntrodeMap = Array.isArray(merged.ntrode_electrode_group_channel_map)
    ? (merged.ntrode_electrode_group_channel_map as Array<Record<string, unknown>>)
    : [];
  const electrodeGroups = Array.isArray(merged.electrode_groups)
    ? (merged.electrode_groups as Array<Record<string, unknown>>)
    : [];
  const prior = priorBadChannels(animal, day, animalDays);
  const acks = getBadChannelRemovalAcks(day);

  const marks: BadChannelMarkViewModel[] = [];
  for (const ntrode of ntrodeMap) {
    const ntrodeId = String(ntrode.ntrode_id);
    const marked = new Set(
      Array.isArray(ntrode.bad_channels) ? (ntrode.bad_channels as number[]) : []
    );
    const priorSet = new Set(Array.isArray(prior[ntrodeId]) ? prior[ntrodeId] : []);
    const ackedSet = new Set(Array.isArray(acks[ntrodeId]) ? acks[ntrodeId] : []);
    // The CONVERTER-VALID channel ids for this row: a multi-shank group's FIRST row carries
    // probe-local indices 0..N-1 spanning ALL shanks (the ids trodes_to_nwb honors), so a mark must
    // exist for each of them — NOT just this row's own `map` keys, which would drop prior-bad channels
    // on the other shanks and silently bypass the monotonicity un-mark gate (`requiresAck`/`priorBad`).
    // Single-shank (and multi-shank later) rows are row-local == map keys (byte-identical to before).
    const group = electrodeGroups.find((g) => g.id === ntrode.electrode_group_id);
    const groupNtrodes = ntrodeMap.filter((n) => n.electrode_group_id === ntrode.electrode_group_id);
    const isMultiShankFirstRow =
      isMultiShankGroup(group?.device_type as string, groupNtrodes.length) &&
      groupNtrodes[0]?.ntrode_id === ntrode.ntrode_id;
    const channels = validBadChannelIds({
      deviceType: group?.device_type as string,
      isMultiShankFirstRow,
      rowMap: (isRecord(ntrode.map) ? ntrode.map : {}) as Record<string, number>,
    }).sort((a, b) => a - b);

    for (const channel of channels) {
      const isMarked = marked.has(channel);
      const priorBad = priorSet.has(channel);
      const acked = ackedSet.has(channel);
      // A monotonicity exception: prior-bad, now un-marked, and not yet acknowledged.
      const requiresAck = priorBad && !isMarked && !acked;
      marks.push({ ntrodeId, channel, marked: isMarked, priorBad, requiresAck, acked });
    }
  }
  return marks;
}

/**
 * Build the bad-channel removal blockers: the export-blocking `bad_channel_unfailed_without_ack`
 * issues, each with an off-export acknowledge command (the in-context ack the day editor records).
 */
function buildBlockedRemovals(
  errorIssues: RepairableIssue[],
  dayId: string,
  ownerKey: string | null
): IssueViewModel[] {
  return errorIssues
    .filter((issue) => issue.code === 'bad_channel_unfailed_without_ack')
    .map((issue) => {
      const path = issue.path || issue.instancePath;
      const ownership = ownershipForIssue(issue);
      // Carry the off-export acks the command layer needs to clear THIS block straight from the
      // source issue's repair command (`{ [ntrodeId]: channels }` — the prior-bad channels the day
      // un-marked). The command adapter maps the singular id onto the `acknowledgeBadChannelRemovals`
      // executor with these acks, so the ack is recorded without re-deriving the regression.
      const acks = (issue.repairCommand as { acks?: unknown } | undefined)?.acks;
      const payload: Record<string, unknown> = {};
      if (path) payload.fieldPath = path;
      if (acks != null) payload.acks = acks;
      const vm: IssueViewModel = {
        severity: 'error',
        message: humanizeValidationMessage(issue.message),
        ownership: ownership.pattern,
        reachesBeyondDay: ownership.reachesBeyondDay,
        repair: {
          label: 'Acknowledge removal',
          command: {
            id: 'acknowledgeBadChannelRemoval',
            target: { dayId, animalId: ownerKey ?? undefined },
            ...(Object.keys(payload).length > 0 ? { payload } : {}),
          },
          intent: 'fix',
        },
      };
      if (path != null) vm.fieldPath = path;
      return vm;
    });
}

// ──────────────────────────────────────────────────────────────────────────────────────────
// The builder.
// ──────────────────────────────────────────────────────────────────────────────────────────

/** An empty editor view-model used by the shell early-returns (no day to render). */
function emptyShellViewModel(
  shell: DayEditorShellViewModel,
  dayId: string | null,
  ownerKey: string | null,
  dayDate: unknown
): DayEditorViewModel {
  const id = dayId ?? '';
  const steps = buildSteps(FAIL_CLOSED_STEP_STATUS, 0, DEFAULT_STEP);
  const action: WorkflowAction = {
    label: 'Download YAML',
    command: { id: 'exportDay', target: { dayId: id } },
    disabledReason: shell.message ?? 'This day cannot be opened.',
    intent: 'review',
  };
  return {
    shell,
    breadcrumb: buildBreadcrumb(ownerKey, dayDate),
    steps,
    overall: 'error',
    overview: { fields: [] },
    issues: [],
    badChannels: { marks: [], blockedRemovals: [] },
    notices: [],
    export: {
      open: false,
      reason: 'merge-error',
      blockingIssues: [],
      blockingSteps: [],
      message: shell.message ?? 'This day cannot be opened.',
      action,
    },
  };
}

/**
 * Build the DayEditor page view-model.
 *
 * @param workspace - `model.workspace` ({ animals, days }).
 * @param dayId - The recording-day store key to edit (from the URL); `null`/absent → the
 *   `no-day-id` shell state.
 * @param activeStep - The section the editor is currently showing (the page's local nav state).
 *   Defaults to the first step (the editor's initial state). The section nav is button/local-state,
 *   not routed, so the active step is a render-time input rather than something the VM derives.
 * @returns The page view-model — pure data, no React. Never throws: a corrupt animal config (which
 *   `mergeDayMetadata` throws on) is caught and surfaced as an `error`-severity, merge-error gate.
 */
export function buildDayEditorViewModel(
  workspace: unknown,
  dayId: string | null | undefined,
  activeStep: string = DEFAULT_STEP
): DayEditorViewModel {
  const ws = isRecord(workspace) ? workspace : {};
  const animalsMap: Record<string, unknown> = isRecord(ws.animals) ? ws.animals : {};
  const daysMap: Record<string, unknown> = isRecord(ws.days) ? ws.days : {};

  // ── Shell resolution ──
  if (dayId == null || dayId === '') {
    return emptyShellViewModel(
      { state: 'no-day-id', message: 'No day ID provided in URL' },
      null,
      null,
      undefined
    );
  }

  const dayRaw = daysMap[dayId];
  if (!isRecord(dayRaw)) {
    return emptyShellViewModel(
      { state: 'day-not-found', message: `Day not found: ${dayId}` },
      dayId,
      null,
      undefined
    );
  }
  const day = dayRaw;

  const { ownerKey, animal } = resolveDayOwner(workspace, dayId);
  if (!animal) {
    return emptyShellViewModel(
      { state: 'animal-not-found', message: `Animal not found: ${describeOwner(day.animalId)}` },
      dayId,
      ownerKey,
      day.date
    );
  }

  const shell: DayEditorShellViewModel = { state: 'ok' };
  if (ownerKey != null) shell.ownerKey = ownerKey;

  // ── Merge (fail-closed on corrupt config) ──
  let merged: Record<string, unknown> = {};
  let mergeFailed = false;
  try {
    merged = mergeDayMetadata(animal as Animal, day as unknown as Day);
  } catch {
    // mergeDayMetadata throws BY DESIGN on a malformed animal (missing/non-array
    // configurationHistory). Tolerate it: an empty merged fails validation and the gate fails
    // closed, exactly as the day editor + export step do — never propagate the throw.
    mergeFailed = true;
    merged = {};
  }

  // The animal's day records (date-sorted), the cross-day context the bad-channel monotonicity
  // block reads. `getAnimalDays` returns [] for a missing/unresolved owner.
  const animalDays =
    ownerKey != null ? getAnimalDays({ animals: animalsMap, days: daysMap }, ownerKey) : [];

  // ── Step status + overall ──
  const stepStatus: Record<string, StepStatus> = mergeFailed
    ? { ...FAIL_CLOSED_STEP_STATUS }
    : computeStepStatus(day, merged, animal, animalDays);

  // The authoritative issue list (the same one the export gate + the rendered repair lists share).
  // On a merge failure, validate the empty merged model so the raw-shape animal issue still surfaces.
  const rawIssues = validateDay(
    day as unknown as Record<string, unknown>,
    merged,
    animal,
    animalDays
  );
  const rawErrorIssues = rawIssues.filter((issue) => issue.severity === 'error');
  // The Validation step's "N to fix" scent matches the stepper, which shows NO count when the merge
  // failed (it cannot compute a trustworthy readiness) — so suppress the count on the merge-failed
  // path even though the raw-shape animal issue is still surfaced in `issues`/`notices`.
  const toFixCount = mergeFailed ? 0 : rawErrorIssues.length;

  const steps = buildSteps(stepStatus, toFixCount, activeStep);

  // ── Issues ── error + warning issues only (info is dropped from the surfaced issue list).
  const issues: IssueViewModel[] = rawIssues
    .filter((issue) => issue.severity === 'error' || issue.severity === 'warning')
    .map((issue) => toIssueViewModel(issue, dayId, ownerKey));
  const errorIssues = issues.filter((issue) => issue.severity === 'error');

  const overall = overallSeverity(stepStatus, errorIssues.length > 0 || mergeFailed);

  // ── Overview fields ── empty on a merge failure (no effective values to show).
  const overviewFields = mergeFailed
    ? []
    : buildOverviewFields(ownerKey, day, animal as Animal, merged);

  // ── Bad channels ──
  const marks = mergeFailed ? [] : buildBadChannelMarks(animal as Animal, day, animalDays, merged);
  const blockedRemovals = buildBlockedRemovals(rawErrorIssues, dayId, ownerKey);

  // ── Notices ── the merged ntrode-id set is the stale-key detection device-override needs.
  const mergedNtrodeIds = new Set(
    (Array.isArray(merged.ntrode_electrode_group_channel_map)
      ? (merged.ntrode_electrode_group_channel_map as Array<Record<string, unknown>>)
      : []
    ).map((n) => String(n.ntrode_id))
  );
  const notices = buildNotices(day, animal as Animal, dayId, ownerKey, mergedNtrodeIds);

  // ── Export gate ── the day-in-index policy: a day must be in its animal's index to export.
  const dayExportable = getAnimalDayIds(animal).includes(
    (day as { id?: unknown }).id as string
  );
  const exportGate = buildExportGate({
    mergeFailed,
    dayId,
    ownerKey,
    stepStatus,
    errorIssues,
    dayExportable,
    merged,
    dayState: (day as { state?: unknown }).state,
  });

  return {
    shell,
    breadcrumb: buildBreadcrumb(ownerKey, day.date),
    steps,
    overall,
    overview: { fields: overviewFields },
    issues,
    badChannels: { marks, blockedRemovals },
    notices,
    export: exportGate,
  };
}
