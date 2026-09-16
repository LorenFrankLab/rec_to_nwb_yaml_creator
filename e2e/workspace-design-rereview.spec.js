import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import YAML from 'yaml';
import { seedAndOpen, buildConfiguredWorkspaceBlob, ANIMAL_ID, DAY_ID, STORAGE_KEY, captureDownload } from './helpers/workspace';

const noOverflow = async (page) => expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(1);

for (const width of [320, 390, 1440]) {
  test(`all animal sections reflow at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await seedAndOpen(page, buildConfiguredWorkspaceBlob(), `/#/animal/${ANIMAL_ID}/days`);
    for (const tab of ['days', 'electrode-groups', 'recording-system', 'cameras', 'task-types', 'optogenetics', 'export']) {
      await page.goto(`/#/animal/${ANIMAL_ID}/${tab}`);
      await expect(page.locator('main')).toBeVisible();
      await page.evaluate(() => new Promise(requestAnimationFrame));
      await noOverflow(page);
    }
    expect((await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze()).violations).toEqual([]);
  });
}

test('draft setup resumes missing facts and requires an explicit review of the seeded system', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 850 });
  await seedAndOpen(page, buildConfiguredWorkspaceBlob(), '/#/workspace');
  await page.getByRole('button', { name: 'Create new animal', exact: true }).click();
  const subject = page.getByLabel(/Subject ID/);
  await subject.fill('ResumeRat');
  await page.evaluate(() => window.scrollTo(0, 0));
  expect((await subject.boundingBox()).y).toBeLessThan(600);
  await page.getByRole('button', { name: 'Save draft & exit', exact: true }).click();
  await page.getByText(/^Setup to finish:/).click();
  await expect(page.getByRole('link', { name: 'Resume setup', exact: true })).toBeVisible();
  await expect(page.getByText('To enter: date of birth')).toBeVisible();
  await expect(page.getByText(/To enter: experiment description/)).toBeVisible();
  await expect(page.getByText('Review default', { exact: true })).toBeVisible();
  await noOverflow(page);
  await page.getByRole('link', { name: 'Resume setup', exact: true }).click();
  await expect(subject).toHaveValue('ResumeRat');
  await page.getByLabel(/Date of birth/).fill('2023-01-01');
  await page.getByRole('button', { name: /^Step 1 of 6/ }).click();
  await page.getByRole('tab', { name: /^Experiment & team/ }).click();
  await expect(page.getByRole('button', { name: 'Next →', exact: true })).toBeVisible();
  await page.getByRole('textbox', { name: 'Experiment description', exact: true }).fill('Navigation experiment');
  await page.getByRole('button', { name: 'Save draft & exit', exact: true }).click();
  await page.waitForURL(/animal\/ResumeRat\/days/);
  await page.goto('/#/animal/ResumeRat/recording-system');
  await page.getByRole('button', { name: 'Confirm recording system', exact: true }).click();
  await expect(page.getByText('Recording system reviewed.', { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByText('Recording system reviewed.', { exact: true })).toBeVisible();
});

test('optogenetics survives off, reload and on; populated removal is deliberate', async ({ page }) => {
  await seedAndOpen(page, buildConfiguredWorkspaceBlob(), `/#/animal/${ANIMAL_ID}/optogenetics`);
  const toggle = page.getByRole('checkbox', { name: /has optogenetics/ });
  await toggle.check();
  await page.getByLabel(/Setup name/).fill('Blue source');
  await page.getByLabel(/Wavelength/).fill('470');
  await page.getByRole('button', { name: 'Add optical fiber', exact: true }).click();
  await page.getByLabel(/Fiber implant name/).fill('Left CA1');
  await page.getByRole('button', { name: 'Add virus injection', exact: true }).click();
  await expect(page.getByText('1 of 4 optogenetics sections complete', { exact: true })).toBeVisible();
  await toggle.uncheck();
  await expect.poll(() => page.evaluate(({ key, id }) => JSON.parse(localStorage.getItem(key)).workspace.animals[id].optogeneticsDraft?.optical_fiber?.[0]?.name, { key: STORAGE_KEY, id: ANIMAL_ID })).toBe('Left CA1');
  await page.reload();
  await expect(page.getByText(/Saved setup retained/)).toBeVisible();
  await toggle.check();
  await expect(page.getByLabel(/Setup name/)).toHaveValue('Blue source');
  await expect(page.getByLabel(/Wavelength/)).toHaveValue('470');
  await expect(page.getByLabel(/Fiber implant name/)).toHaveValue('Left CA1');
  await page.getByRole('button', { name: 'Remove optical fiber 1', exact: true }).click();
  await expect(page.getByRole('alertdialog')).toBeVisible();
  await page.getByRole('button', { name: 'Keep record', exact: true }).click();
  await expect(page.getByLabel(/Fiber implant name/)).toHaveValue('Left CA1');
  await page.getByRole('button', { name: 'Remove optical fiber 1', exact: true }).click();
  await page.getByRole('button', { name: 'Remove record', exact: true }).click();
  await expect(page.getByLabel(/Fiber implant name/)).toHaveCount(0);
});

test('optional statescript reminders survive review and batch review without blocking a valid download', async ({ page }) => {
  const blob = buildConfiguredWorkspaceBlob();
  blob.workspace.days[DAY_ID].associated_files = [];
  await seedAndOpen(page, blob, `/#/day/${DAY_ID}`);
  await page.getByRole('button', { name: 'Review & export', exact: true }).click();
  const reminder = page.getByRole('group', { name: 'Optional file reminders' });
  await expect(reminder).toHaveText(/Optional for export/);
  await expect(page.getByRole('button', { name: 'Download YAML', exact: true })).toBeEnabled();
  await page.getByRole('button', { name: 'Review epoch 2', exact: true }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await expect(page.getByText('Review optional log', { exact: true })).toBeVisible();
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Review & export', exact: true }).click();
  const download = await captureDownload(page, () => page.getByRole('button', { name: 'Download YAML', exact: true }).click());
  expect(YAML.parse(download.text).associated_files).toEqual([]);
  await page.goto(`/#/animal/${ANIMAL_ID}/export`);
  await page.getByRole('checkbox', { name: /Include recordings already downloaded/ }).check();
  await page.getByRole('button', { name: /Review \d+ selected recordings?/ }).click();
  const batch = page.getByRole('region', { name: 'Batch export preflight' });
  await expect(batch.getByText('Measured weight', { exact: true }).first()).toBeVisible();
  await expect(batch.getByText('Epochs & files', { exact: true })).toBeVisible();
  await expect(batch.getByRole('group', { name: 'Optional file reminders' })).toHaveText(/Optional for export/);
  await batch.getByText('Calibration & hardware details', { exact: true }).click();
  await expect(batch.getByText('Cameras / calibration', { exact: true })).toBeVisible();
});
