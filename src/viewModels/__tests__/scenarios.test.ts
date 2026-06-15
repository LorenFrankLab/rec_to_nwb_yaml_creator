/**
 * Cross-surface scenario matrix — the workflow-view-model safety net (Phase 5).
 *
 * The per-builder suites (2a–2d) each test one surface; Phase 4 tests the command layer. This file
 * adds the CROSS-CUTTING matrix: scenarios that span surfaces or hit the nasty states, asserted
 * across the relevant builders so the surfaces are proven to AGREE on shared facts (day status, a
 * blocking section, a recovery classification). It is the executable form of the severity-mapping
 * invariant in shared-contracts.md, and it locks the descriptor boundary the builders emit today.
 *
 * Net-new tests only — no source change. Each scenario is built once from the consolidated
 * `fixtures/scenarioWorkspaces` (one source; no copy-pasted workspaces).
 */
import { describe, it, expect } from 'vitest';
import { buildValidationSummaryViewModel } from '../validationSummaryViewModel';
import { buildAnimalWorkspaceViewModel } from '../animalWorkspaceViewModel';
import { buildAnimalViewModel } from '../animalViewModel';
import { buildDayEditorViewModel } from '../dayEditorViewModel';
import { WORKFLOW_COMMAND_CATALOG } from '../commands/commandCatalog';
import * as fx from './fixtures/scenarioWorkspaces';
import type { Workspace } from './fixtures/scenarioWorkspaces';

// ── small accessors over the builder outputs (kept local; the shapes are asserted, not re-derived) ──

/** The ValidationSummary day row for a given id (rows are recomputed per workspace). */
const vsRow = (ws: Workspace, animalId: string, dayId: string) =>
  buildValidationSummaryViewModel(ws, animalId).days.find((r) => r.dayId === dayId);

/** The AnimalWorkspace day row for a given id. */
const awRow = (ws: Workspace, animalId: string, dayId: string) =>
  buildAnimalWorkspaceViewModel(ws, animalId).selectedAnimal?.dayRows.find((r) => r.dayId === dayId);

/** An AnimalView setup/day ring by section key. */
const ring = (ws: Workspace, animalId: string, key: string) =>
  buildAnimalViewModel(ws, animalId, 'days')
    .groups.flatMap((g) => g.sections)
    .find((s) => s.key === key);

// ── 1. empty workspace ──────────────────────────────────────────────────────────────────────────

describe('scenario: empty workspace', () => {
  const ws = fx.emptyWorkspace();

  it('every builder returns its empty/zero shape without throwing', () => {
    const vs = buildValidationSummaryViewModel(ws);
    expect(vs.counts).toEqual({ valid: 0, error: 0, incomplete: 0 });
    expect(vs.days).toEqual([]);
    expect(vs.empty).toBeDefined();

    const aw = buildAnimalWorkspaceViewModel(ws);
    expect(aw.animals).toEqual([]);
    expect(aw.empty).toBeDefined();

    expect(() => buildAnimalViewModel(ws, 'nope', 'days')).not.toThrow();

    const de = buildDayEditorViewModel(ws, undefined);
    expect(de.shell.state).not.toBe('ok');
  });
});

// ── 2. one incomplete animal (no subject, no days) ──────────────────────────────────────────────

describe('scenario: one incomplete animal (no subject)', () => {
  const { workspace, animalId } = fx.incompleteAnimal();

  it('AnimalWorkspace shows the first-run setup card', () => {
    const aw = buildAnimalWorkspaceViewModel(workspace, animalId);
    expect(aw.selectedAnimal?.showSetupCard).toBe(true);
  });

  it('AnimalView setup rings read todo (nothing configured yet)', () => {
    for (const key of ['electrode-groups', 'recording-system', 'cameras', 'optogenetics']) {
      expect(ring(workspace, animalId, key)?.status, key).toBe('todo');
    }
  });
});

