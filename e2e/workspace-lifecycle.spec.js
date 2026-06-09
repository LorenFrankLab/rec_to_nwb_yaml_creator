/**
 * E2E: Animal/day lifecycle — create, switch, and the destructive delete confirms + cleanup coherence.
 *
 * The browser pass proves the lifecycle UX jsdom can't: the inline create panel opens IN the picker
 * (never a route to a separate Home screen), the top object-selector's real keyboard focus
 * management (Esc returns focus to the trigger, Up/Down rove the rows), the type-to-confirm
 * animal-delete gate, and that deleting the CURRENTLY-VIEWED animal navigates to the workspace
 * rather than stranding the user on "Animal not found".
 *
 * QA discipline: role/accessible-name or route/href selectors only (never CSS class for app
 * controls); wait on locators/URLs/focus (never sleeps); reset + seed per test for independence.
 *
 * Verified menu shape (the prompt's "Open/Delete only" was stale): the picker-card and switcher-row
 * ⋮ menus carry Open / Edit profile… / Delete animal…; the header ⋮ carries Edit profile… / Delete
 * animal…. NONE carry a dead disabled "Rename…" placeholder — asserted below.
 */

import { test, expect } from '@playwright/test';
import {
  resetWorkspace,
  seedWorkspace,
  createAnimalViaUI,
  buildConfiguredWorkspaceBlob,
  makeEmptyAnimal,
  FIXED_TIMESTAMP,
  ANIMAL_ID,
  DAY_ID,
} from './helpers/workspace';

/**
 * The top object-selector (AnimalSwitcher) trigger on an animal route.
 * @param {import('@playwright/test').Page} page - The Playwright page.
 * @param {string} [current] - The currently-viewed animal id named in the trigger's accessible name.
 * @returns {import('@playwright/test').Locator} The switcher trigger button.
 */
const switcherTrigger = (page, current = ANIMAL_ID) =>
  page.getByRole('button', { name: `Switch animal (current: ${current})` });

