/**
 * Tests for the probe-reconfiguration store actions:
 * - `updateDay` accepting `configurationVersion`
 * - `applyConfigurationForward` reassigning versions and partitioning `appliedToDays`
 */
import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useStore } from '../store';
import { makeReconfigWorkspace } from './fixtures/reconfigWorkspace';

/**
 * Render the store seeded with a fresh reconfiguration workspace.
 *
 * @returns {{ result: object, animalId: string, dayIds: object }}
 */
function renderStore() {
  const { workspace, animalId, dayIds } = makeReconfigWorkspace();
  const { result } = renderHook(() => useStore({ workspace }));
  return { result, animalId, dayIds };
}

const daysOf = (result) => result.current.model.workspace.days;
const animalOf = (result, animalId) => result.current.model.workspace.animals[animalId];
const snapshot = (result, animalId, version) =>
  animalOf(result, animalId).configurationHistory.find((s) => s.version === version);

describe('updateDay configurationVersion', () => {
  it('sets configurationVersion and bumps lastModified without touching other fields', () => {
    const { result, dayIds } = renderStore();
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

describe('applyConfigurationForward', () => {
  it('reassigns configurationVersion for every listed day', () => {
    const { result, animalId, dayIds } = renderStore();

    act(() => {
      result.current.actions.applyConfigurationForward(animalId, 1, [dayIds.day3, dayIds.day4]);
    });

    expect(daysOf(result)[dayIds.day3].configurationVersion).toBe(1);
    expect(daysOf(result)[dayIds.day4].configurationVersion).toBe(1);
  });

  it('keeps appliedToDays a partition (each day in at most one snapshot)', () => {
    const { result, animalId, dayIds } = renderStore();

    act(() => {
      result.current.actions.applyConfigurationForward(animalId, 1, [dayIds.day3]);
    });

    const v1 = snapshot(result, animalId, 1);
    const v2 = snapshot(result, animalId, 2);

    // Target gained day3; it kept its prior members.
    expect(v1.appliedToDays.sort()).toEqual([dayIds.day1, dayIds.day2, dayIds.day3].sort());
    // day3 was removed from v2.
    expect(v2.appliedToDays).toEqual([dayIds.day4]);

    // No day appears in two snapshots' lists.
    const all = [...v1.appliedToDays, ...v2.appliedToDays];
    expect(new Set(all).size).toBe(all.length);
  });

  it('leaves out-of-scope days unchanged', () => {
    const { result, animalId, dayIds } = renderStore();

    act(() => {
      result.current.actions.applyConfigurationForward(animalId, 1, [dayIds.day3]);
    });

    expect(daysOf(result)[dayIds.day1].configurationVersion).toBe(1);
    expect(daysOf(result)[dayIds.day2].configurationVersion).toBe(1);
    expect(daysOf(result)[dayIds.day4].configurationVersion).toBe(2);
  });

  it('throws on an unknown snapshot version and does not mutate state', () => {
    const { result, animalId, dayIds } = renderStore();
    const before = JSON.stringify(result.current.model.workspace);

    expect(() => {
      act(() => {
        result.current.actions.applyConfigurationForward(animalId, 99, [dayIds.day1]);
      });
    }).toThrow(/version/i);

    expect(JSON.stringify(result.current.model.workspace)).toBe(before);
  });

  it('ignores day ids not in the workspace (no phantom entries in appliedToDays)', () => {
    const { result, animalId, dayIds } = renderStore();

    act(() => {
      result.current.actions.applyConfigurationForward(animalId, 1, [dayIds.day3, 'no-such-day']);
    });

    const v1 = snapshot(result, animalId, 1);
    expect(v1.appliedToDays).not.toContain('no-such-day');
    expect(v1.appliedToDays).toContain(dayIds.day3);
    expect(daysOf(result)[dayIds.day3].configurationVersion).toBe(1);
    // The phantom id created no day entry.
    expect(daysOf(result)['no-such-day']).toBeUndefined();
  });

  it('throws on an unknown animal id', () => {
    const { result, dayIds } = renderStore();

    expect(() => {
      act(() => {
        result.current.actions.applyConfigurationForward('ghost', 1, [dayIds.day1]);
      });
    }).toThrow(/ghost/);
  });
});
