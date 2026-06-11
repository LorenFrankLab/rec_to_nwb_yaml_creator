/**
 * Phase 8B — pure catalog-level validation rehearsal.
 *
 * These helpers operate on the catalog shape (`animal.taskTypes` + `day.taskInstances` /
 * `day.cameras_used` / `day.state.taskDefinitionReconciliations`) and are exercised ONLY by
 * catalog-shaped fixtures — they are NOT wired into the live validation pipeline this phase (the
 * running app still validates inline `day.tasks`). Phase 8C surfaces them, reconciled with the
 * existing `divergent_task_identity` rule (which flags the same Spyglass identity problem on the
 * EXPORTED `tasks[]`); the catalog makes that divergence structurally impossible at the source.
 */
import { describe, it, expect } from 'vitest';
import {
  duplicateTaskTypeNames,
  danglingTaskInstanceRefs,
  taskTypeCamerasNotUsed,
  animalTaskCatalogIssues,
  dayTaskCatalogIssues,
} from '../taskCatalogValidation';
import { migrateTasksToCatalogV2ToV3 } from '../../state/taskCatalogMigration';
import { taskCameraNotUsedDay, workspaceFromDays } from '../../state/__tests__/fixtures/taskCatalog';

const types = (...names) => names.map((task_name, i) => ({ id: `tasktype-${i}`, task_name }));

describe('duplicateTaskTypeNames (catalog-level task_name uniqueness)', () => {
  it('returns [] when every task type name is unique', () => {
    expect(duplicateTaskTypeNames(types('sleep', 'w-track'))).toEqual([]);
  });

  it('returns each name reused by more than one task type (once)', () => {
    expect(duplicateTaskTypeNames(types('sleep', 'w-track', 'sleep'))).toEqual(['sleep']);
  });

  it('is shape-tolerant (non-array, missing/blank names skipped)', () => {
    expect(duplicateTaskTypeNames(null)).toEqual([]);
    expect(duplicateTaskTypeNames([{ id: 'a' }, { id: 'b' }])).toEqual([]); // no names
    expect(duplicateTaskTypeNames([{ task_name: '' }, { task_name: '' }])).toEqual([]); // blank skipped
  });
});

describe('danglingTaskInstanceRefs (instance → missing task type)', () => {
  it('returns [] when every instance resolves to a task type', () => {
    expect(
      danglingTaskInstanceRefs(types('sleep'), [{ taskTypeId: 'tasktype-0', task_epochs: [1] }])
    ).toEqual([]);
  });

  it('returns each instance taskTypeId with no matching task type (deduped)', () => {
    expect(
      danglingTaskInstanceRefs(types('sleep'), [
        { taskTypeId: 'tasktype-404', task_epochs: [1] },
        { taskTypeId: 'tasktype-404', task_epochs: [2] },
        { taskTypeId: 'tasktype-0', task_epochs: [3] },
      ])
    ).toEqual(['tasktype-404']);
  });

  it('is shape-tolerant', () => {
    expect(danglingTaskInstanceRefs(null, null)).toEqual([]);
    expect(danglingTaskInstanceRefs(types('sleep'), 'nope')).toEqual([]);
  });
});

describe('taskTypeCamerasNotUsed (TaskType.camera_id ⊄ day.cameras_used)', () => {
  it('flags a referenced camera the day did not mark used', () => {
    const out = migrateTasksToCatalogV2ToV3(workspaceFromDays(taskCameraNotUsedDay.days));
    const findings = taskTypeCamerasNotUsed(out.animals.remy.taskTypes, out.days['remy-2023-06-01']);
    expect(findings).toEqual([{ taskTypeId: 'tasktype-0', task_name: 'w-track', camera_id: 1 }]);
  });

  it('returns [] when cameras_used covers every referenced camera', () => {
    const day = { taskInstances: [{ taskTypeId: 'tasktype-0', task_epochs: [1] }], cameras_used: [0, 1] };
    expect(taskTypeCamerasNotUsed([{ id: 'tasktype-0', task_name: 'w', camera_id: [0, 1] }], day)).toEqual([]);
  });

  it('has no opinion when the day declares no explicit cameras_used checklist', () => {
    const tt = [{ id: 'tasktype-0', task_name: 'w', camera_id: [0, 1] }];
    const inst = [{ taskTypeId: 'tasktype-0', task_epochs: [1] }];
    expect(taskTypeCamerasNotUsed(tt, { taskInstances: inst })).toEqual([]); // absent
    expect(taskTypeCamerasNotUsed(tt, { taskInstances: inst, cameras_used: [] })).toEqual([]); // empty
  });
});

describe('issue producers (standard issue shape; codes reconcile with divergent_task_identity)', () => {
  it('animalTaskCatalogIssues emits an animal-routed duplicate_task_type_name error', () => {
    const issues = animalTaskCatalogIssues({ taskTypes: types('sleep', 'sleep') });
    expect(issues).toHaveLength(1);
    expect(issues[0]).toMatchObject({
      code: 'duplicate_task_type_name',
      repairSurface: 'animal',
      severity: 'error',
    });
    expect(issues[0].message).toContain('sleep');
  });

  it('dayTaskCatalogIssues emits a day-routed dangling_task_type_ref error', () => {
    const animal = { taskTypes: types('sleep') };
    const day = { taskInstances: [{ taskTypeId: 'ghost', task_epochs: [1] }] };
    const issues = dayTaskCatalogIssues(animal, day);
    expect(issues.map((i) => i.code)).toContain('dangling_task_type_ref');
    const dangling = issues.find((i) => i.code === 'dangling_task_type_ref');
    expect(dangling).toMatchObject({ repairSurface: 'day', severity: 'error' });
  });

  it('dayTaskCatalogIssues emits a task_camera_not_used error for an unmarked referenced camera', () => {
    const out = migrateTasksToCatalogV2ToV3(workspaceFromDays(taskCameraNotUsedDay.days));
    const issues = dayTaskCatalogIssues(out.animals.remy, out.days['remy-2023-06-01']);
    const cameraIssue = issues.find((i) => i.code === 'task_camera_not_used');
    expect(cameraIssue).toMatchObject({ repairSurface: 'day', severity: 'error' });
    expect(cameraIssue.message).toContain('w-track');
  });

  it('dayTaskCatalogIssues emits a task_definition_reconciled review item from day.state', () => {
    const day = {
      state: {
        taskDefinitionReconciliations: [
          {
            task_name: 'sleep',
            taskTypeId: 'tasktype-0',
            original: { task_environment: 'QuietRoom' },
            canonical: { task_environment: 'SleepBox' },
          },
        ],
      },
    };
    const issues = dayTaskCatalogIssues({ taskTypes: types('sleep') }, day);
    const recon = issues.find((i) => i.code === 'task_definition_reconciled');
    expect(recon).toMatchObject({ repairSurface: 'day', severity: 'warning' });
    expect(recon.message).toContain('sleep');
  });

  it('returns no issues for a clean catalog (well-formed, consistent fixture)', () => {
    const out = migrateTasksToCatalogV2ToV3(
      workspaceFromDays([
        { id: 'remy-2023-06-01', date: '2023-06-01', tasks: [{ task_name: 'sleep', task_description: 'd', task_environment: 'e', camera_id: [], task_epochs: [1] }] },
      ])
    );
    expect(animalTaskCatalogIssues(out.animals.remy)).toEqual([]);
    expect(dayTaskCatalogIssues(out.animals.remy, out.days['remy-2023-06-01'])).toEqual([]);
  });
});
