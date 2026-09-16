import { isExportEnabled } from '../../domain/stepGate';
import { describe, it, expect } from 'vitest';
import { createWorkspaceActions } from '../workspaceActions';
import { applyDayUpdates, createDayRecord } from '../workspaceTransitions';
import { mergeDayMetadata } from '../workspaceUtils';
import { buildCatalogWorkspace } from '../../__tests__/fixtures/workspaceBuilders';
import { restoreCopiedTaskContext } from '../../domain/copiedTaskContext';
import { validateDay, computeStepStatus } from '../../domain/validation';
import { suspiciousVoltageIssues, RIG_FALLBACK } from '../../domain/rigConstants';
import { compareTrodesHeader, parseTrodesHeader } from '../../domain/trodesHeaderMapping';

const NOW = '2026-09-15T01:30:00Z';

describe('scientist review: scientific data survives corrections and follow-up creation', () => {
  it('uses volts/count, preserving the intended 0.195 microvolts/count fallback', () => {
    const { animal } = buildCatalogWorkspace();
    delete animal.technicalDefaults;
    const day = createDayRecord(animal, animal.id, 'new', '2023-06-23', {}, NOW);
    expect(day.technical.raw_data_to_volts).toBe(1.95e-7);
    expect(day.technical.raw_data_to_volts * 1e6).toBeCloseTo(0.195, 12);
    expect(RIG_FALLBACK.raw_data_to_volts).toBe(day.technical.raw_data_to_volts);
  });

  it('flags the former voltage value without changing imported scientific data', () => {
    const { animal, day } = buildCatalogWorkspace();
    day.technical.raw_data_to_volts = 0.195;
    const before = structuredClone(day);
    expect(suspiciousVoltageIssues(mergeDayMetadata(animal, day))).toEqual([
      expect.objectContaining({ code: 'voltage_units_review', severity: 'warning', repairSurface: 'day' }),
    ]);
    expect(day).toEqual(before);
    const corrected = applyDayUpdates(day, { technical: { raw_data_to_volts: 1.95e-7 } }, NOW);
    expect(suspiciousVoltageIssues(mergeDayMetadata(animal, corrected))).toEqual([]);
    expect(day.technical.raw_data_to_volts).toBe(0.195);
  });

  it('keeps warning-only overview data exportable', () => {
    const { animal, day } = buildCatalogWorkspace();
    animal.subject.subject_id = '12345'; // advisory placeholder warning, valid filename token
    const merged = mergeDayMetadata(animal, day);
    expect(validateDay(day, merged, animal).some((issue) => issue.code === 'placeholder_subject_id')).toBe(true);
    const status = computeStepStatus(day, merged, animal);
    expect(status.overview).toBe('valid');
    expect(isExportEnabled(status)).toBe(true);
  });

  it('requires a follow-up context decision and restores source context without changing the source day', () => {
    const { animal, day } = buildCatalogWorkspace();
    day.taskInstances[0].task_environment = 'Room B';
    day.taskInstances[0].camera_id = [1, 0];
    const before = structuredClone(day);
    const followup = createDayRecord(animal, animal.id, 'followup', '2023-06-23', {}, NOW, { carryFrom: day });
    expect(followup.session).not.toHaveProperty('weight');
    expect(followup.taskInstances[0]).not.toHaveProperty('task_environment');
    expect(followup.provenance.taskContextReset).toEqual([day.taskInstances[0]]);
    expect(validateDay(followup, mergeDayMetadata(animal, followup), animal)).toContainEqual(expect.objectContaining({ code: 'copied_task_context_review', severity: 'error', step: 'epochs' }));
    const corrected = applyDayUpdates(followup, {
      taskInstances: restoreCopiedTaskContext(followup.taskInstances, followup.provenance.taskContextReset),
      provenance: { taskContextReset: undefined },
    }, NOW);
    expect(corrected.taskInstances).toHaveLength(followup.taskInstances.length);
    expect(mergeDayMetadata(animal, corrected).tasks[0]).toMatchObject({ task_environment: 'Room B', camera_id: [1, 0] });
    expect(validateDay(corrected, mergeDayMetadata(animal, corrected), animal).some((issue) => issue.code === 'copied_task_context_review')).toBe(false);
    expect(day).toEqual(before);
  });

  it('does not ask for context review when carried values already equal the defaults', () => {
    const { animal, day } = buildCatalogWorkspace();
    const type = animal.taskTypes.find((type) => type.id === day.taskInstances[0].taskTypeId);
    day.taskInstances[0].task_environment = type.task_environment;
    day.taskInstances[0].camera_id = [...type.camera_id];
    const followup = createDayRecord(animal, animal.id, 'followup', '2023-06-23', {}, NOW, { carryFrom: day });
    expect(followup.provenance.taskContextReset).toEqual([]);
  });

  it('preserves import origin when confirming a configuration on an older imported day', () => {
    const { day } = buildCatalogWorkspace();
    day.provenance = { enteredAt: NOW, configuration: { source: 'import', confirmed: false }, fields: {} };
    const confirmed = applyDayUpdates(day, { provenance: { configuration: { source: 'explicit', confirmed: true } } }, NOW);
    expect(confirmed.provenance).toMatchObject({ origin: 'import', configuration: { source: 'explicit', confirmed: true } });
  });

  it('renames ntrodes atomically, retaining failed electrodes and historical configurations', () => {
    const { animal, day } = buildCatalogWorkspace();
    animal.devices = { ...animal.devices, ...structuredClone(animal.configurationHistory[0].devices) };
    const maps = animal.devices.ntrode_electrode_group_channel_map;
    day.deviceOverrides = { bad_channels: { [maps[0].ntrode_id]: [2], [maps[1].ntrode_id]: [3] } };
    const oldDay = { ...structuredClone(day), id: 'old', configurationVersion: 0 };
    let workspace = { animals: { [animal.id]: animal }, days: { [day.id]: day, old: oldDay } };
    const ref = { current: workspace };
    const actions = createWorkspaceActions({ workspaceRef: ref, commitWorkspace: (update) => { workspace = update(workspace); ref.current = workspace; } });
    const changed = maps.map((map, index) => ({ ...map, ntrode_id: index === 0 ? 7 : index === 1 ? 42 : 100 + index }));
    actions.correctChannelMaps(animal.id, changed);
    expect(workspace.days[day.id].deviceOverrides.bad_channels).toEqual({ 7: [2], 42: [3] });
    expect(workspace.days.old).toEqual(oldDay);
    expect(workspace.animals[animal.id].configurationHistory[0].devices.ntrode_electrode_group_channel_map).toEqual(changed);
    // An anatomical correction must retain the exact acquisition mapping.
    actions.updateAnimal(animal.id, { devices: { electrode_groups: animal.devices.electrode_groups.map((group) => ({ ...group, targeted_x: 2 })) } });
    expect(workspace.animals[animal.id].devices.ntrode_electrode_group_channel_map).toEqual(changed);
  });
});

