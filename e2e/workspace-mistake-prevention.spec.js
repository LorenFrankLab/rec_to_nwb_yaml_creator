/**
 * E2E: Mistake-prevention UX on the highest-risk edit surfaces.
 *
 * These specs drive the SHIPPED edit surfaces where a plausible-looking edit would silently
 * corrupt the Spyglass naming-identity contract or save a stale reference, and assert the
 * CURRENT guard that blocks it. They are deliberately small and targeted — one test per surface,
 * with HARD assertions on the live control that serves each user job:
 *
 *  - Camera divergence (Animal → Cameras tab): reusing a `camera_name` with a different
 *    calibration/lens is blocked with a side-by-side comparison and a "Use a new camera name" path,
 *    and the unsafe save does not overwrite.
 *  - Data-acq divergence (Animal → Recording System tab): reusing a `data_acq_device[].name` on
 *    another animal with different hardware is blocked with a comparison.
 *  - Region case-drift (Animal → Electrode Groups modal): a case-only variant of a known region is
 *    canonicalized (the BrainRegionAutocomplete snaps "ca1" → "CA1") rather than fragmenting rows.
 *  - Controlled task/video references (Day → Tasks & Epochs): camera + epoch references are chosen
 *    from controlled selects/checkboxes of known cameras/epochs — a stale id cannot be typed in.
 *  - Task-name divergence (Day → Tasks & Epochs → Task modal): reusing a known `task_name` with a
 *    different `task_description` is blocked with old-vs-new context.
 *  - Behavioral events (Day → Behavioral Events tab): a day-owned DIO channel grid grouped into Inputs
 *    (Din) / Outputs (Dout); there is no animal-level library or "Use on this day" path.
 *  - Day technical read-only / route-to-Recording-System (Day → Overview → Technical parameters):
 *    `raw_data_to_volts` / `times_period_multiplier` are presented as effective recording-system
 *    values (read-only), with an "Edit in Recording System" link rather than a routine day edit.
 *
 * QA discipline: role/accessible-name or route selectors only (never CSS class for app controls);
 * wait on locators/URLs/events (never sleeps); reset + seed per test for independence.
 */

import { test, expect } from '@playwright/test';
import {
  resetWorkspace,
  seedAndOpen,
  buildConfiguredWorkspaceBlob,
  ANIMAL_ID,
  DAY_ID,
} from './helpers/workspace';

/**
 * Robustly open a `<details>` disclosure by its summary and assert its content is revealed.
 *
 * Headless Chromium intermittently swallows the first synthetic click on a `<summary>`, so this
 * clicks the summary, then — only if the content has not appeared — falls back to a keyboard
 * Enter on the summary. The unconditional `toBeVisible()` makes a disclosure that never opens
 * hard-fail (rather than silently passing a later content assertion against a hidden node).
 *
 * @param {import('@playwright/test').Locator} summaryLocator - The `<summary>` (or its text) to toggle.
 * @param {import('@playwright/test').Locator} contentLocator - A node revealed once the disclosure opens.
 * @returns {Promise<void>} Resolves once the content is visible.
 */
async function openDetails(summaryLocator, contentLocator) {
  await summaryLocator.click();
  if (!(await contentLocator.isVisible().catch(() => false))) {
    await summaryLocator.press('Enter');
  }
  await expect(contentLocator).toBeVisible();
}

