/**
 * Bulk "Export selected" batch (Phase 2 — epoch-editor).
 *
 * `exportSelectedDays(workspace, animalKey, dayIds, { actions, strict })` batches the SHARED per-day
 * export core (`exportDayFile`) over a user-selected subset of an animal's days: valid days download
 * byte-identically (the same `encodeYaml(mergeDayMetadata(...))` bytes the golden baselines pin), and
 * invalid / not-exportable days are skipped with a linked reason. It is NOT a second exporter — it
 * reuses the same parity/skip-on-invalid behavior as the Validation Summary's Export Valid Only path.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { makeSummaryWorkspace } from '../../../__tests__/helpers/integration-test-helpers';
import { encodeYaml, downloadYamlFile } from '../../../io/yaml';
import { mergeDayMetadata } from '../../../state/workspaceUtils';
import type { Animal, Day } from '../../../state/workspaceTypes';
import { exportSelectedDays } from '../exportSelectedDays';
import { WORKFLOW_COMMAND_CATALOG } from '../../../viewModels/commands/commandCatalog';

/** The untyped JS test-fixture workspace, narrowed for the byte-identity assertion below. */
type FixtureWorkspace = { animals: Record<string, Animal>; days: Record<string, Day> };

// The download side-effect is mocked so the batch can be asserted without a real download; everything
// else (encodeYaml, formatDeterministicFilename, checkShadowExport) stays REAL so the byte-identity
// assertion is genuine and the parity gate runs for real.
vi.mock('../../../io/yaml', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../io/yaml')>();
  return { ...actual, downloadYamlFile: vi.fn() };
});

describe('exportSelectedDays — bulk Export selected', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('exports the valid selected day byte-identically and skips the invalid one with a linked reason', () => {
    const { workspace, ids } = makeSummaryWorkspace();
    const actions = { updateDay: vi.fn() };

    const result = exportSelectedDays(workspace, 'remy', [ids.validDayId, ids.incompleteDayId], {
      actions,
      strict: true,
    });

    // The valid day is exported; the incomplete day is skipped.
    expect(result.exported).toEqual([ids.validDayId]);
    expect(result.skipped).toHaveLength(1);
    expect(result.skipped[0].dayId).toBe(ids.incompleteDayId);
    // A skipped day links to where its issue is fixed (the day editor).
    expect(result.skipped[0].href).toBe(`#/day/${ids.incompleteDayId}`);
    expect(result.skipped[0].reason).toBeTruthy();

    // Exactly one download, with the SAME bytes the canonical encoder + golden baselines produce.
    expect(downloadYamlFile).toHaveBeenCalledTimes(1);
    const ws = workspace as FixtureWorkspace;
    const expectedBytes = encodeYaml(mergeDayMetadata(ws.animals.remy, ws.days[ids.validDayId]));
    expect(vi.mocked(downloadYamlFile).mock.calls[0][1]).toBe(expectedBytes);

    // The exported day is marked exported in its lifecycle state (display-only — never in the YAML).
    expect(actions.updateDay).toHaveBeenCalledWith(
      ids.validDayId,
      expect.objectContaining({ state: expect.objectContaining({ exported: true }) })
    );
  });

  it('skips a VALID day with outstanding warnings, routing it to Validation & Export (no unacknowledged export)', () => {
    const { workspace, ids } = makeSummaryWorkspace();
    // Give the valid day a non-blocking warning (a task-definition reconciliation to review) — the
    // same kind the Export-Valid-Only preflight makes the user acknowledge before download.
    const day = (workspace as FixtureWorkspace).days[ids.validDayId];
    // Only `task_name` is read by the reconciliation warning rule; cast past the fuller stored type.
    day.state = {
      ...(day.state || {}),
      taskDefinitionReconciliations: [{ task_name: 'W-track' }],
    } as unknown as typeof day.state;
    const actions = { updateDay: vi.fn() };

    const result = exportSelectedDays(workspace, 'remy', [ids.validDayId], { actions, strict: true });

    expect(result.exported).toEqual([]);
    expect(result.skipped).toHaveLength(1);
    expect(result.skipped[0].dayId).toBe(ids.validDayId);
    // Routed to the gated surface (not the day editor), where the warning can be acknowledged.
    expect(result.skipped[0].href).toBe('#/animal/remy/export');
    expect(result.skipped[0].reason).toMatch(/warning/i);
    expect(downloadYamlFile).not.toHaveBeenCalled();
  });

  it('skips a day with blocking errors (no download) and reports it', () => {
    const { workspace, ids } = makeSummaryWorkspace();
    const actions = { updateDay: vi.fn() };

    const result = exportSelectedDays(workspace, 'totoro', [ids.errorDayId], { actions, strict: true });

    expect(result.exported).toEqual([]);
    expect(result.skipped.map((s) => s.dayId)).toEqual([ids.errorDayId]);
    expect(downloadYamlFile).not.toHaveBeenCalled();
  });

  it('is classified as a page-orchestrated command in the catalog (no store-write handler)', () => {
    expect(WORKFLOW_COMMAND_CATALOG.exportSelectedDays).toBe('page');
  });

  it('skips a selected day that is no longer present without throwing', () => {
    const { workspace } = makeSummaryWorkspace();
    const actions = { updateDay: vi.fn() };

    const result = exportSelectedDays(workspace, 'remy', ['remy-gone'], { actions, strict: true });

    expect(result.exported).toEqual([]);
    expect(result.skipped.map((s) => s.dayId)).toEqual(['remy-gone']);
    expect(downloadYamlFile).not.toHaveBeenCalled();
  });
});
