/**
 * Camera identity when importing into an EXISTING animal, and when replacing one.
 *
 * Spyglass keys `CameraDevice` on `camera_name`, and `meters_per_pixel` is the scale each day's
 * positions are converted with. So a file camera that reuses an id the animal already holds, under a
 * DIFFERENT name, is a different camera (W3): it must be imported as itself, never collapsed onto the
 * animal's camera with that id. And "Replace the existing animal" deletes that animal, so its cameras
 * must play no part in how the files' cameras are named or calibrated (W4).
 *
 * Drives the real store: Import & Repair plan → repairs → `planImport` → `applyImportPlan` → export.
 */
import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { encodeYaml, decodeYaml } from '../../io/yaml';
import { mergeDayMetadata } from '../workspaceUtils';
import { buildRealisticWorkspace } from '../../__tests__/fixtures/workspaceBuilders';
import { useStore } from '../store';
import { planImport } from '../yamlImportPlan';
import { applyImportPlan } from '../yamlImportApply';
import { buildImportRepairPlan, applyImportRepairs } from '../importRepair';

/**
 * A genuine app export (flat YAML model) of `remy` on `date`, built from the realistic fixture.
 *
 * @param {object} [options]
 * @param {string} [options.date] - ISO recording date.
 * @param {Function} [options.mutate] - Mutates the fixture animal/day before the export.
 * @returns {{ sourceName: string, flatModel: object }} The decoded file.
 */
function makeFile({ date = '2023-06-22', mutate } = {}) {
  const { animal, day } = buildRealisticWorkspace();
  day.id = `remy-${date}`;
  day.date = date;
  day.session = { ...day.session, session_id: `remy_${date.replace(/-/g, '')}` };
  if (mutate) mutate(animal, day);
  const [y, m, d] = date.split('-');
  return {
    sourceName: `${m}${d}${y}_remy_metadata.yml`,
    flatModel: decodeYaml(encodeYaml(mergeDayMetadata(animal, day))),
  };
}

/**
 * The 06-23 file filmed in a sleep box: the lab numbered that day's cameras from 0 again, so its
 * camera 0 is `sleep_box_camera` — not the animal's camera 0, `overhead_camera`.
 *
 * @param {object} animal - The fixture animal (cameras rewritten).
 * @param {object} day - The fixture day (references rewritten).
 */
function sleepBoxDay(animal, day) {
  animal.cameras = [
    { id: 0, meters_per_pixel: 0.0021, manufacturer: 'Basler', model: 'acA1300', lens: 'Computar 4mm', camera_name: 'sleep_box_camera' },
    { id: 1, meters_per_pixel: 0.0009, manufacturer: 'Allied Vision', model: 'Mako G-158', lens: 'Fujinon HF16HA-1B', camera_name: 'side_camera' },
  ];
  day.tasks = [
    { task_name: 'sleep', task_description: 'Rest in home cage', task_environment: 'sleep box', camera_id: [0], task_epochs: [1] },
    { task_name: 'w_alternation', task_description: 'W-track continuous alternation for reward', task_environment: 'elevated W-track (180cm arms)', camera_id: [1], task_epochs: [2] },
  ];
  day.associated_video_files = [
    { name: 'sleep_video_epoch1', camera_id: 0, task_epochs: 1 },
    { name: 'side_view_video_epoch2', camera_id: 1, task_epochs: 2 },
  ];
  day.associated_files = [];
}

/**
 * Commit one file the way Import & Repair's single-file button does, answering each existing-animal
 * camera row with `answer(item)` (default: accept the offered "bring" suggestion).
 *
 * @param {object} result - The `renderHook(useStore)` result.
 * @param {{ sourceName: string, flatModel: object }} file - The decoded file.
 * @param {Function} [answer] - Returns the resolution for a camera repair row.
 * @returns {{ repairPlan: object, plan: object }} The repair plan and the committed import plan.
 */
