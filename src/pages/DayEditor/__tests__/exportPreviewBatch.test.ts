/**
 * The export-preview batch helper (Phase 5 — epoch-editor).
 *
 * `exportAllDays(workspace, animalKey, { actions, strict })` exports ALL of one animal's recording days
 * by REUSING the shared `exportSelectedDays` → `exportDayFile` core (no second export path), and enriches
 * each SKIPPED day with a FIELD-LEVEL repair link resolved through `repairRouting` (the same target the
 * single-day gate routes to) — never a bare day link. `firstBlockingRepairLink` is the pure resolver
 * behind that enrichment.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { makeSummaryWorkspace } from '../../../__tests__/helpers/integration-test-helpers';
import { buildRealisticWorkspace } from '../../../__tests__/fixtures/workspaceBuilders';
import { encodeYaml, downloadYamlFile } from '../../../io/yaml';
import { mergeDayMetadata } from '../../../state/workspaceUtils';
import { firstBlockingRepairLink, exportAllDays } from '../exportPreviewBatch';

// Mock only the download side-effect; everything else (encodeYaml, formatDeterministicFilename,
// checkShadowExport, validateDay) stays REAL so the byte-identity + routing assertions are genuine.
vi.mock('../../../io/yaml', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../io/yaml')>();
  return { ...actual, downloadYamlFile: vi.fn() };
});

/** A loose animal/day shape for the untyped (.js) realistic builder. */
type LooseAnimal = { id: string; [k: string]: unknown };
type LooseDay = { id: string; [k: string]: unknown };

/** A single-animal workspace from the realistic builder, optionally mutated. */
function oneAnimal(mutate?: (animal: LooseAnimal, day: LooseDay) => void) {
  const { animal, day } = buildRealisticWorkspace() as { animal: LooseAnimal; day: LooseDay };
  if (mutate) mutate(animal, day);
  return { workspace: { animals: { [animal.id]: animal }, days: { [day.id]: day } }, animalKey: animal.id, dayId: day.id };
}