test.describe('Mistake-prevention UX on high-risk edit surfaces', () => {
  test.beforeEach(async ({ page }) => {
    await resetWorkspace(page);
  });

  test('camera divergence: reusing a name with a different calibration is blocked and offers a new name', async ({
    page,
  }) => {
    // Seed the realistic animal (cameras: id 0 "overhead_camera", id 1 "side_camera" with a
    // different meters_per_pixel). Editing camera 0 to reuse "side_camera" while keeping camera 0's
    // distinct calibration is a divergent reuse of the Spyglass CameraDevice identity.
    await seedAndOpen(page, buildConfiguredWorkspaceBlob(), `/#/animal/${ANIMAL_ID}/cameras`);

    await expect(page.getByRole('heading', { level: 2, name: 'Cameras' })).toBeVisible();
    // The catalog shows both cameras' names before we edit.
    const camerasTable = page.getByRole('table');
    await expect(camerasTable.getByText('overhead_camera')).toBeVisible();
    await expect(camerasTable.getByText('side_camera')).toBeVisible();

    // Open camera 0 (overhead_camera) for editing.
    await camerasTable
      .getByRole('row', { name: /overhead_camera/ })
      .getByRole('button', { name: 'Edit' })
      .click();
    const dialog = page.getByRole('dialog', { name: 'Edit Camera' });
    await expect(dialog).toBeVisible();

    // Rename it to the OTHER camera's name (side_camera) — same name, different calibration/lens.
    const nameInput = dialog.getByRole('textbox', { name: 'Camera Name' });
    await nameInput.fill('side_camera');
    await dialog.getByRole('button', { name: 'Save camera configuration' }).click();

    // Divergence is surfaced: an alert names the conflict and a side-by-side comparison is shown.
    const divergence = dialog.getByRole('alert');
    await expect(divergence).toBeVisible();
    await expect(
      divergence.getByText(/already used by .* with different settings/),
    ).toBeVisible();
    // The comparison table contrasts the existing vs this camera's identity fields. (The header
    // cells render as `cell` role here, not `columnheader`.)
    await expect(divergence.getByRole('cell', { name: 'Existing', exact: true })).toBeVisible();
    await expect(divergence.getByRole('cell', { name: 'This camera', exact: true })).toBeVisible();

    // A control to take the safe new-name path is offered (the new-identity escape hatch).
    await expect(divergence.getByRole('button', { name: 'Use a new camera name' })).toBeVisible();

    // The unsafe save did NOT overwrite: the modal stays open (blocked), so no second
    // "side_camera" row was committed. Cancel and confirm the catalog is unchanged.
    await dialog.getByRole('button', { name: 'Cancel and close modal' }).click();
    await expect(dialog).toBeHidden();
    // camera 0 still reads as overhead_camera (the divergent rename was not persisted).
    await expect(
      camerasTable.getByRole('row', { name: /overhead_camera/ }),
    ).toBeVisible();
    // Exactly one row carries "side_camera" — the original camera 1; no duplicate was created.
    await expect(camerasTable.getByRole('cell', { name: 'side_camera', exact: true })).toHaveCount(1);
  });

  test('data-acq divergence: reusing a device name on another animal with different hardware is blocked', async ({
    page,
  }) => {
    // The data-acq divergence registry excludes the EDITING animal's whole catalog, so the conflict
    // must come from ANOTHER animal. Seed a second animal whose data_acq_device reuses the name
    // "SpikeGadgets" (remy's device name) but with DIFFERENT hardware (amplifier/adc_circuit).
    const blob = buildConfiguredWorkspaceBlob();
    const remy = blob.workspace.animals[ANIMAL_ID];
    const other = structuredClone(remy);
    other.id = 'other';
    other.subject_id = 'other';
    other.days = [];
    other.devices = {
      ...other.devices,
      data_acq_device: [
        { name: 'SpikeGadgets', system: 'SpikeGadgets', amplifier: 'DIFFERENT_AMP', adc_circuit: 'DIFFERENT_ADC' },
      ],
    };
    blob.workspace.animals.other = other;

    await seedAndOpen(page, blob, `/#/animal/${ANIMAL_ID}/recording-system`);
    await expect(page.getByRole('heading', { level: 2, name: 'Recording System' })).toBeVisible();

    // Open remy's recording-system device for editing.
    await page
      .getByRole('row', { name: /SpikeGadgets/ })
      .getByRole('button', { name: /Edit recording system/ })
      .click();
    const dialog = page.getByRole('dialog', { name: 'Edit Recording System' });
    await expect(dialog).toBeVisible();

    // Keep remy's existing hardware (which differs from `other`'s same-named device) and save.
    // The name already equals "SpikeGadgets"; saving must detect the cross-animal divergence.
    await dialog.getByRole('button', { name: 'Save recording system' }).click();

    // Divergence is surfaced with a side-by-side hardware comparison.
    const divergence = dialog.getByRole('alert');
    await expect(divergence).toBeVisible();
    await expect(
      divergence.getByText(/already used by .* with different hardware/),
    ).toBeVisible();
    await expect(divergence.getByRole('cell', { name: 'Existing', exact: true })).toBeVisible();
    await expect(divergence.getByRole('cell', { name: 'This device', exact: true })).toBeVisible();

    // The modal stays open (the divergent save was blocked, not silently committed).
    await expect(dialog).toBeVisible();
  });

  test('region case-drift: a case-only brain-region variant is canonicalized, not saved as a new region', async ({
    page,
  }) => {
    // Electrode groups all target "CA1"/"CA3"/"mPFC". Editing a group's targeted location to the
    // case-only variant "ca1" must snap to the canonical "CA1" (BrainRegionAutocomplete on blur),
    // so Spyglass BrainRegion rows are not fragmented by "ca1" vs "CA1".
    await seedAndOpen(page, buildConfiguredWorkspaceBlob(), `/#/animal/${ANIMAL_ID}/electrode-groups`);

    // The realistic fixture keeps electrode geometry in the saved configuration snapshot with an
    // empty editable mirror, so the tab opens on the safe re-sync prompt. Load the saved
    // configuration into the editor before editing a group.
    await page
      .getByRole('button', { name: 'Load saved electrode configuration' })
      .click();
    await expect(page.getByRole('heading', { level: 2, name: 'Electrode Groups' })).toBeVisible();

    // Open electrode group 0 for editing.
    await page
      .getByRole('button', { name: 'Edit electrode group 0' })
      .click();
    const dialog = page.getByRole('dialog', { name: 'Edit Electrode Group' });
    await expect(dialog).toBeVisible();

    // The autocomplete renders as a datalist-backed combobox. Type the case-only drift into the
    // Targeted Location field, then blur it.
    const targeted = dialog.getByRole('combobox', { name: 'Targeted Location' });
    await targeted.fill('ca1');
    // Blur to trigger the canonicalization (moving focus to another field).
    await dialog.getByRole('combobox', { name: 'Location (optional)' }).click();

    // The current guard CANONICALIZES on blur: the field visibly snaps "ca1" → "CA1" while the
    // user is still in the form, so a case-only duplicate region is never persisted.
    await expect(targeted).toHaveValue('CA1');
  });

  test('controlled task/video references: camera + epoch are picked from known choices, never free-typed ids', async ({
    page,
  }) => {
    // The day's tasks reference cameras (ids 0/1) and epochs; associated videos bind a camera and an
    // epoch. Both bindings must be CONTROLLED choices (selects/checkboxes of known cameras/epochs),
    // so the normal path cannot persist a stale id.
    await seedAndOpen(page, buildConfiguredWorkspaceBlob(), `/#/day/${DAY_ID}`);
    await expect(
      page.getByRole('heading', { level: 1, name: `Day Editor: ${ANIMAL_ID} - 2023-06-22` }),
    ).toBeVisible();

    await page.getByRole('button', { name: /^Tasks & Epochs — / }).click();
    await expect(page.getByRole('heading', { level: 2, name: 'Tasks & Epochs' })).toBeVisible();

    // --- Associated video files: camera + epoch are <select> controls (combobox role). ---
    const videos = page.getByRole('region', { name: 'Associated video files' });
    await expect(videos).toBeVisible();
    // The seeded day has video rows; the FIRST row's camera select is a controlled combobox.
    const cameraSelect = videos.getByRole('combobox', { name: 'Camera' }).first();
    await expect(cameraSelect).toBeVisible();
    // Its options are the KNOWN cameras (0 – overhead_camera, 1 – side_camera) plus the empty prompt,
    // and nothing else — there is no free-text id entry, so a stale id can never be persisted.
    await expect(cameraSelect.getByRole('option', { name: /0 – overhead_camera/ })).toHaveCount(1);
    await expect(cameraSelect.getByRole('option', { name: /1 – side_camera/ })).toHaveCount(1);
    // No option carries an id outside the catalog (e.g. a stale 999) — the control's domain is the
    // known cameras, so the normal path cannot produce a dangling camera reference.
    await expect(
      cameraSelect.getByRole('option', { name: /\b999\b/ }),
    ).toHaveCount(0);

    // The epoch reference is likewise a controlled select of the day's known task epochs (2 and 4 on
    // the first video row's task), never a free-typed number — so a stale epoch cannot be saved.
    const epochSelect = videos.getByRole('combobox', { name: 'Task epoch' }).first();
    await expect(epochSelect).toBeVisible();
    await expect(epochSelect.getByRole('option', { name: '999', exact: true })).toHaveCount(0);
    // It offers at least one real epoch option beyond the empty prompt (a controlled domain).
    expect(await epochSelect.getByRole('option').count()).toBeGreaterThan(1);

    // --- Task modal: cameras are controlled checkboxes (the known animal cameras), not free text. ---
    await page.getByRole('button', { name: '+ Add Task' }).click();
    const taskDialog = page.getByRole('dialog', { name: 'Add Task' });
    await expect(taskDialog).toBeVisible();
    // The Cameras section is a collapsible <details>; open it via its summary to reveal the
    // controlled checkbox set.
    const camerasSummary = taskDialog.getByText('Cameras', { exact: true });
    const cameraChoices = taskDialog.getByRole('group', { name: 'Cameras used in this task' });
    await openDetails(camerasSummary, cameraChoices);
    await expect(cameraChoices.getByRole('checkbox', { name: /overhead_camera/ })).toBeVisible();
    await expect(cameraChoices.getByRole('checkbox', { name: /side_camera/ })).toBeVisible();
  });

  test('task-name divergence: reusing a task name with a different description is blocked with old-vs-new context', async ({
    page,
  }) => {
    // The seeded day has task_name "w_alternation" with a specific description. Adding a NEW task
    // that reuses "w_alternation" with a DIFFERENT description violates the Spyglass task-name
    // identity (one name → one description) and must be blocked with the existing-vs-yours context.
    await seedAndOpen(page, buildConfiguredWorkspaceBlob(), `/#/day/${DAY_ID}`);
    await page.getByRole('button', { name: /^Tasks & Epochs — / }).click();
    await expect(page.getByRole('heading', { level: 2, name: 'Tasks & Epochs' })).toBeVisible();

    await page.getByRole('button', { name: '+ Add Task' }).click();
    const dialog = page.getByRole('dialog', { name: 'Add Task' });
    await expect(dialog).toBeVisible();

    await dialog.getByRole('textbox', { name: 'Task name (required)' }).fill('w_alternation');
    await dialog
      .getByRole('textbox', { name: 'Task environment (required)' })
      .fill('elevated W-track (180cm arms)');
    await dialog
      .getByRole('textbox', { name: 'Task description' })
      .fill('A COMPLETELY DIFFERENT description');

    // The conflict is surfaced inline (an alert), explaining the identity rule with old-vs-new context.
    const conflict = dialog.getByRole('alert');
    await expect(conflict).toBeVisible();
    await expect(
      conflict.getByText(/already used in this dataset with a different description/),
    ).toBeVisible();
    // Old-vs-new context: the existing description is shown next to what the user typed, in a
    // definition list. Match the <dt>/<dd> text exactly (the lead paragraph is a different node).
    await expect(conflict.getByText('Existing description', { exact: true })).toBeVisible();
    await expect(conflict.getByText('Your description', { exact: true })).toBeVisible();
    await expect(
      conflict.getByText('W-track continuous alternation for reward', { exact: true }),
    ).toBeVisible();
    await expect(
      conflict.getByText('A COMPLETELY DIFFERENT description', { exact: true }),
    ).toBeVisible();

    // Save is blocked while the divergent description stands.
    await expect(dialog.getByRole('button', { name: 'Save task' })).toBeDisabled();
  });

  test('behavioral events: the day owns a DIO wiring table grouped into Inputs/Outputs (no animal library)', async ({
    page,
  }) => {
    // Behavioral events are day-owned (the only ones exported); there is no animal-level library
    // and no "Use on this day" path. The Day Editor presents them as a wiring table grouped by
    // direction (Inputs = Din, Outputs = Dout).
    const blob = buildConfiguredWorkspaceBlob();
    blob.workspace.days[DAY_ID].behavioral_events = [
      { name: 'Poke1', description: 'Din1' },
      { name: 'Pump1', description: 'Dout7' },
    ];

    await seedAndOpen(page, blob, `/#/day/${DAY_ID}`);
    // Behavioral events have their own day-editor tab (separate from Tasks & Epochs).
    await page.getByRole('button', { name: /^Behavioral Events/ }).click();
    await expect(page.getByRole('heading', { level: 2, name: 'Behavioral Events' })).toBeVisible();

    // Day events overlay onto their channels in the direction-grouped hardware grid: the name is
    // the VALUE of the channel's field (Din1 under Inputs, Dout7 under Outputs). `exact` so
    // "Event for Din1" doesn't also match "Event for Din10…19".
    await expect(
      page.getByRole('table', { name: /inputs \(din\)/i }).getByLabel('Event for Din1', { exact: true }),
    ).toHaveValue('Poke1');
    await expect(
      page.getByRole('table', { name: /outputs \(dout\)/i }).getByLabel('Event for Dout7', { exact: true }),
    ).toHaveValue('Pump1');

    // The retired animal-level library surfaces are gone.
    await expect(page.getByRole('list', { name: 'Inherited behavioral events' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: /use .* on this day/i })).toHaveCount(0);
  });

  test('day technical values: rig constants read as effective recording-system values, not routine day edits', async ({
    page,
  }) => {
    // raw_data_to_volts / times_period_multiplier are recording-system DEFAULTS copied into the day.
    // The Day Editor presents them as effective, READ-ONLY values (no editable input here) labelled
    // against the current recording-system default, and routes edits to Recording System.
    await seedAndOpen(page, buildConfiguredWorkspaceBlob(), `/#/day/${DAY_ID}`);
    await expect(
      page.getByRole('heading', { level: 1, name: `Day Editor: ${ANIMAL_ID} - 2023-06-22` }),
    ).toBeVisible();

    // The Overview section hosts the Technical parameters block as a collapsible <details>; expand
    // it via the same robust open pattern, asserting a revealed value, then check the rest.
    await page.getByRole('button', { name: /^Overview — / }).click();
    await openDetails(
      page.getByText('Technical parameters', { exact: true }),
      page.getByText('Raw data to volts', { exact: true }),
    );

    // The rig constants are presented as effective recording-system values for this day.
    await expect(page.getByText('Times period multiplier', { exact: true })).toBeVisible();

    // They are READ-ONLY effective values, NOT routine editable day fields: there is no
    // textbox/spinbutton named for either rig constant on this day surface (the only editable
    // inputs in the block are the genuine day-only facts — header path and units). A scientist
    // cannot mistake these for a day edit and silently diverge the recorded conversion factor.
    await expect(page.getByRole('spinbutton', { name: 'Raw data to volts' })).toHaveCount(0);
    await expect(page.getByRole('textbox', { name: 'Raw data to volts' })).toHaveCount(0);
    await expect(page.getByRole('spinbutton', { name: 'Times period multiplier' })).toHaveCount(0);

    // The status cue marks them as inherited from the recording-system default.
    await expect(page.getByText('Using recording-system default').first()).toBeVisible();

    // The route to change them is the Recording System tab (read-only-with-route-to-Recording-System),
    // not an in-place day edit.
    const editLink = page.getByRole('link', { name: 'Edit in Recording System' });
    await expect(editLink).toBeVisible();
    await expect(editLink).toHaveAttribute(
      'href',
      `#/animal/${ANIMAL_ID}/recording-system?field=data_acq_device`,
    );
  });
});
