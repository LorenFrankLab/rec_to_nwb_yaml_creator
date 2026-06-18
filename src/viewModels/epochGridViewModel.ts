/**
 * @fileoverview The epoch grid view-model — a pure join over a day's existing arrays.
 *
 * `buildEpochGrid(animal, day)` is the spine of the Epochs tab: one row per distinct epoch number,
 * joining the day's resolved tasks + `associated_files` + `associated_video_files` + `fs_gui_yamls`.
 * It is a PRESENTATION join — it introduces no storage shape and never reshapes the stored arrays;
 * the Epochs component edits those same arrays via `updateDay`, so the export merge
 * (`mergeDayMetadata`) is untouched and the YAML stays byte-identical.
 *
 * It reuses the existing substrate, never reimplementing it:
 *   - `resolveDayCatalogView` + `resolveTaskInstances` resolve catalog (`taskInstances`) AND legacy
 *     inline (`tasks`) days to one uniform task list (the same resolution the export uses);
 *   - the `task_epoch(s)` singular/plural tolerance matches `referenceRules.taskEpochReferences`
 *     (read `Number()`-normalized; NEVER rewrite the stored key spelling);
 *   - `duplicateTaskEpochs` is the uniqueness badge;
 *   - `fileNaming.isDerived*` classify the generated-vs-manual file state;
 *   - the off-export `videolessEpochs` set (`getDayVideolessEpochs`) is the `absent` half of the
 *     video 3-state.
 *
 * Pure and React-free; returns plain data only.
 */

import {
  getAnimalSubject,
  getDayAssociatedVideos,
  getDayAssociatedFiles,
  getDayFsGuiYamls,
  getDayDeferredEpochs,
  getDayVideolessEpochs,
} from '../state/workspaceSelectors';
import { resolveDayCatalogView } from '../state/dayTaskCatalog';
import { resolveTaskInstances } from '../state/taskCatalog';
import { duplicateTaskEpochs } from '../validation/taskEpochs';
import { isDerivedStatescript } from '../domain/fileNaming';
import type {
  AssociatedFile,
  AssociatedVideoFile,
  FsGuiYaml,
  Task,
} from '../state/workspaceTypes';

/** Naming state of a row's statescript file (the collapsed Statescript cell axis). */
export type StatescriptNaming = 'generated' | 'manual' | 'none';
/** Presence state of a row's video (the collapsed Video cell axis + the video 3-state). */
export type VideoPresence = 'present' | 'missing' | 'absent';
/** Epoch-row completeness scope (the EpochStatusPill vocabulary). */
export type EpochRowStatus = 'complete' | 'incomplete' | 'needs_video';

/** A joined associated-file reference + its index in `day.associated_files`. */
export interface EpochFileRef {
  /** The stored file entry (by reference — never reshaped). */
  entry: AssociatedFile;
  /** Its index in `day.associated_files` (the write-back target). */
  index: number;
}

/** A joined video reference + its index in `day.associated_video_files`. */
export interface EpochVideoRef {
  /** The stored video entry (by reference — never reshaped). */
  entry: AssociatedVideoFile;
  /** Its index in `day.associated_video_files`. */
  index: number;
}

/** A joined fs_gui (opto) reference + its index in `day.fs_gui_yamls`. */
export interface EpochOptoRef {
  /** The stored fs_gui entry (by reference — never reshaped). */
  entry: FsGuiYaml;
  /** Its index in `day.fs_gui_yamls`. */
  index: number;
}

/** One epoch row of the grid (a join over the day's arrays). */
export interface EpochGridRow {
  /** The distinct epoch number. */
  epoch: number;
  /** Index of the owning task in the resolved task list / `taskInstances` (null = orphan, unreachable). */
  taskInstanceIndex: number | null;
  /** The owning task instance's `taskTypeId` (the value the drill-in's task picker binds to). */
  taskTypeId: string;
  /** The owning task's name. */
  taskName: string;
  /** The owning task's environment. */
  taskEnvironment: string;
  /** Derived display/derivation tag (`s1`, `r2`, etc.) — never stored. */
  tag: string;
  /** The owning task's cameras (`camera_id`). */
  cameras: Array<number | string>;
  /** The statescript file for this epoch, or null when none is bound. */
  statescript: EpochFileRef | null;
  /** Every video bound to this epoch (0..n). */
  videos: EpochVideoRef[];
  /** The fs_gui (opto) row covering this epoch, or null. */
  opto: EpochOptoRef | null;
  /** Collapsed Statescript cell axis: naming state. */
  statescriptNaming: StatescriptNaming;
  /** Collapsed Video cell axis: presence state (3-state). */
  videoPresence: VideoPresence;
  /** Row status pill. */
  status: EpochRowStatus;
  /** Whether this epoch is claimed by more than one task (the uniqueness badge). */
  duplicate: boolean;
}

