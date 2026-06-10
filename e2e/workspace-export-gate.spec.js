/**
 * E2E: Fail-closed export gate + repair navigation.
 *
 * Proves an invalid recording day cannot reach or use the YAML download from ANY route —
 * the Day Editor Export step's own Download button, keyboard navigation (Alt+→) into the
 * Export step, or the per-animal "Export Valid Only" batch path — and that the visible
 * blocking UI offers a repair action that deep-links to the editable owner of the fix.
 *
 * The Day Editor sections are FREELY navigable (no step-locking); the gate lives INSIDE the
 * Export step (ExportStep.jsx consults isExportEnabled(computeStepStatus(...))). So "stepper
 * click / keyboard next cannot bypass" means: reaching Export by any route still shows the
 * BLOCKED state with a repair action and the Download is disabled / never fires — not that
 * navigation itself is blocked.
 *
 * Invalid-day fixture: camera 0's `meters_per_pixel` is set to a non-number (the empty string),
 * which the schema (`type: number`) rejects with an error-severity AJV issue whose path is
 * `cameras[0].meters_per_pixel`. That is a SHARED (animal-owned) setup field, so its repair
 * routes to `#/animal/:id/cameras?field=…` — exercising the AnimalView `?field=` highlight.
 *
 * QA discipline: role/accessible-name or route/href selectors only (never CSS class for app
 * controls — the framework `.repair-target-highlight` class is the one exception, since it IS
 * the highlight mechanism); wait on locators/URLs/events (never sleeps); the no-download check
 * uses a BOUNDED waitForEvent backstop, with the disabled/blocked state as the primary signal;
 * reset state per test for independence.
 */

import { test, expect } from '@playwright/test';
import {
  resetWorkspace,
  seedAndOpen,
  buildConfiguredWorkspaceBlob,
  ANIMAL_ID,
  DAY_ID,
} from './helpers/workspace';

/**
 * Bounded window for the "no download fires" backstops. A download would arrive ~immediately if
 * the gate leaked, so this only has to be long enough to outlast that synchronous emit — the
 * disabled/blocked UI is the primary signal and waitForEvent rejecting on timeout is the backstop.
 */
const NO_DOWNLOAD_TIMEOUT_MS = 1500;

/**
 * Build the configured-workspace blob, then make ONE shared-setup field invalid: camera 0's
 * `meters_per_pixel` becomes the empty string (schema `type: number` → error-severity issue at
 * `cameras[0].meters_per_pixel`, which routes to the animal Cameras tab). Everything else stays
 * the otherwise-valid realistic day, so the day's ONLY blocker is this single error.
 *
 * @returns {{ schemaVersion: number, workspace: object }} A loader-ready blob with one invalid camera.
 */
function buildInvalidCameraBlob() {
  const blob = buildConfiguredWorkspaceBlob();
  // Empty string is not a number — AJV rejects it (error severity). Mutating the returned object
  // directly (not via override) keeps the realistic seed intact and diverges exactly one field.
  blob.workspace.animals[ANIMAL_ID].cameras[0].meters_per_pixel = '';
  return blob;
}

/**
 * Seed the invalid-camera workspace and land on the day's Export section.
 * A full reload after the hash-nav forces a fresh document so the store hydrates from the seed.
 *
 * @param {import('@playwright/test').Page} page - The Playwright page.
 * @returns {Promise<void>} Resolves once the Export YAML heading is visible.
 */
async function openInvalidDayExportStep(page) {
  await seedAndOpen(page, buildInvalidCameraBlob(), `/#/day/${DAY_ID}`);
  await expect(
    page.getByRole('heading', { level: 1, name: `Day Editor: ${ANIMAL_ID} - 2023-06-22` }),
  ).toBeVisible();

  // Reach the Export section (a freely-reachable tab; its DOWNLOAD action self-gates).
  await page.getByRole('button', { name: /^Export — / }).click();
  await expect(page.getByRole('heading', { level: 2, name: 'Export YAML' })).toBeVisible();
}

