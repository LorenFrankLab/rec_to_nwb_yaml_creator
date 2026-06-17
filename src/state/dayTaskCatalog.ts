/**
 * @fileoverview Day-scoped task-catalog resolution for the Day Editor (Phase 8C).
 *
 * The Tasks & Epochs step edits a day in CATALOG form — ordered `taskInstances` that reference the
 * animal's `taskTypes`. A live day is normally already catalog-shaped (the load-time v2→v3 migrator),
 * but a freshly-created, imported, or legacy day can still carry inline `day.tasks`. This module gives
 * the editor ONE uniform working view so it never has to branch on the day's shape:
 *
 *  - a catalog day (its `taskInstances` is an array) passes through untouched; the first edit writes
 *    `taskInstances` back directly;
 *  - an inline day is converted to the catalog — each inline task reuses an existing `taskType` with
 *    the same `task_name` (the dedup identity) or mints a fresh one for an unseen name, mirroring the
 *    migrator's first-occurrence semantics scoped to one day + the animal's existing catalog. The
 *    editor commits this conversion (the extended `taskTypes` to the animal, the `taskInstances` to
 *    the day) on the first edit, so an imported/legacy day becomes consistent without a separate
 *    migration step.
 *
 * Pure; reuses the tested `addTaskType` id-minting so a converted day's new types never collide.
 */

import { getAnimalTaskTypes, getDayTasks } from './workspaceSelectors';
import { addTaskType } from './taskCatalogActions';
import type { TaskType, TaskInstance } from './workspaceTypes';

/** A task-name match whose reusable definition differs between the inline day and animal catalog. */
export interface TaskCatalogDivergence {
  /** The task name shared by the inline task and the animal task type. */
  taskName: string;
  /** The inline day's reusable task definition (every exported key except `task_epochs`). */
  inline: Record<string, unknown>;
  /** The matching catalog task type's reusable definition (every exported key except internal `id`). */
  catalog: Record<string, unknown>;
  /** The inline task's index in `day.tasks`. */
  inlineTaskIndex: number;
  /** The matching catalog task type id. */
  catalogTaskTypeId: string;
}

/** The editor's working view of a day's tasks in catalog form. */
export interface DayCatalogView {
  /** The animal's task types — extended with any minted during an inline→catalog conversion. */
  taskTypes: TaskType[];
  /** The day's ordered task instances (references + epochs). */
  taskInstances: TaskInstance[];
  /** True when the view was DERIVED from inline `day.tasks` (the editor should commit on first edit). */
  derived: boolean;
  /** Inline→catalog name matches whose task definitions differ and need an explicit user choice. */
  divergences: TaskCatalogDivergence[];
}

/** A usable task name / dedup key: a non-empty, non-whitespace string. */
function usableName(value: unknown): value is string {
  return typeof value === 'string' && value.trim() !== '';
}

/** Whether `value` is a plain object record (not null, not an array). */
function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

/** ES2020-safe own-property check (the tsconfig `lib` predates `Object.hasOwn`). */
function hasOwn(record: object, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(record, key);
}

/**
 * Order-insensitive deep equality for definition records. Arrays stay order-sensitive because
 * `[0, 1]` and `[1, 0]` produce different exported bytes.
 */
function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (typeof a !== 'object' || typeof b !== 'object' || a === null || b === null) return false;
  const aArray = Array.isArray(a);
  const bArray = Array.isArray(b);
  if (aArray !== bArray) return false;
  if (aArray && bArray) {
    if (a.length !== b.length) return false;
    return a.every((value, index) => deepEqual(value, b[index]));
  }
  const aRecord = a as Record<string, unknown>;
  const bRecord = b as Record<string, unknown>;
  const aKeys = Object.keys(aRecord);
  const bKeys = Object.keys(bRecord);
  if (aKeys.length !== bKeys.length) return false;
  return aKeys.every((key) => hasOwn(bRecord, key) && deepEqual(aRecord[key], bRecord[key]));
}

/** The reusable definition of a task: every own key except the day-varying `task_epochs`. */
function taskDefinition(task: Record<string, unknown>): Record<string, unknown> {
  const definition: Record<string, unknown> = {};
  for (const key of Object.keys(task)) {
    if (key !== 'task_epochs') definition[key] = task[key];
  }
  return definition;
}

/** The exported task definition a catalog task type would emit (strips only the internal `id`). */
function taskTypeDefinition(type: Record<string, unknown>): Record<string, unknown> {
  const { id: _id, ...definition } = type;
  return definition;
}

/** Whether an inline task would export different definition bytes than the matched catalog type. */
function taskDefinitionsDiverge(task: Record<string, unknown>, type: TaskType): boolean {
  return !deepEqual(taskDefinition(task), taskTypeDefinition(type as unknown as Record<string, unknown>));
}

/** Existing task-type names, for creating a valid distinct catalog definition. */
function taskNameSet(taskTypes: TaskType[]): Set<string> {
  return new Set(
    taskTypes
      .map((type) => type?.task_name)
      .filter((name): name is string => usableName(name))
  );
}

/** The day-specific suffix for a preserved inline definition. */
function daySpecificSuffix(dayRecord: Record<string, unknown>): string {
  if (typeof dayRecord.id === 'string' && dayRecord.id.trim() !== '') return dayRecord.id.trim();
  if (typeof dayRecord.date === 'string' && dayRecord.date.trim() !== '') return dayRecord.date.trim();
  return 'day';
}

