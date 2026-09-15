/**
 * @fileoverview Workspace persistence to localStorage.
 *
 * Serializes ONLY the workspace slice (animals + days + settings). Legacy formData
 * is never persisted, and nothing that is itself YAML output is ever persisted.
 *
 * Stored shape: { schemaVersion: <int>, workspace }. `loadWorkspace` returns bare
 * `null` only for a missing blob / unavailable storage; an unusable blob (parse error,
 * version mismatch, malformed shape) returns `{ workspace: null, discarded }`, and a
 * structurally-incomplete-but-valid blob returns `{ workspace, recovered }`. See the
 * `loadWorkspace` JSDoc for the full return contract.
 */

import { normalizeWorkspaceDevices } from '../utils/deviceNormalization';
import { createDefaultWorkspace } from './workspaceUtils';
import { migrateWorkspace, WORKSPACE_SCHEMA_VERSION } from './workspaceMigrations';
import { WRITER_ID } from './writerLock';
import { getBlob, putBlob, deleteBlob } from './blobStore';
import { receiptHash, receiptYamlKey, RECEIPT_YAML_KEY_PREFIX } from '../domain/exportReceipt';

// Re-exported so consumers keep importing the current schema version from the persistence layer
// (its public home), while the migration registry owns its definition + the forward migrators.
export { WORKSPACE_SCHEMA_VERSION };

/** Top-level sections every consumer reads directly (and would crash on if missing). */
const REQUIRED_WORKSPACE_KEYS = ['animals', 'days', 'settings'];

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value);

/**
 * Shape-checks a hydrated workspace's required top-level sections (`animals`, `days`,
 * `settings`), distinguishing two cases that must be handled differently:
 *
 * - **Absent** (`undefined`/`null`, i.e. a structurally empty/partial blob such as
 *   `{schemaVersion, workspace:{}}` from an older/aborted write): restore from the
 *   canonical default shape so the blob hydrates cleanly instead of leaving a consumer
 *   to hit `Object.keys(undefined)`. Reported via `missingKeys` for a recovery notice.
 * - **Present but wrong-typed** (e.g. `animals` is an array/string): genuine
 *   corruption, NOT absence. It is reported via `corruptKeys` and is NOT silently
 *   overwritten here — the caller discards the blob loudly rather than destroying real
 *   data while telling the user it was merely "missing".
 *
 * Existing valid sections are preserved untouched.
 *
 * @param workspace - The (device-normalized) workspace to shape-check.
 * @returns The (absent-filled) workspace, the restored-from-absent sections, and the
 *   present-but-corrupt sections.
 */
function ensureWorkspaceShape(workspace: Record<string, unknown>): {
  workspace: Record<string, unknown>;
  missingKeys: string[];
  corruptKeys: string[];
} {
  const defaults = createDefaultWorkspace();
  const result: Record<string, unknown> = { ...workspace };
  const missingKeys: string[] = [];
  const corruptKeys: string[] = [];

  REQUIRED_WORKSPACE_KEYS.forEach((key) => {
    const value = workspace[key];
    if (value === undefined || value === null) {
      missingKeys.push(key);
      result[key] = (defaults as Record<string, unknown>)[key];
    } else if (!isPlainObject(value)) {
      corruptKeys.push(key);
    }
  });

  return { workspace: result, missingKeys, corruptKeys };
}

/**
 * Drop transient validation-presentation deferrals from a hydrated workspace. These flags mean
 * "freshly created in this app session"; once data is loaded from storage it must surface real
 * validation again, while preserving every durable state field.
 *
 * @param workspace - A shape-checked workspace.
 * @returns The workspace with load-stale deferral flags removed from day state.
 */
function clearLoadedValidationDeferrals(workspace: Record<string, unknown>): Record<string, unknown> {
  if (!isPlainObject(workspace.days)) return workspace;
  let changed = false;
  const days = Object.fromEntries(
    Object.entries(workspace.days).map(([dayId, day]) => {
      if (!isPlainObject(day) || !isPlainObject(day.state)) return [dayId, day];
      if (!('validationDeferred' in day.state) && !('deferredEpochs' in day.state)) return [dayId, day];
      const nextState = { ...day.state };
      delete nextState.validationDeferred;
      delete nextState.deferredEpochs;
      changed = true;
      return [dayId, { ...day, state: nextState }];
    })
  );
  return changed ? { ...workspace, days } : workspace;
}

