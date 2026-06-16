/**
 * @fileoverview Pure epoch write-back transforms (Phase 4 — epoch grid).
 *
 * The Epochs grid is epoch-centric, but a day stores tasks instance-centrically (`day.taskInstances`,
 * each instance owning a set of `task_epochs`). These helpers map one epoch-level edit to the NEXT
 * `taskInstances` array, immutably — the write-back core the Epochs component dispatches through the
 * existing `updateDay('taskInstances', …)` path. {@link epochsOrphanedBy} backs the
 * confirm-before-orphan flow (the grid never auto-scrubs a bound file/video ref; it asks first, then
 * reuses the established clear-orphans repair).
 *
 * Epoch numbers are compared `Number()`-normalized (tolerant of a corrupt mixed-type import), exactly
 * like the validation rules. Pure and dependency-light.
 */

import {
  getDayAssociatedVideos,
  getDayAssociatedFiles,
} from '../state/workspaceSelectors';
import type { TaskInstance, AssociatedFile, AssociatedVideoFile } from '../state/workspaceTypes';

/** Integer-normalized epochs of an instance's `task_epochs` (tolerant; non-integers dropped). */
function epochsOf(instance: TaskInstance): number[] {
  const raw = (instance as { task_epochs?: unknown }).task_epochs;
  const out: number[] = [];
  (Array.isArray(raw) ? raw : []).forEach((value) => {
    const n = Number(value);
    if (Number.isInteger(n)) out.push(n);
  });
  return out;
}

/** A safe instance array (a non-array degrades to empty). */
function asInstances(instances: unknown): TaskInstance[] {
  return Array.isArray(instances) ? (instances as TaskInstance[]) : [];
}

/** Build an instance with the given epochs (preserving its taskTypeId). */
function withEpochs(instance: TaskInstance, task_epochs: number[]): TaskInstance {
  return { taskTypeId: instance.taskTypeId, task_epochs };
}

/**
 * The next free epoch number for a day: `max(all epochs) + 1`, or 1 when none exist.
 *
 * @param instances - The day's task instances.
 * @returns The next epoch number.
 */
export function nextEpochNumber(instances: unknown): number {
  let max = 0;
  for (const instance of asInstances(instances)) {
    for (const epoch of epochsOf(instance)) max = Math.max(max, epoch);
  }
  return max + 1;
}

/** The index of the first instance owning `epoch` (Number-normalized), or -1. */
function ownerIndexOf(instances: TaskInstance[], epoch: number): number {
  return instances.findIndex((instance) => epochsOf(instance).includes(Number(epoch)));
}

/**
 * Append the next free epoch to the first instance referencing `taskTypeId`, creating a new instance
 * when the task type is not yet present. Immutable.
 *
 * @param instances - The day's task instances.
 * @param taskTypeId - The task type the new epoch ran.
 * @returns The next instance array.
 */
export function addEpochToTask(instances: unknown, taskTypeId: string): TaskInstance[] {
  const list = asInstances(instances);
  const epoch = nextEpochNumber(list);
  const index = list.findIndex((i) => i.taskTypeId === taskTypeId);
  if (index < 0) return [...list, { taskTypeId, task_epochs: [epoch] }];
  return list.map((i, k) => (k === index ? withEpochs(i, [...epochsOf(i), epoch]) : i));
}

/**
 * Remove `epoch` from whatever instance owns it, dropping an instance that becomes empty. Immutable.
 *
 * @param instances - The day's task instances.
 * @param epoch - The epoch to remove.
 * @returns The next instance array.
 */
export function removeEpoch(instances: unknown, epoch: number): TaskInstance[] {
  const target = Number(epoch);
  return asInstances(instances)
    .map((instance) => withEpochs(instance, epochsOf(instance).filter((e) => e !== target)))
    .filter((instance) => epochsOf(instance).length > 0);
}

/**
 * Append a fresh epoch to the SAME task that owns `epoch` (duplicate the task at a new epoch).
 * Immutable; a no-op when `epoch` has no owner.
 *
 * @param instances - The day's task instances.
 * @param epoch - The epoch whose task is duplicated.
 * @returns The next instance array.
 */
export function duplicateEpoch(instances: unknown, epoch: number): TaskInstance[] {
  const list = asInstances(instances);
  const index = ownerIndexOf(list, epoch);
  if (index < 0) return list;
  const fresh = nextEpochNumber(list);
  return list.map((i, k) => (k === index ? withEpochs(i, [...epochsOf(i), fresh]) : i));
}

