/**
 * E2E: Browser-export of a configured recording day (the real download path).
 *
 * These specs drive the SHIPPED export surfaces — the per-day Day Editor Export step
 * (`#/day/:id` → Export section → "Download YAML") and the per-animal Validation & Export
 * tab (`#/animal/:id/export` → "Export Valid Only" → batch preflight → "Confirm export (N)")
 * — capture the YAML the browser actually downloads, and assert the high-risk, previously
 * data-corrupting sections are correct in the downloaded TEXT.
 *
 * They are deliberately SMALL, TARGETED assertions on the corrected sections (integer ids,
 * species binomial, camera `lens`, `data_acq_device` list, bad-channel marks, technical
 * fields, no `[object Object]`). They do NOT snapshot the whole file or duplicate the byte
 * baselines in src/__tests__/baselines/ or e2e/baselines/ — those own the byte-regression job.
 *
 * QA discipline: role/accessible-name or route selectors only (never CSS class); wait on
 * locators/URLs/events (never sleeps); reset state per test so tests are independent.
 */

import { test, expect } from '@playwright/test';
import {
  resetWorkspace,
  seedAndOpen,
  buildConfiguredWorkspaceBlob,
  captureDownload,
  ANIMAL_ID,
  DAY_ID,
} from './helpers/workspace';

const EXPECTED_FILENAME = '06222023_remy_metadata.yml';

test.describe('Browser export of a configured recording day', () => {
  test.beforeEach(async ({ page }) => {
    await resetWorkspace(page);
  });

  test('per-day Export step shows a preflight summary and downloads corrected YAML', async ({
    page,
  }) => {
    await seedAndOpen(page, buildConfiguredWorkspaceBlob(), `/#/day/${DAY_ID}`);
    await expect(
      page.getByRole('heading', { level: 1, name: `Day Editor: ${ANIMAL_ID} - 2023-06-22` }),
    ).toBeVisible();

    // Navigate to the Export section (a freely-reachable tab; its DOWNLOAD action self-gates).
    await page.getByRole('button', { name: /^Export — / }).click();
    await expect(page.getByRole('heading', { level: 2, name: 'Export YAML' })).toBeVisible();

    // The resolved deterministic filename is shown before download.
    await expect(page.getByText(EXPECTED_FILENAME)).toBeVisible();

    // ---- Preflight summary: assert the ownership/confidence tiers the UI renders. ----
    // Each row is a <dt>/<dd> pair. Assert the categories the current preflight actually shows
    // (the term labels) and their resolved values — animal+day, subject+session, configuration
    // version, probes/bad-channels, cameras/calibration, data-acq, tasks/videos, opto.
    const preflight = page.getByRole('region', { name: 'Export preflight summary' });
    await expect(preflight).toBeVisible();
    await expect(preflight.getByText('Animal & day', { exact: true })).toBeVisible();
    await expect(preflight.getByText(`${ANIMAL_ID} — 2023-06-22`, { exact: true })).toBeVisible();
    await expect(preflight.getByText('Subject & session', { exact: true })).toBeVisible();
    await expect(preflight.getByText('remy — session remy_20230622', { exact: true })).toBeVisible();
    await expect(preflight.getByText('Configuration version', { exact: true })).toBeVisible();
    await expect(preflight.getByText('Version 1 (current)', { exact: true })).toBeVisible();
    await expect(preflight.getByText('Probes & failed channels', { exact: true })).toBeVisible();
    await expect(
      preflight.getByText('8 electrode groups, 2 failed channels', { exact: true }),
    ).toBeVisible();
    await expect(preflight.getByText('Cameras / calibration', { exact: true })).toBeVisible();
    await expect(preflight.getByText('Data acquisition', { exact: true })).toBeVisible();
    await expect(preflight.getByText('1 device (SpikeGadgets)', { exact: true })).toBeVisible();
    await expect(preflight.getByText('Tasks & videos', { exact: true })).toBeVisible();
    await expect(preflight.getByText('Optogenetics', { exact: true })).toBeVisible();

    // ---- Capture the real browser download and assert the corrected sections. ----
    const { filename, text } = await captureDownload(page, async () => {
      await page.getByRole('button', { name: 'Download YAML' }).click();
    });

    expect(filename).toBe(EXPECTED_FILENAME);
    assertCorrectedYaml(text);
  });

  test('per-animal Validation & Export tab batch-exports the valid day with a preflight', async ({
    page,
  }) => {
    await seedAndOpen(page, buildConfiguredWorkspaceBlob(), `/#/animal/${ANIMAL_ID}/export`);
    await expect(
      page.getByRole('heading', { level: 2, name: 'This animal — readiness & export' }),
    ).toBeVisible();

    // The day is Valid and counted ready.
    await expect(page.getByText('1 valid')).toBeVisible();

    // Open the batch preflight.
    await page.getByRole('button', { name: 'Export Valid Only' }).click();
    const batch = page.getByRole('region', { name: 'Batch export preflight' });
    await expect(batch.getByRole('heading', { name: 'Confirm batch export' })).toBeVisible();
    // The preflight line names the config version, electrode groups + failed channels,
    // cameras, and opto state for the day about to export.
    await expect(
      batch.getByText('config v1 (latest); 8 electrode groups, 2 failed channels; 2 cameras; No optogenetics'),
    ).toBeVisible();

    // Confirm and capture the downloaded file.
    const { filename, text } = await captureDownload(page, async () => {
      await batch.getByRole('button', { name: 'Confirm export (1)' }).click();
    });

    expect(filename).toBe(EXPECTED_FILENAME);
    assertCorrectedYaml(text);
  });

  test('export binds to the DAY-USED cameras and excludes an unreferenced catalog camera', async ({
    page,
  }) => {
    // Add a THIRD catalog camera no task/video/fsgui references. The day-used binding
    // (mergeDayMetadata + resolveDayCameraUsage) must EXCLUDE it from the exported YAML
    // while keeping the two referenced cameras.
    const blob = buildConfiguredWorkspaceBlob();
    blob.workspace.animals[ANIMAL_ID].cameras.push({
      id: 2,
      meters_per_pixel: 0.001,
      manufacturer: 'Allied Vision',
      model: 'Mako G-158',
      lens: 'Fujinon HF16HA-1B',
      camera_name: 'UNUSED_camera',
    });
    await seedAndOpen(page, blob, `/#/day/${DAY_ID}`);
    await page.getByRole('button', { name: /^Export — / }).click();
    await expect(page.getByRole('heading', { level: 2, name: 'Export YAML' })).toBeVisible();

    const { text } = await captureDownload(page, async () => {
      await page.getByRole('button', { name: 'Download YAML' }).click();
    });

    // Referenced cameras present; the unreferenced one is NOT emitted (day-used binding).
    expect(text).toContain('camera_name: overhead_camera');
    expect(text).toContain('camera_name: side_camera');
    expect(text).not.toContain('UNUSED_camera');
  });
});

