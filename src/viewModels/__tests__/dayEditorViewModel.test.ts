/**
 * Parity tests for buildDayEditorViewModel.
 *
 * The builder must reproduce what the day-editor surface renders today (src/pages/DayEditor). Each
 * assertion recomputes the page's truth from the same domain functions the components call
 * (`computeStepStatus` / `validateDay` for the stepper, `mergeDayMetadata` for the effective field
 * values, `ownershipForIssue` / `repairTargetForIssue` for issue classification + routing,
 * `isExportEnabled` for the export gate, `priorBadChannels` / `getBadChannelRemovalAcks` for the
 * bad-channel monotonicity), then asserts the view-model reproduces it — so a divergence fails.
 *
 * Grouped by the four concern areas: shell/steps/breadcrumb, overview field sources,
 * issues/export/notices, and bad channels.
 */
import { describe, it, expect, vi } from 'vitest';
import { buildDayEditorViewModel } from '../dayEditorViewModel';
import { commandHandlers } from '../commands/commandHandlers';
import type { CommandActions } from '../commands/commandHandlers';
import { buildRealisticWorkspace } from '../../__tests__/fixtures/workspaceBuilders';
import { mergeDayMetadata } from '../../state/workspaceUtils';
import { computeStepStatus } from '../../domain/stepStatus';
import { validateDay } from '../../domain/dayValidationComposer';
import { isExportEnabled } from '../../domain/stepGate';
import { ownershipForIssue } from '../../domain/workflowOwnership';
import { repairTargetForIssue } from '../../domain/repairRouting';
import { workflowCategoryForIssue, WORKFLOW_CATEGORY_LABELS } from '../../domain/workflowCategories';
import { priorBadChannels } from '../../domain/badChannelMonotonicity';
import type { Animal, Day } from '../../state/workspaceTypes';

type Idable = { id: string } & Record<string, unknown>;
type Workspace = { animals: Record<string, unknown>; days: Record<string, unknown> };

/** `buildRealisticWorkspace` is untyped JS; narrow its result so `.id`/spreads type-check. */
function loadRealistic(): { animal: Idable; day: Idable } {
  return buildRealisticWorkspace() as { animal: Idable; day: Idable };
}

function wrap(animal: Idable, day: Idable): Workspace {
  return { animals: { [animal.id]: animal }, days: { [day.id]: day } };
}

/** Deep-clone a JSON-safe fixture (the realistic fixture is plain data). */
function clone<T>(value: T): T {
  return structuredClone(value);
}

/** Recompute the page's step-status map for a day (the stepper's authoritative source). */
function expectedStepStatus(animal: Idable, day: Idable, animalDays: Idable[]) {
  const merged = mergeDayMetadata(animal as unknown as Animal, day as unknown as Day);
  return computeStepStatus(
    day as unknown as Record<string, unknown>,
    merged,
    animal,
    animalDays as unknown as Day[]
  );
}

// ──────────────────────────────────────────────────────────────────────────────────────────
// Shell / steps / breadcrumb.
// ──────────────────────────────────────────────────────────────────────────────────────────

