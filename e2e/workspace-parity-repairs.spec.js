import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import YAML from 'yaml';
import { seedAndOpen, buildConfiguredWorkspaceBlob, captureDownload, ANIMAL_ID, DAY_ID, STORAGE_KEY } from './helpers/workspace';

test.use({ reducedMotion: 'reduce' });

/** A valid two-epoch day with one log and video per epoch. */
function twoEpochs() {
  const blob = buildConfiguredWorkspaceBlob();
  const day = blob.workspace.days[DAY_ID];
  day.state.videolessEpochs = [];
  day.tasks = [{ ...day.tasks.find((task) => task.task_name === 'sleep'), task_epochs: [1, 2] }];
  day.associated_files = [1, 2].map((epoch) => ({
    name: `log${epoch}`, description: 'statescript log', path: `/data/log${epoch}.stateScriptLog`, task_epochs: epoch,
  }));
  day.associated_video_files = [1, 2].map((epoch) => ({ name: `video${epoch}.mp4`, camera_id: 0, task_epochs: epoch }));
  return blob;
}

/** Open the same export gate a scientist uses and parse the downloaded YAML.
 * @param {import('@playwright/test').Page} page - Browser page.
 */
async function exported(page) {
  await page.getByRole('button', { name: 'Review & export', exact: true }).click();
  const download = await captureDownload(page, () => page.getByRole('button', { name: 'Download YAML', exact: true }).click());
  return YAML.parse(download.text);
}

/** Delete through the epoch menu; leave the affected-files choice open.
 * @param {import('@playwright/test').Page} page - Browser page.
 */
async function deleteEpochTwo(page) {
  await page.getByRole('button', { name: 'More actions for epoch 2', exact: true }).click();
  await page.getByRole('menuitem', { name: 'Delete epoch 2', exact: true }).click();
}

