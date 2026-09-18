import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { seedAndOpen, buildConfiguredWorkspaceBlob, ANIMAL_ID, DAY_ID, STORAGE_KEY } from './helpers/workspace';

for (const width of [320, 390, 1440]) {
  test(`follow-up entry stays calm, usable and within the page at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    const blob = buildConfiguredWorkspaceBlob();
    const animal = blob.workspace.animals[ANIMAL_ID];
    animal.configurationHistory[0].date = '2023-06-01';
    animal.configurationHistory[0].effectiveDateKnown = true;
    blob.workspace.days[DAY_ID].session.weight = 480;
    await seedAndOpen(page, blob, `/#/animal/${ANIMAL_ID}/days`);
    await page.getByLabel('Choose recording date').fill('2023-06-23');
    await page.getByRole('button', { name: 'Create & open' }).click();
    const weight = page.getByLabel(/Weight measured on 2023-06-23/);
    await expect(weight).toHaveValue('');
    await expect(page.getByText(/Previous measurement: 480 g on 2023-06-22/)).toBeVisible();
    await expect(page.getByRole('button', { name: /Use 480/ })).toHaveCount(0);
    await expect(page.getByText('To finish', { exact: true })).toBeVisible();
    await page.evaluate(() => window.scrollTo(0, 0));
    const box = await weight.boundingBox();
    expect(box.y).toBeLessThan(600);
    expect(box.height).toBeGreaterThanOrEqual(40);
    expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(1);
    await page.getByRole('button', { name: 'Review & export', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Download YAML', exact: true })).toBeDisabled();
    await expect(page.getByRole('button', { name: 'Copy YAML', exact: true })).toBeDisabled();
    const scan = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze();
    expect(scan.violations).toEqual([]);
    await page.getByRole('button', { name: 'Review recording epochs and files', exact: true }).click();
    await expect(page.locator('#epochs-workspace')).toBeFocused();
  });
}

test('Add recording epoch is visible and preserves existing epochs and their files', async ({ page }) => {
  await seedAndOpen(page, buildConfiguredWorkspaceBlob(), `/#/day/${DAY_ID}`);
  const readDay = () => page.evaluate(({ key, id }) => JSON.parse(localStorage.getItem(key)).workspace.days[id], { key: STORAGE_KEY, id: DAY_ID });
  const before = await readDay();
  await page.getByRole('button', { name: /^Show epoch \d+ details$/ }).first().waitFor();
  const rowCount = await page.getByRole('button', { name: /^Show epoch \d+ details$/ }).count();
  await page.getByLabel(`Task for epoch ${rowCount + 1}`, { exact: true }).selectOption({ label: 'sleep' });
  await page.getByRole('button', { name: `Add epoch ${rowCount + 1}`, exact: true }).click();
  await expect(page.getByRole('button', { name: /^Show epoch \d+ details$/ })).toHaveCount(rowCount + 1);
  await expect.poll(async () => (await readDay()).associated_video_files).toEqual(before.associated_video_files);
  await expect.poll(async () => (await readDay()).associated_files).toEqual(before.associated_files);
});

test('camera headers and full hardware values remain readable on desktop', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 960 });
  await seedAndOpen(page, buildConfiguredWorkspaceBlob(), `/#/animal/${ANIMAL_ID}/cameras`);
  const table = page.getByRole('table');
  const headers = table.getByRole('columnheader');
  await expect(headers).toHaveCount(6);
  const boxes = await headers.evaluateAll((nodes) => nodes.map((node) => {
    const rect = node.getBoundingClientRect();
    return { left: rect.left, right: rect.right, width: rect.width, scroll: node.scrollWidth, client: node.clientWidth };
  }));
  boxes.forEach((box, index) => {
    expect(box.scroll).toBeLessThanOrEqual(box.client + 1);
    if (index > 0) expect(box.left).toBeGreaterThanOrEqual(boxes[index - 1].right - 1);
  });
  await page.getByRole('button', { name: /Edit camera/ }).first().click();
  await expect(page.getByText('Editing — Save or Cancel')).toBeVisible();
  await expect(page.getByText('Unsaved edits', { exact: true })).toHaveCount(0);
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
});

test('saving a first-time setup draft keeps the footer within a 320px screen', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 800 });
  await seedAndOpen(page, buildConfiguredWorkspaceBlob(), '/#/workspace');
  await page.getByRole('button', { name: 'Create new animal', exact: true }).click();
  await page.getByLabel(/Subject ID/).fill('DesignDraft');
  await page.getByRole('button', { name: 'Save draft & exit', exact: true }).click();
  await expect(page.getByText(/Draft saved/)).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(1);
  await expect.poll(() => page.evaluate((key) => JSON.parse(localStorage.getItem(key)).workspace.animals.DesignDraft?.subject.subject_id, STORAGE_KEY)).toBe('DesignDraft');
});
