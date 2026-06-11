/**
 * Deterministic Playwright helpers for the tabbed workspace app.
 *
 * These are the shared harness the workspace e2e specs import: clear/prime the
 * persisted store, seed complex state through localStorage when the UI path would
 * obscure the assertion, create a valid animal through the real UI, capture a
 * downloaded YAML's text for structural assertions, and freeze animations for
 * stable screenshots.
 *
 * Discipline (mirrors the spec QA bar): select by role/accessible-name or by
 * href/route — never by CSS class; wait on locators/URLs/events — never fixed
 * sleeps; assert localStorage with `expect.poll`.
 *
 * @module e2e/helpers/workspace
 */

import { expect } from '@playwright/test';
import { buildRealisticWorkspace } from '../../src/__tests__/fixtures/workspaceBuilders';

/**
 * localStorage key the app persists the workspace blob under.
 * Mirrors WORKSPACE_STORAGE_KEY in src/state/persistence.js — kept as a literal
 * here so the harness has no dependency on production module internals.
 * @type {string}
 */
export const STORAGE_KEY = 'rec_to_nwb_workspace_v1';

/**
 * Persisted-blob schema version the loader accepts (src/state/persistence.js
 * WORKSPACE_SCHEMA_VERSION). A blob written at this version hydrates without a
 * migration/discard.
 * @type {number}
 */
export const SCHEMA_VERSION = 2;

/**
 * The animal id seeded by {@link buildConfiguredWorkspaceBlob} (via
 * `buildRealisticWorkspace()`'s `animalId`). Kept here so the specs share ONE source of
 * truth instead of re-declaring the literal per file.
 * @type {string}
 */
export const ANIMAL_ID = 'remy';

/**
 * The recording-day id seeded by {@link buildConfiguredWorkspaceBlob} (via
 * `buildRealisticWorkspace()`'s `dayId`). Shared with the specs, same rationale as
 * {@link ANIMAL_ID}.
 * @type {string}
 */
export const DAY_ID = 'remy-2023-06-22';

/**
 * Clear the persisted workspace and land on a clean, fully re-hydrated picker.
 *
 * Removes the key, then reloads from a fresh document so the in-memory store
 * re-initializes from (now-empty) storage. The fresh-document reload is load-bearing:
 * removing the key alone leaves a stale in-memory store, so a same-document navigation
 * can still render previously-created animals/days. (Verified: a soft hash-nav after
 * removeItem still showed a prior session's day; a real reload cleared it.)
 *
 * @param {import('@playwright/test').Page} page - The Playwright page.
 * @returns {Promise<void>} Resolves once the empty-state picker is visible.
 */
export async function resetWorkspace(page) {
  await page.goto('/#/workspace');
  await page.evaluate((key) => window.localStorage.removeItem(key), STORAGE_KEY);
  // A second goto() to the SAME hash URL is a same-document navigation — the store keeps
  // its in-memory state and can still render a prior session. A full reload forces a fresh
  // document that re-initializes the store from the now-absent blob. (This bug was latent
  // here because the expected end-state is empty, but the same-URL navigation would not
  // have cleared a stale store.)
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Animal Workspace' })).toBeVisible();
  await expect(page.getByText('No animals created yet.')).toBeVisible();
}

/**
 * Seed a full persistence blob into localStorage, then reload so the store hydrates
 * from it. Pass a `{ schemaVersion, workspace }` blob (see
 * {@link buildConfiguredWorkspaceBlob}). Used to load complex state when driving it
 * through the UI would bury the assertion.
 *
 * The key is set BEFORE the app re-reads storage (we set, then reload), and we land on
 * the picker so the seeded animals are immediately assertable.
 *
 * @param {import('@playwright/test').Page} page - The Playwright page.
 * @param {{ schemaVersion: number, workspace: object }} blob - The persistence blob.
 * @returns {Promise<void>} Resolves once the picker has re-rendered post-hydration.
 */
