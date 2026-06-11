/**
 * E2E: the banner (lab logo + keyboard-shortcuts trigger) is not occluded by the primary nav.
 *
 * The banner (`role="banner"`) and the primary navigation (`role="navigation"`, "Primary") are
 * DOM siblings that overlap in the layout — the banner is `position: fixed` at >=750px and
 * `position: relative` below — so stacking order decides which one receives clicks. A regression in
 * that z-order (the F3 bug) let the nav's first link paint OVER the shortcuts trigger and the logo,
 * intercepting their clicks. jsdom cannot prove paint order, so this asserts it in a real viewport:
 * at the center of the logo and of the shortcuts trigger, the topmost painted element is INSIDE the
 * banner and NOT inside the nav, at a desktop and a narrow width; and the trigger still opens its
 * dialog. (Verified before the fix this failed: the topmost element at the trigger center was an
 * anchor inside the nav.)
 *
 * QA discipline: role/accessible-name selectors for controls; geometry probed via elementFromPoint;
 * wait on locators (never sleeps); viewport set BEFORE navigation, per test.
 */

import { test, expect } from '@playwright/test';
import { resetWorkspace } from './helpers/workspace';

const VIEWPORTS = [
  { name: 'desktop 1280×720', width: 1280, height: 720 },
  { name: 'narrow 390×844', width: 390, height: 844 },
];

/**
 * Assert that the topmost painted element at the CENTER of `locator` belongs to the banner and not
 * to the primary nav — i.e. the control is not occluded by the overlapping nav.
 *
 * @param {import('@playwright/test').Page} page - The Playwright page.
 * @param {import('@playwright/test').Locator} locator - The banner control to probe.
 * @param {string} label - Human label for the assertion message.
 * @returns {Promise<void>}
 */
async function expectBannerControlOnTop(page, locator, label) {
  await expect(locator, `${label} should be visible`).toBeVisible();
  const box = await locator.boundingBox();
  expect(box, `${label} should have a layout box`).not.toBeNull();

  const hit = await page.evaluate(
    ({ x, y }) => {
      const el = document.elementFromPoint(x, y);
      if (!el) return { found: false };
      return {
        found: true,
        inBanner: !!el.closest('[role="banner"]'),
        inNav: !!el.closest('nav.primary-nav, [role="navigation"]'),
      };
    },
    { x: box.x + box.width / 2, y: box.y + box.height / 2 },
  );

  expect(hit.found, `${label} center should hit an element`).toBe(true);
  expect(hit.inBanner, `${label} should be painted on top (inside the banner)`).toBe(true);
  expect(hit.inNav, `${label} should NOT be occluded by the primary nav`).toBe(false);
}

test.describe('Banner is not occluded by the primary nav (F3)', () => {
  for (const vp of VIEWPORTS) {
    test(`logo + shortcuts trigger stay clickable at ${vp.name}`, async ({ page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await resetWorkspace(page);

      const logo = page.getByRole('img', { name: 'Loren Frank Lab logo' });
      const trigger = page.getByRole('button', { name: 'Keyboard shortcuts' });

      await expectBannerControlOnTop(page, logo, 'lab logo');
      await expectBannerControlOnTop(page, trigger, 'keyboard-shortcuts trigger');

      // The trigger is not just visible/on-top — clicking it opens the shortcuts dialog.
      await trigger.click();
      await expect(page.getByRole('dialog')).toBeVisible();
    });
  }
});
