/**
 * Finding F8 — the only saved workspace must never be discarded without a recoverable copy.
 *
 * Covers: quarantine of unusable bytes BEFORE the main key is cleared, the pre-migration copy of a
 * forward-migrated blob, the last-known-good checkpoint (clean load + explicit save), and the
 * backup envelope round trip (parse without touching storage).
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { resetBlobStoreForTests } from '../blobStore';
import {
  loadWorkspace,
  saveWorkspace,
  clearWorkspace,
  readPreservedBlob,
  parseWorkspaceBackup,
  serializeWorkspaceBackup,
  WORKSPACE_STORAGE_KEY,
  WORKSPACE_QUARANTINE_KEY,
  WORKSPACE_PREMIGRATION_KEY,
  WORKSPACE_CHECKPOINT_KEY,
  WORKSPACE_SCHEMA_VERSION,
  resetPersistenceForTests,
} from '../persistence';
import { createDefaultWorkspace } from '../workspaceUtils';
import { makeTestWorkspace } from '../../__tests__/helpers/test-fixtures';

const seed = (raw) => window.localStorage.setItem(WORKSPACE_STORAGE_KEY, raw);

describe('persistence preservation', () => {
  beforeEach(() => {
    resetPersistenceForTests();
    resetBlobStoreForTests();
    window.localStorage.clear();
  });

  it('quarantines unparsable bytes before the caller clears the main key', async () => {
    seed('{not json');
    const result = loadWorkspace();
    expect(result).toEqual({ workspace: null, discarded: 'parse-error' });
    clearWorkspace();
    const kept = await readPreservedBlob(WORKSPACE_QUARANTINE_KEY);
    expect(kept?.raw).toBe('{not json');
    expect(kept?.reason).toBe('parse-error');
    expect(window.localStorage.getItem(WORKSPACE_STORAGE_KEY)).toBeNull();
  });

  it('quarantines a version-mismatched blob (with its schemaVersion) rather than losing it', async () => {
    const raw = JSON.stringify({ schemaVersion: 99, workspace: makeTestWorkspace() });
    seed(raw);
    expect(loadWorkspace()).toEqual({ workspace: null, discarded: 'version-mismatch' });
    expect((await readPreservedBlob(WORKSPACE_QUARANTINE_KEY))?.raw).toBe(raw);
  });

  it('quarantines a structurally corrupt blob', async () => {
    const raw = JSON.stringify({ schemaVersion: WORKSPACE_SCHEMA_VERSION, workspace: { animals: 'nope', days: {}, settings: {} } });
    seed(raw);
    expect(loadWorkspace()).toEqual({ workspace: null, discarded: 'malformed' });
    expect((await readPreservedBlob(WORKSPACE_QUARANTINE_KEY))?.raw).toBe(raw);
  });

  it('keeps the ORIGINAL bytes of a blob that was forward-migrated', async () => {
    const raw = JSON.stringify({ schemaVersion: 2, workspace: makeTestWorkspace() });
    seed(raw);
    const result = loadWorkspace();
    expect(result?.workspace).toBeTruthy();
    const kept = await readPreservedBlob(WORKSPACE_PREMIGRATION_KEY);
    expect(kept?.raw).toBe(raw);
    expect(kept?.schemaVersion).toBe(2);
    expect(kept?.reason).toBe('migration');
  });

  it('a clean current-version load refreshes the last-known-good checkpoint', async () => {
    const raw = JSON.stringify({ schemaVersion: WORKSPACE_SCHEMA_VERSION, workspace: makeTestWorkspace() });
    seed(raw);
    expect(loadWorkspace()?.workspace).toBeTruthy();
    expect((await readPreservedBlob(WORKSPACE_CHECKPOINT_KEY))?.raw).toBe(raw);
  });

  it('a migrated load does NOT overwrite the checkpoint with an unverified shape (the pre-migration copy is kept instead)', async () => {
    seed(JSON.stringify({ schemaVersion: 2, workspace: makeTestWorkspace() }));
    loadWorkspace();
    expect(await readPreservedBlob(WORKSPACE_CHECKPOINT_KEY)).toBeNull();
  });

  it('an explicit save (checkpoint: true) writes the checkpoint; an autosave does not', async () => {
    saveWorkspace(createDefaultWorkspace());
    expect(await readPreservedBlob(WORKSPACE_CHECKPOINT_KEY)).toBeNull();
    const ws = { ...createDefaultWorkspace(), lastModified: 'explicit' };
    saveWorkspace(ws, { checkpoint: true });
    const kept = await readPreservedBlob(WORKSPACE_CHECKPOINT_KEY);
    expect(JSON.parse(kept.raw).workspace.lastModified).toBe('explicit');
  });

  it('a backup envelope round-trips through parseWorkspaceBackup without touching storage', async () => {
    const ws = makeTestWorkspace();
    const text = serializeWorkspaceBackup(ws, '3.0.0-test');
    const envelope = JSON.parse(text);
    expect(envelope.format).toBe('rec_to_nwb_workspace_backup');
    expect(envelope.schemaVersion).toBe(WORKSPACE_SCHEMA_VERSION);
    const parsed = parseWorkspaceBackup(text);
    expect(parsed.workspace?.animals).toHaveProperty('remy');
    expect(window.localStorage.getItem(WORKSPACE_STORAGE_KEY)).toBeNull();
    expect(await readPreservedBlob(WORKSPACE_CHECKPOINT_KEY)).toBeNull();
  });

  it('parseWorkspaceBackup also accepts a bare storage envelope (a quarantined/checkpoint copy) and migrates it', async () => {
    const raw = JSON.stringify({ schemaVersion: 2, workspace: makeTestWorkspace() });
    const parsed = parseWorkspaceBackup(raw);
    expect(parsed.workspace?.days).toBeTruthy();
    expect(await readPreservedBlob(WORKSPACE_PREMIGRATION_KEY)).toBeNull();
  });

  it('parseWorkspaceBackup reports an unusable file instead of throwing', async () => {
    expect(parseWorkspaceBackup('garbage')).toEqual({ workspace: null, discarded: 'parse-error' });
    expect(parseWorkspaceBackup(JSON.stringify({ schemaVersion: 99, workspace: {} }))).toEqual({
      workspace: null,
      discarded: 'version-mismatch',
    });
  });
});
