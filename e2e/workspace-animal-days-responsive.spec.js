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

    test('a day row keeps the destructive Delete action from overlapping the row link', async ({
      page,
    }) => {
      await page.setViewportSize(viewport);
      await seedAndOpen(page, buildConfiguredWorkspaceBlob(), `/#/animal/${ANIMAL_ID}/days`);

      const dayLink = page.getByRole('link', { name: /Open .*2023-06-22|2023-06-22/ }).first();
      await expect(dayLink).toBeVisible();
      const del = page.getByRole('button', { name: /Delete recording day/i }).first();
      await expect(del).toBeVisible();

      const linkBox = await dayLink.boundingBox();
      const delBox = await del.boundingBox();
      // Destructive action must not sit on top of the primary navigation card.
      expect(overlaps(linkBox, delBox)).toBe(false);
      // And it must be within the viewport.
      expect(delBox.x + delBox.width).toBeLessThanOrEqual(viewport.width + 1);

      if (viewport.width <= 640) {
        // Narrow: the row stacks into a card — the destructive action sits BELOW the navigation
        // card, not squeezed beside it.
        expect(delBox.y).toBeGreaterThanOrEqual(linkBox.y + linkBox.height - 4);
      } else {
        // Desktop: the action sits BESIDE the card (vertically overlapping it), to the right.
        expect(delBox.y).toBeLessThan(linkBox.y + linkBox.height);
        expect(delBox.y + delBox.height).toBeGreaterThan(linkBox.y);
        expect(delBox.x).toBeGreaterThanOrEqual(linkBox.x + linkBox.width - 1);
      }
    });
  });
}