/**
 * Move `epoch` to the instance for `taskTypeId` (creating it when absent), preserving the epoch
 * number; drops a source instance left empty. A no-op when the epoch already belongs to that task.
 * Immutable.
 *
 * @param instances - The day's task instances.
 * @param epoch - The epoch to reassign.
 * @param taskTypeId - The destination task type.
 * @returns The next instance array.
 */
export function setEpochTask(instances: unknown, epoch: number, taskTypeId: string): TaskInstance[] {
  const list = asInstances(instances);
  const target = Number(epoch);
  const owner = ownerIndexOf(list, target);
  if (owner >= 0 && list[owner].taskTypeId === taskTypeId) return list;

  // Remove from the current owner (drop if empty), then add to the destination (create if absent).
  const removed = list
    .map((instance) => withEpochs(instance, epochsOf(instance).filter((e) => e !== target)))
    .filter((instance) => epochsOf(instance).length > 0);
  const destIndex = removed.findIndex((i) => i.taskTypeId === taskTypeId);
  if (destIndex < 0) return [...removed, { taskTypeId, task_epochs: [target] }];
  return removed.map((i, k) =>
    k === destIndex ? withEpochs(i, [...epochsOf(i), target].sort((a, b) => a - b)) : i
  );
}

/**
 * Swap which task owns epoch `a` and epoch `b` (the "move up / move down" reorder — epoch numbers ARE
 * the temporal order, so reordering swaps ownership of the two adjacent numbers). Immutable.
 *
 * @param instances - The day's task instances.
 * @param a - One epoch number.
 * @param b - The other epoch number.
 * @returns The next instance array.
 */
export function swapEpochs(instances: unknown, a: number, b: number): TaskInstance[] {
  const x = Number(a);
  const y = Number(b);
  return asInstances(instances).map((instance) =>
    withEpochs(
      instance,
      epochsOf(instance).map((e) => (e === x ? y : e === y ? x : e))
    )
  );
}

/**
 * Insert a new epoch immediately after `epoch`: shift every later epoch up by one (across all tasks)
 * and add the freed `epoch + 1` slot to the task that owns `epoch`. Immutable. (A renumber: it can
 * leave a bound file/video ref dangling — the caller checks {@link epochsOrphanedBy} and confirms.)
 *
 * @param instances - The day's task instances.
 * @param epoch - The reference epoch to insert after.
 * @returns The next instance array.
 */
export function insertEpochAfter(instances: unknown, epoch: number): TaskInstance[] {
  const list = asInstances(instances);
  const target = Number(epoch);
  const owner = ownerIndexOf(list, target);
  if (owner < 0) return list;
  // Shift every epoch strictly greater than the reference up by one to free the next slot.
  const shifted = list.map((instance) =>
    withEpochs(
      instance,
      epochsOf(instance).map((e) => (e > target ? e + 1 : e))
    )
  );
  return shifted.map((i, k) => (k === owner ? withEpochs(i, [...epochsOf(i), target + 1]) : i));
}

/** Associated refs that a candidate instance set would leave dangling (the confirm-before-orphan set). */
export interface OrphanedReferences {
  /** Videos whose `task_epochs` no longer matches any task epoch. */
  videos: AssociatedVideoFile[];
  /** Files whose `task_epochs` no longer matches any task epoch. */
  files: AssociatedFile[];
}

/**
 * The associated videos/files a `nextInstances` set would orphan — a bound `task_epochs` that no
 * longer matches any task epoch. The Epochs grid computes this BEFORE applying a reorder/delete and
 * confirms; it never silently scrubs (the orphan-visibility contract). Mirrors `TasksEpochsStep`'s
 * detector. fs_gui epoch orphans are surfaced by validation, not this confirm flow.
 *
 * @param day - The recording day (reads `associated_video_files` / `associated_files`).
 * @param nextInstances - The candidate instance set after the edit.
 * @returns The videos + files that would be left dangling.
 */
export function epochsOrphanedBy(day: unknown, nextInstances: unknown): OrphanedReferences {
  const valid = new Set<number>();
  for (const instance of asInstances(nextInstances)) {
    for (const epoch of epochsOf(instance)) valid.add(epoch);
  }
  const isOrphan = (entry: { task_epochs?: number | string }) =>
    entry.task_epochs !== '' && entry.task_epochs != null && !valid.has(Number(entry.task_epochs));
  return {
    videos: getDayAssociatedVideos(day).filter(isOrphan),
    files: getDayAssociatedFiles(day).filter(isOrphan),
  };
}