/**
 * Assert the high-risk, previously-corrupting sections are correct in a downloaded YAML.
 *
 * SMALL targeted checks on the corrected sections only — NOT a whole-file snapshot (the byte
 * baselines own that). Each assertion guards a known historical failure mode.
 *
 * @param {string} text - The downloaded YAML file's full text.
 */
function assertCorrectedYaml(text) {
  // No object-coercion corruption anywhere, and no scalar coerced to the literal `undefined`
  // (a real JS `undefined` is dropped from YAML, so guard the coerced-string failure mode only:
  // a key whose emitted value is exactly `undefined`). Free text may legitimately contain the
  // word, so anchor to a `: undefined` value at end of line rather than a bare substring.
  expect(text).not.toContain('[object Object]');
  expect(text).not.toMatch(/: undefined$/m);

  // Subject / session fields, with species as a Latin binomial (DANDI rejects free text).
  expect(text).toContain('subject_id: remy');
  expect(text).toContain('species: Rattus norvegicus');
  expect(text).toContain('session_id: remy_20230622');
  expect(text).toMatch(/session_description: /);

  // Cameras carry a `lens` field (a corrected high-risk section).
  expect(text).toMatch(/^ {4}lens: Fujinon HF16HA-1B$/m);

  // data_acq_device emitted as a LIST with a name (not a bare object / coerced string).
  expect(text).toMatch(/data_acq_device:\n {2}- name: SpikeGadgets/);

  // Electrode groups + ntrode maps use INTEGER ids (never quoted strings, never coerced).
  // id: 0 (unquoted), and ntrode_id: 1 (unquoted) prove integer typing survived the merge.
  expect(text).toMatch(/^ {2}- id: 0$/m);
  expect(text).toMatch(/ntrode_id: 1$/m);
  expect(text).not.toMatch(/id: ['"]0['"]/);

  // The day's bad-channel marks land on the ntrode rows: the load-time migration materializes
  // the seeded marks into the day override, and the merge emits them on the matching ntrode
  // rows. Assert a populated bad_channels list with the value 2 survived the merge (6-space
  // list indent under the 4-space `bad_channels:` key). This is not anchored to a specific
  // owning row — it asserts the marks were not dropped, not which row owns them.
  expect(text).toMatch(/^ {4}bad_channels:\n {6}- 2$/m);

  // Technical fields required downstream. (default_header_file_path is intentionally omitted
  // by the merge when empty, so it is NOT asserted here — only the always-emitted ones.)
  expect(text).toContain('raw_data_to_volts: 0.195');
  expect(text).toContain('times_period_multiplier: 1.5');

  // Tasks and associated video files present.
  expect(text).toContain('task_name: w_alternation');
  expect(text).toMatch(/associated_video_files:/);
}
