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
import { deriveAnimalTaskCatalog } from '../taskCatalog';

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

/**
 * Build an import file whose day references catalogs absent from a minimal existing animal.
 *
 * @returns {{ file: object, camera: object, device: object }} The decoded file and source entries.
 */
function makeExistingCatalogGapFile() {
  const camera = {
    id: 3,
    meters_per_pixel: 0.001,
    manufacturer: 'Allied Vision',
    model: 'Mako G-158',
    lens: 'Fujinon HF16HA-1B',
    camera_name: 'arena_side',
  };
  const device = {
    name: 'ImportedRig',
    system: 'MCU',
    amplifier: 'Intan',
    adc_circuit: 'Intan',
  };
  const file = makeFile({
    subjectId: 'remy',
    date: '2023-06-22',
    mutateConfig: (animal, day) => {
      animal.cameras = [camera];
      animal.devices.data_acq_device = [device];
      day.tasks = [
        {
          task_name: 'run',
          task_description: 'run',
          task_environment: 'maze',
          camera_id: [3],
          task_epochs: [1],
        },
      ];
      day.associated_video_files = [{ name: 'run_video', camera_id: 3, task_epochs: 1 }];
      day.associated_files = [];
    },
  });
  return { file, camera, device };
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
    const file = makeFile({ subjectId: 'remy', date: '2023-06-22' });
    act(() => {
      result.current.actions.createAnimal('remy', { subject_id: 'remy' }, {
        cameras: file.flatModel.cameras,
        devices: {
          data_acq_device: file.flatModel.data_acq_device,
          device: { name: ['Trodes'] },
          electrode_groups: [],
          ntrode_electrode_group_channel_map: [],
        },
      });
    });

    const plan = planImport([file], result.current.model.workspace);

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

  it("blocks conflict→'add' when the imported day would reference missing target catalogs", () => {
    const { result } = renderHook(() => useStore());
    act(() => {
      result.current.actions.createAnimal('remy', { subject_id: 'remy' }, {
        cameras: [{ id: 0, camera_name: 'existing_cam' }],
        devices: {
          data_acq_device: [
            { name: 'ExistingRig', system: 'MCU', amplifier: 'Intan', adc_circuit: 'Intan' },
          ],
          device: { name: ['Trodes'] },
          electrode_groups: [],
          ntrode_electrode_group_channel_map: [],
        },
      });
    });

    const { file } = makeExistingCatalogGapFile();
    const plan = planImport([file], result.current.model.workspace);

    let summary;
    act(() => {
      summary = applyImportPlan(plan, result.current.actions, {
        workspace: result.current.model.workspace,
        resolutions: { remy: 'add' },
      });
    });

    expect(summary.createdDays).toEqual([]);
    expect(summary.failed).toHaveLength(1);
    expect(summary.failed[0].reason).toMatch(/camera id "3"/);
    expect(result.current.model.workspace.days['remy-2023-06-22']).toBeUndefined();
  });

  it("merges only selected catalog entries before conflict→'add'", () => {
    const { result } = renderHook(() => useStore());
    act(() => {
      result.current.actions.createAnimal('remy', { subject_id: 'remy' }, {
        cameras: [{ id: 0, camera_name: 'existing_cam' }],
        devices: {
          data_acq_device: [
            { name: 'ExistingRig', system: 'MCU', amplifier: 'Intan', adc_circuit: 'Intan' },
          ],
          device: { name: ['Trodes'] },
          electrode_groups: [],
          ntrode_electrode_group_channel_map: [],
        },
      });
    });

    const { file, camera, device } = makeExistingCatalogGapFile();
    const plan = planImport([file], result.current.model.workspace);

    let summary;
    act(() => {
      summary = applyImportPlan(plan, result.current.actions, {
        workspace: result.current.model.workspace,
        resolutions: { remy: 'add' },
        catalogAdditions: {
          remy: {
            cameras: [camera],
            data_acq_device: [device],
          },
        },
      });
    });

    expect(summary.failed).toEqual([]);
    expect(summary.createdDays).toEqual(['remy-2023-06-22']);
    const ws = result.current.model.workspace;
    expect(ws.animals.remy.cameras.map((c) => c.id)).toEqual([0, 3]);
    expect(ws.animals.remy.devices.data_acq_device.map((d) => d.name)).toEqual([
      'ExistingRig',
      'ImportedRig',
    ]);
    expect(mergeDayMetadata(ws.animals.remy, ws.days['remy-2023-06-22']).cameras).toEqual([
      expect.objectContaining({ id: 3, camera_name: 'arena_side' }),
    ]);
    expect(mergeDayMetadata(ws.animals.remy, ws.days['remy-2023-06-22']).data_acq_device).toEqual([
      expect.objectContaining({ name: 'ImportedRig' }),
    ]);
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

  it("'replace' recreates the animal from the IMPORTED catalogs, not the existing ones", () => {
    const { result } = renderHook(() => useStore());
    act(() => {
      result.current.actions.createAnimal('remy', { subject_id: 'remy' }, {
        cameras: [
          { id: 0, camera_name: 'old_overhead', meters_per_pixel: 0.00085 },
          { id: 1, camera_name: 'old_side', meters_per_pixel: 0.0009 },
        ],
        devices: {
          data_acq_device: [
            { name: 'SpikeGadgets', system: 'SpikeGadgets', amplifier: 'Intan', adc_circuit: 'Intan' },
          ],
          device: { name: ['Trodes'] },
          electrode_groups: [],
          ntrode_electrode_group_channel_map: [],
        },
      });
    });

    const file = makeFile({
      subjectId: 'remy',
      date: '2023-06-22',
      mutateConfig: (animal, day) => {
        animal.cameras = [{ ...animal.cameras[0], id: 0, camera_name: 'recalibrated_overhead', meters_per_pixel: 0.0015 }];
        animal.devices.data_acq_device = [{ name: 'MCU', system: 'MCU', amplifier: 'Intan', adc_circuit: 'Intan' }];
        day.tasks = day.tasks.map((t) => ({ ...t, camera_id: [0] }));
        day.associated_video_files = [{ name: 'v', camera_id: 0, task_epochs: 2 }];
        day.cameras_used = [0];
        day.data_acq_device_name = 'MCU';
      },
    });
    const plan = planImport([file], result.current.model.workspace);

    let summary;
    act(() => {
      summary = applyImportPlan(plan, result.current.actions, {
        workspace: result.current.model.workspace,
        resolutions: { remy: 'replace' },
      });
    });

    expect(summary.failed).toEqual([]);
    const remy = result.current.model.workspace.animals.remy;
    expect(remy.cameras).toEqual([
      expect.objectContaining({ id: 0, camera_name: 'recalibrated_overhead', meters_per_pixel: 0.0015 }),
    ]);
    expect(remy.devices.data_acq_device.map((d) => d.name)).toEqual(['MCU']);
  });

  it("'replace' keeps two DIFFERENT imported cameras that share the old id, each day on its own", () => {
    // Both ready files declare camera 0 — as "replacement_arena_a" and "replacement_arena_b". Under
    // 'add' both are references to existing camera 0; under 'replace' the files are self-describing
    // and these are two cameras: the second gets its own id and day 2's videos follow it.
    const { result } = renderHook(() => useStore());
    act(() => {
      result.current.actions.createAnimal('remy', { subject_id: 'remy' }, {
        cameras: [{ id: 0, camera_name: 'old_overhead', meters_per_pixel: 0.00085 }],
        devices: {
          data_acq_device: [
            { name: 'SpikeGadgets', system: 'SpikeGadgets', amplifier: 'Intan', adc_circuit: 'Intan' },
          ],
          device: { name: ['Trodes'] },
          electrode_groups: [],
          ntrode_electrode_group_channel_map: [],
        },
      });
    });
    const declaringCamera0 = (name) => (animal, day) => {
      animal.cameras = [{ ...animal.cameras[0], id: 0, camera_name: name }];
      day.tasks = day.tasks.map((t) => ({ ...t, camera_id: [0] }));
      day.associated_video_files = [{ name: `video_${name}`, camera_id: 0, task_epochs: 2 }];
      day.cameras_used = [0];
    };
    const plan = planImport(
      [
        makeFile({ subjectId: 'remy', date: '2023-06-22', mutateConfig: declaringCamera0('replacement_arena_a') }),
        makeFile({ subjectId: 'remy', date: '2023-06-23', mutateConfig: declaringCamera0('replacement_arena_b') }),
      ],
      result.current.model.workspace
    );

    let summary;
    act(() => {
      summary = applyImportPlan(plan, result.current.actions, {
        workspace: result.current.model.workspace,
        resolutions: { remy: 'replace' },
      });
    });

    expect(summary.failed).toEqual([]);
    const { workspace } = result.current.model;
    const cameras = workspace.animals.remy.cameras;
    expect(cameras.map((c) => c.camera_name)).toEqual(['replacement_arena_a', 'replacement_arena_b']);
    const [a, b] = cameras;
    expect(a.id).not.toBe(b.id);
    expect(workspace.days['remy-2023-06-22'].associated_video_files[0].camera_id).toBe(a.id);
    expect(workspace.days['remy-2023-06-23'].associated_video_files[0].camera_id).toBe(b.id);
  });

  it("replace onto an animal with EMPTY config history pins each day to the RIGHT version (no duplicate v1)", () => {
    // Regression (config-version race): the snapshot action reserved the next version from the
    // STALE pre-delete animal. When that old animal's history was empty/malformed,
    // nextConfigurationVersion([]) returned 1 — colliding with the freshly-recreated animal's v1 —
    // so the later day silently pinned to the INITIAL config instead of its own reconfiguration.
    const ws0 = createDefaultWorkspace();
    ws0.animals.remy = {
      id: 'remy',
      subject: { subject_id: 'remy' },
      devices: {
        electrode_groups: [],
        ntrode_electrode_group_channel_map: [],
        device: { name: [] },
        data_acq_device: [],
      },
      cameras: [],
      experimenters: { experimenter_name: [], lab: '', institution: '' },
      days: [],
      configurationHistory: [], // empty/malformed history — the trigger
    };
    const { result } = renderHook(() => useStore({ workspace: ws0 }));

    const files = [
      makeFile({ subjectId: 'remy', date: '2023-06-22' }), // 8 electrode groups
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
    const plan = planImport(files, result.current.model.workspace);

    act(() => {
      applyImportPlan(plan, result.current.actions, {
        workspace: result.current.model.workspace,
        resolutions: { remy: 'replace' },
      });
    });

    const ws = result.current.model.workspace;
    const remy = ws.animals.remy;
    // Distinct, sequential versions — NOT a duplicated v1.
    expect(remy.configurationHistory.map((c) => c.version)).toEqual([1, 2]);
    // Day 2 pins its OWN reconfiguration, and resolves the 7-group config (not the initial 8).
    expect(ws.days['remy-2023-06-23'].configurationVersion).toBe(2);
    expect(mergeDayMetadata(remy, ws.days['remy-2023-06-23']).electrode_groups).toHaveLength(7);
    expect(mergeDayMetadata(remy, ws.days['remy-2023-06-22']).electrode_groups).toHaveLength(8);
  });
});

describe('applyImportPlan — resilience (real store)', () => {
  it("conflict→'add' day-id collision is pre-flighted: the colliding animal is recorded in failed (no uncaught throw) and the clean animal still imports", () => {
    // Drive the REAL store (not a synchronous stub). Seed an animal + a day so that one
    // planned animal ('remy', conflict→'add') will collide on a duplicate day id — which
    // would make `createDay` throw INSIDE its setWorkspace reducer (escaping the synchronous
    // try/catch and crashing the render) if it were issued. Pre-flight must catch it first.
    const { result } = renderHook(() => useStore());
    const remyFile = makeFile({ subjectId: 'remy', date: '2023-06-22' });
    act(() => {
      result.current.actions.createAnimal('remy', { subject_id: 'remy' }, {
        cameras: remyFile.flatModel.cameras,
        devices: {
          data_acq_device: remyFile.flatModel.data_acq_device,
          device: { name: ['Trodes'] },
          electrode_groups: [],
          ntrode_electrode_group_channel_map: [],
        },
      });
      result.current.actions.createDay('remy', '2023-06-22', { session_id: 'seeded' });
    });

    // Plan: the colliding 'remy' day AND a second, clean animal ('totoro').
    const plan = planImport(
      [
        remyFile,
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

describe('applyImportPlan — a task that ran in a different room on a different day (F3)', () => {
  /**
   * Two SC38-shaped files: one animal, two dates, the SAME task name, different
   * `task_environment` (HaightRight on 2023-06-06, HaightLeft on 2023-06-13).
   *
   * @returns {Array<object>} Two decoded import files.
   */
  const forkTrackFiles = () => {
    const TASK = {
      task_name: 'forkTrack_handleAlternation_HaightRight_twoSecondDelay',
      task_description: 'Handle alternation with a two second delay',
      camera_id: [0],
      task_epochs: [2],
    };
    const withEnvironment = (date, task_environment) =>
      makeFile({
        subjectId: 'sc38',
        date,
        mutateConfig: (animal, day) => {
          day.tasks = [{ ...TASK, task_environment }];
          day.associated_files = [];
          day.associated_video_files = [];
        },
      });
    return [withEnvironment('2023-06-06', 'HaightRight'), withEnvironment('2023-06-13', 'HaightLeft')];
  };

  /**
   * The `task_environment` a day would export.
   * @param {object} workspace - The live workspace.
   * @param {string} dayId - The day id.
   * @returns {string} The exported environment.
   */
  const exportedEnvironment = (workspace, dayId) =>
    mergeDayMetadata(workspace.animals.sc38, workspace.days[dayId]).tasks[0].task_environment;

  it('each imported day exports the environment ITS file recorded', () => {
    const plan = planImport(forkTrackFiles(), createDefaultWorkspace());
    const { result } = renderHook(() => useStore());
    act(() => {
      applyImportPlan(plan, result.current.actions, { workspace: result.current.model.workspace });
    });

    const ws = result.current.model.workspace;
    expect(exportedEnvironment(ws, 'sc38-2023-06-06')).toBe('HaightRight');
    expect(exportedEnvironment(ws, 'sc38-2023-06-13')).toBe('HaightLeft');
  });

  it('…and still does after the days are folded into the animal task catalog', () => {
    // The import writes inline `day.tasks`; the catalog conversion (the registered v2→v3 migrator,
    // and the Day Editor's first edit) is what could flatten the two rooms into one. It must not:
    // ONE task type, each day keeping its own room.
    const plan = planImport(forkTrackFiles(), createDefaultWorkspace());
    const { result } = renderHook(() => useStore());
    act(() => {
      applyImportPlan(plan, result.current.actions, { workspace: result.current.model.workspace });
    });
    const ws = result.current.model.workspace;
    const dayIds = ['sc38-2023-06-06', 'sc38-2023-06-13'];
    const { taskTypes, instancesByDayId, reconciliations } = deriveAnimalTaskCatalog(
      dayIds.map((id) => ws.days[id])
    );

    expect(taskTypes).toHaveLength(1); // one reusable task identity
    expect(reconciliations).toEqual([]); // nothing was lost, so nothing to review
    const catalogAnimal = { ...ws.animals.sc38, taskTypes };
    const catalogWorkspace = {
      animals: { sc38: catalogAnimal },
      days: Object.fromEntries(
        dayIds.map((id) => [id, { ...ws.days[id], tasks: undefined, taskInstances: instancesByDayId[id] }])
      ),
    };
    expect(exportedEnvironment(catalogWorkspace, 'sc38-2023-06-06')).toBe('HaightRight');
    expect(exportedEnvironment(catalogWorkspace, 'sc38-2023-06-13')).toBe('HaightLeft');
  });
});

describe('applyImportPlan — camera calibration conflicts (F1)', () => {
  /**
   * Re-calibrate the fixture's overhead camera in one file and declare the day's camera usage.
   *
   * @param {number} metersPerPixel - The calibration this file records for `overhead_camera`.
   * @returns {(animal: object, day: object) => void} A `mutateConfig` callback.
   */
  const withOverheadCalibration = (metersPerPixel) => (animal, day) => {
    animal.cameras = animal.cameras.map((camera) =>
      camera.camera_name === 'overhead_camera'
        ? { ...camera, meters_per_pixel: metersPerPixel }
        : camera
    );
    day.cameras_used = [0, 1];
  };

  it('exports every day with the calibration ITS OWN file recorded (split)', () => {
    const plan = planImport(
      [
        makeFile({ subjectId: 'remy', date: '2023-06-22', mutateConfig: withOverheadCalibration(0.001) }),
        makeFile({ subjectId: 'remy', date: '2023-06-23', mutateConfig: withOverheadCalibration(0.002) }),
      ],
      createDefaultWorkspace()
    );

    const { result } = renderHook(() => useStore());
    let summary;
    act(() => {
      summary = applyImportPlan(plan, result.current.actions, {
        workspace: result.current.model.workspace,
      });
    });
    expect(summary.failed).toEqual([]);

    const { workspace } = result.current.model;
    const remy = workspace.animals.remy;
    // Round-trip through the EXPORT merge: what each day would actually write to YAML.
    const first = mergeDayMetadata(remy, workspace.days['remy-2023-06-22']);
    const later = mergeDayMetadata(remy, workspace.days['remy-2023-06-23']);

    expect(first.cameras.map((c) => [c.camera_name, c.meters_per_pixel])).toEqual([
      ['overhead_camera', 0.001],
      ['side_camera', 0.0009],
    ]);
    expect(later.cameras.map((c) => [c.camera_name, c.meters_per_pixel])).toEqual([
      ['side_camera', 0.0009],
      ['overhead_camera_20230623', 0.002],
    ]);

    // …and each day's overhead video resolves to the row carrying ITS calibration.
    const resolve = (model, videoName) => {
      const { camera_id: cameraId } = model.associated_video_files.find((v) => v.name === videoName);
      return model.cameras.find((camera) => camera.id === cameraId);
    };
    expect(resolve(first, 'overhead_video_epoch2').meters_per_pixel).toBe(0.001);
    expect(resolve(later, 'overhead_video_epoch2').meters_per_pixel).toBe(0.002);
    expect(resolve(later, 'side_view_video_epoch2').camera_name).toBe('side_camera');
  });

  it("adds the recalibrated camera to an EXISTING animal without touching the animal's own row", () => {
    const { result } = renderHook(() => useStore());
    const { animal: fixtureAnimal } = buildRealisticWorkspace();
    act(() => {
      result.current.actions.createAnimal('remy', { subject_id: 'remy' }, {
        cameras: fixtureAnimal.cameras.map((camera) =>
          camera.camera_name === 'overhead_camera'
            ? { ...camera, meters_per_pixel: 0.001 }
            : camera
        ),
        devices: fixtureAnimal.devices,
      });
    });

    const plan = planImport(
      [makeFile({ subjectId: 'remy', date: '2023-06-23', mutateConfig: withOverheadCalibration(0.002) })],
      result.current.model.workspace
    );
    const animalPlan = plan.animals[0];
    expect(animalPlan.cameraConflicts).toHaveLength(1);

    let summary;
    act(() => {
      summary = applyImportPlan(plan, result.current.actions, {
        workspace: result.current.model.workspace,
        resolutions: { remy: 'add' },
        catalogAdditions: { remy: animalPlan.catalogAdditions },
      });
    });
    expect(summary.failed).toEqual([]);

    const { workspace } = result.current.model;
    const remy = workspace.animals.remy;
    expect(remy.cameras.map((c) => [c.camera_name, c.meters_per_pixel])).toEqual([
      ['overhead_camera', 0.001],
      ['side_camera', 0.0009],
      ['overhead_camera_20230623', 0.002],
    ]);
    const exported = mergeDayMetadata(remy, workspace.days['remy-2023-06-23']);
    const overhead = exported.cameras.find((c) => c.camera_name.startsWith('overhead'));
    expect(overhead.meters_per_pixel).toBe(0.002);
    expect(
      exported.associated_video_files.find((v) => v.name === 'overhead_video_epoch2').camera_id
    ).toBe(overhead.id);
  });
});