/** localStorage key for the persisted workspace blob. */
export const WORKSPACE_STORAGE_KEY = 'rec_to_nwb_workspace_v1';
/** localStorage key for the write-revision stamp `{ revision, writerId, savedAt }`. */
export const WORKSPACE_META_KEY = 'rec_to_nwb_workspace_v1.meta';
/**
 * Side-store (IndexedDB, see `blobStore`) key holding the ORIGINAL bytes of a blob that could not
 * be loaded (parse error / version mismatch / malformed), written BEFORE the main key is cleared so
 * the recovery source is never discarded (review finding F8). `{ savedAt, reason, raw }`.
 */
export const WORKSPACE_QUARANTINE_KEY = 'rec_to_nwb_workspace_v1.quarantine';
/**
 * Side-store key holding the original bytes of the last blob that was forward-migrated, so a
 * migration bug can be diagnosed and undone. `{ savedAt, reason: 'migration', schemaVersion, raw }`.
 */
export const WORKSPACE_PREMIGRATION_KEY = 'rec_to_nwb_workspace_v1.premigration';
/**
 * Side-store key of the last-known-good checkpoint: the most recent blob that (a) hydrated
 * cleanly at session start or (b) was written by an EXPLICIT save. Distinct from the autosave
 * key so a corrupting sequence of autosaves can be rolled back. `{ savedAt, schemaVersion, raw }`.
 *
 * The copies live in IndexedDB rather than localStorage on purpose: a representative long study
 * (3 animals × 200 days, 128 channels) measures ~2.5 MiB per envelope, so four localStorage copies
 * would not fit the smallest supported quota (5 MiB). See storageBudget.test.js.
 */
export const WORKSPACE_CHECKPOINT_KEY = 'rec_to_nwb_workspace_v1.checkpoint';

/** A preserved copy of raw workspace bytes (quarantine / pre-migration / checkpoint). */
export interface PreservedBlob {
  /** ISO timestamp of when the copy was made. */
  savedAt: string;
  /** Why it was kept (quarantine reason, `migration`, or `checkpoint`). */
  reason: string;
  /** The stored `schemaVersion` of the copy when known. */
  schemaVersion?: number;
  /** The original bytes. */
  raw: string;
}

/**
 * Thrown by {@link saveWorkspace} when another tab has written a NEWER revision than this tab has
 * seen — the write is refused so the other tab's work is not overwritten (finding F4).
 */
export class WorkspaceConflictError extends Error {
  constructor(message = 'Another tab has saved a newer version of this workspace; this tab did not overwrite it.') {
    super(message);
    this.name = 'WorkspaceConflictError';
  }
}

/** The revision stamp stored under {@link WORKSPACE_META_KEY}. */
interface WorkspaceMeta {
  revision: number;
  writerId: string;
  savedAt: string;
}

// The last revision this tab loaded or wrote. A save refuses to overwrite a newer one.
let lastSeenRevision = 0;

