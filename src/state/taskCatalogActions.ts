/**
 * @fileoverview Pure mutation helpers for the task-type catalog (Phase 8C).
 *
 * The catalog is persisted through the SAME store path as the camera catalog —
 * `updateAnimal(animalId, { taskTypes })` and `updateDay(dayId, { taskInstances })` — so no dedicated
 * store actions are added and the pinned `store-public-api` contract is unchanged. These helpers
 * compute the NEXT array immutably, encapsulating the catalog invariants the camera catalog does not
 * have: unique `TaskType.id` generation, id-preserving updates, and ordered instance edits. The
 * Animal Task-Types and Day pick/order containers compose them, exactly as `CamerasContainer` composes
 * its inline `cameras.map(...)` math — only here the math is shared and tested.
 *
 * Deleting a task type does NOT cascade into day `taskInstances` (mirrors deleting a referenced
 * camera): a now-dangling reference is surfaced by the `dangling_task_type_ref` validation rule for
 * the user to repair, never silently rewritten.
 *
 * Pure and dependency-free; every helper is total and shape-tolerant.
 */

import type { TaskType, TaskInstance } from './workspaceTypes';

/** The editable definition fields of a task type (everything except the helper-owned `id`). */
export interface TaskTypeDefinitionInput {
  /** Task name — the catalog dedup key. */
  task_name: string;
  /** Task description. */
  task_description: string;
  /** Environment description. */
  task_environment?: string;
  /** Camera IDs used by the task type. */
  camera_id?: Array<number | string>;
}

/** Coerce to an array (a non-array degrades to empty), never mutating the input. */
function asArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

/** Whether `value` is a plain object record (not null, not an array). */
function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

const ID_PATTERN = /^tasktype-(\d+)$/;

/**
 * The next unique `tasktype-N` id for a catalog: `max(existing N) + 1` (0 when empty). Never reuses a
 * deleted index, so an id is stable for the life of a type even as siblings are added/removed.
 *
 * @param taskTypes - The existing task-type catalog.
 * @returns A fresh, collision-free task-type id.
 */
export function nextTaskTypeId(taskTypes: unknown): string {
  let max = -1;
  for (const type of asArray<unknown>(taskTypes)) {
    if (!isPlainRecord(type) || typeof type.id !== 'string') continue;
    const match = ID_PATTERN.exec(type.id);
    if (match) max = Math.max(max, Number(match[1]));
  }
  return `tasktype-${max + 1}`;
}

/** Build a TaskType from a definition, stripping any caller-supplied `id` (the helper owns ids). */
function buildTaskType(id: string, definition: TaskTypeDefinitionInput): TaskType {
  const { id: _ignored, ...rest } = definition as TaskTypeDefinitionInput & { id?: unknown };
  return { id, ...rest } as TaskType;
}

/**
 * Append a new task type with a fresh unique id. Immutable.
 *
 * @param taskTypes - The current catalog.
 * @param definition - The new type's definition (any `id` is ignored).
 * @returns The next catalog array.
 */
export function addTaskType(taskTypes: unknown, definition: TaskTypeDefinitionInput): TaskType[] {
  const types = asArray<TaskType>(taskTypes);
  return [...types, buildTaskType(nextTaskTypeId(types), definition)];
}

/**
 * Replace the definition of the type with `id`, preserving its id. A no-op for an unknown id.
 * Immutable.
 *
 * @param taskTypes - The current catalog.
 * @param id - The task type id to update.
 * @param definition - The replacement definition (any `id` is ignored).
 * @returns The next catalog array.
 */
export function updateTaskType(
  taskTypes: unknown,
  id: string,
  definition: TaskTypeDefinitionInput
): TaskType[] {
  return asArray<TaskType>(taskTypes).map((type) =>
    isPlainRecord(type) && type.id === id ? buildTaskType(id, definition) : type
  );
}

/**
 * Remove the type with `id`, leaving the rest in order. Immutable. (Does NOT cascade into day
 * `taskInstances` — a dangling reference is surfaced by validation, not silently rewritten.)
 *
 * @param taskTypes - The current catalog.
 * @param id - The task type id to delete.
 * @returns The next catalog array.
 */
export function deleteTaskType(taskTypes: unknown, id: string): TaskType[] {
  return asArray<TaskType>(taskTypes).filter((type) => !(isPlainRecord(type) && type.id === id));
}

/**
 * Append a day task instance referencing a task type, with optional epochs (default `[]`). Immutable.
 *
 * @param taskInstances - The day's current ordered instances.
 * @param taskTypeId - The task type the day ran.
 * @param task_epochs - The epochs for this instance (defaults to an empty list).
 * @returns The next instance array.
 */
export function addTaskInstance(
  taskInstances: unknown,
  taskTypeId: string,
  task_epochs: number[] = []
): TaskInstance[] {
  // Clone the epochs so a later mutation of the caller's array cannot leak into the stored
  // instance (mirrors the by-value discipline in taskCatalog's resolve/derive).
  return [...asArray<TaskInstance>(taskInstances), { taskTypeId, task_epochs: structuredClone(task_epochs) }];
}

/**
 * Remove the instance at `index`. Out-of-range / non-array degrade to a safe copy. Immutable.
 *
 * @param taskInstances - The day's current ordered instances.
 * @param index - The position to remove.
 * @returns The next instance array.
 */
export function removeTaskInstance(taskInstances: unknown, index: number): TaskInstance[] {
  return asArray<TaskInstance>(taskInstances).filter((_, i) => i !== index);
}

/**
 * Replace the epochs of the instance at `index`. A no-op for an out-of-range index. Immutable.
 *
 * @param taskInstances - The day's current ordered instances.
 * @param index - The instance position.
 * @param task_epochs - The replacement epochs.
 * @returns The next instance array.
 */
export function setTaskInstanceEpochs(
  taskInstances: unknown,
  index: number,
  task_epochs: number[]
): TaskInstance[] {
  return asArray<TaskInstance>(taskInstances).map((instance, i) =>
    i === index ? { ...instance, task_epochs } : instance
  );
}

/**
 * Move the instance at `fromIndex` to `toIndex` (instance order is the day's task ordering). A no-op
 * when either index is out of range. Immutable.
 *
 * @param taskInstances - The day's current ordered instances.
 * @param fromIndex - The instance to move.
 * @param toIndex - The destination position.
 * @returns The next instance array.
 */
export function reorderTaskInstances(
  taskInstances: unknown,
  fromIndex: number,
  toIndex: number
): TaskInstance[] {
  const instances = asArray<TaskInstance>(taskInstances);
  if (
    fromIndex < 0 ||
    toIndex < 0 ||
    fromIndex >= instances.length ||
    toIndex >= instances.length
  ) {
    return instances;
  }
  const next = [...instances];
  const [moved] = next.splice(fromIndex, 1);
  next.splice(toIndex, 0, moved);
  return next;
}
