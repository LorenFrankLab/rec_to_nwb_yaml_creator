/**
 * @fileoverview Task identity across an animal's recording days and across import files.
 *
 * Spyglass keeps ONE description per `task_name`: its `Task` table is keyed by the name alone, and
 * TaskEpoch ingestion raises a DuplicateError when a recording reuses a name with a different
 * `task_description` (unless someone at an interactive prompt accepts the stored description in
 * place of the file's). That recording's task epochs — and the video, StateScript and optogenetics
 * rows that depend on them — are then not ingested. See docs/PIPELINE_REQUIREMENTS.md §3.
 *
 * Within one day, `divergent_task_identity` catches this, and the animal's task catalog makes it
 * impossible for days kept in the catalog (one task type per name). Days that still carry their own
 * inline `tasks` — imported files above all — can disagree with each other, so this module compares
 * them the way the catalog identifies a task: per animal, by exact `task_name`. Only the description
 * is compared; a task's room and cameras are the day's context (Spyglass TaskEpoch), not its identity.
 *
 * Pure; reads plain workspace shapes tolerantly.
 */

import type { RepairableIssue } from './repairRouting';
import {
  getAnimalDays,
  getAnimalTaskTypes,
  getDayTaskInstances,
  getDayTasks,
} from '../state/workspaceSelectors';
import { usableTaskName } from '../state/taskCatalog';
import { isRecord } from '../utils/records';

/** How many sources a message names before summarizing the rest as a count. */
const LISTED_SOURCES = 3;

/** A task name and the description one recording gives it. */
interface TaskDescription {
  taskName: string;
  description: string;
}

/**
 * The description as Spyglass compares it: a missing description equals an empty one.
 *
 * @param value - A task's `task_description`.
 * @returns The comparable text.
 */
function descriptionText(value: unknown): string {
  return value === undefined || value === null ? '' : String(value);
}

/**
 * The (name, description) pairs of a task list, skipping rows without a usable name.
 *
 * @param tasks - Task rows (shape-tolerant).
 * @returns The pairs, in row order.
 */
function taskDescriptions(tasks: unknown): TaskDescription[] {
  return (Array.isArray(tasks) ? tasks : []).filter(isRecord).flatMap((task) =>
    usableTaskName(task.task_name)
      ? [{ taskName: task.task_name, description: descriptionText(task.task_description) }]
      : []
  );
}

/**
 * The task descriptions a day exports, resolved as `resolveDayTasks` resolves them: a catalog day's
 * instances take the description from the animal's task type (an instance overrides only its room
 * and cameras, and a dangling reference exports nothing), and a day without `taskInstances` exports
 * its inline `tasks`. Nothing is cloned, so comparing every day of a long study stays cheap.
 *
 * @param animal - The owning animal (its `taskTypes`).
 * @param day - The recording day.
 * @returns The day's (name, description) pairs.
 */
function dayTaskDescriptions(animal: unknown, day: unknown): TaskDescription[] {
  const instances = getDayTaskInstances(day);
  if (instances === null) return taskDescriptions(getDayTasks(day));
  const typeById = new Map<string, unknown>();
  for (const type of getAnimalTaskTypes(animal)) {
    if (isRecord(type) && typeof type.id === 'string') typeById.set(type.id, type);
  }
  return taskDescriptions(
    instances.map((instance) =>
      isRecord(instance) && typeof instance.taskTypeId === 'string'
        ? typeById.get(instance.taskTypeId)
        : undefined
    )
  );
}

/**
 * Name a day in a message: its date, else its id.
 *
 * @param day - The recording day.
 * @param day.date - Its recording date.
 * @param day.id - Its id.
 * @returns The label.
 */
function dayLabel(day: { date?: unknown; id?: unknown }): string {
  return typeof day.date === 'string' && day.date !== '' ? day.date : String(day.id ?? 'another day');
}

/**
 * Join labels for a sentence: "a", "a and b", "a, b and c", "a, b, c and 2 more days".
 *
 * @param labels - The labels, in order.
 * @param noun - The plural noun for the summarized remainder (`days`, `files`).
 * @returns The joined text.
 */
function listLabels(labels: string[], noun: string): string {
  if (labels.length <= 1) return labels.join('');
  if (labels.length <= LISTED_SOURCES) {
    return `${labels.slice(0, -1).join(', ')} and ${labels[labels.length - 1]}`;
  }
  return `${labels.slice(0, LISTED_SOURCES).join(', ')} and ${labels.length - LISTED_SOURCES} more ${noun}`;
}

/**
 * A description for a message, quoted; an empty one reads "(none)".
 *
 * @param description - The comparable description.
 * @returns The display text.
 */
function quoted(description: string): string {
  return description === '' ? '(none)' : `"${description}"`;
}

/**
 * Export-blocking issues for the task names a day describes differently from another recording day
 * of the same animal — one per task name, naming the other descriptions and their dates. Every day
 * involved is flagged (whichever Spyglass ingests second is refused). A disagreement inside the day
 * itself is left to `divergent_task_identity`. With no other days to compare (`animalDays` empty)
 * this is a no-op, so single-day callers are unaffected.
 *
 * @param day - The day being checked.
 * @param animal - The owning animal (its `taskTypes`, for catalog days).
 * @param animalDays - The animal's day records.
 * @returns Zero or more error issues, routed to the day's Tasks & Epochs step.
 */
