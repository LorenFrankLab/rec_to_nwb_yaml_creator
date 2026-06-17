/**
 * @file store-persistence.test.js
 * @description Tests for localStorage autosave wired into useStore.
 *
 * Covers hydrate-on-init, workspace-only writes (never legacy formData),
 * debounce coalescing, discard-with-notice on an unusable blob, and that
 * lastSaved is set only after a confirmed write.
 */

import { describe, it, expect, afterEach, vi } from 'vitest';
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
    expect(result.current.persistence.loadOutcome).toBeNull();
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
    expect(result.current.persistence.loadOutcome).toBe('discarded');
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

  it('keeps the unsaved-work guard armed after a failed autosave', () => {
    vi.useFakeTimers();
    const { result } = renderHook(() => useStore());

    vi.spyOn(window.localStorage, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceededError');
    });

    act(() => {
      result.current.actions.createAnimal('remy', { species: 'Rattus norvegicus' });
    });
    act(() => {
      vi.advanceTimersByTime(600);
    });

    // The write never succeeded: do NOT report a clean state. The pending-write flag
    // stays set and saveError is populated, so the beforeunload guard remains armed.
    expect(result.current.persistence.saveError).toMatch(/could not save/i);
    expect(result.current.persistence.hasPendingWrite).toBe(true);
  });

  it('auto-retries once after a transient autosave failure, clearing the error on the retry', () => {
    vi.useFakeTimers();
    const { result } = renderHook(() => useStore());

    // Fail the first debounced write, then let the bounded retry succeed (a transient blip).
    const setItem = vi.spyOn(window.localStorage, 'setItem').mockImplementationOnce(() => {
      throw new Error('QuotaExceededError');
    });

    act(() => {
      result.current.actions.createAnimal('remy', { species: 'Rattus norvegicus' });
    });
    act(() => {
      vi.advanceTimersByTime(600); // first attempt fails → saveError set, retry armed
    });
    expect(result.current.persistence.saveError).toMatch(/could not save/i);
    expect(result.current.persistence.hasPendingWrite).toBe(true);

    act(() => {
      vi.advanceTimersByTime(2100); // bounded retry fires and now succeeds
    });
    expect(result.current.persistence.saveError).toBeNull();
    expect(result.current.persistence.hasPendingWrite).toBe(false);
    expect(setItem).toHaveBeenCalledTimes(2); // one failed attempt + one successful retry
  });

  it('hydrates a structurally-empty blob and surfaces a recovery notice naming the missing sections', () => {
    // A valid-but-empty workspace blob (e.g. from an aborted/older write) must hydrate
    // cleanly rather than crash a consumer on Object.keys(undefined).
    seedBlob({});

    const { result } = renderHook(() => useStore());

    expect(result.current.model.workspace.animals).toEqual({});
    expect(result.current.model.workspace.days).toEqual({});
    expect(result.current.persistence.loadNotice).toMatch(/animals/);
    expect(result.current.persistence.loadNotice).toMatch(/days/);
    expect(result.current.persistence.loadOutcome).toBe('recovered');
  });

  it('recovery notice names only the genuinely-missing section (settings), not present ones', () => {
    seedBlob({ animals: {}, days: {} }); // only settings absent

    const { result } = renderHook(() => useStore());

    expect(result.current.persistence.loadNotice).toMatch(/settings/);
    expect(result.current.persistence.loadNotice).not.toMatch(/animals/);
    expect(result.current.persistence.loadNotice).not.toMatch(/days/);
    expect(result.current.persistence.loadOutcome).toBe('recovered');
  });

  it('discards (not recovers) a corrupt-typed section: discard notice + cleared blob + empty workspace', () => {
    // A present-but-wrong-typed section is corruption, not absence: the store must route
    // it to the loud discard path (notice + clear blob), never the recovery path.
    seedBlob({ animals: ['corrupt'], days: {}, settings: {} });

    const { result } = renderHook(() => useStore());

    expect(result.current.persistence.loadNotice).toMatch(/could not be restored/i);
    expect(result.current.persistence.loadOutcome).toBe('discarded');
    expect(window.localStorage.getItem(WORKSPACE_STORAGE_KEY)).toBeNull();
    expect(result.current.model.workspace.animals).toEqual({});
  });

  it('exposes persistence.enabled reflecting the flag (on by default)', () => {
    const { result } = renderHook(() => useStore());
    expect(result.current.persistence.enabled).toBe(true);
  });

  it('saveNow flushes immediately and records lastSaved (Ctrl/Cmd+S path)', () => {
    const { result } = renderHook(() => useStore({ workspace: makeTestWorkspace() }));
    expect(result.current.persistence.lastSaved).toBeNull();

    act(() => {
      result.current.persistence.saveNow();
    });

    // Written synchronously (no debounce wait) and success recorded.
    const blob = JSON.parse(window.localStorage.getItem(WORKSPACE_STORAGE_KEY));
    expect(blob.schemaVersion).toBe(WORKSPACE_SCHEMA_VERSION);
    expect(blob.workspace.animals).toHaveProperty('remy');
    expect(result.current.persistence.lastSaved).not.toBeNull();
    expect(result.current.persistence.saveError).toBeNull();
  });

  it('saveNow surfaces an error and does not claim success when the write throws', () => {
    const { result } = renderHook(() => useStore({ workspace: makeTestWorkspace() }));
    const spy = vi.spyOn(window.localStorage, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceeded');
    });

    act(() => {
      result.current.persistence.saveNow();
    });

    expect(result.current.persistence.saveError).toMatch(/could not save/i);
    expect(result.current.persistence.lastSaved).toBeNull();
    spy.mockRestore();
  });
});
