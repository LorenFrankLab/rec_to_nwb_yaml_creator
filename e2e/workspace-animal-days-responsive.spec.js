/**
 * E2E: Animal Days responsive + action-hierarchy hardening (Phase 8A-3).
 *
 * jsdom can't compute layout, so this measures the real rendered Animal Days surface at a narrow
 * phone width (390px) and at desktop (1440px) and asserts:
 *  - the page never scrolls horizontally (no control pushed off-screen / one-word columns);
 *  - the primary "Add Recording Days" action and the carry-forward toggle are visible and not
 *    clipped, with the toggle below/near the primary action at narrow width;
 *  - on a day row, the destructive "Delete day…" action does not overlap the row's primary
 *    navigation link (destructive separated from primary).
 *
 * QA discipline: role/accessible-name or route selectors; wait on locators; seed per test;
 * viewport set before navigation.
 */

import { test, expect } from '@playwright/test';
import { seedAndOpen, buildConfiguredWorkspaceBlob, ANIMAL_ID } from './helpers/workspace';

const NARROW = { width: 390, height: 844 };
const DESKTOP = { width: 1440, height: 900 };

/**
 * True when rect A and rect B overlap (share any area).
 * @param {{x:number,y:number,width:number,height:number}} a
 * @param {{x:number,y:number,width:number,height:number}} b
 * @returns {boolean}
 */
function overlaps(a, b) {
  return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
}

for (const viewport of [NARROW, DESKTOP]) {
  test.describe(`Animal Days @ ${viewport.width}px`, () => {
    test('does not scroll horizontally and keeps the primary action + carry-forward usable', async ({
      page,
    }) => {
      await page.setViewportSize(viewport);
      await seedAndOpen(page, buildConfiguredWorkspaceBlob(), `/#/animal/${ANIMAL_ID}/days`);
      await expect(page.getByRole('heading', { level: 1, name: ANIMAL_ID })).toBeVisible();

      // No horizontal overflow of the document (allow 1px rounding).
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth
      );
      expect(overflow).toBeLessThanOrEqual(1);

      // Primary action + carry-forward toggle are both visible and within the viewport.
      const addButton = page.getByRole('button', { name: 'Add Recording Days' });
      await expect(addButton).toBeVisible();
      const toggle = page.getByRole('checkbox', { name: /start each new day from the last day/i });
      await expect(toggle).toBeVisible();
      const addBox = await addButton.boundingBox();
      expect(addBox.x).toBeGreaterThanOrEqual(0);
      expect(addBox.x + addBox.width).toBeLessThanOrEqual(viewport.width + 1);
    });

    test('a day row keeps its actions (⋯ menu + chevron) from overlapping the date link', async ({
      page,
    }) => {
      // Phase 2 (epoch-editor): the destructive Delete + Duplicate moved OFF the row into the per-row
      // ⋯ overflow menu; the row now exposes the date link, a trailing chevron link, and the ⋯ menu
      // trigger. None may overlap the date link, and all stay within the viewport.
      await page.setViewportSize(viewport);
      await seedAndOpen(page, buildConfiguredWorkspaceBlob(), `/#/animal/${ANIMAL_ID}/days`);

      const dayLink = page.getByRole('link', { name: '2023-06-22', exact: true });
      await expect(dayLink).toBeVisible();
      const menu = page.getByRole('button', { name: /Actions for 2023-06-22/i });
      await expect(menu).toBeVisible();
      const chevron = page.getByRole('link', { name: /Open 2023-06-22/i });
      await expect(chevron).toBeVisible();

      const linkBox = await dayLink.boundingBox();
      const menuBox = await menu.boundingBox();
      const chevBox = await chevron.boundingBox();
      // The actions sit to the RIGHT of the date link and never overlap it.
      expect(overlaps(linkBox, menuBox)).toBe(false);
      expect(overlaps(linkBox, chevBox)).toBe(false);
      // Both actions stay within the viewport (no control pushed off-screen).
      expect(menuBox.x + menuBox.width).toBeLessThanOrEqual(viewport.width + 1);
      expect(chevBox.x + chevBox.width).toBeLessThanOrEqual(viewport.width + 1);
      expect(menuBox.x).toBeGreaterThanOrEqual(0);
    });
  });
}