export async function seedWorkspace(page, blob) {
  // Need a same-origin document before touching localStorage.
  await page.goto('/#/workspace');
  await page.evaluate(
    ([key, value]) => window.localStorage.setItem(key, value),
    [STORAGE_KEY, JSON.stringify(blob)],
  );
  // A second goto() to the SAME hash URL is a same-document navigation — the store
  // never re-reads storage, so the seeded animals never hydrate. A full reload forces
  // a fresh document that re-initializes the store from the now-seeded blob.
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Animal Workspace' })).toBeVisible();
}

/**
 * Seed a workspace blob and land on the given hash route with a fresh document so the store
 * hydrates from the seed.
 *
 * Composes {@link seedWorkspace} (which already does the seed → reload → picker-visible dance)
 * with a hash navigation to `route` plus a full `reload()`. The trailing reload is load-bearing
 * for the same reason {@link seedWorkspace} reloads: a same-document hash nav can keep a stale
 * store, whereas a fresh document re-initializes it from the seeded blob. Callers assert their
 * own landing heading/URL after this resolves (no built-in post-nav wait), matching the inline
 * `seedWorkspace → goto → reload` triad the specs previously repeated.
 *
 * @param {import('@playwright/test').Page} page - The Playwright page.
 * @param {{ schemaVersion: number, workspace: object }} blob - Loader-ready blob.
 * @param {string} hashRoute - Hash route to land on (e.g. `/#/animal/remy/cameras`).
 * @returns {Promise<void>} Resolves once the fresh document has loaded on `hashRoute`.
 */
export async function seedAndOpen(page, blob, hashRoute) {
  await seedWorkspace(page, blob);
  await page.goto(hashRoute);
  await page.reload(); // fresh document → store hydrates from the seeded blob
}

/**
 * Fixed timestamp stamped onto harness-built animal/day records so seeds are deterministic.
 * @type {string}
 */
export const FIXED_TIMESTAMP = '2023-06-22T12:00:00.000Z';

/**
 * Build an empty-but-valid animal record (valid subject, empty device/camera catalogs, a base
 * configuration history, no recording days) for specs that just need a second/behavior-only animal
 * to switch to, delete, or hydrate. Mirrors the shape `createAnimal` (src/state/useWorkspace.js)
 * writes; verified to hydrate cleanly on `#/animal/:id/days` (every setup section reads the neutral
 * ○ "not set up" todo state, the first-run "Set up this animal" card shows, and no day is required).
 *
 * `overrides` shallow-merges over the top-level record (e.g. `{ days, configurationHistory }`) and a
 * nested `subject` is shallow-merged over the default subject so a caller can tweak one field (e.g.
 * `{ subject: { description: 'Behavior-only subject' } }`) without re-declaring the whole subject.
 *
 * @param {string} id - The animal store key + subject_id.
 * @param {object} [overrides] - Shallow overrides merged onto the record (nested `subject` merges too).
 * @returns {object} A loader-ready animal record.
 */
export function makeEmptyAnimal(id, overrides = {}) {
  const { subject: subjectOverride, ...rest } = overrides;
  return {
    id,
    subject: {
      description: 'Subject',
      genotype: 'Wild Type',
      species: 'Rattus norvegicus',
      sex: 'M',
      subject_id: id,
      weight: 400,
      date_of_birth: '2023-01-10T00:00:00',
      age: 'P164',
      ...subjectOverride,
    },
    devices: {
      data_acq_device: [],
      device: { name: ['Trodes'] },
      electrode_groups: [],
      ntrode_electrode_group_channel_map: [],
    },
    cameras: [],
    experimenters: { experimenter_name: ['Doe, Jane'], lab: 'Frank', institution: 'UCSF' },
    technicalDefaults: { raw_data_to_volts: 0.195, times_period_multiplier: 1.5 },
    optogenetics: undefined,
    // NOTE: no top-level `behavioral_events` here — production `createAnimal`
    // (src/state/useWorkspace.js) does NOT put `behavioral_events` on the base record, so the
    // harness mirrors that. Behavioral events are day-owned (edited in the Day Editor's wiring
    // table); the animal-level `behavioral_events` field is vestigial.
    days: [],
    created: FIXED_TIMESTAMP,
    lastModified: FIXED_TIMESTAMP,
    configurationHistory: [
      {
        version: 1,
        date: '2023-06-22',
        description: 'Initial configuration',
        devices: { electrode_groups: [], ntrode_electrode_group_channel_map: [] },
        appliedToDays: [],
      },
    ],
    ...rest,
  };
}

