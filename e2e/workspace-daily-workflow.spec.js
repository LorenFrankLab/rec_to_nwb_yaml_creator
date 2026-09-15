/**
 * The first-release daily workflow (FIX_PLAN increments 1–3), in a real browser:
 *
 *  1. Log today / choose a recording date → the day is created from the nearest earlier day, pinned to
 *     the probe setup effective on that date, and opened directly (desktop + 390 px phone width).
 *  2. Typing into a focused field, pressing Ctrl+S, and reloading preserves the text (F3).
 *  3. A second tab of the same workspace opens read-only and cannot overwrite the editing tab (F4).
 *  4. Download workspace backup → restore preserves incomplete days, configuration history and
 *     provenance (F8).
 *  5. A downloaded day reads "Downloaded"; correcting its weight reads "Changed since download" (F6).
 */

import { test, expect } from '@playwright/test';
import {
  seedAndOpen,
  buildConfiguredWorkspaceBlob,
  captureDownload,
  ANIMAL_ID,
  DAY_ID,
  STORAGE_KEY,
} from './helpers/workspace';

/** Two-setup animal: v1 effective 2023-06-01, v2 (lowered) effective 2023-07-01; one day on each. */
function buildBackfillBlob() {
  const blob = buildConfiguredWorkspaceBlob();
  const animal = blob.workspace.animals[ANIMAL_ID];
  const v1 = { ...animal.configurationHistory[0], version: 1, date: '2023-06-01', description: 'Implant' };
  const v2 = { ...structuredClone(v1), version: 2, date: '2023-07-01', description: 'Lowered tetrodes' };
  animal.configurationHistory = [v1, v2];
  const dayA = blob.workspace.days[DAY_ID];
  dayA.session = { ...dayA.session, weight: 480 };
  dayA.experimenters = { experimenter_name: ['Doe, Jane'], lab: 'Frank', institution: 'UCSF' };
  dayA.data_acq_device_name = 'SpikeGadgets';
  dayA.dataFolder = '/data/remy/20230622/';
  const dayBId = 'remy-2023-07-02';
  const dayB = {
    ...structuredClone(dayA),
    id: dayBId,
    date: '2023-07-02',
    experimentDate: '07022023',
    session: { ...dayA.session, session_id: 'remy_20230702', weight: 530 },
    experimenters: { experimenter_name: ['Doe, Jane', 'Roe, Richard'], lab: 'Frank', institution: 'UCSF' },
    dataFolder: '/data/remy/20230702/',
    configurationVersion: 2,
  };
  blob.workspace.days[dayBId] = dayB;
  animal.days = [DAY_ID, dayBId];
  return blob;
}

