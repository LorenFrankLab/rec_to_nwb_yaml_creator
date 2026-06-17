/**
 * E2E: the epoch-editor redesign — the core flow, the recovery-review surface, and a real-browser
 * accessibility (axe) pass over every redesigned route (epoch-editor Phase 8).
 *
 * Three concerns:
 *   1. core flow — Animals home → animal → day editor → epoch-grid drill-in → export preview;
 *   2. recovery review — the load-notice banner routes to #/recovery, which renders the needs-review
 *      records and runs their (existing) repair commands; a recovered-unlinked day re-links and drops
 *      out of the list;
 *   3. accessibility — @axe-core/playwright finds zero violations on the new/redesigned routes, and the
 *      epoch caret + the failed-channels checkbox grid are keyboard-operable (the standing acceptance
 *      criteria from the mockup reviews).
 *
 * Discipline (mirrors the suite): role/accessible-name or route selectors only (never CSS class for
 * app controls); wait on locators/URLs (never fixed sleeps); each test resets/seeds its own state.
 */

import { test, expect } from '@playwright/test';
import { AxeBuilder } from '@axe-core/playwright';
import {
  STORAGE_KEY,
  ANIMAL_ID,
  DAY_ID,
  seedWorkspace,
  seedAndOpen,
  buildConfiguredWorkspaceBlob,
  disableAnimations,
} from './helpers/workspace.js';

/**
 * Run axe against the page's main content and assert zero violations. Scoped to `#main-content` so a
 * pre-existing chrome issue (outside this phase's surfaces) can't mask a real finding on the surface
 * under test; the message lists the offending rule ids for a fast triage.
 *
 * @param {import('@playwright/test').Page} page - The Playwright page.
 * @param {string} label - The surface name, for the failure message.
 * @returns {Promise<void>}
 */
async function expectAxeClean(page, label) {
  const results = await new AxeBuilder({ page }).include('#main-content').analyze();
  const ids = results.violations.map((v) => `${v.id} (${v.nodes.length})`);
  expect(results.violations, `axe violations on ${label}: ${ids.join(', ')}`).toEqual([]);
}

test.beforeEach(async ({ page }) => {
  await disableAnimations(page);
});

test.describe('redesign — core flow', () => {
  test('Animals home → animal → day editor → epoch drill-in → export preview', async ({ page }) => {
    await seedWorkspace(page, buildConfiguredWorkspaceBlob());

    // Animals home: the animal is a link to its tabbed view.
    const animalLink = page.getByRole('link', { name: ANIMAL_ID });
    await expect(animalLink).toBeVisible();
    await animalLink.click();
    await expect(page).toHaveURL(new RegExp(`#/animal/${ANIMAL_ID}/days`));

    // Open the recording day from the day list (the date is a real link).
    await page.getByRole('link', { name: /2023-06-22/ }).first().click();
    await expect(page).toHaveURL(new RegExp(`#/day/${DAY_ID}`));
    await expect(page.getByRole('heading', { level: 1, name: /Day Editor/ })).toBeVisible();

    // Epochs tab: drill into an epoch via its caret (keyboard-operable disclosure button).
    await page.getByRole('button', { name: /^Epochs$/i }).click();
    const caret = page.getByRole('button', { name: /toggle epoch .* details/i }).first();
    await expect(caret).toBeVisible();
    await expect(caret).toHaveAttribute('aria-expanded', 'false');
    await caret.click();
    await expect(caret).toHaveAttribute('aria-expanded', 'true');

    // Export preview: the YAML preview renders for the configured day.
    await page.getByRole('button', { name: /^Export$/i }).click();
    await expect(page.getByText(/subject_id/).first()).toBeVisible();
  });
});

