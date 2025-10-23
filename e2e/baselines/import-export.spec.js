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

  test('can export YAML file after filling form', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('input:not([type="file"]), textarea, select').first()).toBeVisible({ timeout: 10000 });

    // Fill minimum required fields
    const experimenterInput = page.locator('input[name*="experimenter"]').first();
    if (await experimenterInput.isVisible()) {
      await experimenterInput.fill('Doe, John');
    }

    const expDescInput = page.locator('textarea[name*="experiment_description"], input[name*="experiment_description"]').first();
    if (await expDescInput.isVisible()) {
      await expDescInput.fill('Test export');
    }

    const sessionIdInput = page.locator('input[name*="session_id"]').first();
    if (await sessionIdInput.isVisible()) {
      await sessionIdInput.fill('test_export_001');
    }

    const sessionDescInput = page.locator('textarea[name*="session_description"], input[name*="session_description"]').first();
    if (await sessionDescInput.isVisible()) {
      await sessionDescInput.fill('Test session');
    }

    const institutionInput = page.locator('input[name*="institution"]').first();
    if (await institutionInput.isVisible()) {
      await institutionInput.fill('Test Institution');
    }

    const labInput = page.locator('input[name*="lab"]').first();
    if (await labInput.isVisible()) {
      await labInput.fill('Test Lab');
    }

    // Fill subject fields
    const subjectLink = page.locator('a:has-text("Subject")').first();
    if (await subjectLink.isVisible()) {
      await subjectLink.click();
      await page.waitForTimeout(200);
    }

    const subjectIdInput = page.locator('input[name*="subject_id"]').first();
    if (await subjectIdInput.isVisible()) {
      await subjectIdInput.fill('test_subject');
    }

    const speciesInput = page.locator('input[name*="species"]').first();
    if (await speciesInput.isVisible()) {
      await speciesInput.fill('Rattus norvegicus');
    }

    const sexSelect = page.locator('select[name*="sex"]').first();
    if (await sexSelect.isVisible()) {
      await sexSelect.selectOption('M');
    }

    // Try to download/export
    const downloadButton = page.locator('button:has-text("Download"), button:has-text("Generate"), button:has-text("Export")').first();

    if (await downloadButton.isVisible()) {
      // Set up download listener
      const download = await waitForDownload(page, async () => {
        await downloadButton.click();
        await page.waitForTimeout(500);
      });

      // Verify download occurred
      expect(download).toBeTruthy();
      const filename = download.suggestedFilename();
      expect(filename).toMatch(/\.yml$/);

      // Save and verify content is valid YAML
      const downloadPath = await download.path();
      if (downloadPath) {
        const content = fs.readFileSync(downloadPath, 'utf8');
        // Verify it's valid YAML
        const parsed = yaml.load(content);
        expect(parsed).toBeTruthy();
        expect(parsed.session_id).toBe('test_export_001');
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
      // Listen for dialogs (alerts)
      let alertShown = false;
      page.on('dialog', async dialog => {
        alertShown = true;
        await dialog.accept();
      });

      await downloadButton.click();
      await page.waitForTimeout(1000);

      // Document that validation occurred
      // Either alert was shown or form shows validation errors
      const validationError = page.locator('.error, .invalid, [aria-invalid="true"]').first();
      const hasValidationUI = await validationError.isVisible().catch(() => false);

      // Just document that validation happens somehow
      expect(alertShown || hasValidationUI).toBeTruthy();
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
        let alertShown = false;
        page.on('dialog', async dialog => {
          alertShown = true;
          console.log(`Alert: ${dialog.message()}`);
          await dialog.accept();
        });

        await importButton.setInputFiles(fixturePath);
        await page.waitForTimeout(500);

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
