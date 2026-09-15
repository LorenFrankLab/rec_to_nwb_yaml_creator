/**
 * @file Tests for the shared day-lifecycle vocabulary.
 *
 * ONE source of truth for the words every surface uses to describe where a recording day is:
 * Draft · Ready to export · Downloaded · Changed since download · Needs attention. The module also
 * resolves a LIVE-valid day's download history (the export receipt's freshness) into the lifecycle
 * variant, so a downloaded day whose export has since changed never keeps reading "Downloaded".
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
      EXPORTED: 'exported',
      CHANGED_SINCE_EXPORT: 'changed_since_export',
    });
  });

  it('is frozen so the canonical vocabulary cannot drift at runtime', () => {
    expect(Object.isFrozen(DAY_LIFECYCLE)).toBe(true);
    expect(Object.isFrozen(DAY_LIFECYCLE_LABEL)).toBe(true);
  });

  it('gives each variant a distinct, plain-language label', () => {
    expect(DAY_LIFECYCLE_LABEL).toEqual({
      needs_fixing: 'Needs attention',
      draft: 'Draft',
      ready: 'Ready to export',
      exported: 'Downloaded',
      changed_since_export: 'Changed since download',
    });
    expect(new Set(Object.values(DAY_LIFECYCLE_LABEL)).size).toBe(Object.keys(DAY_LIFECYCLE_LABEL).length);
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

  it('keeps the parallel label/description/order tables complete for every variant (no silent desync)', () => {
    // The lookup tables are hand-written parallel objects (not derived from the enum), so guard the
    // completeness invariant explicitly: a future variant added to DAY_LIFECYCLE without a label,
    // description, AND order entry must fail here rather than render a blank/styleless status.
    for (const variant of Object.values(DAY_LIFECYCLE)) {
      expect(DAY_LIFECYCLE_LABEL).toHaveProperty(variant);
      expect(DAY_LIFECYCLE_DESCRIPTION).toHaveProperty(variant);
      expect(DAY_LIFECYCLE_ORDER).toContain(variant);
    }
  });
});

describe('lifecycleForValidDay', () => {
  it('reads a live-valid day with no saved flags as "ready" (passing now, not yet saved)', () => {
    expect(lifecycleForValidDay({})).toBe(DAY_LIFECYCLE.READY);
    expect(lifecycleForValidDay({ draft: true, validated: false, exported: false })).toBe(
      DAY_LIFECYCLE.READY
    );
  });

  it('reads a saved-validated day as "ready" (a saved validation is not a separate step)', () => {
    expect(lifecycleForValidDay({ validated: true })).toBe(DAY_LIFECYCLE.READY);
  });

  it('reads a downloaded day as "exported" while its export is current or unverifiable', () => {
    expect(lifecycleForValidDay({ validated: true, exported: true })).toBe(DAY_LIFECYCLE.EXPORTED);
    expect(lifecycleForValidDay({ exported: true }, 'current')).toBe(DAY_LIFECYCLE.EXPORTED);
    expect(lifecycleForValidDay({ exported: true }, 'unverified')).toBe(DAY_LIFECYCLE.EXPORTED);
    expect(lifecycleForValidDay({ exported: true }, 'never')).toBe(DAY_LIFECYCLE.EXPORTED);
  });

  it('reads a downloaded day whose current export differs as "changed_since_export" (F6)', () => {
    expect(lifecycleForValidDay({ exported: true }, 'changed')).toBe(DAY_LIFECYCLE.CHANGED_SINCE_EXPORT);
  });

  it('tolerates a missing or malformed state, reading it as "ready"', () => {
    expect(lifecycleForValidDay(undefined)).toBe(DAY_LIFECYCLE.READY);
    expect(lifecycleForValidDay(null)).toBe(DAY_LIFECYCLE.READY);
    expect(lifecycleForValidDay('corrupt')).toBe(DAY_LIFECYCLE.READY);
    expect(lifecycleForValidDay(['x'])).toBe(DAY_LIFECYCLE.READY);
  });
});
