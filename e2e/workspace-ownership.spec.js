/**
 * E2E: Ownership / discoverability + nav-focus-guard lifecycle on the tabbed Animal View.
 *
 * jsdom already pins the routing/status LOGIC; this browser pass proves what jsdom can't: that the
 * documented navigations re-render LIVE, that focus actually moves to the panel on a tab change,
 * that the live status cues (scope descriptors, the neutral opto chip, the blocking ● on the
 * section-nav, the reconfiguration banner) are really VISIBLE on the right route, and that the
 * cold-deep-link / stale-route guards don't strand the user.
 *
 * QA discipline: role/accessible-name or route/href selectors only (never CSS class for app
 * controls — asserting `.repair-target-highlight` is the one allowed exception and is not used
 * here); wait on locators/URLs/focus (never sleeps); reset + seed per test for independence.
 *
 * What is NOT here (already covered, not duplicated):
 *  - the `?field=` repair → Cameras-tab highlight (workspace-export-gate.spec.js);
 *  - same-day / catch-up batch export (workspace-workflows.spec.js).
 *
 * Behaviour notes: the "discard unsaved changes?" guard
 * (AnimalView.handleNavClick) is NOT reachable through the shipped UI — every setup editor that
 * reports pending edits is a focus-trapping Modal whose overlay intercepts pointer events on the
 * section-nav, so a user can't click another section while one is open. This spec asserts that
 * ACTUAL behavior (the overlay blocks the nav) rather than a discard flow that can't be triggered.
 * Likewise the first-run setup card's "Needs fixing" state is unreachable: a blocking error needs a
 * recording day, but having a day marks the animal established and hides the card — so this spec
 * asserts the blocking ● on the section-nav + the in-animal export review link instead.
 */

import { test, expect } from '@playwright/test';
import {
  resetWorkspace,
  seedWorkspace,
  seedAndOpen,
  buildConfiguredWorkspaceBlob,
  makeEmptyAnimal,
  ANIMAL_ID,
  DAY_ID,
} from './helpers/workspace';

/**
 * The exact scope-descriptor strings AnimalView renders under each setup tab's heading (TAB_SCOPE
 * in src/pages/AnimalView/index.jsx). Pinned here so a copy change is caught, not silently passed.
 * @type {Record<string,string>}
 */
const TAB_SCOPE = {
  'electrode-groups':
    'Shared across all recording days — a hardware change starts a new version (with an audit trail).',
  'recording-system': 'Animal-wide catalog — each recording day uses one.',
  cameras: 'Catalog — referenced per day.',
};

/**
 * A behavior-only second animal `totoro` with ZERO setup (no electrode groups, channel maps,
 * recording system, or cameras) but a valid subject + a base configuration history. Built from the
 * shared {@link makeEmptyAnimal} (which mirrors what `createAnimal` writes) with only the subject
 * description tweaked. Verified to hydrate cleanly on `#/animal/totoro/days` (every setup section
 * reads the neutral ○ "not set up" todo state, the first-run "Set up this animal" card shows, and no
 * day is required).
 *
 * @returns {object} A loader-ready `totoro` animal record.
 */
const buildBehaviorOnlyAnimal = () =>
  makeEmptyAnimal('totoro', { subject: { description: 'Behavior-only subject' } });

/**
 * The AnimalView section-nav (the navigation landmark) locator.
 * @param {import('@playwright/test').Page} page - The Playwright page.
 * @returns {import('@playwright/test').Locator} The "Animal sections" navigation landmark.
 */
const sectionNav = (page) => page.getByRole('navigation', { name: 'Animal sections' });