export function crossDayTaskIdentityIssues(
  day: unknown,
  animal: unknown,
  animalDays: unknown[] = []
): RepairableIssue[] {
  if (!isRecord(day) || !Array.isArray(animalDays)) return [];
  const own = new Map<string, Set<string>>();
  for (const { taskName, description } of dayTaskDescriptions(animal, day)) {
    own.set(taskName, (own.get(taskName) ?? new Set<string>()).add(description));
  }
  if (own.size === 0) return [];

  // task name → a description this day does not use → the other days that use it.
  const elsewhere = new Map<string, Map<string, string[]>>();
  for (const other of animalDays) {
    if (!isRecord(other) || other === day) continue;
    if (typeof day.id === 'string' && other.id === day.id) continue;
    const label = dayLabel(other);
    for (const { taskName, description } of dayTaskDescriptions(animal, other)) {
      const mine = own.get(taskName);
      if (mine === undefined || mine.has(description)) continue;
      const variants = elsewhere.get(taskName) ?? new Map<string, string[]>();
      const labels = variants.get(description) ?? [];
      if (!labels.includes(label)) labels.push(label);
      variants.set(description, labels);
      elsewhere.set(taskName, variants);
    }
  }

  return [...elsewhere].map(([taskName, variants]) => {
    const here = [...(own.get(taskName) ?? [])].map(quoted).join(' and ');
    const there = [...variants]
      .map(([description, labels]) => `${quoted(description)} on ${listLabels(labels, 'days')}`)
      .join('; ');
    return {
      path: 'tasks',
      field: 'task_name',
      step: 'epochs',
      repairSurface: 'day',
      actionLabel: 'Match the task descriptions',
      code: 'divergent_task_identity_across_days',
      severity: 'error',
      message:
        `Task "${taskName}" has description ${here} on this day, but ${there}. Spyglass keeps one ` +
        'description per task name and refuses the task epochs of a recording that reuses the name ' +
        'with another. Use the same description on every day, or rename the task where it differs.',
    };
  });
}

/**
 * The import preview's task differences: each task name the imported files use that the files (and,
 * when the subject already exists, that animal's recorded days) describe in more than one way, with
 * where each description comes from. Listed the way other differences are, as `{ field, detail }`.
 *
 * @param files - The files being imported, in date order, with their inline tasks.
 * @param existing - The workspace and the existing animal's id, when the subject already exists.
 * @param existing.workspace - The current workspace (`{ animals, days }`); read-only.
 * @param existing.animalId - The existing animal's store key.
 * @returns One `tasks` divergence per task name with more than one description.
 */
export function importTaskDescriptionDivergences(
  files: ReadonlyArray<{ sourceName: string; tasks: unknown }>,
  existing: { workspace: unknown; animalId: string } | null = null
): Array<{ field: string; detail: string }> {
  const recordings: Array<{ existingDay?: string; file?: string; tasks: TaskDescription[] }> = [];
  const workspace = existing?.workspace;
  if (existing && isRecord(workspace) && isRecord(workspace.animals) && isRecord(workspace.days)) {
    const animal = workspace.animals[existing.animalId];
    for (const day of getAnimalDays(workspace, existing.animalId)) {
      recordings.push({ existingDay: dayLabel(day), tasks: dayTaskDescriptions(animal, day) });
    }
  }
  for (const file of files) {
    recordings.push({ file: file.sourceName, tasks: taskDescriptions(file.tasks) });
  }

  // task name → description → where it was recorded (first-seen order throughout).
  const byName = new Map<string, Map<string, { days: string[]; files: string[] }>>();
  for (const { existingDay, file, tasks } of recordings) {
    for (const { taskName, description } of tasks) {
      const variants = byName.get(taskName) ?? new Map<string, { days: string[]; files: string[] }>();
      const sources = variants.get(description) ?? { days: [], files: [] };
      if (existingDay !== undefined && !sources.days.includes(existingDay)) sources.days.push(existingDay);
      if (file !== undefined && !sources.files.includes(file)) sources.files.push(file);
      variants.set(description, sources);
      byName.set(taskName, variants);
    }
  }

  return [...byName]
    // Only names an imported file uses: a disagreement among the existing days alone is not
    // something this import brings (each of those days already carries the export block).
    .filter(([, variants]) => variants.size > 1 && [...variants.values()].some((s) => s.files.length > 0))
    .map(([taskName, variants]) => {
      const listed = [...variants].map(([description, { days, files: fileNames }]) => {
        const where = [
          ...(days.length > 0 ? [`already on this animal: ${listLabels(days, 'days')}`] : []),
          ...(fileNames.length > 0 ? [listLabels(fileNames, 'files')] : []),
        ].join('; ');
        return `${quoted(description)} (${where})`;
      });
      return {
        field: 'tasks',
        detail:
          `Task "${taskName}" has different descriptions across these recordings: ` +
          `${listed.join('; ')}. Spyglass keeps one description per task name, so these days ` +
          'cannot be exported until the descriptions match or the task is renamed.',
      };
    });
}