test.describe('Fail-closed export gate + repair navigation', () => {
  test.beforeEach(async ({ page }) => {
    await resetWorkspace(page);
  });

  test('Export step shows a disabled Download and a blocking message with a repair action', async ({
    page,
  }) => {
    await openInvalidDayExportStep(page);

    // The Export nav item already advertises the block (status glyph in its accessible name).
    await expect(page.getByRole('button', { name: 'Export — Has errors' })).toBeVisible();

    // The Download control is GATED — assert the disabled state, not merely a missing button.
    const download = page.getByRole('button', { name: 'Download YAML' });
    await expect(download).toBeVisible();
    await expect(download).toBeDisabled();

    // A visible blocking region explains WHY and offers a repair action.
    const blocked = page.getByRole('alert');
    await expect(blocked).toBeVisible();
    await expect(blocked.getByText(/Resolve 1 validation error before exporting/)).toBeVisible();
    // The repair action deep-links to the EDITABLE owner of the fix (cameras are animal-owned).
    await expect(
      blocked.getByRole('button', { name: 'Fix in Animal Setup → Cameras' }),
    ).toBeVisible();
  });

  test('no download fires from the Export-step Download button while the day is invalid', async ({
    page,
  }) => {
    await openInvalidDayExportStep(page);

    const download = page.getByRole('button', { name: 'Download YAML' });
    await expect(download).toBeDisabled();

    // Backstop: even a forced click (bypassing the disabled affordance) must not produce a
    // download. Bounded waitForEvent — a download within the window would reject this assertion.
    const noDownload = page.waitForEvent('download', { timeout: NO_DOWNLOAD_TIMEOUT_MS });
    await download.click({ force: true });
    await expect(noDownload).rejects.toThrow();
  });

  test('keyboard navigation (Alt+→) into the Export step cannot bypass the gate', async ({
    page,
  }) => {
    await seedAndOpen(page, buildInvalidCameraBlob(), `/#/day/${DAY_ID}`);
    await expect(
      page.getByRole('heading', { level: 1, name: `Day Editor: ${ANIMAL_ID} - 2023-06-22` }),
    ).toBeVisible();

    // Start on Overview (the default section) and advance with the global Alt+ArrowRight shortcut
    // toward Export. Press-until-visible (bounded) encodes the INTENT ("advance to the Export
    // section") without hard-coding the step distance, so the test survives section-order drift.
    await expect(page.getByRole('heading', { level: 2, name: 'Session Metadata' })).toBeVisible();
    const exportHeading = page.getByRole('heading', { level: 2, name: 'Export YAML' });
    const MAX_NAV_STEPS = 8; // generous bound > any plausible section count; fails clearly if unmet
    for (let i = 0; i < MAX_NAV_STEPS && !(await exportHeading.isVisible()); i += 1) {
      await page.keyboard.press('Alt+ArrowRight');
    }
    await expect(
      exportHeading,
      'Alt+ArrowRight should reach the Export section within the step bound',
    ).toBeVisible();

    // Reaching Export by keyboard still shows the BLOCKED state: Download disabled + repair action.
    const download = page.getByRole('button', { name: 'Download YAML' });
    await expect(download).toBeDisabled();
    await expect(
      page.getByRole('alert').getByRole('button', { name: 'Fix in Animal Setup → Cameras' }),
    ).toBeVisible();

    // And no download can be coerced out of it.
    const noDownload = page.waitForEvent('download', { timeout: NO_DOWNLOAD_TIMEOUT_MS });
    await download.click({ force: true });
    await expect(noDownload).rejects.toThrow();
  });

  test('per-animal "Export Valid Only" is disabled (with a reason) when the only day is in error (F-08)', async ({
    page,
  }) => {
    await seedAndOpen(page, buildInvalidCameraBlob(), `/#/animal/${ANIMAL_ID}/export`);
    await expect(
      page.getByRole('heading', { level: 2, name: 'This animal — readiness & export' }),
    ).toBeVisible();

    // The day is counted as an error, NOT ready.
    await expect(page.getByText('0 valid')).toBeVisible();
    await expect(page.getByText('1 with errors')).toBeVisible();

    // With 0 valid days AND an error day, "Export Valid Only" is inert/misleading — so it is
    // DISABLED with an accessible reason rather than reporting "Exported 0 files" on click.
    const exportButton = page.getByRole('button', { name: 'Export Valid Only' });
    await expect(exportButton).toBeDisabled();
    await expect(page.getByText(/No valid days to export — fix errors first/)).toBeVisible();

    // No preflight, and a forced click still produces no download.
    await expect(
      page.getByRole('region', { name: 'Batch export preflight' }),
    ).toHaveCount(0);
    const noDownload = page.waitForEvent('download', { timeout: NO_DOWNLOAD_TIMEOUT_MS });
    await exportButton.click({ force: true });
    await expect(noDownload).rejects.toThrow();
  });

  test('the repair action deep-links to the owning animal Cameras tab and highlights the target', async ({
    page,
  }) => {
    await openInvalidDayExportStep(page);

    // Click the repair action in the blocking UI.
    await page
      .getByRole('alert')
      .getByRole('button', { name: 'Fix in Animal Setup → Cameras' })
      .click();

    // It navigates to the OWNING animal-setup tab with the field carried as a `?field=` deep-link.
    await expect(page).toHaveURL(
      new RegExp(
        `#/animal/${ANIMAL_ID}/cameras\\?field=${encodeURIComponent('cameras[0].meters_per_pixel')}`,
      ),
    );

    // The Cameras section-nav link is the active tab (we landed on the right tab, not a placeholder).
    await expect(
      page.getByRole('navigation', { name: 'Animal sections' }).getByRole('link', {
        name: /^Cameras/,
      }),
    ).toHaveAttribute('aria-current', 'page');

    // AnimalView scrolls to and BRIEFLY highlights the section the field belongs to (the same
    // `.repair-target-highlight` cue as the Day Editor). The highlight is transient (it is removed
    // ~2s after it lands), so assert it appears within that window — this IS the highlight
    // mechanism, so asserting the class is the documented exception to the no-CSS-selector rule.
    await expect(page.locator('.repair-target-highlight')).toBeVisible();
  });
});
