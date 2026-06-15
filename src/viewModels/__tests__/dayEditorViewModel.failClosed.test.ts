/**
 * Locks `buildDayEditorViewModel`'s "never throws" contract for the one path that isn't reachable
 * with real data: a repair-routing CONTRACT VIOLATION inside `validateDay`/`computeStepStatus` (an
 * un-routed issue code throws in `normalizeIssue`). The builder must catch it and fail CLOSED — a
 * blocked export gate — rather than let the throw white-screen the day editor. We force the throw with
 * a scoped module mock (the only way to reach the path); this asserts the builder's catch, not the mock.
 */
import { describe, it, expect, vi } from 'vitest';

import { buildDayEditorViewModel } from '../dayEditorViewModel';
import { realisticReady } from './fixtures/scenarioWorkspaces';

vi.mock('../../domain/dayValidationComposer', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../domain/dayValidationComposer')>();
  return {
    ...actual,
    // computeStepStatus also calls this (via stepStatus.ts), so both throwing call sites are covered.
    validateDay: () => {
      throw new Error('unrouted issue code (forced in test)');
    },
  };
});

describe('buildDayEditorViewModel — never throws on a validation contract violation', () => {
  it('catches a validateDay/computeStepStatus throw and fails closed instead of propagating', () => {
    const { workspace, dayId } = realisticReady();
    const build = () => buildDayEditorViewModel(workspace, dayId);

    expect(build).not.toThrow();

    const vm = build();
    // The day + animal resolve fine (the merge succeeds); only validation threw.
    expect(vm.shell.state).toBe('ok');
    // Fail closed: export blocked, overall is an error — never a silently-exportable day.
    expect(vm.export.open).toBe(false);
    expect(vm.overall).toBe('error');
  });
});
