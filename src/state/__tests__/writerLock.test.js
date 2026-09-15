/**
 * Single-writer ownership (finding F4) — the localStorage-lease fallback path (jsdom has no Web
 * Locks) plus the revision stamp that refuses a stale write regardless of the lease.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  acquireWriterLock,
  getWriterState,
  releaseWriterLock,
  retryAcquire,
  resetWriterLockForTests,
  WRITER_ID,
  WRITER_LEASE_KEY,
  LEASE_STALE_MS,
} from '../writerLock';
import {
  saveWorkspace,
  loadWorkspace,
  WorkspaceConflictError,
  WORKSPACE_STORAGE_KEY,
  WORKSPACE_META_KEY,
  WORKSPACE_SCHEMA_VERSION,
  readWorkspaceRevision,
  syncRevisionFromStorage,
  resetPersistenceForTests,
} from '../persistence';
import { createDefaultWorkspace } from '../workspaceUtils';

const otherTabLease = (ageMs = 0) =>
  window.localStorage.setItem(
    WRITER_LEASE_KEY,
    JSON.stringify({ writerId: 'other-tab', heartbeat: Date.now() - ageMs })
  );

describe('writer lease (fallback path)', () => {
  beforeEach(() => {
    resetWriterLockForTests();
    window.localStorage.clear();
  });
  afterEach(() => {
    resetWriterLockForTests();
    vi.useRealTimers();
  });

  it('the first tab becomes the writer and records its lease', async () => {
    const state = await acquireWriterLock();
    expect(state).toEqual({ role: 'writer' });
    expect(JSON.parse(window.localStorage.getItem(WRITER_LEASE_KEY)).writerId).toBe(WRITER_ID);
  });

  it('a tab that finds a FRESH lease held by another tab opens read-only', async () => {
    otherTabLease();
    const state = await acquireWriterLock();
    expect(state).toEqual({ role: 'reader', reason: 'held-elsewhere' });
  });

  it('an abandoned (stale) lease is taken over', async () => {
    otherTabLease(LEASE_STALE_MS + 1);
    const state = await acquireWriterLock();
    expect(state.role).toBe('writer');
  });

  it('a reader becomes the writer on retry once the other tab is gone', async () => {
    otherTabLease();
    await acquireWriterLock();
    expect(getWriterState().role).toBe('reader');
    window.localStorage.removeItem(WRITER_LEASE_KEY);
    const next = await retryAcquire();
    expect(next.role).toBe('writer');
  });

  it('releasing turns the writer read-only and clears its lease', async () => {
    await acquireWriterLock();
    releaseWriterLock('handed-over');
    expect(getWriterState()).toEqual({ role: 'reader', reason: 'handed-over' });
    expect(window.localStorage.getItem(WRITER_LEASE_KEY)).toBeNull();
  });
});

describe('revision stamp', () => {
  beforeEach(() => {
    resetPersistenceForTests();
    window.localStorage.clear();
  });

  it('each save advances the stored revision and stamps this tab', () => {
    saveWorkspace(createDefaultWorkspace());
    expect(readWorkspaceRevision()).toBe(1);
    saveWorkspace(createDefaultWorkspace());
    expect(readWorkspaceRevision()).toBe(2);
    expect(JSON.parse(window.localStorage.getItem(WORKSPACE_META_KEY)).writerId).toBe(WRITER_ID);
  });

  it('refuses to overwrite a revision written by ANOTHER tab since this tab last loaded', () => {
    saveWorkspace(createDefaultWorkspace()); // this tab: revision 1
    // Another tab saves revision 2 (a different writer id).
    window.localStorage.setItem(
      WORKSPACE_STORAGE_KEY,
      JSON.stringify({ schemaVersion: WORKSPACE_SCHEMA_VERSION, workspace: { ...createDefaultWorkspace(), lastModified: 'theirs' } })
    );
    window.localStorage.setItem(
      WORKSPACE_META_KEY,
      JSON.stringify({ revision: 2, writerId: 'other-tab', savedAt: 'x' })
    );
    expect(() => saveWorkspace(createDefaultWorkspace())).toThrow(WorkspaceConflictError);
    // The other tab's blob is intact.
    expect(JSON.parse(window.localStorage.getItem(WORKSPACE_STORAGE_KEY)).workspace.lastModified).toBe('theirs');
  });

  it('loading adopts the stored revision so a subsequent save is not a false conflict', () => {
    window.localStorage.setItem(
      WORKSPACE_STORAGE_KEY,
      JSON.stringify({ schemaVersion: WORKSPACE_SCHEMA_VERSION, workspace: createDefaultWorkspace() })
    );
    window.localStorage.setItem(
      WORKSPACE_META_KEY,
      JSON.stringify({ revision: 7, writerId: 'other-tab', savedAt: 'x' })
    );
    expect(loadWorkspace()?.workspace).toBeTruthy();
    expect(() => saveWorkspace(createDefaultWorkspace())).not.toThrow();
    expect(readWorkspaceRevision()).toBe(8);
  });

  it('syncRevisionFromStorage re-arms after an external write', () => {
    saveWorkspace(createDefaultWorkspace());
    window.localStorage.setItem(
      WORKSPACE_META_KEY,
      JSON.stringify({ revision: 5, writerId: 'other-tab', savedAt: 'x' })
    );
    syncRevisionFromStorage();
    expect(() => saveWorkspace(createDefaultWorkspace())).not.toThrow();
  });
});
