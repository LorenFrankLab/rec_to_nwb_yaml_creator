/**
 * @file Tests for the shared day-lifecycle vocabulary (Phase 8A-1).
 *
 * ONE source of truth for the words every surface uses to describe where a recording day is in
 * the validate → export lifecycle, so Animal Days, Day Validation, Day Export, and the Validation
 * Summary never describe the same state with contradictory phrases. The module also resolves a
 * LIVE-valid day's persisted history (validated / exported) into the distinct lifecycle variant,
 * so "Validated" (saved) reads differently from "Ready to export" (passing now, not yet saved).
 */

import { describe, it, expect } from 'vitest';
import {
  DAY_LIFECYCLE,
  DAY_LIFECYCLE_LABEL,
  DAY_LIFECYCLE_DESCRIPTION,
  DAY_LIFECYCLE_ORDER,
  lifecycleForValidDay,
} from '../dayLifecycle';

describe('DAY_LIFECYCLE vocabulary', () => {
  it('defines the five lifecycle variants', () => {
    expect(DAY_LIFECYCLE).toEqual({
      NEEDS_FIXING: 'needs_fixing',
      DRAFT: 'draft',
      READY: 'ready',
      VALIDATED: 'validated',
      EXPORTED: 'exported',
    });
  });

  it('is frozen so the canonical vocabulary cannot drift at runtime', () => {
    expect(Object.isFrozen(DAY_LIFECYCLE)).toBe(true);
    expect(Object.isFrozen(DAY_LIFECYCLE_LABEL)).toBe(true);
  });

  it('gives each variant a distinct, plain-language label', () => {
    expect(DAY_LIFECYCLE_LABEL).toEqual({
      needs_fixing: 'Needs fixing',
      draft: 'Draft',
      ready: 'Ready to export',
      validated: 'Validated',
      exported: 'Exported',
    });
    // The persisted-validated label must NOT collide with the live readiness label — that
    // collision (both "Ready to export") is exactly what this phase removes.
    expect(DAY_LIFECYCLE_LABEL.validated).not.toBe(DAY_LIFECYCLE_LABEL.ready);
  });

  it('provides a one-line description for every variant', () => {
    for (const variant of Object.values(DAY_LIFECYCLE)) {
      expect(typeof DAY_LIFECYCLE_DESCRIPTION[variant]).toBe('string');
      expect(DAY_LIFECYCLE_DESCRIPTION[variant].length).toBeGreaterThan(0);
    }
  });

  it('orders the legend as a lifecycle progression covering every variant exactly once', () => {
    expect([...DAY_LIFECYCLE_ORDER].sort()).toEqual([...Object.values(DAY_LIFECYCLE)].sort());
    expect(DAY_LIFECYCLE_ORDER[0]).toBe(DAY_LIFECYCLE.DRAFT);
  });
});

describe('lifecycleForValidDay', () => {
  it('reads a live-valid day with no saved flags as "ready" (passing now, not yet saved)', () => {
    expect(lifecycleForValidDay({})).toBe(DAY_LIFECYCLE.READY);
    expect(lifecycleForValidDay({ draft: true, validated: false, exported: false })).toBe(
      DAY_LIFECYCLE.READY
    );
  });

  it('reads a persisted-validated day as "validated"', () => {
    expect(lifecycleForValidDay({ validated: true })).toBe(DAY_LIFECYCLE.VALIDATED);
  });

  it('reads an exported day as "exported" (export history wins over validated)', () => {
    expect(lifecycleForValidDay({ validated: true, exported: true })).toBe(DAY_LIFECYCLE.EXPORTED);
  });

  it('tolerates a missing or malformed state, reading it as "ready"', () => {
    expect(lifecycleForValidDay(undefined)).toBe(DAY_LIFECYCLE.READY);
    expect(lifecycleForValidDay(null)).toBe(DAY_LIFECYCLE.READY);
    expect(lifecycleForValidDay('corrupt')).toBe(DAY_LIFECYCLE.READY);
    expect(lifecycleForValidDay(['x'])).toBe(DAY_LIFECYCLE.READY);
  });
});