// ── 3. complete animal, no days ─────────────────────────────────────────────────────────────────

describe('scenario: complete animal, no days', () => {
  const { workspace, animalId } = fx.completeAnimalNoDays();

  it('AnimalView Recording Days count is 0', () => {
    expect(ring(workspace, animalId, 'days')?.countLabel).toBe('0');
  });

  it('the scoped ValidationSummary is empty', () => {
    const vs = buildValidationSummaryViewModel(workspace, animalId);
    expect(vs.days).toEqual([]);
    expect(vs.empty).toBeDefined();
  });

  it('a complete animal reads its configured setup rings as done (not a spurious todo)', () => {
    // The complete animal's electrodes + recording system ARE configured, so neither reads 'todo'.
    // This is the consistent counterpart to the under-configured case above: a "complete animal"
    // never shows "not set up" rings while its day exports.
    expect(ring(workspace, animalId, 'electrode-groups')?.status).not.toBe('todo');
    expect(ring(workspace, animalId, 'recording-system')?.status).not.toBe('todo');
  });
});

// ── decision lock: what the AnimalView setup ring reflects ───────────────────────────────────────

describe('AnimalView setup ring reflects the current editable configuration (animal.devices.*)', () => {
  // DECISION (locked here): the setup rings answer "is THIS animal's CURRENT setup configured?",
  // reading `animal.devices.*` (the source the setup tabs edit) — NOT a day's pinned configuration
  // snapshot. A day's pinned-config export-readiness is a separate question owned by the day editor /
  // ValidationSummary. Production `createAnimal` keeps `devices` and `configurationHistory[0]` in
  // sync, so the ring and a latest-pinned day agree; this test pins the source so a future change is
  // a deliberate decision, not an accident.
  it('a configured device set reads the ring as done; an empty one reads todo', () => {
    const complete = fx.realisticReady();
    expect(ring(complete.workspace, complete.animalId, 'electrode-groups')?.status).not.toBe('todo');

    const bare = fx.incompleteAnimal();
    expect(ring(bare.workspace, bare.animalId, 'electrode-groups')?.status).toBe('todo');
  });
});

// ── 4. day missing an export-required field — three surfaces AGREE it is an error ────────────────

describe('scenario: day missing an export-required field', () => {
  const { workspace, animalId, dayId } = fx.dayMissingRequiredField();

  it('ValidationSummary, AnimalWorkspace, and DayEditor all flag the same day as error', () => {
    const vs = buildValidationSummaryViewModel(workspace, animalId);
    const row = vs.days.find((r) => r.dayId === dayId);
    const dayRow = awRow(workspace, animalId, dayId);
    const de = buildDayEditorViewModel(workspace, dayId);

    // ValidationSummary: one error in the count and on the row.
    expect(vs.counts.error).toBe(1);
    expect(row?.status).toBe('error');
    // AnimalWorkspace day row agrees.
    expect(dayRow?.status).toBe('error');
    // DayEditor: export blocked on a validation error, the owning step is error, and a repairable
    // issue is surfaced.
    expect(de.overall).toBe('error');
    expect(de.export.open).toBe(false);
    expect(de.export.reason).toBe('validation-errors');
    expect(de.export.action.disabledReason).toBeDefined();
    expect(de.steps.find((s) => s.key === 'export')?.status).toBe('error');
    const errorIssue = de.issues.find((i) => i.severity === 'error');
    expect(errorIssue?.repair).toBeDefined();

    // Cross-surface agreement: the SAME day reads error on all three.
    expect(row?.status).toBe(dayRow?.status);
    expect(de.overall).toBe(row?.status);
  });
});

// ── 5. imported corrupt day (config can't be merged) ────────────────────────────────────────────

