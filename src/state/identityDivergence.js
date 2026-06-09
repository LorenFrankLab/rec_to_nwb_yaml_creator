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

/**
 * Compare two dependent-field values for identity purposes. Numbers compare numerically;
 * everything else compares as trimmed strings so `'8mm'` vs `'8mm'` matches and `0.001` vs
 * `0.001` matches, while absent vs present differ.
 *
 * @param {*} a - First value.
 * @param {*} b - Second value.
 * @returns {boolean} True when the two values are equivalent.
 */
export function valuesEqual(a, b) {
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
 * @param {string} name - The candidate identity name (e.g. camera_name).
 * @param {Record<string, *>} candidateFields - The candidate's dependent fields.
 * @param {Array<{name: string, fields: Record<string, *>, label?: string}>} registry -
 *   Existing identities the candidate is checked against.
 * @returns {{existing: object, differingFields: string[]}|null} The conflicting entry and the
 *   dependent fields that differ, or null when the name is unused or its reuse is identical.
 */
export function findIdentityDivergence(name, candidateFields, registry) {
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
