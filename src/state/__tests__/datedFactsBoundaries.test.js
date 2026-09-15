/**
 * Increment-2 boundaries through the REAL store:
 *  #5 a June 25 backfill selects the setup effective then, even when a newer setup became
 *     effective July 1 (and copies from the nearest EARLIER day, not the latest);
 *  #8 copying a day follows the field rules (weight never, rig yes, folder derived, files cleared,
 *     team/opto copied, receipt cleared, bad channels only within the same configuration);
 *  #9 a correction — or a filename/identity change — makes a previous download stale.
 */
import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useStore } from '../store';
import { mergeDayMetadata } from '../workspaceUtils';
import { exportDayFile } from '../../domain/exportDay';
import { exportFreshness, exportFreshnessStatus } from '../../domain/exportReceipt';
import { getDayRowStatus } from '../../domain/workflowStatus';
import { validateDay } from '../../domain/dayValidationComposer';
import { buildCatalogWorkspace } from '../../__tests__/fixtures/workspaceBuilders';

vi.mock('../../io/yaml', async () => {
  const actual = await vi.importActual('../../io/yaml');
  return { ...actual, downloadYamlFile: vi.fn() };
});

/**
 * A two-day, two-configuration animal (v1 June 1, v2 July 1) with a June 22 day on v1 and a July 2 day on v2.
 *
 * @returns {{workspace: object}}
 */
function seed() {
  const { animal, day } = buildCatalogWorkspace();
  const v1 = { ...animal.configurationHistory[0], version: 1, date: '2023-06-01', description: 'implant' };
  const v2 = { ...structuredClone(v1), version: 2, date: '2023-07-01', description: 'lowered' };
  const june22 = {
    ...day,
    id: 'remy-2023-06-22',
    date: '2023-06-22',
    session: { ...day.session, session_id: 'remy_20230622', weight: 480 },
    experimenters: { experimenter_name: ['Doe, Jane'], lab: 'Frank', institution: 'UCSF' },
    optogenetics: null,
    data_acq_device_name: 'Second rig',
    dataFolder: '/data/remy/20230622/',
    deviceOverrides: { bad_channels: { 1: [2] } },
    associated_files: [{ name: 'log', description: 'd', path: '/data/remy/20230622/log.txt', task_epochs: 1 }],
    configurationVersion: 1,
    state: { draft: false, validated: true, exported: true, videolessEpochs: [1, 3, 5] },
    exportReceipt: { filename: 'x', exportedAt: 'x', contentHash: 'abc', appVersion: 'x', schemaVersion: 4, yamlStored: false },
  };
  const july02 = {
    ...structuredClone(june22),
    id: 'remy-2023-07-02',
    date: '2023-07-02',
    session: { ...june22.session, session_id: 'remy_20230702', weight: 530 },
    experimenters: { experimenter_name: ['Doe, Jane', 'Roe, Richard'], lab: 'Frank', institution: 'UCSF' },
    dataFolder: '/data/remy/20230702/',
    configurationVersion: 2,
  };
  const a = {
    ...animal,
    devices: {
      ...animal.devices,
      data_acq_device: [
        ...animal.devices.data_acq_device,
        { name: 'Second rig', system: 'SpikeGadgets', amplifier: 'Intan', adc_circuit: 'Intan' },
      ],
    },
    configurationHistory: [v1, v2],
    days: [june22.id, july02.id],
  };
  return {
    workspace: {
      version: '1.0.0',
      lastModified: 'x',
      animals: { remy: a },
      days: { [june22.id]: june22, [july02.id]: july02 },
      settings: { defaultLab: '', defaultInstitution: '', defaultExperimenters: [], autoSaveInterval: 30000, shadowExportEnabled: true },
    },
  };
}

