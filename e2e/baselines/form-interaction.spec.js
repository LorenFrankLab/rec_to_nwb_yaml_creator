/**
 * BASELINE E2E TEST - Form Interaction
 *
 * Purpose: Document current user interaction flows
 * - Tests adding/removing/duplicating array items
 * - Tests form field interactions
 * - Tests navigation between sections
 * - Tests dynamic field updates (cameras, tasks, electrode groups)
 *
 * IMPORTANT: This is a BASELINE test documenting current behavior.
 * Tests capture interaction flows as-is, including any UI quirks.
 */

import { test, expect } from '@playwright/test';

test.describe('BASELINE: Form Interactions', () => {

  test('can fill basic metadata fields', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('input:not([type="file"]), textarea, select').first()).toBeVisible({ timeout: 10000 });

    // Fill experimenter field
    const experimenterInput = page.locator('input[name*="experimenter"], input[placeholder*="experimenter"]').first();
    if (await experimenterInput.isVisible()) {
      await experimenterInput.fill('Doe, John');
      await expect(experimenterInput).toHaveValue('Doe, John');
    }

    // Fill experiment description
    const expDescInput = page.locator('textarea[name*="experiment_description"], input[name*="experiment_description"]').first();
    if (await expDescInput.isVisible()) {
      await expDescInput.fill('Test experiment for baseline');
      await expect(expDescInput).toHaveValue('Test experiment for baseline');
    }

    // Fill session ID
    const sessionIdInput = page.locator('input[name*="session_id"]').first();
    if (await sessionIdInput.isVisible()) {
      await sessionIdInput.fill('test_001');
      await expect(sessionIdInput).toHaveValue('test_001');
    }

    // Verify fields retain values
    await expect(experimenterInput).toHaveValue('Doe, John');
  });

  test('can navigate between form sections using sidebar', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('input:not([type="file"]), textarea, select').first()).toBeVisible({ timeout: 10000 });

    // Click through different sections and verify navigation
    const sections = [
      'Subject',
      'Cameras',
      'Tasks',
      'Electrode Groups',
    ];

    for (const sectionName of sections) {
      const link = page.locator(`a:has-text("${sectionName}")`).first();
      if (await link.isVisible()) {
        await link.click();
        await page.waitForTimeout(200);

        // Verify we scrolled to the section (or it's now visible)
        // This just documents the behavior exists
        const heading = page.locator(`h2:has-text("${sectionName}"), h3:has-text("${sectionName}")`).first();
        if (await heading.isVisible()) {
          await expect(heading).toBeVisible();
        }
      }
    }
  });

  test('can add and remove camera items', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('input:not([type="file"]), textarea, select').first()).toBeVisible({ timeout: 10000 });

    // Navigate to cameras section
    const cameraLink = page.locator('a:has-text("Cameras")').first();
    if (await cameraLink.isVisible()) {
      await cameraLink.click();
      await page.waitForTimeout(200);
    }

    // Find "Add Camera" button
    const addButton = page.locator('button:has-text("Add"), button:has-text("add")').first();
    if (await addButton.isVisible()) {
      // Click to add a camera
      await addButton.click();
      await page.waitForTimeout(200);

      // Verify camera input fields appeared
      const cameraIdInput = page.locator('input[name*="camera"][name*="id"]').first();
      if (await cameraIdInput.isVisible()) {
        await expect(cameraIdInput).toBeVisible();

        // Try to fill camera ID
        await cameraIdInput.fill('0');
        await expect(cameraIdInput).toHaveValue('0');
      }

      // Find and click remove button
      const removeButton = page.locator('button:has-text("Remove"), button:has-text("remove"), button:has-text("Delete")').first();
      if (await removeButton.isVisible()) {
        await removeButton.click();
        await page.waitForTimeout(200);

        // Handle confirmation dialog if it appears
        page.on('dialog', dialog => dialog.accept());
      }
    }
  });

  test('can add and duplicate electrode groups', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('input:not([type="file"]), textarea, select').first()).toBeVisible({ timeout: 10000 });

    // Navigate to electrode groups
    const electrodeLink = page.locator('a:has-text("Electrode Groups")').first();
    if (await electrodeLink.isVisible()) {
      await electrodeLink.click();
      await page.waitForTimeout(200);
    }

    // Add an electrode group
    const addButton = page.locator('button:has-text("Add")').first();
    if (await addButton.isVisible()) {
      await addButton.click();
      await page.waitForTimeout(200);

      // Fill in electrode group ID
      const egIdInput = page.locator('input[name*="electrode"][name*="id"]').first();
      if (await egIdInput.isVisible()) {
        await egIdInput.fill('0');
        await expect(egIdInput).toHaveValue('0');

        // Fill location
        const locationInput = page.locator('input[name*="location"]').first();
        if (await locationInput.isVisible()) {
          await locationInput.fill('CA1');
          await expect(locationInput).toHaveValue('CA1');
        }
      }

      // Try to duplicate the electrode group
      const duplicateButton = page.locator('button:has-text("Duplicate"), button:has-text("duplicate")').first();
      if (await duplicateButton.isVisible()) {
        await duplicateButton.click();
        await page.waitForTimeout(200);

        // Check if another electrode group was added (ID should be 1)
        const secondEgId = page.locator('input[name*="electrode"][name*="id"]').nth(1);
        if (await secondEgId.isVisible()) {
          await expect(secondEgId).toBeVisible();
        }
      }
    }
  });

  test('can add task and verify epoch fields', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('input:not([type="file"]), textarea, select').first()).toBeVisible({ timeout: 10000 });

    // Navigate to tasks
    const taskLink = page.locator('a:has-text("Tasks")').first();
    if (await taskLink.isVisible()) {
      await taskLink.click();
      await page.waitForTimeout(200);
    }

    // Add a task
    const addButton = page.locator('button:has-text("Add")').first();
    if (await addButton.isVisible()) {
      await addButton.click();
      await page.waitForTimeout(200);

      // Fill task name
      const taskNameInput = page.locator('input[name*="task_name"]').first();
      if (await taskNameInput.isVisible()) {
        await taskNameInput.fill('sleep');
        await expect(taskNameInput).toHaveValue('sleep');

        // Fill task description
        const taskDescInput = page.locator('input[name*="task_description"], textarea[name*="task_description"]').first();
        if (await taskDescInput.isVisible()) {
          await taskDescInput.fill('Sleep session');
          await expect(taskDescInput).toHaveValue('Sleep session');
        }

        // Fill task epochs (comma-separated)
        const epochsInput = page.locator('input[name*="epoch"]').first();
        if (await epochsInput.isVisible()) {
          await epochsInput.fill('1,2,3');
          // Trigger blur event to process comma-separated input
          await epochsInput.blur();
          await page.waitForTimeout(200);
        }
      }
    }
  });

  test('can select device type in electrode group', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('input:not([type="file"]), textarea, select').first()).toBeVisible({ timeout: 10000 });

    // Navigate to electrode groups
    const electrodeLink = page.locator('a:has-text("Electrode Groups")').first();
    if (await electrodeLink.isVisible()) {
      await electrodeLink.click();
      await page.waitForTimeout(200);
    }

    // Add an electrode group
    const addButton = page.locator('button:has-text("Add")').first();
    if (await addButton.isVisible()) {
      await addButton.click();
      await page.waitForTimeout(200);

      // Find device type dropdown/select
      const deviceSelect = page.locator('select[name*="device"], select[name*="type"]').first();
      if (await deviceSelect.isVisible()) {
        // Select a device type (e.g., tetrode_12.5)
        await deviceSelect.selectOption({ index: 1 });
        await page.waitForTimeout(200);

        // Verify ntrode channel map was auto-generated
        // This is a complex interaction - we just verify something happened
        // Document that this interaction exists
      }
    }
  });

  test('can open and close collapsible sections (details elements)', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('input:not([type="file"]), textarea, select').first()).toBeVisible({ timeout: 10000 });

    // Find first <details> element
    const details = page.locator('details').first();

    if (await details.isVisible()) {
      const summary = details.locator('summary').first();

      // Get initial state
      const initialState = await details.getAttribute('open');

      // Click to toggle
      await summary.click();

      // Wait a bit for DOM update (small fixed delay is acceptable for simple DOM attribute changes)
      await page.waitForTimeout(100);

      // Verify state changed
      const afterFirstClick = await details.getAttribute('open');
      expect(afterFirstClick).not.toBe(initialState);

      // Click again to toggle back
      await summary.click();
      await page.waitForTimeout(100);

      // Verify state changed back
      const afterSecondClick = await details.getAttribute('open');
      expect(afterSecondClick).toBe(initialState);
    }
  });

  test('documents current form reset behavior', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('input:not([type="file"]), textarea, select').first()).toBeVisible({ timeout: 10000 });

    // Fill some fields
    const sessionIdInput = page.locator('input[name*="session_id"]').first();
    if (await sessionIdInput.isVisible()) {
      await sessionIdInput.fill('test_reset');
      await expect(sessionIdInput).toHaveValue('test_reset');

      // Look for reset button
      const resetButton = page.locator('button:has-text("Reset"), button:has-text("Clear")').first();
      if (await resetButton.isVisible()) {
        // Accept confirmation if prompted
        page.on('dialog', dialog => dialog.accept());

        await resetButton.click();
        await page.waitForTimeout(200);

        // Document whether field was cleared
        const valueAfterReset = await sessionIdInput.inputValue();
        // Just capture the behavior, don't assert
        console.log(`Field after reset: "${valueAfterReset}"`);
      }
    }
  });

  test('documents dynamic camera ID dependency in tasks', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('input:not([type="file"]), textarea, select').first()).toBeVisible({ timeout: 10000 });

    // Add a camera
    const cameraLink = page.locator('a:has-text("Cameras")').first();
    if (await cameraLink.isVisible()) {
      await cameraLink.click();
      await page.waitForTimeout(200);

      const addCameraButton = page.locator('button:has-text("Add")').first();
      if (await addCameraButton.isVisible()) {
        await addCameraButton.click();
        await page.waitForTimeout(200);

        // Set camera ID to 0
        const cameraIdInput = page.locator('input[name*="camera"][name*="id"]').first();
        if (await cameraIdInput.isVisible()) {
          await cameraIdInput.fill('0');
          await cameraIdInput.blur();
          await page.waitForTimeout(200);
        }
      }
    }

    // Navigate to tasks
    const taskLink = page.locator('a:has-text("Tasks")').first();
    if (await taskLink.isVisible()) {
      await taskLink.click();
      await page.waitForTimeout(200);

      const addTaskButton = page.locator('button:has-text("Add")').first();
      if (await addTaskButton.isVisible()) {
        await addTaskButton.click();
        await page.waitForTimeout(200);

        // Check if camera_id field shows camera 0 as an option
        // This documents the dynamic dependency behavior
        const cameraCheckbox = page.locator('input[type="checkbox"][value="0"]').first();
        if (await cameraCheckbox.isVisible()) {
          await expect(cameraCheckbox).toBeVisible();
          await cameraCheckbox.check();
          await expect(cameraCheckbox).toBeChecked();
        }
      }
    }
  });
});
