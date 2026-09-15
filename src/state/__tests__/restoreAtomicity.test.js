/**
 * Revision-3 review: a backup restore is EXCLUSIVE and CANCELLABLE (Cancel during the delayed
 * artifact phase aborts it; a later saved edit is never overwritten by the stale continuation), and
 * ATOMIC (a failed workspace write leaves memory and the active receipt bytes untouched — incoming
 * artifacts are staged, never written over the active keys before the commit succeeds).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useStore } from '../store';
import { WORKSPACE_STORAGE_KEY, resetPersistenceForTests } from '../persistence';
import { resetWriterLockForTests } from '../writerLock';
import { resetBlobStoreForTests, getBlob } from '../blobStore';
import { receiptHash, RECEIPT_YAML_KEY_PREFIX } from '../../domain/exportReceipt';
import { makeTestWorkspace } from '../../__tests__/helpers/test-fixtures';

const { deferred } = vi.hoisted(() => ({ deferred: [] }));
vi.mock('../blobStore', async () => {
  const actual = await vi.importActual('../blobStore');
  return {
    ...actual,
    putBlob: vi.fn(
      (key, value) =>
        new Promise((resolve) => {
          deferred.push(() => actual.putBlob(key, value).then(() => resolve(true)));
        })
    ),
  };
});

const DAY = 'remy_20230622';
const flush = () => new Promise((resolve) => setTimeout(resolve, 0));
const releaseAll = async () => {
  while (deferred.length > 0) {
    // eslint-disable-next-line no-await-in-loop
    await deferred.shift()();
  }
  await flush();
};
const storedWeight = () => JSON.parse(window.localStorage.getItem(WORKSPACE_STORAGE_KEY)).workspace.days[DAY].session.weight;

/** The active workspace: the day was downloaded at 485 g and its bytes are in the side store. */
async function activeWorkspace() {
  const ws = makeTestWorkspace();
  ws.days[DAY].session.weight = 485;
  const yaml = 'weight: 485\n';
  ws.days[DAY].exportReceipt = { filename: 'f.yml', exportedAt: '2023-06-22T20:00:00.000Z', contentHash: receiptHash('f.yml', yaml), appVersion: 'a', schemaVersion: 4, yamlStored: true };
  const actual = await vi.importActual('../blobStore');
  await actual.putBlob(`${RECEIPT_YAML_KEY_PREFIX}${DAY}`, { filename: 'f.yml', yaml, exportedAt: '2023-06-22T20:00:00.000Z' });
  return ws;
}
/** A backup of the same day at 480 g with its own (different) download bytes. */
function backup() {
  const ws = makeTestWorkspace();
  ws.days[DAY].session.weight = 480;
  const yaml = 'weight: 480\n';
  ws.days[DAY].exportReceipt = { filename: 'f.yml', exportedAt: '2023-06-20T20:00:00.000Z', contentHash: receiptHash('f.yml', yaml), appVersion: 'a', schemaVersion: 4, yamlStored: true };
  return { ws, artifacts: { [DAY]: { filename: 'f.yml', yaml, exportedAt: '2023-06-20T20:00:00.000Z' } } };
}

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