describe('buildDayEditorViewModel — shell / steps / breadcrumb', () => {
  it('a resolvable day yields an ok shell with the owner key', () => {
    const { animal, day } = loadRealistic();
    const vm = buildDayEditorViewModel(wrap(animal, day), day.id);
    expect(vm.shell.state).toBe('ok');
    expect(vm.shell.ownerKey).toBe(animal.id);
  });

  it('a null/absent day id yields the no-day-id shell, no throw', () => {
    const vm = buildDayEditorViewModel({ animals: {}, days: {} }, null);
    expect(vm.shell.state).toBe('no-day-id');
    expect(vm.export.open).toBe(false);
  });

  it('a day id with no record yields the day-not-found shell', () => {
    const { animal } = loadRealistic();
    const vm = buildDayEditorViewModel({ animals: { [animal.id]: animal }, days: {} }, 'ghost');
    expect(vm.shell.state).toBe('day-not-found');
    expect(vm.shell.message).toContain('ghost');
  });

  it('a day whose owner is unresolvable yields the animal-not-found shell', () => {
    const { day } = loadRealistic();
    // No animals in the workspace → the day's owner cannot be resolved.
    const vm = buildDayEditorViewModel({ animals: {}, days: { [day.id]: day } }, day.id);
    expect(vm.shell.state).toBe('animal-not-found');
  });

  // Owner-resolution parity with DayEditorStepper (the three cases). Both the builder and the stepper
  // now resolve through the shared `resolveDayOwner` selector; these lock the resolved outcome.
  it('a day that declares NO owner resolves to the animal whose index references it (fallback)', () => {
    const { animal, day } = loadRealistic();
    const ownerless = clone(day);
    delete (ownerless as Record<string, unknown>).animalId;
    const vm = buildDayEditorViewModel(wrap(animal, ownerless), day.id);
    expect(vm.shell.state).toBe('ok');
    expect(vm.shell.ownerKey).toBe(animal.id);
  });

  it('a day naming a present-but-absent owner does NOT fall back to the indexing animal', () => {
    const { animal, day } = loadRealistic();
    // The day NAMES a different (absent) owner; even though `animal` indexes it, it must NOT open
    // under `animal` (opening a wrong-owner day would export it as the wrong subject).
    const wrongOwner = clone(day);
    (wrongOwner as Record<string, unknown>).animalId = 'ghost';
    const vm = buildDayEditorViewModel(wrap(animal, wrongOwner), day.id);
    expect(vm.shell.state).toBe('animal-not-found');
  });

  it('reproduces the section stepper order, labels, and per-step domain status', () => {
    const { animal, day } = loadRealistic();
    const vm = buildDayEditorViewModel(wrap(animal, day), day.id);

    expect(vm.steps.map((s) => s.key)).toEqual([
      'overview',
      'devices',
      'epochs',
      'behavioral',
      'validation',
      'export',
    ]);

    const stepStatus = expectedStepStatus(animal, day, [day]);
    for (const step of vm.steps) {
      // The view-model carries the domain StepStatus verbatim (4-state fidelity).
      expect(step.status).toBe(stepStatus[step.key as keyof typeof stepStatus]);
    }
  });

  it('defaults the active step to overview, and steps carry no route (local nav)', () => {
    const { animal, day } = loadRealistic();
    const vm = buildDayEditorViewModel(wrap(animal, day), day.id);
    expect(vm.steps.find((s) => s.active)?.key).toBe('overview');
    // The section nav is button/local-state — there is no `#/day/:id/:step` route, so steps carry no href.
    for (const step of vm.steps) {
      expect(step.href).toBeUndefined();
    }
  });

  it('marks the passed-in active step as active (the editor owns local nav state)', () => {
    const { animal, day } = loadRealistic();
    const vm = buildDayEditorViewModel(wrap(animal, day), day.id, 'devices');
    expect(vm.steps.find((s) => s.active)?.key).toBe('devices');
    expect(vm.steps.filter((s) => s.active)).toHaveLength(1);
  });

  it('the Validation step shows the blocking-issue count when a day needs fixing', () => {
    const { animal, day } = loadRealistic();
    // Break a required day field so the day needs fixing.
    const broken = clone(day);
    (broken.session as Record<string, unknown>).session_description = '';
    const vm = buildDayEditorViewModel(wrap(animal, broken), broken.id);

    const merged = mergeDayMetadata(animal as unknown as Animal, broken as unknown as Day);
    const expectedToFix = validateDay(
      broken as unknown as Record<string, unknown>,
      merged,
      animal,
      [broken] as unknown as Day[]
    ).filter((i) => i.severity === 'error').length;

    const validationStep = vm.steps.find((s) => s.key === 'validation');
    expect(expectedToFix).toBeGreaterThan(0);
    expect(validationStep?.issueCount).toBe(expectedToFix);
  });

  it('reproduces the breadcrumb: Workspace › Animal: X › Day: date', () => {
    const { animal, day } = loadRealistic();
    const vm = buildDayEditorViewModel(wrap(animal, day), day.id);
    expect(vm.breadcrumb.items).toEqual([
      { label: 'Workspace', href: '#/workspace' },
      { label: `Animal: ${animal.id}`, href: `#/animal/${animal.id}/days` },
      { label: `Day: ${day.date}` },
    ]);
  });

  it('overall is ready for a fully-valid day and error for a needs-fixing day', () => {
    const { animal, day } = loadRealistic();
    const readyVm = buildDayEditorViewModel(wrap(animal, day), day.id);
    const stepStatus = expectedStepStatus(animal, day, [day]);
    // Sanity: the realistic fixture is export-ready.
    expect(isExportEnabled(stepStatus)).toBe(true);
    expect(readyVm.overall).toBe('ready');

    const broken = clone(day);
    (broken.session as Record<string, unknown>).session_description = '';
    const brokenVm = buildDayEditorViewModel(wrap(animal, broken), broken.id);
    expect(brokenVm.overall).toBe('error');
  });

  it('a corrupt animal config yields one error issue, no throw, and a merge-error gate', () => {
    const { animal, day } = loadRealistic();
    // Corrupt the config history so mergeDayMetadata throws.
    const corrupt = clone(animal);
    corrupt.configurationHistory = 'corrupt' as unknown as typeof corrupt.configurationHistory;
    const vm = buildDayEditorViewModel(wrap(corrupt, day), day.id);

    // The shell still resolves the day (the owner is resolvable); only the merge failed.
    expect(vm.shell.state).toBe('ok');
    expect(vm.overall).toBe('error');
    expect(vm.export.open).toBe(false);
    expect(vm.export.reason).toBe('merge-error');
    expect(vm.export.blockingIssues.length).toBe(1);
    expect(vm.export.blockingIssues[0].severity).toBe('error');
    // The Validation step shows NO "N to fix" scent on a merge-failed day (matching the stepper,
    // which cannot compute a trustworthy count without a merge) — even though the raw-shape issue is
    // still surfaced in `issues`/`notices`.
    const validationStep = vm.steps.find((s) => s.key === 'validation');
    expect(validationStep?.issueCount).toBeUndefined();
  });
});

