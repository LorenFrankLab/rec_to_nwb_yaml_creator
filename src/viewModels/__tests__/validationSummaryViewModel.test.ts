/**
 * Parity tests for buildValidationSummaryViewModel.
 *
 * The builder must reproduce what the ValidationSummary page renders today. Each per-row assertion
 * independently recomputes the page's display via `dayChipDisplay` (exactly as `DayStatusTable` calls
 * it) and the documented severity invariant, then asserts the view-model reproduces it — so a
 * divergence (wrong flags, wrong mapping, dropped row) fails. Recovery / empty / scoped cases use
 * controlled fixtures with literal expectations.
 */
import { describe, it, expect } from 'vitest';
import { buildValidationSummaryViewModel } from '../validationSummaryViewModel';
import { variantToSeverity } from '../dayRowViewModel';
import { buildRows, dayChipDisplay } from '../validationSummaryRows';
import type { SummaryRow } from '../validationSummaryRows';
import { describeOwner } from '../../domain/dayRecovery';
import { buildCatalogWorkspace, buildRealisticWorkspace } from '../../__tests__/fixtures/workspaceBuilders';

type Workspace = { animals: Record<string, unknown>; days: Record<string, unknown> };
type Idable = { id: string } & Record<string, unknown>;

/** `buildRealisticWorkspace` is untyped JS; narrow its result so `.id`/spreads type-check. */
function loadRealistic(): { animal: Idable; day: Idable } {
  return buildRealisticWorkspace() as { animal: Idable; day: Idable };
}

function wrap(animal: Idable, day: Idable): Workspace {
  return { animals: { [animal.id]: animal }, days: { [day.id]: day } };
}

/** The display the page renders for a row, computed the same way DayStatusTable does. */
function pageDisplay(row: SummaryRow): { variant: string; label: string } {
  const day = row.day as { state?: unknown };
  return dayChipDisplay(row.chip, day?.state, {
    unreadable: row.unreadable,
    missingRecord: row.missingRecord,
    orphaned: row.orphaned,
  });
}

describe('buildValidationSummaryViewModel — parity (all animals)', () => {
  it('reproduces counts + each row status/label/recovery for a realistic workspace', () => {
    const { animal, day } = loadRealistic();
    const workspace = wrap(animal, day);
    const rows = buildRows(workspace);
    const vm = buildValidationSummaryViewModel(workspace);

    const expectedCounts = { valid: 0, error: 0, incomplete: 0 };
    rows.forEach((r) => {
      expectedCounts[r.chip] += 1;
    });
    expect(vm.counts).toEqual(expectedCounts);
    expect(vm.days).toHaveLength(rows.length);

    rows.forEach((r, i) => {
      const display = pageDisplay(r);
      const vmRow = vm.days[i];
      expect(vmRow.statusLabel).toBe(display.label);
      // The chip CSS modifier is the un-collapsed display variant, NOT the lossy severity — the table
      // renders `status-chip--${chipVariant}` directly, so a validated/exported/incomplete day must
      // keep its own chip class.
      expect(vmRow.chipVariant).toBe(display.variant);
      expect(vmRow.status).toBe(variantToSeverity(display.variant));
      expect(vmRow.recovery).toBe(r.status);
    });
  });

  it('marks the realistic valid day ready/eligible with an editor link + scan cells', () => {
    const { animal, day } = loadRealistic();
    const vm = buildValidationSummaryViewModel(wrap(animal, day));
    const row = vm.days[0];

    expect(vm.counts.valid).toBe(1);
    expect(row.status).toBe('ready');
    expect(row.statusLabel).toBe('Ready to export');
    expect(row.lifecycle).toBe('ready');
    expect(row.exportEligibility).toBe('eligible');
    expect(row.recovery).toBe('ok');
    expect(row.recoveryDetail).toBeUndefined();
    expect(row.href).toBe(`#/day/${day.id}`);
    expect(row.subjectLabel).toBe('remy');
    expect(row.sessionId).toBe('remy_20230622');
    expect(row.configVersionLabel).toBe('config v1 (latest)');
    expect(row.cameras).toBe(2);
  });

  it('refines a saved validation as Validated and a download as Exported (status stays ready)', () => {
    const { animal, day } = loadRealistic();
    const validated = { ...day, state: { ...(day.state as Record<string, unknown>), draft: false, validated: true, exported: false } };
    const exported = { ...day, state: { ...(day.state as Record<string, unknown>), draft: false, validated: true, exported: true } };

    const vVm = buildValidationSummaryViewModel(wrap(animal, validated)).days[0];
    expect(vVm.status).toBe('ready');
    expect(vVm.statusLabel).toBe('Validated');
    expect(vVm.lifecycle).toBe('validated');

    const eVm = buildValidationSummaryViewModel(wrap(animal, exported)).days[0];
    expect(eVm.status).toBe('ready');
    expect(eVm.statusLabel).toBe('Exported');
    expect(eVm.lifecycle).toBe('exported');
  });

  it('shows an untouched app-created scaffold as incomplete, not an error', () => {
    const { animal, day } = loadRealistic();
    const deferred = {
      ...day,
      state: { draft: true, validated: false, exported: false, validationDeferred: true },
      tasks: 'not-an-array',
    };

    const vm = buildValidationSummaryViewModel(wrap(animal, deferred));
    const row = vm.days[0];

    expect(vm.counts).toEqual({ valid: 0, error: 0, incomplete: 1 });
    expect(row.statusLabel).toBe('Incomplete');
    expect(row.chipVariant).toBe('incomplete');
  });

  it('shows a newly inserted deferred epoch as incomplete, not an error, until touched', () => {
    const { animal, day } = buildCatalogWorkspace() as {
      animal: Idable;
      day: Idable & { taskInstances: Array<{ task_epochs: number[] }> };
    };
    day.associated_video_files = [
      ...(day.associated_video_files as unknown[]),
      { name: 'sleep_video_epoch1', camera_id: 0, task_epochs: 1 },
      { name: 'sleep_video_epoch3', camera_id: 0, task_epochs: 3 },
      { name: 'sleep_video_epoch5', camera_id: 0, task_epochs: 5 },
    ];
    day.taskInstances = day.taskInstances.map((instance, index) =>
      index === 0 ? { ...instance, task_epochs: [...instance.task_epochs, 9] } : instance
    );
    day.state = { draft: true, validated: false, exported: false, deferredEpochs: [9] };

    const vm = buildValidationSummaryViewModel(wrap(animal, day));
    const row = vm.days[0];

    expect(vm.counts).toEqual({ valid: 0, error: 0, incomplete: 1 });
    expect(row.statusLabel).toBe('Incomplete');
    expect(row.chipVariant).toBe('incomplete');
  });
});

