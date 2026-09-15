/**
 * @fileoverview The recording-compatible metadata filename contract.
 *
 * trodes_to_nwb discovers a session's files by name (`data_scanner._process_path`): every file in a
 * session directory is split on `_`, the first token is parsed as an INTEGER date and the second is
 * the animal token, and the converter then groups `.rec` / video / `.yml` files by the exact
 * `(date, animal)` pair. The recordings are named `{YYYYMMDD}_{animal}_{epoch}_{tag}.rec`, so the
 * metadata file MUST be `{YYYYMMDD}_{animal}_metadata.yml` with the SAME date digits and the SAME
 * animal token (the scanner neither reinterprets the date nor case-folds the animal). Any other
 * spelling — `MMDDYYYY`, a lower-cased animal, an animal containing `_` — lands the metadata in a
 * different group and the session converts without it ("There must be exactly one metadata file per
 * session").
 *
 * This module is the single owner of that contract for the workspace export paths: the formatter
 * and the pre-export check that a subject token can be spelled in a recording filename at all. The
 * exported `subject_id` is the scientific identity and is emitted EXACTLY as stored — lookup
 * normalization (case-insensitive duplicate detection) is a separate concern and never leaks into
 * the filename.
 *
 * Pure and dependency-free.
 */

/** A metadata filename issue the export gate surfaces (blocking). */
export interface RecordingFilenameIssue {
  /** Stable issue code. */
  code: 'subject_id_missing' | 'subject_id_not_recording_compatible';
  /** Human-readable explanation naming the fix. */
  message: string;
}

/**
 * The characters a subject token may contain so it survives the converter's `_`-split and is a
 * portable filename component. Real Frank-lab subject ids (140 distinct ids across the collected
 * corpus) all match this; underscores are excluded because the scanner splits on them.
 */
export const RECORDING_SUBJECT_TOKEN_PATTERN = /^[A-Za-z0-9-]+$/;

/**
 * Format the ISO recording date as the converter's integer date token.
 *
 * @param isoDate - `YYYY-MM-DD`.
 * @returns `YYYYMMDD`.
 * @throws If the date is not strict ISO `YYYY-MM-DD`.
 */
export function recordingDateToken(isoDate: string): string {
  if (typeof isoDate !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(isoDate)) {
    throw new Error(`Invalid recording date "${isoDate}": expected ISO YYYY-MM-DD`);
  }
  return isoDate.replace(/-/g, '');
}

/**
 * The metadata filename the converter groups with the recording:
 * `{YYYYMMDD}_{subject_id}_metadata.yml`. The subject token is emitted exactly as stored (no
 * case-folding, no trimming) — a mismatch is a validation issue, never a silent rename.
 *
 * @param args - The recording date (ISO) and the exact subject id.
 * @param args.date - Recording date, `YYYY-MM-DD`.
 * @param args.subjectId - The exported `subject.subject_id`, verbatim.
 * @returns The filename.
 * @throws If the date is not strict ISO.
 */
export function formatRecordingMetadataFilename({ date, subjectId }: { date: string; subjectId: string }): string {
  return `${recordingDateToken(date)}_${subjectId}_metadata.yml`;
}

/**
 * Whether a subject id can be spelled in a recording-compatible filename, and why not when it
 * cannot. Returns `null` for a usable token.
 *
 * @param subjectId - The exported subject id.
 * @returns The blocking issue, or null.
 */
export function recordingFilenameIssue(subjectId: unknown): RecordingFilenameIssue | null {
  if (typeof subjectId !== 'string' || subjectId.length === 0) {
    return {
      code: 'subject_id_missing',
      message: 'Subject ID is required — the metadata filename and the recording files are matched by it.',
    };
  }
  if (!RECORDING_SUBJECT_TOKEN_PATTERN.test(subjectId)) {
    const problem = subjectId.includes('_')
      ? 'contains an underscore, which the converter uses to split filename parts'
      : /\s/.test(subjectId)
        ? 'contains whitespace'
        : 'contains characters that cannot appear in a recording filename';
    return {
      code: 'subject_id_not_recording_compatible',
      message:
        `Subject ID "${subjectId}" ${problem}. Use only letters, digits and hyphens so ` +
        `{date}_{subject}_metadata.yml groups with the {date}_{subject}_{epoch}_{tag}.rec files.`,
    };
  }
  return null;
}

/**
 * Compare a subject token with the animal token of a recording filename the way the converter does:
 * exact, case-sensitive string equality. Exposed so surfaces that know the recording names (a data
 * folder listing, a pilot checklist) can state whether a download will group with them.
 *
 * @param subjectId - The exported subject id.
 * @param recordingAnimalToken - The second `_`-separated token of a `.rec` filename.
 * @returns Whether the converter would put them in the same session group.
 */
export function subjectMatchesRecordingToken(subjectId: string, recordingAnimalToken: string): boolean {
  return subjectId === recordingAnimalToken;
}

/**
 * The export-blocking issue list for a merged day model (the workspace day-validation composer's
 * step). Only the workspace export path names its download by this contract, so this is NOT part
 * of the shared `rulesValidation` (the frozen legacy form names its download differently and
 * blocks on every issue). Animal-owned: the subject id is edited on the animal profile.
 *
 * @param mergedDay - The merged day metadata (reads `subject.subject_id`).
 * @returns Zero or one blocking issue.
 */
export function recordingFilenameIssues(mergedDay: unknown): Array<{
  code: RecordingFilenameIssue['code'];
  path: string;
  field: string;
  step: string;
  actionLabel: string;
  repairSurface: 'animal';
  severity: 'error';
  message: string;
}> {
  const subject =
    mergedDay !== null && typeof mergedDay === 'object' && !Array.isArray(mergedDay)
      ? (mergedDay as { subject?: unknown }).subject
      : undefined;
  const subjectId =
    subject !== null && typeof subject === 'object' && !Array.isArray(subject)
      ? (subject as { subject_id?: unknown }).subject_id
      : undefined;
  // A missing id is the schema's `required` error; a slash is the DANDI rule's. Only the
  // recording-token shape is owned here.
  if (typeof subjectId !== 'string' || subjectId === '' || subjectId.includes('/')) return [];
  const issue = recordingFilenameIssue(subjectId);
  if (!issue) return [];
  return [
    {
      code: issue.code,
      path: 'subject.subject_id',
      field: 'subject_id',
      step: 'overview',
      actionLabel: 'Fix the subject id',
      repairSurface: 'animal',
      severity: 'error',
      message: issue.message,
    },
  ];
}