function readMeta(): WorkspaceMeta | null {
  try {
    const raw = window.localStorage.getItem(WORKSPACE_META_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<WorkspaceMeta>;
    if (typeof parsed.revision !== 'number') return null;
    return {
      revision: parsed.revision,
      writerId: typeof parsed.writerId === 'string' ? parsed.writerId : '',
      savedAt: typeof parsed.savedAt === 'string' ? parsed.savedAt : '',
    };
  } catch {
    return null;
  }
}

/**
 * The write revision currently in storage (0 when none).
 *
 * @returns The stored revision.
 */
export function readWorkspaceRevision(): number {
  return readMeta()?.revision ?? 0;
}

/**
 * Adopt the revision currently in storage as "seen" — call after (re)hydrating from storage so a
 * later save is not refused as a conflict.
 */
export function syncRevisionFromStorage(): void {
  lastSeenRevision = readWorkspaceRevision();
}

/**
 * Whether storage holds a revision this tab has not loaded (another tab saved since).
 *
 * @returns True when a newer revision exists.
 */
export function hasUnseenRevision(): boolean {
  const meta = readMeta();
  return meta != null && meta.revision !== lastSeenRevision && meta.writerId !== WRITER_ID;
}

// Side-store writes are asynchronous and fire-and-forget from the synchronous load/save paths; the
// last one is tracked so callers (tests, the backup panel) can await settlement.
let pendingPreserve: Promise<unknown> = Promise.resolve();

/** Queue a side-store write; resolves true when IndexedDB durably accepted it. */
function preserveRaw(key: string, raw: string, reason: string, schemaVersion?: number): Promise<boolean> {
  const record: PreservedBlob = { savedAt: new Date().toISOString(), reason, raw };
  if (schemaVersion !== undefined) record.schemaVersion = schemaVersion;
  const write = pendingPreserve.then(() => putBlob(key, record)).catch(() => false);
  pendingPreserve = write;
  return write;
}

// The unusable blob quarantined by the most recent `loadWorkspace` (its bytes, its record, and
// the pending IndexedDB write), so `discardUnusableWorkspace` can confirm durability before the
// main key is cleared. Cleared once the discard completes.
let pendingQuarantine: { record: PreservedBlob; durable: Promise<boolean> } | null = null;

/** Where a discarded workspace's original bytes were durably kept (null = nowhere yet). */
export type PreservedWhere = 'indexeddb' | 'localstorage' | null;

/**
 * Finish discarding an unusable saved workspace (after `loadWorkspace` reported `discarded`):
 * wait for the quarantine write to be ACKNOWLEDGED by IndexedDB, or fall back to a localStorage
 * copy, and only then remove the main key and adopt the leftover revision stamp. If neither store
 * accepted the copy the main key is left in place (the app keeps running on an empty workspace,
 * but cannot save over the original until it has been downloaded — see `useWorkspacePersistence`).
 *
 * @returns Where the original was kept (null when it could not be), and whether the main key was
 *   cleared (false when it no longer held the quarantined bytes).
 */
export async function discardUnusableWorkspace(): Promise<{ preserved: PreservedWhere; cleared: boolean }> {
  const pending = pendingQuarantine;
  pendingQuarantine = null;
  // No quarantine from this load (not a `loadWorkspace(preserve)` discard): keep everything as is.
  if (!pending) return { preserved: null, cleared: false };
  let preserved: PreservedWhere = null;
  if (await pending.durable) {
    preserved = 'indexeddb';
  } else {
    try {
      window.localStorage.setItem(WORKSPACE_QUARANTINE_KEY, JSON.stringify(pending.record));
      preserved = 'localstorage';
    } catch {
      preserved = null;
    }
  }
  if (!preserved) return { preserved, cleared: false };
  // Clear ONLY the bytes that were quarantined. Anything else under the key was written since
  // this load began (another tab, or a save this tab let through) and is not ours to discard.
  let current: string | null = null;
  try {
    current = window.localStorage.getItem(WORKSPACE_STORAGE_KEY);
  } catch {
    current = null;
  }
  if (current !== pending.record.raw) return { preserved, cleared: false };
  clearWorkspace();
  // The stamp a previous (closed) tab left behind guards nothing now: the blob it stamped is
  // gone. Adopt it, or the sole writer's first save would be refused as a conflict.
  syncRevisionFromStorage();
  return { preserved, cleared: true };
}

/**
 * Resolve once every queued side-store write has settled.
 *
 * @returns A promise that resolves after pending preservation writes.
 */
export function preservationSettled(): Promise<void> {
  return pendingPreserve.then(() => undefined);
}

/**
 * Read a preserved copy (quarantine / pre-migration / checkpoint) from the side store.
 *
 * @param key - One of the preserved-blob keys.
 * @returns The record, or null when absent/unreadable.
 */
export async function readPreservedBlob(key: string): Promise<PreservedBlob | null> {
  await preservationSettled();
  let parsed = await getBlob<Partial<PreservedBlob>>(key);
  if (!parsed && key === WORKSPACE_QUARANTINE_KEY) {
    // The quarantine falls back to localStorage when IndexedDB could not keep it.
    try {
      const raw = window.localStorage.getItem(WORKSPACE_QUARANTINE_KEY);
      parsed = raw ? (JSON.parse(raw) as Partial<PreservedBlob>) : undefined;
    } catch {
      parsed = undefined;
    }
  }
  if (!parsed || typeof parsed.raw !== 'string' || typeof parsed.savedAt !== 'string') return null;
  return {
    savedAt: parsed.savedAt,
    reason: typeof parsed.reason === 'string' ? parsed.reason : '',
    schemaVersion: typeof parsed.schemaVersion === 'number' ? parsed.schemaVersion : undefined,
    raw: parsed.raw,
  };
}

/**
 * Write the last-known-good checkpoint from a blob string.
 *
 * @param blob - The serialized `{ schemaVersion, workspace }` envelope.
 * @param schemaVersion - Its schema version.
 */
export function writeCheckpoint(blob: string, schemaVersion: number): void {
  preserveRaw(WORKSPACE_CHECKPOINT_KEY, blob, 'checkpoint', schemaVersion);
}

/**
 * Reason codes returned alongside a discarded load, for a user-visible notice.
 * @readonly
 */
export const LOAD_DISCARD_REASON = {
  PARSE_ERROR: 'parse-error',
  VERSION_MISMATCH: 'version-mismatch',
  MALFORMED: 'malformed',
} as const;

/** A discard reason code (a {@link LOAD_DISCARD_REASON} member). */
export type LoadDiscardReason = (typeof LOAD_DISCARD_REASON)[keyof typeof LOAD_DISCARD_REASON];

/** The result of {@link loadWorkspace}. */
export type LoadWorkspaceResult =
  | { workspace: Record<string, unknown>; recovered?: { missingKeys: string[] } }
  | { workspace: null; discarded: LoadDiscardReason }
  | null;

/**
 * Loads the persisted workspace.
 *
 * @returns
 *   - `{ workspace }` on a successful, version-matching load.
 *   - `{ workspace, recovered: { missingKeys } }` when the blob was structurally
 *     valid but missing required top-level sections; they were restored to the default
 *     shape and `missingKeys` names them — caller shows a recovery notice.
 *   - `{ workspace: null, discarded: <reason> }` when a blob exists but is unusable
 *     (corrupt JSON, malformed shape, or wrong schemaVersion) — caller discards and
 *     shows a notice. `discarded` is a `LOAD_DISCARD_REASON` member.
 *   - `null` when no blob exists, or storage is unavailable (clean first run; no notice).
 */
export function loadWorkspace(): LoadWorkspaceResult {
  let raw: string | null;
  try {
    raw = window.localStorage.getItem(WORKSPACE_STORAGE_KEY);
  } catch {
    // Storage unavailable (e.g. private mode / disabled). Treat as clean first run.
    return null;
  }

  if (raw == null) {
    // No blob: a stamp left by a closed tab guards nothing — adopt it so the first save is not a
    // false conflict.
    syncRevisionFromStorage();
    return null;
  }

  return hydrateRaw(raw, { preserve: true });
}

/**
 * Turn a raw envelope string into a hydrated workspace (the body of {@link loadWorkspace}, shared
 * with backup restore and checkpoint recovery). With `preserve`, an unusable blob is quarantined,
 * a migrated blob's original bytes are kept, and a clean load refreshes the checkpoint + adopts the
 * stored revision. Without it (a preview of a backup file) storage is not touched.
 *
 * @param raw - The serialized `{ schemaVersion, workspace }` envelope.
 * @param options - `preserve`: whether to write the quarantine / pre-migration / checkpoint copies.
 * @param options.preserve - See above.
 * @returns The same result contract as {@link loadWorkspace} (never `null`).
 */
export function hydrateRaw(
  raw: string,
  { preserve }: { preserve: boolean }
): Exclude<LoadWorkspaceResult, null> {
  const discard = (reason: LoadDiscardReason): { workspace: null; discarded: LoadDiscardReason } => {
    // Keep the ORIGINAL bytes before the caller clears the main key — the notice must never
    // arrive after the only recovery source is gone. The caller finishes the discard with
    // `discardUnusableWorkspace`, which waits for this write to be acknowledged.
    if (preserve) {
      const record: PreservedBlob = { savedAt: new Date().toISOString(), reason, raw };
      pendingQuarantine = { record, durable: preserveRaw(WORKSPACE_QUARANTINE_KEY, raw, reason) };
    }
    return { workspace: null, discarded: reason };
  };

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return discard(LOAD_DISCARD_REASON.PARSE_ERROR);
  }

  // Structural corruption (not a version problem) → MALFORMED. The workspace root must
  // be a plain object: an array (or other non-plain-object) is root corruption, not an
  // empty/partial object, and must not be laundered into a default-shaped workspace.
  if (!isPlainObject(parsed) || !isPlainObject(parsed.workspace)) {
    return discard(LOAD_DISCARD_REASON.MALFORMED);
  }

  const storedVersion = parsed.schemaVersion;
  // Forward-migrate the blob from its stored schemaVersion up to the current version BEFORE any
  // device-normalize / shape-ensure, so downstream code only ever sees the current shape. A
  // version the registry can't reach (too old, too new, or non-integer) is a version mismatch.
  // The ORIGINAL envelope is kept first so a migration can be inspected or undone.
  if (preserve && storedVersion !== WORKSPACE_SCHEMA_VERSION) {
    preserveRaw(
      WORKSPACE_PREMIGRATION_KEY,
      raw,
      'migration',
      typeof storedVersion === 'number' ? storedVersion : undefined
    );
  }
  const migrated = migrateWorkspace(parsed);
  if (migrated.discarded) {
    return discard(LOAD_DISCARD_REASON.VERSION_MISMATCH);
  }

  // Device-normalize first, then guarantee the required top-level sections exist so a
  // valid-but-empty/partial blob hydrates cleanly. A restored section is reported via
  // `recovered` for a user-facing notice (never silently filled).
  const { workspace, missingKeys, corruptKeys } = ensureWorkspaceShape(
    normalizeWorkspaceDevices(migrated.workspace)
  );
  // A present-but-wrong-typed required section is corruption, not absence: discard
  // loudly rather than silently overwrite real data and mislabel it as "restored".
  if (corruptKeys.length > 0) {
    return discard(LOAD_DISCARD_REASON.MALFORMED);
  }
  const loadedWorkspace = clearLoadedValidationDeferrals(workspace);
  if (preserve) {
    // This blob hydrated: it is the session's last-known-good starting point.
    if (storedVersion === WORKSPACE_SCHEMA_VERSION) {
      writeCheckpoint(raw, WORKSPACE_SCHEMA_VERSION);
    }
    syncRevisionFromStorage();
  }
  return missingKeys.length > 0
    ? { workspace: loadedWorkspace, recovered: { missingKeys } }
    : { workspace: loadedWorkspace };
}

