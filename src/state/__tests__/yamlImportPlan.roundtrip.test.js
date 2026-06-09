/**
 * The IMPORT round-trip gate.
 *
 * Build a multi-day workspace (one animal, TWO days pinned to TWO different config
 * versions, shared animal facts) from a GENUINE merge corpus, export each day via
 * `encodeYaml(mergeDayMetadata(animal, day))` → these are the "source files". Then
 * import them through the real pipeline:
 *
 *   decodedFiles → planImport(decodedFiles, emptyWorkspace) → applyImportPlan(plan, actions)
 *
 * and assert that re-exporting each imported day reproduces its source file BYTE-FOR-BYTE.
 * This is the gate: a YAML round-trips out → in → out unchanged. The corpus is genuine
 * merge output (NOT the legacy golden fixtures, which are not merge fixed points).
 */
import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { encodeYaml, decodeYaml } from '../../io/yaml';
import { mergeDayMetadata, generateDayId } from '../workspaceUtils';
import { buildRealisticWorkspace } from '../../__tests__/fixtures/workspaceBuilders';
import { useStore } from '../store';
import { planImport } from '../yamlImportPlan';
import { applyImportPlan } from '../yamlImportApply';

const TS = '2023-06-22T12:00:00.000Z';

/**
 * A one-animal, two-day workspace where the two days pin DIFFERENT config versions but
 * share identical animal-level facts. Day 1 (earlier) uses the full 8-group config (v1);
 * day 2 (later) uses a 7-group config (v2). Built off the realistic builder so the merge
 * output validates clean.
 *
 * @returns {{ animal: object, days: object[] }}
 */
function buildTwoDayTwoConfigWorkspace() {
  const { animal: base, day: baseDay } = buildRealisticWorkspace();

  const v1Groups = base.configurationHistory[0].devices.electrode_groups;
  const v1Ntrodes = base.configurationHistory[0].devices.ntrode_electrode_group_channel_map;
  const v2Groups = v1Groups.slice(0, 7);
  const v2Ntrodes = v1Ntrodes.slice(0, 7);

  const animalId = 'remy';
  const day1Id = generateDayId(animalId, '2023-06-22');
  const day2Id = generateDayId(animalId, '2023-06-25');

  const animal = {
    ...base,
    devices: {
      ...base.devices,
      // Live editable config mirrors the LATEST snapshot (v2).
      electrode_groups: v2Groups,
      ntrode_electrode_group_channel_map: v2Ntrodes,
    },
    days: [day1Id, day2Id],
    configurationHistory: [
      {
        version: 1,
        date: '2023-06-22',
        description: 'Initial configuration',
        devices: { electrode_groups: v1Groups, ntrode_electrode_group_channel_map: v1Ntrodes },
        appliedToDays: [day1Id],
      },
      {
        version: 2,
        date: '2023-06-25',
        description: 'Configuration 2',
        devices: { electrode_groups: v2Groups, ntrode_electrode_group_channel_map: v2Ntrodes },
        appliedToDays: [day2Id],
      },
    ],
  };

  const day1 = {
    ...baseDay,
    id: day1Id,
    date: '2023-06-22',
    session: { ...baseDay.session, session_id: 'remy_20230622' },
    configurationVersion: 1,
  };
  const day2 = {
    ...structuredClone(baseDay),
    id: day2Id,
    date: '2023-06-25',
    experimentDate: '06252023',
    session: { ...baseDay.session, session_id: 'remy_20230625' },
    created: TS,
    lastModified: TS,
    configurationVersion: 2,
  };

  return { animal, days: [day1, day2] };
}

/**
 * Export each day to its source YAML + decoded-file descriptor (the shape the UI hands
 * `planImport`).
 *
 * @param {object} animal
 * @param {object[]} days
 * @returns {Array<{ date: string, sourceName: string, sourceYaml: string, flatModel: object }>}
 */
function exportSources(animal, days) {
  return days.map((day) => {
    const sourceYaml = encodeYaml(mergeDayMetadata(animal, day));
    const [year, month, dd] = day.date.split('-');
    const sourceName = `${month}${dd}${year}_${animal.subject.subject_id}_metadata.yml`;
    return { date: day.date, sourceName, sourceYaml, flatModel: decodeYaml(sourceYaml) };
  });
}

describe('YAML import round-trip (genuine merge corpus → plan → apply → re-export)', () => {
  it('imports a 2-day / 2-config-version animal and re-exports each day byte-identically', () => {
    const { animal, days } = buildTwoDayTwoConfigWorkspace();
    const sources = exportSources(animal, days);

    const decodedFiles = sources.map((s) => ({
      sourceName: s.sourceName,
      flatModel: s.flatModel,
    }));

    // PLAN against an empty workspace.
    const plan = planImport(decodedFiles, { animals: {} });
    expect(plan.unimportable).toEqual([]);
    expect(plan.summary).toEqual({ fileCount: 2, animalCount: 1, dayCount: 2 });
    expect(plan.animals).toHaveLength(1);
    const animalPlan = plan.animals[0];
    expect(animalPlan.subjectId).toBe('remy');
    expect(animalPlan.configVersions).toHaveLength(2);

    // APPLY into a real store.
    const { result } = renderHook(() => useStore());
    let summary;
    act(() => {
      summary = applyImportPlan(plan, result.current.actions, {
        workspace: result.current.model.workspace,
      });
    });
    expect(summary.failed).toEqual([]);
    expect(summary.createdAnimals).toEqual(['remy']);
    expect(summary.createdDays).toHaveLength(2);

    const ws = result.current.model.workspace;
    // 1 animal, 2 days, 2 config versions.
    expect(Object.keys(ws.animals)).toEqual(['remy']);
    const imported = ws.animals.remy;
    expect(imported.configurationHistory).toHaveLength(2);
    expect(ws.days[generateDayId('remy', '2023-06-22')].configurationVersion).toBe(1);
    expect(ws.days[generateDayId('remy', '2023-06-25')].configurationVersion).toBe(2);

    // The GATE: re-export each imported day byte-for-byte against its source.
    for (const source of sources) {
      const importedDay = ws.days[generateDayId('remy', source.date)];
      const reexported = encodeYaml(mergeDayMetadata(imported, importedDay));
      expect(reexported).toBe(source.sourceYaml);
    }
  });
});