// ──────────────────────────────────────────────────────────────────────────────────────────
// Overview field sources (day / inherited / default / derived).
// ──────────────────────────────────────────────────────────────────────────────────────────

describe('buildDayEditorViewModel — overview field sources', () => {
  function fieldsByPath(animal: Idable, day: Idable) {
    const vm = buildDayEditorViewModel(wrap(animal, day), day.id);
    return Object.fromEntries(vm.overview.fields.map((f) => [f.fieldPath, f]));
  }

  it('session_id is derived and read-only, matching the merge value', () => {
    const { animal, day } = loadRealistic();
    const merged = mergeDayMetadata(animal as unknown as Animal, day as unknown as Day);
    const fields = fieldsByPath(animal, day);
    const sid = fields['session.session_id'];
    expect(sid.source).toBe('derived');
    expect(sid.readOnly).toBe(true);
    expect(sid.value).toBe(String(merged.session_id));
  });

  it('a field set on the day reads source "day"', () => {
    const { animal, day } = loadRealistic();
    const fields = fieldsByPath(animal, day);
    // session_description is set on the realistic day.
    expect(fields['session.session_description'].source).toBe('day');
  });

  it('experiment_description set on the day reads "day"; unset-but-on-animal reads "inherited"', () => {
    const { animal, day } = loadRealistic();
    // The realistic day sets experiment_description → 'day'.
    expect(fieldsByPath(animal, day)['session.experiment_description'].source).toBe('day');

    // Clear the day value but keep an animal-level one → inherited from animal.
    const inheritedAnimal = clone(animal);
    inheritedAnimal.experiment_description = 'Animal-wide experiment';
    const inheritedDay = clone(day);
    (inheritedDay.session as Record<string, unknown>).experiment_description = '';
    const f = fieldsByPath(inheritedAnimal, inheritedDay)['session.experiment_description'];
    expect(f.source).toBe('inherited');
    expect(f.inheritedFrom).toBe('animal');

    // The effective value matches the merge (the animal value flows through).
    const merged = mergeDayMetadata(
      inheritedAnimal as unknown as Animal,
      inheritedDay as unknown as Day
    );
    expect(f.value).toBe(String(merged.experiment_description));
  });

  it('weight set on the day reads "day"; unset-but-with-animal-baseline reads "inherited"', () => {
    const { animal, day } = loadRealistic();

    // Day weight set → 'day'.
    const dayWeight = clone(day);
    (dayWeight.session as Record<string, unknown>).weight = 500;
    const setVm = fieldsByPath(animal, dayWeight)['session.weight'];
    expect(setVm.source).toBe('day');
    expect(setVm.value).toBe('500');

    // No day weight, animal baseline present (realistic animal weight is 485) → inherited.
    const f = fieldsByPath(animal, day)['session.weight'];
    expect(f.source).toBe('inherited');
    expect(f.inheritedFrom).toBe('animal');
    expect(f.fallbackValue).toContain('485');
    // The merge exports the effective weight under subject.weight (the animal baseline here).
    const merged = mergeDayMetadata(animal as unknown as Animal, day as unknown as Day);
    expect(f.value).toBe(String((merged.subject as Record<string, unknown>).weight));
  });

  it('a field unset on both day and animal reads "default"', () => {
    const { animal, day } = loadRealistic();
    // Remove the animal baseline weight and the day weight → neither has it → default.
    const noWeightAnimal = clone(animal);
    delete (noWeightAnimal.subject as Record<string, unknown>).weight;
    const noWeightDay = clone(day);
    delete (noWeightDay.session as Record<string, unknown>).weight;
    const f = fieldsByPath(noWeightAnimal, noWeightDay)['session.weight'];
    expect(f.source).toBe('default');
  });

  it('inherited subject identity facts are read-only and inherited from the animal', () => {
    const { animal, day } = loadRealistic();
    const fields = fieldsByPath(animal, day);
    for (const path of ['subject.subject_id', 'subject.sex', 'subject.genotype']) {
      expect(fields[path].source).toBe('inherited');
      expect(fields[path].inheritedFrom).toBe('animal');
      expect(fields[path].readOnly).toBe(true);
    }
    // Values match the animal subject.
    expect(fields['subject.sex'].value).toBe('M');
  });
});

