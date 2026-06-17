/**
 * BASELINE E2E TEST - Import/Export Workflow
 *
 * Purpose: Document current file import/export behavior
 * - Tests YAML file import
 * - Tests YAML file export/download
 * - Tests validation during import
 * - Tests round-trip (import -> export -> import)
 *
 * IMPORTANT: This is a BASELINE test documenting current behavior.
 * Tests capture file operations as-is, including any quirks.
 *
 * FROZEN LEGACY-FORM COVERAGE — NOT A PATTERN REFERENCE. This spec targets the frozen
 * single-page legacy form, and predates the workspace QA discipline. It still uses fixed
 * `waitForTimeout` sleeps and CSS-class/attribute selectors for app controls. Do NOT copy this
 * style for new specs — see `docs/E2E_QA_RUNBOOK.md` and any `e2e/workspace-*.spec.js` for the
 * required role/accessible-name selectors and event-based waits.
 * Kept only as legacy regression coverage; a rewrite/quarantine is tracked in the runbook.
 */

import { test, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';
import yaml from 'js-yaml';

// Helper to get required fixture path.
const getFixturePath = (filename, folder = 'valid') => {
  const fixturePath = path.join(__dirname, '../../src/__tests__/fixtures', folder, filename);
  expect(fs.existsSync(fixturePath), `missing fixture: ${fixturePath}`).toBe(true);
  return fixturePath;
};

// Helper to wait for download
const waitForDownload = async (page, action) => {
  const downloadPromise = page.waitForEvent('download');
  await action();
  return await downloadPromise;
};

// Helper to dismiss alert modal if present.
//
// AlertModal now renders on the shared Modal primitive, whose overlay is a
// CSS-module class plus `data-testid="modal-overlay"`. Clicking the Close button
// is the most robust dismissal (overlay-corner clicks can be intercepted by the
// centered content box). We wait for the overlay to disappear so its pointer-events
// barrier is gone before the caller clicks anything underneath.
const dismissAlertModal = async (page) => {
  const overlaySelector = '[data-testid="modal-overlay"], .modal-overlay';
  try {
    // Wait for the shared-Modal overlay to appear
    await page.waitForSelector(overlaySelector, { state: 'visible', timeout: 2000 });

    // Prefer the explicit Close button; fall back to an overlay-corner click.
    const closeButton = page.locator('.alert-modal-close, button[aria-label="Close alert"]').first();
    if (await closeButton.isVisible().catch(() => false)) {
      await closeButton.click({ timeout: 3000 });
    } else {
      await page
        .locator(overlaySelector)
        .first()
        .click({ position: { x: 10, y: 10 }, timeout: 3000 });
    }

    // Wait for modal to completely disappear (pointer-events barrier removed)
    await page.waitForSelector(overlaySelector, { state: 'hidden', timeout: 3000 });

    // Extra wait for animations/transitions to complete and pointer events to be restored
    await page.waitForTimeout(500);
  } catch (e) {
    // Modal not present or already dismissed - this is acceptable
  }
};

const importYaml = async (page, fixturePath, settleMs = 500) => {
  const importInput = page.locator('input[type="file"]').first();
  await expect(importInput).toBeAttached({ timeout: 5000 });
  await importInput.setInputFiles(fixturePath);
  await page.waitForTimeout(settleMs);
};

const openLegacySection = async (page, label) => {
  const link = page.locator(`a:has-text("${label}")`).first();
  await expect(link).toBeVisible({ timeout: 5000 });
  await link.click();
  await page.waitForTimeout(200);
};

const exportYaml = async (page) => {
  const downloadButton = page.locator('button:has-text("Download"), button:has-text("Generate")').first();
  await expect(downloadButton).toBeVisible({ timeout: 5000 });
  return await waitForDownload(page, async () => {
    await downloadButton.click();
    await page.waitForTimeout(500);
  });
};

test.describe('BASELINE: Import/Export Workflow', () => {

  test('can import valid minimal YAML file', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('input:not([type="file"]), textarea, select').first()).toBeVisible({ timeout: 10000 });

    const fixturePath = getFixturePath('minimal-valid.yml');
    await importYaml(page, fixturePath, 1000);

    // Dismiss success modal
    await dismissAlertModal(page);

    // Verify fields were imported (minimal-valid.yml has lab: "Frank")
    // NOTE: experimenter_name array is NOT imported (baseline behavior to document)
    const labInput = page.locator('input[name*="lab"]').first();
    await expect(labInput).toBeVisible({ timeout: 5000 });
    await expect(labInput).toHaveValue('Frank');
  });

  test('can import complete YAML file', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('input:not([type="file"]), textarea, select').first()).toBeVisible({ timeout: 10000 });

    const fixturePath = getFixturePath('complete-valid.yml');
    await importYaml(page, fixturePath);

    // Dismiss success modal
    await dismissAlertModal(page);

    // Verify more complex data was imported (e.g., cameras array)
    await openLegacySection(page, 'Cameras');

    // Check if camera fields are populated
    const cameraIdInput = page.locator('input[name*="camera"][name*="id"]').first();
    await expect(cameraIdInput).toBeVisible({ timeout: 5000 });
    await expect(cameraIdInput).not.toHaveValue('');
  });

  test('can import realistic session YAML', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('input:not([type="file"]), textarea, select').first()).toBeVisible({ timeout: 10000 });

    const fixturePath = getFixturePath('realistic-session.yml');
    await importYaml(page, fixturePath, 1000);

    // Dismiss success modal
    await dismissAlertModal(page);

    // Verify complex nested data imported (electrode groups)
    await openLegacySection(page, 'Electrode Groups');

    // Check if electrode group fields are populated
    const locationInput = page.locator('input[name*="location"]').first();
    await expect(locationInput).toBeVisible({ timeout: 5000 });
    await expect(locationInput).not.toHaveValue('');
  });

  test('can export YAML file from trodes_to_nwb sample', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('input:not([type="file"]), textarea, select').first()).toBeVisible({ timeout: 10000 });

    // Import the canonical sample metadata from trodes_to_nwb repository
    // This file is tested against the Python backend and guaranteed to have all required fields
    // Source: https://github.com/LorenFrankLab/trodes_to_nwb/blob/main/src/trodes_to_nwb/tests/test_data/20230622_sample_metadata.yml
    const fixturePath = getFixturePath('20230622_sample_metadata.yml');
    await importYaml(page, fixturePath);

    // Dismiss success modal
    await dismissAlertModal(page);

    // Verify import succeeded - check session_id was populated
    const sessionIdInput = page.locator('input[name*="session_id"]').first();
    await expect(sessionIdInput).toBeVisible({ timeout: 5000 });
    await expect(sessionIdInput).toHaveValue('12345'); // session_id from sample file

    // Export the imported data
    const download = await exportYaml(page);

    // Verify export succeeded
    expect(download).toBeTruthy();
    const filename = download.suggestedFilename();
    expect(filename).toMatch(/\.yml$/);

    // Verify exported content is valid YAML with correct session_id
    const downloadPath = await download.path();
    expect(downloadPath).toBeTruthy();
    const content = fs.readFileSync(downloadPath, 'utf8');
    const parsed = yaml.load(content);
    expect(parsed).toBeTruthy();
    expect(parsed.session_id).toBe('12345');
  });

  test('documents round-trip: import -> modify -> export', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('input:not([type="file"]), textarea, select').first()).toBeVisible({ timeout: 10000 });

    // Import a complete file (minimal-valid.yml doesn't have enough fields for export validation)
    const fixturePath = getFixturePath('20230622_sample_metadata.yml');
    await importYaml(page, fixturePath);

    // Dismiss success modal
    await dismissAlertModal(page);

    // Modify a field
    const sessionIdInput = page.locator('input[name*="session_id"]').first();
    await expect(sessionIdInput).toBeVisible({ timeout: 5000 });
    await sessionIdInput.clear();
    await sessionIdInput.fill('modified_session_id');
    await expect(sessionIdInput).toHaveValue('modified_session_id');

    // Export the modified data
    const download = await exportYaml(page);

    // Verify export contains modification
    const downloadPath = await download.path();
    expect(downloadPath).toBeTruthy();
    const content = fs.readFileSync(downloadPath, 'utf8');
    const parsed = yaml.load(content);
    expect(parsed.session_id).toBe('modified_session_id');
  });

  test('documents validation errors during export attempt', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('input:not([type="file"]), textarea, select').first()).toBeVisible({ timeout: 10000 });

    // Try to export without filling required fields
    const downloadButton = page.locator('button:has-text("Download"), button:has-text("Generate")').first();
    await expect(downloadButton).toBeVisible({ timeout: 5000 });

    // Set up dialog handler BEFORE clicking (best practice)
    const dialogPromise = page.waitForEvent('dialog', { timeout: 5000 }).catch(() => null);

    await downloadButton.click();

    // Wait for dialog to appear
    const dialog = await dialogPromise;

    if (dialog) {
      // Dialog appeared - validation happened via alert
      await dialog.accept();
      expect(dialog.message()).toBeTruthy();
    } else {
      // No dialog - check for validation UI
      const validationError = page.locator('.error, .invalid, [aria-invalid="true"], input:invalid').first();
      await expect(validationError).toBeVisible({ timeout: 2000 });
    }
  });

  test('documents filename format of exported YAML', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('input:not([type="file"]), textarea, select').first()).toBeVisible({ timeout: 10000 });

    // Import a complete file to ensure we can export
    const fixturePath = getFixturePath('20230622_sample_metadata.yml');
    await importYaml(page, fixturePath);

    // Dismiss success modal
    await dismissAlertModal(page);

    // Try to export
    const download = await exportYaml(page);
    const filename = download.suggestedFilename();
    console.log(`Exported filename: ${filename}`);

    // Document filename format (should be: mmddYYYY_subjectid_metadata.yml)
    // NOTE: If input file has placeholder value, it's used literally
    expect(filename).toMatch(/.+_.+_metadata\.yml/);
  });

  test('documents behavior when importing invalid YAML', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('input:not([type="file"]), textarea, select').first()).toBeVisible({ timeout: 10000 });

    // Create a temporary invalid YAML file
    const tempDir = path.join(__dirname, '../../e2e/temp');
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }

    const invalidYamlPath = path.join(tempDir, 'invalid.yml');
    fs.writeFileSync(invalidYamlPath, 'invalid: yaml: content: [unclosed array');

    try {
      // Listen for errors/alerts
      let errorOccurred = false;
      page.on('dialog', async dialog => {
        errorOccurred = true;
        console.log(`Alert during invalid import: ${dialog.message()}`);
        await dialog.accept();
      });

      page.on('console', msg => {
        if (msg.type() === 'error') {
          errorOccurred = true;
        }
      });

      await importYaml(page, invalidYamlPath);
      const modalAppeared = await page
        .waitForSelector('.modal-overlay, .alert-modal-content', { state: 'visible', timeout: 1000 })
        .then(() => true)
        .catch(() => false);
      if (modalAppeared) errorOccurred = true;
      await page.waitForTimeout(500);

      // Dismiss error modal if present
      await dismissAlertModal(page);

      // Document that some error handling occurs
      // The app should show an error or alert
      expect(errorOccurred).toBeTruthy();
    } finally {
      fs.unlinkSync(invalidYamlPath);
    }
  });

  test('documents behavior when importing YAML with missing required fields', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('input:not([type="file"]), textarea, select').first()).toBeVisible({ timeout: 10000 });

    // Use the invalid fixture
    const fixturePath = getFixturePath('missing-required-fields.yml', 'invalid');

    // Listen for alerts/errors
    page.on('dialog', async dialog => {
      console.log(`Alert: ${dialog.message()}`);
      await dialog.accept();
    });

    await importYaml(page, fixturePath);

    const summary = page.getByRole('alertdialog', { name: /import summary - partial import/i });
    await expect(summary).toBeVisible({ timeout: 5000 });
    await expect(summary).toContainText('Import completed: 1/');
    await expect(summary).toContainText('IMPORTED (1):');
    await expect(summary).toContainText('Experimenter Name');
    await expect(summary).toContainText('EXCLUDED');
    await expect(summary).toContainText('Lab');
    await expect(summary).toContainText('Institution');

    // Dismiss the partial-import summary
    await dismissAlertModal(page);

    // The one valid field in the invalid fixture is actually imported; missing sections stay empty.
    await expect(page.getByText('Doe, John')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('input[name*="lab"]').first()).toHaveValue('');
  });
});