/**
 * Persists the workspace slice. Throws on failure (e.g. quota exceeded) so the
 * caller can surface an error and avoid claiming a successful save.
 *
 * @param workspace - The workspace slice (animals + days + settings).
 */
export function saveWorkspace(workspace: object, options: { checkpoint?: boolean } = {}): void {
  // Refuse to overwrite a revision this tab has not seen: another tab wrote since we loaded. The
  // writer lease normally prevents this; the stamp is the belt to that suspender (finding F4).
  if (hasUnseenRevision()) {
    throw new WorkspaceConflictError();
  }
  // Persisted AS-IS. Every write path normalizes device shape on the way in (`createAnimal` /
  // `updateAnimal` / snapshot / `updateDay`) and `loadWorkspace` normalizes + migrates on the way
  // back, so re-normalizing here was a deep clone + full channel-map walk per autosave tick that
  // never changed a byte (proved by persistence.saveNormalization.test.js). Load is the single
  // repair point; a blob that somehow persisted un-normalized is normalized on its next hydrate.
  const blob = JSON.stringify({ schemaVersion: WORKSPACE_SCHEMA_VERSION, workspace });
  const revision = lastSeenRevision + 1;
  const meta: WorkspaceMeta = { revision, writerId: WRITER_ID, savedAt: new Date().toISOString() };
  // Two keys, ONE outcome. The small marker goes first (it is the write least likely to hit the
  // quota); if the blob then fails, the marker is rolled back so a fresh tab never sees a new
  // revision over old bytes — and a caller that catches the throw can trust that nothing durable
  // changed. (Should the rollback itself fail, the leftover is a marker of THIS writer over the
  // old bytes: harmless, since this tab's own revisions never count as unseen.)
  let previousMeta: string | null = null;
  try {
    previousMeta = window.localStorage.getItem(WORKSPACE_META_KEY);
  } catch {
    previousMeta = null;
  }
  window.localStorage.setItem(WORKSPACE_META_KEY, JSON.stringify(meta));
  try {
    window.localStorage.setItem(WORKSPACE_STORAGE_KEY, blob);
  } catch (err) {
    try {
      if (previousMeta == null) window.localStorage.removeItem(WORKSPACE_META_KEY);
      else window.localStorage.setItem(WORKSPACE_META_KEY, previousMeta);
    } catch {
      // see above: a leftover marker of this writer is inert
    }
    throw err;
  }
  lastSeenRevision = revision;
  // An explicit save is a deliberate "this is good" — refresh the last-known-good checkpoint.
  if (options.checkpoint) writeCheckpoint(blob, WORKSPACE_SCHEMA_VERSION);
}

