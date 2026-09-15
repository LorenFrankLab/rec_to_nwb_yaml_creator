/**
 * @fileoverview Export receipts and download freshness (finding F6).
 *
 * `state.exported = true` used to stay true through every later edit, so a corrected weight still
 * read "Exported". A download now leaves a RECEIPT — filename, timestamp, app/schema versions and a
 * content hash of `filename + "\n" + yaml` — and "Changed since download" is DERIVED by hashing the
 * current effective export (the same merge + encoder the download uses, including the filename, so
 * an identity/date-token change counts) and comparing. A download is not evidence of a successful
 * conversion; that is a different event.
 *
 * The exact bytes are kept in the IndexedDB side store (`receipt:<dayId>`) so the scientist can
 * inspect what changed; the receipt itself stays small (the autosave blob is localStorage-bound).
 */

import { encodeYaml } from '../io/yaml';
import { mergeDayMetadata } from '../state/workspaceUtils';
import { getAnimalSubject } from '../state/workspaceSelectors';
import { isRecord } from '../utils/records';
import { sha256Hex } from '../utils/sha256';
import { formatRecordingMetadataFilename } from './recordingFilename';
import type { Animal, Day, ExportReceipt } from '../state/workspaceTypes';

/** Side-store key prefix for a day's last exported bytes. */
export const RECEIPT_YAML_KEY_PREFIX = 'receipt:';

/**
 * The side-store key holding a receipt's YAML bytes: the receipt's own `yamlKey` when it names one
 * (a restored receipt refers to the write-once key its restore attempt wrote), else the day's
 * default key (`receipt:<dayId>`, where a download in this browser puts them).
 *
 * @param dayId - The day id.
 * @param receipt - The receipt (or anything with an optional `yamlKey`).
 * @returns The key.
 */
export function receiptYamlKey(dayId: string, receipt: { yamlKey?: unknown } | null | undefined): string {
  return typeof receipt?.yamlKey === 'string' && receipt.yamlKey !== '' ? receipt.yamlKey : `${RECEIPT_YAML_KEY_PREFIX}${dayId}`;
}

/** The app version stamped into receipts (package.json is not importable in the browser bundle). */
export const RECEIPT_APP_VERSION = '3.0.0-modern';

/**
 * The receipt hash: SHA-256 over the filename AND the bytes, so a filename change alone is a change.
 *
 * @param filename - The download filename.
 * @param yaml - The YAML text.
 * @returns Hex digest.
 */
export function receiptHash(filename: string, yaml: string): string {
  return sha256Hex(`${filename}\n${yaml}`);
}

/** The current effective export of a day: what a download right now would produce. */
export interface ExportArtifact {
  filename: string;
  yaml: string;
  hash: string;
}

/**
 * Compute the current effective export (merge → encode → filename → hash), or null when the merge
 * cannot resolve (corrupt configuration).
 *
 * @param animal - The owning animal.
 * @param day - The recording day.
 * @returns The artifact, or null.
 */
export function currentExportArtifact(animal: Animal, day: Day): ExportArtifact | null {
  try {
    const yaml = encodeYaml(mergeDayMetadata(animal, day));
    const filename = formatRecordingMetadataFilename({
      date: day.date,
      subjectId: String(getAnimalSubject(animal).subject_id ?? ''),
    });
    return { filename, yaml, hash: receiptHash(filename, yaml) };
  } catch {
    return null;
  }
}

/**
 * Build the receipt for a completed download.
 *
 * @param args - Filename, yaml, timestamp, schema version, and whether the bytes were stored.
 * @param args.filename - The downloaded filename.
 * @param args.yaml - The downloaded bytes.
 * @param args.now - ISO timestamp of the download.
 * @param args.schemaVersion - Persisted-workspace schema version.
 * @param args.yamlStored - Whether the bytes were put in the side store.
 * @param args.dayLastModified - The day's `lastModified` at export (cache key).
 * @param args.animalLastModified - The animal's `lastModified` at export (cache key).
 * @returns The receipt.
 */
export function buildExportReceipt({
  filename,
  yaml,
  now,
  schemaVersion,
  yamlStored,
  dayLastModified,
  animalLastModified,
}: {
  filename: string;
  yaml: string;
  now: string;
  schemaVersion: number;
  yamlStored: boolean;
  dayLastModified?: string;
  animalLastModified?: string;
}): ExportReceipt {
  return {
    filename,
    exportedAt: now,
    contentHash: receiptHash(filename, yaml),
    appVersion: RECEIPT_APP_VERSION,
    schemaVersion,
    yamlStored,
    ...(dayLastModified ? { dayLastModified } : {}),
    ...(animalLastModified ? { animalLastModified } : {}),
  };
}