describe('buildValidationSummaryViewModel — severity mapping invariant', () => {
  it('maps every variant onto the contract severity', () => {
    expect(variantToSeverity('ready')).toBe('ready');
    expect(variantToSeverity('validated')).toBe('ready');
    expect(variantToSeverity('exported')).toBe('ready');
    expect(variantToSeverity('error')).toBe('error');
    expect(variantToSeverity('needs_fixing')).toBe('error');
    expect(variantToSeverity('incomplete')).toBe('todo');
    expect(variantToSeverity('draft')).toBe('todo');
    expect(variantToSeverity('something-unexpected')).toBe('todo');
  });
});

describe('buildValidationSummaryViewModel — recovery rows', () => {
  it('dangling reference → error, missing-record label, remove-reference repair, no editor link', () => {
    const ws: Workspace = {
      animals: { remy: { id: 'remy', days: ['ghost'], subject: { subject_id: 'remy' } } },
      days: {},
    };
    const row = buildValidationSummaryViewModel(ws).days[0];
    expect(row.recovery).toBe('dangling_reference');
    expect(row.status).toBe('error');
    expect(row.statusLabel).toBe('Error — missing day record');
    expect(row.chipVariant).toBe('error');
    expect(row.statusTitle).toBe(
      'This day’s saved record is missing or corrupt. Open the editor to repair or recreate it.'
    );
    expect(row.href).toBeUndefined();
    expect(row.recoveryDetail?.repair?.command).toEqual({
      id: 'removeDayReference',
      target: { animalId: 'remy', dayId: 'ghost' },
    });
  });

  it('unreadable day (config could not be merged) → cannot-read chip + repair tooltip', () => {
    // A real record correctly owned + listed (classified `ok`), but its animal has no configuration
    // history, so `mergeDayMetadata` throws — the row is the unreadable error chip, not a normal
    // validation error.
    const ws: Workspace = {
      animals: { remy: { id: 'remy', days: ['d1'], subject: { subject_id: 'remy' } } },
      days: { d1: { id: 'd1', animalId: 'remy', date: '2023-07-01' } },
    };
    const row = buildValidationSummaryViewModel(ws).days[0];
    expect(row.recovery).toBe('ok');
    expect(row.status).toBe('error');
    expect(row.statusLabel).toBe('Error — cannot read');
    expect(row.chipVariant).toBe('error');
    expect(row.statusTitle).toBe(
      'This day could not be read — its device configuration is missing or corrupt. Open the editor to repair it.'
    );
  });

  it('wrong owner → error, belongs-to detail, unlink repair, no editor link', () => {
    const ws: Workspace = {
      animals: { remy: { id: 'remy', days: ['d1'], subject: { subject_id: 'remy' } } },
      days: { d1: { id: 'd1', animalId: 'bean', date: '2023-07-01' } },
    };
    const row = buildValidationSummaryViewModel(ws).days[0];
    expect(row.recovery).toBe('wrong_owner');
    expect(row.status).toBe('error');
    expect(row.href).toBeUndefined();
    expect(row.recoveryDetail?.ownerDescription).toBe(describeOwner('bean'));
    expect(row.recoveryDetail?.message).toBe(`belongs to ${describeOwner('bean')}`);
    expect(row.recoveryDetail?.repair?.command?.id).toBe('unlinkDayReference');
  });

  it('recovered-unlinked valid day → todo, re-link label, blocked eligibility, relink repair + editor link', () => {
    const { animal, day } = loadRealistic();
    const ws: Workspace = {
      animals: { [animal.id]: { ...animal, days: [] } }, // owner present, does not list the day
      days: { [day.id]: day },
    };
    const row = buildValidationSummaryViewModel(ws).days[0];
    expect(row.recovery).toBe('recovered_unlinked');
    expect(row.statusLabel).toBe('Re-link to export');
    expect(row.status).toBe('todo');
    expect(row.exportEligibility).toBe('blocked-needs-relink');
    expect(row.lifecycle).toBeUndefined();
    expect(row.href).toBe(`#/day/${day.id}`);
    expect(row.recoveryDetail?.message).toBe('not in day list');
    expect(row.recoveryDetail?.repair?.command?.id).toBe('relinkDayReference');
  });

  it('surfaces the re-link page note when a recovered day is present', () => {
    const { animal, day } = loadRealistic();
    const ws: Workspace = { animals: { [animal.id]: { ...animal, days: [] } }, days: { [day.id]: day } };
    expect(buildValidationSummaryViewModel(ws).relinkNote?.message).toMatch(/re-link them/i);
  });
});

