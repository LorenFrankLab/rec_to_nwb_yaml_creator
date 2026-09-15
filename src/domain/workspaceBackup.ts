/**
 * @fileoverview Pure helpers for the portable workspace backup / restore flow (finding F8).
 *
 * A backup is the persisted workspace envelope in a file — drafts, incomplete days, configuration
 * history, provenance and export receipts included verbatim. Restoring REPLACES the current
 * workspace, so the user sees a preview (what the file holds, and what the replacement would add or
 * drop relative to what is open now) before confirming. Everything here is pure and shape-tolerant.
 */

import { getAnimalDayIds } from '../state/workspaceSelectors';
import { isRecord } from '../utils/records';

/** A compact description of a workspace, for the restore preview. */
export interface WorkspaceSummary {
  animals: number;
  days: number;
  /** Days still in draft (not validated/exported). */
  incompleteDays: number;
  /** Days with an export receipt or the legacy exported flag. */
  exportedDays: number;
  /** Earliest / latest recording date across all days (`YYYY-MM-DD`), or null. */
  firstDate: string | null;
  lastDate: string | null;
  /** The workspace `lastModified` stamp, or null. */
  lastModified: string | null;
  /** Animal ids, sorted. */
  animalIds: string[];
}

/**
 * Summarize a workspace slice.
 *
 * @param workspace - Any workspace-shaped value.
 * @returns The summary.
 */
export function summarizeWorkspace(workspace: unknown): WorkspaceSummary {
  const ws = isRecord(workspace) ? workspace : {};
  const animals = isRecord(ws.animals) ? ws.animals : {};
  const days = isRecord(ws.days) ? ws.days : {};
  const dayRecords = Object.values(days).filter(isRecord);
  const dates = dayRecords
    .map((d) => (typeof d.date === 'string' ? d.date : ''))
    .filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d))
    .sort();
  const incompleteDays = dayRecords.filter((d) => {
    const state = isRecord(d.state) ? d.state : {};
    return state.draft !== false && !state.exported && !state.validated;
  }).length;
  const exportedDays = dayRecords.filter((d) => {
    const state = isRecord(d.state) ? d.state : {};
    return Boolean(state.exported) || isRecord(d.exportReceipt);
  }).length;
  return {
    animals: Object.keys(animals).length,
    days: dayRecords.length,
    incompleteDays,
    exportedDays,
    firstDate: dates[0] ?? null,
    lastDate: dates[dates.length - 1] ?? null,
    lastModified: typeof ws.lastModified === 'string' ? ws.lastModified : null,
    animalIds: Object.keys(animals).sort(),
  };
}

/** What replacing `current` with `incoming` would change, at the animal/day level. */
export interface WorkspaceReplacementDiff {
  /** Animal ids present now but absent from the incoming workspace (would be LOST). */
  animalsDropped: string[];
  /** Animal ids only in the incoming workspace (would be added). */
  animalsAdded: string[];
  /** Day ids present now but absent from the incoming workspace (would be LOST). */
  daysDropped: string[];
  /** Day ids only in the incoming workspace. */
  daysAdded: string[];
  /** Day ids present in both whose record differs (the incoming version wins). */
  daysChanged: string[];
  /** Whether the current workspace has any content at all. */
  currentIsEmpty: boolean;
}

/**
 * Compare the open workspace with a candidate replacement.
 *
 * @param current - The workspace open now.
 * @param incoming - The workspace a restore would install.
 * @returns The replacement diff.
 */
export function diffWorkspaceReplacement(current: unknown, incoming: unknown): WorkspaceReplacementDiff {
  const cur = isRecord(current) ? current : {};
  const inc = isRecord(incoming) ? incoming : {};
  const curAnimals = isRecord(cur.animals) ? cur.animals : {};
  const incAnimals = isRecord(inc.animals) ? inc.animals : {};
  const curDays = isRecord(cur.days) ? cur.days : {};
  const incDays = isRecord(inc.days) ? inc.days : {};
  const curAnimalIds = new Set(Object.keys(curAnimals));
  const incAnimalIds = new Set(Object.keys(incAnimals));
  const curDayIds = new Set(Object.keys(curDays));
  const incDayIds = new Set(Object.keys(incDays));
  const daysChanged = [...curDayIds]
    .filter((id) => incDayIds.has(id))
    .filter((id) => JSON.stringify(curDays[id]) !== JSON.stringify(incDays[id]))
    .sort();
  return {
    animalsDropped: [...curAnimalIds].filter((id) => !incAnimalIds.has(id)).sort(),
    animalsAdded: [...incAnimalIds].filter((id) => !curAnimalIds.has(id)).sort(),
    daysDropped: [...curDayIds].filter((id) => !incDayIds.has(id)).sort(),
    daysAdded: [...incDayIds].filter((id) => !curDayIds.has(id)).sort(),
    daysChanged,
    currentIsEmpty:
      curAnimalIds.size === 0 &&
      curDayIds.size === 0 &&
      Object.values(curAnimals).every((a) => getAnimalDayIds(a).length === 0),
  };
}

/**
 * The default backup filename: `rec_to_nwb_workspace_<YYYYMMDD-HHMM>.json`.
 *
 * @param now - The current time.
 * @returns The filename.
 */
export function backupFilename(now: Date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  const stamp = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}`;
  return `rec_to_nwb_workspace_${stamp}.json`;
}

/**
 * Estimate how much of the smallest supported localStorage quota (5 MiB) the autosave blob uses.
 *
 * @param workspace - The workspace slice.
 * @returns Bytes and the fraction of the 5 MiB budget.
 */
export function estimateStorageUse(workspace: unknown): { bytes: number; fraction: number } {
  let bytes = 0;
  try {
    bytes = new TextEncoder().encode(JSON.stringify({ schemaVersion: 0, workspace })).length;
  } catch {
    bytes = 0;
  }
  return { bytes, fraction: bytes / (5 * 1024 * 1024) };
}
