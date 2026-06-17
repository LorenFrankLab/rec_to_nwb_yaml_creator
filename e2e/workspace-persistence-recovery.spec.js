/**
 * E2E: Workspace persistence & RECOVERY.
 *
 * Companion to workspace-persistence.spec.js (which proves a UI-created animal autosaves
 * and survives a reload). This file covers the harder persistence paths that protect
 * irreplaceable scientific metadata from silent data loss:
 *
 *   1. A richer SEEDED blob (configured animal + day) survives a full reload.
 *   2. An empty / malformed persisted blob never CRASHES the app and surfaces a visible
 *      recovery/discard NOTICE (the prior `Object.keys(undefined)` crash on an empty blob
 *      is now guarded; a corrupt blob is discarded loudly, not silently).
 *   3. A FAILED autosave (storage write throws) keeps the unsaved-work guard armed and
 *      surfaces a save-failure state — proven in-browser by stubbing `localStorage.setItem`
 *      to throw for the workspace key while leaving reads working.
 *   4. A YAML import missing required fields surfaces them on the Import & Repair screen
 *      (and blocks the import) rather than failing silently.
 *
 * Discipline: role/accessible-name or route selectors only (never CSS class for app
 * controls); wait on locators/URLs/events (never fixed sleeps); assert localStorage via
 * expect.poll. Each test resets/seeds its own state for independence. The setItem-throw
 * stub is installed via addInitScript, which Playwright scopes per browser context — and
 * every test gets a fresh context by default — so the stub never leaks into other tests.
 */

import { test, expect } from '@playwright/test';
import {
  STORAGE_KEY,
  SCHEMA_VERSION,
  ANIMAL_ID,
  DAY_ID,
  resetWorkspace,
  seedWorkspace,
  buildConfiguredWorkspaceBlob,
} from './helpers/workspace.js';

/**
 * Install a localStorage.setItem stub (via addInitScript, so it survives the reload into a
 * fresh document) that THROWS a QuotaExceeded-style error for writes to the workspace key,
 * while leaving reads and all other keys working. This is the intended mechanism for
 * proving the failed-autosave path in-browser. Call BEFORE the first navigation.
 *
 * @param {import('@playwright/test').Page} page - The Playwright page.
 * @param {string} storageKey - The workspace localStorage key whose writes should throw.
 * @returns {Promise<void>} Resolves once the init script is registered.
 */
async function stubFailingWorkspaceWrites(page, storageKey) {
  await page.addInitScript((key) => {
    const proto = window.Storage.prototype;
    const originalSetItem = proto.setItem;
    proto.setItem = function patchedSetItem(k, v) {
      if (k === key) {
        const err = new Error('QuotaExceededError: persisted storage is full');
        err.name = 'QuotaExceededError';
        throw err;
      }
      return originalSetItem.call(this, k, v);
    };
  }, storageKey);
}

