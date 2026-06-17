/**
 * E2E: Optogenetics — the two-layer opto model end to end (animal implant + day FsGUI protocol).
 *
 * Optogenetics is the highest-risk metadata in this app: trodes_to_nwb gates ALL optogenetics on
 * FOUR animal-level sections each being present (excitation source / optical fiber / virus injection /
 * stimulation software) and SILENTLY drops the whole block otherwise — so a partial opto session that
 * "converts without error" produces an NWB with no optogenetics at all. The merge additionally emits
 * BOTH the converter spelling and the schema spelling for two keys (a documented compatibility shim):
 *   - `optogenetic_stimulation_software` (converter gate key) AND `opto_software` (schema spelling),
 *   - `volume_in_uL` (converter, capital L; bracket-read or KeyError crash) AND `volume_in_ul` (schema).
 * These specs drive the SHIPPED surfaces and assert the CURRENT control serving each user job:
 *
 *  1. Opto OFF → a clean no-opto export (empty opto arrays, no `opto_software`/`volume_*`, no opto
 *     validation block) — Download is enabled for the valid non-opto day.
 *  2. Opto ON but incomplete → the four required sections are revealed/required AND export is BLOCKED
 *     by the all-or-nothing `partial_configuration` rule (Download disabled, blocking alert shown).
 *  3. The day-level FsGUI protocol editor requires camera + epoch references as CONTROLLED choices
 *     (a select of known cameras, a checkbox per known task epoch) — applied to a SELECTED SUBSET of
 *     epochs, not forced day-wide.
 *  4. A COMPLETE opto session exports YAML carrying BOTH key spellings for each shimmed pair, with the
 *     schema-required opto fields present and non-empty.
 *
 * QA discipline: role/accessible-name or route selectors only (never CSS class for app controls); wait
 * on locators/URLs/events (never sleeps); reset + seed per test for independence. Targeted YAML
 * assertions (the byte baselines own whole-file regression).
 */

import { test, expect } from '@playwright/test';
import {
  resetWorkspace,
  seedAndOpen,
  buildConfiguredWorkspaceBlob,
  captureDownload,
  ANIMAL_ID,
  DAY_ID,
} from './helpers/workspace';

const EXPECTED_FILENAME = '06222023_remy_metadata.yml';

/**
 * A COMPLETE, converter-valid optogenetics implant for the realistic `remy` animal.
 *
 * Shape mirrors the opto-complete golden fixture (src/__tests__/fixtures/golden/20230622_sample_metadata.yml):
 * exactly ONE excitation source (trodes_to_nwb rejects more than one), a fully-filled optical fiber and
 * virus injection — both carrying the `reference` trodes_to_nwb reads unconditionally — and the
 * stimulation-software name (the converter gate key). `volume_in_uL` is the stored converter spelling;
 * the merge derives `volume_in_ul` from it.
 *
 * @type {object}
 */
const COMPLETE_OPTOGENETICS = {
  opto_excitation_source: [
    {
      name: 'Omicron LuxX+ Blue',
      model_name: 'Omicron LuxX+ 488-100',
      description: 'Laser for optogenetic stimulation',
      wavelength_in_nm: 488,
      power_in_W: 0.077,
      intensity_in_W_per_m2: 10000000000,
    },
  ],
  optical_fiber: [
    {
      name: 'Fiber 1',
      hardware_name: 'demo fiber device',
      implanted_fiber_description: 'optogenetic fiber in CA1',
      location: 'CA1',
      hemisphere: 'right',
      ap_in_mm: 0,
      ml_in_mm: 0,
      dv_in_mm: 0,
      roll_in_deg: 0,
      pitch_in_deg: 0,
      yaw_in_deg: 0,
      reference: 'Bregma at the cortical surface',
    },
  ],
  virus_injection: [
    {
      name: 'Injection 1',
      description: 'Viral injection for optogenetic stimulation',
      hemisphere: 'right',
      location: 'CA1',
      ap_in_mm: 0,
      ml_in_mm: 0,
      dv_in_mm: 0,
      roll_in_deg: 0,
      pitch_in_deg: 0,
      yaw_in_deg: 0,
      reference: 'Bregma at the cortical surface',
      virus_name: 'demo_virus_1',
      titer_in_vg_per_ml: 1000000000,
      volume_in_uL: 0.45,
    },
  ],
  optogenetic_stimulation_software: 'fs-gui',
};