/**
 * Build a persistable workspace blob from the realistic animal + day fixture.
 *
 * Reuses `buildRealisticWorkspace()` (a pure, side-effect-free, fixed-timestamp data
 * builder — no Vitest globals, safe under Playwright's compiler) and wraps its
 * `{ animal, day }` into the `{ schemaVersion, workspace: { animals, days, settings } }`
 * shape the loader expects, with `animal.days` already referencing the day id.
 *
 * `overrides` allows shallow mutation for specs that need ONE field to diverge — e.g.
 * to set up the "changed camera zoom needs a new camera name" misconception, mutate the
 * returned blob's `workspace.animals.remy.cameras` before seeding. The override merges
 * at the top of `workspace` (and over `settings`); for deeper edits, mutate the returned
 * object directly. Top-level keys (e.g. `animals`, `days`) REPLACE wholesale — they do
 * not deep-merge — so overriding `animals` drops the realistic seed; mutate instead.
 *
 * @param {object} [overrides] - Shallow overrides merged onto `workspace` (top-level keys replace).
 * @param {object} [overrides.settings] - Shallow-merged onto the default settings.
 * @returns {{ schemaVersion: number, workspace: object }} A loader-ready blob.
 */
export function buildConfiguredWorkspaceBlob(overrides = {}) {
  const { animal, day } = buildRealisticWorkspace();
  const { settings: settingsOverride, ...workspaceOverride } = overrides;

  // Shape-of-record for these defaults is `createDefaultWorkspace()` in
  // src/state/workspaceUtils.js — kept as a literal here so the harness stays free of
  // that module's transitive graph and non-deterministic timestamp. If production adds a
  // settings field, mirror it here.
  const workspace = {
    version: '1.0.0',
    lastModified: animal.lastModified,
    animals: { [animal.id]: animal },
    days: { [day.id]: day },
    settings: {
      defaultLab: '',
      defaultInstitution: '',
      defaultExperimenters: [],
      autoSaveInterval: 30000,
      shadowExportEnabled: true,
      ...settingsOverride,
    },
    ...workspaceOverride,
  };

  return { schemaVersion: SCHEMA_VERSION, workspace };
}

/**
 * Create a valid animal through the real create-animal UI and land on its days tab.
 *
 * Fills only the genuinely-required fields (verified against
 * src/pages/Home/AnimalCreationForm.jsx AND by driving the form): Subject ID, Date of
 * Birth, Weight (grams), and Experimenter 1. Species/Sex/Genotype default to valid
 * values; Lab/Institution default from the workspace's saved defaults — on a fresh
 * store those are empty, so this helper fills them too unless caller opts out via the
 * defaults already being present (the submit button stays disabled until valid, which
 * this helper asserts before clicking).
 *
 * Waits on the resulting animal-route URL + header, never a sleep.
 *
 * @param {import('@playwright/test').Page} page - The Playwright page.
 * @param {object} opts - Field values.
 * @param {string} opts.subjectId - Unique subject id (letters/numbers/-/_; no spaces).
 * @param {string} [opts.dateOfBirth] - ISO date (YYYY-MM-DD). Default '2023-01-01'.
 * @param {string|number} [opts.weight] - Weight in grams. Default 450.
 * @param {string} [opts.experimenter] - Experimenter 1 name. Default 'Doe, Jane'.
 * @param {string} [opts.lab] - Lab. Default 'Frank' (fills only if the field is empty).
 * @param {string} [opts.institution] - Institution. Default 'UCSF' (fills only if empty).
 * @returns {Promise<{ animalId: string }>} The lowercased animal id now in the route.
 */