// ──────────────────────────────────────────────────────────────────────────────────────────
// Issues / repair / export gate / notices.
// ──────────────────────────────────────────────────────────────────────────────────────────

describe('buildDayEditorViewModel — issues / repair / export', () => {
  /** A day with a blocking day-surface error (blank required session_description). */
  function brokenDayWorkspace() {
    const { animal, day } = loadRealistic();
    const broken = clone(day);
    (broken.session as Record<string, unknown>).session_description = '';
    return { animal, day: broken };
  }

  it("each issue's ownership / reach / repair matches the domain helpers", () => {
    const { animal, day } = brokenDayWorkspace();
    const vm = buildDayEditorViewModel(wrap(animal, day), day.id);

    const merged = mergeDayMetadata(animal as unknown as Animal, day as unknown as Day);
    const domainIssues = validateDay(
      day as unknown as Record<string, unknown>,
      merged,
      animal,
      [day] as unknown as Day[]
    ).filter((i) => i.severity === 'error' || i.severity === 'warning');

    expect(vm.issues.length).toBe(domainIssues.length);

    // Spot-check each issue's classification against the domain truth.
    domainIssues.forEach((domainIssue, idx) => {
      const issue = vm.issues[idx];
      const ownership = ownershipForIssue(domainIssue);
      const target = repairTargetForIssue(domainIssue);
      expect(issue.ownership).toBe(ownership.pattern);
      expect(issue.reachesBeyondDay).toBe(ownership.reachesBeyondDay);
      // A none-surface issue has no repair; every other surface has a repair action.
      if (target.surface === 'none') {
        expect(issue.repair).toBeUndefined();
      } else {
        expect(issue.repair).toBeDefined();
      }
    });
  });

  it('a day-surface repair is a local navigate-day-section command, not a (non-existent) step route', () => {
    const { animal, day } = brokenDayWorkspace();
    const vm = buildDayEditorViewModel(wrap(animal, day), day.id);
    // The blank session_description is a day-level (day-surface) error; its repair navigates locally
    // to the owning step + focuses the field — there is no `#/day/:id/:step` route to link to.
    const dayRepair = vm.issues.find((i) => i.repair?.command?.id === 'navigateDaySection')?.repair;
    expect(dayRepair).toBeDefined();
    expect(dayRepair?.href).toBeUndefined();
    expect(dayRepair?.command?.target?.dayId).toBe(day.id);
    expect(typeof dayRepair?.command?.target?.section).toBe('string');
  });

  it('export is open and the action enabled for a fully-valid day', () => {
    const { animal, day } = loadRealistic();
    const vm = buildDayEditorViewModel(wrap(animal, day), day.id);
    expect(vm.export.open).toBe(true);
    expect(vm.export.action.disabledReason).toBeUndefined();
    expect(vm.export.action.command?.id).toBe('exportDay');
  });

  it('export blocked by validation errors carries the validation-errors reason + disabled action', () => {
    const { animal, day } = brokenDayWorkspace();
    const vm = buildDayEditorViewModel(wrap(animal, day), day.id);
    expect(vm.export.open).toBe(false);
    expect(vm.export.reason).toBe('validation-errors');
    expect(vm.export.action.disabledReason).toContain('validation');
    expect(vm.export.blockingIssues.length).toBeGreaterThan(0);
  });

  it('export blocked by incomplete steps (no errors) lists blocking steps with owners', () => {
    const { animal, day } = loadRealistic();
    // No electrode groups in the config → Devices step is 'incomplete' (animal-owned),
    // with zero error-severity validation issues.
    const noDevices = clone(animal);
    const snapshot = (noDevices.configurationHistory as Array<{ devices: Record<string, unknown> }>)[0];
    snapshot.devices.electrode_groups = [];
    snapshot.devices.ntrode_electrode_group_channel_map = [];

    const merged = mergeDayMetadata(noDevices as unknown as Animal, day as unknown as Day);
    const stepStatus = computeStepStatus(
      day as unknown as Record<string, unknown>,
      merged,
      noDevices,
      [day] as unknown as Day[]
    );
    const errorCount = validateDay(
      day as unknown as Record<string, unknown>,
      merged,
      noDevices,
      [day] as unknown as Day[]
    ).filter((i) => i.severity === 'error').length;
    // Precondition: no error issues, devices incomplete.
    expect(errorCount).toBe(0);
    expect(stepStatus.devices).toBe('incomplete');

    const vm = buildDayEditorViewModel(wrap(noDevices, day), day.id);
    expect(vm.export.open).toBe(false);
    expect(vm.export.reason).toBe('incomplete-steps');
    expect(vm.export.blockingSteps.length).toBeGreaterThan(0);
    const devicesBlocker = vm.export.blockingSteps.find((s) => s.key === 'devices');
    expect(devicesBlocker?.action?.label).toBe('Fix in Animal Setup');
  });

  it('export blocked because the day is not in the animal index carries the unlinked-day reason', () => {
    const { animal, day } = loadRealistic();
    // Drop the day from the animal's index but keep day.animalId so the owner resolves.
    const unlinked = clone(animal);
    unlinked.days = [];
    const vm = buildDayEditorViewModel(wrap(unlinked, day), day.id);
    expect(vm.export.open).toBe(false);
    expect(vm.export.reason).toBe('unlinked-day');
    expect(vm.export.action.disabledReason).toContain('day list');
  });

  it("each issue carries its ownership action + workflow category (the grouped-list data)", () => {
    const { animal, day } = brokenDayWorkspace();
    const vm = buildDayEditorViewModel(wrap(animal, day), day.id);
    const merged = mergeDayMetadata(animal as unknown as Animal, day as unknown as Day);
    const domainIssues = validateDay(
      day as unknown as Record<string, unknown>,
      merged,
      animal,
      [day] as unknown as Day[]
    ).filter((i) => i.severity === 'error' || i.severity === 'warning');

    domainIssues.forEach((domainIssue, idx) => {
      const issue = vm.issues[idx];
      const category = workflowCategoryForIssue(domainIssue);
      expect(issue.ownershipAction).toBe(ownershipForIssue(domainIssue).primaryAction);
      expect(issue.category).toBe(category);
      expect(issue.categoryLabel).toBe(WORKFLOW_CATEGORY_LABELS[category]);
    });
  });

  it("each issue's repair metadata (surface/kind/focus/dedup) mirrors RepairActionButton + repairButtonKey", () => {
    const { animal, day } = brokenDayWorkspace();
    const vm = buildDayEditorViewModel(wrap(animal, day), day.id);
    const merged = mergeDayMetadata(animal as unknown as Animal, day as unknown as Day);
    const domainIssues = validateDay(
      day as unknown as Record<string, unknown>,
      merged,
      animal,
      [day] as unknown as Day[]
    ).filter((i) => i.severity === 'error' || i.severity === 'warning');

    domainIssues.forEach((domainIssue, idx) => {
      const issue = vm.issues[idx];
      const target = repairTargetForIssue(domainIssue);
      if (target.surface === 'none') {
        expect(issue.repair).toBeUndefined();
        expect(issue.repairKind).toBeUndefined();
        return;
      }
      expect(issue.repairSurface).toBe(target.surface);
      // Executable when the issue carries a repairCommand, else navigate (RepairActionButton precedence).
      expect(issue.repairKind).toBe(domainIssue.repairCommand != null ? 'execute' : 'navigate');
      // The collapse key has the canonical `surface:step:focus:command` shape so the VM-driven repair
      // list dedups several issues sharing one fix into a single button (this is the sole home of the
      // formula now that RepairActions reads `repairDedupKey`).
      const cmd = domainIssue.repairCommand as { type?: unknown; key?: unknown; field?: unknown } | undefined;
      const command = cmd ? `${String(cmd.type ?? '')}:${String(cmd.key ?? cmd.field ?? '')}` : '';
      const expectedKey = `${target.surface}:${target.step ?? ''}:${domainIssue.focusPath || domainIssue.path || ''}:${command}`;
      expect(issue.repairDedupKey).toBe(expectedKey);
      // A navigate repair carries the focus anchor it hands the owning surface.
      if (issue.repairKind === 'navigate') {
        const focus = domainIssue.focusPath || domainIssue.path;
        if (focus != null) expect(issue.repairFocusPath).toBe(focus);
      }
    });
  });

  it('an issue carrying a repairCommand becomes an executable repair (command id = the repair type, no href)', () => {
    const { animal, day } = loadRealistic();
    // An empty configurationHistory makes mergeDayMetadata throw; the builder falls back to merged={}
    // and the raw-animal rebuild issue (carrying a repairCommand) surfaces in the issue list.
    const broken = clone(animal);
    broken.configurationHistory = [];
    const vm = buildDayEditorViewModel(wrap(broken, day), day.id);

    const exec = vm.issues.find((i) => i.repairKind === 'execute');
    expect(exec).toBeDefined();
    expect(exec?.repair?.href).toBeUndefined();
    expect(exec?.repair?.command?.id).toBe('rebuildConfigurationHistory');
  });

  it('an OPEN export gate carries the day lifecycle readiness (live-ready)', () => {
    const { animal, day } = loadRealistic();
    const vm = buildDayEditorViewModel(wrap(animal, day), day.id);
    expect(vm.export.open).toBe(true);
    expect(vm.export.lifecycle).toBe('ready');
    expect(vm.export.lifecycleStatusLabel).toBe('Ready to export');
    expect(vm.export.readyMessage).toBe('Ready to export — all checks pass.');
  });

  it('a saved-validated exportable day reads the validated lifecycle + readiness sentence', () => {
    const { animal, day } = loadRealistic();
    const validated = clone(day);
    validated.state = { validated: true };
    const vm = buildDayEditorViewModel(wrap(animal, validated), validated.id);
    expect(vm.export.open).toBe(true);
    expect(vm.export.lifecycle).toBe('validated');
    expect(vm.export.lifecycleStatusLabel).toBe('Validated');
    expect(vm.export.readyMessage).toBe('Validated — all checks pass. This validation has been saved.');
  });

  it('a downloaded-exported day reads the exported lifecycle + readiness sentence', () => {
    const { animal, day } = loadRealistic();
    const exported = clone(day);
    exported.state = { exported: true };
    const vm = buildDayEditorViewModel(wrap(animal, exported), exported.id);
    expect(vm.export.lifecycle).toBe('exported');
    expect(vm.export.lifecycleStatusLabel).toBe('Exported');
    expect(vm.export.readyMessage).toBe(
      'Exported — all checks still pass. This day’s YAML has been downloaded.'
    );
  });

  it('a BLOCKED export gate carries no lifecycle readiness', () => {
    const { animal, day } = brokenDayWorkspace();
    const vm = buildDayEditorViewModel(wrap(animal, day), day.id);
    expect(vm.export.open).toBe(false);
    expect(vm.export.lifecycle).toBeUndefined();
    expect(vm.export.lifecycleStatusLabel).toBeUndefined();
    expect(vm.export.readyMessage).toBeUndefined();
  });

  it('a malformed day collection becomes a malformed-collection notice with a reset command', () => {
    const { animal, day } = loadRealistic();
    const corruptDay = clone(day);
    corruptDay.tasks = {} as unknown as typeof corruptDay.tasks; // non-array → laundered to []
    const vm = buildDayEditorViewModel(wrap(animal, corruptDay), corruptDay.id);
    const notice = vm.notices.find(
      (n) => n.kind === 'malformed-collection' && n.repair.target?.fieldPath === 'tasks'
    );
    expect(notice).toBeDefined();
    expect(notice?.repair.id).toBe('resetDayCollection');
  });

  it('a stale device override becomes a stale-override notice with a remove command', () => {
    const { animal, day } = loadRealistic();
    const staleDay = clone(day);
    // A bad-channels override keyed by an ntrode id that does not resolve → stale.
    staleDay.deviceOverrides = { bad_channels: { 999: [0] } } as unknown as typeof staleDay.deviceOverrides;
    const vm = buildDayEditorViewModel(wrap(animal, staleDay), staleDay.id);
    const notice = vm.notices.find((n) => n.kind === 'stale-override');
    expect(notice).toBeDefined();
    expect(notice?.repair.id).toBe('removeDeviceOverride');
  });
});

