/**
 * @fileoverview Per-epoch statescript / video filename derivation (Phase 4 — epoch grid).
 *
 * The Frank-lab recording convention names each epoch's in-folder files
 * `{YYYYMMDD}_{subjectId}_{epoch:02d}_{tag}{ext}` — `.stateScriptLog` for the statescript log and
 * `.{index}.h264` for a video. Derivation is an **authoring convenience that computes the values the
 * export already stores**: `associated_files[].path` is the full `dataFolder + name`, and
 * `associated_video_files[].name` is the bare name. Existing / imported files keep their explicit
 * stored values — derivation only governs files the user authors in the grid, and a stored value that
 * diverges from the derived one is classified `manual` (and round-trips verbatim, so the byte-identity
 * gate is never moved).
 *
 * The token order/case is PINNED against the golden `associated_video_files[].name`
 * (`20230622_sample_01_a1.1.h264`); see `__tests__/fileNaming.test.ts`. The in-folder names use
 * `YYYYMMDD` (NOT the `mmddYYYY` of the download filename via `formatDeterministicFilename`).
 *
 * Pure and dependency-free.
 */

/** The tokens that name one epoch's files (everything but the data folder + extension). */
export interface FileNameTokens {
  /** Experiment date as `YYYYMMDD` (the in-folder token, NOT the download `mmddYYYY`). */
  date: string;
  /** Subject identifier (the `{subject}` token). */
  subjectId: string;
  /** Epoch number (rendered `:02d`, widening past 99). */
  epoch: number;
  /** Sleep/run category tag, e.g. `s1` / `r1` (category code + 1-based occurrence). */
  tag: string;
}

/** The video tokens, plus the 1-based video index that names the `.{index}.h264` segment. */
export interface VideoNameTokens extends FileNameTokens {
  /** 1-based index among that epoch's videos (defaults to 1). */
  index?: number;
}

/** The statescript classification context: the file-name tokens plus the day's data folder. */
export interface StatescriptContext extends FileNameTokens {
  pathTemplate?: string;
  /** The day's data folder (`day.dataFolder`); absent/empty → nothing derives (always `manual`). */
  dataFolder?: string;
}

/** The stored associated file shape the classifier reads. */
export interface StoredStatescriptFile {
  /** The stored full path (`associated_files[].path`). */
  path?: string;
}

/** The stored associated video shape the classifier reads. */
export interface StoredVideoFile {
  /** The stored video name (`associated_video_files[].name`). */
  name?: string;
}

/** `{date}_{subjectId}_{epoch:02d}_{tag}` — the stem shared by both file types. */
function nameStem({ date, subjectId, epoch, tag }: FileNameTokens): string {
  return `${date}_${subjectId}_${String(epoch).padStart(2, '0')}_${tag}`;
}

/**
 * The derived statescript-log name for an epoch: `{date}_{subjectId}_{epoch:02d}_{tag}.stateScriptLog`.
 *
 * @param tokens - The file-name tokens.
 * @returns The derived `.stateScriptLog` name.
 */
export function deriveStatescriptName(tokens: FileNameTokens): string {
  return `${nameStem(tokens)}.stateScriptLog`;
}

/**
 * The derived video name for an epoch: `{date}_{subjectId}_{epoch:02d}_{tag}.{index}.h264` (index
 * defaults to 1). Pinned against the golden `associated_video_files[].name`.
 *
 * @param tokens - The video tokens (incl. the optional 1-based `index`).
 * @returns The derived `.h264` name.
 */
export function deriveVideoName(tokens: VideoNameTokens): string {
  const index = tokens.index ?? 1;
  return `${nameStem(tokens)}.${index}.h264`;
}

/**
 * Join a data folder and a derived name into the full path the export stores in
 * `associated_files[].path`. Collapses a trailing slash on the folder; an empty folder yields the
 * bare name (nothing to root it against).
 *
 * @param dataFolder - The day's data folder (may be empty or end with `/`).
 * @param name - The derived file name.
 * @returns The joined path.
 */
