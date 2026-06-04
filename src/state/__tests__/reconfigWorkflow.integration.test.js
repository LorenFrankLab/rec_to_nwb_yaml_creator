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