test('delete an epoch, reassign its unassigned files through repair links, and export', async ({ page }) => {
  await seedAndOpen(page, twoEpochs(), `/#/day/${DAY_ID}`);
  await deleteEpochTwo(page);
  await page.getByRole('button', { name: 'Keep files unassigned', exact: true }).click();
  await expect(page.getByText(/File “log2” is unassigned/)).toBeVisible();
  await expect(page.getByRole('region', { name: 'Video files', exact: true }).getByText(/Video “video2.mp4” needs a recording epoch/)).toBeVisible();
  await page.getByRole('button', { name: 'Review & export', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Download YAML', exact: true })).toBeDisabled();
  await expect(page.getByText(/File “log2” needs a recording epoch/)).toBeVisible();
  await page.goto(`/#/day/${DAY_ID}?step=epochs&field=associated_files%5B1%5D.task_epochs`);
  const fileEpoch = page.getByRole('combobox', { name: 'Task epoch (required)', exact: true }).nth(1);
  await expect(fileEpoch).toBeFocused();
  await fileEpoch.selectOption('1');
  await page.goto(`/#/day/${DAY_ID}?step=epochs&field=associated_video_files%5B1%5D.task_epochs`);
  const videoEpoch = page.getByRole('combobox', { name: 'Video epoch (required)', exact: true }).nth(1);
  await expect(videoEpoch).toBeFocused();
  await videoEpoch.selectOption('1');
  // Remove the original files so the corrected epoch has just the intended replacement pair.
  await page.getByRole('button', { name: 'Remove file log1', exact: true }).click();
  await page.getByRole('button', { name: 'Remove video video1.mp4', exact: true }).click();
  const yaml = await exported(page);
  expect(yaml.tasks.flatMap((task) => task.task_epochs)).toEqual([1]);
  expect(yaml.associated_files).toEqual([{ name: 'log2', description: 'statescript log', path: '/data/log2.stateScriptLog', task_epochs: 1 }]);
  expect(yaml.associated_video_files).toEqual([{ name: 'video2.mp4', camera_id: 0, task_epochs: 1 }]);
});

test('delete with affected file removal preserves other epochs and supports Undo', async ({ page }) => {
  await seedAndOpen(page, twoEpochs(), `/#/day/${DAY_ID}`);
  await deleteEpochTwo(page);
  await page.getByRole('button', { name: 'Remove affected files', exact: true }).click();
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Show epoch 2 details', exact: true })).toBeVisible();
  await deleteEpochTwo(page);
  await page.getByRole('button', { name: 'Remove affected files', exact: true }).click();
  const yaml = await exported(page);
  expect(yaml.associated_files.map((file) => file.name)).toEqual(['log1']);
  expect(yaml.associated_video_files.map((file) => file.name)).toEqual(['video1.mp4']);
  expect(yaml.tasks.flatMap((task) => task.task_epochs)).toEqual([1]);
});

test('a second statescript stays editable during entry, after reload, and from the epoch shortcut', async ({ page }) => {
  await seedAndOpen(page, twoEpochs(), `/#/day/${DAY_ID}`);
  await page.getByRole('button', { name: 'Add Custom file', exact: true }).click();
  const name = page.getByRole('textbox', { name: 'File name (required)', exact: true }).nth(2);
  await name.fill('statescript extra');
  await expect(name).toBeVisible();
  await page.getByRole('combobox', { name: 'Task epoch (required)', exact: true }).nth(2).selectOption('1');
  await expect(name).toBeVisible();
  await page.getByRole('textbox', { name: 'Description (required)', exact: true }).nth(2).fill('statescript second log');
  await page.getByRole('textbox', { name: 'Path (required)', exact: true }).nth(2).fill('/data/extra.stateScriptLog');
  const yaml = await exported(page);
  expect(yaml.associated_files).toHaveLength(3);
  expect(yaml.associated_files[2]).toEqual({ name: 'statescript extra', description: 'statescript second log', path: '/data/extra.stateScriptLog', task_epochs: 1 });
  await page.reload();
  await page.goto(`/#/day/${DAY_ID}?step=epochs&field=associated_files%5B2%5D.name`);
  await expect(name).toBeFocused();
  await page.getByRole('button', { name: 'Remove file statescript extra', exact: true }).click();
  await page.getByRole('button', { name: 'Show epoch 1 details', exact: true }).click();
  await page.getByRole('button', { name: 'Edit name, epoch or remove file', exact: true }).click();
  await expect(page.getByRole('textbox', { name: 'File name (required)', exact: true }).first()).toBeFocused();
  await page.getByRole('textbox', { name: 'File name (required)', exact: true }).first().fill('corrected log');
  expect((await exported(page)).associated_files[0].name).toBe('corrected log');
});

test('partial units survive save, navigation and reload while export requires the complete pair', async ({ page }) => {
  await seedAndOpen(page, twoEpochs(), `/#/day/${DAY_ID}`);
  const openUnits = async () => {
    await page.goto(`/#/day/${DAY_ID}`);
    await page.getByRole('button', { name: 'Day settings', exact: true }).click();
    await page.getByText('Conversion metadata', { exact: true }).click();
  };
  await openUnits();
  await expect(page.getByText(/This value does not change the header used by trodes_to_nwb/)).toBeVisible();
  await page.getByLabel('Analog units (optional)', { exact: true }).fill('millivolts');
  await page.keyboard.press('ControlOrMeta+s');
  await page.getByRole('button', { name: 'Done', exact: true }).click();
  await page.getByRole('button', { name: 'Review & export', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Download YAML', exact: true })).toBeDisabled();
  await page.getByRole('button', { name: /^Fix in / }).click();
  await expect(page.getByLabel('Behavioral-event units (optional)', { exact: true })).toBeFocused();
  await page.reload();
  await openUnits();
  await expect(page.getByLabel('Analog units (optional)', { exact: true })).toHaveValue('millivolts');
  await page.getByLabel('Behavioral-event units (optional)', { exact: true }).fill('n/a');
  await page.getByRole('button', { name: 'Done', exact: true }).click();
  expect((await exported(page)).units).toEqual({ analog: 'millivolts', behavioral_events: 'n/a' });
  await openUnits();
  await page.getByLabel('Analog units (optional)', { exact: true }).clear();
  await page.getByRole('button', { name: 'Done', exact: true }).click();
  await page.getByRole('button', { name: 'Review & export', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Download YAML', exact: true })).toBeDisabled();
  await page.reload();
  await openUnits();
  await expect(page.getByLabel('Analog units (optional)', { exact: true })).toHaveValue('');
  await expect(page.getByLabel('Behavioral-event units (optional)', { exact: true })).toHaveValue('n/a');
  await page.getByLabel('Behavioral-event units (optional)', { exact: true }).clear();
  await page.getByRole('button', { name: 'Done', exact: true }).click();
  expect((await exported(page)).units).toBeUndefined();
});

for (const width of [1440, 390]) {
  test(`custom DIO adds on the first pointer click and never overwrites a used line at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    const blob = twoEpochs();
    blob.workspace.days[DAY_ID].behavioral_events = [];
    await seedAndOpen(page, blob, `/#/day/${DAY_ID}`);
    if (width < 720) await page.getByRole('combobox', { name: 'Section', exact: true }).selectOption({ label: 'DIO Wiring — Complete' });
    else await page.getByRole('button', { name: /^DIO Wiring/ }).click();
    await page.getByLabel('New DIO event name', { exact: true }).fill('reward_left');
    const add = page.getByRole('button', { name: 'Add line', exact: true });
    await add.scrollIntoViewIfNeeded();
    const box = await add.boundingBox();
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.up();
    await expect(page.getByLabel('Event for Din1', { exact: true })).toHaveValue('reward_left');
    await expect(page.getByLabel('Index', { exact: true })).toHaveValue('2');
    await page.getByLabel('New DIO event name', { exact: true }).fill('reward_right');
    await add.click();
    await page.getByLabel('Index', { exact: true }).fill('1');
    await page.getByLabel('New DIO event name', { exact: true }).fill('replacement');
    await expect(add).toBeDisabled();
    await expect(page.getByRole('alert')).toContainText('Din1 is already named “reward_left”');
    const yaml = await exported(page);
    expect(yaml.behavioral_events).toEqual([
      { name: 'reward_left', description: 'Din1' }, { name: 'reward_right', description: 'Din2' },
    ]);
  });
}

test('Other sex can be selected in creation and preserved by profile correction and export', async ({ page }) => {
  await seedAndOpen(page, twoEpochs(), '/#/home');
  await page.getByLabel(/Subject ID/).fill('OtherRat');
  await page.getByLabel(/^Sex/).selectOption('O');
  await page.getByRole('button', { name: 'Save draft & exit', exact: true }).click();
  await expect.poll(() => page.evaluate((key) => JSON.parse(localStorage.getItem(key)).workspace.animals.OtherRat?.subject.sex, STORAGE_KEY)).toBe('O');
  // Imported O must also remain selected when correcting an existing animal.
  const blob = twoEpochs();
  blob.workspace.animals[ANIMAL_ID].subject.sex = 'O';
  await seedAndOpen(page, blob, `/#/animal/${ANIMAL_ID}/days`);
  await page.getByRole('button', { name: 'Edit profile', exact: true }).click();
  await expect(page.getByLabel(/^Sex/)).toHaveValue('O');
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  await page.goto(`/#/day/${DAY_ID}`);
  expect((await exported(page)).subject.sex).toBe('O');
});

test('the full file manager fits a narrow screen and exposes labeled repair controls', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const blob = twoEpochs();
  blob.workspace.days[DAY_ID].associated_files[1].task_epochs = '';
  blob.workspace.days[DAY_ID].associated_video_files[1].task_epochs = '';
  await seedAndOpen(page, blob, `/#/day/${DAY_ID}`);
  await expect(page.getByRole('heading', { name: 'All saved file details', exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(1);
  expect((await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze()).violations).toEqual([]);
});

test('focused keywords survive Save and reload and are included in the exported YAML', async ({ page }) => {
  await seedAndOpen(page, twoEpochs(), `/#/day/${DAY_ID}`);
  await page.getByLabel('Keywords (optional)', { exact: true }).fill('opto\nhippocampus\nmPFC');
  await page.keyboard.press('ControlOrMeta+s');
  await page.reload();
  await expect(page.getByLabel('Keywords (optional)', { exact: true })).toHaveValue('opto\nhippocampus\nmPFC');
  expect((await exported(page)).keywords).toEqual(['opto', 'hippocampus', 'mPFC']);
});
