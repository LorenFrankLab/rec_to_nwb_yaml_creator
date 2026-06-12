/**
 * Phase 8C comprehension-gate screenshots for the task-type catalog (define-once / pick-per-day).
 *
 * Captures the five states the walkthrough ([docs/testing/task-catalog-walkthrough.md]) describes to
 * `docs/testing/screenshots/task-catalog/` — committed artifacts for the Phase 10B user-testing
 * handoff. Reproducible: each seeds a catalog-shaped workspace and screenshots the relevant surface.
 * Run with `npx playwright test task-catalog-screenshots`.
 */
import { test } from '@playwright/test';
import {
  seedAndOpen,
  buildConfiguredWorkspaceBlob,
  makeEmptyAnimal,
  ANIMAL_ID,
  DAY_ID,
  SCHEMA_VERSION,
  FIXED_TIMESTAMP,
} from './helpers/workspace.js';
import { expect } from '@playwright/test';

const DIR = 'docs/testing/screenshots/task-catalog';

const TYPE = (over) => ({
  id: 'tasktype-0',
  task_name: 'sleep',
  task_description: 'The animal rests in a box',
  task_environment: 'HomeBox',
  camera_id: [1],
  ...over,
});

/**
 * A catalog-shaped blob: the animal defines task types; the day references them via instances.
 * @param root0
 * @param root0.taskTypes
 * @param root0.taskInstances
 */
function catalogBlob({ taskTypes, taskInstances }) {
  const blob = buildConfiguredWorkspaceBlob();
  blob.workspace.animals[ANIMAL_ID].taskTypes = taskTypes;
  const day = blob.workspace.days[DAY_ID];
  delete day.tasks;
  day.taskInstances = taskInstances;
  return blob;
}

test.describe('Task-type catalog screenshots', () => {
  test('empty-desktop: a new animal with no task types', async ({ page }) => {
    const blob = {
      schemaVersion: SCHEMA_VERSION,
      workspace: {
        animals: { [ANIMAL_ID]: makeEmptyAnimal(ANIMAL_ID) },
        days: {},
        settings: { defaultLab: '', defaultInstitution: '', defaultExperimenters: [], autoSaveInterval: 30000, shadowExportEnabled: true },
        version: '1.0.0',
        lastModified: FIXED_TIMESTAMP,
      },
    };
    await seedAndOpen(page, blob, `/#/animal/${ANIMAL_ID}/task-types`);
    await expect(page.getByRole('heading', { name: /No Task Types Defined/i })).toBeVisible();
    await page.screenshot({ path: `${DIR}/empty-desktop.png`, fullPage: true });
  });

  test('normal-desktop: an animal catalog with defined task types', async ({ page }) => {
    const blob = catalogBlob({
      taskTypes: [
        TYPE(),
        { id: 'tasktype-1', task_name: 'w-track', task_description: 'Continuous alternation for reward', task_environment: 'elevated W-track', camera_id: [0, 1] },
      ],
      taskInstances: [
        { taskTypeId: 'tasktype-0', task_epochs: [1] },
        { taskTypeId: 'tasktype-1', task_epochs: [2, 4] },
      ],
    });
    await seedAndOpen(page, blob, `/#/animal/${ANIMAL_ID}/task-types`);
    await expect(page.getByRole('heading', { level: 2, name: 'Task Types' })).toBeVisible();
    await page.screenshot({ path: `${DIR}/normal-desktop.png`, fullPage: true });
  });

  test('normal-390: the catalog at phone width', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    const blob = catalogBlob({
      taskTypes: [TYPE(), { id: 'tasktype-1', task_name: 'w-track', task_description: 'Alternation', task_environment: 'W-track', camera_id: [0] }],
      taskInstances: [{ taskTypeId: 'tasktype-0', task_epochs: [1] }],
    });
    await seedAndOpen(page, blob, `/#/animal/${ANIMAL_ID}/task-types`);
    await expect(page.getByRole('heading', { level: 2, name: 'Task Types' })).toBeVisible();
    await page.screenshot({ path: `${DIR}/normal-390.png`, fullPage: true });
  });

  test('repair-desktop: a duplicate task name flagged on the animal catalog', async ({ page }) => {
    const blob = catalogBlob({
      taskTypes: [
        TYPE({ id: 'tasktype-0', task_description: 'Rest in home cage' }),
        TYPE({ id: 'tasktype-1', task_name: 'sleep', task_description: 'A DIFFERENT description' }),
      ],
      taskInstances: [{ taskTypeId: 'tasktype-0', task_epochs: [1] }],
    });
    await seedAndOpen(page, blob, `/#/animal/${ANIMAL_ID}/task-types`);
    await expect(page.getByRole('heading', { level: 2, name: 'Task Types' })).toBeVisible();
    await page.screenshot({ path: `${DIR}/repair-desktop.png`, fullPage: true });
  });

  test('conflict-desktop: a day instance whose task type was deleted (needs re-pick)', async ({ page }) => {
    const blob = catalogBlob({
      taskTypes: [TYPE()],
      taskInstances: [
        { taskTypeId: 'tasktype-0', task_epochs: [1] },
        { taskTypeId: 'tasktype-deleted', task_epochs: [3] }, // dangling → "Unknown task type"
      ],
    });
    await seedAndOpen(page, blob, `/#/day/${DAY_ID}`);
    await page.getByRole('button', { name: /^Tasks & Epochs — / }).click();
    await expect(page.getByRole('heading', { level: 2, name: 'Tasks & Epochs' })).toBeVisible();
    await page.screenshot({ path: `${DIR}/conflict-desktop.png`, fullPage: true });
  });
});
