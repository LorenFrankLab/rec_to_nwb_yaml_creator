import type { AssociatedFile } from '../state/workspaceTypes';

/** A stored associated-file row plus its original index in `day.associated_files`. */
export interface IndexedAssociatedFile {
  /** Stored row, by reference. */
  entry: AssociatedFile;
  /** Original array index, used for stable repair-focus paths and write-back. */
  index: number;
}

function fileText(file: Partial<AssociatedFile> | null | undefined): string {
  return [file?.name, file?.description, file?.path]
    .filter((value): value is string => typeof value === 'string')
    .join(' ')
    .toLowerCase();
}

/**
 * Whether an associated_files row is an epoch statescript row.
 *
 * `associated_files` is a mixed legacy bucket: statescript logs live next to rare extras such as
 * Psychopy scripts and realtime decoding output. The Day Editor treats statescripts as epoch files
 * and everything else as supplemental. Keep this classifier narrow so "Psychopy script" does not get
 * swept into the statescript workflow merely because it contains the word "script".
 */
export function isStatescriptAssociatedFile(file: Partial<AssociatedFile> | null | undefined): boolean {
  const text = fileText(file);
  return /\bstatescript\b/.test(text) || /statescriptlog/.test(text);
}

/** Return indexed statescript rows from a day's `associated_files`. */
export function getIndexedStatescriptFiles(files: AssociatedFile[]): IndexedAssociatedFile[] {
  return files
    .map((entry, index) => ({ entry, index }))
    .filter(({ entry }) => isStatescriptAssociatedFile(entry));
}

/** Return indexed true supplemental rows from a day's `associated_files`. */
export function getIndexedSupplementalFiles(files: AssociatedFile[]): IndexedAssociatedFile[] {
  return files
    .map((entry, index) => ({ entry, index }))
    .filter(({ entry }) => !isStatescriptAssociatedFile(entry));
}
