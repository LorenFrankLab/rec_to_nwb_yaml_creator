/**
 * @file store-persistence.test.js
 * @description Tests for localStorage autosave wired into useStore.
 *
 * Covers hydrate-on-init, workspace-only writes (never legacy formData),
 * debounce coalescing, discard-with-notice on an unusable blob, and that
 * lastSaved is set only after a confirmed write.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useStore } from '../store';
import {
  WORKSPACE_STORAGE_KEY,
  WORKSPACE_SCHEMA_VERSION,
} from '../persistence';
import { makeTestWorkspace } from '../../__tests__/helpers/test-fixtures';

const seedBlob = (workspace, schemaVersion = WORKSPACE_SCHEMA_VERSION) => {
  window.localStorage.setItem(
    WORKSPACE_STORAGE_KEY,
    JSON.stringify({ schemaVersion, workspace }),
  );
};

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  window.localStorage.clear();
});

describe('useStore persistence', () => {
  it('hydrates the workspace from a valid blob on init', () => {
    seedBlob(makeTestWorkspace());

    const { result } = renderHook(() => useStore());

    expect(result.current.model.workspace.animals).toHaveProperty('remy');
    expect(result.current.model.workspace.days).toHaveProperty('remy_20230622');
  });

  it('does not write on legacy formData edits, but does on workspace edits', () => {
    vi.useFakeTimers();
    const setItem = vi.spyOn(window.localStorage, 'setItem');
    const { result } = renderHook(() => useStore());

    // Legacy-only edit: must NOT trigger a workspace write.
    act(() => {
      result.current.actions.updateFormData('session_id', 'legacy_only');
    });
    act(() => {
      vi.advanceTimersByTime(600);
    });
    expect(setItem).not.toHaveBeenCalled();

    // Workspace edit: writes after the debounce.
    act(() => {
      result.current.actions.createAnimal('remy', { species: 'Rattus norvegicus' });
    });
    act(() => {
      vi.advanceTimersByTime(600);
    });
    expect(setItem).toHaveBeenCalledWith(WORKSPACE_STORAGE_KEY, expect.any(String));
  });

  it('sets lastSaved to a timestamp after a confirmed write', () => {
    vi.useFakeTimers();
    const { result } = renderHook(() => useStore());

    expect(result.current.persistence.lastSaved).toBeNull();

    act(() => {
      result.current.actions.createAnimal('remy', { species: 'Rattus norvegicus' });
    });
    act(() => {
      vi.advanceTimersByTime(600);
    });

    expect(result.current.persistence.lastSaved).not.toBeNull();
    expect(result.current.persistence.lastSaved).toMatch(/\dT\d/); // ISO-ish
    expect(result.current.persistence.saveError).toBeNull();
  });

  it('coalesces rapid workspace edits into a single debounced write', () => {
    vi.useFakeTimers();
    const setItem = vi.spyOn(window.localStorage, 'setItem');
    const { result } = renderHook(() => useStore());

    act(() => {
      result.current.actions.createAnimal('a1', { species: 'Rattus norvegicus' });
      result.current.actions.createAnimal('a2', { species: 'Rattus norvegicus' });
      result.current.actions.createAnimal('a3', { species: 'Rattus norvegicus' });
    });
    act(() => {
      vi.advanceTimersByTime(600);
    });

    expect(setItem).toHaveBeenCalledTimes(1);
  });

  it('surfaces a notice and clears the blob when a saved workspace is unusable', () => {
    window.localStorage.setItem(WORKSPACE_STORAGE_KEY, '{corrupt json');

    const { result } = renderHook(() => useStore());

    expect(result.current.persistence.loadNotice).not.toBeNull();
    expect(window.localStorage.getItem(WORKSPACE_STORAGE_KEY)).toBeNull();
    // Starts with an empty workspace rather than crashing.
    expect(result.current.model.workspace.animals).toEqual({});
  });

  it('sets lastSaved only after a confirmed write; reports saveError on failure', () => {
    vi.useFakeTimers();
    const { result } = renderHook(() => useStore());

    // Before any write, lastSaved is null.
    expect(result.current.persistence.lastSaved).toBeNull();

    // Make the write fail (e.g. quota exceeded).
    vi.spyOn(window.localStorage, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceededError');
    });

    act(() => {
      result.current.actions.createAnimal('remy', { species: 'Rattus norvegicus' });
    });
    act(() => {
      vi.advanceTimersByTime(600);
    });

    expect(result.current.persistence.lastSaved).toBeNull();
    expect(result.current.persistence.saveError).toMatch(/could not save/i);
  });

  it('exposes persistence.enabled reflecting the flag (on by default)', () => {
    const { result } = renderHook(() => useStore());
    expect(result.current.persistence.enabled).toBe(true);
  });
});
