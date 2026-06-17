/**
 * E2E: Workspace user-story workflows — same-day export and catch-up batch export.
 *
 * These are SCENARIO tests written from the neuroscientist's goal, not field-by-field
 * checks: they assert the workflow the app promises actually works end to end, and name
 * the mistake each prevents.
 *
 * QA discipline: role/accessible-name or route selectors only (never CSS class); wait on
 * locators/events/URLs (never sleeps); reset state per test so tests are independent.
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

/**
 * Clone the seeded day into a SECOND recording day under a new id/date, register it on the
 * animal + the workspace day map, and return the new day's id. Keeps the cloned-day shape in
 * one place so the catch-up tests differ only by the optional `mutate` they apply.
 *
 * @param {object} blob - The workspace blob from buildConfiguredWorkspaceBlob().
 * @param {object} opts
 * @param {string} opts.id - The new day id.
 * @param {string} opts.date - The new day's ISO date.
 * @param {string} opts.experimentDate - The new day's mmddYYYY experiment date.
 * @param {string} opts.sessionId - The new day's session_id.
 * @param {(day: object) => void} [opts.mutate] - Optional extra mutation on the cloned day.
 * @returns {string} The new day's id.
 */
function addClonedDay(blob, { id, date, experimentDate, sessionId, mutate }) {
  const day = structuredClone(blob.workspace.days[DAY_ID]);
  day.id = id;
  day.date = date;
  day.experimentDate = experimentDate;
  day.session.session_id = sessionId;
  if (mutate) mutate(day);
  blob.workspace.days[id] = day;
  blob.workspace.animals[ANIMAL_ID].days = [DAY_ID, id];
  return id;
}