/** The exact bytes of a day's last download, as the side store holds them. */
export interface ReceiptArtifact {
  filename: string;
  yaml: string;
  exportedAt: string;
}

/** The artifacts a backup carries, keyed by day id. */
export type BackupArtifacts = Record<string, ReceiptArtifact>;

/** Minimal day shape the artifact transfer reads/writes (a receipt is optional). */
interface DayWithReceipt {
  exportReceipt?: { contentHash?: unknown; yamlStored?: unknown } & Record<string, unknown>;
}

function isArtifact(value: unknown): value is ReceiptArtifact {
  return (
    isPlainObject(value) &&
    typeof value.filename === 'string' &&
    typeof value.yaml === 'string' &&
    typeof value.exportedAt === 'string'
  );
}

/**
 * Collect the receipt artifacts (last-download YAML bytes) referenced by a workspace's days from
 * the side store — only those whose bytes are present AND match the receipt's hash.
 *
 * @param workspace - The workspace slice.
 * @returns Artifacts keyed by day id.
 */
async function collectReceiptArtifacts(workspace: object): Promise<BackupArtifacts> {
  const days = isPlainObject(workspace) && isPlainObject(workspace.days) ? workspace.days : {};
  const artifacts: BackupArtifacts = {};
  for (const [dayId, day] of Object.entries(days)) {
    const receipt = (day as DayWithReceipt)?.exportReceipt;
    if (!receipt || receipt.yamlStored !== true || typeof receipt.contentHash !== 'string') continue;
    // eslint-disable-next-line no-await-in-loop
    const stored = await getBlob<unknown>(receiptYamlKey(dayId, receipt as { yamlKey?: unknown }));
    if (isArtifact(stored) && receiptHash(stored.filename, stored.yaml) === receipt.contentHash) {
      artifacts[dayId] = { filename: stored.filename, yaml: stored.yaml, exportedAt: stored.exportedAt };
    }
  }
  return artifacts;
}

