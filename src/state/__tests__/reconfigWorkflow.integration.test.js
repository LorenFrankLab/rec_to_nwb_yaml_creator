/**
 * Integration tests for the probe-reconfiguration workflow at the store level:
 * creating a snapshot then applying it forward, and proving that days whose
 * resolved configuration is unchanged still export byte-identical YAML.
 */
import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useStore } from '../store';
import { mergeDayMetadata } from '../workspaceUtils';
import { encodeYaml } from '../../io/yaml';
import { makeReconfigWorkspace } from './fixtures/reconfigWorkspace';

describe('probe reconfiguration workflow [integration]', () => {
  it('creates a new snapshot and applies it forward from a chosen day', () => {
    // Start from a single-version baseline: all four days on v1, the live animal
    // config already advanced to the v2 probe layout (edited in the Animal Editor).
    const { workspace, animalId, dayIds, v1, v2 } = makeReconfigWorkspace();
    const animal = workspace.animals[animalId];
    animal.configurationHistory = [
      { version: 1, date: '2023-06-22', description: 'Initial configuration', devices: v1, appliedToDays: [dayIds.day1, dayIds.day2, dayIds.day3, dayIds.day4] },
    ];
    Object.values(workspace.days).forEach((d) => {
      d.configurationVersion = 1;
    });
    animal.devices = { ...animal.devices, ...v2 };

    const { result } = renderHook(() => useStore({ workspace }));

    act(() => {
      result.current.actions.addConfigurationSnapshot(animalId, {
        date: '2023-06-24',
        description: 'Added CA3 tetrode; remapped shank 2',
        devices: structuredClone(v2),
      });
    });

    // The new snapshot is version 2.
    const history = () => result.current.model.workspace.animals[animalId].configurationHistory;
    expect(history()).toHaveLength(2);
    expect(history()[1].version).toBe(2);

    act(() => {
      result.current.actions.applyConfigurationForward(animalId, 2, [dayIds.day3, dayIds.day4]);
    });

    const days = result.current.model.workspace.days;
    // Days 1–2 stay v1; days 3–4 adopt v2.
    expect(days[dayIds.day1].configurationVersion).toBe(1);
    expect(days[dayIds.day2].configurationVersion).toBe(1);
    expect(days[dayIds.day3].configurationVersion).toBe(2);
    expect(days[dayIds.day4].configurationVersion).toBe(2);

    // appliedToDays is a partition.
    const [snap1, snap2] = history();
    expect(snap1.appliedToDays.sort()).toEqual([dayIds.day1, dayIds.day2].sort());
    expect(snap2.appliedToDays.sort()).toEqual([dayIds.day3, dayIds.day4].sort());
  });

  it('returns and appends a UNIQUE version for a non-contiguous history ([1,3] -> 4)', () => {
    // A repaired/imported history can skip a version. addConfigurationSnapshot must allocate
    // max+1 (4), not the count+1 (3) — a duplicate 3 would let applyConfigurationForward /
    // resolveDayConfig first-match resolve to the wrong snapshot. The returned version must
    // match the appended one so the wizard applies days onto the snapshot it just created.
    const { workspace, animalId, v1, v2 } = makeReconfigWorkspace();
    const animal = workspace.animals[animalId];
    animal.configurationHistory = [
      { version: 1, date: '2023-06-22', description: 'Initial', devices: v1, appliedToDays: [] },
      { version: 3, date: '2023-06-23', description: 'Imported v3', devices: v2, appliedToDays: [] },
    ];

    const { result } = renderHook(() => useStore({ workspace }));

    let returned;
    act(() => {
      returned = result.current.actions.addConfigurationSnapshot(animalId, {
        date: '2023-06-24',
        description: 'Next reconfig',
        devices: structuredClone(v2),
      });
    });

    const history = result.current.model.workspace.animals[animalId].configurationHistory;
    expect(history.map((s) => s.version)).toEqual([1, 3, 4]);
    expect(returned).toBe(4);
  });

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

  it('addConfigurationSnapshot returns DISTINCT versions for two calls in one event (reservation)', () => {
    // Synchronous version reservation: composing the primitive twice before React commits must
    // not return the same stale version. Two adds on [1] → returns 2 then 3, history [1,2,3].
    const { workspace, animalId, v1, v2 } = makeReconfigWorkspace();
    const animal = workspace.animals[animalId];
    animal.configurationHistory = [
      { version: 1, date: '2023-06-22', description: 'Initial', devices: v1, appliedToDays: [] },
    ];

    const { result } = renderHook(() => useStore({ workspace }));

    let first;
    let second;
    act(() => {
      first = result.current.actions.addConfigurationSnapshot(animalId, { date: '2023-06-24', description: 'A', devices: structuredClone(v2) });
      second = result.current.actions.addConfigurationSnapshot(animalId, { date: '2023-06-25', description: 'B', devices: structuredClone(v2) });
    });

    expect([first, second]).toEqual([2, 3]);
    expect(result.current.model.workspace.animals[animalId].configurationHistory.map((s) => s.version)).toEqual([1, 2, 3]);
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

    // Move day3 from v2 to v1. This must not reflow any OTHER day's output.
    act(() => {
      result.current.actions.applyConfigurationForward(animalId, 1, [dayIds.day3]);
    });

    expect(exportFor(dayIds.day1)).toBe(before.day1);
    expect(exportFor(dayIds.day2)).toBe(before.day2);
    expect(exportFor(dayIds.day4)).toBe(before.day4);
  });
});
