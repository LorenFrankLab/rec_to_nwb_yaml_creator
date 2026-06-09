/**
 * Unit tests for `applyImportPlan` — the executor that writes an import plan into the
 * live workspace store. Drives a real store via `renderHook(useStore)` so the actual
 * createAnimal/createDay/createConfigurationSnapshotAndApplyForward/updateDay path runs.
 */
import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { encodeYaml, decodeYaml } from '../../io/yaml';
import { mergeDayMetadata, createDefaultWorkspace } from '../workspaceUtils';
import { buildRealisticWorkspace } from '../../__tests__/fixtures/workspaceBuilders';
import { useStore } from '../store';
import { planImport } from '../yamlImportPlan';
import { applyImportPlan } from '../yamlImportApply';

/**
 *
 * @param animal
 * @param day
 * @param sourceName
 */
function toDecodedFile(animal, day, sourceName) {
  const flat = decodeYaml(encodeYaml(mergeDayMetadata(animal, day)));
  return { sourceName, flatModel: flat };
}

/**
 *
 * @param root0
 * @param root0.subjectId
 * @param root0.date
 * @param root0.mutateConfig
 */
function makeFile({ subjectId = 'remy', date = '2023-06-22', mutateConfig } = {}) {
  const { animal, day } = buildRealisticWorkspace();
  animal.id = subjectId;
  animal.subject = { ...animal.subject, subject_id: subjectId };
  day.id = `${subjectId}-${date}`;
  day.animalId = subjectId;
  day.date = date;
  day.session = { ...day.session, session_id: `${subjectId}_${date.replace(/-/g, '')}` };
  if (mutateConfig) mutateConfig(animal, day);
  const [year, month, dd] = date.split('-');
  return toDecodedFile(animal, day, `${month}${dd}${year}_${subjectId}_metadata.yml`);
}

describe('applyImportPlan — fresh import', () => {
  it('creates a new animal with its days and config versions', () => {
    const files = [
      makeFile({ subjectId: 'remy', date: '2023-06-22' }),
      makeFile({
        subjectId: 'remy',
        date: '2023-06-23',
        mutateConfig: (animal) => {
          const cfg = animal.configurationHistory[0];
          cfg.devices.electrode_groups = cfg.devices.electrode_groups.slice(0, 7);
          cfg.devices.ntrode_electrode_group_channel_map =
            cfg.devices.ntrode_electrode_group_channel_map.slice(0, 7);
        },
      }),
    ];
    const plan = planImport(files, createDefaultWorkspace());

    const { result } = renderHook(() => useStore());
    let summary;
    act(() => {
      summary = applyImportPlan(plan, result.current.actions);
    });

    expect(summary.createdAnimals).toEqual(['remy']);
    expect(summary.createdDays).toHaveLength(2);
    expect(summary.skipped).toEqual([]);

    const ws = result.current.model.workspace;
    expect(Object.keys(ws.animals)).toEqual(['remy']);
    const remy = ws.animals.remy;
    // Two config versions in history.
    expect(remy.configurationHistory).toHaveLength(2);
    // Each day pinned to the right version.
    expect(ws.days['remy-2023-06-22'].configurationVersion).toBe(1);
    expect(ws.days['remy-2023-06-23'].configurationVersion).toBe(2);
    // Day-owned content was written through (createDay only takes a session).
    expect(ws.days['remy-2023-06-22'].tasks).toHaveLength(3);
    expect(ws.days['remy-2023-06-22'].associated_files).toHaveLength(2);
  });
});

describe('applyImportPlan — conflict resolutions', () => {
  it("skips a conflicting animal when resolved 'skip' (writes nothing for it)", () => {
    const ws0 = createDefaultWorkspace();
    const { result } = renderHook(() => useStore({ workspace: ws0 }));
    act(() => {
      result.current.actions.createAnimal('remy', { subject_id: 'remy' });
    });
    const before = JSON.parse(JSON.stringify(result.current.model.workspace.animals.remy));

    const plan = planImport([makeFile({ subjectId: 'remy', date: '2023-06-22' })], {
      animals: { remy: { id: 'remy', subject: { subject_id: 'remy' } } },
    });

    let summary;
    act(() => {
      summary = applyImportPlan(plan, result.current.actions, { remy: 'skip' });
    });

    expect(summary.skipped).toEqual(['remy']);
    expect(summary.createdDays).toEqual([]);
    // The existing animal is untouched (no days added).
    expect(result.current.model.workspace.animals.remy).toEqual(before);
  });

  it("adds days to the existing animal when resolved 'add' (does not recreate)", () => {
    const { result } = renderHook(() => useStore());
    act(() => {
      result.current.actions.createAnimal('remy', { subject_id: 'remy' });
    });

    const plan = planImport([makeFile({ subjectId: 'remy', date: '2023-06-22' })], {
      animals: { remy: { id: 'remy', subject: { subject_id: 'remy' } } },
    });

    let summary;
    act(() => {
      summary = applyImportPlan(plan, result.current.actions, { remy: 'add' });
    });

    expect(summary.createdAnimals).toEqual([]);
    expect(summary.createdDays).toEqual(['remy-2023-06-22']);
    const ws = result.current.model.workspace;
    // Animal still exists (not recreated) and now has the new day.
    expect(ws.animals.remy.days).toContain('remy-2023-06-22');
    expect(ws.days['remy-2023-06-22']).toBeTruthy();
  });

  it("replaces a conflicting animal when resolved 'replace' (deletes then recreates)", () => {
    const { result } = renderHook(() => useStore());
    act(() => {
      result.current.actions.createAnimal('remy', { subject_id: 'remy', genotype: 'OLD' });
    });

    const plan = planImport([makeFile({ subjectId: 'remy', date: '2023-06-22' })], {
      animals: { remy: { id: 'remy', subject: { subject_id: 'remy' } } },
    });

    let summary;
    act(() => {
      summary = applyImportPlan(plan, result.current.actions, { remy: 'replace' });
    });

    expect(summary.createdAnimals).toEqual(['remy']);
    expect(summary.createdDays).toEqual(['remy-2023-06-22']);
    const remy = result.current.model.workspace.animals.remy;
    // Recreated from the plan's subject facts, not the old genotype.
    expect(remy.subject.genotype).not.toBe('OLD');
  });
});

describe('applyImportPlan — resilience', () => {
  it('records a per-animal failure (synchronous action error) without aborting the others', () => {
    // `actions` is an injected dependency of applyImportPlan. Stub one whose createAnimal
    // throws SYNCHRONOUSLY for 'remy' but succeeds for 'totoro', to prove the executor
    // isolates a per-animal failure (catch + record) and still applies the rest.
    const plan = planImport(
      [
        makeFile({ subjectId: 'remy', date: '2023-06-22' }),
        makeFile({ subjectId: 'totoro', date: '2024-01-15' }),
      ],
      createDefaultWorkspace()
    );

    const created = [];
    const stubActions = {
      createAnimal: (animalId) => {
        if (animalId === 'remy') throw new Error('boom');
        created.push(animalId);
      },
      createDay: () => {},
      createConfigurationSnapshotAndApplyForward: () => {},
      updateDay: () => {},
    };

    const summary = applyImportPlan(plan, stubActions);

    expect(summary.createdAnimals).toContain('totoro');
    expect(summary.createdAnimals).not.toContain('remy');
    expect(summary.failed.map((f) => f.subjectId)).toContain('remy');
    expect(created).toContain('totoro');
  });
});