test.describe('redesign — recovery review', () => {
  test('the load-notice banner routes to the recovery screen', async ({ page }) => {
    // A blob missing a required top-level section hydrates with a `recovered` notice (the section is
    // restored to empty) — the banner surfaces it.
    const blob = buildConfiguredWorkspaceBlob();
    delete blob.workspace.settings;
    await page.goto('/#/workspace');
    await page.evaluate(
      ([key, value]) => window.localStorage.setItem(key, value),
      [STORAGE_KEY, JSON.stringify(blob)]
    );
    await page.reload();

    const review = page.getByRole('link', { name: /review recovered data/i });
    await expect(review).toBeVisible();
    await review.click();
    await expect(page).toHaveURL(/#\/recovery/);
    await expect(page.getByRole('heading', { name: /review recovered data/i })).toBeVisible();
    // The auto-recovered FYI notice is shown on the screen (scoped to the main content — the same
    // string also appears in the chrome banner, so an unscoped match would be ambiguous).
    await expect(
      page.locator('#main-content').getByText(/missing required sections/i)
    ).toBeVisible();
  });

  test('a recovered-unlinked day re-links and drops out of the needs-review list', async ({ page }) => {
    // Drop the day from its animal's index (keep the record) → a recovered_unlinked day.
    const blob = buildConfiguredWorkspaceBlob();
    blob.workspace.animals[ANIMAL_ID].days = [];
    await seedAndOpen(page, blob, '/#/recovery');

    await expect(page.getByRole('heading', { name: /review recovered data/i })).toBeVisible();
    const relink = page.getByRole('button', { name: /add to day list/i });
    await expect(relink).toBeVisible();
    await relink.click();

    // Re-linked → reclassified to ok → no longer a needs-review row; the all-clear state shows.
    await expect(page.getByRole('button', { name: /add to day list/i })).toHaveCount(0);
    await expect(page.getByText(/nothing to review/i)).toBeVisible();
  });
});

test.describe('redesign — accessibility (axe)', () => {
  /** The redesigned routes, each seeded with the configured workspace, scanned for axe violations. */
  const routes = [
    { label: 'Animals home', hash: '/#/workspace' },
    { label: 'Animal page', hash: `/#/animal/${ANIMAL_ID}/days` },
    { label: 'Day editor', hash: `/#/day/${DAY_ID}` },
    { label: 'Import & Repair', hash: '/#/import' },
    { label: 'Copy from animal', hash: '/#/copy-from-animal' },
    { label: 'Create animal wizard', hash: '/#/home' },
  ];

  for (const { label, hash } of routes) {
    test(`${label} is axe-clean`, async ({ page }) => {
      await seedAndOpen(page, buildConfiguredWorkspaceBlob(), hash);
      await expect(page.locator('#main-content')).toBeVisible();
      await expectAxeClean(page, label);
    });
  }

  test('recovery review is axe-clean with needs-review records', async ({ page }) => {
    const blob = buildConfiguredWorkspaceBlob();
    blob.workspace.animals[ANIMAL_ID].days = [];
    await seedAndOpen(page, blob, '/#/recovery');
    await expect(page.getByRole('heading', { name: /review recovered data/i })).toBeVisible();
    await expectAxeClean(page, 'Recovery review');
  });
});

test.describe('redesign — keyboard operability', () => {
  test('the epoch caret is a keyboard-operable disclosure', async ({ page }) => {
    await seedAndOpen(page, buildConfiguredWorkspaceBlob(), `/#/day/${DAY_ID}`);
    await page.getByRole('button', { name: /^Epochs$/i }).click();

    const caret = page.getByRole('button', { name: /toggle epoch .* details/i }).first();
    await expect(caret).toHaveAttribute('aria-expanded', 'false');
    await caret.focus();
    await expect(caret).toBeFocused();
    // Enter operates the disclosure (a real <button>, not a click-only div).
    await page.keyboard.press('Enter');
    await expect(caret).toHaveAttribute('aria-expanded', 'true');
  });

  test('the failed-channels grid toggles are keyboard-operable checkboxes', async ({ page }) => {
    await seedAndOpen(page, buildConfiguredWorkspaceBlob(), `/#/day/${DAY_ID}`);
    await page.getByRole('button', { name: /^Failed channels$/i }).click();

    // Each electrode group is a native <details> disclosure (keyboard-operable); its per-channel
    // toggles live inside. Expand a group with all channels OK so every revealed checkbox is enabled.
    await page.locator('summary').filter({ hasText: /Electrode Group 0/ }).click();

    // The per-channel toggles are native checkboxes — focusable + Space-operable by construction.
    const channel = page.getByRole('checkbox', { disabled: false }).first();
    await expect(channel).toBeVisible();
    const before = await channel.isChecked();
    await channel.focus();
    await expect(channel).toBeFocused();
    await page.keyboard.press('Space');
    await expect(channel).toBeChecked({ checked: !before });
  });
});
