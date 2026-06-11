/**
 * @fileoverview Pure catalog-level task validation (Phase 8B rehearsal — NOT wired into the live
 * pipeline).
 *
 * Validates the task-type catalog shape (`animal.taskTypes` + `day.taskInstances` /
 * `day.cameras_used` / `day.state.taskDefinitionReconciliations`) rather than the inline `day.tasks`
 * the running app still validates. Four checks, each reconciling with — never duplicating or
 * contradicting — the existing inline-task rules (`rulesValidation.js`):
 *
 *  - `duplicate_task_type_name` — catalog-level `task_name` uniqueness. The catalog makes the
 *    Spyglass identity collision the live `divergent_task_identity` rule flags on EXPORTED `tasks[]`
 *    structurally impossible at the source; this rule guards the source.
 *  - `dangling_task_type_ref` — a day instance referencing a missing `TaskType` (mirrors
 *    `dangling_camera_ref` / `dangling_electrode_group_ref`).
 *  - `task_camera_not_used` — a `TaskType.camera_id` the referencing day's explicit `cameras_used`
 *    checklist omits (the catalog's one new divergence risk per C3); surfaced, never silently emitted.
 *  - `task_definition_reconciled` — a migration-time normalization recorded on the day, surfaced for
 *    review (the original values are preserved, not dropped).
 *
 * **Phase 8B: exercised only by catalog-shaped fixtures.** Phase 8C wires these into the validation
 * pipeline and the repair-surface registry. Pure and dependency-free.
 */

/** A validation issue in the shape `rulesValidation.js` emits (kept local — not yet wired live). */
export interface CatalogValidationIssue {
  /** Section path for the issue. */
  path: string;
  /** Offending field. */
  field: string;
  /** Editor step the repair lives on. */
  step: string;
  /** Short repair call-to-action. */
  actionLabel: string;
  /** Stable issue code. */
  code: string;
  /** Whether the fix lives on the animal or the day. */
  repairSurface: 'animal' | 'day' | 'none';
  /** Issue severity. */
  severity: 'error' | 'warning';
  /** Human-readable explanation. */
  message: string;
}

/** Whether `value` is a plain object record (not null, not an array). */
function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

/** A usable task name / dedup key: a non-empty, non-whitespace string. */
function usableName(value: unknown): value is string {
  return typeof value === 'string' && value.trim() !== '';
}

/** Normalize an id to a comparison key so numeric `1` and string `"1"` match (corrupt imports). */
function idKey(value: unknown): string | null {
  return value === null || value === undefined ? null : String(value);
}

/**
 * The `task_name`s shared by more than one task type (the Spyglass identity collision), each
 * reported once in first-occurrence order. Blank/missing names are skipped (they cannot be a
 * dataset-unique identity; the migrator gives each its own type). Shape-tolerant.
 *
 * @param taskTypes - The animal's task-type catalog.
 * @returns Duplicated task names.
 */
export function duplicateTaskTypeNames(taskTypes: unknown): string[] {
  const counts = new Map<string, number>();
  for (const type of (Array.isArray(taskTypes) ? taskTypes : []).filter(isPlainRecord)) {
    const name = type.task_name;
    if (usableName(name)) counts.set(name, (counts.get(name) ?? 0) + 1);
  }
  return [...counts.entries()].filter(([, count]) => count > 1).map(([name]) => name);
}

/**
 * The `taskTypeId`s a day's instances reference that resolve to no task type, each reported once in
 * first-occurrence order. A dangling reference would silently drop the task downstream. Shape-tolerant.
 *
 * @param taskTypes - The animal's task-type catalog.
 * @param taskInstances - A day's ordered instances.
 * @returns Unresolved task type ids.
 */
export function danglingTaskInstanceRefs(taskTypes: unknown, taskInstances: unknown): string[] {
  const known = new Set<string>();
  for (const type of (Array.isArray(taskTypes) ? taskTypes : []).filter(isPlainRecord)) {
    if (typeof type.id === 'string') known.add(type.id);
  }
  const dangling: string[] = [];
  const seen = new Set<string>();
  for (const instance of (Array.isArray(taskInstances) ? taskInstances : []).filter(isPlainRecord)) {
    const ref = instance.taskTypeId;
    if (typeof ref !== 'string' || known.has(ref) || seen.has(ref)) continue;
    seen.add(ref);
    dangling.push(ref);
  }
  return dangling;
}

/** A camera a day's task type references that the day's explicit `cameras_used` checklist omits. */
export interface TaskCameraNotUsedFinding {
  /** The referencing task type's id. */
  taskTypeId: string;
  /** The referencing task type's name. */
  task_name: string;
  /** The camera id that is not in `cameras_used`. */
  camera_id: number | string;
}

/**
 * Cameras referenced by the task types a day ran but absent from the day's EXPLICIT `cameras_used`
 * checklist. Has no opinion when the day declares no checklist (absent or empty `cameras_used`) — the
 * checklist is an additive, opt-in day-level set (mirrors {@link module:state/cameraUsage}), so
 * existing/migrated data without it is never flagged. Each (task type, camera) is reported once.
 *
 * @param taskTypes - The animal's task-type catalog.
 * @param day - A recording day (its `taskInstances` and `cameras_used`).
 * @returns Findings for each referenced-but-unmarked camera.
 */