test.describe('Workspace persistence & recovery', () => {
  test('a seeded configured workspace survives a full reload', async ({ page }) => {
    // Seed a RICH blob (configured animal `remy` + its recording day) — distinct from the
    // existing spec's UI-created single animal — then re-hydrate from a fresh document.
    await seedWorkspace(page, buildConfiguredWorkspaceBlob());

    // The seeded animal is on the picker immediately after hydration.
    await expect(page.getByRole('heading', { level: 1, name: 'Animal Workspace' })).toBeVisible();
    await expect(
      page.getByRole('link', { name: new RegExp(`^${ANIMAL_ID}`) }),
    ).toBeVisible();

    // Open the animal and confirm its seeded recording day is present (proves the day
    // record — not just the animal — round-tripped through hydration).
    await page.goto(`/#/animal/${ANIMAL_ID}/days`);
    await expect(page.getByRole('heading', { level: 1, name: ANIMAL_ID })).toBeVisible();
    await expect(page.getByText('2023-06-22').first()).toBeVisible();

    // Now do a genuine full reload from the picker and assert it STILL persists. The blob
    // is version-gated and contains both the animal and its day id.
    await page.goto('/#/workspace');
    await page.reload();
    await expect(
      page.getByRole('link', { name: new RegExp(`^${ANIMAL_ID}`) }),
    ).toBeVisible();
    await expect
      .poll(async () =>
        page.evaluate((key) => {
          const raw = window.localStorage.getItem(key);
          if (!raw) return null;
          const blob = JSON.parse(raw);
          return {
            animals: Object.keys(blob.workspace?.animals ?? {}),
            days: Object.keys(blob.workspace?.days ?? {}),
          };
        }, STORAGE_KEY),
      )
      .toEqual({ animals: [ANIMAL_ID], days: [DAY_ID] });
  });

  test('an empty workspace blob recovers (no crash) with a "missing sections" notice', async ({
    page,
  }) => {
    // The known prior crash: `{ schemaVersion, workspace: {} }` left consumers to hit
    // `Object.keys(undefined)`. The loader now restores the absent top-level sections and
    // reports them via a recovery notice instead of crashing.
    await page.goto('/#/workspace');
    await page.evaluate(
      ([key, version]) =>
        window.localStorage.setItem(key, JSON.stringify({ schemaVersion: version, workspace: {} })),
      [STORAGE_KEY, SCHEMA_VERSION],
    );
    await page.reload();

    // Does NOT crash: the workspace heading still renders.
    await expect(page.getByRole('heading', { level: 1, name: 'Animal Workspace' })).toBeVisible();
    await expect(page.getByText('No animals created yet.')).toBeVisible();

    // A visible recovery notice names what was restored (animals, days, settings).
    const notice = page.getByRole('alert');
    await expect(notice).toBeVisible();
    await expect(notice).toContainText('Saved workspace was missing required sections');
    await expect(notice).toContainText('animals, days, settings');

    // The notice is dismissible (Dismiss notice button), and the blob was NOT discarded
    // (a recovery keeps the salvaged data; only the discard path clears storage).
    await expect(page.getByRole('button', { name: 'Dismiss notice' })).toBeVisible();
    await expect
      .poll(async () => page.evaluate((key) => window.localStorage.getItem(key), STORAGE_KEY))
      .not.toBeNull();
  });

  test('a corrupt (non-JSON) blob is discarded with a visible notice, no crash', async ({
    page,
  }) => {
    await page.goto('/#/workspace');
    await page.evaluate(
      (key) => window.localStorage.setItem(key, 'this is not json {{{ — totally corrupt'),
      STORAGE_KEY,
    );
    await page.reload();

    // Does NOT crash: the workspace heading and empty state still render.
    await expect(page.getByRole('heading', { level: 1, name: 'Animal Workspace' })).toBeVisible();
    await expect(page.getByText('No animals created yet.')).toBeVisible();

    // A visible discard notice — the corrupt blob is never silently swallowed.
    const notice = page.getByRole('alert');
    await expect(notice).toBeVisible();
    await expect(notice).toContainText('could not be restored');
    await expect(notice).toContainText('discarded');

    // The unusable blob is cleared so it isn't re-read on the next load.
    await expect
      .poll(async () => page.evaluate((key) => window.localStorage.getItem(key), STORAGE_KEY))
      .toBeNull();

    // The notice can be dismissed.
    await page.getByRole('button', { name: 'Dismiss notice' }).click();
    await expect(notice).toHaveCount(0);
  });

  test('a malformed blob whose required section is wrong-typed is discarded, not laundered', async ({
    page,
  }) => {
    // A present-but-wrong-typed required section (`animals` as an array) is genuine
    // corruption, not absence: it must be discarded loudly, NOT silently overwritten and
    // mislabeled as "restored". This guards against destroying real data under a recovery.
    await page.goto('/#/workspace');
    await page.evaluate(
      ([key, version]) =>
        window.localStorage.setItem(
          key,
          JSON.stringify({
            schemaVersion: version,
            workspace: { animals: [], days: {}, settings: {} },
          }),
        ),
      [STORAGE_KEY, SCHEMA_VERSION],
    );
    await page.reload();

    await expect(page.getByRole('heading', { level: 1, name: 'Animal Workspace' })).toBeVisible();
    const notice = page.getByRole('alert');
    await expect(notice).toBeVisible();
    await expect(notice).toContainText('could not be restored');
    await expect(notice).toContainText('discarded');
    await expect
      .poll(async () => page.evaluate((key) => window.localStorage.getItem(key), STORAGE_KEY))
      .toBeNull();
  });

  test('a failed autosave shows the save-failure state and keeps the unsaved-work guard armed', async ({
    page,
  }) => {
    // Seed the configured blob FIRST, while writes still work — the stub would otherwise
    // make the seed itself throw and leave an empty workspace.
    await seedWorkspace(page, buildConfiguredWorkspaceBlob());

    // NOW arm the throwing stub (init script → survives the reload into the day editor's
    // fresh document). Reads keep working, so the already-seeded day still hydrates; only
    // subsequent WRITES (the autosave) fail.
    await stubFailingWorkspaceWrites(page, STORAGE_KEY);
    await page.goto(`/#/day/${DAY_ID}`);
    await page.reload(); // fresh document → store hydrates from the seeded blob, stub active

    // The day editor renders (read path is intact).
    await expect(
      page.getByRole('heading', { level: 1, name: `Day Editor: ${ANIMAL_ID} - 2023-06-22` }),
    ).toBeVisible();

    // Edit a day-owned field so a workspace change triggers the debounced autosave, whose
    // write will throw. Editing Session Description → updateDay → autosave.
    const sessionDescription = page.getByRole('textbox', { name: 'Session Description *' });
    await expect(sessionDescription).toBeVisible();
    await sessionDescription.fill('Edited so autosave fires and fails');
    await sessionDescription.blur();

    // In-browser signal #1: the SaveIndicator surfaces the failure as an assertive alert
    // ("Could not save workspace: …"). This is the user-visible save-failure state. (Its
    // accessible name carries the QuotaExceeded message the throwing write produced.)
    const saveError = page.getByRole('alert').filter({ hasText: 'Could not save workspace' });
    await expect(saveError).toBeVisible();
    await expect(saveError).toContainText('QuotaExceededError');

    // In-browser signal #2: the unsaved-work guard stays ARMED. AppLayout wires the
    // beforeunload listener to `hasPendingWrite || saveError`, so after a failed save the
    // handler is registered and calls preventDefault — that is what makes the browser show
    // the native "leave site?" prompt. We assert it directly by dispatching a cancelable
    // beforeunload event and checking the app's handler prevented the default (rather than
    // actually unloading the page, which would block on the native dialog and hang the
    // test). A cleared guard would NOT prevent the default.
    const guardArmed = await page.evaluate(() => {
      const event = new Event('beforeunload', { cancelable: true });
      window.dispatchEvent(event);
      return event.defaultPrevented;
    });
    expect(guardArmed).toBe(true);
  });

  test('importing a YAML missing required fields surfaces them for repair, never silently', async ({
    page,
  }) => {
    // Start clean and reach the Import & Repair screen via the picker's "Import YAML…" entry.
    await resetWorkspace(page);
    await page.getByRole('button', { name: /import yaml/i }).first().click();
    await expect(page.getByRole('heading', { name: 'Import metadata YAML' })).toBeVisible();

    // A YAML that decodes fine but is MISSING the required animal-level fields
    // (lab/institution/data_acq_device/experimenter_name/raw_data_to_volts/times_period_multiplier).
    // The repair screen must SURFACE each missing field (in "Required, but missing") and BLOCK the
    // import — never drop them silently and never write a half-animal.
    const damagedYaml = [
      'experiment_description: A session that is missing required animal-level fields',
      'session_description: Damaged import fixture',
      'session_id: badrat_20230622',
      'subject:',
      '  subject_id: badrat',
      '  species: Rattus norvegicus',
      '  sex: M',
      '  genotype: Wild Type',
      '  description: Subject',
      '  weight: 400',
      '  date_of_birth: "2023-01-10T00:00:00.000Z"',
      '',
    ].join('\n');

    await page.getByLabel('Choose a metadata YAML file').setInputFiles({
      name: '06222023_badrat_metadata.yml',
      mimeType: 'text/yaml',
      buffer: Buffer.from(damagedYaml),
    });

    // The missing required fields are surfaced (not silent) and the import is blocked until filled.
    const required = page.getByRole('region', { name: 'Required, but missing' });
    await expect(required).toBeVisible();
    await expect(required).toContainText(/lab|institution|experimenter|data_acq/i);
    await expect(page.getByRole('button', { name: /import as new animal/i })).toBeDisabled();

    // Nothing is written: leaving for the workspace keeps it empty.
    await page.getByRole('link', { name: 'Cancel' }).click();
    await expect(page.getByText('No animals created yet.')).toBeVisible();
  });

  test('a valid YAML imported through the FILE PICKER advances to the repair view (not zero files)', async ({
    page,
  }) => {
    // Regression guard for the in-browser file-picker bug: an onInputChange that captured the live
    // `e.target.files` then cleared `e.target.value` BEFORE awaiting the parse empties that live
    // list in a real browser, so the picker imports zero files and the view never advances. The
    // Import & Repair screen snapshots the File before clearing; drive the REAL picker path
    // (setInputFiles → onChange) and assert the view advances with the parsed animal.
    await resetWorkspace(page);
    await page.getByRole('button', { name: /import yaml/i }).first().click();
    await expect(page.getByRole('heading', { name: 'Import metadata YAML' })).toBeVisible();

    // A valid, importable single-day YAML (proper {mmddYYYY}_{subject}_metadata.yml name and all
    // required animal-level fields present) — no repairs needed.
    const validYaml = [
      'experimenter_name:',
      '  - Doe, Jane',
      'lab: Frank',
      'institution: University of California, San Francisco',
      'experiment_description: Picker-path import fixture',
      'session_description: Valid import via file picker',
      'session_id: pickerrat_20230622',
      'subject:',
      '  description: Subject',
      '  genotype: Wild Type',
      '  species: Rattus norvegicus',
      '  sex: M',
      '  subject_id: pickerrat',
      '  weight: 400',
      '  date_of_birth: 2023-01-10T00:00:00',
      '  age: P164',
      'data_acq_device:',
      '  - name: SpikeGadgets',
      '    system: SpikeGadgets',
      '    amplifier: Intan',
      '    adc_circuit: Intan',
      'times_period_multiplier: 1.5',
      'raw_data_to_volts: 0.195',
      '',
    ].join('\n');

    await page.getByLabel('Choose a metadata YAML file').setInputFiles({
      name: '06222023_pickerrat_metadata.yml',
      mimeType: 'text/yaml',
      buffer: Buffer.from(validYaml),
    });

    // The view advances to the repair screen — a clean file has no repairs, so it shows the
    // picked file, the new-animal decision, and an ENABLED import action (NOT stuck on the picker).
    await expect(page.getByText('06222023_pickerrat_metadata.yml')).toBeVisible();
    await expect(page.getByText(/will create a new animal/i)).toBeVisible();
    await expect(page.getByRole('button', { name: /import as new animal/i })).toBeEnabled();
  });
});