/**
 * A DAY FsGUI protocol that stimulates a SUBSET of the day's task epochs (epoch 2 only — the day
 * defines task epochs 1–5), referencing the day's camera 0 and a day behavioral event by name.
 * Stored on `day.fs_gui_yamls` (the day-owned collection the merge reads).
 *
 * @type {object}
 */
const DAY_FS_GUI_PROTOCOL = {
  name: 'fsgui_theta_trigger.yaml',
  epochs: [2],
  power_in_mW: 77,
  dio_output_name: 'reward_left',
  camera_id: 0,
};

/**
 * Build a blob with a COMPLETE opto implant on `remy` and an FsGUI protocol on the day's epoch 2.
 * @returns {{ schemaVersion: number, workspace: object }} Loader-ready blob.
 */
function buildCompleteOptoBlob() {
  const blob = buildConfiguredWorkspaceBlob();
  blob.workspace.animals[ANIMAL_ID].optogenetics = structuredClone(COMPLETE_OPTOGENETICS);
  blob.workspace.days[DAY_ID].fs_gui_yamls = [structuredClone(DAY_FS_GUI_PROTOCOL)];
  return blob;
}

test.describe('Optogenetics export gating and the two-layer opto model', () => {
  test.beforeEach(async ({ page }) => {
    await resetWorkspace(page);
  });

  test('opto OFF: the realistic day exports a clean no-opto state with no required-field noise', async ({
    page,
  }) => {
    // The realistic seed is NON-opto (animal.optogenetics === undefined). The merge must emit a
    // no-opto export: empty opto arrays, the schema-spelling compatibility keys (opto_software /
    // volume_in_ul) ABSENT, and no opto validation block — and the status surface reads honestly.
    await seedAndOpen(page, buildConfiguredWorkspaceBlob(), `/#/day/${DAY_ID}`);
    await expect(
      page.getByRole('heading', { level: 1, name: `Day Editor: ${ANIMAL_ID} - 2023-06-22` }),
    ).toBeVisible();

    await page.getByRole('button', { name: 'Export', exact: true }).click();
    await expect(page.getByRole('heading', { level: 2, name: 'Export — 2023-06-22' })).toBeVisible();

    // The export is NOT blocked by opto (a non-opto day is valid) — Download is enabled.
    await expect(page.getByRole('button', { name: 'Download' })).toBeEnabled();

    const { filename, text } = await captureDownload(page, async () => {
      await page.getByRole('button', { name: 'Download' }).click();
    });
    expect(filename).toBe(EXPECTED_FILENAME);

    // The opto sections are emitted EMPTY (legacy formData parity) — the converter sees no opto.
    expect(text).toMatch(/^opto_excitation_source: \[\]$/m);
    expect(text).toMatch(/^optical_fiber: \[\]$/m);
    expect(text).toMatch(/^virus_injection: \[\]$/m);
    expect(text).toMatch(/^fs_gui_yamls: \[\]$/m);
    // The converter gate key is present-but-empty; the schema-spelling compatibility duplicate is
    // OMITTED for a non-opto export (so the bytes match the legacy non-opto shape).
    expect(text).toMatch(/^optogenetic_stimulation_software: ['"]{2}$/m);
    expect(text).not.toMatch(/^opto_software:/m);
    // No virus volume keys at all (no virus injection rows), and no opto-completeness noise.
    expect(text).not.toContain('volume_in_uL');
    expect(text).not.toContain('volume_in_ul');
  });

  test('opto ON but incomplete: the four sections are required and partial config BLOCKS export', async ({
    page,
  }) => {
    // Seed a PARTIALLY-configured opto implant (an excitation source + software only — no fiber, no
    // virus) so we land in the "incomplete opto" state quickly, then drive the UI for the assertion.
    const blob = buildConfiguredWorkspaceBlob();
    blob.workspace.animals[ANIMAL_ID].optogenetics = {
      opto_excitation_source: [{ name: 'Omicron LuxX+ Blue' }],
      optical_fiber: [],
      virus_injection: [],
      optogenetic_stimulation_software: 'fs-gui',
    };
    await seedAndOpen(page, blob, `/#/animal/${ANIMAL_ID}/optogenetics`);

    // --- The opto editor reveals the four required sections and flags the incomplete state. ---
    await expect(page.getByRole('heading', { level: 2, name: 'Optogenetics Setup' })).toBeVisible();
    // Opto is ON (the enable control is checked) — the sections below are revealed because it is on.
    await expect(
      page.getByRole('checkbox', { name: 'This animal has optogenetics' }),
    ).toBeChecked();
    // All four converter-required sections are present as their own fieldsets (groups).
    await expect(page.getByRole('group', { name: 'Excitation source' })).toBeVisible();
    await expect(page.getByRole('group', { name: 'Optical fibers' })).toBeVisible();
    await expect(page.getByRole('group', { name: 'Virus injections' })).toBeVisible();
    await expect(page.getByRole('group', { name: 'Stimulation software' })).toBeVisible();
    // The incomplete-state status names the all-or-nothing rule and the missing sections (the
    // converter silently drops ALL opto otherwise) — so the requirement is surfaced, not hidden.
    const incomplete = page
      .getByRole('status')
      .filter({ hasText: 'blocks export until every optogenetics section' });
    await expect(incomplete).toBeVisible();
    await expect(incomplete).toContainText('silently drop');
    await expect(incomplete).toContainText('a complete optical fiber');
    await expect(incomplete).toContainText('a complete virus injection');

    // --- Export is BLOCKED for the day: the partial_configuration rule fires on the merged day. ---
    await seedAndOpen(page, blob, `/#/day/${DAY_ID}`);
    await page.getByRole('button', { name: 'Export', exact: true }).click();
    await expect(page.getByRole('heading', { level: 2, name: 'Export — 2023-06-22' })).toBeVisible();

    // The export-preview's blocking alert names the opto all-or-nothing failure. Scoped by its text so
    // it is not confused with the header readiness bar's alert.
    const blocked = page.getByRole('alert').filter({ hasText: /Resolve \d+ validation error/ });
    await expect(blocked).toBeVisible();
    await expect(blocked).toContainText(/Resolve \d+ validation error/);
    await expect(
      blocked.getByText(/All fields required \(or none\)/),
    ).toBeVisible();
    // The converter-gate field checklist is rendered (the present/absent marks) inside the message.
    await expect(blocked.getByText(/optical_fiber ✗/)).toBeVisible();
    await expect(blocked.getByText(/virus_injection ✗/)).toBeVisible();
    // The incomplete opto state CANNOT export — Download is gated.
    await expect(page.getByRole('button', { name: 'Download' })).toBeDisabled();
  });

  test('per-epoch optogenetics: power/pulse are controlled numeric inputs applied to a SELECTED epoch subset', async ({
    page,
  }) => {
    // The two-layer opto model: the animal is implanted; the DAY records which epochs were stimulated
    // and at what power/pulse. In the epoch grid that is per-epoch numeric inputs (Opto mW / Pulse ms),
    // shown ONLY for an implanted animal — opto is epoch-scoped, never forced day-wide. (The protocol's
    // camera + DIO output are set once on the Day tab, not free-typed per epoch.)
    const blob = buildConfiguredWorkspaceBlob();
    blob.workspace.animals[ANIMAL_ID].optogenetics = structuredClone(COMPLETE_OPTOGENETICS);
    blob.workspace.days[DAY_ID].fs_gui_yamls = [];
    await seedAndOpen(page, blob, `/#/day/${DAY_ID}`);

    await page.getByRole('button', { name: 'Epochs', exact: true }).click();
    await expect(page.getByRole('heading', { level: 2, name: 'Epochs' })).toBeVisible();

    // The opto columns render ONLY for an implanted animal (the two-layer model's day layer).
    await expect(page.getByRole('columnheader', { name: /Opto \(mW\)/ })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: /Pulse \(ms\)/ })).toBeVisible();

    // Per-epoch power is a CONTROLLED numeric input (spinbutton), one per epoch row — not a free-text
    // protocol field. Set power on epoch 2 only; epoch 4 stays empty (a subset, not day-wide).
    const power2 = page.getByRole('spinbutton', { name: /Epoch 2 opto power/i });
    const power4 = page.getByRole('spinbutton', { name: /Epoch 4 opto power/i });
    await expect(power2).toBeVisible();
    await expect(power4).toBeVisible();
    await power2.fill('40');
    await power2.blur();
    await expect(power2).toHaveValue('40');
    // Opto is epoch-scoped, not applied to the whole day: epoch 4's power stays empty.
    await expect(power4).toHaveValue('');
  });

  test('complete opto session exports BOTH converter and schema key spellings, fields non-empty', async ({
    page,
  }) => {
    // Seed a COMPLETE opto implant + an FsGUI protocol on epoch 2, then export through the real
    // per-day download path and assert the shimmed dual spellings + non-empty required opto fields.
    await seedAndOpen(page, buildCompleteOptoBlob(), `/#/day/${DAY_ID}`);
    await expect(
      page.getByRole('heading', { level: 1, name: `Day Editor: ${ANIMAL_ID} - 2023-06-22` }),
    ).toBeVisible();

    await page.getByRole('button', { name: 'Export', exact: true }).click();
    await expect(page.getByRole('heading', { level: 2, name: 'Export — 2023-06-22' })).toBeVisible();
    // A complete opto session is NOT blocked — Download is enabled.
    await expect(page.getByRole('button', { name: 'Download' })).toBeEnabled();

    const { filename, text } = await captureDownload(page, async () => {
      await page.getByRole('button', { name: 'Download' }).click();
    });
    expect(filename).toBe(EXPECTED_FILENAME);

    // ---- BOTH spellings of each shimmed key are present. ----
    // Stimulation-software pair: converter gate key `optogenetic_stimulation_software`
    // (mergeDayMetadata line ~424) AND schema spelling `opto_software` (line ~425), same value.
    expect(text).toMatch(/^optogenetic_stimulation_software: fs-gui$/m);
    expect(text).toMatch(/^opto_software: fs-gui$/m);
    // Virus-volume pair: converter spelling `volume_in_uL` (capital L; emitVirusInjections line ~131)
    // AND schema spelling `volume_in_ul` (line ~132), both derived from the one stored value.
    expect(text).toMatch(/^ {4}volume_in_uL: 0\.45$/m);
    expect(text).toMatch(/^ {4}volume_in_ul: 0\.45$/m);

    // ---- Schema-required opto sections are present and non-empty (not the `[]` of a no-opto export). ----
    expect(text).not.toMatch(/^opto_excitation_source: \[\]$/m);
    expect(text).toMatch(/^opto_excitation_source:\n {2}- name: Omicron LuxX\+ Blue$/m);
    expect(text).toMatch(/^optical_fiber:\n {2}- name: Fiber 1$/m);
    expect(text).toMatch(/^virus_injection:\n {2}- name: Injection 1$/m);
    // The coordinate reference trodes_to_nwb reads unconditionally is present on fiber + virus.
    expect(text).toMatch(/^ {4}reference: Bregma at the cortical surface$/m);

    // ---- The day FsGUI protocol exported, bound to the SELECTED epoch (2) and a known camera. ----
    expect(text).not.toMatch(/^fs_gui_yamls: \[\]$/m);
    expect(text).toMatch(/^fs_gui_yamls:\n {2}- name: fsgui_theta_trigger\.yaml$/m);
    expect(text).toMatch(/^ {4}epochs:\n {6}- 2$/m);
    expect(text).toMatch(/^ {4}camera_id: 0$/m);
  });
});