describe('Trodes header comparison', () => {
  const xml = '<Configuration><SpikeConfiguration><SpikeNTrode id="7"><SpikeChannel/><SpikeChannel/><SpikeChannel/><SpikeChannel/></SpikeNTrode></SpikeConfiguration></Configuration>';
  const map = { ntrode_id: 7, electrode_group_id: 0, map: { 0: 2, 1: 0, 2: 3, 3: 1 }, bad_channels: [] };
  it('accepts nonzero IDs and compares count without claiming to verify electrode order', () => {
    expect(parseTrodesHeader(xml)).toEqual([{ id: 7, channels: 4 }]);
    expect(compareTrodesHeader(parseTrodesHeader(xml), [map])).toEqual([]);
    expect(compareTrodesHeader(parseTrodesHeader(xml), [{ ...map, ntrode_id: 0 }])).toHaveLength(2);
    expect(compareTrodesHeader(parseTrodesHeader(xml), [{ ...map, map: { 0: 2 } }])[0]).toMatch(/header has 4 channels/);
  });
  it('rejects malformed XML, missing configuration, duplicate IDs, and invalid IDs', () => {
    for (const bad of ['<broken', '<Configuration/>', xml.replace('id="7"', 'id=""'), xml.replace('</SpikeConfiguration>', '<SpikeNTrode id="7"><SpikeChannel/></SpikeNTrode></SpikeConfiguration>')]) {
      expect(() => parseTrodesHeader(bad)).toThrow();
    }
  });
});

describe('physical hardware continuity', () => {
  it('keeps failed electrodes through a position change, including a recording created later', async () => {
    const { createSnapshotAndApplyForward } = await import('../workspaceTransitions');
    const { animal, day } = buildCatalogWorkspace();
    const devices = animal.configurationHistory[0].devices;
    const sourceId = devices.ntrode_electrode_group_channel_map[0].ntrode_id;
    day.deviceOverrides = { bad_channels: { [sourceId]: [2] } };
    const moved = createSnapshotAndApplyForward(animal, { [day.id]: day }, {
      date: '2023-06-23', description: 'Lowered tetrodes', devices, failurePolicy: 'same-hardware',
    }, [], NOW);
    const followup = createDayRecord(moved.animal, animal.id, 'followup', '2023-06-23', {}, NOW, { carryFrom: day });
    expect(followup.configurationVersion).toBe(2);
    expect(followup.deviceOverrides.bad_channels).toEqual({ [sourceId]: [2] });
    expect(moved.days[day.id]).toBe(day);
  });

  it('resets only moved-day failures for replacement hardware and keeps earlier records', async () => {
    const { createSnapshotAndApplyForward } = await import('../workspaceTransitions');
    const { animal, day } = buildCatalogWorkspace();
    day.deviceOverrides = { bad_channels: { 1: [2] } };
    const later = { ...structuredClone(day), id: 'later', date: '2023-06-23' };
    const next = createSnapshotAndApplyForward(animal, { [day.id]: day, later }, {
      date: later.date, description: 'Replacement', devices: animal.configurationHistory[0].devices, failurePolicy: 'replacement',
    }, ['later'], NOW);
    expect(next.days.later.deviceOverrides.bad_channels).toEqual({});
    expect(next.days[day.id]).toEqual(day);
    expect(next.animal.configurationHistory[1].devices.ntrode_electrode_group_channel_map.every((map) => map.bad_channels.length === 0)).toBe(true);
    expect(animal.configurationHistory).toHaveLength(1);
  });
});