function importLikePage(result, file, answer = (item) => item.suggested) {
  const ws = result.current.model.workspace;
  const repairPlan = buildImportRepairPlan(file.flatModel, file.sourceName, ws);
  const resolutions = {};
  for (const item of repairPlan.items) {
    if (item.action?.catalog === 'cameras') resolutions[item.path] = answer(item);
  }
  const repaired = applyImportRepairs(file.flatModel, resolutions);
  const plan = planImport([{ sourceName: file.sourceName, flatModel: repaired }], ws);
  const existing = repairPlan.decision.kind === 'existing' ? repairPlan.decision : null;
  const catalogAdditions = Object.fromEntries(
    plan.animals.filter((a) => a.conflict === 'exists').map((a) => [a.existingAnimalId, a.catalogAdditions])
  );
  act(() => {
    applyImportPlan(plan, result.current.actions, {
      workspace: result.current.model.workspace,
      resolutions: existing ? { [existing.subjectId]: 'add' } : {},
      catalogAdditions,
    });
  });
  return { repairPlan, plan };
}

/**
 * The export of `remy` on `date` from the live store.
 *
 * @param {object} result - The `renderHook(useStore)` result.
 * @param {string} date - ISO recording date.
 * @returns {object} The merged day metadata.
 */
function exportDay(result, date) {
  const ws = result.current.model.workspace;
  return mergeDayMetadata(ws.animals.remy, ws.days[`remy-${date}`]);
}

describe('a different camera that reuses an existing camera id is imported as itself (W3)', () => {
  it('exports the sleep video on sleep_box_camera, not on the animal\'s overhead_camera', () => {
    const { result } = renderHook(() => useStore());
    importLikePage(result, makeFile({ date: '2023-06-22' }));
    const { repairPlan } = importLikePage(result, makeFile({ date: '2023-06-23', mutate: sleepBoxDay }));

    // Import & Repair names the collision instead of silently treating id 0 as overhead_camera.
    const row = repairPlan.items.find((item) => item.action?.catalog === 'cameras');
    expect(row).toMatchObject({ code: 'existing_animal_camera_id_taken', kind: 'choice' });
    expect(row.why).toMatch(/sleep_box_camera/);
    expect(row.why).toMatch(/overhead_camera/);

    const exported = exportDay(result, '2023-06-23');
    const video = exported.associated_video_files.find((v) => v.name === 'sleep_video_epoch1');
    const camera = exported.cameras.find((c) => c.id === video.camera_id);
    expect(camera.camera_name).toBe('sleep_box_camera');
    expect(camera.meters_per_pixel).toBe(0.0021);
    const sleepTask = exported.tasks.find((t) => t.task_name === 'sleep');
    expect(sleepTask.camera_id).toEqual([video.camera_id]);
    // The side camera (same id, same name) is still the animal's side camera.
    const side = exported.associated_video_files.find((v) => v.name === 'side_view_video_epoch2');
    expect(side.camera_id).toBe(1);

    // The animal keeps its overhead camera untouched, and gains sleep_box_camera under a free id.
    const cameras = result.current.model.workspace.animals.remy.cameras;
    expect(cameras.find((c) => c.id === 0)).toMatchObject({ camera_name: 'overhead_camera', meters_per_pixel: 0.00085 });
    expect(cameras.map((c) => c.camera_name)).toEqual(['overhead_camera', 'side_camera', 'sleep_box_camera']);
    expect(new Set(cameras.map((c) => c.id)).size).toBe(3);
    // The earlier day still exports the overhead camera.
    expect(exportDay(result, '2023-06-22').cameras.find((c) => c.id === 0).camera_name).toBe('overhead_camera');
  });

  it('keeps the day on the animal\'s camera when the user maps the file\'s camera to that id', () => {
    const { result } = renderHook(() => useStore());
    importLikePage(result, makeFile({ date: '2023-06-22' }));
    // The user says the file's camera 0 IS the animal's camera 0 (e.g. only the name was mistyped).
    importLikePage(result, makeFile({ date: '2023-06-23', mutate: sleepBoxDay }), () => 0);

    const exported = exportDay(result, '2023-06-23');
    const video = exported.associated_video_files.find((v) => v.name === 'sleep_video_epoch1');
    expect(video.camera_id).toBe(0);
    expect(exported.cameras.find((c) => c.id === 0).camera_name).toBe('overhead_camera');
    expect(result.current.model.workspace.animals.remy.cameras.map((c) => c.camera_name)).toEqual([
      'overhead_camera',
      'side_camera',
    ]);
  });
});