/**
 * Serialize the workspace as a portable backup envelope (what "Download workspace" writes):
 * the persisted shape verbatim — incomplete days, configuration history, provenance — PLUS the
 * exact YAML bytes of every download the receipts refer to (finding 7), so "Changed since
 * download" can show what changed on another computer too.
 *
 * @param workspace - The workspace slice.
 * @param appVersion - The app version string to stamp.
 * @returns The JSON text of the backup file.
 */
export async function buildWorkspaceBackup(workspace: object, appVersion: string): Promise<string> {
  const artifacts = await collectReceiptArtifacts(workspace);
  return serializeWorkspaceBackup(workspace, appVersion, artifacts);
}

/**
 * Serialize a backup envelope synchronously (no side-store lookup): used by {@link
 * buildWorkspaceBackup} and where the artifacts are already in hand.
 *
 * @param workspace - The workspace slice.
 * @param appVersion - The app version string to stamp.
 * @param artifacts - Receipt artifacts to embed (none by default).
 * @returns The JSON text of the backup file.
 */
export function serializeWorkspaceBackup(
  workspace: object,
  appVersion: string,
  artifacts: BackupArtifacts = {}
): string {
  return JSON.stringify(
    {
      format: 'rec_to_nwb_workspace_backup',
      formatVersion: 2,
      appVersion,
      exportedAt: new Date().toISOString(),
      schemaVersion: WORKSPACE_SCHEMA_VERSION,
      workspace,
      artifacts,
    },
    null,
    2
  );
}