describe('firstBlockingRepairLink', () => {
  it('routes an ANIMAL-owned blocking issue to the owning animal-setup tab with a ?field= deep-link', () => {
    // An empty electrode-group location is an animal-owned blocking error (SURFACE_BY_CODE.empty_location).
    const { workspace, animalKey, dayId } = oneAnimal((animal) => {
      const cfg = animal.configurationHistory as Array<{ devices: { electrode_groups: Array<{ location: string }> } }>;
      cfg[0].devices.electrode_groups[0].location = '';
    });

    const link = firstBlockingRepairLink(workspace, animalKey, dayId);

    expect(link).not.toBeNull();
    expect(link!.label).toBe('Fix in Animal Setup → Electrode Groups');
    expect(link!.href).toMatch(/^#\/animal\/remy\/electrode-groups\?field=/);
    expect(link!.message).toBeTruthy();
  });

  it('routes a DAY-owned blocking issue to the day editor (the route cannot carry a ?field=)', () => {
    // A free-text species ("Rat") is a day-owned blocking error (DANDI rejects it), repaired in Overview.
    const { workspace, animalKey, dayId } = oneAnimal((animal) => {
      (animal.subject as { species: string }).species = 'Rat';
    });

    const link = firstBlockingRepairLink(workspace, animalKey, dayId);

    expect(link).not.toBeNull();
    expect(link!.label).toBe('Fix in Overview');
    // The day route carries the field as a ?field= deep-link (useDayIdFromUrl strips it from the id),
    // so the cross-day link lands on the owning tab/field — not the default Day tab.
    expect(link!.href).toMatch(/^#\/day\/remy-2023-06-22\?field=/);
    expect(link!.message).toBeTruthy();
  });

  it('returns null for a day with no blocking error (the caller falls back to the skip reason)', () => {
    const { workspace, animalKey, dayId } = oneAnimal();
    expect(firstBlockingRepairLink(workspace, animalKey, dayId)).toBeNull();
  });

  it('carries the issue\'s explicit step in the day link when it differs from the field-name inference', () => {
    // An unpinned day in a multi-config animal routes to step `devices` but focuses `configurationVersion`
    // — a field that would infer to the `validation` catch-all (no tab). The link must carry `step` so the
    // receiver opens the right tab, not re-infer it from the field name.
    const { workspace, animalKey, dayId } = oneAnimal((animal, day) => {
      const cfg = animal.configurationHistory as Array<{ version: number; devices: unknown }>;
      cfg.push({ version: 2, date: '2023-07-01', description: 'v2', devices: cfg[0].devices, appliedToDays: [] } as never);
      delete (day as Record<string, unknown>).configurationVersion;
    });

    const link = firstBlockingRepairLink(workspace, animalKey, dayId);

    expect(link).not.toBeNull();
    expect(link!.label).toBe('Fix in Devices');
    expect(link!.href).toContain('step=devices');
    expect(link!.href).toContain('field=configurationVersion');
  });
});

describe('exportAllDays', () => {
  beforeEach(() => vi.clearAllMocks());

  it('exports the animal\'s valid day byte-identically and reports its filename', () => {
    const { workspace } = makeSummaryWorkspace();
    const actions = { updateDay: vi.fn() };

    const result = exportAllDays(workspace, 'remy', { actions, strict: true });

    // remy has a valid day + an incomplete day → exactly one exported file.
    expect(result.exported).toHaveLength(1);
    expect(result.exported[0].filename).toBe('06222023_remy_metadata.yml');

    // The bytes are the SAME single-day bytes (batch === single export): the golden encoder over the merge.
    const ws = workspace as { animals: Record<string, LooseAnimal>; days: Record<string, LooseDay> };
    const expectedBytes = encodeYaml(
      mergeDayMetadata(ws.animals.remy as never, ws.days['remy-2023-06-22'] as never)
    );
    expect(downloadYamlFile).toHaveBeenCalledTimes(1);
    expect(downloadYamlFile).toHaveBeenCalledWith('06222023_remy_metadata.yml', expectedBytes);
  });

  it('skips the incomplete day with a (fallback) reason and a fix link', () => {
    const { workspace, ids } = makeSummaryWorkspace();
    const result = exportAllDays(workspace, 'remy', { actions: { updateDay: vi.fn() }, strict: true });

    expect(result.skipped).toHaveLength(1);
    const skip = result.skipped[0];
    expect(skip.dayId).toBe(ids.incompleteDayId);
    // The incomplete day has no error-severity issue, so the field-level resolver returns null and the
    // shared skip reason + day link are used (still linked — just not field-level).
    expect(skip.message).toBeTruthy();
    expect(skip.fixHref).toBeTruthy();
  });

  it('routes a valid-but-warning day to the acknowledgement surface (not shipped unacknowledged)', () => {
    // Lowercase one of the two CA1 electrode-group locations → a region-fragmentation WARNING (non-
    // blocking), so the day stays valid but carries an unacknowledged warning.
    const { animal, day } = buildRealisticWorkspace() as { animal: LooseAnimal; day: LooseDay };
    const cfg = animal.configurationHistory as Array<{ devices: { electrode_groups: Array<{ location: string }> } }>;
    const groups = cfg[0].devices.electrode_groups;
    groups[groups.findIndex((g) => g.location === 'CA1')].location = 'ca1';
    const workspace = { animals: { [animal.id]: animal }, days: { [day.id]: day } };

    const result = exportAllDays(workspace, animal.id, { actions: { updateDay: vi.fn() }, strict: true });

    // The day is NOT shipped unacknowledged — it is skipped with a link to Validation & Export (the ack flow).
    expect(result.exported).toHaveLength(0);
    expect(result.skipped).toHaveLength(1);
    expect(result.skipped[0].fixHref).toBe(`#/animal/${animal.id}/export`);
  });

  it('links a day skipped for a blocking ERROR to its issue via the field-level repair route', () => {
    // totoro's only day has a whitespace session_description (a real schema error) → skipped, and its
    // skip link is the field-level repair route (named issue + "Fix in Overview"), not a bare day link.
    const { workspace, ids } = makeSummaryWorkspace();
    const result = exportAllDays(workspace, 'totoro', { actions: { updateDay: vi.fn() }, strict: true });

    expect(result.exported).toHaveLength(0);
    expect(result.skipped).toHaveLength(1);
    const skip = result.skipped[0];
    expect(skip.dayId).toBe(ids.errorDayId);
    expect(skip.fixLabel).toBe('Fix in Overview');
    // Field-level: the day link carries the blocking field as a ?field= deep-link.
    expect(skip.fixHref).toMatch(new RegExp(`^#/day/${ids.errorDayId}\\?field=`));
    // The message names the specific blocking issue (not a generic "has errors").
    expect(skip.message).toBeTruthy();
  });
});
