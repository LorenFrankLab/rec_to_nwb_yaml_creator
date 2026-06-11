/**
 * E2E: Day Editor — direct day-to-day navigation must not leak prior-day field values.
 *
 * The Day Editor is a single route (#/day/:id) whose active day comes from the URL. Some
 * day-scoped inputs (the Overview Session/Experiment Description textareas) are uncontrolled, so
 * if the editor is reconciled in place across a DIRECT day→day hash change — e.g. browser
 * back/forward between two day URLs, with no intervening view change — the prior day's text would
 * remain on screen, and a later blur could write it into the WRONG day (silent cross-day data
 * corruption). The editor is keyed by the routed day id so such a navigation remounts it.
 *
 * Discipline: role/accessible-name selectors only; wait on locators (never sleeps).
 */
import { test, expect } from '@playwright/test';
import { seedAndOpen, buildConfiguredWorkspaceBlob, ANIMAL_ID } from './helpers/workspace';

test.describe('Day Editor — direct day-to-day navigation', () => {
  test('a direct #/day/A → #/day/B hash change shows the NEW day\'s fields, never the prior day\'s', async ({
    page,
  }) => {
    const blob = buildConfiguredWorkspaceBlob();
    const dayAId = Object.keys(blob.workspace.days)[0];
    const dayA = blob.workspace.days[dayAId];
    dayA.session.session_description = 'DAY A SESSION DESC';

    // A second day on the same animal, with a clearly different session description.
    const dayBId = 'remy-2023-06-23';
    const dayB = structuredClone(dayA);
    dayB.id = dayBId;
    dayB.date = '2023-06-23';
    dayB.experimentDate = '06232023';
    dayB.session = {
      ...dayB.session,
      session_id: 'remy_20230623',
      session_description: 'DAY B SESSION DESC',
    };
    blob.workspace.days[dayBId] = dayB;
    blob.workspace.animals[ANIMAL_ID].days = [dayAId, dayBId];

    await seedAndOpen(page, blob, `/#/day/${dayAId}`);

    const sessionDescription = () => page.getByRole('textbox', { name: 'Session Description *' });
    await expect(sessionDescription()).toHaveValue('DAY A SESSION DESC');

    // Direct day→day hash change (no view change, no full reload) — the back/forward path.
    await page.evaluate((id) => {
      window.location.hash = `#/day/${id}`;
    }, dayBId);

    // The editor remounts on the new day id: it shows DAY B's value, not DAY A's stale text.
    await expect(
      page.getByRole('heading', { level: 1, name: /Day Editor: remy - 2023-06-23/ })
    ).toBeVisible();
    await expect(sessionDescription()).toHaveValue('DAY B SESSION DESC');
  });
});