/** The full epoch-grid view-model. */
export interface EpochGrid {
  /** One row per distinct epoch, ascending. */
  rows: EpochGridRow[];
  /** Epoch numbers claimed by >1 task (from `duplicateTaskEpochs`). */
  duplicateEpochs: number[];
  /** The day's data folder (`day.dataFolder`), or `''`. */
  dataFolder: string;
  /** Whether the owning animal has optogenetics (drives the opto columns). */
  isOpto: boolean;
  /** The `YYYYMMDD` date token used for filename derivation. */
  date: string;
  /** The subject id token used for filename derivation. */
  subjectId: string;
}

/** Whether `value` is a non-null, non-array object record. */
function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

/** Integer-normalized epochs of a task's `task_epochs` (tolerant; non-integers dropped). */
function normalizeEpochs(rawEpochs: unknown): number[] {
  const out: number[] = [];
  (Array.isArray(rawEpochs) ? rawEpochs : []).forEach((value) => {
    const n = Number(value);
    if (Number.isInteger(n)) out.push(n);
  });
  return out;
}

/**
 * Whether a scalar `task_epochs` reference (associated file / video) matches epoch `e`. Tolerant of
 * the singular/plural key spelling the way the validation rules are (compare `Number()`-normalized);
 * the stored value is never rewritten.
 */
function scalarEpochMatches(rawEpoch: unknown, e: number): boolean {
  if (rawEpoch === undefined || rawEpoch === null || rawEpoch === '') return false;
  return Number(rawEpoch) === e;
}

/** Extract the compact file tag (`r1`, `s2`, etc.) from a stored file/video name if present. */
function extractFileTag(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const basename = value.split(/[\\/]/).pop() ?? value;
  const tagPattern = /(?:^|[_\-\s])([a-z]{1,3})(\d+)(?=[_\-\s.]|$)/gi;
  let match: RegExpExecArray | null;
  let found: string | null = null;
  while ((match = tagPattern.exec(basename)) != null) {
    const index = Number(match[2]);
    if (Number.isInteger(index) && index > 0) {
      found = `${match[1].toLowerCase()}${index}`;
    }
  }
  return found;
}

/** Prefer a tag already present on linked statescript/video files; imported names are authoritative. */
function tagFromExistingFiles(statescript: EpochFileRef | null, videos: EpochVideoRef[]): string | null {
  const fromStatescript =
    extractFileTag(statescript?.entry.path) ?? extractFileTag(statescript?.entry.name);
  if (fromStatescript != null) return fromStatescript;

  for (const video of videos) {
    const tag = extractFileTag(video.entry.name);
    if (tag != null) return tag;
  }
  return null;
}

/** Semantic fallback tag prefix for new generated file names when the day has no matching files yet. */
function tagShortCode(taskName: string, taskEnvironment: string): string {
  const text = `${taskName} ${taskEnvironment}`.toLowerCase();
  if (/\b(home|homebox|home box)\b/.test(text)) return 'h';
  if (
    /\b(run|w[-\s]?track|linear[-\s]?track|track|maze|fork|bandit|alternation|haight|exploration|spatial|hex)\b/.test(text)
  ) {
    return 'r';
  }
  if (/\b(sleep|rest)\b/.test(text)) return 's';

  const match = /[a-z]/i.exec(taskName);
  return match ? match[0].toLowerCase() : 't';
}

/** The `YYYYMMDD` date token for derivation, from the day's `YYYY-MM-DD` date. */
function deriveDateToken(date: unknown): string {
  return typeof date === 'string' ? date.replace(/-/g, '') : '';
}

/**
 * Build the epoch grid view-model for a day. One row per distinct epoch number (ascending), joining
 * the resolved tasks + files + videos + fs_gui by epoch. Reads `task_epoch(s)` tolerantly, derives
 * the per-epoch tag + file states, and surfaces duplicate-epoch collisions — without reshaping or
 * mutating the day's stored arrays.
 *
 * @param animal - The owning animal (its task-type catalog + subject + optogenetics).
 * @param day - The recording day (`taskInstances` if catalog-shaped, else inline `tasks`).
 * @returns The epoch grid: rows + duplicate set + derivation context.
 */