export async function createAnimalViaUI(
  page,
  {
    subjectId,
    dateOfBirth = '2023-01-01',
    weight = 450,
    experimenter = 'Doe, Jane',
    lab = 'Frank',
    institution = 'UCSF',
  },
) {
  if (!subjectId) throw new Error('createAnimalViaUI requires a subjectId');

  // Open the inline create panel from the picker. Both the empty-state ("Create Animal")
  // and the populated-picker ("+ New Animal", aria-label "Create new animal") routes open
  // the same form; prefer whichever is present.
  const newAnimalButton = page.getByRole('button', { name: 'Create new animal' });
  const firstAnimalButton = page.getByRole('button', { name: 'Create Animal' }).first();
  if (await newAnimalButton.isVisible().catch(() => false)) {
    await newAnimalButton.click();
  } else {
    await firstAnimalButton.click();
  }

  const form = page.getByRole('form', { name: 'Animal creation form' });
  await expect(form).toBeVisible();

  await form.getByRole('textbox', { name: 'Subject ID *' }).fill(subjectId);
  await form.getByRole('textbox', { name: 'Date of Birth *' }).fill(dateOfBirth);
  await form.getByRole('spinbutton', { name: /Weight \(grams\)/ }).fill(String(weight));
  await form.getByRole('textbox', { name: /Experimenter 1/ }).fill(experimenter);

  // Lab/Institution default from workspace settings; on a fresh store they are empty and
  // required. Fill only when empty so a defaulted value isn't clobbered.
  const labField = form.getByRole('textbox', { name: 'Lab *' });
  if (!(await labField.inputValue())) await labField.fill(lab);
  const institutionField = form.getByRole('textbox', { name: 'Institution *' });
  if (!(await institutionField.inputValue())) await institutionField.fill(institution);

  const submit = form.getByRole('button', { name: 'Create Animal' });
  await expect(submit).toBeEnabled();
  await submit.click();

  const animalId = subjectId.toLowerCase().trim();
  await expect(page).toHaveURL(new RegExp(`#/animal/${animalId}/days`));
  await expect(page.getByRole('heading', { level: 1, name: animalId })).toBeVisible();

  return { animalId };
}

/**
 * Run `triggerFn` and capture the YAML download it produces, returning the file's text.
 *
 * Wraps `page.waitForEvent('download')` around the trigger so there is no race, then
 * drains `download.createReadStream()` (the app downloads via a Blob object-URL anchor
 * click — see src/io/yaml.js downloadYamlFile — which Playwright surfaces as a normal
 * download event).
 *
 * @param {import('@playwright/test').Page} page - The Playwright page.
 * @param {(page: import('@playwright/test').Page) => Promise<void>} triggerFn - Performs
 *   the click/action that initiates the download.
 * @returns {Promise<{ filename: string, text: string }>} The suggested filename and the
 *   downloaded file's full text content.
 */
export async function captureDownload(page, triggerFn) {
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    triggerFn(page),
  ]);

  const stream = await download.createReadStream();
  let text = '';
  for await (const chunk of stream) {
    text += chunk.toString();
  }

  return { filename: download.suggestedFilename(), text };
}

/**
 * Inject a stylesheet that zeroes animations/transitions/scroll-behavior for stable
 * screenshots. Persists across navigations in the page (added via addInitScript so it
 * re-applies on each document). Call once before navigating to the screen under test.
 *
 * Appending the <style> eagerly at init time (before <head> exists) does NOT survive:
 * React parses/replaces the document on mount and a node hung off documentElement is
 * dropped. Instead, wait for DOMContentLoaded (head guaranteed present, before React
 * mounts), append to document.head, and re-append on each navigation if it was lost so
 * the rule is always live in the rendered DOM.
 *
 * @param {import('@playwright/test').Page} page - The Playwright page.
 * @returns {Promise<void>} Resolves once the init script is registered.
 */
export async function disableAnimations(page) {
  await page.addInitScript(() => {
    const CSS = `
      *, *::before, *::after {
        animation-duration: 0s !important;
        animation-delay: 0s !important;
        transition-duration: 0s !important;
        transition-delay: 0s !important;
        scroll-behavior: auto !important;
      }
    `;
    const inject = () => {
      if (!document.head) return;
      if (document.querySelector('style[data-test-disable-animations]')) return;
      const style = document.createElement('style');
      style.setAttribute('data-test-disable-animations', '');
      style.textContent = CSS;
      document.head.appendChild(style);
    };

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', inject, { once: true });
    } else {
      inject();
    }
  });
}