describe('#5 backfill selects the setup effective on the recording date', () => {
  it('June 25 gets v1 (effective June 1), not v2 (July 1), and copies from June 22, not July 2', () => {
    const { result } = renderHook(() => useStore(seed()));
    act(() => {
      result.current.actions.createDay('remy', '2023-06-25', { session_id: 'remy_20230625', session_description: 'backfill' }, { carryForwardFromDayId: 'auto' });
    });
    const day = result.current.model.workspace.days['remy-2023-06-25'];
    expect(day.configurationVersion).toBe(1);
    expect(day.provenance.configuration).toEqual({ source: 'effective-date', confirmed: true });
    expect(day.provenance.copiedFromDayId).toBe('remy-2023-06-22');
    expect(day.provenance.copiedFromDate).toBe('2023-06-22');
    // Copied from June 22 (team of one), not from July 2 (team of two).
    expect(day.experimenters.experimenter_name).toEqual(['Doe, Jane']);
    // The resolved geometry is v1's.
    const merged = mergeDayMetadata(result.current.model.workspace.animals.remy, day);
    expect(merged.electrode_groups.length).toBeGreaterThan(0);
  });

  it('a day before every known effective date is pinned to v1 but left UNCONFIRMED (export blocked until confirmed)', () => {
    const { result } = renderHook(() => useStore(seed()));
    act(() => {
      result.current.actions.createDay('remy', '2023-05-20', { session_id: 'remy_20230520', session_description: 'early' });
    });
    const day = result.current.model.workspace.days['remy-2023-05-20'];
    expect(day.configurationVersion).toBe(1);
    expect(day.provenance.configuration.confirmed).toBe(false);
    const animal = result.current.model.workspace.animals.remy;
    const issue = validateDay(day, mergeDayMetadata(animal, day), animal).find((i) => i.code === 'configuration_effective_date_unconfirmed');
    expect(issue?.severity).toBe('error');
    expect(issue?.message).toMatch(/probe setup v1/i);
    // The explicit confirmation clears the blocker (an off-export provenance fact, never an invented date).
    act(() => {
      result.current.actions.updateDay(day.id, { provenance: { configuration: { source: 'explicit', confirmed: true } } });
    });
    const after = result.current.model.workspace.days[day.id];
    expect(validateDay(after, mergeDayMetadata(animal, after), animal).some((i) => i.code === 'configuration_effective_date_unconfirmed')).toBe(false);
  });
});

describe('#8 copying a day follows the field rules', () => {
  it('weight never; rig, team, opto, tasks, DIO copied; folder derived; files + receipt cleared; bad channels only within the same configuration', () => {
    const { result } = renderHook(() => useStore(seed()));
    act(() => {
      result.current.actions.createDay('remy', '2023-06-25', { session_id: 'remy_20230625', session_description: 'next' }, { carryForwardFromDayId: 'auto' });
    });
    const src = result.current.model.workspace.days['remy-2023-06-22'];
    const day = result.current.model.workspace.days['remy-2023-06-25'];
    expect(day.session.weight).toBeUndefined();              // a measurement is never copied
    expect(day.data_acq_device_name).toBe('Second rig');     // the rig choice is preserved (F7)
    expect(day.experimenters).toEqual(src.experimenters);    // team copied
    expect(day.optogenetics).toBeNull();                     // opto snapshot copied (none)
    expect(day.taskInstances).toEqual(src.taskInstances);    // epoch plan copied
    expect(day.behavioral_events).toEqual(src.behavioral_events);
    expect(day.dataFolder).toBe('/data/remy/20230625/');     // date-aware, never the old dated folder
    expect(day.associated_files).toEqual([]);                // session files cleared
    expect(day.exportReceipt).toBeUndefined();               // download status cleared
    expect(day.state).toMatchObject({ draft: true, exported: false });
    // Same configuration (v1) → the source's marks (incl. the base marks hydration moved onto it) are carried.
    expect(day.deviceOverrides?.bad_channels).toEqual(src.deviceOverrides.bad_channels);
    expect(Object.keys(day.deviceOverrides.bad_channels)).toContain('1');
    expect(day.provenance.fields).toMatchObject({ dataFolder: 'derived', data_acq_device_name: 'copied', experimenters: 'copied' });
  });

  it('bad channels are NOT carried across a configuration change', () => {
    const { result } = renderHook(() => useStore(seed()));
    // July 5: pinned to v2 by date; nearest earlier day is July 2 (v2) → carried. July 1 with source June 22 (v1) → not carried.
    act(() => {
      result.current.actions.createDay('remy', '2023-07-01', { session_id: 'remy_20230701', session_description: 'reconfig day' }, { carryForwardFromDayId: 'remy-2023-06-22' });
    });
    const day = result.current.model.workspace.days['remy-2023-07-01'];
    expect(day.configurationVersion).toBe(2);
    expect(day.deviceOverrides).toBeUndefined();
  });
});

