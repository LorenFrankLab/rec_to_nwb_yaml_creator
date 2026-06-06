/**
 * Integration tests for the probe-reconfiguration workflow at the store level: the atomic
 * `createConfigurationSnapshotAndApplyForward` (fork + pin in one transition), and proving
 * that days whose resolved configuration is unchanged still export byte-identical YAML.
 */
import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useStore } from '../store';
import { mergeDayMetadata } from '../workspaceUtils';
import { encodeYaml } from '../../io/yaml';
import { makeReconfigWorkspace } from './fixtures/reconfigWorkspace';

describe('probe reconfiguration workflow [integration]', () => {
  it('createConfigurationSnapshotAndApplyForward forks AND pins in one atomic call', () => {
    // The wizard's path: one action appends the new version and moves the day range onto it,
    // with no version handed across two actions. Non-contiguous [1,3] history → unique v4.
    const { workspace, animalId, dayIds, v1, v2 } = makeReconfigWorkspace();
    const animal = workspace.animals[animalId];
    animal.configurationHistory = [
      { version: 1, date: '2023-06-22', description: 'Initial', devices: v1, appliedToDays: [dayIds.day1, dayIds.day2, dayIds.day3, dayIds.day4] },
      { version: 3, date: '2023-06-23', description: 'Imported v3', devices: v2, appliedToDays: [] },
    ];
    Object.values(workspace.days).forEach((d) => { d.configurationVersion = 1; });

    const { result } = renderHook(() => useStore({ workspace }));

    let returned;
    act(() => {
      returned = result.current.actions.createConfigurationSnapshotAndApplyForward(
        animalId,
        { date: '2023-06-24', description: 'Reconfig', devices: structuredClone(v2) },
        [dayIds.day3, dayIds.day4]
      );
    });

    const animalNow = result.current.model.workspace.animals[animalId];
    const days = result.current.model.workspace.days;
    expect(returned).toBe(4);
    expect(animalNow.configurationHistory.map((s) => s.version)).toEqual([1, 3, 4]);
    expect(days[dayIds.day3].configurationVersion).toBe(4);
    expect(days[dayIds.day4].configurationVersion).toBe(4);
    // Clean partition: day3/day4 left v1's list for v4.
    expect(animalNow.configurationHistory[0].appliedToDays.sort()).toEqual([dayIds.day1, dayIds.day2].sort());
    expect(animalNow.configurationHistory[2].appliedToDays.sort()).toEqual([dayIds.day3, dayIds.day4].sort());
  });

  it('createConfigurationSnapshotAndApplyForward reserves DISTINCT versions for two calls in one event', () => {
    // Two atomic calls before React commits must not both append the same version (which the
    // first-match resolver would then mis-pin to). Start [1]; A moves day3 → v2, B moves
    // day4 → v3; history [1,2,3] with each day pinned to the snapshot it actually created.
    const { workspace, animalId, dayIds, v1, v2 } = makeReconfigWorkspace();
    const animal = workspace.animals[animalId];
    animal.configurationHistory = [
      { version: 1, date: '2023-06-22', description: 'Initial', devices: v1, appliedToDays: [dayIds.day1, dayIds.day2, dayIds.day3, dayIds.day4] },
    ];
    Object.values(workspace.days).forEach((d) => { d.configurationVersion = 1; });

    const { result } = renderHook(() => useStore({ workspace }));

    let first;
    let second;
    act(() => {
      first = result.current.actions.createConfigurationSnapshotAndApplyForward(animalId, { date: '2023-06-24', description: 'A', devices: structuredClone(v2) }, [dayIds.day3]);
      second = result.current.actions.createConfigurationSnapshotAndApplyForward(animalId, { date: '2023-06-25', description: 'B', devices: structuredClone(v2) }, [dayIds.day4]);
    });

    const animalNow = result.current.model.workspace.animals[animalId];
    const days = result.current.model.workspace.days;
    expect([first, second]).toEqual([2, 3]);
    expect(animalNow.configurationHistory.map((s) => s.version)).toEqual([1, 2, 3]);
    expect(days[dayIds.day3].configurationVersion).toBe(2);
    expect(days[dayIds.day4].configurationVersion).toBe(3);
  });

  it('keeps export byte-identical for days whose resolved snapshot is unchanged', () => {
    const { workspace, animalId, dayIds } = makeReconfigWorkspace();
    const { result } = renderHook(() => useStore({ workspace }));

    const exportFor = (dayId) => {
      const ws = result.current.model.workspace;
      return encodeYaml(mergeDayMetadata(ws.animals[animalId], ws.days[dayId]));
    };

    const before = {
      day1: exportFor(dayIds.day1), // v1
      day2: exportFor(dayIds.day2), // v1
      day4: exportFor(dayIds.day4), // v2
    };

    // Re-pin day3 from v2 to the existing v1 (via updateDay's configurationVersion — the
    // surviving re-pin path). This must not reflow any OTHER day's output.
    act(() => {
      result.current.actions.updateDay(dayIds.day3, { configurationVersion: 1 });
    });

    expect(result.current.model.workspace.days[dayIds.day3].configurationVersion).toBe(1);
    expect(exportFor(dayIds.day1)).toBe(before.day1);
    expect(exportFor(dayIds.day2)).toBe(before.day2);
    expect(exportFor(dayIds.day4)).toBe(before.day4);
  });
});
