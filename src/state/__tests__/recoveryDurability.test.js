/**
 * Recovery durability (review findings 3–4 on increment 1): an unusable saved workspace is removed
 * from the main key ONLY after its bytes are durably kept somewhere the next page load can read,
 * and the leftover revision stamp never blocks the sole writer's next save.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { resetBlobStoreForTests } from '../blobStore';
import {
  loadWorkspace,
  saveWorkspace,
  discardUnusableWorkspace,
  readPreservedBlob,
  readWorkspaceRevision,
  WORKSPACE_STORAGE_KEY,
  WORKSPACE_META_KEY,
  WORKSPACE_QUARANTINE_KEY,
  resetPersistenceForTests,
} from '../persistence';
import { createDefaultWorkspace } from '../workspaceUtils';

const seedMeta = (revision) =>
  window.localStorage.setItem(WORKSPACE_META_KEY, JSON.stringify({ revision, writerId: 'closed-tab', savedAt: 'x' }));

beforeEach(() => {
  resetPersistenceForTests();
  resetBlobStoreForTests();
  window.localStorage.clear();
});
afterEach(() => vi.restoreAllMocks());

describe('discarding an unusable workspace', () => {
  it('without IndexedDB, keeps the original bytes in localStorage before clearing the main key — and they survive a reload', async () => {
    window.localStorage.setItem(WORKSPACE_STORAGE_KEY, '{not json');
    expect(loadWorkspace()).toEqual({ workspace: null, discarded: 'parse-error' });
    const outcome = await discardUnusableWorkspace();
    expect(outcome.preserved).toBe('localstorage');
    expect(window.localStorage.getItem(WORKSPACE_STORAGE_KEY)).toBeNull();
    // "Reload": the in-memory side store is gone; the copy must still be readable.
    resetBlobStoreForTests();
    const kept = await readPreservedBlob(WORKSPACE_QUARANTINE_KEY);
    expect(kept?.raw).toBe('{not json');
  });

  it('keeps the main key when NO durable copy could be written, and says so', async () => {
    window.localStorage.setItem(WORKSPACE_STORAGE_KEY, '{not json');
    loadWorkspace();
    const realSetItem = window.localStorage.setItem.bind(window.localStorage);
    vi.spyOn(window.localStorage, 'setItem').mockImplementation((key, value) => {
      if (key === WORKSPACE_QUARANTINE_KEY) throw new Error('QuotaExceededError');
      realSetItem(key, value);
    });
    const outcome = await discardUnusableWorkspace();
    expect(outcome.preserved).toBeNull();
    expect(window.localStorage.getItem(WORKSPACE_STORAGE_KEY)).toBe('{not json');
  });

  it('adopts the leftover revision stamp so the sole writer can save after a discard', async () => {
    window.localStorage.setItem(WORKSPACE_STORAGE_KEY, '{not json');
    seedMeta(9);
    loadWorkspace();
    await discardUnusableWorkspace();
    expect(() => saveWorkspace(createDefaultWorkspace())).not.toThrow();
    expect(readWorkspaceRevision()).toBe(10);
  });

  it('a missing blob with a leftover stamp (previous tab closed) does not block the first save either', () => {
    seedMeta(9);
    expect(loadWorkspace()).toBeNull();
    expect(() => saveWorkspace(createDefaultWorkspace())).not.toThrow();
    expect(readWorkspaceRevision()).toBe(10);
  });
});
