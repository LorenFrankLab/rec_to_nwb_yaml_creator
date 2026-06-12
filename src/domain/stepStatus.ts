/**
 * @fileoverview Per-step status computation and the export gate.
 *
 * Computes the Day-Editor step statuses ({@link computeStepStatus} and the per-step helpers)
 * and the export-readiness gate from the authoritative issue list
 * ({@link module:domain/dayValidationComposer}'s `validateDay`). Groups issues by owning step
 * ({@link groupErrorsByStep}, via {@link module:domain/repairRouting}'s `stepIdForIssue`).
 * Extracted from `domain/validation.js` (Phase 9a) with no behavior change.
 */

import { stepIdForIssue } from './repairRouting';
import type { RepairableIssue } from './repairRouting';
import { validateDay } from './dayValidationComposer';

/** A per-step badge status. */
export type StepStatus = 'valid' | 'incomplete' | 'error' | 'pending';

/** The minimal session fields the overview completeness check reads. */
interface SessionLike {
  session_id?: unknown;
  session_description?: unknown;
}

/** The day fields the step-status helpers read (tolerant — raw-shape corruption is detected here). */
interface StepStatusDay {
  session?: SessionLike;
  tasks?: unknown;
  taskInstances?: unknown;
  behavioral_events?: unknown;
}

/** The merged-model collections the step-status helpers read (resolved, post-merge arrays). */
interface StepStatusMergedDay {
  tasks?: unknown;
  electrode_groups?: Array<{ id?: unknown }>;
  ntrode_electrode_group_channel_map?: Array<{
    electrode_group_id?: unknown;
    map?: unknown;
    bad_channels?: unknown;
  }>;
}

/** The per-step status map `computeStepStatus` returns (the export gate reads `export`). */
interface StepStatusMap {
  overview: StepStatus;
  devices: StepStatus;
  epochs: StepStatus;
  behavioral: StepStatus;
  validation: StepStatus;
  export: StepStatus;
}

/**
 * The closed vocabulary of per-step statuses `computeStepStatus` produces. Named + frozen so the
 * gate ({@link module:domain/stepGate}) and the workflow-status helper consume the same tokens
 * instead of re-typing string literals (which can drift). `'pending'` is reserved for steps awaiting
 * async work.
 */
export const STEP_STATUS = Object.freeze({
  VALID: 'valid',
  INCOMPLETE: 'incomplete',
  ERROR: 'error',
  PENDING: 'pending',
} as const);

/**
 * Validates entire day and computes step status.
 *
 * @param day - The day record.
 * @param mergedDay - Merged animal + day metadata.
 * @param animal - The owning animal (optional); folds raw animal-shape issues
 *   (e.g. a non-array `cameras`) into the export gate.
 * @param animalDays - The animal's day records (optional); enables the bad-channel
 *   monotonicity export-block. Empty/omitted → no cross-day comparison (back-compat).
 * @returns Status map per step.
 */
export function computeStepStatus(
  day: StepStatusDay,
  mergedDay: StepStatusMergedDay,
  animal?: unknown,
  animalDays: unknown[] = []
): StepStatusMap {
  // `animal as object` bridges validateDay's `@param {object}` JSDoc; the composer guards a
  // missing/corrupt animal internally, so the cast is behavior-neutral.
  const issues = validateDay(day, mergedDay, animal as object, animalDays);

  // Group errors by step
  const errorsByStep = groupErrorsByStep(issues);

  return {
    overview: getStepStatus(errorsByStep.overview, day.session),
    devices: computeDevicesStatus(day, mergedDay, errorsByStep.devices),
    epochs: computeEpochsStatus(day, errorsByStep.epochs, mergedDay),
    behavioral: computeBehavioralStatus(day, errorsByStep.behavioral),
    // (errorsByStep.epochs is scoped to task-path errors inside computeEpochsStatus)
    // The validation step owns the catch-all bucket (anything not routed to
    // overview/devices/epochs). It is in error only when that bucket has an
    // error-severity issue; an empty/clean catch-all reports valid so it stops
    // permanently disabling Export.
    validation: errorsByStep.validation.some(i => i.severity === 'error') ? STEP_STATUS.ERROR : STEP_STATUS.VALID,
    export: issues.filter(i => i.severity === 'error').length === 0 ? STEP_STATUS.VALID : STEP_STATUS.ERROR,
  };
}

