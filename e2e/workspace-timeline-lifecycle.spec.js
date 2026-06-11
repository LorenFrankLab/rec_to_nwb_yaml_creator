/**
 * E2E: Phase 8A-1 — timeline-aware day creation + the shared day-lifecycle vocabulary.
 *
 * Two pre-test UX-hardening guarantees jsdom can't fully prove:
 *  1. The "Add Recording Days" calendar opens on the animal's RECORDING TIMELINE (the seeded
 *     2023 day's month) instead of wall-clock today — and "Today" still works as an explicit jump.
 *  2. A recording day's status uses ONE vocabulary across surfaces, and the persisted-validated
 *     state ("Validated") is distinct from live readiness ("Ready to export") on both the
 *     Validation Summary and the per-animal Animal Days list.
 *
 * QA discipline: role/accessible-name or route selectors (the one CSS-class fallback is the modal
 * month-year label, which has no role); wait on locators/URLs (never sleeps); seed + reload per test.
 */

import { test, expect } from '@playwright/test';
import {
  resetWorkspace,
  seedAndOpen,
  buildConfiguredWorkspaceBlob,
  ANIMAL_ID,
  DAY_ID,
} from './helpers/workspace';

test.describe('Timeline-aware Add Recording Days calendar', () => {
  test.beforeEach(async ({ page }) => {
    await resetWorkspace(page);
  });

  test('opens on the latest recording-day month (2023), not wall-clock today; "Today" jumps back', async ({
    page,
  }) => {
    // Seed an animal whose only recording day is 2023-06-22, then open its days tab.
    await seedAndOpen(page, buildConfiguredWorkspaceBlob(), `/#/animal/${ANIMAL_ID}/days`);
    await expect(page.getByRole('heading', { level: 1, name: ANIMAL_ID })).toBeVisible();

    // Open the calendar — its accessible name now equals its visible text (label parity, 8A-2).
    await page.getByRole('button', { name: 'Add Recording Days' }).click();
    await expect(page.getByRole('dialog', { name: 'Recording Days Calendar' })).toBeVisible();

    // It follows the recording timeline: the latest day (2023-06-22) → next likely day is the same
    // month, so the calendar opens on June 2023, NOT the current wall-clock month.
    await expect(page.getByText('June 2023')).toBeVisible();
    const now = new Date();
    const currentMonthYear = now.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    expect(currentMonthYear).not.toBe('June 2023'); // guard: the test is meaningful only off-2023
    await expect(page.getByText(currentMonthYear)).toHaveCount(0);

    // "Today" is preserved as an explicit jump to the current wall-clock month.
    await page.getByRole('button', { name: 'Today' }).click();
    await expect(page.getByText(currentMonthYear)).toBeVisible();
  });
});

test.describe('Shared day-lifecycle vocabulary', () => {
  test.beforeEach(async ({ page }) => {
    await resetWorkspace(page);
  });

  test('Validation Summary: a live-valid, unsaved day reads "Ready to export"', async ({ page }) => {
    await seedAndOpen(page, buildConfiguredWorkspaceBlob(), '/#/validation');
    await expect(page.getByRole('heading', { level: 1, name: 'Validation Summary' })).toBeVisible();

    const row = page.getByTestId(`day-row-${DAY_ID}`);
    await expect(row.getByText('Ready to export')).toBeVisible();
    // The shared legend explains the words once, on demand.
    await expect(page.getByText('What do these statuses mean?')).toBeVisible();
  });

  test('a persisted-validated day reads "Validated" (not "Ready to export") on both surfaces', async ({
    page,
  }) => {
    // Persist the validation outcome onto the seeded day (what "Validate All" writes).
    const blob = buildConfiguredWorkspaceBlob();
    blob.workspace.days[DAY_ID].state = { draft: false, validated: true, exported: false };

    // Validation Summary.
    await seedAndOpen(page, blob, '/#/validation');
    const summaryRow = page.getByTestId(`day-row-${DAY_ID}`);
    await expect(summaryRow.getByText('Validated')).toBeVisible();
    await expect(summaryRow.getByText('Ready to export')).toHaveCount(0);

    // Animal Days list — the SAME word for the SAME state (scope to the day's list row so the
    // legend's reference copy isn't matched).
    await page.goto(`/#/animal/${ANIMAL_ID}/days`);
    await page.reload();
    await expect(page.getByRole('heading', { level: 1, name: ANIMAL_ID })).toBeVisible();
    const dayItem = page
      .getByRole('listitem')
      .filter({ has: page.getByRole('link', { name: /2023-06-22/ }) });
    await expect(dayItem.getByText('Validated')).toBeVisible();
    await expect(dayItem.getByText('Ready to export')).toHaveCount(0);
  });
});