describe('Replace imports the files\' cameras, not conflicts with the animal it deletes (W4)', () => {
  /**
   * The overhead camera recorded with a WRONG calibration.
   * @param {object} animal - The fixture animal (cameras rewritten).
   */
  const wrongOverheadCalibration = (animal) => {
    animal.cameras = animal.cameras.map((c) =>
      c.camera_name === 'overhead_camera' ? { ...c, meters_per_pixel: 0.5 } : c
    );
  };

  /**
   * `remy` imported with the wrong calibration, plus the corrected files (overhead_camera at
   * 0.00085 m/px) the user re-imports to replace it.
   *
   * @returns {{ result: object, files: Array<{ sourceName: string, flatModel: object }> }}
   */
  function setup() {
    const { result } = renderHook(() => useStore());
    const first = planImport(
      [makeFile({ date: '2023-06-22', mutate: wrongOverheadCalibration })],
      result.current.model.workspace
    );
    act(() => {
      applyImportPlan(first, result.current.actions, { workspace: result.current.model.workspace });
    });
    return { result, files: [makeFile({ date: '2023-06-22' }), makeFile({ date: '2023-06-23' })] };
  }

  /**
   * Commit `plan` with Replace and return the 06-22 export.
   *
   * @param {object} result - The `renderHook(useStore)` result.
   * @param {object} plan - The import plan.
   * @returns {object} The merged 2023-06-22 metadata.
   */
  function replaceAndExport(result, plan) {
    act(() => {
      applyImportPlan(plan, result.current.actions, {
        workspace: result.current.model.workspace,
        resolutions: { remy: 'replace' },
      });
    });
    return exportDay(result, '2023-06-22');
  }

  it('keeps the files\' camera_name with the default resolution (no split against the deleted animal)', () => {
    const { result, files } = setup();
    const plan = planImport(files, result.current.model.workspace);
    // Adding would ask about the animal's 0.5 against the files' 0.00085; replacing has nothing to ask.
    expect(plan.animals[0].cameraConflicts).toHaveLength(1);
    expect(plan.animals[0].replaceCameraConflicts).toEqual([]);

    const exported = replaceAndExport(result, plan);
    expect(exported.cameras.find((c) => c.id === 0)).toMatchObject({
      camera_name: 'overhead_camera',
      meters_per_pixel: 0.00085,
    });
    expect(exportDay(result, '2023-06-23').cameras.find((c) => c.id === 0).camera_name).toBe('overhead_camera');
    expect(result.current.model.workspace.animals.remy.cameras.map((c) => c.camera_name)).toEqual([
      'overhead_camera',
      'side_camera',
    ]);
  });

  it('keeps the files\' 0.00085 m/px even after "use one calibration" was chosen for adding', () => {
    const { result, files } = setup();
    const [conflict] = planImport(files, result.current.model.workspace).animals[0].cameraConflicts;
    // The only unify the add question offers is the existing animal's calibration (candidate 0).
    expect(conflict.candidates[0]).toMatchObject({ fromExisting: true });
    const plan = planImport(files, result.current.model.workspace, {
      cameraConflictResolutions: { [conflict.key]: { kind: 'unify', candidateIndex: 0 } },
    });

    const exported = replaceAndExport(result, plan);
    expect(exported.cameras.find((c) => c.id === 0).meters_per_pixel).toBe(0.00085);
  });
});
