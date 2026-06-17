/**
 * E2E: Three-way agreement (Visible UI ⇄ persisted localStorage ⇄ exported YAML).
 *
 * This is the consolidation the other workspace specs do not own. They each prove ONE plane:
 *   - workspace-export.spec.js asserts the EXPORTED YAML's corrected sections;
 *   - workspace-mistake-prevention.spec.js asserts the EDITING-SURFACE guards;
 *   - the golden baselines own byte-for-byte export regression.
 * None of them assert that the value a scientist READS on a tab, the value the app PERSISTED, and
 * the value it ultimately EXPORTS are the SAME number/string. A silent disagreement between those
 * three is the highest-severity failure mode in this app (a scientist confirms one calibration on
 * screen while a different one is written to the archive), so this spec captures all three planes
 * for the seeded configured `remy` day and asserts they agree, field by field.
 *
 * It is deliberately NOT a golden-baseline duplicate: assertions are targeted to the high-risk
 * scientific values (camera meters_per_pixel + lens, data_acq_device hardware identity, electrode
 * group + ntrode integer ids and day bad-channels, subject species binomial / session ids, tasks /
 * videos, opto state) and compare the THREE planes against each other, not against a frozen file.
 *
 * QA discipline (mirrors the harness contract): role/accessible-name or route/href selectors only
 * (the two `table.cameras-table` / `table.data-acq-table` reads are the documented exception — the
 * app exposes these catalogs only as class-named tables, and the read is structural, not a control
 * interaction); wait on locators/URLs/events (never sleeps); reset + seed per test for independence.
 */

import { test, expect } from '@playwright/test';
import YAML from 'yaml';
import {
  resetWorkspace,
  seedWorkspace,
  seedAndOpen,
  buildConfiguredWorkspaceBlob,
  captureDownload,
  STORAGE_KEY,
  ANIMAL_ID,
  DAY_ID,
} from './helpers/workspace';

/**
 * Read the persisted workspace blob from the page's localStorage and return the seeded
 * animal + day records (the localStorage plane of the triangulation).
 *
 * @param {import('@playwright/test').Page} page - The Playwright page.
 * @returns {Promise<{ animal: object, day: object }>} The persisted animal/day objects.
 */
async function readPersisted(page) {
  const blob = await page.evaluate((key) => window.localStorage.getItem(key), STORAGE_KEY);
  expect(blob, 'workspace must be persisted in localStorage').toBeTruthy();
  const parsed = JSON.parse(blob);
  return {
    animal: parsed.workspace.animals[ANIMAL_ID],
    day: parsed.workspace.days[DAY_ID],
  };
}

/**
 * Drive the real per-day Export download and parse the YAML into an object (the export plane).
 *
 * @param {import('@playwright/test').Page} page - The Playwright page (already on the day route).
 * @returns {Promise<{ text: string, doc: object }>} The downloaded text and the parsed object.
 */
async function captureExportedYaml(page) {
  await page.getByRole('button', { name: 'Export', exact: true }).click();
  await expect(page.getByRole('heading', { level: 2, name: 'Export — 2023-06-22' })).toBeVisible();
  const { text } = await captureDownload(page, async (p) => {
    await p.getByRole('button', { name: 'Download' }).click();
  });
  return { text, doc: YAML.parse(text) };
}