export function deriveStatescriptPath(dataFolder: string, name: string): string {
  const base = (dataFolder || '').replace(/\/+$/, '');
  return base ? `${base}/${name}` : name;
}

/**
 * Whether a stored statescript file's `path` matches what derivation would produce for its epoch —
 * i.e. it is a `generated` (not hand-authored `manual`) value. With no data folder there is nothing
 * to derive a full path against, so the file is always `manual` (this is what keeps the golden
 * placeholder `associated_files` — `path: 'path/'`, no `dataFolder` — classified `manual` and
 * round-tripping verbatim).
 *
 * @param file - The stored associated file (reads `path`).
 * @param ctx - The derivation context (data folder + file-name tokens).
 * @returns True when the stored path equals the derived path.
 */
export function isDerivedStatescript(file: StoredStatescriptFile, ctx: StatescriptContext): boolean {
  if (!ctx.dataFolder) return false;
  return file.path === deriveEpochStatescript(ctx).path;
}

/**
 * Whether a stored video's `name` matches what derivation would produce for its epoch + index — i.e.
 * it is a `generated` (not hand-authored `manual`) value.
 *
 * @param video - The stored associated video file (reads `name`).
 * @param ctx - The derivation context (file-name tokens + optional 1-based index).
 * @returns True when the stored name equals the derived name.
 */
export function isDerivedVideo(video: StoredVideoFile, ctx: VideoNameTokens): boolean {
  return video.name === deriveVideoName(ctx);
}

export const DEFAULT_STATESCRIPT_TEMPLATE = '{stem}.stateScriptLog';
const TEMPLATE_TOKENS = ['date', 'subject', 'epoch', 'epoch:02d', 'tag', 'stem'];

/** Reject typos and paths that escape the selected base folder before applying a pattern. */
export function statescriptTemplateError(pattern: string): string | null {
  if (!pattern.trim()) return 'Enter a path pattern.';
  const unknown = [...pattern.matchAll(/\{([^{}]+)\}/g)].find((match) => !TEMPLATE_TOKENS.includes(match[1]));
  if (unknown) return `Unknown token ${unknown[0]}. Use date, subject, epoch, epoch:02d, tag, or stem.`;
  if (/[{}]/.test(pattern.replace(/\{([^{}]+)\}/g, 'token'))) return 'Check the braces in the path pattern.';
  if (pattern.startsWith('/') || pattern.includes('\\') || pattern.split('/').some((part) => !part || part === '.' || part === '..')) {
    return 'Use a relative path inside the base folder, without empty, . or .. segments.';
  }
  if (!/\{(?:epoch(?::02d)?|stem)\}/.test(pattern.split('/').pop() ?? '')) return 'Include {epoch}, {epoch:02d}, or {stem} in the filename so each epoch has its own name.';
  if (!pattern.endsWith('.stateScriptLog')) return 'The filename must end with .stateScriptLog.';
  return null;
}

/** Expand a relative directory/filename pattern for one epoch. Defaults cover older workspaces. */
export function deriveEpochStatescript(ctx: StatescriptContext): { name: string; path: string } {
  const pattern = ctx.pathTemplate && !statescriptTemplateError(ctx.pathTemplate)
    ? ctx.pathTemplate : DEFAULT_STATESCRIPT_TEMPLATE;
  const values: Record<string, string> = {
    date: ctx.date, subject: ctx.subjectId, epoch: String(ctx.epoch),
    'epoch:02d': String(ctx.epoch).padStart(2, '0'), tag: ctx.tag, stem: nameStem(ctx),
  };
  const relative = pattern.replace(/\{([^{}]+)\}/g, (_, token: string) => values[token]);
  return { name: relative.split('/').pop()!, path: deriveStatescriptPath(ctx.dataFolder ?? '', relative) };
}