describe('restore cancellation and exclusivity', () => {
  it('Cancel during the delayed artifact phase aborts the restore; an edit saved afterwards is kept', async () => {
    const initial = await activeWorkspace();
    const { result } = renderHook(() => useStore({ workspace: initial }));
    await waitFor(() => expect(result.current.persistence.writer.role).toBe('writer'));
    const { ws, artifacts } = backup();
    let done;
    act(() => {
      done = result.current.persistence.restoreWorkspace(ws, artifacts);
    });
    expect(result.current.persistence.restoreInFlight).toBe(true);
    act(() => {
      result.current.persistence.cancelRestore();
    });
    await waitFor(() => expect(result.current.persistence.restoreInFlight).toBe(false));
    act(() => {
      result.current.actions.updateDay(DAY, { session: { weight: 777 } });
    });
    act(() => {
      expect(result.current.persistence.saveNow()).toBe(true);
    });
    expect(storedWeight()).toBe(777);

    await act(async () => {
      await releaseAll();
      expect(await done).toBe(false);
    });
    expect(storedWeight()).toBe(777);
    expect(result.current.model.workspace.days[DAY].session.weight).toBe(777);
    // The active receipt bytes were never touched.
    expect((await getBlob(`${RECEIPT_YAML_KEY_PREFIX}${DAY}`)).yaml).toBe('weight: 485\n');
  });

  it('a second restore while one is in flight is refused', async () => {
    const initial = await activeWorkspace();
    const { result } = renderHook(() => useStore({ workspace: initial }));
    await waitFor(() => expect(result.current.persistence.writer.role).toBe('writer'));
    const { ws, artifacts } = backup();
    let first;
    act(() => {
      first = result.current.persistence.restoreWorkspace(ws, artifacts);
    });
    let second;
    await act(async () => {
      second = await result.current.persistence.restoreWorkspace(ws, artifacts);
    });
    expect(second).toBe(false);
    expect(result.current.persistence.saveError).toMatch(/already in progress/i);
    await act(async () => {
      await releaseAll();
      await first;
    });
  });

  it('saves are refused while a restore is in flight', async () => {
    const initial = await activeWorkspace();
    const { result } = renderHook(() => useStore({ workspace: initial }));
    await waitFor(() => expect(result.current.persistence.writer.role).toBe('writer'));
    const { ws, artifacts } = backup();
    let done;
    act(() => {
      done = result.current.persistence.restoreWorkspace(ws, artifacts);
    });
    act(() => {
      expect(result.current.persistence.saveNow()).toBe(false);
    });
    expect(result.current.persistence.saveError).toMatch(/restore/i);
    await act(async () => {
      await releaseAll();
      await done;
    });
  });
});

describe('restore atomicity', () => {
  it('a failed workspace write leaves memory AND the active receipt bytes untouched (nothing partially replaced)', async () => {
    const initial = await activeWorkspace();
    const { result } = renderHook(() => useStore({ workspace: initial }));
    await waitFor(() => expect(result.current.persistence.writer.role).toBe('writer'));
    act(() => {
      expect(result.current.persistence.saveNow()).toBe(true);
    });
    const realSetItem = window.localStorage.setItem.bind(window.localStorage);
    vi.spyOn(window.localStorage, 'setItem').mockImplementation((key, value) => {
      if (key === WORKSPACE_STORAGE_KEY) throw new Error('Quota full');
      realSetItem(key, value);
    });
    const { ws, artifacts } = backup();
    let ok;
    await act(async () => {
      const done = result.current.persistence.restoreWorkspace(ws, artifacts);
      await releaseAll();
      ok = await done;
    });
    expect(ok).toBe(false);
    expect(result.current.persistence.saveError).toMatch(/Quota full/);
    expect(result.current.model.workspace.days[DAY].session.weight).toBe(485);
    expect(storedWeight()).toBe(485);
    const stored = await getBlob(`${RECEIPT_YAML_KEY_PREFIX}${DAY}`);
    expect(stored.yaml).toBe('weight: 485\n');
  });

  it('a successful restore replaces memory, storage and the receipt bytes together', async () => {
    const initial = await activeWorkspace();
    const { result } = renderHook(() => useStore({ workspace: initial }));
    await waitFor(() => expect(result.current.persistence.writer.role).toBe('writer'));
    const { ws, artifacts } = backup();
    let ok;
    await act(async () => {
      const done = result.current.persistence.restoreWorkspace(ws, artifacts);
      await releaseAll();
      ok = await done;
    });
    expect(ok).toBe(true);
    expect(storedWeight()).toBe(480);
    // The commit phase promotes the staged bytes (one more deferred store write).
    await act(async () => {
      await releaseAll();
    });
    expect((await getBlob(`${RECEIPT_YAML_KEY_PREFIX}${DAY}`)).yaml).toBe('weight: 480\n');
    expect(result.current.model.workspace.days[DAY].exportReceipt.yamlStored).toBe(true);
  });
});