test.describe('Three-way agreement: UI ⇄ localStorage ⇄ exported YAML', () => {
  test.beforeEach(async ({ page }) => {
    await resetWorkspace(page);
  });

  test('cameras: meters_per_pixel + lens agree across the Cameras tab, localStorage, and YAML', async ({
    page,
  }) => {
    // PLANE 1 (UI) — the animal Cameras tab renders each camera's name, lens, and meters_per_pixel.
    await seedAndOpen(page, buildConfiguredWorkspaceBlob(), `/#/animal/${ANIMAL_ID}/cameras`);
    await expect(page.getByRole('heading', { level: 2, name: 'Cameras' })).toBeVisible();

    const camerasTable = page.locator('table.cameras-table');
    await expect(camerasTable).toBeVisible();
    // Read the rendered cells structurally (id / name / manufacturer / model / lens / meters_per_pixel).
    const uiCameras = await camerasTable.locator('tbody tr').evaluateAll((rows) =>
      rows.map((tr) => {
        const td = [...tr.querySelectorAll('td')].map((c) => c.textContent.trim());
        return { id: td[0], name: td[1], lens: td[4], mpp: td[5] };
      }),
    );
    expect(uiCameras).toEqual([
      { id: '0', name: 'overhead_camera', lens: 'Fujinon HF16HA-1B', mpp: '0.00085' },
      { id: '1', name: 'side_camera', lens: 'Fujinon HF16HA-1B', mpp: '0.0009' },
    ]);

    // PLANE 2 (localStorage) — the persisted animal carries the same calibration values.
    const { animal } = await readPersisted(page);
    expect(animal.cameras.map((c) => [c.camera_name, c.lens, c.meters_per_pixel])).toEqual([
      ['overhead_camera', 'Fujinon HF16HA-1B', 0.00085],
      ['side_camera', 'Fujinon HF16HA-1B', 0.0009],
    ]);

    // PLANE 3 (export) — drive the real download from the day and parse the YAML.
    await seedAndOpen(page, buildConfiguredWorkspaceBlob(), `/#/day/${DAY_ID}`);
    await expect(
      page.getByRole('heading', { level: 1, name: `Day Editor: ${ANIMAL_ID} - 2023-06-22` }),
    ).toBeVisible();
    const { doc } = await captureExportedYaml(page);

    const yamlCameras = doc.cameras.map((c) => [c.camera_name, c.lens, c.meters_per_pixel]);
    // AGREEMENT: the exported calibration/lens is byte-identical in value to the UI + localStorage.
    // (The day uses both cameras, so both are exported.)
    expect(yamlCameras).toEqual([
      ['overhead_camera', 'Fujinon HF16HA-1B', 0.00085],
      ['side_camera', 'Fujinon HF16HA-1B', 0.0009],
    ]);
    // Cross-plane sanity: the UI-rendered mpp strings parse to the exact YAML numbers (no rounding).
    expect(uiCameras.map((c) => Number(c.mpp))).toEqual(doc.cameras.map((c) => c.meters_per_pixel));
  });

  test('data_acq_device: hardware identity agrees across the Recording System tab, localStorage, and YAML', async ({
    page,
  }) => {
    // PLANE 1 (UI) — the Recording System tab renders the data-acq catalog as a table of
    // name / system / amplifier / adc_circuit.
    await seedAndOpen(page, buildConfiguredWorkspaceBlob(), `/#/animal/${ANIMAL_ID}/recording-system`);
    await expect(page.getByRole('heading', { level: 2, name: 'Recording System' })).toBeVisible();

    const acqTable = page.locator('table.data-acq-table');
    await expect(acqTable).toBeVisible();
    const uiDevices = await acqTable.locator('tbody tr').evaluateAll((rows) =>
      rows.map((tr) => {
        const td = [...tr.querySelectorAll('td')].map((c) => c.textContent.trim());
        return { name: td[0], system: td[1], amplifier: td[2], adc_circuit: td[3] };
      }),
    );
    expect(uiDevices).toEqual([
      { name: 'SpikeGadgets', system: 'SpikeGadgets', amplifier: 'Intan', adc_circuit: 'Intan' },
    ]);

    // PLANE 2 (localStorage).
    const { animal } = await readPersisted(page);
    expect(animal.devices.data_acq_device).toEqual([
      { name: 'SpikeGadgets', system: 'SpikeGadgets', amplifier: 'Intan', adc_circuit: 'Intan' },
    ]);

    // PLANE 3 (export) — drive the real download from the day and parse the YAML.
    await seedAndOpen(page, buildConfiguredWorkspaceBlob(), `/#/day/${DAY_ID}`);
    const { doc } = await captureExportedYaml(page);
    // AGREEMENT: data_acq_device is a LIST (not a coerced object/string) with the same hardware fields.
    expect(doc.data_acq_device).toEqual([
      { name: 'SpikeGadgets', system: 'SpikeGadgets', amplifier: 'Intan', adc_circuit: 'Intan' },
    ]);
  });

  test('electrode groups + ntrode maps: integer ids and day bad-channels agree across localStorage and YAML', async ({
    page,
  }) => {
    // The configured remy has 8 tetrode electrode groups and 8 ntrode rows; two rows carry day
    // bad-channels (ntrode 3 → [2], ntrode 6 → [3]) = 2 failed channels.
    await seedWorkspace(page, buildConfiguredWorkspaceBlob());

    // PLANE 2 (localStorage) — the saved configuration snapshot owns the electrode groups + ntrode map.
    const { animal } = await readPersisted(page);
    const config = animal.configurationHistory[0].devices;
    expect(config.electrode_groups).toHaveLength(8);
    // Ids are JS numbers in the store (so they export as unquoted integers, not strings).
    expect(config.electrode_groups.map((g) => g.id)).toEqual([0, 1, 2, 3, 4, 5, 6, 7]);
    expect(config.ntrode_electrode_group_channel_map.map((n) => n.ntrode_id)).toEqual([
      1, 2, 3, 4, 5, 6, 7, 8,
    ]);
    const persistedBad = config.ntrode_electrode_group_channel_map
      .map((n) => n.bad_channels)
      .filter((b) => b.length);
    expect(persistedBad).toEqual([[2], [3]]);

    // PLANE 3 (export) — open the day and drive the real download.
    await seedAndOpen(page, buildConfiguredWorkspaceBlob(), `/#/day/${DAY_ID}`);
    const { text, doc } = await captureExportedYaml(page);
    // AGREEMENT (export): the YAML carries 8 groups + 8 ntrode rows with INTEGER ids (never quoted).
    expect(doc.electrode_groups.map((g) => g.id)).toEqual([0, 1, 2, 3, 4, 5, 6, 7]);
    expect(text).toMatch(/^ {2}- id: 0$/m);
    expect(text).not.toMatch(/id: ['"]0['"]/);
    expect(doc.ntrode_electrode_group_channel_map.map((n) => n.ntrode_id)).toEqual([
      1, 2, 3, 4, 5, 6, 7, 8,
    ]);
    // AGREEMENT (bad channels): the SAME two marks the store holds appear on the exported ntrode rows
    // — they are not dropped (the historical silent-loss failure mode) and not added to.
    const yamlBad = doc.ntrode_electrode_group_channel_map
      .map((n) => n.bad_channels)
      .filter((b) => b && b.length);
    expect(yamlBad).toEqual([[2], [3]]);
  });

  test('subject + session: species binomial, slash-free ids, DOB timestamp, and weight agree across localStorage and YAML', async ({
    page,
  }) => {
    await seedWorkspace(page, buildConfiguredWorkspaceBlob());

    // PLANE 2 (localStorage).
    const { animal, day } = await readPersisted(page);
    expect(animal.subject.species).toBe('Rattus norvegicus'); // Latin binomial — DANDI requires it.
    expect(animal.subject.subject_id).toBe('remy');
    expect(animal.subject.subject_id).not.toContain('/'); // no-slash id contract.
    expect(animal.subject.date_of_birth).toBe('2023-01-10T00:00:00'); // T-timestamp, not bare date.
    expect(animal.subject.weight).toBe(485);
    expect(day.session.session_id).toBe('remy_20230622');
    expect(day.session.session_id).not.toContain('/');

    // PLANE 3 (export).
    await seedAndOpen(page, buildConfiguredWorkspaceBlob(), `/#/day/${DAY_ID}`);
    await expect(
      page.getByRole('heading', { level: 1, name: `Day Editor: ${ANIMAL_ID} - 2023-06-22` }),
    ).toBeVisible();
    const { doc } = await captureExportedYaml(page);

    // AGREEMENT: the exported subject/session matches the persisted values exactly.
    expect(doc.subject.species).toBe('Rattus norvegicus');
    expect(doc.subject.subject_id).toBe('remy');
    expect(doc.subject.date_of_birth).toBe('2023-01-10T00:00:00');
    // Weight: the day has no session.weight, so the merge exports the animal baseline (485).
    expect(doc.subject.weight).toBe(485);
    expect(doc.session_id).toBe('remy_20230622');
    expect(doc.session_id).not.toContain('/');
    expect(doc.experiment_description).toBe('Chronic tetrode recording during spatial navigation');
  });

  test('tasks + videos: day tasks and associated video bindings agree across localStorage and YAML', async ({
    page,
  }) => {
    await seedWorkspace(page, buildConfiguredWorkspaceBlob());

    // PLANE 2 (localStorage) — the day owns 3 tasks and 4 associated videos.
    const { day } = await readPersisted(page);
    expect(day.tasks.map((t) => t.task_name)).toEqual(['sleep', 'w_alternation', 'sleep']);
    expect(day.associated_video_files).toHaveLength(4);

    // PLANE 3 (export).
    await seedAndOpen(page, buildConfiguredWorkspaceBlob(), `/#/day/${DAY_ID}`);
    const { doc } = await captureExportedYaml(page);
    // AGREEMENT: tasks + video bindings survive the merge with the same names and camera bindings.
    expect(doc.tasks.map((t) => t.task_name)).toEqual(['sleep', 'w_alternation', 'sleep']);
    expect(doc.associated_video_files).toHaveLength(4);
    // The w_alternation task binds cameras 0 AND 1 — those bindings reach the export unchanged.
    const wAlt = doc.tasks.find((t) => t.task_name === 'w_alternation');
    expect(wAlt.camera_id).toEqual([0, 1]);
  });

  test('optogenetics: a non-opto day has no implant in localStorage and exports empty opto', async ({
    page,
  }) => {
    await seedWorkspace(page, buildConfiguredWorkspaceBlob());

    // PLANE 2 (localStorage) — the realistic seed has NO opto implant.
    const { animal } = await readPersisted(page);
    expect(animal.optogenetics).toBeUndefined();

    await seedAndOpen(page, buildConfiguredWorkspaceBlob(), `/#/day/${DAY_ID}`);
    const { doc, text } = await captureExportedYaml(page);
    // PLANE 3 (export) — opto sections export EMPTY (the converter sees no opto), and the
    // schema-spelling compatibility duplicate (opto_software) is omitted for a non-opto export.
    expect(doc.opto_excitation_source).toEqual([]);
    expect(doc.optical_fiber).toEqual([]);
    expect(doc.virus_injection).toEqual([]);
    expect(doc.fs_gui_yamls).toEqual([]);
    expect(text).not.toMatch(/^opto_software:/m);
  });
});