// ──────────────────────────────────────────────────────────────────────────────────────────
// Bad-channel monotonicity / ack.
// ──────────────────────────────────────────────────────────────────────────────────────────

describe('buildDayEditorViewModel — bad channels', () => {
  it('reproduces per-channel marked state from the merged channel map (day-owned overrides)', () => {
    const { animal, day } = loadRealistic();
    // Bad channels are DAY-OWNED: they come from day.deviceOverrides, not the config snapshot.
    // Mark channel 2 of ntrode 3 bad for this day.
    const marked = clone(day);
    marked.deviceOverrides = { bad_channels: { 3: [2] } } as unknown as typeof marked.deviceOverrides;
    const vm = buildDayEditorViewModel(wrap(animal, marked), marked.id);

    const merged = mergeDayMetadata(animal as unknown as Animal, marked as unknown as Day);
    const ntrodeMap = merged.ntrode_electrode_group_channel_map as Array<Record<string, unknown>>;

    // Every channel of every ntrode row is represented.
    const expectedCount = ntrodeMap.reduce(
      (sum, n) => sum + Object.keys(n.map as Record<string, unknown>).length,
      0
    );
    expect(vm.badChannels.marks.length).toBe(expectedCount);

    // The day override marks ntrode 3 channel 2 bad → that mark is set; channel 0 is not.
    const markedThree = vm.badChannels.marks.find((m) => m.ntrodeId === '3' && m.channel === 2);
    expect(markedThree?.marked).toBe(true);
    const unmarkedThree = vm.badChannels.marks.find((m) => m.ntrodeId === '3' && m.channel === 0);
    expect(unmarkedThree?.marked).toBe(false);
    // No prior days → nothing is prior-bad and nothing needs ack.
    expect(vm.badChannels.marks.every((m) => !m.priorBad && !m.requiresAck)).toBe(true);
  });

  /**
   * Build a two-day animal: an earlier day marks ntrode 1 channel 0 bad; the later day un-marks it.
   * Without an ack that later day's removal is an un-acked monotonic regression.
   */
  function twoDayRegressionWorkspace(acked: boolean) {
    const { animal, day } = loadRealistic();
    const earlier = clone(day);
    earlier.id = 'remy-2023-06-21';
    earlier.date = '2023-06-21';
    earlier.deviceOverrides = { bad_channels: { 1: [0] } } as unknown as typeof earlier.deviceOverrides;

    const later = clone(day);
    later.id = 'remy-2023-06-22';
    later.date = '2023-06-22';
    // Later day does NOT mark channel 0 of ntrode 1 bad (a removal of the prior-bad channel).
    later.deviceOverrides = { bad_channels: {} } as unknown as typeof later.deviceOverrides;
    if (acked) {
      later.state = {
        ...(later.state as Record<string, unknown>),
        badChannelRemovalAcks: { 1: [0] },
      } as unknown as typeof later.state;
    }

    const animalWithDays = clone(animal);
    animalWithDays.days = [earlier.id, later.id];

    const ws: Workspace = {
      animals: { [animalWithDays.id]: animalWithDays },
      days: { [earlier.id]: earlier, [later.id]: later },
    };
    return { ws, animal: animalWithDays, earlier, later };
  }

  it('an un-acked monotonic removal yields a blockedRemovals entry with an ack command', () => {
    const { ws, animal, later } = twoDayRegressionWorkspace(false);

    // Precondition: the monotonicity domain sees ntrode 1 channel 0 as prior-bad on the later day.
    const prior = priorBadChannels(
      animal,
      later as unknown as Record<string, unknown>,
      Object.values(ws.days)
    );
    expect(prior['1']).toContain(0);

    const vm = buildDayEditorViewModel(ws, later.id);

    // The channel reads prior-bad, un-marked, and needs an ack.
    const mark = vm.badChannels.marks.find((m) => m.ntrodeId === '1' && m.channel === 0);
    expect(mark?.priorBad).toBe(true);
    expect(mark?.marked).toBe(false);
    expect(mark?.requiresAck).toBe(true);
    expect(mark?.acked).toBe(false);

    // A blocked removal with an acknowledge command is surfaced, and the export is blocked.
    expect(vm.badChannels.blockedRemovals.length).toBeGreaterThan(0);
    const blocker = vm.badChannels.blockedRemovals[0];
    expect(blocker.repair?.command?.id).toBe('acknowledgeBadChannelRemoval');
    expect(blocker.repair?.command?.target?.dayId).toBe(later.id);
    // The descriptor carries the off-export acks the command layer needs to clear the block (the
    // regressing ntrode's prior-bad channels) — so the adapter can reach the executor without
    // re-deriving them. ntrode 1, channel 0 (the prior-bad channel the later day un-marked).
    expect(blocker.repair?.command?.payload?.acks).toEqual({ 1: [0] });

    expect(vm.export.open).toBe(false);
    expect(vm.export.action.disabledReason).toBeDefined();
  });

  it('the consumed vm.issues acknowledge repair is executable and carries its acks', () => {
    // The same `bad_channel_unfailed_without_ack` issue surfaces in vm.issues (the list ValidationStep
    // + ExportStep render). Its executable repair must carry the acks too, or the "Acknowledge
    // un-marking" button would dispatch the executor with no acks and silently no-op.
    const { ws, later } = twoDayRegressionWorkspace(false);
    const vm = buildDayEditorViewModel(ws, later.id);
    const issue = vm.issues.find((i) => i.repair?.command?.id === 'acknowledgeBadChannelRemovals');
    expect(issue).toBeDefined();
    expect(issue?.repairKind).toBe('execute');
    expect(issue?.repair?.command?.payload?.acks).toEqual({ 1: [0] });
  });

  it('running the acknowledge command through the resolver clears the export block (real seam)', () => {
    const { ws, later } = twoDayRegressionWorkspace(false);
    let vm = buildDayEditorViewModel(ws, later.id);
    const descriptor = vm.badChannels.blockedRemovals[0].repair!.command!;

    // Resolve the descriptor through the command layer with a real-ish updateDay that writes the
    // ack into the workspace day (updateDay replaces `state` with the merged value the executor
    // builds — the day starts with no state here, so a shallow apply matches the store action).
    const updateDay = vi.fn((dayId: string, patch: Record<string, unknown>) => {
      ws.days[dayId] = { ...(ws.days[dayId] as Record<string, unknown>), ...patch } as typeof ws.days[string];
    });
    const actions = { updateDay } as unknown as CommandActions;
    const day = ws.days[later.id] as Parameters<typeof commandHandlers>[0]['day'];
    commandHandlers({ actions, dayId: later.id, day })[descriptor.id](descriptor);
    expect(updateDay).toHaveBeenCalledWith(later.id, { state: { badChannelRemovalAcks: { 1: [0] } } });

    // Re-built from the acknowledged workspace, the monotonicity block is gone.
    vm = buildDayEditorViewModel(ws, later.id);
    expect(vm.badChannels.blockedRemovals.length).toBe(0);
    expect(vm.badChannels.marks.find((m) => m.ntrodeId === '1' && m.channel === 0)?.requiresAck).toBe(
      false
    );
  });

  it('an acknowledged removal clears the blocker and marks the channel acked', () => {
    const { ws, later } = twoDayRegressionWorkspace(true);
    const vm = buildDayEditorViewModel(ws, later.id);

    const mark = vm.badChannels.marks.find((m) => m.ntrodeId === '1' && m.channel === 0);
    expect(mark?.priorBad).toBe(true);
    expect(mark?.acked).toBe(true);
    // The ack clears the requires-ack flag and the export blocker.
    expect(mark?.requiresAck).toBe(false);
    expect(vm.badChannels.blockedRemovals.length).toBe(0);
  });

  it("marks a multi-shank first row's PROBE-WIDE channels (not just its own shank's map keys)", () => {
    // A multi-shank group's first ntrode row carries probe-local ids 0..N-1 spanning ALL shanks
    // (the ids trodes_to_nwb honors). A prior-bad channel on a non-first shank (e.g. 42 on a 64c-3s
    // probe, outside the first row's map keys 0..20) must still become a mark with `priorBad` — else
    // the Devices un-mark gate silently misses it. Swap the realistic config to a multi-shank group.
    const MULTI_DEVICE = '64c-3s6mm6cm-20um-40um-sl';
    const { animal, day } = loadRealistic();
    const multiAnimal = clone(animal);
    const snapshot = (multiAnimal.configurationHistory as Array<{ devices: Record<string, unknown> }>)[0];
    snapshot.devices.electrode_groups = [
      { id: 2, location: 'CA1', device_type: MULTI_DEVICE, description: '', targeted_location: 'CA1', targeted_x: 1, targeted_y: 1, targeted_z: 1, units: 'mm' },
    ];
    snapshot.devices.ntrode_electrode_group_channel_map = [
      { ntrode_id: 10, electrode_group_id: 2, bad_channels: [], map: Object.fromEntries(Array.from({ length: 21 }, (_, i) => [i, i])) },
      { ntrode_id: 11, electrode_group_id: 2, bad_channels: [], map: Object.fromEntries(Array.from({ length: 21 }, (_, i) => [i, 21 + i])) },
      { ntrode_id: 12, electrode_group_id: 2, bad_channels: [], map: Object.fromEntries(Array.from({ length: 22 }, (_, i) => [i, 42 + i])) },
    ];

    const earlier = clone(day);
    earlier.id = 'remy-2023-06-21';
    earlier.date = '2023-06-21';
    // Earlier day marks probe-local channel 42 (shank 3) bad — on the FIRST row (id 10), the row the
    // converter honors. 42 is OUTSIDE the first row's map keys (0..20).
    earlier.deviceOverrides = { bad_channels: { 10: [42] } } as unknown as typeof earlier.deviceOverrides;
    const later = clone(day);
    later.id = 'remy-2023-06-22';
    later.date = '2023-06-22';
    later.deviceOverrides = { bad_channels: { 10: [42] } } as unknown as typeof later.deviceOverrides;
    multiAnimal.days = [earlier.id, later.id];

    const ws: Workspace = {
      animals: { [multiAnimal.id]: multiAnimal },
      days: { [earlier.id]: earlier, [later.id]: later },
    };
    const vm = buildDayEditorViewModel(ws, later.id);

    // The mark for probe-wide channel 42 exists (beyond the first row's map keys), is marked bad, and
    // reads prior-bad (it was bad on the earlier same-config day).
    const mark = vm.badChannels.marks.find((m) => m.ntrodeId === '10' && m.channel === 42);
    expect(mark).toBeDefined();
    expect(mark?.marked).toBe(true);
    expect(mark?.priorBad).toBe(true);
  });
});
