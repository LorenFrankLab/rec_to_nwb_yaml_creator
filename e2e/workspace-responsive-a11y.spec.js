/**
 * E2E: Responsive + accessibility smoke for the critical workspace flows.
 *
 * jsdom can prove the routing/status LOGIC but NOT layout-in-a-real-viewport or live focus
 * management. This pass drives the highest-traffic surfaces (navigation, a setup modal, the
 * validation summary, and Export) at TWO viewports — the config-default desktop (1280×720) and a
 * narrow phone (390×844) — and asserts, with hard checks, that:
 *
 *  1. the primary nav, the AnimalView section-nav tabs, and the top object-selector trigger are
 *     VISIBLE and not horizontally clipped off-screen at both widths (the narrow layout WRAPS /
 *     STACKS them — there is no hamburger/disclosure to expand, so every link stays reachable);
 *  2. a setup modal (the electrode-group editor) moves focus INTO the dialog on open, TRAPS Tab /
 *     Shift+Tab so focus never escapes to the page behind, fits within the narrow viewport, and
 *     RESTORES focus to its opener on Esc and on the Cancel button;
 *  3. the per-animal validation summary's day rows, status chips, and the repair action ("Open
 *     editor") are visible and not clipped at both widths, and the repair action is KEYBOARD
 *     reachable (tab-focusable + Enter-activatable) and navigates to the owning Day Editor;
 *  4. the valid day's Export step shows the preflight summary and a Download control that are
 *     visible, not clipped, and keyboard reachable (focusable + Enter-activatable) at both widths.
 *
 * This is BEHAVIORAL accessibility smoke (bounding-box-in-viewport, focus containment, keyboard
 * activation) — NOT a full axe audit (deferred to a later phase).
 *
 * QA discipline: role/accessible-name or route/href selectors only (never CSS class for app
 * controls); wait on locators/URLs/focus (never sleeps); reset + seed per test for independence;
 * the viewport is set BEFORE navigation, per test.
 */

import { test, expect } from '@playwright/test';
import {
  resetWorkspace,
  seedAndOpen,
  buildConfiguredWorkspaceBlob,
  ANIMAL_ID,
  DAY_ID,
} from './helpers/workspace';

/**
 * The two viewports every critical flow is parameterized over: the Playwright config default
 * desktop and a representative narrow phone. Kept here so each describe block iterates ONE source.
 * @type {Array<{ name: string, width: number, height: number }>}
 */
const VIEWPORTS = [
  { name: 'desktop 1280×720', width: 1280, height: 720 },
  { name: 'narrow 390×844', width: 390, height: 844 },
];

/**
 * Assert a control is rendered within the viewport's HORIZONTAL bounds (not clipped off-screen
 * left/right). A critical always-present control (nav link, modal action, Download) must never be
 * pushed off-screen horizontally; vertical scroll is acceptable (callers scroll it into view first),
 * so this checks only the x-extent against the viewport width plus a 1px rounding tolerance.
 *
 * @param {import('@playwright/test').Locator} locator - The control to measure.
 * @param {{ width: number, height: number }} viewport - The active viewport size.
 * @param {string} label - A human label for the assertion message.
 * @returns {Promise<void>}
 */
async function expectWithinViewportHorizontally(locator, viewport, label) {
  await expect(locator, `${label} should be visible`).toBeVisible();
  await locator.scrollIntoViewIfNeeded();
  const box = await locator.boundingBox();
  expect(box, `${label} should have a bounding box`).not.toBeNull();
  expect(box.x, `${label} left edge should not be off-screen (x >= 0)`).toBeGreaterThanOrEqual(-1);
  expect(
    box.x + box.width,
    `${label} right edge should not be clipped past the viewport width`,
  ).toBeLessThanOrEqual(viewport.width + 1);
}

/**
 * Whether `document.activeElement` is contained within the given element (the dialog). Run in the
 * page so the assertion reflects the REAL focused node, which jsdom can't model.
 *
 * @param {import('@playwright/test').Page} page - The Playwright page.
 * @param {import('@playwright/test').Locator} container - The element focus must stay inside.
 * @returns {Promise<boolean>} True when the active element is inside the container.
 */
async function activeElementIsInside(page, container) {
  return container.evaluate((el) => el.contains(document.activeElement));
}

