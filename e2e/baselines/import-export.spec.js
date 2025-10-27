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
 */

import { test, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';
import yaml from 'js-yaml';

// Helper to get fixture path
const getFixturePath = (filename) => {
  return path.join(__dirname, '../../src/__tests__/fixtures/valid', filename);
};

// Helper to wait for download
const waitForDownload = async (page, action) => {
  const downloadPromise = page.waitForEvent('download');
  await action();
  return await downloadPromise;
};

// Helper to dismiss alert modal if present
const dismissAlertModal = async (page) => {
  try {
    // Wait a bit for modal animation
    await page.waitForTimeout(300);

    // Try multiple selectors to find and dismiss the modal
    const selectors = [
      'button.alert-modal-close',
      'button[aria-label="Close alert"]',
      '.alert-modal-overlay' // Click overlay to dismiss
    ];

    for (const selector of selectors) {
      try {
        const element = page.locator(selector).first();
        if (await element.isVisible({ timeout: 500 })) {
          await element.click({ timeout: 1000 });
          await page.waitForTimeout(300);
          return;
        }
      } catch {
        continue;
      }
    }
  } catch (e) {
    // Modal not present or already dismissed
  }
};

test.describe('BASELINE: Import/Export Workflow', () => {

  test('can import valid minimal YAML file', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('input:not([type="file"]), textarea, select').first()).toBeVisible({ timeout: 10000 });

    // Find import/upload button
    const importButton = page.locator('input[type="file"], button:has-text("Import"), button:has-text("Upload")').first();

    if (await importButton.isVisible()) {
      // Load fixture file
      const fixturePath = getFixturePath('minimal-valid.yml');

      if (fs.existsSync(fixturePath)) {
        // Upload the file
        await importButton.setInputFiles(fixturePath);
        await page.waitForTimeout(500);

        // Dismiss success modal
        await dismissAlertModal(page);

        // Verify some fields were populated
        const sessionIdInput = page.locator('input[name*="session_id"]').first();
        if (await sessionIdInput.isVisible()) {
          const value = await sessionIdInput.inputValue();
          // Just verify it has some value (documenting import worked)
          expect(value).not.toBe('');
        }
      }
    }
  });

  test('can import complete YAML file', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('input:not([type="file"]), textarea, select').first()).toBeVisible({ timeout: 10000 });

    const importButton = page.locator('input[type="file"]').first();

    if (await importButton.isVisible()) {
      const fixturePath = getFixturePath('complete-valid.yml');

      if (fs.existsSync(fixturePath)) {
        await importButton.setInputFiles(fixturePath);
        await page.waitForTimeout(500);

        // Dismiss success modal
        await dismissAlertModal(page);

        // Verify more complex data was imported (e.g., cameras array)
        const cameraLink = page.locator('a:has-text("Cameras")').first();
        if (await cameraLink.isVisible()) {
          await cameraLink.click();
          await page.waitForTimeout(200);

          // Check if camera fields are populated
          const cameraIdInput = page.locator('input[name*="camera"][name*="id"]').first();
          if (await cameraIdInput.isVisible()) {
            const value = await cameraIdInput.inputValue();
            expect(value).not.toBe('');
          }
        }
      }
    }
  });

  test('can import realistic session YAML', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('input:not([type="file"]), textarea, select').first()).toBeVisible({ timeout: 10000 });

    const importButton = page.locator('input[type="file"]').first();

    if (await importButton.isVisible()) {
      const fixturePath = getFixturePath('realistic-session.yml');

      if (fs.existsSync(fixturePath)) {
        await importButton.setInputFiles(fixturePath);
        await page.waitForTimeout(1000);

        // Dismiss success modal
        await dismissAlertModal(page);

        // Verify complex nested data imported (electrode groups)
        const electrodeLink = page.locator('a:has-text("Electrode Groups")').first();
        if (await electrodeLink.isVisible()) {
          await electrodeLink.click();
          await page.waitForTimeout(200);

          // Check if electrode group fields are populated
          const locationInput = page.locator('input[name*="location"]').first();
          if (await locationInput.isVisible()) {
            const value = await locationInput.inputValue();
            expect(value).not.toBe('');
          }
        }
      }
    }
  });

  test('can export YAML file from trodes_to_nwb sample', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('input:not([type="file"]), textarea, select').first()).toBeVisible({ timeout: 10000 });

    // Import the canonical sample metadata from trodes_to_nwb repository
    // This file is tested against the Python backend and guaranteed to have all required fields
    // Source: https://github.com/LorenFrankLab/trodes_to_nwb/blob/main/src/trodes_to_nwb/tests/test_data/20230622_sample_metadata.yml
    const importButton = page.locator('input[type="file"]').first();
    if (await importButton.isVisible()) {
      const fixturePath = getFixturePath('20230622_sample_metadata.yml');

      if (fs.existsSync(fixturePath)) {
        await importButton.setInputFiles(fixturePath);
        await page.waitForTimeout(500);

        // Dismiss success modal
        await dismissAlertModal(page);

        // Verify import succeeded - check session_id was populated
        const sessionIdInput = page.locator('input[name*="session_id"]').first();
        if (await sessionIdInput.isVisible()) {
          const value = await sessionIdInput.inputValue();
          expect(value).toBe('12345'); // session_id from sample file
        }

        // Export the imported data
        const downloadButton = page.locator('button:has-text("Download"), button:has-text("Generate")').first();
        if (await downloadButton.isVisible()) {
          const download = await waitForDownload(page, async () => {
            await downloadButton.click();
            await page.waitForTimeout(500);
          });

          // Verify export succeeded
          expect(download).toBeTruthy();
          const filename = download.suggestedFilename();
          expect(filename).toMatch(/\.yml$/);

          // Verify exported content is valid YAML with correct session_id
          const downloadPath = await download.path();
          if (downloadPath) {
            const content = fs.readFileSync(downloadPath, 'utf8');
            const parsed = yaml.load(content);
            expect(parsed).toBeTruthy();
            expect(parsed.session_id).toBe('12345');
          }
        }
      }
    }
  });

  test('documents round-trip: import -> modify -> export', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('input:not([type="file"]), textarea, select').first()).toBeVisible({ timeout: 10000 });

    // Import a file
    const importButton = page.locator('input[type="file"]').first();
    if (await importButton.isVisible()) {
      const fixturePath = getFixturePath('minimal-valid.yml');

      if (fs.existsSync(fixturePath)) {
        await importButton.setInputFiles(fixturePath);
        await page.waitForTimeout(500);

        // Dismiss success modal
        await dismissAlertModal(page);

        // Modify a field
        const sessionIdInput = page.locator('input[name*="session_id"]').first();
        if (await sessionIdInput.isVisible()) {
          await sessionIdInput.clear();
          await sessionIdInput.fill('modified_session_id');
          await expect(sessionIdInput).toHaveValue('modified_session_id');
        }

        // Export the modified data
        const downloadButton = page.locator('button:has-text("Download"), button:has-text("Generate")').first();
        if (await downloadButton.isVisible()) {
          const download = await waitForDownload(page, async () => {
            await downloadButton.click();
            await page.waitForTimeout(500);
          });

          // Verify export contains modification
          const downloadPath = await download.path();
          if (downloadPath) {
            const content = fs.readFileSync(downloadPath, 'utf8');
            const parsed = yaml.load(content);
            expect(parsed.session_id).toBe('modified_session_id');
          }
        }
      }
    }
  });

  test('documents validation errors during export attempt', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('input:not([type="file"]), textarea, select').first()).toBeVisible({ timeout: 10000 });

    // Try to export without filling required fields
    const downloadButton = page.locator('button:has-text("Download"), button:has-text("Generate")').first();

    if (await downloadButton.isVisible()) {
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
    }
  });

  test('documents filename format of exported YAML', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('input:not([type="file"]), textarea, select').first()).toBeVisible({ timeout: 10000 });

    // Import a complete file to ensure we can export
    const importButton = page.locator('input[type="file"]').first();
    if (await importButton.isVisible()) {
      const fixturePath = getFixturePath('complete-valid.yml');

      if (fs.existsSync(fixturePath)) {
        await importButton.setInputFiles(fixturePath);
        await page.waitForTimeout(500);

        // Dismiss success modal
        await dismissAlertModal(page);

        // Try to export
        const downloadButton = page.locator('button:has-text("Download"), button:has-text("Generate")').first();
        if (await downloadButton.isVisible()) {
          const download = await waitForDownload(page, async () => {
            await downloadButton.click();
            await page.waitForTimeout(500);
          });

          const filename = download.suggestedFilename();
          console.log(`Exported filename: ${filename}`);

          // Document filename format (should be: mmddYYYY_subjectid_metadata.yml)
          expect(filename).toMatch(/\d{8}_.+_metadata\.yml/);
        }
      }
    }
  });

  test('documents behavior when importing invalid YAML', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('input:not([type="file"]), textarea, select').first()).toBeVisible({ timeout: 10000 });

    const importButton = page.locator('input[type="file"]').first();

    if (await importButton.isVisible()) {
      // Create a temporary invalid YAML file
      const tempDir = path.join(__dirname, '../../e2e/temp');
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
      }

      const invalidYamlPath = path.join(tempDir, 'invalid.yml');
      fs.writeFileSync(invalidYamlPath, 'invalid: yaml: content: [unclosed array');

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

      await importButton.setInputFiles(invalidYamlPath);
      await page.waitForTimeout(500);

      // Dismiss error modal if present
      await dismissAlertModal(page);

      // Document that some error handling occurs
      // The app should show an error or alert
      expect(errorOccurred).toBeTruthy();

      // Cleanup
      fs.unlinkSync(invalidYamlPath);
    }
  });

  test('documents behavior when importing YAML with missing required fields', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('input:not([type="file"]), textarea, select').first()).toBeVisible({ timeout: 10000 });

    const importButton = page.locator('input[type="file"]').first();

    if (await importButton.isVisible()) {
      // Use the invalid fixture
      const fixturePath = path.join(__dirname, '../../src/__tests__/fixtures/invalid', 'missing-required-fields.yml');

      // Create the file if it doesn't exist
      if (!fs.existsSync(fixturePath)) {
        const dirPath = path.dirname(fixturePath);
        if (!fs.existsSync(dirPath)) {
          fs.mkdirSync(dirPath, { recursive: true });
        }

        const invalidData = {
          experimenter: ['Doe, John'],
          session_description: 'Missing required fields'
        };
        fs.writeFileSync(fixturePath, yaml.dump(invalidData));
      }

      if (fs.existsSync(fixturePath)) {
        // Listen for alerts/errors
        page.on('dialog', async dialog => {
          console.log(`Alert: ${dialog.message()}`);
          await dialog.accept();
        });

        await importButton.setInputFiles(fixturePath);
        await page.waitForTimeout(500);

        // Dismiss any alert modal
        await dismissAlertModal(page);

        // Document behavior: app may show alert, or may partially import valid fields
        // Just capture what happens
        const sessionIdInput = page.locator('input[name*="session_id"]').first();
        if (await sessionIdInput.isVisible()) {
          const value = await sessionIdInput.inputValue();
          console.log(`Session ID after importing invalid YAML: "${value}"`);
        }
      }
    }
  });
});
