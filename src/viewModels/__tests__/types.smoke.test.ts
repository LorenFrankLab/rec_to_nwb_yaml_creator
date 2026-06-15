/**
 * Smoke test for the shared view-model vocabulary.
 *
 * Two jobs: (1) construct a realistic instance of every exported type (and the additive fields on
 * the core types) and assert the values round-trip, and (2) pin the types with `@ts-expect-error`
 * guards so an accidental widening to `any`/`string` would fail `npm run typecheck` (the build
 * strips types, so these guards are enforced by the typecheck CI job, not at runtime).
 */
import { describe, it, expect } from 'vitest';
import type {
  WorkflowSeverity,
  WorkflowAction,
  WorkflowCommand,
  IssueViewModel,
  SectionViewModel,
  DayRowViewModel,
  DayRecoveryViewModel,
  DayPreflightViewModel,
  BatchRunReportViewModel,
  BatchRunResultViewModel,
  StepViewModel,
  FieldValueViewModel,
  ExportGateViewModel,
  BadChannelMarkViewModel,
  BreadcrumbViewModel,
  DayEditorShellViewModel,
  RecoveryNoticeViewModel,
} from '../index';

describe('view-model vocabulary — core types', () => {
  it('constructs a WorkflowCommand with target, payload, and confirmCaveat', () => {
    const command: WorkflowCommand = {
      id: 'deleteDay',
      target: { animalId: 'remy', dayId: 'remy-2023-06-22', section: 'electrode-groups', fieldPath: 'session.weight' },
      payload: { date: '2023-06-23' },
      confirmCaveat: 'Already-downloaded files are not deleted.',
    };
    expect(command.id).toBe('deleteDay');
    expect(command.target?.dayId).toBe('remy-2023-06-22');
    expect(command.payload?.date).toBe('2023-06-23');
    expect(command.confirmCaveat).toMatch(/not deleted/);
  });

  it('constructs a disabled WorkflowAction with intent + command', () => {
    const action: WorkflowAction = {
      label: 'Export Valid Only',
      command: { id: 'exportValidOnly' },
      disabledReason: 'No valid days to export — fix errors first.',
    };
    const setupAction: WorkflowAction = { label: 'Set up', href: '#/animal/remy/electrode-groups', intent: 'setup' };
    expect(action.disabledReason).toMatch(/fix errors/);
    expect(setupAction.intent).toBe('setup');
  });

  it('constructs an IssueViewModel with a repair action', () => {
    const issue: IssueViewModel = {
      severity: 'error',
      message: 'Targeted x is required',
      fieldPath: 'electrode_groups[0].targeted_x',
      ownership: 'animal-shared',
      reachesBeyondDay: true,
      repair: { label: 'Fix in Electrode Groups', href: '#/animal/remy/electrode-groups?field=electrode_groups[0].targeted_x' },
    };
    expect(issue.reachesBeyondDay).toBe(true);
    expect(issue.repair?.href).toContain('field=');
  });

  it('constructs a SectionViewModel with countLabel + showCount', () => {
    const section: SectionViewModel = {
      key: 'optogenetics',
      label: 'Optogenetics',
      status: 'ready',
      summary: 'Used — 1 source',
      issueCount: 0,
      countLabel: 'used',
      showCount: true,
      action: { label: 'Review', href: '#/animal/remy/optogenetics', intent: 'review' },
    };
    const severities: WorkflowSeverity[] = ['ready', 'todo', 'warning', 'error'];
    expect(severities).toContain(section.status);
    expect(section.countLabel).toBe('used');
  });

  it('constructs a DayRowViewModel with lifecycle, exportEligibility, recoveryDetail', () => {
    const recoveryDetail: DayRecoveryViewModel = {
      status: 'wrong_owner',
      ownerDescription: 'Belongs to bean',
      message: 'This day belongs to another animal.',
      repair: { label: 'Re-link', command: { id: 'unlinkDay', target: { animalId: 'remy', dayId: 'x' } } },
    };
    const row: DayRowViewModel = {
      dayId: 'remy-2023-06-22',
      date: '2023-06-22',
      href: '#/day/remy-2023-06-22',
      status: 'ready',
      statusLabel: 'Validated',
      chipVariant: 'validated',
      lifecycle: 'validated',
      exportEligibility: 'eligible',
      recovery: 'ok',
      actions: [{ label: 'Duplicate', command: { id: 'duplicateDay', target: { dayId: 'remy-2023-06-22' } } }],
    };
    const orphan: DayRowViewModel = {
      dayId: 'x', date: '2023-06-23', status: 'todo', statusLabel: 'Re-link to export', chipVariant: 'draft',
      exportEligibility: 'blocked-needs-relink', recovery: 'recovered_unlinked', recoveryDetail, actions: [],
    };
    expect(row.lifecycle).toBe('validated');
    expect(orphan.exportEligibility).toBe('blocked-needs-relink');
    expect(orphan.recoveryDetail?.ownerDescription).toBe('Belongs to bean');
  });
});

