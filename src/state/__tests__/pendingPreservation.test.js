/**
 * Fix-response review findings 2–4: while the unusable original is being preserved nothing may
 * write over it (a save made meanwhile is applied once preservation finishes), the discard never
 * clears bytes it did not quarantine, and a backup restore obeys the same guards — including
 * ownership re-checked AFTER its asynchronous artifact writes, with hand-over vetoed meanwhile.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useStore } from '../store';
import {
  loadWorkspace,
  discardUnusableWorkspace,
  WORKSPACE_STORAGE_KEY,
  WORKSPACE_QUARANTINE_KEY,
  resetPersistenceForTests,
} from '../persistence';
import { resetWriterLockForTests, handOverOnRequest, releaseWriterLock } from '../writerLock';
import { resetBlobStoreForTests } from '../blobStore';
import { makeTestWorkspace } from '../../__tests__/helpers/test-fixtures';
import { createDefaultWorkspace } from '../workspaceUtils';

const { deferred } = vi.hoisted(() => ({ deferred: [] }));
vi.mock('../blobStore', async () => {
  const actual = await vi.importActual('../blobStore');
  return {
    ...actual,
    putBlob: vi.fn(
      () =>
        new Promise((resolve) => {
          deferred.push(resolve);
        })
    ),
  };
});


const flush = () => new Promise((resolve) => setTimeout(resolve, 0));
const storedAnimals = () => {
  const raw = window.localStorage.getItem(WORKSPACE_STORAGE_KEY);
  try {
    return Object.keys(JSON.parse(raw).workspace.animals);
  } catch {
    return raw;
  }
};

beforeEach(() => {
  deferred.length = 0;
  resetPersistenceForTests();
  resetWriterLockForTests();
  resetBlobStoreForTests();
  window.localStorage.clear();
});
afterEach(() => {
  resetWriterLockForTests();
  vi.restoreAllMocks();
});

describe('pending preservation gates every write', () => {
  it('a save attempted while the original is being preserved is refused, then applied once preservation finishes', async () => {
    window.localStorage.setItem(WORKSPACE_STORAGE_KEY, '{corrupt original');
    const { result } = renderHook(() => useStore());
    await waitFor(() => expect(result.current.persistence.writer.role).toBe('writer'));
    expect(result.current.persistence.preservationPending).toBe(true);

    act(() => {
      result.current.actions.createAnimal('NewData', { species: 'Rattus norvegicus' });
    });
    let saved;
    act(() => {
      saved = result.current.persistence.saveNow();
    });
    expect(saved).toBe(false);
    expect(result.current.persistence.saveError).toMatch(/original/i);
    expect(window.localStorage.getItem(WORKSPACE_STORAGE_KEY)).toBe('{corrupt original');

    await act(async () => {
      deferred[0](false); // IndexedDB did not take it → localStorage copy
      await flush();
    });
    await waitFor(() => expect(result.current.persistence.preservationPending).toBe(false));
    expect(window.localStorage.getItem(WORKSPACE_QUARANTINE_KEY)).toContain('{corrupt original');
    // The edit made meanwhile is now persisted — never lost, never clobbered.
    await waitFor(() => expect(storedAnimals()).toEqual(['NewData']));
  });

  it('the discard never clears the main key when it no longer holds the quarantined bytes', async () => {
    window.localStorage.setItem(WORKSPACE_STORAGE_KEY, '{corrupt original');
    loadWorkspace();
    const replacement = JSON.stringify({ schemaVersion: 4, workspace: createDefaultWorkspace() });
    window.localStorage.setItem(WORKSPACE_STORAGE_KEY, replacement);
    const outcome = discardUnusableWorkspace();
    await flush();
    deferred[0](false);
    const { cleared } = await outcome;
    expect(cleared).toBe(false);
    expect(window.localStorage.getItem(WORKSPACE_STORAGE_KEY)).toBe(replacement);
  });

  it('restoring a backup is refused while the original is unpreserved', async () => {
    window.localStorage.setItem(WORKSPACE_STORAGE_KEY, '{corrupt original');
    const realSetItem = window.localStorage.setItem.bind(window.localStorage);
    vi.spyOn(window.localStorage, 'setItem').mockImplementation((key, value) => {
      if (key === WORKSPACE_QUARANTINE_KEY) throw new Error('QuotaExceededError');
      realSetItem(key, value);
    });
    const { result } = renderHook(() => useStore());
    await act(async () => {
      await flush();
      deferred[0](false);
      await flush();
    });
    await waitFor(() => expect(result.current.persistence.originalUnpreserved).toBe(true));
    let ok;
    await act(async () => {
      ok = await result.current.persistence.restoreWorkspace(makeTestWorkspace(), {});
    });
    expect(ok).toBe(false);
    expect(result.current.persistence.saveError).toMatch(/original/i);
    expect(window.localStorage.getItem(WORKSPACE_STORAGE_KEY)).toBe('{corrupt original');
  });
});

describe('restore holds ownership', () => {
  const backupWithArtifact = () => {
    const ws = makeTestWorkspace();
    const day = ws.days.remy_20230622;
    day.exportReceipt = { filename: 'f.yml', exportedAt: 'x', contentHash: 'h', appVersion: 'a', schemaVersion: 4, yamlStored: true };
    return { ws, artifacts: { remy_20230622: { filename: 'f.yml', yaml: 'y', exportedAt: 'x' } } };
  };

  it('a hand-over request is refused while a restore is in flight', async () => {
    const { result } = renderHook(() => useStore({ workspace: createDefaultWorkspace() }));
    await waitFor(() => expect(result.current.persistence.writer.role).toBe('writer'));
    const { ws, artifacts } = backupWithArtifact();
    let done;
    act(() => {
      done = result.current.persistence.restoreWorkspace(ws, artifacts);
    });
    expect(handOverOnRequest()).toMatchObject({ ok: false, reason: expect.stringMatching(/restor/i) });
    expect(result.current.persistence.writer.role).toBe('writer');
    await act(async () => {
      deferred.forEach((resolve) => resolve(true));
      await flush();
      await done;
    });
    expect(handOverOnRequest()).toEqual({ ok: true });
  });

  it('a restore whose tab lost ownership during its asynchronous phase writes nothing', async () => {
    const { result } = renderHook(() => useStore({ workspace: createDefaultWorkspace() }));
    await waitFor(() => expect(result.current.persistence.writer.role).toBe('writer'));
    const { ws, artifacts } = backupWithArtifact();
    let done;
    act(() => {
      done = result.current.persistence.restoreWorkspace(ws, artifacts);
    });
    // The lease is lost anyway (e.g. the browser revoked it) before the artifacts settle.
    act(() => {
      releaseWriterLock('handed-over');
    });
    let ok;
    await act(async () => {
      deferred.forEach((resolve) => resolve(true));
      await flush();
      ok = await done;
    });
    expect(ok).toBe(false);
    expect(window.localStorage.getItem(WORKSPACE_STORAGE_KEY)).toBeNull();
    expect(result.current.model.workspace.animals).toEqual({});
  });
});