/** Download freshness of a day. */
export type ExportFreshness =
  /** Never downloaded. */
  | 'never'
  /** The current effective export equals the last download (filename and bytes). */
  | 'current'
  /** The current effective export differs from the last download. */
  | 'changed'
  /** Downloaded by a pre-receipt version; content cannot be compared. */
  | 'unverified';

/** The freshness verdict plus what differs. */
export interface ExportFreshnessResult {
  status: ExportFreshness;
  receipt: ExportReceipt | null;
  /** Which parts differ (`filename` is reported when the name changed; `content` otherwise/also). */
  differs: Array<'filename' | 'content'>;
}

/**
 * Derive a day's download freshness from its receipt and the current effective export.
 *
 * @param animal - The owning animal.
 * @param day - The recording day.
 * @param artifact - The current export artifact when the caller already computed it (else computed
 *   here; null when the merge cannot resolve — then a receipt-bearing day reads `changed`).
 * @returns The verdict.
 */
export function exportFreshness(
  animal: Animal,
  day: Day,
  artifact: ExportArtifact | null | undefined = undefined
): ExportFreshnessResult {
  const receipt = isRecord(day?.exportReceipt) ? (day.exportReceipt as ExportReceipt) : null;
  if (!receipt) return { status: 'never', receipt: null, differs: [] };
  if (receipt.unverified || !receipt.contentHash) return { status: 'unverified', receipt, differs: [] };
  // Fast path: nothing feeding the export has been edited since the download.
  if (
    receipt.dayLastModified &&
    receipt.animalLastModified &&
    receipt.dayLastModified === day.lastModified &&
    receipt.animalLastModified === animal.lastModified
  ) {
    return { status: 'current', receipt, differs: [] };
  }
  const current = artifact === undefined ? currentExportArtifact(animal, day) : artifact;
  if (!current) return { status: 'changed', receipt, differs: ['content'] };
  if (current.hash === receipt.contentHash) return { status: 'current', receipt, differs: [] };
  const differs: Array<'filename' | 'content'> = [];
  if (current.filename !== receipt.filename) differs.push('filename');
  // The hash covers both; if only the filename changed the bytes may still be identical, but the
  // download as a whole is different either way.
  if (differs.length === 0 || receiptHash(receipt.filename, current.yaml) !== receipt.contentHash) {
    differs.push('content');
  }
  return { status: 'changed', receipt, differs };
}

/**
 * Build the export artifact from an ALREADY-merged model (callers that merged for validation), so
 * the freshness check does not merge twice.
 *
 * @param animal - The owning animal.
 * @param day - The recording day.
 * @param mergedDay - `mergeDayMetadata(animal, day)`.
 * @returns The artifact, or null when the filename cannot be formed.
 */
export function artifactFromMerged(animal: Animal, day: Day, mergedDay: Record<string, unknown>): ExportArtifact | null {
  try {
    const yaml = encodeYaml(mergedDay);
    const filename = formatRecordingMetadataFilename({
      date: day.date,
      subjectId: String(getAnimalSubject(animal).subject_id ?? ''),
    });
    return { filename, yaml, hash: receiptHash(filename, yaml) };
  } catch {
    return null;
  }
}

/**
 * The freshness STATUS for a day, computing the artifact from an already-merged model when one is
 * supplied (or skipping the hash entirely via the receipt's cache stamps / when there is no receipt).
 *
 * @param animal - The owning animal.
 * @param day - The recording day.
 * @param mergedDay - The merged model when the caller has it.
 * @returns The freshness status.
 */
export function exportFreshnessStatus(
  animal: unknown,
  day: unknown,
  mergedDay: Record<string, unknown> | null = null
): ExportFreshness {
  if (!isRecord(day) || !isRecord(animal)) return 'never';
  const typedDay = day as unknown as Day;
  const typedAnimal = animal as unknown as Animal;
  const receipt = isRecord(typedDay.exportReceipt) ? (typedDay.exportReceipt as ExportReceipt) : null;
  if (!receipt) return 'never';
  if (receipt.unverified || !receipt.contentHash) return 'unverified';
  if (
    receipt.dayLastModified &&
    receipt.animalLastModified &&
    receipt.dayLastModified === typedDay.lastModified &&
    receipt.animalLastModified === typedAnimal.lastModified
  ) {
    return 'current';
  }
  const artifact = mergedDay ? artifactFromMerged(typedAnimal, typedDay, mergedDay) : currentExportArtifact(typedAnimal, typedDay);
  return exportFreshness(typedAnimal, typedDay, artifact).status;
}
