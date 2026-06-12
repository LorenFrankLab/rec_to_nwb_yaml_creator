/**
 * Regression net for the MIGRATED-v3 catalog day shape (`taskInstances`, NO inline `tasks`) — the
 * production shape a v2→v3 blob hydrates to. The export path (`mergeDayMetadata`) was made
 * catalog-aware in Phase 8C, but several SIBLING consumers of `day.tasks` were not, and the existing
 * fixtures (inline-task days that the Day Editor silently *derives*) never exercised the real shape.
 * Each test below pins one of those consumers against `buildCatalogWorkspace()` (the real shape).
 */
import { describe, it, expect } from 'vitest';
import { mergeDayMetadata } from '../state/workspaceUtils';
import { computeStepStatus, computeEpochsStatus, STEP_STATUS } from '../domain/validation';
import { validateRawDay } from '../validation/rawShape';
import { createDayRecord } from '../state/workspaceTransitions';
import { buildRealisticWorkspace, buildCatalogWorkspace } from './fixtures/workspaceBuilders';

describe('catalog day (migrated v3: taskInstances, no tasks) — sibling consumers of day.tasks', () => {
  it('the fixture is genuinely catalog-shaped (taskInstances present, inline tasks absent)', () => {
    const { animal, day } = buildCatalogWorkspace();
    expect(Array.isArray(day.taskInstances)).toBe(true);
    expect(day.taskInstances.length).toBeGreaterThan(0);
    expect(day.tasks).toBeUndefined();
    expect(Array.isArray(animal.taskTypes)).toBe(true);
  });

  // P1 — epochs step status must read the RESOLVED tasks, else a catalog day is wrongly "incomplete"
  // and stepGate locks export/preflight.
  it('P1: epochs step status is VALID for a catalog day (export not locked)', () => {
    const { animal, day } = buildCatalogWorkspace();
    const status = computeStepStatus(day, mergeDayMetadata(animal, day), animal);
    expect(status.epochs).toBe(STEP_STATUS.VALID);
  });

  it('P1: computeEpochsStatus uses the effective (merged) tasks, not raw day.tasks', () => {
    const { animal, day } = buildCatalogWorkspace();
    const merged = mergeDayMetadata(animal, day);
    expect(computeEpochsStatus(day, [], merged)).toBe('valid');
    // A catalog day with ZERO instances is genuinely incomplete (no tasks).
    expect(computeEpochsStatus({ ...day, taskInstances: [] }, [], { ...merged, tasks: [] })).toBe('incomplete');
  });

  // P1 — task-type camera refs must reach the exported `cameras` list.
  it('P1: a catalog day exports the SAME cameras as the equivalent inline day', () => {
    const c = buildCatalogWorkspace();
    const i = buildRealisticWorkspace();
    expect(mergeDayMetadata(c.animal, c.day).cameras).toEqual(mergeDayMetadata(i.animal, i.day).cameras);
  });

  it('P1: a TASK-TYPE-only camera (referenced by no video) reaches exported cameras', () => {
    // The failure mode: a camera referenced ONLY by a task type (not a video/fs-gui), so the inline
    // day.tasks scan can't infer it. For a catalog day, day.tasks is empty — the inference must use
    // the RESOLVED tasks (whose camera_id comes from the animal task type) or the camera is dropped
    // while an exported task still references it (dangling_camera_ref / bad YAML).
    const { animal, day } = buildCatalogWorkspace();
    const animalWithTaskCam = {
      ...animal,
      cameras: [
        ...animal.cameras,
        { id: 9, camera_name: 'task_only_cam', meters_per_pixel: 0.001, manufacturer: 'M', model: 'X', lens: '8mm' },
      ],
      taskTypes: [
        ...animal.taskTypes,
        { id: 'tasktype-probe', task_name: 'probe', task_description: 'd', task_environment: 'box', camera_id: [9] },
      ],
    };
    const dayWithTaskCam = {
      ...day,
      taskInstances: [...day.taskInstances, { taskTypeId: 'tasktype-probe', task_epochs: [9] }],
    };
    const merged = mergeDayMetadata(animalWithTaskCam, dayWithTaskCam);
    const exportedIds = merged.cameras.map((cam) => cam.id);
    const probeTask = merged.tasks.find((t) => t.task_name === 'probe');
    expect(probeTask.camera_id).toContain(9); // the task exports the camera ref
    expect(exportedIds).toContain(9); // …and the camera it references is exported (not dangling)
  });

  // P3 — a dangling-only day resolves to EMPTY tasks (the dangling ref is dropped) but carries a
  // dangling_task_type_ref ERROR; the step glyph must point at the error (repair), not "incomplete".
  it('P3: a dangling-only catalog day badges epochs ERROR (repair), not incomplete (missing tasks)', () => {
    const { animal, day } = buildCatalogWorkspace();
    const danglingDay = { ...day, taskInstances: [{ taskTypeId: 'tasktype-deleted', task_epochs: [1] }] };
    const merged = mergeDayMetadata(animal, danglingDay);
    expect(merged.tasks).toEqual([]); // the dangling instance is dropped → empty resolved tasks
    const status = computeStepStatus(danglingDay, merged, animal);
    expect(status.epochs).toBe(STEP_STATUS.ERROR); // not STEP_STATUS.INCOMPLETE
  });

  // P2 — carry-forward / duplicate must carry the catalog instances, not the (empty) inline tasks.
  it('P2: createDayRecord carries a catalog source day’s taskInstances (not a blank day)', () => {
    const { animal, day } = buildCatalogWorkspace();
    const next = createDayRecord(animal, animal.id, 'remy-2023-06-29', '2023-06-29', {}, '2023-06-29T00:00:00.000Z', day);
    expect(next.taskInstances).toEqual(day.taskInstances);
    expect(next.tasks).toEqual([]); // catalog-shaped, not stale inline tasks
  });

  // P2 — a corrupt taskInstances must surface a repairable raw-shape error, not be laundered to [].
  it('P2: a corrupt non-array taskInstances surfaces a malformed_day_collection error', () => {
    const issues = validateRawDay({ id: 'd1', taskInstances: {} });
    const malformed = issues.find(
      (issue) => issue.code === 'malformed_day_collection' && String(issue.path || '').includes('taskInstances')
    );
    expect(malformed).toBeTruthy();
  });
});
