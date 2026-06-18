/**
 * @fileoverview Electrode-group business rules (extracted from rulesValidation.js, Phase split).
 *
 * Rules over `electrode_groups`: id uniqueness, that every group has its channel-map rows,
 * non-empty/consistent location + targeted_location, a known/registered device_type, and an
 * internally-consistent probe catalog entry. Each maps to a downstream trodes_to_nwb / Spyglass
 * failure (silent group collapse, FileNotFoundError, fragmented BrainRegion rows, invalid channel
 * map). Pure; moved verbatim.
 */

import type { ValidationIssue, ValidationModel } from '../issueTypes';

import { validateDeviceType } from '../../utils/deviceTypeUtils';
import { getProbeShanks, isProbeCatalogConsistent } from '../../ntrode/probeCatalog';

const CANONICAL_LOCATION_NAMES = [
  'hippocampus',
  'dentate gyrus',
  'subiculum',
  'prefrontal cortex',
  'cortex',
  'striatum',
  'thalamus',
  'amygdala',
];
const LOCATION_TYPO_MIN_LENGTH = 5;
const LOCATION_TYPO_MAX_DISTANCE = 2;

function normalizeLocation(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, ' ');
}

function editDistance(a: string, b: string): number {
  const previous = Array.from({ length: b.length + 1 }, (_, index) => index);
  const current = Array.from({ length: b.length + 1 }, () => 0);

  for (let i = 1; i <= a.length; i += 1) {
    current[0] = i;
    for (let j = 1; j <= b.length; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      current[j] = Math.min(
        current[j - 1] + 1,
        previous[j] + 1,
        previous[j - 1] + cost
      );
    }
    previous.splice(0, previous.length, ...current);
  }

  return previous[b.length];
}

function closestLocationTypo(
  location: string,
  candidates: Map<string, string>,
  canonicalLocations: Map<string, string>
): string | null {
  const normalized = normalizeLocation(location);
  if (normalized.length < LOCATION_TYPO_MIN_LENGTH || canonicalLocations.has(normalized)) return null;

  let best: { value: string; distance: number } | null = null;
  for (const [candidateKey, candidateValue] of candidates) {
    if (candidateKey === normalized || candidateKey.length < LOCATION_TYPO_MIN_LENGTH) continue;
    const distance = editDistance(normalized, candidateKey);
    if (distance > LOCATION_TYPO_MAX_DISTANCE) continue;
    if (!best || distance < best.distance) best = { value: candidateValue, distance };
  }

  return best?.value ?? null;
}

/**
 * Rule 6: Electrode-group ids must be unique within a session.
 *
 * @param model - The form data to validate.
 * @returns Validation issues.
 */
export function uniqueElectrodeGroupIds(model: ValidationModel): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  // trodes_to_nwb names the NWB electrode group from this id and Spyglass keys
  // ElectrodeGroup by session + group name, so duplicate ids collapse groups
  // downstream (silent data loss).
  if (Array.isArray(model.electrode_groups) && model.electrode_groups.length > 0) {
    const seen = new Set();
    const reported = new Set();
    model.electrode_groups.forEach((group) => {
      const id = group?.id;
      if (id === undefined || id === null) return;
      if (seen.has(id) && !reported.has(id)) {
        reported.add(id);
        issues.push({
          path: 'electrode_groups',
          code: 'duplicate_electrode_group_id',
          repairSurface: 'animal',
          severity: 'error',
          message:
            `Duplicate electrode group id "${id}". Each electrode group must have a ` +
            `unique id — duplicates collapse groups during NWB conversion and Spyglass ingestion.`,
        });
      }
      seen.add(id);
    });
  }

  return issues;
}

/**
 * Rule 11b: in a PARTIALLY-configured day (the channel map has at least one row), every electrode
 * group must still have its own rows — a group with ZERO rows would otherwise be caught only by
 * step incompleteness.
 *
 * @param model - The form data to validate.
 * @returns Validation issues.
 */
