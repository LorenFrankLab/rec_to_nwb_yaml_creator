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

/** The editor's working view of a day's tasks in catalog form. */
export interface DayCatalogView {
  /** The animal's task types — extended with any minted during an inline→catalog conversion. */
  taskTypes: TaskType[];
  /** The day's ordered task instances (references + epochs). */
  taskInstances: TaskInstance[];
  /** True when the view was DERIVED from inline `day.tasks` (the editor should commit on first edit). */
  derived: boolean;
}

/** A usable task name / dedup key: a non-empty, non-whitespace string. */
function usableName(value: unknown): value is string {
  return typeof value === 'string' && value.trim() !== '';
}

/** Whether `value` is a plain object record (not null, not an array). */
function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

/** The reusable definition of a task: every own key except the day-varying `task_epochs`. */
function taskDefinition(task: Record<string, unknown>): Record<string, unknown> {
  const definition: Record<string, unknown> = {};
  for (const key of Object.keys(task)) {
    if (key !== 'task_epochs') definition[key] = task[key];
  }
  return definition;
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
    };
  }

  // Inline day: convert into the existing catalog, reusing types by name and minting new ones.
  let taskTypes = getAnimalTaskTypes(animalRecord);
  const byName = new Map<string, TaskType>();
  for (const type of taskTypes) {
    if (usableName(type?.task_name) && !byName.has(type.task_name)) byName.set(type.task_name, type);
  }

  const taskInstances: TaskInstance[] = [];
  for (const task of getDayTasks(dayRecord) as unknown[]) {
    if (!isPlainRecord(task)) continue;
    const name = task.task_name;
    let type: TaskType;
    if (usableName(name) && byName.has(name)) {
      type = byName.get(name)!;
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

  return { taskTypes, taskInstances, derived: true };
}
