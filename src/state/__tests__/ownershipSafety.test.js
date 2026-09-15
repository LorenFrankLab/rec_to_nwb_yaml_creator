/**
 * Ownership safety (review findings 1–2 on increment 1): a writer tab hands its lease over ONLY
 * after its unsaved work is durably written, and a read-only tab cannot mutate the workspace.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import {
  acquireWriterLock,
  getWriterState,
  handOverOnRequest,
  onBeforeHandOver,
  resetWriterLockForTests,
  WRITER_LEASE_KEY,
} from '../writerLock';
import { useStore } from '../store';
import { ReadOnlyWorkspaceError } from '../useWorkspace';
import { WORKSPACE_STORAGE_KEY, resetPersistenceForTests } from '../persistence';
import { makeTestWorkspace } from '../../__tests__/helpers/test-fixtures';

beforeEach(() => {
  resetWriterLockForTests();
  resetPersistenceForTests();
  window.localStorage.clear();
});
afterEach(() => {
  resetWriterLockForTests();
  vi.restoreAllMocks();
});

describe('hand-over requires a confirmed final save', () => {
  it('a refusing before-hand-over callback keeps this tab the writer and reports why', async () => {
    await acquireWriterLock();
    onBeforeHandOver(() => ({ ok: false, reason: 'the last save failed' }));
    const outcome = handOverOnRequest();
    expect(outcome).toEqual({ ok: false, reason: 'the last save failed' });
    expect(getWriterState()).toEqual({ role: 'writer' });
  });

  it('with every callback happy the lease is released', async () => {
    await acquireWriterLock();
    onBeforeHandOver(() => ({ ok: true }));
    expect(handOverOnRequest()).toEqual({ ok: true });
    expect(getWriterState()).toEqual({ role: 'reader', reason: 'handed-over' });
  });

  it('a writer whose final write throws (quota) refuses the hand-over and keeps its unsaved edit', async () => {
    const { result } = renderHook(() => useStore({ workspace: makeTestWorkspace() }));
    await waitFor(() => expect(result.current.persistence.writer.role).toBe('writer'));
    act(() => {
      result.current.actions.updateDay('remy_20230622', { session: { weight: 499 } });
    });
    const setItem = vi.spyOn(window.localStorage, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceededError');
    });
    let outcome;
    act(() => {
      outcome = handOverOnRequest();
    });
    expect(outcome.ok).toBe(false);
    expect(outcome.reason).toMatch(/could not save/i);
    expect(result.current.persistence.writer.role).toBe('writer');
    expect(result.current.model.workspace.days.remy_20230622.session.weight).toBe(499);
    setItem.mockRestore();
  });
});

describe('a read-only tab cannot mutate the workspace', () => {
  it('a record-mutating action throws ReadOnlyWorkspaceError and leaves the workspace unchanged', async () => {
    window.localStorage.setItem(
      WRITER_LEASE_KEY,
      JSON.stringify({ writerId: 'other-tab', heartbeat: Date.now() })
    );
    const { result } = renderHook(() => useStore({ workspace: makeTestWorkspace() }));
    await waitFor(() => expect(result.current.persistence.writer.role).toBe('reader'));
    const before = result.current.model.workspace;
    expect(() =>
      act(() => {
        result.current.actions.updateDay('remy_20230622', { session: { weight: 999 } });
      })
    ).toThrow(ReadOnlyWorkspaceError);
    expect(result.current.model.workspace).toBe(before);
    expect(window.localStorage.getItem(WORKSPACE_STORAGE_KEY)).toBeNull();
  });
});
