/**
 * Smoke test for the workspace e2e harness (e2e/helpers/workspace.js).
 *
 * Proves each helper works against the REAL app so the ~8 later specs can rely on it:
 *   - resetWorkspace      → clean empty-state picker
 *   - createAnimalViaUI   → real create form lands on the animal's days tab
 *   - seedWorkspace + buildConfiguredWorkspaceBlob → complex state hydrates from storage
 *   - captureDownload     → captures a real YAML download's text for structural asserts
 *   - disableAnimations   → registers without error and the screen still renders
 *
 * Selection is by role/accessible-name or by href/route only (never CSS class), waits
 * are on locators/URLs/events (never sleeps), and localStorage is asserted with poll —
 * this spec sets the bar the later specs follow.
 */

import { test, expect } from '@playwright/test';
import {
  STORAGE_KEY,
  SCHEMA_VERSION,
  resetWorkspace,
  seedWorkspace,
  buildConfiguredWorkspaceBlob,
  createAnimalViaUI,
  captureDownload,
  disableAnimations,
} from './helpers/workspace';

test.describe('workspace harness', () => {
  test('resetWorkspace clears the store and shows the empty-state picker', async ({ page }) => {
    await resetWorkspace(page);

    await expect(page.getByText('No animals created yet.')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Create Animal' })).toBeVisible();

    // Store is genuinely empty (not just visually).
    await expect
      .poll(() => page.evaluate((key) => window.localStorage.getItem(key), STORAGE_KEY))
      .toBeNull();
  });

  test('createAnimalViaUI creates a valid animal through the form and lands on its days tab', async ({
    page,
  }) => {
    await resetWorkspace(page);

    const { animalId } = await createAnimalViaUI(page, { subjectId: 'smokerat' });

    expect(animalId).toBe('smokerat');
    await expect(page).toHaveURL(/#\/animal\/smokerat\/days/);
    await expect(page.getByRole('heading', { level: 1, name: 'smokerat' })).toBeVisible();

    // The created animal is persisted under the workspace blob.
    await expect
      .poll(() =>
        page.evaluate((key) => {
          const raw = window.localStorage.getItem(key);
          return raw ? Object.keys(JSON.parse(raw).workspace?.animals ?? {}) : [];
        }, STORAGE_KEY),
      )
      .toContain('smokerat');
  });

  test('seedWorkspace hydrates the realistic animal + day from a built blob', async ({ page }) => {
    const blob = buildConfiguredWorkspaceBlob();
    expect(blob.schemaVersion).toBe(SCHEMA_VERSION);

    await seedWorkspace(page, blob);

    // Seeded animal is visible in the picker (link to its days route).
    await expect(page.getByRole('link', { name: /remy/ })).toBeVisible();

    // Its recording day renders on the days tab.
    await page.goto('/#/animal/remy/days');
    await expect(page.getByRole('heading', { level: 1, name: 'remy' })).toBeVisible();
    // The day link's href is on the <a> itself (the date text is a descendant that supplies
    // the accessible name), so match the element that is BOTH the named link AND carries the
    // href — `.filter({ has })` would (wrongly) require the href on a descendant.
    await expect(
      page
        .getByRole('link', { name: /2023-06-22/ })
        .and(page.locator('[href="#/day/remy-2023-06-22"]')),
    ).toBeVisible();
  });

  test('captureDownload returns the exported YAML text of a seeded valid day', async ({ page }) => {
    await seedWorkspace(page, buildConfiguredWorkspaceBlob());

    // The realistic day is Valid → exportable from the animal's Validation & Export tab.
    await page.goto('/#/animal/remy/export');
    const exportButton = page.getByRole('button', { name: 'Export Valid Only' });
    await expect(exportButton).toBeVisible();
    await exportButton.click();

    // The batch-export preflight requires an explicit confirm before downloading.
    const confirmButton = page.getByRole('button', { name: /Confirm export/ });
    await expect(confirmButton).toBeVisible();

    const { filename, text } = await captureDownload(page, async () => {
      await confirmButton.click();
    });

    expect(filename).toMatch(/_remy_metadata\.yml$/);
    expect(text.length).toBeGreaterThan(0);
    expect(text).toContain('subject:');
    expect(text).toContain('remy');
  });

  test('disableAnimations registers and the picker still renders', async ({ page }) => {
    await disableAnimations(page);
    await resetWorkspace(page);

    // The injected stylesheet is present on the document.
    await expect
      .poll(() =>
        page.evaluate(
          () => document.querySelectorAll('style[data-test-disable-animations]').length,
        ),
      )
      .toBeGreaterThan(0);

    await expect(page.getByRole('heading', { name: 'Animal Workspace' })).toBeVisible();
  });
});
