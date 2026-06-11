/**
 * E2E: the workspace app-bar keeps the logo and keyboard-shortcuts trigger reachable.
 *
 * On the workspace routes the header is a single app-bar row: the lab logo (in the `role="banner"`
 * region) on the left, the primary navigation (`role="navigation"`, "Primary") in the middle, and the
 * keyboard-shortcuts trigger pushed to the right. The F3 bug was that the banner's `position: fixed`
 * pulled it out of flow so the nav slid underneath and the logo/shortcuts overlapped the nav. jsdom
 * cannot prove layout, so this asserts in a real viewport that, at a desktop and a narrow width:
 *   1. the logo and the shortcuts trigger are the topmost painted elements at their centers (reachable,
 *      not occluded);
 *   2. the banner and the nav, and the nav and the trigger, do not overlap; and
 *   3. clicking the trigger opens its dialog.
 *
 * QA discipline: accessible-attribute selectors for the controls; geometry via bounding boxes +
 * elementFromPoint; wait on locators (never sleeps); viewport set BEFORE navigation, per test.
 */

import { test, expect } from '@playwright/test';
import { resetWorkspace } from './helpers/workspace';

const VIEWPORTS = [
  { name: 'desktop 1280×720', width: 1280, height: 720 },
  { name: 'narrow 390×844', width: 390, height: 844 },
];

/**
 * Probe the header geometry in the page: whether the logo and shortcuts trigger are the topmost
 * painted element at their own centers, and whether the banner/nav/trigger boxes overlap.
 *
 * @param {import('@playwright/test').Page} page - The Playwright page.
 * @returns {Promise<object>} The geometry report.
 */
function probeHeader(page) {
  return page.evaluate(() => {
    const reach = (sel) => {
      const c = document.querySelector(sel);
      if (!c) return { found: false };
      const r = c.getBoundingClientRect();
      const top = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
      return {
        found: true,
        reachable: !!top && (top === c || c.contains(top) || top.contains(c)),
        inNav: !!(top && top.closest('nav.primary-nav')),
      };
    };
    const box = (sel) => {
      const el = document.querySelector(sel);
      return el ? el.getBoundingClientRect() : null;
    };
    const intersect = (a, b) =>
      !!a && !!b && !(a.right <= b.left || b.right <= a.left || a.bottom <= b.top || b.bottom <= a.top);

    const banner = box('[role="banner"]');
    const nav = box('nav.primary-nav');
    const trigger = box('button[aria-label="Keyboard shortcuts"]');
    return {
      logo: reach('img[alt="Loren Frank Lab logo"]'),
      trigger: reach('button[aria-label="Keyboard shortcuts"]'),
      bannerNavOverlap: intersect(banner, nav),
      navTriggerOverlap: intersect(nav, trigger),
    };
  });
}

test.describe('Workspace app-bar keeps the logo + shortcuts reachable (F3)', () => {
  for (const vp of VIEWPORTS) {
    test(`logo + shortcuts trigger stay clear of the nav at ${vp.name}`, async ({ page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await resetWorkspace(page);

      await expect(page.getByRole('img', { name: 'Loren Frank Lab logo' })).toBeVisible();
      const trigger = page.getByRole('button', { name: 'Keyboard shortcuts' });
      await expect(trigger).toBeVisible();

      const geom = await probeHeader(page);
      expect(geom.logo.found && geom.trigger.found, 'logo + trigger should be present').toBe(true);
      expect(geom.logo.reachable, 'logo should be topmost at its center (not occluded)').toBe(true);
      expect(geom.trigger.reachable, 'shortcuts trigger should be topmost at its center').toBe(true);
      expect(geom.trigger.inNav, 'shortcuts trigger should not be covered by the nav').toBe(false);
      expect(geom.bannerNavOverlap, 'the banner must not overlap the primary nav').toBe(false);
      expect(geom.navTriggerOverlap, 'the nav must not overlap the shortcuts trigger').toBe(false);

      // Clicking the trigger opens the shortcuts dialog.
      await trigger.click();
      await expect(page.getByRole('dialog')).toBeVisible();
    });
  }
});
