/**
 * E2E: the cross-animal Validation & Export screen (`#/validation`) does not overflow the page
 * horizontally on a narrow phone viewport.
 *
 * jsdom proves the row/label LOGIC but not layout-in-a-real-viewport. At ~390px the dense 6-column
 * day table and the batch-export preflight values (long session/camera names) previously pushed the
 * document wider than the viewport, forcing a horizontal page scrollbar and clipping critical cells.
 * The table now scrolls WITHIN its own container and the preflight values wrap, so the PAGE stays at
 * the viewport width. This spec seeds a multi-day workspace with long session/camera names, opens
 * `#/validation` at 390×844, opens the batch preflight, and asserts the document never scrolls wider
 * than its client width.
 *
 * Page-doesn't-overflow alone is NOT enough: a regression that hid the wide table off-screen with no
 * scroll affordance would also keep the page narrow while making the rightmost columns unreachable.
 * So this spec ALSO asserts the table is reachable via INNER horizontal scroll — the scroll wrapper
 * is genuinely scrollable (`scrollWidth > clientWidth`) and scrolling it to the end brings the last
 * column ("Editor") into the viewport — while the PAGE still has no horizontal overflow. (Measured:
 * at 390px the dense 6-column table is ~1157px wide vs a ~374px wrapper, so there IS real inner
 * scroll to reach; if a future layout change made the table fit, this assertion would correctly fail
 * and should be re-evaluated rather than weakened.)
 *
 * QA discipline: role/route selectors only; wait on locators/URLs (never sleeps); reset + seed per
 * test for independence; viewport set BEFORE navigation.
 */

import { test, expect } from '@playwright/test';
import {
  resetWorkspace,
  seedWorkspace,
  buildConfiguredWorkspaceBlob,
  ANIMAL_ID,
  DAY_ID,
} from './helpers/workspace';

const NARROW = { width: 390, height: 844 };

/**
 * Clone the seeded day into a second recording day under the same animal, with long session and
 * camera names so the dense cells are as wide as a real catch-up workspace.
 *
 * @param {{ schemaVersion: number, workspace: object }} blob - The loader-ready blob to mutate.
 * @returns {string} The new day id.
 */
function addLongNamedDay(blob) {
  const day = structuredClone(blob.workspace.days[DAY_ID]);
  day.id = 'remy-2023-06-23';
  day.date = '2023-06-23';
  day.experimentDate = '06232023';
  day.session.session_id = 'remy_20230623_w_track_alternation_long_recording_session_two';
  day.session.session_description =
    'Day 46 of chronic recording with a very long W-track alternation session description for layout';
  blob.workspace.days[day.id] = day;
  blob.workspace.animals[ANIMAL_ID].days = [DAY_ID, day.id];
  return day.id;
}

test.describe('Validation & Export — narrow viewport layout', () => {
  test.beforeEach(async ({ page }) => {
    await resetWorkspace(page);
  });

  test('#/validation does not overflow the page horizontally at 390px (table + preflight)', async ({
    page,
  }) => {
    // Long camera names make the setup-scan cells genuinely wide.
    const blob = buildConfiguredWorkspaceBlob();
    blob.workspace.animals[ANIMAL_ID].cameras = [
      {
        id: 0,
        meters_per_pixel: 0.00085,
        manufacturer: 'Allied Vision',
        model: 'Mako G-158',
        lens: 'Fujinon HF16HA-1B',
        camera_name: 'overhead_camera_w_track_alternation_arena_long_name',
      },
      {
        id: 1,
        meters_per_pixel: 0.0009,
        manufacturer: 'Allied Vision',
        model: 'Mako G-158',
        lens: 'Fujinon HF16HA-1B',
        camera_name: 'side_camera_w_track_alternation_arena_long_name',
      },
    ];
    addLongNamedDay(blob);

    await page.setViewportSize(NARROW);
    await seedWorkspace(page, blob);
    await page.goto('/#/validation');
    await page.reload(); // fresh document → store hydrates from the seeded blob

    // The cross-animal page heading and the day table are present.
    await expect(page.getByRole('heading', { level: 1, name: 'Validation Summary' })).toBeVisible();
    const table = page.getByRole('table', {
      name: 'Recording days across all animals with validation status',
    });
    await expect(table).toBeVisible();

    const pageOverflow = async () =>
      page.evaluate(() => {
        const el = document.documentElement;
        return el.scrollWidth - el.clientWidth;
      });

    // No horizontal PAGE overflow with just the table on screen (it scrolls within its own box).
    expect(await pageOverflow()).toBeLessThanOrEqual(1);

    // The dense 6-column table is genuinely wider than this phone viewport (verified ~1157px vs a
    // ~374px wrapper), so the fix must keep its content REACHABLE via inner horizontal scroll — not
    // merely keep the page narrow by hiding the overflow. Resolve the stable scroll wrapper from
    // the table's own DOM; the class is CSS-module hashed, so the test uses the explicit hook.
    const innerScroll = table.locator('xpath=ancestor::div[@data-testid="validation-table-scroll"][1]');
    await expect(innerScroll).toBeVisible();

    // Genuinely scrollable: the table content is wider than its container, so there is content to
    // scroll TO (this is what a "hidden off-screen, no scroll" regression would break). Polled so a
    // not-yet-settled first layout doesn't read a transiently-equal width.
    await expect
      .poll(async () =>
        innerScroll.evaluate((el) => el.scrollWidth - el.clientWidth),
      )
      .toBeGreaterThan(0);

    // The rightmost column ("Editor") starts OFF-screen at the initial (scrollLeft=0) position...
    const lastHeader = table.getByRole('columnheader', { name: 'Editor' });
    const viewportWidth = NARROW.width;
    await expect
      .poll(async () => lastHeader.evaluate((el) => el.getBoundingClientRect().left))
      .toBeGreaterThan(viewportWidth);

    // ...and scrolling the inner container to its end brings it WITHIN the viewport — reachable.
    await innerScroll.evaluate((el) => {
      el.scrollLeft = el.scrollWidth;
    });
    await expect
      .poll(async () => lastHeader.evaluate((el) => el.getBoundingClientRect().right))
      .toBeLessThanOrEqual(viewportWidth + 1);
    const headerLeftAfter = await lastHeader.evaluate((el) => el.getBoundingClientRect().left);
    expect(headerLeftAfter).toBeGreaterThanOrEqual(0);
    expect(headerLeftAfter).toBeLessThan(viewportWidth);

    // Inner-scrolling the table must NOT have introduced any horizontal PAGE overflow.
    expect(await pageOverflow()).toBeLessThanOrEqual(1);

    // Open the batch preflight (its long session-name values previously pushed the page wide).
    await page.getByRole('button', { name: 'Export Valid Only' }).click();
    await expect(
      page.getByRole('region', { name: 'Batch export preflight' }),
    ).toBeVisible();

    // Still no horizontal PAGE overflow with the preflight open.
    expect(await pageOverflow()).toBeLessThanOrEqual(1);
  });
});