export function taskTypeCamerasNotUsed(taskTypes: unknown, day: unknown): TaskCameraNotUsedFinding[] {
  const camerasUsed = isPlainRecord(day) ? day.cameras_used : undefined;
  // Only enforce against an explicit, non-empty checklist.
  if (!Array.isArray(camerasUsed) || camerasUsed.length === 0) return [];
  const usedKeys = new Set(camerasUsed.map(idKey).filter((key): key is string => key !== null));

  const typeById = new Map<string, Record<string, unknown>>();
  for (const type of (Array.isArray(taskTypes) ? taskTypes : []).filter(isPlainRecord)) {
    if (typeof type.id === 'string') typeById.set(type.id, type);
  }

  const instances = isPlainRecord(day) && Array.isArray(day.taskInstances) ? day.taskInstances : [];
  const findings: TaskCameraNotUsedFinding[] = [];
  const seen = new Set<string>();
  for (const instance of instances.filter(isPlainRecord)) {
    const ref = instance.taskTypeId;
    if (typeof ref !== 'string') continue;
    const type = typeById.get(ref);
    if (!type) continue;
    const cameras = Array.isArray(type.camera_id) ? type.camera_id : [];
    const name = typeof type.task_name === 'string' ? type.task_name : '';
    for (const camera of cameras) {
      const key = idKey(camera);
      if (key === null || usedKeys.has(key)) continue;
      const dedup = `${ref}:${key}`;
      if (seen.has(dedup)) continue;
      seen.add(dedup);
      findings.push({ taskTypeId: ref, task_name: name, camera_id: camera as number | string });
    }
  }
  return findings;
}

/**
 * Animal-routed catalog issues: catalog-level `task_name` uniqueness. (The duplicate is an animal
 * catalog problem, so the repair surface is the animal Task-Types view.)
 *
 * @param animal - The animal record (its `taskTypes`).
 * @returns Issues in the standard validation shape.
 */
export function animalTaskCatalogIssues(animal: unknown): CatalogValidationIssue[] {
  const taskTypes = isPlainRecord(animal) ? animal.taskTypes : undefined;
  return duplicateTaskTypeNames(taskTypes).map((name) => ({
    path: 'taskTypes',
    field: 'task_name',
    step: 'tasks',
    actionLabel: 'Use a unique task name',
    code: 'duplicate_task_type_name',
    repairSurface: 'animal',
    severity: 'error',
    message:
      `Task type "${name}" is defined more than once. Each task type must have a unique name — ` +
      `Spyglass treats the name as an identity and rejects a reused name with different metadata.`,
  }));
}

/**
 * Day-routed catalog issues: dangling task-type references, cameras referenced but not marked used,
 * and migration-time task-definition reconciliations recorded on the day.
 *
 * @param animal - The owning animal (its `taskTypes`).
 * @param day - The recording day (`taskInstances`, `cameras_used`, `state.taskDefinitionReconciliations`).
 * @returns Issues in the standard validation shape.
 */
export function dayTaskCatalogIssues(animal: unknown, day: unknown): CatalogValidationIssue[] {
  const issues: CatalogValidationIssue[] = [];
  const taskTypes = isPlainRecord(animal) ? animal.taskTypes : undefined;
  const taskInstances = isPlainRecord(day) ? day.taskInstances : undefined;

  for (const ref of danglingTaskInstanceRefs(taskTypes, taskInstances)) {
    issues.push({
      path: 'taskInstances',
      field: 'taskTypeId',
      step: 'tasks',
      actionLabel: 'Fix task selection',
      code: 'dangling_task_type_ref',
      repairSurface: 'day',
      severity: 'error',
      message:
        `This day references task type "${ref}", which the animal's catalog no longer defines. ` +
        `Re-pick the task or restore the task type.`,
    });
  }

  for (const finding of taskTypeCamerasNotUsed(taskTypes, day)) {
    issues.push({
      path: 'taskInstances',
      field: 'camera_id',
      step: 'tasks',
      actionLabel: 'Mark camera used',
      code: 'task_camera_not_used',
      repairSurface: 'day',
      severity: 'error',
      message:
        `Task type "${finding.task_name}" uses camera ${finding.camera_id}, which this day's ` +
        `cameras-used list omits. Add the camera to this day or drop it from the task type.`,
    });
  }

  const reconciliations =
    isPlainRecord(day) && isPlainRecord(day.state) && Array.isArray(day.state.taskDefinitionReconciliations)
      ? day.state.taskDefinitionReconciliations
      : [];
  for (const record of reconciliations.filter(isPlainRecord)) {
    const name = typeof record.task_name === 'string' ? record.task_name : '';
    issues.push({
      path: 'taskInstances',
      field: 'task_name',
      step: 'tasks',
      actionLabel: 'Review task definition',
      code: 'task_definition_reconciled',
      repairSurface: 'day',
      severity: 'warning',
      message:
        `Task "${name}" was normalized to the shared task-type definition during upgrade. ` +
        `Review the original vs. canonical values and confirm the merged definition is correct.`,
    });
  }

  return issues;
}
