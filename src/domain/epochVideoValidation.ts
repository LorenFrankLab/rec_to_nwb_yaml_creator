/**
 * @fileoverview The video-declaration readiness rule (Phase 4 — the ONE authorized new rule).
 *
 * {@link epochVideoUndeclared} flags every task epoch that has neither a bound video NOR an explicit
 * `videolessEpochs` ("no video recorded") declaration — the blocking `missing` half of the video
 * 3-state. It reads the day's task epochs (catalog `taskInstances` OR inline `tasks`), its
 * `associated_video_files`, and the OFF-EXPORT `videolessEpochs` set ONLY — it never reads the merged
 * YAML, and `mergeDayMetadata` reads no `day.state`, so the rule cannot move a byte baseline (it adds
 * an issue, nothing more). It is composed into {@link module:domain/dayValidationComposer}'s
 * `validateDay` as a day-readiness blocker; it must NOT enter `validate(mergedDay)` (which is
 * export-shaped). Row status for a flagged epoch is `Needs video`.
 *
 * The inverse rule already exists (`referenceRules.orphaned_video` — a video pointing at a
 * non-existent epoch); this is the missing direction (an epoch that should have a video but doesn't,
 * and wasn't declared video-less). Pure aside from the guarded selector reads.
 */

import {
  getDayTasks,
  getDayTaskInstances,
  getDayAssociatedVideos,
  getDayVideolessEpochs,
} from '../state/workspaceSelectors';
import type { RepairableIssue } from './repairRouting';

/** Integer-normalized epochs of a `task_epochs` array (tolerant; non-integers dropped). */
function normalizeEpochs(rawEpochs: unknown): number[] {
  const out: number[] = [];
  (Array.isArray(rawEpochs) ? rawEpochs : []).forEach((value) => {
    const n = Number(value);
    if (Number.isInteger(n)) out.push(n);
  });
  return out;
}

/**
 * The ascending set of distinct task epoch numbers a day declares, read from BOTH `taskInstances`
 * (catalog shape — carries its own `task_epochs`) and inline `tasks`. No animal is needed: an
 * instance owns its epochs (only its definition lives on the animal), so the day alone is sufficient.
 *
 * @param day - The recording day.
 * @returns The distinct task epoch numbers (Number-normalized).
 */
function dayTaskEpochs(day: unknown): number[] {
  const epochs = new Set<number>();
  const instances = getDayTaskInstances(day);
  const source = instances !== null ? instances : getDayTasks(day);
  for (const task of source) {
    normalizeEpochs((task as { task_epochs?: unknown })?.task_epochs).forEach((e) => epochs.add(e));
  }
  return [...epochs].sort((a, b) => a - b);
}

/**
 * Blocking readiness issues for each task epoch with no bound video and no `videolessEpochs`
 * declaration (the video 3-state's `missing`). Reads the day's arrays + the off-export absent set
 * only — never the merged YAML.
 *
 * @param day - The recording day.
 * @returns One blocking `epoch_video_undeclared` issue per undeclared video-less epoch.
 */
export function epochVideoUndeclared(day: unknown): RepairableIssue[] {
  const taskEpochs = dayTaskEpochs(day);
  if (taskEpochs.length === 0) return [];

  // Epochs that have at least one bound video (tolerant scalar `task_epochs` read).
  const videoEpochs = new Set<number>();
  for (const video of getDayAssociatedVideos(day)) {
    const raw = video?.task_epochs;
    if (raw === undefined || raw === null || raw === '') continue;
    const n = Number(raw);
    if (Number.isInteger(n)) videoEpochs.add(n);
  }
  const declaredVideoless = new Set(getDayVideolessEpochs(day));

  return taskEpochs
    .filter((epoch) => !videoEpochs.has(epoch) && !declaredVideoless.has(epoch))
    .map((epoch) => ({
      path: 'associated_video_files',
      field: 'video',
      focusPath: `epoch-${epoch}-video`,
      step: 'epochs',
      actionLabel: `Fix in Epoch ${epoch}`,
      code: 'epoch_video_undeclared',
      repairSurface: 'day',
      severity: 'error',
      message:
        `Epoch ${epoch} has a task but no video file linked, and it isn't marked "no video". ` +
        `Add the video for this epoch, or mark it as having no video.`,
    }));
}