/**
 * Computes the Epochs (Tasks & Epochs) step status from the day's tasks and the
 * task-level schema/rules errors.
 *
 * The status is driven by the day's **tasks**, with two exceptions that must badge
 * 'error' because their repair control renders on THIS step: a non-array `tasks`, and any
 * `malformed_day_collection` raw-shape error on an epochs-owned collection. Otherwise we
 * narrow the `epochs` error group to task-path errors (path references `tasks[…]`): the
 * group also collects behavioral-event and associated-file completeness concerns owned by
 * the later Validation step, not the Tasks & Epochs data-entry step.
 *
 * Severity policy: data entry is non-blocking except for blank schema-required
 * task fields (and epoch end <= start, which is blocked at the modal Save so it
 * cannot persist). Empty cameras, missing-camera references, no-epoch tasks, and
 * epoch overlaps are warnings/info and never mark the step in error.
 *
 * @param day - Day record (raw-shape guards read `tasks` / `taskInstances`).
 * @param epochErrors - Issues grouped into the `epochs` step.
 * @param mergedDay - The merged metadata; its resolved `tasks` are the EFFECTIVE task
 *   count (a catalog day removes inline `day.tasks` and stores `taskInstances`, so reading the raw
 *   day would wrongly report 'incomplete'). Falls back to raw `day.tasks` when absent.
 * @returns
 *   - `'incomplete'`: no tasks yet.
 *   - `'error'`: a task has an error-severity issue (e.g., a blank required field).
 *   - `'valid'`: at least one task and no task-level error-severity issues.
 */
export function computeEpochsStatus(
  day: StepStatusDay | null | undefined,
  epochErrors: RepairableIssue[],
  mergedDay?: StepStatusMergedDay | null
): StepStatus {
  // A raw-shape corruption (`malformed_day_collection`) on any epochs-owned collection
  // (tasks / associated_files / associated_video_files / fs_gui_yamls — behavioral_events is now
  // owned by the Behavioral Events step) is a blocking error whose reset control renders ON this
  // step — so the step badge must
  // read 'error', not a false 'incomplete'/'valid'. This generalizes the non-array-`tasks`
  // guard to the whole raw-shape family so the badge can't disagree with the reset notice.
  // The direct `day.tasks` check also covers a standalone call whose bucket isn't populated.
  if (day?.tasks != null && !Array.isArray(day.tasks)) return 'error';
  // A corrupt non-array `taskInstances` is an epochs-owned raw-shape error too (its reset renders on
  // this step) — guard it directly so a standalone badge can't disagree with the reset notice.
  if (day?.taskInstances != null && !Array.isArray(day.taskInstances)) return 'error';
  if ((epochErrors || []).some((i) => i.severity === 'error' && i.code === 'malformed_day_collection')) {
    return 'error';
  }
  // A task-level error BADGES the step 'error' even when the resolved tasks are empty: a day whose
  // only instance is a dangling_task_type_ref resolves to NO tasks (the ref is dropped) but needs
  // REPAIR, not "add a task" — so check errors BEFORE the empty-tasks 'incomplete' return.
  const hasTaskError = (epochErrors || []).some(
    (issue) => issue.severity === 'error' && (issue.path || '').includes('task')
  );
  if (hasTaskError) return 'error';

  // The EFFECTIVE tasks: a catalog day resolves `taskInstances` → inline tasks in the merge, and
  // removes raw `day.tasks`, so reading the raw day would falsely report 'incomplete'. Prefer the
  // merged (resolved) tasks; fall back to raw `day.tasks` for a standalone call without the merge.
  const tasks = Array.isArray(mergedDay?.tasks)
    ? mergedDay.tasks
    : Array.isArray(day?.tasks)
      ? day.tasks
      : [];
  return tasks.length === 0 ? 'incomplete' : 'valid';
}

/**
 * Compute the Behavioral Events (DIO) step badge.
 *
 * Behavioral events are OPTIONAL — a day with none is valid (not "incomplete"), so this step is
 * never blocked for being empty. It badges `'error'` only when its own bucket holds an
 * error-severity issue (a duplicate name (Rule 14) or duplicate channel (Rule 17)), or when
 * `day.behavioral_events` is a corrupt non-array whose reset control renders here.
 *
 * @param day - Day record (reads `behavioral_events`).
 * @param behavioralErrors - Issues grouped into the `behavioral` step.
 * @returns `'error'` | `'valid'`.
 */
export function computeBehavioralStatus(
  day: StepStatusDay | null | undefined,
  behavioralErrors: RepairableIssue[]
): StepStatus {
  if (day?.behavioral_events != null && !Array.isArray(day.behavioral_events)) return 'error';
  return (behavioralErrors || []).some((issue) => issue.severity === 'error')
    ? STEP_STATUS.ERROR
    : STEP_STATUS.VALID;
}

