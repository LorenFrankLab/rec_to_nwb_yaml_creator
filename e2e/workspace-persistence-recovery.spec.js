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

import { createHash } from 'node:crypto';
import { test, expect } from '@playwright/test';
import {
  STORAGE_KEY,
  SCHEMA_VERSION,
  ANIMAL_ID,
  DAY_ID,
  resetWorkspace,
  seedWorkspace,
  buildConfiguredWorkspaceBlob,
  captureDownload,
  createAnimalViaUI,
} from './helpers/workspace.js';

/**
 * Reveal the secondary restore controls when a populated workspace keeps them collapsed.
 *
 * @param {import('@playwright/test').Page} page - The current Playwright page.
 * @returns {Promise<void>} Resolves when the restore controls are visible.
 */
async function revealRestoreControls(page) {
  const summary = page.locator('summary').filter({ hasText: /^Restore a workspace$/ });
  const details = summary.locator('..');
  if (!(await details.evaluate((element) => element.open))) {
    await summary.click();
  }
}

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

  test('without IndexedDB, the discarded original is still downloadable after a reload (a durable localStorage copy)', async ({
    page,
  }) => {
    await page.addInitScript(() => {
      Object.defineProperty(window, 'indexedDB', { value: undefined, configurable: true });
    });
    await page.goto('/#/workspace');
    await page.evaluate((key) => window.localStorage.setItem(key, '{corrupt original bytes'), STORAGE_KEY);
    await page.reload();
    await expect(page.getByRole('alert')).toContainText('copy of the original data was kept');
    await expect
      .poll(async () => page.evaluate((key) => window.localStorage.getItem(key), STORAGE_KEY))
      .toBeNull();

    // A fresh document (memory gone) still offers the original.
    await page.reload();
    await expect(page.getByRole('button', { name: 'Download original data' })).toBeVisible();
    const { text } = await captureDownload(page, (p) => p.getByRole('button', { name: 'Download original data' }).click());
    expect(text).toBe('{corrupt original bytes');
  });

  test('restoring a backup is refused while the unrestorable original could not be preserved (nothing overwrites the only copy)', async ({ page }) => {
    await page.addInitScript((quarantineKey) => {
      Object.defineProperty(window, 'indexedDB', { value: undefined, configurable: true });
      const original = window.localStorage.setItem.bind(window.localStorage);
      window.localStorage.setItem = (k, v) => {
        if (k === quarantineKey) throw new DOMException('QuotaExceededError', 'QuotaExceededError');
        original(k, v);
      };
    }, `${STORAGE_KEY}.quarantine`);
    await page.goto('/#/workspace');
    await page.evaluate((key) => window.localStorage.setItem(key, '{the only copy'), STORAGE_KEY);
    await page.reload();
    await expect(page.getByRole('alert')).toContainText('could not keep a durable copy');

    const backup = JSON.stringify({ ...buildConfiguredWorkspaceBlob(), format: 'rec_to_nwb_workspace_backup', formatVersion: 2, artifacts: {} });
    await revealRestoreControls(page);
    const chooser = page.waitForEvent('filechooser');
    await page.getByRole('button', { name: /Restore from backup/ }).click();
    await (await chooser).setFiles({ name: 'backup.json', mimeType: 'application/json', buffer: Buffer.from(backup) });
    await page.getByRole('alertdialog').getByRole('button', { name: 'Replace workspace' }).click();
    // Refused: the original is still the only thing under the main key.
    await expect(page.getByText(/download the unrestorable original/i).first()).toBeVisible();
    expect(await page.evaluate((key) => window.localStorage.getItem(key), STORAGE_KEY)).toBe('{the only copy');
    await expect(page.getByRole('link', { name: ANIMAL_ID })).toHaveCount(0);
  });

  test('Cancel during a delayed restore aborts it: an edit saved afterwards is never overwritten by the stale restore', async ({ page }) => {
    // Hold every IndexedDB transaction's completion callback while `__holdTx` is set, so the
    // restore's artifact staging stays in flight until the test releases it.
    await page.addInitScript(() => {
      const held = [];
      window.__holdTx = false;
      const desc = Object.getOwnPropertyDescriptor(IDBTransaction.prototype, 'oncomplete');
      Object.defineProperty(IDBTransaction.prototype, 'oncomplete', {
        configurable: true,
        get() {
          return desc.get.call(this);
        },
        set(fn) {
          if (window.__holdTx && fn) {
            desc.set.call(this, (ev) => held.push(() => fn.call(this, ev)));
          } else {
            desc.set.call(this, fn);
          }
        },
      });
      window.__releaseTx = () => {
        while (held.length) held.shift()();
      };
    });
    await seedWorkspace(page, buildConfiguredWorkspaceBlob());

    // A backup of the same day at 480 g whose receipt bytes verify (so staging really writes).
    const backup = buildConfiguredWorkspaceBlob();
    const day = backup.workspace.days[DAY_ID];
    day.session = { ...day.session, weight: 480 };
    const yaml = 'weight: 480\n';
    const filename = '20230622_remy_metadata.yml';
    day.exportReceipt = {
      filename,
      exportedAt: '2023-06-22T20:00:00.000Z',
      contentHash: createHash('sha256').update(`${filename}\n${yaml}`).digest('hex'),
      appVersion: 'a',
      schemaVersion: 4,
      yamlStored: true,
    };
    const text = JSON.stringify({ ...backup, format: 'rec_to_nwb_workspace_backup', formatVersion: 2, artifacts: { [DAY_ID]: { filename, yaml, exportedAt: day.exportReceipt.exportedAt } } });

    await page.evaluate(() => {
      window.__holdTx = true;
    });
    await revealRestoreControls(page);
    const chooser = page.waitForEvent('filechooser');
    await page.getByRole('button', { name: /Restore from backup/ }).click();
    await (await chooser).setFiles({ name: 'backup.json', mimeType: 'application/json', buffer: Buffer.from(text) });
    const dialog = page.getByRole('alertdialog');
    await dialog.getByRole('button', { name: 'Replace workspace' }).click();
    await expect(dialog).toContainText(/Restoring/);
    await dialog.getByRole('button', { name: 'Cancel' }).click();
    await expect(page.getByRole('alertdialog')).toHaveCount(0);

    // Edit and save AFTER cancelling.
    await page.evaluate(() => {
      window.__holdTx = false;
    });
    await page.goto(`/#/day/${DAY_ID}`);
    await page.getByLabel(/Weight measured on/).fill('777');
    await page.keyboard.press('Control+s');
    await expect(page.getByRole('status', { name: /^Saved/ })).toBeVisible();

    // Release the held transactions: the cancelled restore must not commit.
    await page.evaluate(() => window.__releaseTx());
    await page.waitForTimeout(300);
    const stored = await page.evaluate((key) => JSON.parse(window.localStorage.getItem(key)).workspace.days, STORAGE_KEY);
    expect(stored[DAY_ID].session.weight).toBe(777);
    await expect(page.getByLabel(/Weight measured on/)).toHaveValue('777');
  });

  test('a restore whose revision-marker write fails is refused as a whole: this tab, storage and a fresh tab all keep the old workspace', async ({ context, page }) => {
    await page.addInitScript((metaKey) => {
      const original = window.localStorage.setItem.bind(window.localStorage);
      window.localStorage.setItem = (k, v) => {
        if (k === metaKey && window.__failMeta) throw new DOMException('Quota full on revision marker', 'QuotaExceededError');
        original(k, v);
      };
    }, `${STORAGE_KEY}.meta`);
    const seed = buildConfiguredWorkspaceBlob();
    seed.workspace.days[DAY_ID].session = { ...seed.workspace.days[DAY_ID].session, weight: 485 };
    await seedWorkspace(page, seed);

    const backup = buildConfiguredWorkspaceBlob();
    backup.workspace.days[DAY_ID].session = { ...backup.workspace.days[DAY_ID].session, weight: 480 };
    const text = JSON.stringify({ ...backup, format: 'rec_to_nwb_workspace_backup', formatVersion: 2, artifacts: {} });
    await page.evaluate(() => {
      window.__failMeta = true;
    });
    await revealRestoreControls(page);
    const chooser = page.waitForEvent('filechooser');
    await page.getByRole('button', { name: /Restore from backup/ }).click();
    await (await chooser).setFiles({ name: 'backup.json', mimeType: 'application/json', buffer: Buffer.from(text) });
    const dialog = page.getByRole('alertdialog');
    await dialog.getByRole('button', { name: 'Replace workspace' }).click();
    await expect(dialog).toContainText(/Nothing was replaced/);
    await expect(dialog).toContainText(/Quota full on revision marker/);

    const stored = await page.evaluate((key) => JSON.parse(window.localStorage.getItem(key)).workspace.days, STORAGE_KEY);
    expect(stored[DAY_ID].session.weight).toBe(485);
    // A fresh (read-only) tab reads the same workspace this tab shows.
    const second = await context.newPage();
    await second.goto(`/#/day/${DAY_ID}`);
    await expect(second.getByLabel(/Weight measured on/)).toHaveValue('485');
    await second.close();
  });

  test('a leftover revision stamp from a closed tab never blocks the sole writer after a discard', async ({ page }) => {
    await page.goto('/#/workspace');
    await page.evaluate(
      ([key, metaKey]) => {
        window.localStorage.setItem(key, '{corrupt');
        window.localStorage.setItem(metaKey, JSON.stringify({ revision: 9, writerId: 'closed-tab', savedAt: 'x' }));
      },
      [STORAGE_KEY, `${STORAGE_KEY}.meta`]
    );
    await page.reload();
    await expect(page.getByRole('alert')).toContainText('could not be restored');
    await expect
      .poll(async () => page.evaluate((key) => window.localStorage.getItem(key), STORAGE_KEY))
      .toBeNull();
    await page.getByRole('button', { name: 'Dismiss notice' }).click();
    // Create an animal: the autosave lands (revision 10), no "another tab has saved" conflict.
    const { animalId } = await createAnimalViaUI(page, { subjectId: 'bean' });
    await expect(page).toHaveURL(new RegExp(`#/animal/${animalId}/days`));
    await expect
      .poll(async () => page.evaluate((key) => JSON.parse(window.localStorage.getItem(`${key}.meta`) ?? '{}').revision, STORAGE_KEY))
      .toBe(10);
    await expect(page.getByRole('alert').filter({ hasText: /Could not save/ })).toHaveCount(0);
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
      page.getByRole('heading', { level: 1, name: `${ANIMAL_ID} · 2023-06-22` }),
    ).toBeVisible();

    // Edit a day-owned field so a workspace change triggers the debounced autosave, whose
    // write will throw. Editing the always-visible recording notes triggers updateDay → autosave.
    const sessionDescription = page.getByRole('textbox', { name: 'Recording notes *' });
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

    await page.getByLabel(/Choose a metadata YAML file/i).setInputFiles({
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

    await page.getByLabel(/Choose a metadata YAML file/i).setInputFiles({
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

  test('multiple ready YAMLs are reviewed and committed as one animal history', async ({ page }) => {
    await resetWorkspace(page);
    await page.getByRole('button', { name: /import yaml/i }).first().click();

    const firstDayYaml = [
      'experimenter_name:',
      '  - Doe, Jane',
      'lab: Frank',
      'institution: University of California, San Francisco',
      'experiment_description: Multi-file import fixture',
      'session_description: First recording day',
      'session_id: batchrat_20230622',
      'subject:',
      '  description: Subject',
      '  genotype: Wild Type',
      '  species: Rattus norvegicus',
      '  sex: M',
      '  subject_id: batchrat',
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
    const secondDayYaml = firstDayYaml
      .replace('First recording day', 'Second recording day')
      .replaceAll('20230622', '20230623');

    await page.getByLabel(/Choose a metadata YAML file/i).setInputFiles([
      {
        name: '06222023_batchrat_metadata.yml',
        mimeType: 'text/yaml',
        buffer: Buffer.from(firstDayYaml),
      },
      {
        name: '06232023_batchrat_metadata.yml',
        mimeType: 'text/yaml',
        buffer: Buffer.from(secondDayYaml),
      },
    ]);

    await expect(page.getByRole('region', { name: 'Import batch status' })).toContainText('2 ready');
    await page.getByRole('button', { name: 'Review 2 ready files' }).click();
    await expect(page.getByRole('region', { name: 'Batch import summary' })).toContainText(
      '2 recording days → 1 animal',
    );
    await expect(page.getByRole('heading', { name: 'batchrat' })).toBeVisible();

    await page.getByRole('button', { name: 'Confirm import' }).click();
    await expect(page.getByRole('heading', { name: 'Import complete' })).toBeVisible();
    await expect(page.getByText(/Imported 2 recording days across 1 animal/)).toBeVisible();
    await page.getByRole('link', { name: 'batchrat' }).click();
    await expect(page.getByText('2023-06-22').first()).toBeVisible();
    await expect(page.getByText('2023-06-23').first()).toBeVisible();
  });
});
