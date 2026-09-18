import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import YAML from 'yaml';
import { completeOptogenetics } from '../src/__tests__/fixtures/completeOptogenetics';
import { seedAndOpen, buildConfiguredWorkspaceBlob, captureDownload, ANIMAL_ID, DAY_ID, STORAGE_KEY } from './helpers/workspace';

test.use({ reducedMotion: 'reduce' });

/** A complete implanted setup with no day protocols, ready for UI entry. */
function optoBlob() {
  const blob = buildConfiguredWorkspaceBlob();
  blob.workspace.animals[ANIMAL_ID].optogenetics = completeOptogenetics();
  blob.workspace.days[DAY_ID].optogenetics = completeOptogenetics();
  blob.workspace.days[DAY_ID].fs_gui_yamls = [];
  blob.workspace.days[DAY_ID].behavioral_events.push({ name: 'laser_trigger', description: 'Dout7' });
  return blob;
}

test('create, share, repair and remove a stimulation protocol entirely in the modern UI', async ({ page }) => {
  await seedAndOpen(page, optoBlob(), `/#/day/${DAY_ID}`);
  await page.getByRole('button', { name: /Show epoch 2 details/i }).click();
  await page.getByRole('button', { name: 'Add stimulation protocol', exact: true }).click();
  let dialog = page.getByRole('dialog', { name: 'Stimulation protocol', exact: true });
  await dialog.getByLabel(/Protocol YAML file/).fill('theta_trigger.yaml');
  await dialog.getByLabel(/Power \(mW\)/).fill('10');
  await dialog.getByRole('combobox', { name: /Camera for spatial filters/ }).selectOption('0');
  await dialog.getByRole('combobox', { name: /DIO output/ }).selectOption('laser_trigger');
  await dialog.getByRole('checkbox', { name: /^4 ·/ }).check();
  await expect(dialog.getByText(/shared by epochs 2, 4/)).toBeVisible();
  await expect(dialog.getByLabel('Pulse length (ms)', { exact: true })).toBeVisible();
  await dialog.getByLabel('Pulse length (ms)', { exact: true }).fill('5');
  await dialog.getByRole('button', { name: 'Done', exact: true }).click();
  await page.getByRole('button', { name: 'Review & export', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Download YAML', exact: true })).toBeEnabled();
  const download = await captureDownload(page, () => page.getByRole('button', { name: 'Download YAML', exact: true }).click());
  expect(YAML.parse(download.text).fs_gui_yamls).toEqual([{
    name: 'theta_trigger.yaml', power_in_mW: 10, camera_id: 0, dio_output_name: 'laser_trigger', epochs: [2, 4], pulseLength: 5,
  }]);
  // A repair deep-link must open the editable control, not strand the user in the grid.
  await page.goto(`/#/day/${DAY_ID}?step=epochs&field=fs_gui_yamls%5B0%5D.name`);
  dialog = page.getByRole('dialog', { name: 'Stimulation protocol', exact: true });
  await expect(dialog.getByLabel(/Protocol YAML file/)).toBeFocused();
  await dialog.getByLabel(/Protocol YAML file/).clear();
  await dialog.getByRole('button', { name: 'Done', exact: true }).click();
  await page.getByRole('button', { name: 'Review & export', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Download YAML', exact: true })).toBeDisabled();
  await page.getByRole('button', { name: 'Fix in Daily log', exact: true }).click();
  await dialog.getByLabel(/Protocol YAML file/).fill('corrected.yaml');
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(dialog).toHaveCSS('opacity', '1');
  await expect(dialog.locator('..')).toHaveCSS('opacity', '1');
  expect((await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze()).violations).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(1);
  await dialog.getByRole('button', { name: 'Remove protocol', exact: true }).click();
  await dialog.getByRole('button', { name: 'Keep protocol', exact: true }).click();
  await expect(dialog.getByLabel(/Protocol YAML file/)).toHaveValue('corrected.yaml');
  await dialog.getByRole('button', { name: 'Remove protocol', exact: true }).click();
  await dialog.getByRole('button', { name: 'Confirm removal', exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await page.reload();
  await expect.poll(() => page.evaluate(({ key, id }) => JSON.parse(localStorage.getItem(key)).workspace.days[id].fs_gui_yamls, { key: STORAGE_KEY, id: DAY_ID })).toEqual([]);
});

test('batch selection defaults to pending files and all bulk entry points use review', async ({ page }) => {
  const blob = buildConfiguredWorkspaceBlob();
  const animal = blob.workspace.animals[ANIMAL_ID];
  for (const date of ['2023-06-23', '2023-06-24', '2023-06-25']) {
    const day = structuredClone(blob.workspace.days[DAY_ID]);
    day.id = `${ANIMAL_ID}-${date}`;
    day.date = date;
    day.experimentDate = date.replaceAll('-', '');
    day.session.session_id = `${ANIMAL_ID}_${day.experimentDate}`;

    animal.days.push(day.id);
    blob.workspace.days[day.id] = day;
  }
  await seedAndOpen(page, blob, `/#/animal/${ANIMAL_ID}/export`);
  for (const date of ['2023-06-23', '2023-06-24', '2023-06-25']) {
    await page.goto(`/#/day/${ANIMAL_ID}-${date}?step=export`);
    await captureDownload(page, () => page.getByRole('button', { name: 'Download YAML', exact: true }).click());
  }
  await page.goto(`/#/animal/${ANIMAL_ID}/export`);
  await expect(page.getByRole('button', { name: 'Review 1 selected recording', exact: true })).toBeEnabled();
  await page.goto(`/#/day/${DAY_ID}?step=export`);
  await captureDownload(page, () => page.getByRole('button', { name: 'Download YAML', exact: true }).click());
  await page.getByRole('link', { name: `Review other recordings for ${ANIMAL_ID}`, exact: true }).click();
  await expect(page.getByRole('button', { name: 'Review 0 selected recordings', exact: true })).toBeDisabled();
  await page.getByRole('checkbox', { name: /Include recordings already downloaded/ }).check();
  await page.getByRole('button', { name: 'Review 4 selected recordings', exact: true }).click();
  await expect(page.getByRole('region', { name: 'Batch export preflight' })).toBeVisible();
  await expect(page.getByRole('table')).toHaveCount(0);
  await page.getByRole('button', { name: /Cancel/ }).click();
  await page.goto(`/#/day/${DAY_ID}`);
  await page.getByLabel(/Weight measured on/).fill('455');
  await page.getByLabel(/Weight measured on/).blur();
  await page.goto(`/#/animal/${ANIMAL_ID}/export`);
  await expect(page.getByRole('button', { name: 'Review 1 selected recording', exact: true })).toBeEnabled();
});

test('first-time behavior-only setup skips unused hardware and follows through to dated entry', async ({ page }) => {
  await seedAndOpen(page, buildConfiguredWorkspaceBlob(), '/#/home');
  await page.getByLabel(/Subject ID/).fill('BehaviorRat');
  await page.getByLabel(/Date of birth/).fill('2023-01-01');
  await page.getByRole('button', { name: 'Next →', exact: true }).click();
  await expect(page.getByRole('tab', { name: /^Experiment & team/ })).toHaveAttribute('aria-selected', 'true');
  await page.getByRole('textbox', { name: 'Experiment description', exact: true }).fill('Behavioral learning experiment');
  await page.getByRole('button', { name: 'Next →', exact: true }).click();
  await page.getByRole('button', { name: 'Confirm recording system', exact: true }).click();
  await page.getByRole('checkbox', { name: 'Electrophysiology', exact: true }).uncheck();
  await page.getByRole('checkbox', { name: 'Video', exact: true }).uncheck();
  await expect(page.getByRole('tab', { name: /^Electrodes|^Cameras|^Optogenetics/ })).toHaveCount(0);
  await page.getByRole('button', { name: 'Next →', exact: true }).click();
  await page.getByRole('button', { name: 'Finish setup', exact: true }).click();
  await expect(page).toHaveURL(/animal\/BehaviorRat\/days/);
  await expect(page.getByText(/Setup to finish/)).toHaveCount(0);
  await page.getByLabel('Choose recording date', { exact: true }).fill('2023-06-24');
  await page.getByRole('button', { name: 'Create & open', exact: true }).click();
  const weight = page.getByLabel(/Weight measured on 2023-06-24/);
  await expect(weight).toHaveValue('');
  await weight.fill('430');
  await weight.blur();
  await page.reload();
  await expect(weight).toHaveValue('430');
  await page.getByRole('button', { name: /^Failed Channels/ }).click();
  await expect(page.getByText(/Not applicable — this animal has no electrophysiology recordings/)).toBeVisible();
});

test('setup row menus remain reachable on a narrow screen', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 780 });
  await seedAndOpen(page, buildConfiguredWorkspaceBlob(), `/#/animal/${ANIMAL_ID}/cameras`);
  const trigger = page.getByRole('button', { name: 'Actions for camera 1', exact: true });
  await trigger.click();
  const remove = page.getByRole('menuitem', { name: 'Delete camera 1', exact: true });
  await expect(remove).toBeVisible();
  const box = await remove.boundingBox();
  expect(box.x).toBeGreaterThanOrEqual(0);
  expect(box.x + box.width).toBeLessThanOrEqual(320);
  expect(box.y + box.height).toBeLessThanOrEqual(780);
  await page.keyboard.press('Escape');
  await expect(trigger).toBeFocused();
});

test('copy stimulation settings preserves destination epoch assignments and exports every pulse field', async ({ page }) => {
  const blob = optoBlob();
  const source = { name: 'first.yaml', epochs: [2], camera_id: 0, dio_output_name: 'laser_trigger',
    power_in_mW: 5, pulseLength: 2, nPulses: 3, sequencePeriod: 4, nOutputTrains: 5, trainInterval: 6 };
  blob.workspace.days[DAY_ID].fs_gui_yamls = [source, { ...source, name: 'second.yaml', epochs: [4], pulseLength: 99 }];
  await seedAndOpen(page, blob, `/#/day/${DAY_ID}`);
  await page.getByText('Stimulation protocols · 2', { exact: true }).click();
  await page.getByRole('button', { name: 'Edit protocol 2', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Stimulation protocol' });
  await expect(dialog.getByLabel('Pulse length (ms)', { exact: true })).toBeVisible();
  await dialog.getByLabel('Source protocol', { exact: true }).selectOption('0');
  await dialog.getByRole('button', { name: 'Copy settings', exact: true }).click();
  await expect(dialog.getByLabel('Pulse length (ms)', { exact: true })).toHaveValue('2');
  await dialog.getByRole('button', { name: 'Done', exact: true }).click();
  await page.getByRole('button', { name: 'Review & export', exact: true }).click();
  const download = await captureDownload(page, () => page.getByRole('button', { name: 'Download YAML', exact: true }).click());
  expect(YAML.parse(download.text).fs_gui_yamls).toEqual([source, { ...source, name: 'second.yaml', epochs: [4] }]);
});