export function buildEpochGrid(animal: unknown, day: unknown): EpochGrid {
  const view = resolveDayCatalogView(animal, day);
  // The resolved task at index i corresponds to taskInstances[i] (the write-back target).
  const tasks: Task[] = resolveTaskInstances(view.taskTypes, view.taskInstances);
  const instanceTypeIds = view.taskInstances.map((i) => i?.taskTypeId ?? '');

  const videos = getDayAssociatedVideos(day);
  const files = getDayAssociatedFiles(day);
  const fsgui = getDayFsGuiYamls(day);
  const absentSet = new Set(getDayVideolessEpochs(day));
  const deferredSet = new Set(getDayDeferredEpochs(day));
  const dataFolder = (isRecord(day) && typeof day.dataFolder === 'string' ? day.dataFolder : '') || '';
  const subjectId = getAnimalSubject(animal).subject_id || '';
  const date = deriveDateToken(isRecord(day) ? day.date : undefined);
  const isOpto = isRecord(animal) && animal.optogenetics != null;

  // Each task's integer epochs (computed once); used for the join, the tag occurrence, and the union.
  const taskEpochs: number[][] = tasks.map((t) => normalizeEpochs(t.task_epochs));

  const duplicateEpochs = [...duplicateTaskEpochs(tasks)].sort((a, b) => a - b);
  const duplicateSet = new Set(duplicateEpochs);

  // The ascending set of distinct epoch numbers across all tasks.
  const allEpochs = [...new Set(taskEpochs.flat())].sort((a, b) => a - b);

  const rows: EpochGridRow[] = allEpochs.map((epoch) => {
    // The first task that owns this epoch (a duplicate is flagged separately).
    const taskIndex = taskEpochs.findIndex((epochs) => epochs.includes(epoch));
    const task = taskIndex >= 0 ? tasks[taskIndex] : undefined;
    const taskName = (task?.task_name as string) || '';
    const taskEnvironment = (task?.task_environment as string) || '';
    const cameras = Array.isArray(task?.camera_id) ? (task!.camera_id as Array<number | string>) : [];
    const fileIndex = files.findIndex((f) => scalarEpochMatches(f.task_epochs, epoch));
    const statescript: EpochFileRef | null =
      fileIndex >= 0 ? { entry: files[fileIndex], index: fileIndex } : null;

    const matchedVideos: EpochVideoRef[] = [];
    videos.forEach((entry, index) => {
      if (scalarEpochMatches(entry.task_epochs, epoch)) matchedVideos.push({ entry, index });
    });

    // 1-based occurrence of this epoch among the owning task's sorted epochs → the fallback suffix.
    const ownEpochs = taskIndex >= 0 ? [...taskEpochs[taskIndex]].sort((a, b) => a - b) : [];
    const occurrence = ownEpochs.indexOf(epoch) + 1;
    const tag =
      tagFromExistingFiles(statescript, matchedVideos)
      ?? `${tagShortCode(taskName, taskEnvironment)}${occurrence > 0 ? occurrence : 1}`;

    const optoIndex = fsgui.findIndex((g) => normalizeEpochs(g.epochs).includes(epoch));
    const opto: EpochOptoRef | null = optoIndex >= 0 ? { entry: fsgui[optoIndex], index: optoIndex } : null;

    const statescriptNaming: StatescriptNaming =
      statescript == null
        ? 'none'
        : isDerivedStatescript(statescript.entry, { dataFolder, date, subjectId, epoch, tag })
          ? 'generated'
          : 'manual';

    const videoPresence: VideoPresence = absentSet.has(epoch)
      ? 'absent'
      : matchedVideos.length > 0
        ? 'present'
        : 'missing';

    // Row status: a missing video is the only blocking row state; a task with no name is an
    // incomplete row; otherwise complete (present or declared-absent video).
    const status: EpochRowStatus =
      videoPresence === 'missing'
        ? deferredSet.has(epoch)
          ? 'incomplete'
          : 'needs_video'
        : taskName.trim() === ''
          ? 'incomplete'
          : 'complete';

    return {
      epoch,
      taskInstanceIndex: taskIndex >= 0 ? taskIndex : null,
      taskTypeId: taskIndex >= 0 ? instanceTypeIds[taskIndex] ?? '' : '',
      taskName,
      taskEnvironment,
      tag,
      cameras,
      statescript,
      videos: matchedVideos,
      opto,
      statescriptNaming,
      videoPresence,
      status,
      duplicate: duplicateSet.has(epoch),
    };
  });

  return { rows, duplicateEpochs, dataFolder, isOpto, date, subjectId };
}