/** The keys a restore operation wrote its incoming artifacts to (its own, unique to the attempt). */
export type StagedArtifacts = Record<string, { key: string; durable: boolean }>;

/**
 * STAGE a backup's receipt artifacts for one restore attempt: verify each against its day's
 * receipt hash and write the verified bytes ONCE, to a key unique to this attempt
 * (`receipt:<dayId>:<opId>`) that the restored receipt then names (`yamlKey`). The active
 * workspace's artifacts are never touched, there is no later promotion step that could lose the
 * bytes, and two attempts (a cancelled one and its retry) can never share a key. `yamlStored` is
 * true only when the store durably acknowledged the write.
 *
 * @param workspace - The hydrated workspace about to be restored.
 * @param artifacts - The artifacts carried by the backup (from `parseWorkspaceBackup`).
 * @param opId - This restore attempt's identity (unique per attempt).
 * @returns The flagged workspace (a new object; input not mutated) and the keys written.
 */
export async function stageBackupArtifacts<T extends { days?: Record<string, unknown> }>(
  workspace: T,
  artifacts: BackupArtifacts,
  opId: string
): Promise<{ workspace: T; staged: StagedArtifacts }> {
  const days = isPlainObject(workspace.days) ? workspace.days : {};
  const nextDays: Record<string, unknown> = { ...days };
  const staged: StagedArtifacts = {};
  for (const [dayId, day] of Object.entries(days)) {
    const receipt = (day as DayWithReceipt)?.exportReceipt;
    if (!isPlainObject(receipt)) continue;
    const artifact = artifacts[dayId];
    let stored = false;
    const key = `${RECEIPT_YAML_KEY_PREFIX}${dayId}:${opId}`;
    if (artifact && receiptHash(artifact.filename, artifact.yaml) === receipt.contentHash) {
      // eslint-disable-next-line no-await-in-loop
      stored = await putBlob(key, artifact);
      staged[dayId] = { key, durable: stored };
    }
    nextDays[dayId] = {
      ...(day as object),
      exportReceipt: { ...receipt, yamlStored: stored, ...(stored ? { yamlKey: key } : {}) },
    };
  }
  return { workspace: { ...workspace, days: nextDays }, staged };
}

/**
 * Drop the artifacts a restore attempt wrote (cancelled, refused or failed): only ITS keys, so a
 * retry that already staged its own bytes is untouched.
 *
 * @param staged - The keys from {@link stageBackupArtifacts}.
 */
export async function discardStagedArtifacts(staged: StagedArtifacts): Promise<void> {
  for (const entry of Object.values(staged)) {
    // eslint-disable-next-line no-await-in-loop
    await deleteBlob(entry.key);
  }
}

/**
 * Best-effort cleanup after a COMMITTED restore: the IMMUTABLE per-attempt artifacts the replaced
 * workspace's receipts referred to are no longer reachable from any receipt (a leftover would be
 * harmless — every reader verifies bytes against the receipt hash — but wastes space). The
 * reusable per-day key (`receipt:<dayId>`, where a download in this browser puts its bytes) is
 * never deleted here: a download made while this cleanup is still pending would lose its bytes.
 *
 * @param replaced - The workspace that was replaced.
 * @param replaced.days - Its days map.
 * @param restored - The workspace that replaced it (its keys are kept).
 * @param restored.days - Its days map.
 */
