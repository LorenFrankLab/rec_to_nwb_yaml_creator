/**
 * E2E: Workspace persistence (save & reload).
 *
 * Guards the data-loss fix: creating an animal autosaves the workspace to
 * localStorage, and a full page reload restores it. If this regresses, the new
 * multi-page UI silently loses work on refresh.
 */

import { test, expect } from '@playwright/test';
import { STORAGE_KEY, resetWorkspace, createAnimalViaUI } from './helpers/workspace.js';

test.describe('Workspace persistence', () => {
  test('creating an animal autosaves and survives a full reload', async ({ page }) => {
    // Start clean (clears storage + re-hydrates an empty store via a fresh document).
    await resetWorkspace(page);

    // Create a valid animal through the real UI. The shared harness fills the full
    // currently-required set (Subject ID, Date of Birth, Weight, Experimenter 1, and
    // Lab/Institution — empty on a fresh store) and waits for the create to land.
    const { animalId } = await createAnimalViaUI(page, { subjectId: 'e2erat' });

    // Lands on the new animal's route and shows its id.
    await expect(page).toHaveURL(new RegExp(`#/animal/${animalId}/days`));
    await expect(page.getByText(animalId).first()).toBeVisible();

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
      .toContain(animalId);

    // Full reload (fresh document → store re-initializes and hydrates from storage).
    await page.goto('/#/workspace');
    await expect(page.getByText(animalId).first()).toBeVisible();
  });
});
