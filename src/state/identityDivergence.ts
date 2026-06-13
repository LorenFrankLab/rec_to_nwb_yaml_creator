/**
 * @fileoverview The PURE identity-divergence core for Spyglass-keyed device names.
 *
 * Spyglass keys `CameraDevice` on `camera_name` and `DataAcquisitionDevice` on
 * `data_acq_device[].name`; the other fields are dependent metadata. Reusing a name with
 * different dependent values silently reuses the wrong calibration/hardware (or raises a
 * divergence) downstream. {@link findIdentityDivergence} detects that drift.
 *
 * This lives in `state/` (not `pages/`) so BOTH the page-layer editing surface
 * (`pages/AnimalEditor/identitySafety`, which re-exports it) AND state-layer consumers
 * (the YAML import reconciler `state/yamlImportPlan`) can use ONE implementation without
 * crossing the page→state architecture boundary in the wrong direction.
 *
 * @module state/identityDivergence
 */

/** An existing identity the candidate is checked against. */
export interface IdentityRegistryEntry {
  /** The identity name (Spyglass key, e.g. camera_name). */
  name: string;
  /** The entry's dependent fields, compared against the candidate's. */
  fields: Record<string, unknown>;
  /** Optional display label, carried for the UI and never compared. */
  label?: string;
}

/** A detected divergent reuse: the conflicting entry plus the dependent fields that differ. */
export interface IdentityDivergence {
  /** The existing registry entry whose name the candidate reuses with different fields. */
  existing: IdentityRegistryEntry;
  /** The dependent field keys whose values differ. */
  differingFields: string[];
}

/**
 * Compare two dependent-field values for identity purposes. Numbers compare numerically;
 * everything else compares as trimmed strings so `'8mm'` vs `'8mm'` matches and `0.001` vs
 * `0.001` matches, while absent vs present differ.
 *
 * @param a - First value.
 * @param b - Second value.
 * @returns True when the two values are equivalent.
 */
export function valuesEqual(a: unknown, b: unknown): boolean {
  if (typeof a === 'number' && typeof b === 'number') return a === b;
  return String(a ?? '').trim() === String(b ?? '').trim();
}

/**
 * Find a divergent reuse of `name` in a registry of existing identities.
 *
 * Compares ONLY the keys present in `candidateFields` (candidate and registry entries
 * are assumed to share a key set); a registry entry's `label` is carried for display,
 * not compared.
 *
 * @param name - The candidate identity name (e.g. camera_name).
 * @param candidateFields - The candidate's dependent fields.
 * @param registry - Existing identities the candidate is checked against.
 * @returns The conflicting entry and the dependent fields that differ, or null when the name is
 *   unused or its reuse is identical.
 */
export function findIdentityDivergence(
  name: string,
  candidateFields: Record<string, unknown>,
  registry: IdentityRegistryEntry[]
): IdentityDivergence | null {
  const normalizedName = String(name ?? '').trim();
  if (!normalizedName) return null;
  for (const entry of registry) {
    if (String(entry.name ?? '').trim() !== normalizedName) continue;
    const differingFields = Object.keys(candidateFields).filter(
      (key) => !valuesEqual(candidateFields[key], entry.fields[key])
    );
    if (differingFields.length > 0) return { existing: entry, differingFields };
  }
  return null;
}