describe('scenario: imported corrupt day (merge fails)', () => {
  const { workspace, animalId, dayId } = fx.corruptConfigDay();

  it('builders surface the corrupt state without throwing; the merge error is caught', () => {
    expect(() => buildValidationSummaryViewModel(workspace, animalId)).not.toThrow();
    expect(() => buildAnimalWorkspaceViewModel(workspace, animalId)).not.toThrow();
    expect(() => buildDayEditorViewModel(workspace, dayId)).not.toThrow();

    expect(vsRow(workspace, animalId, dayId)?.status).toBe('error');
    expect(awRow(workspace, animalId, dayId)?.status).toBe('error');

    const de = buildDayEditorViewModel(workspace, dayId);
    expect(de.shell.state).toBe('ok'); // the day + animal exist; only the merge failed
    expect(de.export.open).toBe(false);
    expect(de.export.reason).toBe('merge-error');
    expect(de.issues.some((i) => i.severity === 'error')).toBe(true);
  });
});

// ── 6. animal-setup issue affecting day export — ring, export gate, and day row AGREE ────────────

describe('scenario: animal-setup issue affecting day export', () => {
  const { workspace, animalId, dayId } = fx.animalSetupBlocksExport();

  it('the AnimalView ring, the DayEditor export gate, and the day row all reflect the block', () => {
    // AnimalView: the recording-system setup ring is error (a day-level animal-surface blocker).
    expect(ring(workspace, animalId, 'recording-system')?.status).toBe('error');
    // DayEditor: export blocked with a reason.
    const de = buildDayEditorViewModel(workspace, dayId);
    expect(de.export.open).toBe(false);
    expect(de.export.action.disabledReason).toBeDefined();
    // The day row reads error on both day-list surfaces.
    expect(vsRow(workspace, animalId, dayId)?.status).toBe('error');
    expect(awRow(workspace, animalId, dayId)?.status).toBe('error');
  });
});

// ── 7. bad-channel warning vs blocker ───────────────────────────────────────────────────────────

describe('scenario: bad-channel warning vs monotonic blocker', () => {
  it('a non-blocking warning maps to warning and does NOT block export', () => {
    const { workspace, animalId, dayId } = fx.dayWithWarning();
    const de = buildDayEditorViewModel(workspace, dayId);
    expect(de.issues.some((i) => i.severity === 'warning')).toBe(true);
    expect(de.export.open).toBe(true);
    expect(vsRow(workspace, animalId, dayId)?.status).toBe('ready');
  });

  it('an un-acked monotonic removal is an error that blocks export with an acknowledge action', () => {
    const { workspace, animal, later } = fx.twoDayRegression(false);
    const de = buildDayEditorViewModel(workspace, later.id);
    const mark = de.badChannels.marks.find((m) => m.ntrodeId === '1' && m.channel === 0);
    expect(mark?.priorBad).toBe(true);
    expect(mark?.requiresAck).toBe(true);
    expect(de.badChannels.blockedRemovals.length).toBeGreaterThan(0);
    expect(de.badChannels.blockedRemovals[0].repair?.command?.id).toBe('acknowledgeBadChannelRemoval');
    expect(de.export.open).toBe(false);
    expect(vsRow(workspace, animal.id, later.id)?.status).toBe('error');
  });

  it('after acknowledgement the same removal is unblocked and exportable', () => {
    const { workspace, animal, later } = fx.twoDayRegression(true);
    const de = buildDayEditorViewModel(workspace, later.id);
    const mark = de.badChannels.marks.find((m) => m.ntrodeId === '1' && m.channel === 0);
    expect(mark?.acked).toBe(true);
    expect(mark?.requiresAck).toBe(false);
    expect(de.badChannels.blockedRemovals.length).toBe(0);
    expect(de.export.open).toBe(true);
    expect(vsRow(workspace, animal.id, later.id)?.status).toBe('ready');
  });
});

// ── 8. ready vs validated vs exported (all exportable, distinct labels) ──────────────────────────