describe('view-model vocabulary — composite/leaf types', () => {
  it('constructs a DayPreflightViewModel and a BatchRunResultViewModel', () => {
    const preflight: DayPreflightViewModel = {
      dayId: 'remy-2023-06-22', label: 'remy · 2023-06-22', configLabel: 'config v2 (latest)',
      groups: 4, failedChannels: 2, cameras: 1, opto: 'Not used', warnings: [],
    };
    const result: BatchRunResultViewModel = {
      message: 'Exported 3 files. 1 day not exported.',
      reports: [{ kind: 'skipped', items: [{ dayId: 'x', subjectId: 'remy', date: '2023-06-23', detail: 'unlinked' }] }],
    };
    expect(preflight.groups).toBe(4);
    expect(result.reports[0].items[0].subjectId).toBe('remy');
  });

  it('constructs a StepViewModel and a FieldValueViewModel', () => {
    const step: StepViewModel = {
      // 'incomplete' is a StepStatus, not a WorkflowSeverity — exercises the domain-typed step status.
      key: 'overview', label: 'Overview', status: 'incomplete', statusLabel: 'Incomplete',
      issueCount: 2, active: true, href: '#/day/remy-2023-06-22/overview',
    };
    const field: FieldValueViewModel = {
      fieldPath: 'session.weight', label: 'Weight', value: '450',
      source: 'inherited', inheritedFrom: 'animal', fallbackValue: '450', helpText: 'Animal baseline.', readOnly: false,
    };
    expect(step.active).toBe(true);
    expect(field.source).toBe('inherited');
  });

  it('constructs an ExportGateViewModel and a BadChannelMarkViewModel', () => {
    const gate: ExportGateViewModel = {
      open: false, reason: 'validation-errors', blockingIssues: [], blockingSteps: [],
      message: 'Fix 2 validation errors to export.',
      action: { label: 'Export', command: { id: 'exportDay' }, disabledReason: 'Fix 2 validation errors to export.' },
    };
    const mark: BadChannelMarkViewModel = {
      ntrodeId: '1', channel: 3, marked: false, priorBad: true, requiresAck: true, acked: false,
    };
    expect(gate.reason).toBe('validation-errors');
    expect(mark.requiresAck).toBe(true);
  });

  it('constructs a Breadcrumb, shell, and recovery notice', () => {
    const crumb: BreadcrumbViewModel = {
      items: [{ label: 'Workspace', href: '#/' }, { label: 'remy', href: '#/animal/remy/days' }, { label: '2023-06-22' }],
    };
    const shell: DayEditorShellViewModel = { state: 'day-not-found', message: 'No such day.', ownerKey: 'remy' };
    const notice: RecoveryNoticeViewModel = {
      kind: 'malformed-collection', message: 'Tasks could not be read; reset to empty?',
      repair: { id: 'resetDayCollection', target: { dayId: 'x' }, payload: { collection: 'tasks' } },
    };
    expect(crumb.items).toHaveLength(3);
    expect(shell.state).toBe('day-not-found');
    expect(notice.repair.id).toBe('resetDayCollection');
  });
});

describe('view-model vocabulary — type guards', () => {
  it('rejects out-of-vocabulary values at type-check time', () => {
    // @ts-expect-error 'nope' is not a WorkflowSeverity — proves the union is not `string`/`any`.
    const badSeverity: WorkflowSeverity = 'nope';
    // @ts-expect-error label is required — proves WorkflowAction is not `any`.
    const badAction: WorkflowAction = { href: '#/x' };
    // @ts-expect-error ownership + reachesBeyondDay are required — proves IssueViewModel is not `any`.
    const badIssue: IssueViewModel = { severity: 'warning', message: 'x' };
    // @ts-expect-error 'maybe' is not a FieldValueViewModel source — proves the union holds.
    const badField: FieldValueViewModel = { fieldPath: 'x', label: 'X', value: '1', source: 'maybe' };
    // @ts-expect-error 'broken' is not an ExportGateViewModel reason — proves the union holds.
    const badGate: ExportGateViewModel = { open: false, reason: 'broken', blockingIssues: [], blockingSteps: [], message: 'x', action: { label: 'X' } };
    // @ts-expect-error 'ready' is a WorkflowSeverity but not a StepStatus — proves StepViewModel.status is StepStatus.
    const badStep: StepViewModel = { key: 'x', label: 'X', status: 'ready', statusLabel: 'X', active: false };
    // @ts-expect-error 'bogus' is not a DayStatus — proves DayRowViewModel.recovery is the frozen union.
    const badRecovery: DayRowViewModel = { dayId: 'x', date: 'd', status: 'ready', statusLabel: 'L', recovery: 'bogus', actions: [] };
    // @ts-expect-error 'unknown' is not a BatchRunReportViewModel kind — proves the union holds.
    const badReport: BatchRunReportViewModel = { kind: 'unknown', items: [] };
    // @ts-expect-error a numeric ntrodeId is rejected — proves BadChannelMarkViewModel.ntrodeId is a string.
    const badMark: BadChannelMarkViewModel = { ntrodeId: 1, channel: 0, marked: false, priorBad: false, requiresAck: false, acked: false };
    // @ts-expect-error 'other' is not a RecoveryNoticeViewModel kind — proves the union holds.
    const badNotice: RecoveryNoticeViewModel = { kind: 'other', message: 'x', repair: { id: 'r' } };
    expect([badSeverity, badAction, badIssue, badField, badGate, badStep, badRecovery, badReport, badMark, badNotice]).toHaveLength(10);
  });
});