test.describe('Ownership & discoverability — AnimalView header + section-nav + scope cues', () => {
  test.beforeEach(async ({ page }) => {
    await resetWorkspace(page);
  });

  test('header band shows the animal identity (name, animal ID badge, species · sex) and a ⋮ menu', async ({
    page,
  }) => {
    await seedAndOpen(page, buildConfiguredWorkspaceBlob(), `/#/animal/${ANIMAL_ID}/days`);

    // The animal name is the page h1.
    await expect(page.getByRole('heading', { level: 1, name: ANIMAL_ID })).toBeVisible();
    // An "animal ID" badge + the species · sex facts identify whose data this is (ownership cue).
    await expect(page.getByText('animal ID', { exact: true })).toBeVisible();
    await expect(page.getByText('Rattus norvegicus · M')).toBeVisible();
    // The per-animal lifecycle ⋮ is present (its menu is exercised in the lifecycle spec).
    await expect(page.getByRole('button', { name: `Actions for ${ANIMAL_ID}` })).toBeVisible();
  });

  test('section-nav is a landmark grouped "Day work" / "Animal setup" with name · count · › rows', async ({
    page,
  }) => {
    await seedAndOpen(page, buildConfiguredWorkspaceBlob(), `/#/animal/${ANIMAL_ID}/days`);

    const nav = sectionNav(page);
    await expect(nav).toBeVisible();
    // Both ownership groups are present.
    await expect(nav.getByText('Day work', { exact: true })).toBeVisible();
    await expect(nav.getByText('Animal setup', { exact: true })).toBeVisible();
    // Day-work rows.
    await expect(nav.getByRole('link', { name: /^Recording Days/ })).toBeVisible();
    await expect(nav.getByRole('link', { name: /^Validation & Export/ })).toBeVisible();
    // Setup rows.
    for (const name of ['Electrode Groups', 'Recording System', 'Cameras', 'Optogenetics']) {
      await expect(nav.getByRole('link', { name: new RegExp(`^${name}`) })).toBeVisible();
    }
    // The manual Channel Maps tab was removed (maps are auto-generated from each group's device type).
    await expect(nav.getByRole('link', { name: /^Channel Maps/ })).toHaveCount(0);
    // Information scent: the Recording Days row carries its day count (1 for the single seeded day).
    const daysRow = nav.getByRole('link', { name: /^Recording Days/ });
    await expect(daysRow.getByText('1', { exact: true })).toBeVisible();
    await expect(daysRow.getByText('›', { exact: true })).toBeVisible();
  });

  test('each setup tab shows its scope descriptor (ownership / blast-radius framing) — VISIBLE', async ({
    page,
  }) => {
    for (const [tab, scope] of Object.entries(TAB_SCOPE)) {
      await seedAndOpen(page, buildConfiguredWorkspaceBlob(), `/#/animal/${ANIMAL_ID}/${tab}`);
      await expect(page.getByTestId(`panel-scope-${tab}`)).toHaveText(scope);
    }
  });

  test('behavior-only animal: optogenetics shows the neutral "Not used" chip (not an error)', async ({
    page,
  }) => {
    await seedWorkspace(page, buildConfiguredWorkspaceBlob({ animals: { totoro: buildBehaviorOnlyAnimal() } }));
    await page.goto('/#/animal/totoro/optogenetics');
    await page.reload();

    const chip = page.getByTestId('opto-status-chip');
    await expect(chip).toBeVisible();
    await expect(chip).toHaveText('Not used — no stimulation');
    // It is a neutral status chip, NOT an alert/error region.
    await expect(page.getByRole('alert')).toHaveCount(0);
  });

  test('behavior-only animal: first-run "Set up this animal" card lists sections with honest hints and is NON-gating', async ({
    page,
  }) => {
    await seedWorkspace(page, buildConfiguredWorkspaceBlob({ animals: { totoro: buildBehaviorOnlyAnimal() } }));
    await page.goto('/#/animal/totoro/days');
    await page.reload();

    const card = page.getByRole('region', { name: 'Set up this animal' });
    await expect(card).toBeVisible();
    // Honest, conditional hints — none mandatory (a behavior-only day needs no electrodes).
    await expect(card.getByText('Add only what your recordings use')).toBeVisible();
    // Per-section rows with honest hints + a "Set up →" link to the owning tab.
    const expectRow = async (label, hint) => {
      const item = card.getByRole('listitem').filter({ hasText: label });
      await expect(item.getByText(hint, { exact: true })).toBeVisible();
      const link = card.getByRole('link', { name: `Set up ${label}` });
      await expect(link).toBeVisible();
      await expect(link).toHaveAttribute(
        'href',
        `#/animal/totoro/${label.toLowerCase().replace(/ /g, '-')}`
      );
    };
    await expectRow('Electrode Groups', 'if ephys');
    await expectRow('Recording System', 'data acquisition');
    await expectRow('Cameras', 'if video');
    await expectRow('Optogenetics', 'if opto');

    // NON-gating: a behavior-only animal can still reach its days surface — the empty-day onboarding
    // state is shown (no mandatory-setup block prevents adding/exporting days), and the "Add Recording
    // Days" primary action is available.
    await expect(page.getByRole('heading', { name: /no recording days yet/i })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Add Recording Days' })).toBeVisible();
  });

  test('a camera missing meters_per_pixel: the Cameras nav row shows a blocking ● and the in-animal export-review link targets THIS animal', async ({
    page,
  }) => {
    // Camera 0's meters_per_pixel is the empty string (schema `type: number` → an error attributed to
    // the animal-owned Cameras tab). The single seeded day references the cameras, so the blocker is
    // attributed to the section-nav.
    const blob = buildConfiguredWorkspaceBlob();
    blob.workspace.animals[ANIMAL_ID].cameras[0].meters_per_pixel = '';
    // The "Existing data review" banner is shown only when there is something to REVIEW — recovered/
    // corrupt/wrong-owner records — not merely because a day fails validation (a clean
    // established animal must not show a standing review task). So seed a recovered-unlinked (orphan)
    // day record — owned by this animal but absent from its day index — which is exactly the state the
    // review banner exists to surface, and which renders the in-animal Validation & Export re-link.
    const orphanId = `${ANIMAL_ID}-orphan`;
    blob.workspace.days[orphanId] = {
      ...blob.workspace.days[DAY_ID],
      id: orphanId,
      date: '2023-07-01',
    };
    // Intentionally NOT added to animals[ANIMAL_ID].days — that absence is what makes it an orphan.
    await seedAndOpen(page, blob, `/#/animal/${ANIMAL_ID}/days`);

    // The Cameras section-nav row advertises the block in its accessible name + carries the red ●.
    const camerasRow = sectionNav(page).getByRole('link', { name: 'Cameras — blocks export' });
    await expect(camerasRow).toBeVisible();

    // The existing-data review link is THIS animal's export (not the cross-animal #/validation). The
    // banner renders the same in-animal export link in the orphan note and the footer — assert the
    // first; both must target this animal's export tab.
    const reviewLink = page
      .getByRole('region', { name: 'Existing data review' })
      .getByRole('link', { name: /Validation & Export/ })
      .first();
    await expect(reviewLink).toBeVisible();
    await expect(reviewLink).toHaveAttribute('href', `#/animal/${ANIMAL_ID}/export`);
  });

  test('reconfiguration deep-link lands on the electrode-groups tab with the context banner and preserved params', async ({
    page,
  }) => {
    // The ReconfigWizard emits `#/animal/:id/electrode-groups?context=reconfigure&version=&fromDay=&movedDays=`
    // (src/pages/DayEditor/ReconfigWizard.jsx). Land there directly and assert the banner renders the
    // version context, the params survive, and the electrode-groups tab is active.
    const params = 'context=reconfigure&version=1&fromDay=' + DAY_ID + '&movedDays=2';
    await seedAndOpen(
      page,
      buildConfiguredWorkspaceBlob(),
      `/#/animal/${ANIMAL_ID}/electrode-groups?${params}`
    );

    // The electrode-groups tab is the active section.
    await expect(
      sectionNav(page).getByRole('link', { name: /^Electrode Groups/ })
    ).toHaveAttribute('aria-current', 'page');
    // Its scope descriptor is shown (we really landed on the versioned-identity tab).
    await expect(page.getByTestId('panel-scope-electrode-groups')).toHaveText(
      TAB_SCOPE['electrode-groups']
    );

    // The reconfiguration context banner (role=status) names the version being edited.
    const banner = page.getByRole('status').filter({ hasText: /configuration v1/ });
    await expect(banner).toBeVisible();
    await expect(banner).toContainText('Editing latest configuration v1');
    await expect(banner).toContainText('Moved 2 days to this version.');

    // The deep-link params are preserved in the URL (the wizard's context survives the landing).
    await expect(page).toHaveURL(/context=reconfigure/);
    await expect(page).toHaveURL(/version=1/);
    await expect(page).toHaveURL(/movedDays=2/);
  });
});

test.describe('Section-nav: navigation, focus, and route guards (the jsdom-can\'t-prove core)', () => {
  test.beforeEach(async ({ page }) => {
    await resetWorkspace(page);
  });

  test('clicking a section-nav link updates the URL, sets aria-current, and MOVES FOCUS to the panel', async ({
    page,
  }) => {
    await seedAndOpen(page, buildConfiguredWorkspaceBlob(), `/#/animal/${ANIMAL_ID}/days`);

    // Click the Cameras section-nav link.
    await sectionNav(page).getByRole('link', { name: /^Cameras/ }).click();

    // URL changed to the tab route.
    await expect(page).toHaveURL(new RegExp(`#/animal/${ANIMAL_ID}/cameras`));
    // The clicked link is the active tab.
    await expect(
      sectionNav(page).getByRole('link', { name: /^Cameras/ })
    ).toHaveAttribute('aria-current', 'page');
    // Focus moved onto the panel (the section labelled by the active tab) — keyboard/SR users land
    // on the new content, not back at the top. jsdom can't prove real focus; the browser can.
    const panel = page.getByRole('region', { name: 'Cameras' });
    await expect(panel).toBeFocused();
  });

  test('a setup editor (a focus-trapping Modal) blocks the section-nav — the overlay intercepts the click', async ({
    page,
  }) => {
    // Note: the "discard unsaved changes?" guard (handleNavClick) is not reachable in the
    // shipped UI because every pending-edits editor is a focus-trapping Modal. Assert the ACTUAL
    // behavior: with the Electrode Group modal open, its overlay intercepts pointer events so a
    // section-nav link cannot be clicked (the user must close the modal first).
    await seedAndOpen(page, buildConfiguredWorkspaceBlob(), `/#/animal/${ANIMAL_ID}/electrode-groups`);

    // The realistic fixture opens on the safe re-sync prompt; load the saved config to edit a group.
    await page.getByRole('button', { name: 'Load saved electrode configuration' }).click();
    await page.getByRole('button', { name: 'Edit electrode group 0' }).click();

    const dialog = page.getByRole('dialog', { name: 'Edit Electrode Group' });
    await expect(dialog).toBeVisible();

    // The modal overlay blocks a section-nav click: a non-forced click times out because the overlay
    // intercepts pointer events. A forced click does not navigate away (the modal stays open).
    const camerasLink = sectionNav(page).getByRole('link', { name: /^Cameras/ });
    await expect(
      camerasLink.click({ timeout: 1500 }),
      'the modal overlay should intercept the section-nav click'
    ).rejects.toThrow();
    // We are still on the electrode-groups tab with the editor open (the nav was not reachable).
    await expect(page).toHaveURL(new RegExp(`#/animal/${ANIMAL_ID}/electrode-groups`));
    await expect(dialog).toBeVisible();
  });

  test('bare #/animal/:id and a stale #/animal/:id/editor both resolve to the days tab', async ({
    page,
  }) => {
    // Bare route → days. seedAndOpen reloads on a fresh document, so the canonicalize effect runs.
    await seedAndOpen(page, buildConfiguredWorkspaceBlob(), `/#/animal/${ANIMAL_ID}`);
    await expect(page).toHaveURL(new RegExp(`#/animal/${ANIMAL_ID}/days$`));
    await expect(page.getByRole('heading', { level: 2, name: `Recording Days for ${ANIMAL_ID}` })).toBeVisible();

    // Stale legacy `/editor` route → days (graceful redirect of a removed route, cold-load).
    await seedAndOpen(page, buildConfiguredWorkspaceBlob(), `/#/animal/${ANIMAL_ID}/editor`);
    await expect(page).toHaveURL(new RegExp(`#/animal/${ANIMAL_ID}/days$`));
    await expect(page.getByRole('heading', { level: 2, name: `Recording Days for ${ANIMAL_ID}` })).toBeVisible();
  });

  test('a cold deep-link to a non-existent animal renders a non-stranding "Animal not found" with a way out', async ({
    page,
  }) => {
    await seedAndOpen(page, buildConfiguredWorkspaceBlob(), '/#/animal/ghost/days');

    // Not a perpetual "Loading…" — a real, escapable not-found.
    await expect(page.getByRole('heading', { level: 1, name: 'Animal not found' })).toBeVisible();
    await expect(page.getByText(/No animal “ghost” in this workspace/)).toBeVisible();
    const back = page.getByRole('link', { name: /Back to Workspace/ });
    await expect(back).toHaveAttribute('href', '#/workspace');
  });
});
