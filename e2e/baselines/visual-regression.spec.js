/**
 * BASELINE E2E TEST - Visual Regression
 *
 * Purpose: Document current UI appearance and layout
 * - Captures screenshots of key UI states
 * - Detects unintended visual changes during refactoring
 * - Uses Playwright's built-in screenshot comparison
 *
 * IMPORTANT: This is a BASELINE test documenting current behavior.
 * Screenshots capture the UI as-is, including any existing UI quirks.
 */

import { test, expect } from '@playwright/test';

// Configure for deterministic screenshots
test.use({
  viewport: { width: 1280, height: 720 },
  deviceScaleFactor: 1,
});

// Helper to wait for app to load
const waitForAppLoad = async (page) => {
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(1000); // Give React time to render

  // Disable animations for consistent screenshots
  await page.addStyleTag({
    content: '*, *::before, *::after { animation-duration: 0s !important; transition-duration: 0s !important; }'
  });
};

test.describe('BASELINE: Visual Regression', () => {

  test('captures initial form state (empty form)', async ({ page }) => {
    await page.goto('/');
    await waitForAppLoad(page);

    // Take full page screenshot
    await expect(page).toHaveScreenshot('01-initial-empty-form.png', {
      fullPage: true,
      animations: 'disabled',
    });
  });

  test('captures top section (experimenter, session info)', async ({ page }) => {
    await page.goto('/');
    await waitForAppLoad(page);

    // Scroll to top section
    await page.evaluate(() => window.scrollTo(0, 0));

    await expect(page).toHaveScreenshot('02-experimenter-section.png', {
      fullPage: true,
      animations: 'disabled',
    });
  });

  test('captures subject section', async ({ page }) => {
    await page.goto('/');
    await waitForAppLoad(page);

    // Find and click subject section link if it exists
    const subjectLink = page.locator('a:has-text("Subject")').first();
    if (await subjectLink.isVisible().catch(() => false)) {
      await subjectLink.click();
      await page.waitForTimeout(300);
    }

    await expect(page).toHaveScreenshot('03-subject-section.png', {
      fullPage: true,
      animations: 'disabled',
    });
  });

  test('captures electrode groups section (empty)', async ({ page }) => {
    await page.goto('/');
    await waitForAppLoad(page);

    // Navigate to electrode groups
    const electrodeLink = page.locator('a:has-text("Electrode Groups")').first();
    if (await electrodeLink.isVisible().catch(() => false)) {
      await electrodeLink.click();
      await page.waitForTimeout(300);
    }

    await expect(page).toHaveScreenshot('04-electrode-groups-empty.png', {
      fullPage: true,
      animations: 'disabled',
    });
  });

  test('captures camera section (empty)', async ({ page }) => {
    await page.goto('/');
    await waitForAppLoad(page);

    // Navigate to cameras
    const cameraLink = page.locator('a:has-text("Cameras")').first();
    if (await cameraLink.isVisible().catch(() => false)) {
      await cameraLink.click();
      await page.waitForTimeout(300);
    }

    await expect(page).toHaveScreenshot('05-cameras-empty.png', {
      fullPage: true,
      animations: 'disabled',
    });
  });

  test('captures task section (empty)', async ({ page }) => {
    await page.goto('/');
    await waitForAppLoad(page);

    // Navigate to tasks
    const taskLink = page.locator('a:has-text("Tasks")').first();
    if (await taskLink.isVisible().catch(() => false)) {
      await taskLink.click();
      await page.waitForTimeout(300);
    }

    await expect(page).toHaveScreenshot('06-tasks-empty.png', {
      fullPage: true,
      animations: 'disabled',
    });
  });

  test('captures validation error state', async ({ page }) => {
    await page.goto('/');
    await waitForAppLoad(page);

    // Try to download without filling required fields
    const downloadButton = page.locator('button:has-text("Download"), button:has-text("Generate")').first();
    if (await downloadButton.isVisible().catch(() => false)) {
      // Handle any alert dialogs
      page.on('dialog', dialog => dialog.accept());

      await downloadButton.click();

      // Wait for validation to run and errors to appear
      await page.waitForTimeout(1000);

      // Take screenshot showing validation errors
      await expect(page).toHaveScreenshot('07-validation-errors.png', {
        fullPage: true,
        animations: 'disabled',
      });
    }
  });

  test('captures navigation sidebar', async ({ page }) => {
    await page.goto('/');
    await waitForAppLoad(page);

    // Find the navigation sidebar
    const nav = page.locator('nav').first();
    if (await nav.isVisible().catch(() => false)) {
      // Take screenshot of just the navigation area
      await expect(nav).toHaveScreenshot('08-navigation-sidebar.png', {
        animations: 'disabled',
      });
    }
  });
});