describe('#5b duplicating a day selects the setup by the TARGET date, like creation', () => {
  it('forward: duplicating June 22 (v1) to July 5 pins v2 (effective July 1) as confirmed and does not carry v1 bad channels', () => {
    const { result } = renderHook(() => useStore(seed()));
    act(() => {
      result.current.actions.duplicateDay('remy-2023-06-22', '2023-07-05');
    });
    const day = result.current.model.workspace.days['remy-2023-07-05'];
    expect(day.configurationVersion).toBe(2);
    expect(day.provenance.configuration).toEqual({ source: 'effective-date', confirmed: true });
    expect(day.deviceOverrides).toBeUndefined();
    const animal = result.current.model.workspace.animals.remy;
    expect(validateDay(day, mergeDayMetadata(animal, day), animal).some((i) => i.code === 'configuration_effective_date_unconfirmed')).toBe(false);
  });

  it('backward: duplicating July 2 (v2) to June 25 pins v1 (effective June 1), still copying July 2’s team', () => {
    const { result } = renderHook(() => useStore(seed()));
    act(() => {
      result.current.actions.duplicateDay('remy-2023-07-02', '2023-06-25');
    });
    const day = result.current.model.workspace.days['remy-2023-06-25'];
    expect(day.configurationVersion).toBe(1);
    expect(day.experimenters.experimenter_name).toEqual(['Doe, Jane', 'Roe, Richard']);
    expect(day.provenance.copiedFromDayId).toBe('remy-2023-07-02');
  });

  it('same setup: duplicating June 22 (v1) to June 23 keeps v1 and carries its bad channels', () => {
    const { result } = renderHook(() => useStore(seed()));
    act(() => {
      result.current.actions.duplicateDay('remy-2023-06-22', '2023-06-23');
    });
    const day = result.current.model.workspace.days['remy-2023-06-23'];
    expect(day.configurationVersion).toBe(1);
    expect(day.deviceOverrides.bad_channels['1']).toEqual([2]);
  });
});

describe('#8b "Change source" re-copies the carry fields but keeps the day’s own recorded facts', () => {
  it('keeps a recorded experiment description (the dialog promises to), while copying team and tasks', () => {
    const { result } = renderHook(() => useStore(seed()));
    act(() => {
      result.current.actions.updateDay('remy-2023-06-22', { session: { experiment_description: 'TARGET recorded protocol' } });
      result.current.actions.updateDay('remy-2023-07-02', { session: { experiment_description: 'SOURCE protocol' } });
    });
    act(() => {
      result.current.actions.reseedDayFrom('remy-2023-06-22', 'remy-2023-07-02');
    });
    const day = result.current.model.workspace.days['remy-2023-06-22'];
    expect(day.session.experiment_description).toBe('TARGET recorded protocol');
    expect(day.session.weight).toBe(480);
    expect(day.experimenters.experimenter_name).toEqual(['Doe, Jane', 'Roe, Richard']);
    expect(day.provenance.copiedFromDayId).toBe('remy-2023-07-02');
  });

  it('fills an EMPTY description from the source (nothing recorded is overwritten)', () => {
    const { result } = renderHook(() => useStore(seed()));
    act(() => {
      result.current.actions.updateDay('remy-2023-06-22', { session: { experiment_description: '' } });
      result.current.actions.updateDay('remy-2023-07-02', { session: { experiment_description: 'SOURCE protocol' } });
    });
    act(() => {
      result.current.actions.reseedDayFrom('remy-2023-06-22', 'remy-2023-07-02');
    });
    expect(result.current.model.workspace.days['remy-2023-06-22'].session.experiment_description).toBe('SOURCE protocol');
  });
});

describe('#5c correcting a setup’s effective date re-evaluates the days it covered', () => {
  it('a June 25 day auto-pinned to v1 (effective June 1) becomes unconfirmed when v1 is corrected to July 1 — its geometry is not re-pinned', () => {
    const { result } = renderHook(() => useStore(seed()));
    act(() => {
      result.current.actions.createDay('remy', '2023-06-25', { session_id: 'remy_20230625', session_description: 'x' }, { carryForwardFromDayId: 'auto' });
    });
    const before = result.current.model.workspace.days['remy-2023-06-25'];
    expect(before.provenance.configuration).toEqual({ source: 'effective-date', confirmed: true });
    act(() => {
      result.current.actions.setConfigurationEffectiveDate('remy', 1, '2023-07-01');
    });
    const { animals, days } = result.current.model.workspace;
    const after = days['remy-2023-06-25'];
    expect(after.configurationVersion).toBe(1);
    const issue = validateDay(after, mergeDayMetadata(animals.remy, after), animals.remy).find((i) => i.code === 'configuration_effective_date_unconfirmed');
    expect(issue).toBeTruthy();
  });
});