test.describe('Workspace export workflows', () => {
  test.beforeEach(async ({ page }) => {
    await resetWorkspace(page);
  });

  // SAME-DAY: a prepared animal reaches one trustworthy YAML for one day WITHOUT re-entering
  // shared setup. Mistake prevented: re-doing electrode/camera setup per recording day (which
  // would let a typo diverge a day's hardware from the rest of the chronic series).
  test('same-day: a prepared animal exports one day without re-entering shared setup', async ({
    page,
  }) => {
    // Go straight from the day to its export — never through an electrode/camera setup form.
    await seedAndOpen(page, buildConfiguredWorkspaceBlob(), `/#/day/${DAY_ID}`);
    await expect(
      page.getByRole('heading', { level: 1, name: `Day Editor: ${ANIMAL_ID} - 2023-06-22` }),
    ).toBeVisible();

    // The Day Editor has no electrode-group / channel-map / camera setup STEP — those are
    // animal-level shared setup, not re-entered per day. Assert the day's tab bar exposes only the
    // day-scoped tabs (Day / Epochs / Failed channels / DIO) and NOT an electrode-group or camera
    // configuration step. (Export is a header action, not a tab.)
    const dayNav = page.getByRole('navigation', { name: 'Day editor sections' });
    await expect(dayNav.getByRole('button', { name: /^Day:/ })).toBeVisible();
    await expect(dayNav.getByRole('button', { name: /^Failed channels:/ })).toBeVisible();
    await expect(dayNav.getByRole('button', { name: /^Epochs:/ })).toBeVisible();
    await expect(dayNav.getByRole('button', { name: /^DIO:/ })).toBeVisible();
    // No camera / electrode-group setup form is part of the day flow.
    await expect(dayNav.getByRole('button', { name: /Electrode Groups/i })).toHaveCount(0);
    await expect(dayNav.getByRole('button', { name: /Cameras/i })).toHaveCount(0);

    // Day → Export → download, in one move (Export is the header action).
    await page.getByRole('button', { name: 'Export', exact: true }).click();
    await expect(page.getByRole('heading', { level: 2, name: 'Export — 2023-06-22' })).toBeVisible();

    const { filename, text } = await captureDownload(page, async () => {
      await page.getByRole('button', { name: 'Download' }).click();
    });

    expect(filename).toBe(EXPECTED_FILENAME);
    // The shared setup made it into the file unchanged (species + cameras) without re-entry.
    expect(text).toContain('species: Rattus norvegicus');
    expect(text).toContain('camera_name: overhead_camera');
  });

  // CATCH-UP: an animal with MULTIPLE days exposes a per-day scan surface (compare days WITHOUT
  // opening each one), then batch-exports only ready days. Mistake prevented: opening every day
  // editor one-by-one to find which are ready, and accidentally shipping an unready day.
  test('catch-up: per-day scan fields are visible and batch export ships every ready day', async ({
    page,
  }) => {
    // Build a SECOND valid recording day by cloning the seeded day under a new id/date.
    const blob = buildConfiguredWorkspaceBlob();
    const day2Id = addClonedDay(blob, {
      id: 'remy-2023-06-23',
      date: '2023-06-23',
      experimentDate: '06232023',
      sessionId: 'remy_20230623',
    });
    // The per-animal Validation & Export tab is the catch-up surface.
    await seedAndOpen(page, blob, `/#/animal/${ANIMAL_ID}/export`);
    await expect(
      page.getByRole('heading', { level: 2, name: 'This animal — readiness & export' }),
    ).toBeVisible();

    // Both days are ready.
    await expect(page.getByText('2 valid')).toBeVisible();

    // Per-day scan fields are visible WITHOUT opening each day: each row carries date, session,
    // a config/camera/opto setup summary, a validation status chip, and an export/repair action.
    const table = page.getByRole('table', {
      name: 'Recording days across all animals with validation status',
    });
    // Column headers expose the scan dimensions the catch-up surface promises.
    for (const col of ['Animal', 'Date', 'Session', 'Setup', 'Status', 'Editor']) {
      await expect(table.getByRole('columnheader', { name: col })).toBeVisible();
    }
    // Day 1 row (addressed by its stable per-day test id): date, session, the dated-config setup
    // summary (config version + camera count + opto), a Valid status chip, and an Open-editor action.
    const row1 = page.getByTestId(`day-row-${DAY_ID}`);
    await expect(row1.getByRole('cell', { name: '2023-06-22', exact: true })).toBeVisible();
    // The Session cell now carries the session id AND the day's session description on its own line.
    await expect(row1.getByRole('cell', { name: /remy_20230622/ })).toBeVisible();
    await expect(
      row1.getByText('Day 45 of chronic recording, W-track alternation'),
    ).toBeVisible();
    // The setup summary now reads the unified config-version label (latest/historical) and the
    // per-camera calibration alongside the camera count and the opto state.
    await expect(
      row1.getByText(
        'config v1 (latest) · 2 cameras (overhead_camera 0.00085 m/px, side_camera 0.0009 m/px) · No optogenetics',
      ),
    ).toBeVisible();
    // Both days are live-valid but not yet saved as validated, so the lifecycle chip reads
    // "Ready to export" (the shared vocabulary's live-readiness word), not a bare "Valid".
    await expect(row1.getByRole('cell', { name: 'Ready to export', exact: true })).toBeVisible();
    await expect(
      row1.getByRole('link', { name: 'Open editor for remy 2023-06-22' }),
    ).toBeVisible();
    // Day 2 row is present too — proving the scan covers every day at a glance.
    const row2 = page.getByTestId(`day-row-${day2Id}`);
    await expect(row2.getByRole('cell', { name: '2023-06-23', exact: true })).toBeVisible();
    await expect(row2.getByRole('cell', { name: 'Ready to export', exact: true })).toBeVisible();

    // Batch export: only ready days export. Both are valid, so the preflight names 2 days.
    await page.getByRole('button', { name: 'Export Valid Only' }).click();
    const batch = page.getByRole('region', { name: 'Batch export preflight' });
    await expect(batch.getByRole('heading', { name: 'Confirm batch export' })).toBeVisible();
    await expect(batch.getByText('2 days will be encoded and downloaded.')).toBeVisible();

    // Confirm exports both files; capture both downloads.
    const downloads = [];
    page.on('download', (d) => downloads.push(d));
    await batch.getByRole('button', { name: 'Confirm export (2)' }).click();
    await expect(page.getByRole('status').filter({ hasText: 'Exported 2 files.' })).toBeVisible();
    await expect.poll(() => downloads.map((d) => d.suggestedFilename()).sort()).toEqual([
      '06222023_remy_metadata.yml',
      '06232023_remy_metadata.yml',
    ]);
  });

  // CATCH-UP guard: an UNREADY day (a required field missing → an error chip) is NOT
  // batch-exported. Mistake prevented: shipping a half-finished day's YAML in a bulk run.
  test('catch-up: an unready day is excluded from batch export', async ({ page }) => {
    const blob = buildConfiguredWorkspaceBlob();
    addClonedDay(blob, {
      id: 'remy-2023-06-23',
      date: '2023-06-23',
      experimentDate: '06232023',
      sessionId: 'remy_20230623',
      // Make day 2 UNREADY: clear the required experiment description (a required field →
      // an error chip → excluded from export).
      mutate: (day) => {
        day.session.experiment_description = '';
      },
    });
    await seedAndOpen(page, blob, `/#/animal/${ANIMAL_ID}/export`);
    await expect(
      page.getByRole('heading', { level: 2, name: 'This animal — readiness & export' }),
    ).toBeVisible();

    // One valid, one not ready (has errors).
    await expect(page.getByText('1 valid')).toBeVisible();
    await expect(page.getByText('1 with errors')).toBeVisible();

    // Batch export only stages the ONE ready day.
    await page.getByRole('button', { name: 'Export Valid Only' }).click();
    const batch = page.getByRole('region', { name: 'Batch export preflight' });
    await expect(batch.getByText('1 day will be encoded and downloaded.')).toBeVisible();

    const { filename } = await captureDownload(page, async () => {
      await batch.getByRole('button', { name: 'Confirm export (1)' }).click();
    });
    expect(filename).toBe(EXPECTED_FILENAME); // the valid day only
    await expect(
      page.getByRole('status').filter({ hasText: /Exported 1 file\./ }),
    ).toBeVisible();
  });
});
