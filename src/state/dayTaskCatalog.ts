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
 * A name match whose ONLY difference is the room or the cameras (`TASK_CONTEXT_FIELDS`) is not a
 * divergence at all: it is what that day recorded, so it becomes an instance override on the day and
 * the shared task type is left alone. A `divergence` is reserved for a real identity conflict (a
 * different `task_description`), which the user still resolves explicitly.
 *
 * Pure; reuses the tested `addTaskType` id-minting so a converted day's new types never collide.
 */

import { getAnimalTaskTypes, getDayTasks } from './workspaceSelectors';
import { addTaskType } from './taskCatalogActions';
import {
  deepEqual,
  taskContextOverrides,
  taskDefinition,
  usableTaskName as usableName,
} from './taskCatalog';
import type { TaskContextOverrides } from './taskCatalog';
import type { TaskType, TaskInstance } from './workspaceTypes';
import { isRecord as isPlainRecord } from '../utils/records';

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

/** The exported task definition a catalog task type would emit (strips only the internal `id`). */
function taskTypeDefinition(type: Record<string, unknown>): Record<string, unknown> {
  const { id: _id, ...definition } = type;
  return definition;
}

/** Whether an inline task would export different definition bytes than the matched catalog type. */
function taskDefinitionsDiverge(task: Record<string, unknown>, type: TaskType): boolean {
  return !deepEqual(taskDefinition(task), taskTypeDefinition(type as unknown as Record<string, unknown>));
}

/**
 * The day-owned context (room / cameras) that reproduces this inline task from the catalog type, or
 * null when the difference is a genuine IDENTITY divergence the user must resolve. A day that ran
 * the catalog's task somewhere else is not a conflict — it is what that day recorded — so it
 * becomes an instance override and never a divergence or a forked task type.
 *
 * @param task - The inline task.
 * @param type - The catalog task type matched by name.
 * @returns Context overrides (possibly empty), or null for an identity divergence.
 */
function contextOverridesFor(task: Record<string, unknown>, type: TaskType): TaskContextOverrides | null {
  return taskContextOverrides(
    taskDefinition(task),
    taskTypeDefinition(type as unknown as Record<string, unknown>)
  );
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
    let overrides: TaskContextOverrides = {};
    if (usableName(name) && byName.has(name)) {
      type = byName.get(name)!;
      if (taskDefinitionsDiverge(task, type)) {
        const context = contextOverridesFor(task, type);
        if (context) {
          overrides = context;
        } else {
          divergences.push({
            taskName: name,
            inline: taskDefinition(task),
            catalog: taskTypeDefinition(type as unknown as Record<string, unknown>),
            inlineTaskIndex: index,
            catalogTaskTypeId: type.id,
          });
        }
      }
    } else {
      taskTypes = addTaskType(taskTypes, taskDefinition(task) as never);
      type = taskTypes[taskTypes.length - 1];
      if (usableName(name)) byName.set(name, type);
    }
    taskInstances.push({
      taskTypeId: type.id,
      ...overrides,
      task_epochs: Array.isArray(task.task_epochs) ? structuredClone(task.task_epochs) : [],
    });
  }

  return { taskTypes, taskInstances, derived: true, divergences };
}

/**
 * Convert an inline day to catalog form while preserving the day's own task definitions.
 *
 * For a name collision with a divergent IDENTITY, this mints a valid day-specific task type name
 * (`Run (day-id)`) instead of creating a duplicate catalog `task_name`. A difference that is only
 * the day's room/cameras is preserved as an instance override on the shared type instead (one task
 * run in two places is still one task). Non-divergent matches reuse the catalog type, and unseen
 * names follow the normal mint-new path.
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
    let overrides: TaskContextOverrides = {};

    if (usableName(name) && byName.has(name)) {
      const catalogType = byName.get(name)!;
      const context = contextOverridesFor(task, catalogType);
      if (context) {
        // Identical, or the same task in a different room / with different cameras: keep the day's
        // values ON THE DAY. Forking a `sleep (2023-06-22)` task type for a room difference would
        // invent a second Spyglass task identity for one task.
        type = catalogType;
        overrides = context;
      } else {
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
      }
    } else {
      taskTypes = addTaskType(taskTypes, definition as never);
      type = taskTypes[taskTypes.length - 1];
      if (usableName(name)) byName.set(name, type);
    }

    taskInstances.push({
      taskTypeId: type.id,
      ...overrides,
      task_epochs: Array.isArray(task.task_epochs) ? structuredClone(task.task_epochs) : [],
    });
  }

  return { taskTypes, taskInstances };
}