test.describe('Responsive + a11y smoke — navigation reachable at both viewports', () => {
  for (const viewport of VIEWPORTS) {
    test(`primary nav, section-nav tabs, and object-selector are visible and in-viewport (${viewport.name})`, async ({
      page,
    }) => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await resetWorkspace(page);
      await seedAndOpen(page, buildConfiguredWorkspaceBlob(), `/#/animal/${ANIMAL_ID}/days`);

      // --- Primary nav (chrome): both entries are reachable. At narrow width the nav WRAPS
      //     (flex-wrap) rather than collapsing into a disclosure, so every link stays visible —
      //     there is no menu/hamburger to open. Assert the links directly. ---
      const primaryNav = page.getByRole('navigation', { name: 'Primary' });
      await expect(primaryNav).toBeVisible();
      await expectWithinViewportHorizontally(
        primaryNav.getByRole('link', { name: 'Workspace' }),
        viewport,
        'Primary nav "Workspace" link',
      );
      await expectWithinViewportHorizontally(
        primaryNav.getByRole('link', { name: 'Validation & Export' }),
        viewport,
        'Primary nav "Validation & Export" link',
      );

      // --- Top object-selector trigger (switch current animal): reachable + in-viewport. ---
      await expectWithinViewportHorizontally(
        page.getByRole('button', { name: `Switch animal (current: ${ANIMAL_ID})` }),
        viewport,
        'Object-selector trigger',
      );

      // --- AnimalView section-nav tabs: the landmark + each tab is visible and not clipped. At
      //     ≤1040px the nav STACKS full-width above the panel; every tab still renders. ---
      const sectionNav = page.getByRole('navigation', { name: 'Animal sections' });
      await expect(sectionNav).toBeVisible();
      for (const name of ['Recording Days', 'Validation & Export', 'Electrode Groups', 'Cameras']) {
        await expectWithinViewportHorizontally(
          sectionNav.getByRole('link', { name: new RegExp(`^${name}`) }),
          viewport,
          `Section-nav "${name}" tab`,
        );
      }
    });
  }
});

test.describe('Responsive + a11y smoke — a setup modal traps and restores focus at both viewports', () => {
  for (const viewport of VIEWPORTS) {
    test(`electrode-group modal: focus enters, is trapped, fits the viewport, and is restored on close (${viewport.name})`, async ({
      page,
    }) => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await resetWorkspace(page);
      await seedAndOpen(page, buildConfiguredWorkspaceBlob(), `/#/animal/${ANIMAL_ID}/electrode-groups`);

      // The realistic fixture opens on the safe re-sync prompt; load the saved config to expose an
      // editable group, then open its editor. The "Edit electrode group 0" button is the OPENER
      // whose focus must be restored on close.
      await page.getByRole('button', { name: 'Load saved electrode configuration' }).click();
      const opener = page.getByRole('button', { name: 'Edit electrode group 0' });
      await expect(opener).toBeVisible();
      await opener.click();

      const dialog = page.getByRole('dialog', { name: 'Edit Electrode Group' });
      await expect(dialog).toBeVisible();

      // --- On open, focus moved INTO the dialog (the Modal auto-focuses its first focusable). ---
      expect(
        await activeElementIsInside(page, dialog),
        'focus should move into the dialog on open',
      ).toBe(true);

      // --- The dialog fits within the viewport horizontally (not clipped) at this width. ---
      await expectWithinViewportHorizontally(dialog, viewport, 'Electrode group dialog');

      // --- Focus trap: tabbing forward many times (more than the dialog's focusable count) keeps
      //     focus INSIDE the dialog — it never escapes to the page behind. ---
      for (let i = 0; i < 12; i += 1) {
        await page.keyboard.press('Tab');
        expect(
          await activeElementIsInside(page, dialog),
          `focus should stay inside the dialog after Tab #${i + 1}`,
        ).toBe(true);
      }
      // --- Shift+Tab (reverse) also stays trapped inside the dialog. ---
      for (let i = 0; i < 12; i += 1) {
        await page.keyboard.press('Shift+Tab');
        expect(
          await activeElementIsInside(page, dialog),
          `focus should stay inside the dialog after Shift+Tab #${i + 1}`,
        ).toBe(true);
      }

      // --- Esc closes the dialog and RESTORES focus to the opener (the Edit button). ---
      await page.keyboard.press('Escape');
      await expect(dialog).toBeHidden();
      await expect(opener).toBeFocused();

      // --- Re-open, then close via the Cancel BUTTON: focus is again restored to the opener. ---
      await opener.click();
      await expect(dialog).toBeVisible();
      await dialog.getByRole('button', { name: 'Cancel and close modal' }).click();
      await expect(dialog).toBeHidden();
      await expect(opener).toBeFocused();
    });
  }
});

