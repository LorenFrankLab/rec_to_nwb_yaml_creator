/**
 * @fileoverview Geometry-override provenance: classify a validation issue's geometry
 * domain and re-tag base errors with day ownership when the day overrides that geometry.
 *
 * The single source for the geometry-domain classification ({@link geometryDomainOf}) shared by
 * the override validator ({@link module:domain/dayOverrideValidation}'s shadowed-override check)
 * and the composer's provenance re-tag ({@link tagBaseOwnershipByProvenance}), so the subtle path
 * matching can't drift between them. Extracted from `domain/validation.js` (Phase 9a) with no
 * behavior change. Pure and dependency-free (type-only import of the shared issue shape).
 */

import type { RepairableIssue } from './repairRouting';

/** Which day-level geometry collections a day overrides (with an array). */
export interface GeometryProvenance {
  /** True iff the day overrides electrode groups. */
  electrode_groups: boolean;
  /** True iff the day overrides the ntrode channel map. */
  ntrode: boolean;
}

/**
 * Classify a validation issue into its GEOMETRY domain — the single source for both the
 * provenance re-tag and the shadowed-override check, so the subtle path matching can't
 * drift between them:
 *   - `'electrode_groups'` — an electrode-group structural error;
 *   - `'ntrode'` — an ntrode channel-map structural error;
 *   - `null` — a bad-channel overlay error (lives on an ntrode path but is a day-owned
 *     overlay, so it must NOT be attributed to a geometry override) or a non-geometry issue.
 *
 * `'electrode_groups'` (with the trailing 's') appears only in electrode-group paths; the
 * ntrode path is `ntrode_electrode_group_channel_map` (singular `electrode_group`).
 *
 * @param issue
 */
export function geometryDomainOf(issue: RepairableIssue): 'electrode_groups' | 'ntrode' | null {
  const path = issue?.path || issue?.instancePath || '';
  const isBadChannel =
    issue?.field === 'bad_channels' ||
    path.includes('bad_channels') ||
    issue?.code === 'bad_channel_out_of_range' ||
    issue?.code === 'multishank_bad_channels_ignored';
  if (isBadChannel) return null;
  if (path.includes('electrode_groups')) return 'electrode_groups';
  if (path.includes('ntrode')) return 'ntrode';
  return null;
}

/**
 * Day-level geometry provenance, derived from the persisted day's overrides ALONE (no
 * animal needed): a collection is day-owned exactly when the day overrides it with an
 * array. `bad_channels` are always a day-editable overlay (their rule already routes to
 * day), so they are not part of geometry provenance.
 *
 * @param day - The persisted day.
 * @returns Whether each is day-overridden.
 */
export function dayGeometryProvenance(day: unknown): GeometryProvenance {
  const ov: unknown =
    day && typeof day === 'object' && !Array.isArray(day)
      ? (day as Record<string, unknown>).deviceOverrides
      : null;
  const rec: Record<string, unknown> =
    ov && typeof ov === 'object' && !Array.isArray(ov) ? (ov as Record<string, unknown>) : {};
  return {
    electrode_groups: Array.isArray(rec.electrode_groups),
    ntrode: Array.isArray(rec.ntrode_electrode_group_channel_map),
  };
}

/**
 * Re-tag base (schema/rule) GEOMETRY errors with explicit day ownership when the day
 * overrides that geometry — the override, not the animal snapshot, owns them, so fixing
 * the snapshot can't clear them. Bad-channel errors are left alone (already day-owned by
 * their rule). Non-overridden domains are untouched (snapshot-owned → animal).
 *
 * @param issues - Base validation issues.
 * @param prov - Geometry provenance.
 * @returns Issues with explicit day `ownerSurface`/`step`/`focusPath` on the
 *   day-overridden geometry errors; the focus anchor points at the override-removal control.
 */
export function tagBaseOwnershipByProvenance(
  issues: RepairableIssue[],
  prov: GeometryProvenance
): RepairableIssue[] {
  if (!prov.electrode_groups && !prov.ntrode) return issues;
  return issues.map((issue) => {
    if (issue?.severity !== 'error') return issue;
    const domain = geometryDomainOf(issue);
    if (domain === 'electrode_groups' && prov.electrode_groups) {
      return { ...issue, ownerSurface: 'day', step: 'devices', focusPath: 'deviceOverrides.electrode_groups' };
    }
    if (domain === 'ntrode' && prov.ntrode) {
      return { ...issue, ownerSurface: 'day', step: 'devices', focusPath: 'deviceOverrides.ntrode_electrode_group_channel_map' };
    }
    return issue;
  });
}