describe('buildValidationSummaryViewModel — batch action state', () => {
  it('disables Export Valid Only with the page reason when no day is exportable but errors exist', () => {
    const ws: Workspace = {
      animals: { remy: { id: 'remy', days: ['ghost'], subject: { subject_id: 'remy' } } },
      days: {},
    };
    const vm = buildValidationSummaryViewModel(ws);
    expect(vm.counts).toEqual({ valid: 0, error: 1, incomplete: 0 });
    expect(vm.batchExport.exportValid.disabledReason).toBe('No valid days to export — fix errors first.');
    expect(vm.batchExport.exportValid.command).toEqual({ id: 'exportValidOnly' });
    expect(vm.batchExport.validateAll.command).toEqual({ id: 'validateAllDays' });
  });

  it('leaves Export Valid Only enabled when a valid day exists', () => {
    const { animal, day } = loadRealistic();
    const vm = buildValidationSummaryViewModel(wrap(animal, day));
    expect(vm.batchExport.exportValid.disabledReason).toBeUndefined();
    expect(vm.batchExport.preflight).toBeNull();
    expect(vm.reports).toBeNull();
  });
});

describe('buildValidationSummaryViewModel — scope + empty', () => {
  it('scopes to one animal with the scoped subhead', () => {
    const { animal, day } = loadRealistic();
    const vm = buildValidationSummaryViewModel(wrap(animal, day), 'remy');
    expect(vm.scope).toEqual({ animalId: 'remy', subhead: 'Showing: remy — 1 day' });
    expect(vm.days).toHaveLength(1);
  });

  it('reports the global empty state for an empty workspace', () => {
    const vm = buildValidationSummaryViewModel({ animals: {}, days: {} });
    expect(vm.days).toHaveLength(0);
    expect(vm.empty?.message).toBe(
      'No recording days yet. Create an animal and a recording day to see its validation status here.'
    );
  });

  it('reports the scoped empty state for an animal with no days', () => {
    const ws: Workspace = { animals: { remy: { id: 'remy', days: [], subject: { subject_id: 'remy' } } }, days: {} };
    const vm = buildValidationSummaryViewModel(ws, 'remy');
    expect(vm.empty?.message).toBe(
      'This animal has no recording days yet. Add a recording day to see its readiness and export here.'
    );
  });
});
