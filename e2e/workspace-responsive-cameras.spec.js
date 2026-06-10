/**
 * E2E regression: the cameras catalog table keeps its row actions reachable with long names.
 *
 * Bug class this guards: the per-animal Cameras tab renders an 8-column table
 * (ID / Name / Manufacturer / Model / Lens / Meters-per-Pixel / Status / Actions). With long
 * camera/lens/model strings the un-constrained table grew WIDER than the viewport, pushing the
 * Actions column (Edit / Delete) off the right edge — at desktop it became unreachable, and the
 * document itself gained a horizontal scrollbar. The fix constrains the table (table-layout:fixed
 * with ellipsis-truncated text columns, inside an overflow-x scroll wrapper) so the row actions
 * stay on-screen and the page never overflows horizontally.
 *
 * jsdom can't measure layout in a real viewport, so this asserts, with hard bounding-box checks at
 * two viewports, that (a) the document has NO horizontal overflow and (b) the first row's Edit
 * button is within the viewport's right edge.
 *
 * QA discipline (mirrors the workspace spec bar): seed through the shared harness; select by
 * role/accessible-name (the Edit button's aria-label) — never by CSS class; wait on locators;
 * no sleeps; viewport set BEFORE navigation, per test.
 */

import { test, expect } from '@playwright/test';
import { seedAndOpen, buildConfiguredWorkspaceBlob, ANIMAL_ID } from './helpers/workspace';

/**
 * The two viewports the row-actions-reachable guarantee is parameterized over: the config-default
 * desktop (where the un-fixed table pushed Actions off-screen) and a representative narrow phone
 * (where the table card-stacks). 834 is covered by the build/visual pass; these two are the
 * load-bearing regression boundaries.
 * @type {Array<{ name: string, width: number, height: number }>}
 */
const VIEWPORTS = [
  { name: 'desktop 1280×720', width: 1280, height: 720 },
  { name: 'narrow 390×844', width: 390, height: 844 },
];

/**
 * Deliberately long camera identity strings — long enough to blow an un-constrained table past
 * 1280px. Applied to the FIRST seeded camera so its Edit button is the one most at risk of being
 * shoved off-screen.
 */
const LONG_NAME = 'overhead_tracking_camera_with_a_very_long_descriptive_identifier_name';
const LONG_LENS = 'Fujinon HF16HA-1B wide-angle low-distortion machine-vision lens variant';
const LONG_MODEL = 'Mako G-158 PoE GigE Vision area-scan industrial camera model number';

/**
 * Seed the realistic workspace with the first camera's name/lens/model overwritten with long
 * strings, so the cameras table is forced wide.
 * @returns {{ schemaVersion: number, workspace: object }} A loader-ready blob.
 */
function buildBlobWithLongCameraNames() {
  const blob = buildConfiguredWorkspaceBlob();
  const cameras = blob.workspace.animals[ANIMAL_ID].cameras;
  cameras[0] = {
    ...cameras[0],
    camera_name: LONG_NAME,
    lens: LONG_LENS,
    model: LONG_MODEL,
  };
  return blob;
}

test.describe('Cameras tab: long names keep row actions reachable', () => {
  for (const viewport of VIEWPORTS) {
    test(`no horizontal overflow + first Edit on-screen at ${viewport.name}`, async ({ page }) => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });

      const blob = buildBlobWithLongCameraNames();
      await seedAndOpen(page, blob, `/#/animal/${ANIMAL_ID}/cameras`);

      // The table view (not the empty state) is up: the first camera's Edit action exists.
      const firstEdit = page.getByRole('button', { name: /^Edit camera/i }).first();
      await expect(firstEdit).toBeVisible();

      // (a) The document must not overflow horizontally — the wide table scrolls WITHIN its
      // wrapper, it must never give the page a horizontal scrollbar.
      const overflow = await page.evaluate(() => {
        const doc = document.documentElement;
        return { scrollWidth: doc.scrollWidth, clientWidth: doc.clientWidth };
      });
      expect(
        overflow.scrollWidth,
        `document must not overflow horizontally at ${viewport.name}`,
      ).toBeLessThanOrEqual(overflow.clientWidth + 1);

      // (b) The first row's Edit button must sit within the viewport's right edge (not pushed
      // off-screen by the long names).
      const box = await firstEdit.boundingBox();
      expect(box, 'first Edit button should have a bounding box').not.toBeNull();
      expect(
        box.x + box.width,
        `first Edit button right edge must be within the viewport at ${viewport.name}`,
      ).toBeLessThanOrEqual(viewport.width + 1);
    });
  }
});