export function missingChannelMapRows(model: ValidationModel): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  // A group with ZERO rows slips past the per-group bounds check (which only sees groups with ≥1
  // row) and would otherwise be caught only by step incompleteness. A FULLY-unconfigured day (no
  // rows at all) stays "incomplete" (step status owns it), not an error.
  if (
    Array.isArray(model.electrode_groups) &&
    model.electrode_groups.length > 0 &&
    Array.isArray(model.ntrode_electrode_group_channel_map) &&
    model.ntrode_electrode_group_channel_map.length > 0
  ) {
    const rowCountByGroup = new Map();
    (Array.isArray(model.ntrode_electrode_group_channel_map)
      ? model.ntrode_electrode_group_channel_map
      : []
    ).forEach((ntrode) => {
      const gid = ntrode?.electrode_group_id;
      if (gid === undefined || gid === null) return;
      rowCountByGroup.set(gid, (rowCountByGroup.get(gid) || 0) + 1);
    });
    model.electrode_groups.forEach((group, gi) => {
      const expectedRows = getProbeShanks(group?.device_type).length;
      if (expectedRows === 0) return; // unknown device → Rule 13 owns it
      const actualRows = rowCountByGroup.get(group?.id) || 0;
      if (actualRows === 0) {
        issues.push({
          path: `electrode_groups[${gi}]`,
          field: 'map',
          step: 'devices',
          actionLabel: 'Add channel map',
          code: 'channel_row_count_mismatch',
          repairSurface: 'animal',
          severity: 'error',
          message:
            `Electrode group ${group?.id ?? gi} ("${group?.device_type}") has no channel-map ` +
            `rows, but the probe has ${expectedRows} shank(s). Add one ntrode row per shank.`,
        });
      }
    });
  }

  return issues;
}

/**
 * Rule 12: non-empty, consistent location / targeted_location.
 *
 * @param model - The form data to validate.
 * @returns Validation issues.
 */
export function electrodeGroupLocations(model: ValidationModel): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  // Spyglass auto-creates BrainRegion rows from electrode_group.location by exact
  // string (no trim/case-fold); targeted_location is schema-required and used by
  // trodes_to_nwb as the per-electrode location. Both must be non-empty; a
  // mixed-case duplicate location fragments regions (warning).
  if (Array.isArray(model.electrode_groups) && model.electrode_groups.length > 0) {
    const nonEmpty = (v: unknown) => typeof v === 'string' && v.trim() !== '';
    model.electrode_groups.forEach((group, gi) => {
      if (!nonEmpty(group?.location)) {
        issues.push({
          path: `electrode_groups[${gi}].location`,
          field: 'location',
          step: 'devices',
          actionLabel: 'Set location',
          code: 'empty_location',
          repairSurface: 'animal',
          severity: 'error',
          message:
            `Electrode group ${group?.id ?? gi} has an empty location. A non-empty brain ` +
            `region is required — Spyglass creates a BrainRegion from this exact string.`,
        });
      }
      if (!nonEmpty(group?.targeted_location)) {
        issues.push({
          path: `electrode_groups[${gi}].targeted_location`,
          field: 'targeted_location',
          step: 'devices',
          actionLabel: 'Set targeted location',
          code: 'empty_targeted_location',
          repairSurface: 'animal',
          severity: 'error',
          message:
            `Electrode group ${group?.id ?? gi} has an empty targeted_location. It is ` +
            `required and used downstream as the per-electrode location.`,
        });
      }
    });

    // Warning: the same location spelled with different case across groups
    // (e.g. "CA1" vs "ca1") fragments Spyglass BrainRegion rows.
    const byLower = new Map();
    model.electrode_groups.forEach((group) => {
      const loc = group?.location;
      if (typeof loc !== 'string' || loc.trim() === '') return;
      const key = loc.trim().toLowerCase();
      if (!byLower.has(key)) byLower.set(key, new Set());
      byLower.get(key).add(loc.trim());
    });
    byLower.forEach((variants) => {
      if (variants.size > 1) {
        issues.push({
          path: 'electrode_groups',
          field: 'location',
          step: 'devices',
          actionLabel: 'Make location capitalization consistent',
          code: 'inconsistent_location_case',
          repairSurface: 'animal',
          severity: 'warning',
          message:
            `Inconsistent capitalization of the same location across electrode groups: ` +
            `${[...variants].map((v) => `"${v}"`).join(', ')}. Use one spelling — Spyglass ` +
            `treats these as different brain regions and fragments queries.`,
        });
      }
    });

    const canonicalLocations = new Map(
      CANONICAL_LOCATION_NAMES.map((location) => [normalizeLocation(location), location])
    );
    const usedLocations = new Map<string, string>();
    model.electrode_groups.forEach((group) => {
      const loc = group?.location;
      if (typeof loc !== 'string' || loc.trim() === '') return;
      const normalized = normalizeLocation(loc);
      if (!usedLocations.has(normalized)) usedLocations.set(normalized, loc.trim());
    });
    const typoCandidates = new Map([...canonicalLocations, ...usedLocations]);
    model.electrode_groups.forEach((group, gi) => {
      const loc = group?.location;
      if (typeof loc !== 'string' || loc.trim() === '') return;
      const suggestion = closestLocationTypo(loc, typoCandidates, canonicalLocations);
      if (!suggestion) return;
      issues.push({
        path: `electrode_groups[${gi}].location`,
        field: 'location',
        step: 'devices',
        actionLabel: 'Review location spelling',
        code: 'location_typo_nudge',
        repairSurface: 'animal',
        severity: 'warning',
        message:
          `Electrode group ${group?.id ?? gi} location "${loc}" looks close to ` +
          `"${suggestion}". Confirm the spelling so Spyglass does not fragment brain regions.`,
      });
    });
  }

  return issues;
}

