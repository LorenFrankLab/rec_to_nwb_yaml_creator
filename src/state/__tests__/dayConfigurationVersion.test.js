/**
 * Re-pinning a day to an existing configuration version via `updateDay`'s
 * `configurationVersion` field — the surviving re-pin path (the standalone
 * `applyConfigurationForward` action was removed as production-dead; the reconfiguration
 * wizard creates+applies atomically via `createConfigurationSnapshotAndApplyForward`, and
 * the trustworthy applied-to-days view is derived by `reconcileAppliedToDays`).
 */
import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useStore } from '../store';
import { makeReconfigWorkspace } from './fixtures/reconfigWorkspace';

const daysOf = (result) => result.current.model.workspace.days;

describe('updateDay configurationVersion', () => {
  it('sets configurationVersion and bumps lastModified without touching other fields', () => {
    const { workspace, dayIds } = makeReconfigWorkspace();
    const { result } = renderHook(() => useStore({ workspace }));
    const before = daysOf(result)[dayIds.day1];
    const beforeSession = before.session;
    const beforeModified = before.lastModified;

    act(() => {
      result.current.actions.updateDay(dayIds.day1, { configurationVersion: 2 });
    });

    const after = daysOf(result)[dayIds.day1];
    expect(after.configurationVersion).toBe(2);
    expect(after.lastModified).not.toBe(beforeModified);
    // Other fields untouched.
    expect(after.session).toEqual(beforeSession);
    expect(after.tasks).toEqual(before.tasks);
  });
});
