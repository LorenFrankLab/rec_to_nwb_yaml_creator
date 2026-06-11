/**
 * E2E: the banner (lab logo + keyboard-shortcuts trigger) does not collide with the primary nav.
 *
 * The banner (`role="banner"`) and the primary navigation (`role="navigation"`, "Primary") are DOM
 * siblings. On the workspace routes the banner must sit in normal flow as its OWN row above the nav.
 * The F3 bug was that the banner's desktop `position: fixed` pulled it out of flow, so the nav slid
 * up underneath and the two overlapped — the logo + shortcuts trigger covered (or were covered by) the
 * nav's first link. jsdom cannot prove layout, so this asserts in a real viewport that:
 *   1. the banner box does NOT intersect the primary-nav box (no overlap), and
 *   2. the logo and shortcuts trigger are the topmost painted elements at their centers (clickable),
 *      and the trigger opens its dialog —
 * at a desktop and a narrow width. (Verified before the fix this failed at desktop: the banner and
 * nav overlapped and an anchor inside the nav was the topmost element at the trigger's center.)
 *
 * QA discipline: role/accessible-name selectors; geometry via bounding boxes + elementFromPoint; wait
 * on locators (never sleeps); viewport set BEFORE navigation, per test.
 */

import { test, expect } from '@playwright/test';
import { resetWorkspace } from './helpers/workspace';

const VIEWPORTS = [
  { name: 'desktop 1280×720', width: 1280, height: 720 },
  { name: 'narrow 390×844', width: 390, height: 844 },
];

/**
 * True iff two bounding boxes geometrically intersect.
 *
 * @param {{x:number,y:number,width:number,height:number}} a - First box.
 * @param {{x:number,y:number,width:number,height:number}} b - Second box.
 * @returns {boolean} Whether the boxes overlap.
 */
function boxesIntersect(a, b) {
  return !(
    a.x + a.width <= b.x ||
    b.x + b.width <= a.x ||
    a.y + a.height <= b.y ||
    b.y + b.height <= a.y
  );
}

/**
 * Assert that the topmost painted element at the CENTER of `locator` belongs to the banner and not
 * to the primary nav — i.e. the control is reachable, not occluded.
 *
 * @param {import('@playwright/test').Page} page - The Playwright page.
 * @param {import('@playwright/test').Locator} locator - The banner control to probe.
 * @param {string} label - Human label for the assertion message.
 * @returns {Promise<void>}
 */
async function expectBannerControlReachable(page, locator, label) {
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

test.describe('Banner does not collide with the primary nav (F3)', () => {
  for (const vp of VIEWPORTS) {
    test(`logo + shortcuts trigger stay clear of the nav at ${vp.name}`, async ({ page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await resetWorkspace(page);

      const banner = page.getByRole('banner');
      const nav = page.getByRole('navigation', { name: 'Primary' });
      const logo = page.getByRole('img', { name: 'Loren Frank Lab logo' });
      const trigger = page.getByRole('button', { name: 'Keyboard shortcuts' });

      // 1. The banner and the nav must not overlap at all.
      const bannerBox = await banner.boundingBox();
      const navBox = await nav.boundingBox();
      expect(bannerBox, 'banner should have a layout box').not.toBeNull();
      expect(navBox, 'primary nav should have a layout box').not.toBeNull();
      expect(
        boxesIntersect(bannerBox, navBox),
        'the banner must not overlap the primary nav',
      ).toBe(false);

      // 2. The logo and trigger are reachable (topmost at their centers).
      await expectBannerControlReachable(page, logo, 'lab logo');
      await expectBannerControlReachable(page, trigger, 'keyboard-shortcuts trigger');

      // 3. Clicking the trigger opens the shortcuts dialog.
      await trigger.click();
      await expect(page.getByRole('dialog')).toBeVisible();
    });
  }
});