/**
 * Rule 13: device_type is a known/registered probe.
 *
 * @param model - The form data to validate.
 * @returns Validation issues.
 */
export function knownDeviceTypes(model: ValidationModel): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  // An unknown device_type hard-fails downstream (trodes_to_nwb FileNotFoundError
  // loading the probe metadata). Guards copy/CSV-import-introduced values.
  if (Array.isArray(model.electrode_groups) && model.electrode_groups.length > 0) {
    model.electrode_groups.forEach((group, gi) => {
      const dt = group?.device_type;
      if (dt === undefined || dt === null || dt === '') return; // schema 'required' owns the empty case
      if (!validateDeviceType(dt)) {
        issues.push({
          path: `electrode_groups[${gi}].device_type`,
          field: 'device_type',
          step: 'devices',
          actionLabel: 'Pick a supported probe',
          code: 'unknown_device_type',
          repairSurface: 'animal',
          severity: 'error',
          message:
            `Electrode group ${group?.id ?? gi} uses device_type "${dt}", which is not a ` +
            `supported probe. Conversion fails when the probe metadata can't be found — ` +
            `choose a known device type.`,
        });
      }
    });
  }

  return issues;
}

/**
 * Rule 20 (Probe Metadata Contract): the device_type's catalog entry must be INTERNALLY CONSISTENT
 * (contiguous electrode ids 0..n-1, no gaps/dupes, shank count matches). Entirely-unknown device
 * types are owned by Rule 13.
 *
 * @param model - The form data to validate.
 * @returns Validation issues.
 */
export function consistentProbeCatalog(model: ValidationModel): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  // A known-but-inconsistent catalog entry would generate a converter-invalid channel map, so
  // export is BLOCKED and the probe is NAMED.
  if (Array.isArray(model.electrode_groups) && model.electrode_groups.length > 0) {
    const reportedProbes = new Set();
    model.electrode_groups.forEach((group, gi) => {
      const dt = group?.device_type;
      if (dt === undefined || dt === null || dt === '') return; // schema owns empty
      if (!validateDeviceType(dt)) return; // unknown -> Rule 13 owns it
      if (isProbeCatalogConsistent(dt)) return; // consistent -> nothing to report
      if (reportedProbes.has(dt)) return; // one error per inconsistent probe
      reportedProbes.add(dt);
      issues.push({
        path: `electrode_groups[${gi}].device_type`,
        field: 'device_type',
        step: 'devices',
        actionLabel: 'Pick a supported probe',
        code: 'inconsistent_probe_catalog',
        repairSurface: 'animal',
        severity: 'error',
        message:
          `Electrode group ${group?.id ?? gi} uses device type "${dt}", whose channel geometry is ` +
          `inconsistent and cannot be exported (its channel map would fail conversion). Choose a ` +
          `different, supported probe type. If you believe "${dt}" should be supported, contact your ` +
          `lab's pipeline maintainer.`,
      });
    });
  }

  return issues;
}
