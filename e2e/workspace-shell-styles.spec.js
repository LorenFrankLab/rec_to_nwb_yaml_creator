/**
 * E2E: the application shell is styled on a DIRECT workspace load (R4).
 *
 * The shell (banner/logo, skip links, footer) is rendered by `AppLayout` on every route, but its
 * stylesheet used to be imported by the legacy form — which is now a lazily-loaded route. A visitor
 * who opened `#/workspace` directly got an unstyled shell: an oversized logo, both skip links sitting
 * inline at the top of the page, and footer links below the 24 px WCAG 2.2 target-size minimum. The
 * same screen then looked different after visiting the legacy form, because loading that route
 * finally pulled the shell rules in.
 *
 * jsdom cannot measure CSS, so this asserts computed styles in a real browser:
 *   1. on a COLD load of `#/workspace` (fresh context, legacy never visited);
 *   2. after a RELOAD of that URL;
 *   3. after legacy → workspace navigation — the three must agree; and
 *   4. that the legacy route still gets its own form styles.
 *
 * QA discipline: fresh context per test (Playwright's default), waits on locators (never sleeps),
 * computed styles read in-page.
 */

import { test, expect } from '@playwright/test';
import { resetWorkspace, seedAndOpen, buildConfiguredWorkspaceBlob, ANIMAL_ID } from './helpers/workspace';

/** The WCAG 2.2 (2.5.8) minimum target size the footer links are sized to. */
const MIN_TARGET_PX = 24;

/**
 * Read the shell's computed presentation: the first skip link's off-screen placement, the footer
 * link's target box, and the logo's rendered width.
 *
 * @param {import('@playwright/test').Page} page - The Playwright page.
 * @returns {Promise<object>} The shell style report.
 */
function probeShell(page) {
  return page.evaluate(() => {
    const skip = document.querySelector('.skip-link');
    const footerLink = document.querySelector('.footer a');
    const logo = document.querySelector('img[alt="Loren Frank Lab logo"]');
    const skipStyle = getComputedStyle(skip);
    return {
      skip: { position: skipStyle.position, left: skipStyle.left },
      footerLinkHeight: footerLink.getBoundingClientRect().height,
      footerLinkDisplay: getComputedStyle(footerLink).display,
      logoWidth: logo.getBoundingClientRect().width,
    };
  });
}

/**
 * Assert the shell carries its styles: the skip link is off-screen until focused and the footer
 * links meet the target-size minimum.
 *
 * @param {object} shell - A {@link probeShell} report.
 * @param {string} when - What was loaded, for the failure message.
 */
function expectStyledShell(shell, when) {
  expect(shell.skip.position, `${when}: skip link must be positioned off-screen`).toBe('absolute');
  expect(
    Number.parseFloat(shell.skip.left),
    `${when}: skip link must sit off-screen until focused`
  ).toBeLessThan(0);
  expect(
    shell.footerLinkHeight,
    `${when}: footer links must meet the ${MIN_TARGET_PX}px target size`
  ).toBeGreaterThanOrEqual(MIN_TARGET_PX);
  expect(shell.footerLinkDisplay, `${when}: footer links must be inline-block`).toBe('inline-block');
  expect(shell.logoWidth, `${when}: the logo must be the small banner logo`).toBeLessThanOrEqual(64);
}

test.describe('The app shell is styled on a direct workspace load (R4)', () => {
  test('a cold workspace load, a reload, and legacy → workspace agree', async ({ page }) => {
    // 1. Cold: this context has never rendered the legacy route.
    await page.goto('/#/workspace');
    await expect(page.getByRole('heading', { name: 'Animal Workspace' })).toBeVisible();
    const cold = await probeShell(page);
    expectStyledShell(cold, 'cold workspace load');

    // 2. Reload of the same URL.
    await page.reload();
    await expect(page.getByRole('heading', { name: 'Animal Workspace' })).toBeVisible();
    const reloaded = await probeShell(page);
    expectStyledShell(reloaded, 'workspace reload');

    // 3. Legacy → workspace: loading the legacy route must not CHANGE the workspace shell.
    await page.goto('/#/');
    await expect(page.locator('#main-content')).toBeVisible();
    await page.goto('/#/workspace');
    await expect(page.getByRole('heading', { name: 'Animal Workspace' })).toBeVisible();
    const afterLegacy = await probeShell(page);
    expectStyledShell(afterLegacy, 'workspace after legacy');

    expect(reloaded).toEqual(cold);
    expect(afterLegacy).toEqual(cold);
  });

  test('the skip link comes on screen only when focused', async ({ page }) => {
    await page.goto('/#/workspace');
    await expect(page.getByRole('heading', { name: 'Animal Workspace' })).toBeVisible();

    const skip = page.getByRole('link', { name: 'Skip to main content' });
    expect(Number.parseFloat((await probeShell(page)).skip.left)).toBeLessThan(0);

    await skip.focus();
    await expect(skip).toBeFocused();
    const focusedLeft = await skip.evaluate((el) => getComputedStyle(el).left);
    expect(Number.parseFloat(focusedLeft)).toBe(0);
  });

  test('a workspace form group keeps its row spacing without visiting legacy', async ({ page }) => {
    // `.form-container` is shared: the legacy form's field groups AND the workspace's Optogenetics
    // step (plus the recording-system fields). Left in the legacy stylesheet it lost its column gap
    // on a cold load — the same bug class as the shell rules.
    await resetWorkspace(page);
    const blob = buildConfiguredWorkspaceBlob();
    blob.workspace.animals[ANIMAL_ID].optogenetics = {
      opto_excitation_source: [{ name: 'Omicron LuxX+ Blue' }],
      optical_fiber: [],
      virus_injection: [],
      optogenetic_stimulation_software: 'fs-gui',
    };
    await seedAndOpen(page, blob, `/#/animal/${ANIMAL_ID}/optogenetics`);

    const group = page.getByRole('group', { name: 'Excitation source' });
    await expect(group).toBeVisible();
    const rowGap = await group
      .locator('.form-container')
      .first()
      .evaluate((el) => getComputedStyle(el).rowGap);
    expect(rowGap).toBe('10px');
  });

  test('the legacy form still gets its own form styles', async ({ page }) => {
    await page.goto('/#/');
    await expect(page.locator('#main-content')).toBeVisible();

    // A stable legacy-only rule: `.item1` is the form's right-aligned, bold label column.
    const label = page.locator('.item1').first();
    await expect(label).toBeVisible();
    const style = await label.evaluate((el) => {
      const computed = getComputedStyle(el);
      return { textAlign: computed.textAlign, fontWeight: computed.fontWeight };
    });
    expect(style.textAlign).toBe('right');
    expect(Number(style.fontWeight)).toBeGreaterThanOrEqual(700);

    // …and the shell is still styled on the legacy route.
    expectStyledShell(await probeShell(page), 'legacy route');
  });
});