export async function releaseReplacedArtifacts(
  replaced: { days?: Record<string, unknown> },
  restored: { days?: Record<string, unknown> }
): Promise<void> {
  const keep = new Set<string>();
  for (const [dayId, day] of Object.entries(isPlainObject(restored.days) ? restored.days : {})) {
    const receipt = (day as DayWithReceipt)?.exportReceipt;
    if (isPlainObject(receipt)) keep.add(receiptYamlKey(dayId, receipt as { yamlKey?: unknown }));
  }
  for (const [dayId, day] of Object.entries(isPlainObject(replaced.days) ? replaced.days : {})) {
    const receipt = (day as DayWithReceipt)?.exportReceipt;
    if (!isPlainObject(receipt)) continue;
    const key = receiptYamlKey(dayId, receipt as { yamlKey?: unknown });
    if (key === `${RECEIPT_YAML_KEY_PREFIX}${dayId}`) continue; // reusable: a new download may own it
    // eslint-disable-next-line no-await-in-loop
    if (!keep.has(key)) await deleteBlob(key);
  }
}

/**
 * Restore a backup's artifacts in one step: for tests of the transfer itself and callers that
 * have ALREADY durably written the restored workspace.
 *
 * @param workspace - The hydrated workspace.
 * @param artifacts - The artifacts carried by the backup.
 * @returns The workspace with truthful `yamlStored` flags and `yamlKey` references.
 */
export async function restoreBackupArtifacts<T extends { days?: Record<string, unknown> }>(
  workspace: T,
  artifacts: BackupArtifacts
): Promise<T> {
  const { workspace: flagged } = await stageBackupArtifacts(workspace, artifacts, `restore-${Date.now().toString(36)}`);
  return flagged;
}

/** A parsed backup: the hydration result plus the artifacts the file carried (none for a bare blob). */
export type ParsedBackup = Exclude<LoadWorkspaceResult, null> & { artifacts: BackupArtifacts };

/**
 * Parse a backup file (or a preserved raw envelope) WITHOUT touching storage, returning the
 * hydrated workspace or the discard reason — the input to a restore preview — plus the receipt
 * artifacts the file carries (validated shape; hashes are checked at restore time).
 *
 * @param text - The file text: a backup envelope, or a bare `{ schemaVersion, workspace }` blob.
 * @returns The hydration result with `artifacts`.
 */
export function parseWorkspaceBackup(text: string): ParsedBackup {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return { workspace: null, discarded: LOAD_DISCARD_REASON.PARSE_ERROR, artifacts: {} };
  }
  // A backup envelope wraps the same `{ schemaVersion, workspace }` pair the storage key holds.
  const envelopeRecord =
    isPlainObject(parsed) && parsed.format === 'rec_to_nwb_workspace_backup' ? parsed : null;
  const envelope = envelopeRecord
    ? { schemaVersion: envelopeRecord.schemaVersion, workspace: envelopeRecord.workspace }
    : parsed;
  const artifacts: BackupArtifacts = {};
  if (envelopeRecord && isPlainObject(envelopeRecord.artifacts)) {
    for (const [dayId, artifact] of Object.entries(envelopeRecord.artifacts)) {
      if (isArtifact(artifact)) artifacts[dayId] = artifact;
    }
  }
  return { ...hydrateRaw(JSON.stringify(envelope), { preserve: false }), artifacts };
}

/**
 * Removes the persisted blob. Used when discarding an unusable load.
 */
export function clearWorkspace(): void {
  try {
    window.localStorage.removeItem(WORKSPACE_STORAGE_KEY);
  } catch {
    // No-op: nothing else to do if storage is unavailable.
  }
}

/** Test-only: forget the seen revision and any pending quarantine. */
export function resetPersistenceForTests(): void {
  lastSeenRevision = 0;
  pendingQuarantine = null;
}