test.describe('Animal lifecycle — create & switch', () => {
  test.beforeEach(async ({ page }) => {
    await resetWorkspace(page);
  });

  test('"+ New Animal" opens an inline create panel ON the picker (not a route) and lands on the new animal', async ({
    page,
  }) => {
    // Seed one animal so the populated-picker "+ New Animal" button (aria-label "Create new animal")
    // is the create entry point.
    await seedWorkspace(page, buildConfiguredWorkspaceBlob({ animals: { remy: makeEmptyAnimal('remy') } }));
    await page.goto('/#/workspace');
    await page.reload();
    await expect(page.getByRole('heading', { level: 1, name: 'Animal Workspace' })).toBeVisible();

    await page.getByRole('button', { name: 'Create new animal' }).click();

    // The create form appears INLINE on the picker — the route stays #/workspace (no jump to #/home).
    await expect(page).toHaveURL(/#\/workspace$/);
    await expect(page.getByRole('form', { name: 'Animal creation form' })).toBeVisible();

    // Completing the form (via the shared helper, which fills only the genuinely-required fields)
    // creates the animal and lands on its days route.
    // (The helper re-uses the "Create new animal" button it sees here.)
    await page.getByRole('button', { name: 'Cancel' }).click();
    const { animalId } = await createAnimalViaUI(page, { subjectId: 'nina' });
    await expect(page).toHaveURL(new RegExp(`#/animal/${animalId}/days`));
    await expect(page.getByRole('heading', { level: 1, name: animalId })).toBeVisible();
  });

  test('the top object-selector lists every animal with switch link + day count + per-row ⋮, and manages focus', async ({
    page,
  }) => {
    await seedWorkspace(
      page,
      buildConfiguredWorkspaceBlob({ animals: { remy: makeEmptyAnimal('remy'), totoro: makeEmptyAnimal('totoro') } })
    );
    await page.goto(`/#/animal/${ANIMAL_ID}/days`);
    await page.reload();

    // Open the selector.
    await switcherTrigger(page).click();
    const popup = page.getByRole('group', { name: 'Switch animal' });
    await expect(popup).toBeVisible();

    // Every animal is listed with a switch link, a day count, and its own ⋮.
    await expect(popup.getByRole('link', { name: 'remy' })).toBeVisible();
    await expect(popup.getByRole('link', { name: 'totoro' })).toBeVisible();
    await expect(popup.getByText('0 days').first()).toBeVisible();
    await expect(popup.getByRole('button', { name: 'remy actions' })).toBeVisible();
    await expect(popup.getByRole('button', { name: 'totoro actions' })).toBeVisible();
    // "+ New animal…" sits at the bottom.
    await expect(popup.getByRole('button', { name: 'New animal…' })).toBeVisible();

    // Focus management: open lands on the current animal's row; Down moves to the next row.
    await expect(popup.getByRole('link', { name: ANIMAL_ID })).toBeFocused();
    await page.keyboard.press('ArrowDown');
    await expect(popup.getByRole('link', { name: 'totoro' })).toBeFocused();

    // Esc closes the popup AND returns focus to the trigger.
    await page.keyboard.press('Escape');
    await expect(popup).toBeHidden();
    await expect(switcherTrigger(page)).toBeFocused();
  });

  test('the picker-card / switcher-row / header ⋮ menus carry no dead "Rename…" placeholder', async ({
    page,
  }) => {
    await seedWorkspace(page, buildConfiguredWorkspaceBlob({ animals: { remy: makeEmptyAnimal('remy') } }));

    // Picker card ⋮: Open / Edit profile… / Delete animal…
    await page.goto('/#/workspace');
    await page.reload();
    await page.getByRole('button', { name: `Actions for ${ANIMAL_ID}` }).click();
    const cardMenu = page.getByRole('menu', { name: `Actions for ${ANIMAL_ID}` });
    await expect(cardMenu.getByRole('menuitem', { name: 'Open' })).toBeVisible();
    await expect(cardMenu.getByRole('menuitem', { name: 'Edit profile…' })).toBeVisible();
    await expect(cardMenu.getByRole('menuitem', { name: 'Delete animal…' })).toBeVisible();
    await expect(cardMenu.getByRole('menuitem', { name: /Rename/ })).toHaveCount(0);

    // Header ⋮ on the animal route: Edit profile… / Delete animal… (no Open, no Rename).
    await page.goto(`/#/animal/${ANIMAL_ID}/days`);
    await page.reload();
    await page.getByRole('button', { name: `Actions for ${ANIMAL_ID}` }).click();
    const headerMenu = page.getByRole('menu', { name: `Actions for ${ANIMAL_ID}` });
    await expect(headerMenu.getByRole('menuitem', { name: 'Edit profile…' })).toBeVisible();
    await expect(headerMenu.getByRole('menuitem', { name: 'Delete animal…' })).toBeVisible();
    await expect(headerMenu.getByRole('menuitem', { name: /Rename/ })).toHaveCount(0);
  });
});

test.describe('Animal lifecycle — destructive delete confirms', () => {
  test.beforeEach(async ({ page }) => {
    await resetWorkspace(page);
  });

  test('selector ⋮ → Delete animal… for a NON-current animal: type-to-confirm gate, cascade copy, stays put', async ({
    page,
  }) => {
    // remy (current) + a second animal with one VALIDATED/EXPORTED day so the cascade copy names a
    // day count AND the downloaded-artifacts caveat.
    const other = makeEmptyAnimal('totoro');
    other.days = ['totoro-2023-06-22'];
    const otherDay = {
      id: 'totoro-2023-06-22',
      animalId: 'totoro',
      date: '2023-06-22',
      experimentDate: '06222023',
      session: { session_id: 'totoro_20230622', session_description: 'd', experiment_description: 'e' },
      tasks: [],
      behavioral_events: [],
      associated_files: [],
      associated_video_files: [],
      technical: { times_period_multiplier: 1.5, raw_data_to_volts: 0.195, default_header_file_path: '', units: undefined },
      state: { draft: false, validated: true, exported: true },
      created: FIXED_TIMESTAMP,
      lastModified: FIXED_TIMESTAMP,
      configurationVersion: 1,
    };
    const blob = buildConfiguredWorkspaceBlob({ animals: { remy: makeEmptyAnimal('remy'), totoro: other } });
    blob.workspace.days['totoro-2023-06-22'] = otherDay;
    await seedWorkspace(page, blob);
    await page.goto(`/#/animal/${ANIMAL_ID}/days`);
    await page.reload();

    // Open the non-current animal's row ⋮ → Delete animal….
    await switcherTrigger(page).click();
    await page.getByRole('button', { name: 'totoro actions' }).click();
    await page.getByRole('menuitem', { name: 'Delete animal…' }).click();

    const dialog = page.getByRole('alertdialog', { name: 'Delete animal?' });
    await expect(dialog).toBeVisible();
    // Cascade copy names the deletable day count + the downstream-not-deleted caveat.
    await expect(dialog.getByText(/Delete totoro and its 1 recording day/)).toBeVisible();
    await expect(dialog.getByText(/does not delete any YAML you already downloaded/)).toBeVisible();

    // The Delete button is DISABLED until the id is typed exactly.
    const deleteBtn = dialog.getByRole('button', { name: 'Delete animal' });
    await expect(deleteBtn).toBeDisabled();
    await dialog.getByRole('textbox').fill('totor'); // partial — still blocked
    await expect(deleteBtn).toBeDisabled();
    await dialog.getByRole('textbox').fill('totoro'); // exact match enables it
    await expect(deleteBtn).toBeEnabled();
    await deleteBtn.click();

    // totoro is gone; we STAY on remy's route (deleting a non-current animal doesn't move us).
    await expect(dialog).toBeHidden();
    await expect(page).toHaveURL(new RegExp(`#/animal/${ANIMAL_ID}/days`));
    await switcherTrigger(page).click();
    await expect(
      page.getByRole('group', { name: 'Switch animal' }).getByRole('link', { name: 'totoro' })
    ).toHaveCount(0);
  });

  test('header ⋮ → Delete animal… for the CURRENTLY-VIEWED animal: navigates to #/workspace, not a 404', async ({
    page,
  }) => {
    await seedWorkspace(
      page,
      buildConfiguredWorkspaceBlob({ animals: { remy: makeEmptyAnimal('remy'), totoro: makeEmptyAnimal('totoro') } })
    );
    await page.goto(`/#/animal/${ANIMAL_ID}/days`);
    await page.reload();

    await page.getByRole('button', { name: `Actions for ${ANIMAL_ID}` }).click();
    await page.getByRole('menuitem', { name: 'Delete animal…' }).click();

    const dialog = page.getByRole('alertdialog', { name: 'Delete animal?' });
    await expect(dialog).toBeVisible();
    await dialog.getByRole('textbox').fill(ANIMAL_ID);
    await dialog.getByRole('button', { name: 'Delete animal' }).click();

    // Deleting the viewed animal lands on the workspace picker — NOT AnimalView's "Animal not found".
    await expect(page).toHaveURL(/#\/workspace$/);
    await expect(page.getByRole('heading', { level: 1, name: 'Animal Workspace' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Animal not found' })).toHaveCount(0);
  });
});

test.describe('Day lifecycle — plain delete confirm + cleanup coherence', () => {
  test.beforeEach(async ({ page }) => {
    await resetWorkspace(page);
  });

  test('OK day → Delete day…: a PLAIN Cancel/Delete confirm (no typed gate); Cancel preserves the day', async ({
    page,
  }) => {
    await seedWorkspace(page, buildConfiguredWorkspaceBlob());
    await page.goto(`/#/animal/${ANIMAL_ID}/days`);
    await page.reload();
    await expect(page.getByRole('heading', { level: 2, name: `Recording Days for ${ANIMAL_ID}` })).toBeVisible();

    await page.getByRole('button', { name: /^Delete recording day/ }).click();
    const dialog = page.getByRole('alertdialog', { name: 'Delete recording day?' });
    await expect(dialog).toBeVisible();
    // PLAIN confirm — no type-to-confirm gate (an OK day is low-blast-radius vs. a whole animal).
    await expect(dialog.getByRole('textbox')).toHaveCount(0);
    await expect(dialog.getByRole('button', { name: 'Cancel' })).toBeVisible();
    await expect(dialog.getByRole('button', { name: 'Delete day' })).toBeVisible();

    // Cancel preserves the day.
    await dialog.getByRole('button', { name: 'Cancel' }).click();
    await expect(dialog).toBeHidden();
    await expect(page.getByRole('link', { name: /^06222023|2023-06-22/ }).first()).toBeVisible();
    await expect(page.getByRole('button', { name: /^Delete recording day/ })).toBeVisible();
  });

  test('a validated/exported day adds the downloaded-artifacts caveat; Confirm removes ONLY that day (a sibling day survives)', async ({
    page,
  }) => {
    // Seed TWO days so "only that day" is actually provable: the original seeded day
    // (2023-06-22, marked validated+exported so the artifacts caveat appears) plus a SIBLING day on
    // a different date (2023-06-23) registered in both `animal.days` and `workspace.days`. Distinct
    // dates give each row a distinct day-link href + a distinct "Delete recording day <date>…"
    // accessible name, so we target one without ambiguity.
    const blob = buildConfiguredWorkspaceBlob();
    blob.workspace.days[DAY_ID].state = { draft: false, validated: true, exported: true };

    const SIBLING_ID = 'remy-2023-06-23';
    blob.workspace.days[SIBLING_ID] = {
      ...structuredClone(blob.workspace.days[DAY_ID]),
      id: SIBLING_ID,
      date: '2023-06-23',
      experimentDate: '06232023',
      state: { draft: false, validated: true, exported: false },
    };
    blob.workspace.animals[ANIMAL_ID].days = [DAY_ID, SIBLING_ID];

    await seedWorkspace(page, blob);
    await page.goto(`/#/animal/${ANIMAL_ID}/days`);
    await page.reload();

    // Both day rows are present before the delete (target by the day-link href — the row's stable id).
    const targetLink = page.locator(`a[href="#/day/${DAY_ID}"]`);
    const siblingLink = page.locator(`a[href="#/day/${SIBLING_ID}"]`);
    await expect(targetLink).toBeVisible();
    await expect(siblingLink).toBeVisible();

    // Delete the 2023-06-22 day specifically (its own accessible-named delete button).
    await page.getByRole('button', { name: 'Delete recording day 2023-06-22…' }).click();
    const dialog = page.getByRole('alertdialog', { name: 'Delete recording day?' });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText(/does not delete any YAML you already downloaded/)).toBeVisible();

    // Confirm removes ONLY that day: (a) the deleted day's row is GONE, (b) the sibling SURVIVES.
    await dialog.getByRole('button', { name: 'Delete day' }).click();
    await expect(dialog).toBeHidden();
    await expect(targetLink).toHaveCount(0);
    await expect(siblingLink).toBeVisible();
    // The empty-state is NOT shown (a day still exists) — proves we didn't wipe the list.
    await expect(page.getByText('No recording days yet.')).toHaveCount(0);
  });
});