test.describe('Responsive + a11y smoke — validation summary reachable at both viewports', () => {
  /**
   * Seed the realistic workspace with ONE shared-setup field invalid: camera 0's `meters_per_pixel`
   * is the empty string (schema `type: number` → an error-severity issue), so the single seeded day
   * is counted "with errors" on the per-animal export tab and its row shows an Error chip + an "Open
   * editor" repair link to the owning Day Editor.
   *
   * @returns {{ schemaVersion: number, workspace: object }} A loader-ready blob with one invalid camera.
   */
  function buildInvalidCameraBlob() {
    const blob = buildConfiguredWorkspaceBlob();
    blob.workspace.animals[ANIMAL_ID].cameras[0].meters_per_pixel = '';
    return blob;
  }

  for (const viewport of VIEWPORTS) {
    test(`per-animal export tab: invalid day's row, chip, and repair action are in-viewport + keyboard reachable (${viewport.name})`, async ({
      page,
    }) => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await resetWorkspace(page);
      await seedAndOpen(page, buildInvalidCameraBlob(), `/#/animal/${ANIMAL_ID}/export`);

      await expect(
        page.getByRole('heading', { level: 2, name: 'This animal — readiness & export' }),
      ).toBeVisible();

      // --- The readiness counts (chips) report the error day and are in-viewport. ---
      await expectWithinViewportHorizontally(
        page.getByText('0 valid'),
        viewport,
        'Readiness "0 valid" count',
      );
      await expectWithinViewportHorizontally(
        page.getByText('1 with errors'),
        viewport,
        'Readiness "1 with errors" count',
      );

      // --- The day row carries an Error status chip that is visible + not clipped. ---
      const dayRow = page.getByTestId(`day-row-${DAY_ID}`);
      await expect(dayRow).toBeVisible();
      await expectWithinViewportHorizontally(
        dayRow.getByText('Error', { exact: true }),
        viewport,
        'Day-row Error status chip',
      );

      // --- The repair action ("Open editor") is the route to the owning surface. It is in-viewport
      //     and KEYBOARD reachable: focus it directly (it is a real link tab stop) and activate with
      //     Enter, which must navigate to the owning Day Editor where the fix + gate live. ---
      const repair = dayRow.getByRole('link', {
        name: `Open editor for ${ANIMAL_ID} 2023-06-22`,
      });
      await expectWithinViewportHorizontally(repair, viewport, 'Repair "Open editor" link');
      await repair.focus();
      await expect(repair).toBeFocused();
      await page.keyboard.press('Enter');
      await expect(page).toHaveURL(new RegExp(`#/day/${DAY_ID}`));
      await expect(
        page.getByRole('heading', { level: 1, name: `Day Editor: ${ANIMAL_ID} - 2023-06-22` }),
      ).toBeVisible();
    });
  }
});

test.describe('Responsive + a11y smoke — Export reachable at both viewports', () => {
  for (const viewport of VIEWPORTS) {
    test(`valid day's Export step: preflight + Download are in-viewport and keyboard reachable (${viewport.name})`, async ({
      page,
    }) => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await resetWorkspace(page);
      await seedAndOpen(page, buildConfiguredWorkspaceBlob(), `/#/day/${DAY_ID}`);

      await expect(
        page.getByRole('heading', { level: 1, name: `Day Editor: ${ANIMAL_ID} - 2023-06-22` }),
      ).toBeVisible();

      // Reach the Export section (a freely-navigable Day Editor tab).
      await page.getByRole('button', { name: /^Export — / }).click();
      await expect(page.getByRole('heading', { level: 2, name: 'Export YAML' })).toBeVisible();

      // --- The preflight summary (the confidence check before download) is visible + in-viewport. ---
      const preflight = page.getByRole('region', { name: 'Export preflight summary' });
      await expectWithinViewportHorizontally(preflight, viewport, 'Export preflight summary');

      // --- The Download control: a valid day enables it, it is in-viewport, and it is KEYBOARD
      //     reachable (focusable + Enter-activatable). Activating it produces a download (reachability
      //     proof — byte assertions live in the export spec). ---
      const download = page.getByRole('button', { name: 'Download YAML' });
      await expect(download).toBeEnabled();
      await expectWithinViewportHorizontally(download, viewport, 'Download YAML button');
      await download.focus();
      await expect(download).toBeFocused();
      const [downloadEvent] = await Promise.all([
        page.waitForEvent('download'),
        page.keyboard.press('Enter'),
      ]);
      expect(downloadEvent.suggestedFilename()).toMatch(/\.ya?ml$/);
    });
  }
});
