/**
 * Validation / export-gate integration.
 *
 * Proves the cross-reference/channel rules flow through `validate` → `computeStepStatus(...).export`
 * (the Phase 1 fail-closed gate): an error-severity rule drives `export === 'error'`,
 * while a warning-severity rule (mixed-case location) leaves export reachable.
 */
import { describe, it, expect } from 'vitest';
import { computeStepStatus } from '../../../domain/validation';
import { mergeDayMetadata } from '../../../state/workspaceUtils';
import { buildRealisticWorkspace } from '../../../__tests__/fixtures/workspaceBuilders';

describe('validation rules and the export gate', () => {
  it('a clean configured day exports (baseline)', () => {
    const { animal, day } = buildRealisticWorkspace();
    const merged = mergeDayMetadata(animal, day);
    expect(computeStepStatus(day, merged).export).toBe('valid');
  });

  it('a dangling camera reference blocks export', () => {
    const { animal, day } = buildRealisticWorkspace();
    const merged = mergeDayMetadata(animal, day);
    // Point a task at a camera id no camera defines.
    merged.tasks[0].camera_id = [99];
    expect(computeStepStatus(day, merged).export).toBe('error');
  });

  it('an out-of-range channel value blocks export', () => {
    const { animal, day } = buildRealisticWorkspace();
    const merged = mergeDayMetadata(animal, day);
    merged.ntrode_electrode_group_channel_map[1].map = { 0: 4, 1: 5, 2: 6, 3: 7 };
    expect(computeStepStatus(day, merged).export).toBe('error');
  });

  it('a mixed-case location warning-severity does NOT block export', () => {
    const { animal, day } = buildRealisticWorkspace();
    const merged = mergeDayMetadata(animal, day);
    // Two groups already use 'CA1'; lowercase one of them to trip the
    // region-fragmentation warning without adding any error.
    const firstCA1 = merged.electrode_groups.findIndex((g) => g.location === 'CA1');
    merged.electrode_groups[firstCA1].location = 'ca1';
    expect(computeStepStatus(day, merged).export).toBe('valid');
  });
});
