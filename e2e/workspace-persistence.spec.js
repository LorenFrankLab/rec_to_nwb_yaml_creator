/**
 * E2E: Workspace persistence (save & reload).
 *
 * Guards the data-loss fix: creating an animal autosaves the workspace to
 * localStorage, and a full page reload restores it. If this regresses, the new
 * multi-page UI silently loses work on refresh.
 */

import { test, expect } from '@playwright/test';

const STORAGE_KEY = 'rec_to_nwb_workspace_v1';

test.describe('Workspace persistence', () => {
  test('creating an animal autosaves and survives a full reload', async ({ page }) => {
    // Start clean.
    await page.goto('/#/home');
    await page.evaluate((key) => window.localStorage.removeItem(key), STORAGE_KEY);
    await page.reload();
    await page.goto('/#/home');

    // Fill the required fields (species/sex/genotype/lab/institution have defaults).
    await page.getByRole('textbox', { name: 'Subject ID *' }).fill('e2erat');
    await page.getByRole('textbox', { name: 'Date of Birth *' }).fill('2023-01-01');
    await page.getByRole('textbox', { name: /Experimenter 1/ }).fill('Doe, Jane');

    const createButton = page.getByRole('button', { name: 'Create Animal' });
    await expect(createButton).toBeEnabled();
    await createButton.click();

    // Lands on the workspace with the new animal.
    await expect(page).toHaveURL(/#\/workspace/);
    await expect(page.getByText('e2erat').first()).toBeVisible();

    // The debounced autosave writes a version-gated blob containing the animal.
    await expect
      .poll(async () =>
        page.evaluate((key) => {
          const raw = window.localStorage.getItem(key);
          if (!raw) return null;
          const blob = JSON.parse(raw);
          return Object.keys(blob.workspace?.animals ?? {});
        }, STORAGE_KEY),
      )
      .toContain('e2erat');

    // Full reload (fresh document → store re-initializes and hydrates from storage).
    await page.goto('/#/workspace');
    await expect(page.getByText('e2erat').first()).toBeVisible();
  });
});