for (const viewport of [
  { name: 'desktop 1280×720', width: 1280, height: 720 },
  { name: 'phone 390×844', width: 390, height: 844 },
]) {
  test(`backfill June 25 by typed date: starts from June 22, pins setup v1 (not the newer v2), opens directly (${viewport.name})`, async ({ page }) => {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await seedAndOpen(page, buildBackfillBlob(), `/#/animal/${ANIMAL_ID}/days`);

    const dateInput = page.getByLabel('Choose recording date');
    await dateInput.fill('2023-06-25');
    // The preview names the source day and the setup effective then.
    const preview = page.locator('#log-day-preview');
    await expect(preview).toContainText('from Jun 22, 2023');
    await expect(preview).toContainText('probe setup v1');
    await page.getByRole('button', { name: 'Create & open' }).click();

    await expect(page).toHaveURL(/#\/day\/remy-2023-06-25$/);
    await expect(page.getByRole('heading', { level: 1, name: /Day Editor: remy - 2023-06-25/ })).toBeVisible();
    const provenance = page.getByTestId('day-provenance');
    await expect(provenance).toContainText('Started from Jun 22, 2023');
    await expect(provenance).toContainText('Probe setup v1');
    // The weight is NOT copied; the previous measurement is a dated suggestion.
    await expect(page.getByLabel('Weight measured today (grams)')).toHaveValue('');
    await expect(page.getByText(/Previous measurement: 480 g on 2023-06-22/)).toBeVisible();
    // The team was copied from June 22 (one person), not from July 2 (two).
    await expect(page.getByLabel(/Experimenters present/)).toHaveValue('Doe, Jane');

    // Persisted with the right pin, provenance and re-dated folder.
    await expect
      .poll(async () => {
        const raw = await page.evaluate((key) => window.localStorage.getItem(key), STORAGE_KEY);
        const day = raw ? JSON.parse(raw).workspace.days['remy-2023-06-25'] : null;
        return day && [day.configurationVersion, day.provenance.copiedFromDayId, day.dataFolder, day.session.weight];
      })
      .toEqual([1, DAY_ID, '/data/remy/20230625/', undefined]);

    // No horizontal page scroll at this width.
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(1);
  });
}

test('Log today creates today’s day and opens it; a second press just opens it', async ({ page }) => {
  await seedAndOpen(page, buildBackfillBlob(), `/#/animal/${ANIMAL_ID}/days`);
  await page.getByRole('button', { name: /^Log today/ }).click();
  await expect(page).toHaveURL(/#\/day\/remy-\d{4}-\d{2}-\d{2}$/);
  await page.goBack();
  await expect(page.getByRole('button', { name: /^Open today/ })).toBeVisible();
});

test('typing into a focused field, Ctrl+S, and reloading preserves the text (F3)', async ({ page }) => {
  await seedAndOpen(page, buildConfiguredWorkspaceBlob(), `/#/day/${DAY_ID}`);
  const team = page.getByLabel(/Experimenters present/);
  await team.click();
  await team.fill('Doe, Jane\nTyped, Without Blur');
  // Still focused; the indicator must not claim "Saved" over the pending draft.
  await expect(team).toBeFocused();
  await expect(page.getByRole('status', { name: /unsaved edits/i })).toBeVisible();
  await page.keyboard.press('Control+s');
  await expect(page.getByRole('status', { name: /^Saved/ })).toBeVisible();
  await page.reload();
  await expect(page.getByLabel(/Experimenters present/)).toHaveValue('Doe, Jane\nTyped, Without Blur');
});

test('a second tab opens read-only and cannot overwrite the editing tab (F4)', async ({ context, page }) => {
  await seedAndOpen(page, buildConfiguredWorkspaceBlob(), `/#/day/${DAY_ID}`);
  await expect(page.getByRole('heading', { level: 1, name: /Day Editor/ })).toBeVisible();

  const second = await context.newPage();
  await second.goto(`/#/day/${DAY_ID}`);
  await expect(second.getByText(/Another tab is editing this workspace/)).toBeVisible();

  // Tab A edits the weight; tab B (read-only) follows the saved change live.
  await page.getByLabel('Weight measured today (grams)').fill('491');
  await page.keyboard.press('Control+s');
  await expect(second.getByLabel('Weight measured today (grams)')).toHaveValue('491');

  // Tab B types something; nothing it does reaches storage (the weight stays 491).
  await second.getByLabel('Weight measured today (grams)').fill('999');
  await second.keyboard.press('Control+s');
  await expect(second.getByRole('alert')).toContainText(/read-only/i);
  const stored = await page.evaluate((key) => JSON.parse(window.localStorage.getItem(key)).workspace.days, STORAGE_KEY);
  expect(stored[DAY_ID].session.weight).toBe(491);

  // Tab B takes over: tab A hands the lease over (after its final write) and becomes read-only.
  await second.getByRole('button', { name: /Edit in this tab instead/ }).click();
  await expect(second.getByText(/Another tab is editing/)).toHaveCount(0);
  await expect(page.getByText(/Editing moved to another tab/)).toBeVisible();
  await second.close();
});

test('workspace backup → restore preserves incomplete days, setup history and provenance (F8)', async ({ page }) => {
  const blob = buildBackfillBlob();
  await seedAndOpen(page, blob, `/#/animal/${ANIMAL_ID}/days`);
  // Create an incomplete (draft) backfill day first.
  await page.getByLabel('Choose recording date').fill('2023-06-25');
  await page.getByRole('button', { name: 'Create & open' }).click();
  await expect(page).toHaveURL(/#\/day\/remy-2023-06-25$/);
  // Let the autosave settle before the wipe below (a pending write is legitimately re-issued on
  // unload — that is the F3 guarantee).
  await expect(page.getByRole('status', { name: /^Saved/ })).toBeVisible();

  await page.goto('/#/workspace');
  const { filename, text } = await captureDownload(page, (p) =>
    p.getByRole('button', { name: 'Download workspace backup' }).click()
  );
  expect(filename).toMatch(/^rec_to_nwb_workspace_\d{8}-\d{4}\.json$/);
  const envelope = JSON.parse(text);
  expect(envelope.format).toBe('rec_to_nwb_workspace_backup');
  expect(envelope.workspace.days['remy-2023-06-25'].state.draft).toBe(true);
  expect(envelope.workspace.days['remy-2023-06-25'].provenance.copiedFromDayId).toBe(DAY_ID);
  expect(envelope.workspace.animals[ANIMAL_ID].configurationHistory).toHaveLength(2);

  // Wipe the workspace, then restore from the file.
  await page.evaluate((key) => window.localStorage.removeItem(key), STORAGE_KEY);
  await page.reload();
  await expect(page.getByText('No animals created yet.')).toBeVisible();
  const chooser = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: /Restore from backup/ }).click();
  await (await chooser).setFiles({ name: filename, mimeType: 'application/json', buffer: Buffer.from(text) });
  const dialog = page.getByRole('alertdialog');
  await expect(dialog).toContainText('1 animal, 3 recording days');
  await expect(dialog).toContainText('3 incomplete'); // the harness seeds draft days; the backfill is a third
  await dialog.getByRole('button', { name: 'Replace workspace' }).click();
  await expect(page.getByRole('link', { name: ANIMAL_ID })).toBeVisible();
  const restored = await page.evaluate((key) => JSON.parse(window.localStorage.getItem(key)).workspace, STORAGE_KEY);
  expect(Object.keys(restored.days).sort()).toEqual([DAY_ID, 'remy-2023-06-25', 'remy-2023-07-02']);
  expect(restored.days['remy-2023-06-25'].provenance.configuration).toEqual({ source: 'effective-date', confirmed: true });
});

test('a download reads "Downloaded"; a later weight correction reads "Changed since download" (F6)', async ({ page }) => {
  await seedAndOpen(page, buildConfiguredWorkspaceBlob(), `/#/day/${DAY_ID}`);
  await page.getByRole('button', { name: 'Export', exact: true }).click();
  await expect(page.getByTestId('download-status')).toHaveAttribute('data-status', 'never');
  const { filename } = await captureDownload(page, (p) => p.getByRole('button', { name: 'Download' }).click());
  expect(filename).toBe('20230622_remy_metadata.yml');
  await expect(page.getByTestId('download-status')).toHaveAttribute('data-status', 'current');

  await page.getByRole('button', { name: /^Daily log/ }).click();
  await page.getByLabel('Weight measured today (grams)').fill('486');
  await page.keyboard.press('Control+s');
  await page.getByRole('button', { name: 'Export', exact: true }).click();
  await expect(page.getByTestId('download-status')).toHaveAttribute('data-status', 'changed');
  await expect(page.getByTestId('download-status')).toContainText('Changed since download');
  await page.getByText(/Show what changed/).click();
  await expect(page.getByLabel('Changes since the last download')).toContainText('weight: 486');
});
