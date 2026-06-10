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
    await expect(
      page.getByRole('table', { name: 'Recording days across all animals with validation status' }),
    ).toBeVisible();

    const pageOverflow = async () =>
      page.evaluate(() => {
        const el = document.documentElement;
        return el.scrollWidth - el.clientWidth;
      });

    // No horizontal PAGE overflow with just the table on screen (it scrolls within its own box).
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
