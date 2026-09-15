/**
 * @fileoverview Statescript expectation (pure) — is an epoch EXPECTED to have a statescript log?
 *
 * Settled policy: a statescript that has not been linked yet is NEVER an export blocker. It is a
 * non-blocking amber warning, and only for the epochs where a log is actually expected. Expectation
 * is CARRY-FORWARD, not universal:
 *
 *  - a run/task epoch always expects a statescript (the run is driven by one);
 *  - a sleep epoch expects one ONLY when this animal's prior recording days actually linked a sleep
 *    statescript — some labs log sleep, some do not, and the app must not invent a missing file for
 *    a lab that never records one.
 *
 * Config-version boundary: only days on the SAME `configurationVersion` are compared, mirroring
 * {@link module:domain/badChannelMonotonicity} — a probe reconfiguration starts a new regime and
 * never inherits the previous one's file habits.
 *
 * All helpers are shape-safe: corrupt/missing input degrades to "no precedent", never throws.
 */

import { resolveDayCatalogView } from '../state/dayTaskCatalog';
import { resolveTaskInstances } from '../state/taskCatalog';
import { getDayAssociatedFiles } from '../state/workspaceSelectors';
import { getIndexedStatescriptFiles } from './associatedFiles';
import { isRecord } from '../utils/records';

/**
 * The three-state file vocabulary for a row's statescript, shared by the grid rows, the summary
 * chip and its filter so one definition drives every surface.
 *
 * - `linked` — a statescript file is bound to the epoch;
 * - `expected` — none is bound and one is expected (the amber warning state);
 * - `not_expected` — none is bound and none is expected (quiet; nothing to fix).
 */
export type StatescriptState = 'linked' | 'expected' | 'not_expected';

/** The carry-forward precedent an epoch's expectation is decided against. */
export interface StatescriptExpectation {
  /** Whether this animal's prior same-configuration days linked a sleep statescript. */
  sleepExpected: boolean;
}

/**
 * Whether a task name names a sleep epoch. Matches the whole word only, so "sleepy wtrack" is a
 * run task — the same predicate the grid's `s`/`r` filename tag prefix uses.
 *
 * @param taskName - The task's `task_name` (any shape; non-strings read as not-sleep).
 * @returns True for a sleep task.
 */
export function isSleepTaskName(taskName: unknown): boolean {
  return typeof taskName === 'string' && /\bsleep\b/i.test(taskName);
}

/** The integer epochs of a task's `task_epochs` (tolerant; non-integers dropped). */
function integerEpochs(rawEpochs: unknown): number[] {
  const out: number[] = [];
  (Array.isArray(rawEpochs) ? rawEpochs : []).forEach((value) => {
    const n = Number(value);
    if (Number.isInteger(n)) out.push(n);
  });
  return out;
}

/**
 * Whether ONE day linked a statescript to one of its sleep epochs. Resolves the day's tasks the
 * same way the export and the epoch grid do (`resolveDayCatalogView` + `resolveTaskInstances`), so
 * a catalog day and a legacy inline-`tasks` day answer identically.
 *
 * @param animal - The owning animal (its task-type catalog).
 * @param day - The day to inspect.
 * @returns True when a sleep epoch of that day has a statescript file bound.
 */
function dayLinkedSleepStatescript(animal: unknown, day: unknown): boolean {
  const view = resolveDayCatalogView(animal, day);
  const sleepEpochs = new Set<number>();
  resolveTaskInstances(view.taskTypes, view.taskInstances).forEach((task) => {
    if (!isSleepTaskName(task?.task_name)) return;
    integerEpochs(task?.task_epochs).forEach((epoch) => sleepEpochs.add(epoch));
  });
  if (sleepEpochs.size === 0) return false;

  return getIndexedStatescriptFiles(getDayAssociatedFiles(day)).some(({ entry }) => {
    const raw = entry.task_epochs;
    if (raw === undefined || raw === null || raw === '') return false;
    return sleepEpochs.has(Number(raw));
  });
}

/**
 * The expectation context for a day: whether its sleep epochs should expect statescripts, decided
 * from the animal's EARLIER same-`configurationVersion` days. Days later than `day`, on another
 * configuration version, or `day` itself are never consulted.
 *
 * @param animal - The owning animal.
 * @param day - The day being edited (pins `configurationVersion` and `date`).
 * @param animalDays - The animal's day records (the day itself may be included).
 * @returns The expectation context.
 */
export function buildStatescriptExpectation(
  animal: unknown,
  day: unknown,
  animalDays: unknown[]
): StatescriptExpectation {
  if (!isRecord(day) || !Array.isArray(animalDays)) return { sleepExpected: false };
  const version = day.configurationVersion;
  const date = day.date;
  if (typeof date !== 'string') return { sleepExpected: false };

  for (const other of animalDays) {
    if (!isRecord(other)) continue;
    if (other === day || other.id === day.id) continue;
    // Same configuration regime (a reconfiguration starts fresh) AND strictly earlier.
    if (other.configurationVersion !== version) continue;
    if (!(typeof other.date === 'string' && other.date < date)) continue;
    if (dayLinkedSleepStatescript(animal, other)) return { sleepExpected: true };
  }
  return { sleepExpected: false };
}

/**
 * Whether an epoch row is expected to have a statescript log: always for a run/task epoch, and for
 * a sleep epoch only when the carry-forward precedent says this animal logs them.
 *
 * @param row - The epoch row.
 * @param row.taskName - Its owning task's name.
 * @param expectation - The day's carry-forward precedent.
 * @returns True when a statescript is expected for that epoch.
 */
export function isStatescriptExpected(
  row: { taskName?: unknown },
  expectation: StatescriptExpectation
): boolean {
  return isSleepTaskName(row?.taskName) ? expectation.sleepExpected : true;
}

/**
 * The three-state statescript vocabulary for an epoch row — the single definition the grid rows,
 * the summary chip and its filter all read.
 *
 * @param row - The epoch row.
 * @param row.taskName - Its owning task's name.
 * @param row.statescript - Its bound statescript file, if any.
 * @param expectation - The day's carry-forward precedent.
 * @returns `linked` / `expected` / `not_expected`.
 */
export function statescriptStateFor(
  row: { taskName?: unknown; statescript?: unknown },
  expectation: StatescriptExpectation
): StatescriptState {
  if (row?.statescript != null) return 'linked';
  return isStatescriptExpected(row, expectation) ? 'expected' : 'not_expected';
}
