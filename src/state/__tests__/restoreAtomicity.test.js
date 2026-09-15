/**
 * Revision-3 review: a backup restore is EXCLUSIVE and CANCELLABLE (Cancel during the delayed
 * artifact phase aborts it; a later saved edit is never overwritten by the stale continuation), and
 * ATOMIC (a failed workspace write leaves memory and the active receipt bytes untouched — incoming
 * artifacts are staged, never written over the active keys before the commit succeeds).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useStore } from '../store';
import { WORKSPACE_STORAGE_KEY, WORKSPACE_META_KEY, loadWorkspace, resetPersistenceForTests } from '../persistence';
import { resetWriterLockForTests } from '../writerLock';
import { resetBlobStoreForTests, getBlob } from '../blobStore';
import { receiptHash, receiptYamlKey, RECEIPT_YAML_KEY_PREFIX } from '../../domain/exportReceipt';
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
    // Deletes are deferred too: a post-restore cleanup stays pending until released.
    deleteBlob: vi.fn(
      (key) =>
        new Promise((resolve) => {
          deferred.push(() => actual.deleteBlob(key).then(() => resolve()));
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
    const receipt = result.current.model.workspace.days[DAY].exportReceipt;
    expect((await getBlob(receiptYamlKey(DAY, receipt))).yaml).toBe('weight: 480\n');
    expect(result.current.model.workspace.days[DAY].exportReceipt.yamlStored).toBe(true);
  });
});

describe('restore outcome covers the revision marker and the referenced bytes', () => {
  it('a failed revision-marker write refuses the restore with storage, memory and a fresh load all at 485 g', async () => {
    const initial = await activeWorkspace();
    const { result } = renderHook(() => useStore({ workspace: initial }));
    await waitFor(() => expect(result.current.persistence.writer.role).toBe('writer'));
    act(() => {
      expect(result.current.persistence.saveNow()).toBe(true);
    });
    const realSetItem = window.localStorage.setItem.bind(window.localStorage);
    vi.spyOn(window.localStorage, 'setItem').mockImplementation((key, value) => {
      if (key === WORKSPACE_META_KEY) throw new Error('Quota full on revision marker');
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
    expect(result.current.model.workspace.days[DAY].session.weight).toBe(485);
    expect(storedWeight()).toBe(485);
    vi.restoreAllMocks();
    resetPersistenceForTests();
    expect(loadWorkspace().workspace.days[DAY].session.weight).toBe(485); // what a fresh tab reads
  });

  it('a completed restore refers to acknowledged bytes at a key the receipt names (no promotion step to lose them)', async () => {
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
    expect(result.current.persistence.restoreInFlight).toBe(false);
    const receipt = result.current.model.workspace.days[DAY].exportReceipt;
    expect(receipt.yamlStored).toBe(true);
    expect((await getBlob(receiptYamlKey(DAY, receipt))).yaml).toBe('weight: 480\n');
    expect(deferred).toHaveLength(0); // nothing left pending after "restored"
  });

  it('a cancelled restore’s cleanup never deletes a retry’s staged bytes for the same day', async () => {
    const initial = await activeWorkspace();
    const { result } = renderHook(() => useStore({ workspace: initial }));
    await waitFor(() => expect(result.current.persistence.writer.role).toBe('writer'));
    const a = backup();
    let doneA;
    act(() => {
      doneA = result.current.persistence.restoreWorkspace(a.ws, a.artifacts);
    });
    const releaseA = deferred.shift();
    act(() => {
      result.current.persistence.cancelRestore();
    });
    const b = backup();
    b.ws.days[DAY].session.weight = 499;
    let doneB;
    act(() => {
      doneB = result.current.persistence.restoreWorkspace(b.ws, b.artifacts);
    });
    const releaseB = deferred.shift();
    // B has written its staged bytes; A's cancelled continuation now runs its cleanup.
    await act(async () => {
      await releaseA();
      await flush();
      expect(await doneA).toBe(false);
    });
    await act(async () => {
      await releaseB();
      await flush();
      expect(await doneB).toBe(true);
      await releaseAll();
    });
    expect(storedWeight()).toBe(499);
    const receipt = result.current.model.workspace.days[DAY].exportReceipt;
    expect(receipt.yamlStored).toBe(true);
    expect((await getBlob(receiptYamlKey(DAY, receipt))).yaml).toBe('weight: 480\n');
  });
});

describe('post-restore cleanup', () => {
  it('never deletes the reusable per-day download key — a download made while cleanup is pending keeps its bytes', async () => {
    const initial = await activeWorkspace(); // bytes under the reusable key receipt:<DAY>
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
    // Cleanup of the replaced workspace's artifacts is still pending; meanwhile a NEW download of
    // the restored day writes its bytes to the reusable per-day key.
    const actual = await vi.importActual('../blobStore');
    const fresh = { filename: 'f.yml', yaml: 'weight: 480\nnew: download\n', exportedAt: 'later' };
    await actual.putBlob(`${RECEIPT_YAML_KEY_PREFIX}${DAY}`, fresh);
    await act(async () => {
      await releaseAll();
      await flush();
    });
    expect(await getBlob(`${RECEIPT_YAML_KEY_PREFIX}${DAY}`)).toEqual(fresh);
  });
});