/** Build a unique, valid task name for a day-specific preserved definition. */
function distinctTaskName(baseName: string, dayRecord: Record<string, unknown>, taskTypes: TaskType[]): string {
  const names = taskNameSet(taskTypes);
  const suffix = daySpecificSuffix(dayRecord);
  const base = baseName.trim() || 'Task';
  let candidate = `${base} (${suffix})`;
  let index = 2;
  while (names.has(candidate)) {
    candidate = `${base} (${suffix} ${index})`;
    index += 1;
  }
  return candidate;
}

/**
 * Resolve a day into the editor's catalog working view (see module docs).
 *
 * @param animal - The owning animal (its `taskTypes` catalog).
 * @param day - The recording day (`taskInstances` if catalog-shaped, else inline `tasks`).
 * @returns The catalog view: task types (possibly extended), ordered instances, and a `derived` flag.
 */
export function resolveDayCatalogView(animal: unknown, day: unknown): DayCatalogView {
  const animalRecord = isPlainRecord(animal) ? animal : {};
  const dayRecord = isPlainRecord(day) ? day : {};

  // Already catalog-shaped: pass through untouched (the editor writes taskInstances back directly).
  if (Array.isArray(dayRecord.taskInstances)) {
    return {
      taskTypes: getAnimalTaskTypes(animalRecord),
      taskInstances: dayRecord.taskInstances as TaskInstance[],
      derived: false,
      divergences: [],
    };
  }

  // Inline day: convert into the existing catalog, reusing types by name and minting new ones.
  let taskTypes = getAnimalTaskTypes(animalRecord);
  const byName = new Map<string, TaskType>();
  for (const type of taskTypes) {
    if (usableName(type?.task_name) && !byName.has(type.task_name)) byName.set(type.task_name, type);
  }

  const taskInstances: TaskInstance[] = [];
  const divergences: TaskCatalogDivergence[] = [];
  for (const [index, task] of (getDayTasks(dayRecord) as unknown[]).entries()) {
    if (!isPlainRecord(task)) continue;
    const name = task.task_name;
    let type: TaskType;
    if (usableName(name) && byName.has(name)) {
      type = byName.get(name)!;
      if (taskDefinitionsDiverge(task, type)) {
        divergences.push({
          taskName: name,
          inline: taskDefinition(task),
          catalog: taskTypeDefinition(type as unknown as Record<string, unknown>),
          inlineTaskIndex: index,
          catalogTaskTypeId: type.id,
        });
      }
    } else {
      taskTypes = addTaskType(taskTypes, taskDefinition(task) as never);
      type = taskTypes[taskTypes.length - 1];
      if (usableName(name)) byName.set(name, type);
    }
    taskInstances.push({
      taskTypeId: type.id,
      task_epochs: Array.isArray(task.task_epochs) ? structuredClone(task.task_epochs) : [],
    });
  }

  return { taskTypes, taskInstances, derived: true, divergences };
}

/**
 * Convert an inline day to catalog form while preserving the day's own task definitions.
 *
 * For a name collision with divergent metadata, this mints a valid day-specific task type name
 * (`Run (day-id)`) instead of creating a duplicate catalog `task_name`. Non-divergent matches still
 * reuse the catalog type, and unseen names follow the normal mint-new path.
 *
 * @param animal - The owning animal (its `taskTypes` catalog).
 * @param day - The inline recording day.
 * @returns The next task types and instances to persist.
 */
export function preserveInlineTaskDefinitions(
  animal: unknown,
  day: unknown
): Pick<DayCatalogView, 'taskTypes' | 'taskInstances'> {
  const animalRecord = isPlainRecord(animal) ? animal : {};
  const dayRecord = isPlainRecord(day) ? day : {};

  let taskTypes = getAnimalTaskTypes(animalRecord);
  const byName = new Map<string, TaskType>();
  for (const type of taskTypes) {
    if (usableName(type?.task_name) && !byName.has(type.task_name)) byName.set(type.task_name, type);
  }

  const preserved: Array<{ originalName: string; definition: Record<string, unknown>; type: TaskType }> = [];
  const taskInstances: TaskInstance[] = [];

  for (const task of getDayTasks(dayRecord) as unknown[]) {
    if (!isPlainRecord(task)) continue;
    const name = task.task_name;
    const definition = taskDefinition(task);
    let type: TaskType;

    if (usableName(name) && byName.has(name)) {
      const catalogType = byName.get(name)!;
      if (taskDefinitionsDiverge(task, catalogType)) {
        const existing = preserved.find(
          (record) => record.originalName === name && deepEqual(record.definition, definition)
        );
        if (existing) {
          type = existing.type;
        } else {
          const distinctDefinition = {
            ...definition,
            task_name: distinctTaskName(name, dayRecord, taskTypes),
          };
          taskTypes = addTaskType(taskTypes, distinctDefinition as never);
          type = taskTypes[taskTypes.length - 1];
          preserved.push({ originalName: name, definition, type });
          if (usableName(type.task_name)) byName.set(type.task_name, type);
        }
      } else {
        type = catalogType;
      }
    } else {
      taskTypes = addTaskType(taskTypes, definition as never);
      type = taskTypes[taskTypes.length - 1];
      if (usableName(name)) byName.set(name, type);
    }

    taskInstances.push({
      taskTypeId: type.id,
      task_epochs: Array.isArray(task.task_epochs) ? structuredClone(task.task_epochs) : [],
    });
  }

  return { taskTypes, taskInstances };
}