describe('scenario: ready vs validated vs exported', () => {
  it('each lifecycle is ready/exportable, with the lifecycle word distinct per state', () => {
    const ready = fx.realisticReady();
    const validated = fx.validatedDay();
    const exported = fx.exportedDay();

    for (const s of [ready, validated, exported]) {
      expect(buildDayEditorViewModel(s.workspace, s.dayId).export.open).toBe(true);
      expect(vsRow(s.workspace, s.animalId, s.dayId)?.status).toBe('ready');
    }

    expect(buildDayEditorViewModel(ready.workspace, ready.dayId).export.lifecycle).toBe('ready');
    expect(buildDayEditorViewModel(validated.workspace, validated.dayId).export.lifecycle).toBe('validated');
    expect(buildDayEditorViewModel(exported.workspace, exported.dayId).export.lifecycle).toBe('exported');

    // The day-list label distinguishes a live-ready from a downloaded day.
    const readyLabel = vsRow(ready.workspace, ready.animalId, ready.dayId)?.statusLabel;
    const exportedLabel = vsRow(exported.workspace, exported.animalId, exported.dayId)?.statusLabel;
    expect(readyLabel).toBe('Ready to export');
    expect(exportedLabel).toBe('Exported');
    expect(readyLabel).not.toBe(exportedLabel);
  });
});

// ── 9. orphan / missing / wrong-owner day recovery — ValidationSummary + AnimalWorkspace AGREE ───

describe('scenario: day recovery (dangling / wrong-owner / recovered-unlinked)', () => {
  const cases = [
    { name: 'dangling', fixture: fx.danglingReference, recovery: 'dangling_reference', repair: 'removeDayReference' },
    { name: 'wrong-owner', fixture: fx.wrongOwner, recovery: 'wrong_owner', repair: 'unlinkDayReference' },
    { name: 'recovered-unlinked', fixture: fx.recoveredUnlinked, recovery: 'recovered_unlinked', repair: 'relinkDayReference' },
  ] as const;

  for (const c of cases) {
    it(`${c.name}: both day-list surfaces classify it identically and offer the same repair`, () => {
      const { workspace, animalId, dayId } = c.fixture();
      const vs = vsRow(workspace, animalId, dayId);
      const aw = awRow(workspace, animalId, dayId);

      expect(vs?.recovery).toBe(c.recovery);
      expect(aw?.recovery).toBe(c.recovery);
      // The surfaces agree on the classification AND the repair intent (labels are surface-specific).
      expect(vs?.recovery).toBe(aw?.recovery);
      expect(vs?.recoveryDetail?.repair?.command?.id).toBe(c.repair);
      expect(aw?.recoveryDetail?.repair?.command?.id).toBe(c.repair);
      expect(vs?.recoveryDetail?.repair?.command?.id).toBe(aw?.recoveryDetail?.repair?.command?.id);
    });
  }

  it('a recovered-unlinked day surfaces the re-link note on the ValidationSummary', () => {
    const { workspace, animalId } = fx.recoveredUnlinked();
    expect(buildValidationSummaryViewModel(workspace, animalId).relinkNote).toBeDefined();
  });
});

// ── 10. the severity-mapping invariant (one case per row of shared-contracts.md) ─────────────────

