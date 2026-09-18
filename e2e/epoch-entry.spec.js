import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { buildCatalogWorkspace } from '../src/__tests__/fixtures/workspaceBuilders';
import { seedAndOpen, buildConfiguredWorkspaceBlob, ANIMAL_ID, DAY_ID, STORAGE_KEY } from './helpers/workspace';

/** Start with reusable tasks but no recorded epochs, answers or files. */
function emptySequence() {
  const blob = buildConfiguredWorkspaceBlob();
  const { animal, day } = buildCatalogWorkspace();
  blob.workspace.animals[ANIMAL_ID] = animal;
  blob.workspace.days[DAY_ID] = {
    ...day, tasks: [], taskInstances: [], associated_files: [], associated_video_files: [],
    state: { draft: true, validated: false, exported: false },
  };
  return blob;
}

for (const width of [320, 390, 1440]) {
  test(`a scientist can build, correct and resume an epoch sequence at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await seedAndOpen(page, emptySequence(), `/#/day/${DAY_ID}`);
    await expect(page.getByRole('heading', { name: 'What happened first?' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Add epoch 1', exact: true })).toBeDisabled();
    for (const [index, task] of ['sleep', 'w_alternation', 'sleep'].entries()) {
      await page.getByLabel(`Task for epoch ${index + 1}`, { exact: true }).selectOption({ label: task });
      await page.getByRole('button', { name: `Add epoch ${index + 1}`, exact: true }).click();
      await expect(page.getByLabel(`Task for epoch ${index + 2}`, { exact: true })).toBeFocused();
    }
    const choices = (epoch) => page.getByRole('group', { name: `Was video recorded for epoch ${epoch}?`, exact: true });
    await expect(choices(1).getByRole('radio', { checked: true })).toHaveCount(0);
    await choices(1).getByRole('radio', { name: 'No', exact: true }).check();
    await choices(2).getByRole('radio', { name: 'Yes', exact: true }).check();
    await choices(3).getByRole('radio', { name: 'Enter later', exact: true }).check();
    await page.getByRole('button', { name: 'Show epoch 2 details', exact: true }).click();
    const dialog = page.getByRole('dialog', { name: 'Epoch 2: w_alternation', exact: true });
    await expect(dialog.getByLabel('Epoch 2 video 1 camera', { exact: true })).toHaveValue('0');
    await expect(dialog.getByLabel('Epoch 2 video 2 camera', { exact: true })).toHaveValue('1');
    await dialog.getByRole('button', { name: 'Rename', exact: true }).first().click();
    await dialog.getByRole('textbox', { name: 'Epoch 2 video 1 name', exact: true }).fill('actual_run_video.h264');
    await dialog.getByLabel('Epoch 2 video 1 camera', { exact: true }).selectOption('1');
    await dialog.getByRole('button', { name: 'Close epoch 2 details', exact: true }).click();

    // Reversing a video answer never silently discards the custom name.
    await choices(2).getByRole('radio', { name: 'No', exact: true }).click();
    await page.getByRole('dialog', { name: 'Change video answer for epoch 2?' }).getByRole('button', { name: 'Cancel', exact: true }).click();
    await expect(choices(2).getByRole('radio', { name: 'Yes', exact: true })).toBeChecked();
    await expect.poll(() => page.evaluate(({ key, id }) => {
      const day = JSON.parse(localStorage.getItem(key)).workspace.days[id];
      return { noVideo: day.state.videolessEpochs, later: day.state.videoPendingEpochs, videos: day.associated_video_files };
    }, { key: STORAGE_KEY, id: DAY_ID })).toMatchObject({
      noVideo: [1], later: [3], videos: [
        { name: 'actual_run_video.h264', camera_id: 1, task_epochs: 2 },
        { camera_id: 1, task_epochs: 2 },
      ],
    });
    await page.reload();
    await expect(choices(1).getByRole('radio', { name: 'No', exact: true })).toBeChecked();
    await expect(choices(3).getByRole('radio', { name: 'Enter later', exact: true })).toBeChecked();
    expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(1);
    const scan = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze();
    expect(scan.violations).toEqual([]);
  });
}

test('a first-time scientist can create a reusable task and its first epoch', async ({ page }) => {
  const blob = emptySequence();
  blob.workspace.animals[ANIMAL_ID].taskTypes = [];
  await seedAndOpen(page, blob, `/#/day/${DAY_ID}`);
  await page.getByRole('button', { name: 'Create first task and epoch', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Add Task Type' });
  await dialog.getByRole('textbox', { name: /task name/i }).fill('Rest');
  await dialog.getByRole('textbox', { name: 'Description' }).fill('Rest in the home cage');
  await dialog.getByRole('textbox', { name: 'Environment' }).fill('home cage');
  await dialog.getByRole('button', { name: /save task type/i }).click();
  await expect(dialog).toHaveCount(0);
  await expect(page.getByLabel('Task for epoch 1', { exact: true }).locator('option:checked')).toHaveText('Rest');
  await page.getByRole('group', { name: 'Was video recorded for epoch 1?' }).getByRole('radio', { name: 'No', exact: true }).check();
  await page.getByLabel('Task for epoch 2', { exact: true }).selectOption({ label: 'Rest' });
  await page.getByRole('button', { name: 'Add epoch 2', exact: true }).click();
  await expect(page.getByLabel('Task for epoch 2', { exact: true }).locator('option:checked')).toHaveText('Rest');
});

test('a follow-up day previews the actual previous camera choices before applying them', async ({ page }) => {
  await seedAndOpen(page, buildConfiguredWorkspaceBlob(), `/#/animal/${ANIMAL_ID}/days`);
  await page.getByLabel('Choose recording date').fill('2023-06-23');
  await page.getByRole('button', { name: 'Create & open', exact: true }).click();
  await expect(page.getByText(/Sequence copied from 2023-06-22/)).toBeVisible();
  await page.getByRole('button', { name: 'Review 2023-06-22 video plan', exact: true }).click();
  const preview = page.getByRole('dialog', { name: 'Use the 2023-06-22 video plan?' });
  await expect(preview.getByText('No video recorded', { exact: true })).toHaveCount(3);
  await expect(preview.getByText('Video: overhead_camera, side_camera', { exact: true })).toHaveCount(2);
  await preview.getByRole('button', { name: 'Apply previous plan', exact: true }).click();
  await expect(page.getByRole('group', { name: 'Was video recorded for epoch 1?' }).getByRole('radio', { name: 'No', exact: true })).toBeChecked();
  await expect(page.getByRole('group', { name: 'Was video recorded for epoch 2?' }).getByRole('radio', { name: 'Yes', exact: true })).toBeChecked();
});