describe('#5d correcting the NEXT setup’s effective date re-evaluates the days it now covers', () => {
  it('June 25 auto-pinned to v1 is flagged when v2 (July 1) is corrected to June 20', () => {
    const { result } = renderHook(() => useStore(seed()));
    act(() => {
      result.current.actions.createDay('remy', '2023-06-25', { session_id: 'remy_20230625', session_description: 'x' }, { carryForwardFromDayId: 'auto' });
    });
    act(() => {
      result.current.actions.setConfigurationEffectiveDate('remy', 2, '2023-06-20');
    });
    const { animals, days } = result.current.model.workspace;
    const after = days['remy-2023-06-25'];
    expect(after.configurationVersion).toBe(1); // geometry untouched
    const issue = validateDay(after, mergeDayMetadata(animals.remy, after), animals.remy).find((i) => i.code === 'configuration_effective_date_unconfirmed');
    expect(issue).toBeTruthy();
    expect(issue.message).toMatch(/v2/);
  });
});

describe('#9 a correction or a filename change makes a previous download stale', () => {
  /**
   * Export June 22 through the real export core (download mocked).
   *
   * @param {object} result - The rendered store hook result.
   */
  function exportAndCheck(result) {
    const ws = result.current.model.workspace;
    const outcome = exportDayFile(ws.animals.remy, ws.days['remy-2023-06-22'], { actions: result.current.actions, strict: true });
    expect(outcome.kind).toBe('exported');
  }

  it('right after a download the day is "Downloaded"; a weight correction turns it into "Changed since download"', () => {
    const { result } = renderHook(() => useStore(seed()));
    act(() => exportAndCheck(result));
    let ws = result.current.model.workspace;
    expect(ws.days['remy-2023-06-22'].exportReceipt.filename).toBe('20230622_remy_metadata.yml');
    expect(exportFreshnessStatus(ws.animals.remy, ws.days['remy-2023-06-22'])).toBe('current');
    expect(getDayRowStatus(ws.animals.remy, ws.days['remy-2023-06-22'], mergeDayMetadata(ws.animals.remy, ws.days['remy-2023-06-22'])).variant).toBe('exported');

    act(() => {
      result.current.actions.updateDay('remy-2023-06-22', { session: { weight: 481 } });
    });
    ws = result.current.model.workspace;
    const fresh = exportFreshness(ws.animals.remy, ws.days['remy-2023-06-22']);
    expect(fresh.status).toBe('changed');
    expect(fresh.differs).toEqual(['content']);
    expect(getDayRowStatus(ws.animals.remy, ws.days['remy-2023-06-22'], mergeDayMetadata(ws.animals.remy, ws.days['remy-2023-06-22'])).variant).toBe('changed_since_export');
  });

  it('correcting the subject id (the filename token) is a change too, even though the day itself was not edited', () => {
    const { result } = renderHook(() => useStore(seed()));
    act(() => exportAndCheck(result));
    act(() => {
      result.current.actions.updateAnimal('remy', { subject: { subject_id: 'Remy' } });
    });
    const ws = result.current.model.workspace;
    const fresh = exportFreshness(ws.animals.remy, ws.days['remy-2023-06-22']);
    expect(fresh.status).toBe('changed');
    expect(fresh.differs).toContain('filename');
  });

  it('an unrelated animal default edit (team default) does NOT make the download stale', () => {
    const { result } = renderHook(() => useStore(seed()));
    act(() => exportAndCheck(result));
    act(() => {
      result.current.actions.updateAnimal('remy', { experimenters: { experimenter_name: ['Someone, Else'] } });
    });
    const ws = result.current.model.workspace;
    expect(exportFreshnessStatus(ws.animals.remy, ws.days['remy-2023-06-22'])).toBe('current');
  });
});