describe('severity-mapping invariant (full table)', () => {
  it('DAY_LIFECYCLE READY / VALIDATED / EXPORTED → ready', () => {
    for (const s of [fx.realisticReady(), fx.validatedDay(), fx.exportedDay()]) {
      expect(vsRow(s.workspace, s.animalId, s.dayId)?.status).toBe('ready');
    }
  });

  it('DAY_LIFECYCLE DRAFT (no blocking error) → todo', () => {
    const { workspace, animalId, dayId } = fx.incompleteDay();
    expect(vsRow(workspace, animalId, dayId)?.status).toBe('todo');
    // A DRAFT is blocked on incomplete steps, NOT a validation error.
    expect(buildDayEditorViewModel(workspace, dayId).export.reason).toBe('incomplete-steps');
  });

  it('a live blocking issue → error', () => {
    const { workspace, animalId, dayId } = fx.dayMissingRequiredField();
    expect(vsRow(workspace, animalId, dayId)?.status).toBe('error');
  });

  it('SECTION_STATUS.TODO → todo (a genuinely never-configured setup section)', () => {
    // A truly under-configured animal (empty devices AND empty config) — NOT the realistic animal,
    // whose devices are populated, so its 'todo' would have been a fixture artifact, not a real state.
    const { workspace, animalId } = fx.incompleteAnimal();
    expect(ring(workspace, animalId, 'electrode-groups')?.status).toBe('todo');
  });

  it('SECTION_STATUS.DONE with no blocking issue → ready', () => {
    const { workspace, animalId } = fx.realisticReady();
    expect(ring(workspace, animalId, 'recording-system')?.status).toBe('ready');
  });

  it('a section in getAnimalBlockingSections → error', () => {
    const { workspace, animalId } = fx.animalSetupBlocksExport();
    expect(ring(workspace, animalId, 'recording-system')?.status).toBe('error');
  });

  it('a non-blocking warning → warning', () => {
    const { workspace, dayId } = fx.dayWithWarning();
    const de = buildDayEditorViewModel(workspace, dayId);
    expect(de.issues.find((i) => i.severity === 'warning')).toBeDefined();
  });
});

// ── descriptor coverage: every command id a builder EMITS is in the Phase-4 catalog ─────────────

describe('descriptor coverage over the scenario fixtures', () => {
  /** Collect every WorkflowCommand id reachable in a built view-model (command.* and notice repairs). */
  const collectCommandIds = (node: unknown, acc: Set<string>, parentKey?: string): void => {
    if (Array.isArray(node)) {
      node.forEach((child) => collectCommandIds(child, acc, parentKey));
      return;
    }
    if (node && typeof node === 'object') {
      const obj = node as Record<string, unknown>;
      // A WorkflowAction's `command` is a WorkflowCommand; a RecoveryNoticeViewModel's `repair` IS a
      // WorkflowCommand (id directly). Both reach here with a string `id` under those keys.
      if (typeof obj.id === 'string' && (parentKey === 'command' || parentKey === 'repair')) {
        acc.add(obj.id);
      }
      for (const [key, value] of Object.entries(obj)) collectCommandIds(value, acc, key);
    }
  };

  it('every emitted WorkflowCommand id is classified in WORKFLOW_COMMAND_CATALOG', () => {
    const ids = new Set<string>();
    const scenarios = [
      fx.realisticReady(),
      fx.dayMissingRequiredField(),
      fx.corruptConfigDay(),
      fx.animalSetupBlocksExport(),
      fx.dayWithWarning(),
      fx.incompleteDay(),
      fx.danglingReference(),
      fx.wrongOwner(),
      fx.recoveredUnlinked(),
    ];
    for (const s of scenarios) {
      collectCommandIds(buildValidationSummaryViewModel(s.workspace, s.animalId), ids);
      collectCommandIds(buildAnimalWorkspaceViewModel(s.workspace, s.animalId), ids);
      collectCommandIds(buildAnimalViewModel(s.workspace, s.animalId, 'days'), ids);
      if (s.dayId) collectCommandIds(buildDayEditorViewModel(s.workspace, s.dayId), ids);
    }
    // The empty workspace + the two-day regression contribute the createAnimal / ack descriptors.
    collectCommandIds(buildAnimalWorkspaceViewModel(fx.emptyWorkspace()), ids);
    const reg = fx.twoDayRegression(false);
    collectCommandIds(buildDayEditorViewModel(reg.workspace, reg.later.id), ids);

    expect(ids.size).toBeGreaterThan(0);
    for (const id of ids) {
      expect(WORKFLOW_COMMAND_CATALOG, `emitted command "${id}" is not catalogued`).toHaveProperty(id);
    }
  });
});