/**
 * Computes the Devices step status from the merged/effective electrode configuration
 * the export will encode. Mirrors the per-group health logic in
 * DevicesStep (getGroupStatus + the missing-channel-map branch) so the stepper and
 * the step content agree.
 *
 * @param day - Day record (retained for call-site compatibility).
 * @param mergedDay - Merged metadata (reads electrode_groups +
 *   ntrode_electrode_group_channel_map, including effective ntrode.bad_channels).
 * @param deviceErrors - Issues routed to the Devices step (from
 *   `groupErrorsByStep`). A DAY-owned error here (e.g. a stale/malformed device override,
 *   an out-of-range day bad channel) badges the step 'error' because its repair control
 *   renders ON this step — consistent with how `computeEpochsStatus`/`getStepStatus` badge
 *   their own step's repairable errors. ANIMAL-owned device schema errors routed here for
 *   grouping are deliberately NOT folded in: they are not day-repairable, and the export
 *   gate (not the badge) catches them — the documented "the gate is not redundant with the
 *   prereq steps" contract.
 * @returns
 *   - `'incomplete'`: no electrode groups, or any group has no channel mapping.
 *   - `'error'`: a day-owned Devices error, or any group has all its channels marked bad.
 *   - `'valid'`: otherwise (bad-channel warnings are non-blocking).
 */
export function computeDevicesStatus(
  day: unknown,
  mergedDay: StepStatusMergedDay | null | undefined,
  deviceErrors: RepairableIssue[] = []
): StepStatus {
  // A day-owned, Devices-step-repairable error must badge the step 'error' so a green badge
  // never sits beside its own blocking repair control. (Animal-owned errors excluded — see
  // the param doc / gate-non-redundancy contract.)
  if ((deviceErrors || []).some((i) => i.severity === 'error' && i.ownerSurface === 'day')) {
    return 'error';
  }

  const groups = mergedDay?.electrode_groups || [];
  const ntrodeMap = mergedDay?.ntrode_electrode_group_channel_map || [];

  if (groups.length === 0) return 'incomplete';

  let anyGroupAllBad = false;

  for (const group of groups) {
    // electrode_group_id and group ids are integers end-to-end (schema contract).
    const ntrodes = ntrodeMap.filter((n) => n.electrode_group_id === group.id);

    // A group with no channel mapping is a data-completeness problem (corruption
    // branch in DevicesStep), surfaced as incomplete rather than a hard error.
    if (ntrodes.length === 0) return 'incomplete';

    let totalChannels = 0;
    let totalBadChannels = 0;
    for (const ntrode of ntrodes) {
      totalChannels += Object.keys(ntrode.map || {}).length;
      totalBadChannels += (Array.isArray(ntrode.bad_channels) ? ntrode.bad_channels : []).length;
    }
    if (totalChannels > 0 && totalBadChannels === totalChannels) {
      anyGroupAllBad = true;
    }
  }

  return anyGroupAllBad ? 'error' : 'valid';
}

/**
 * Determine step status from errors and data completeness.
 *
 * @param errors - Validation issues for this step
 * @param data - Step data to check completeness
 */
function getStepStatus(errors: RepairableIssue[], data: SessionLike | null | undefined): StepStatus {
  // A raw-shape corruption (`malformed_day_collection`, e.g. a non-array `keywords`) is a
  // blocking error whose reset control renders on this step — it must badge 'error' even
  // when other required fields are still blank, otherwise the corruption hides behind
  // 'incomplete'. (Plain missing-required-field errors keep the softer 'incomplete' below.)
  if ((errors || []).some((e) => e.severity === 'error' && e.code === 'malformed_day_collection')) {
    return 'error';
  }

  // Check completeness first - if data is incomplete, treat as incomplete
  // rather than error (even if validation would fail)
  if (!data || !isStepComplete(data)) {
    // Missing required data
    return 'incomplete';
  }

  if (errors && errors.length > 0) {
    // Has validation errors (but data is present)
    return 'error';
  }

  // All good
  return 'valid';
}

/**
 * Check if overview step has required fields.
 *
 * @param sessionData - Session metadata
 * @returns True if all required fields present
 */
function isStepComplete(sessionData: SessionLike | null | undefined): boolean {
  return !!(
    sessionData &&
    sessionData.session_id &&
    sessionData.session_description
  );
}

/**
 * Group validation errors by which step they belong to.
 *
 * @param errors - All validation issues
 * @returns Errors grouped by step
 *
 * @example
 * const grouped = groupErrorsByStep(allErrors);
 * console.log(`Overview has ${grouped.overview.length} errors`);
 */
export function groupErrorsByStep(errors: RepairableIssue[]): Record<string, RepairableIssue[]> {
  const groups: Record<string, RepairableIssue[]> = {
    overview: [],
    devices: [],
    epochs: [],
    behavioral: [],
    validation: [],
    export: [],
  };

  errors.forEach(error => {
    groups[stepIdForIssue(error)].push(error);
  });

  return groups;
}
