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
      summary = applyImportPlan(plan, result.current.actions, {
        workspace: result.current.model.workspace,
      });
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
      summary = applyImportPlan(plan, result.current.actions, {
        workspace: result.current.model.workspace,
        resolutions: { remy: 'skip' },
      });
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
      summary = applyImportPlan(plan, result.current.actions, {
        workspace: result.current.model.workspace,
        resolutions: { remy: 'add' },
      });
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
      summary = applyImportPlan(plan, result.current.actions, {
        workspace: result.current.model.workspace,
        resolutions: { remy: 'replace' },
      });
    });

    expect(summary.createdAnimals).toEqual(['remy']);
    expect(summary.createdDays).toEqual(['remy-2023-06-22']);
    const remy = result.current.model.workspace.animals.remy;
    // Recreated from the plan's subject facts, not the old genotype.
    expect(remy.subject.genotype).not.toBe('OLD');
  });
});

describe('applyImportPlan — resilience (real store)', () => {
  it("conflict→'add' day-id collision is pre-flighted: the colliding animal is recorded in failed (no uncaught throw) and the clean animal still imports", () => {
    // Drive the REAL store (not a synchronous stub). Seed an animal + a day so that one
    // planned animal ('remy', conflict→'add') will collide on a duplicate day id — which
    // would make `createDay` throw INSIDE its setWorkspace reducer (escaping the synchronous
    // try/catch and crashing the render) if it were issued. Pre-flight must catch it first.
    const { result } = renderHook(() => useStore());
    act(() => {
      result.current.actions.createAnimal('remy', { subject_id: 'remy' });
      result.current.actions.createDay('remy', '2023-06-22', { session_id: 'seeded' });
    });

    // Plan: the colliding 'remy' day AND a second, clean animal ('totoro').
    const plan = planImport(
      [
        makeFile({ subjectId: 'remy', date: '2023-06-22' }),
        makeFile({ subjectId: 'totoro', date: '2024-01-15' }),
      ],
      result.current.model.workspace
    );

    let summary;
    // MUST NOT throw/crash the render.
    act(() => {
      summary = applyImportPlan(plan, result.current.actions, {
        workspace: result.current.model.workspace,
        resolutions: { remy: 'add' },
      });
    });

    // The colliding animal is recorded as failed with a clear reason, and SKIPPED.
    expect(summary.failed.map((f) => f.subjectId)).toContain('remy');
    const remyFailure = summary.failed.find((f) => f.subjectId === 'remy');
    expect(remyFailure.reason).toMatch(/already exists/i);
    expect(summary.createdDays).not.toContain('remy-2023-06-22');

    // The clean animal IS imported (animal + day present in the store).
    expect(summary.createdAnimals).toContain('totoro');
    const ws = result.current.model.workspace;
    expect(ws.animals.totoro).toBeTruthy();
    expect(ws.days['totoro-2024-01-15']).toBeTruthy();

    // The seeded day is untouched.
    expect(ws.days['remy-2023-06-22'].session.session_id).toBe('seeded');
  });

  it('two files with the SAME subject + SAME date do not crash the render: plan dedups, exactly one day is created', () => {
    // Two files resolving to the same (subject, date). Pre-dedup, planImport would emit two
    // days with the same generateDayId — the second createDay would throw INSIDE setWorkspace's
    // reducer (escaping the synchronous try/catch and crashing the render). The plan-level
    // dedup must prevent that, so applying the plan against a REAL store does NOT throw and
    // creates the single day.
    const first = makeFile({ subjectId: 'remy', date: '2023-06-22' });
    const second = makeFile({ subjectId: 'remy', date: '2023-06-22' });
    second.sourceName = '06222023_remy_metadata.yaml';

    const plan = planImport([first, second], createDefaultWorkspace());

    const { result } = renderHook(() => useStore());
    let summary;
    // MUST NOT throw / crash the render.
    act(() => {
      summary = applyImportPlan(plan, result.current.actions, {
        workspace: result.current.model.workspace,
      });
    });

    expect(summary.failed).toEqual([]);
    expect(summary.createdAnimals).toEqual(['remy']);
    expect(summary.createdDays).toEqual(['remy-2023-06-22']);

    const ws = result.current.model.workspace;
    expect(ws.animals.remy.days).toEqual(['remy-2023-06-22']);
    expect(ws.days['remy-2023-06-22']).toBeTruthy();
  });

  it('fails-closed (defense in depth) on a hand-crafted plan with two animals sharing a day id', () => {
    // A future caller could hand the executor a plan whose two animals resolve to the same day
    // id (e.g. same subjectId under different conflict shapes). Pre-flight must reserve earlier
    // day ids and reject the collision instead of issuing a throwing createDay.
    const base = planImport([makeFile({ subjectId: 'remy', date: '2023-06-22' })], createDefaultWorkspace());
    const dupPlan = {
      ...base,
      animals: [base.animals[0], structuredClone(base.animals[0])],
    };

    const { result } = renderHook(() => useStore());
    let summary;
    act(() => {
      summary = applyImportPlan(dupPlan, result.current.actions, {
        workspace: result.current.model.workspace,
      });
    });

    // First animal creates the day; the duplicate is recorded in failed (no throw).
    expect(summary.createdAnimals).toEqual(['remy']);
    expect(summary.createdDays).toEqual(['remy-2023-06-22']);
    expect(summary.failed).toHaveLength(1);
    expect(summary.failed[0].reason).toMatch(/already exists/i);
  });

  it('new-animal collision (subjectId already exists) is pre-flighted: recorded in failed, clean animal still imports', () => {
    const { result } = renderHook(() => useStore());
    act(() => {
      result.current.actions.createAnimal('remy', { subject_id: 'remy' });
    });

    // Plan against an EMPTY workspace so 'remy' is planned as a NEW animal (conflict 'none'),
    // but the live store already has 'remy' — `createAnimal` would throw. Pre-flight must
    // catch it.
    const plan = planImport(
      [
        makeFile({ subjectId: 'remy', date: '2023-06-22' }),
        makeFile({ subjectId: 'totoro', date: '2024-01-15' }),
      ],
      createDefaultWorkspace()
    );

    let summary;
    act(() => {
      summary = applyImportPlan(plan, result.current.actions, {
        workspace: result.current.model.workspace,
      });
    });

    expect(summary.failed.map((f) => f.subjectId)).toContain('remy');
    expect(summary.createdAnimals).not.toContain('remy');
    expect(summary.createdAnimals).toContain('totoro');
    expect(result.current.model.workspace.days['totoro-2024-01-15']).toBeTruthy();
  });
});
