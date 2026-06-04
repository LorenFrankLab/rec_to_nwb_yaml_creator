/**
 * Dataset-wide identity-drift detection for Spyglass-keyed device names.
 *
 * Spyglass keys `CameraDevice` on `camera_name` and `DataAcquisitionDevice` on
 * `data_acq_device[].name`; the other fields are dependent metadata. Reusing a name
 * anywhere in the workspace with different dependent values silently reuses the wrong
 * calibration/hardware (or raises a divergence error) downstream. These helpers find
 * that drift so the editing surface can block it and steer the user to a new name.
 *
 * @module pages/AnimalEditor/identitySafety
 */

/**
 * Compare two dependent-field values for identity purposes. Numbers compare
 * numerically; everything else compares as trimmed strings so `'8mm'` vs `'8mm'`
 * matches and `0.001` vs `0.001` matches, while absent vs present differ.
 *
 * @param {*} a - First value.
 * @param {*} b - Second value.
 * @returns {boolean} True when the two values are equivalent.
 */
function valuesEqual(a, b) {
  if (typeof a === 'number' && typeof b === 'number') return a === b;
  return String(a ?? '').trim() === String(b ?? '').trim();
}

/**
 * Find a divergent reuse of `name` in a registry of existing identities.
 *
 * @param {string} name - The candidate identity name (e.g. camera_name).
 * @param {Record<string, *>} candidateFields - The candidate's dependent fields.
 * @param {Array<{name: string, fields: Record<string, *>, label?: string}>} registry -
 *   Existing identities the candidate is checked against. The caller excludes the
 *   entry being edited so it never conflicts with itself.
 * @returns {{existing: object, differingFields: string[]}|null} The conflicting entry
 *   and the dependent fields that differ, or null when the name is unused or its reuse
 *   is identical (a safe reuse).
 */
export function findIdentityDivergence(name, candidateFields, registry) {
  if (!name) return null;
  for (const entry of registry) {
    if (entry.name !== name) continue;
    const differingFields = Object.keys(candidateFields).filter(
      (key) => !valuesEqual(candidateFields[key], entry.fields[key])
    );
    if (differingFields.length > 0) return { existing: entry, differingFields };
  }
  return null;
}

/**
 * Human-readable labels for the dependent fields shown in a divergence comparison,
 * so a scientist sees "Meters per pixel" rather than the raw key `meters_per_pixel`.
 *
 * @type {Record<string, string>}
 */
export const IDENTITY_FIELD_LABELS = {
  id: 'Camera ID',
  meters_per_pixel: 'Meters per pixel',
  lens: 'Lens',
  model: 'Model',
  manufacturer: 'Manufacturer',
  camera_name: 'Camera name',
  system: 'System',
  amplifier: 'Amplifier',
  adc_circuit: 'ADC circuit',
};

/** Dependent fields that define a camera's identity beyond its `camera_name`. */
export const CAMERA_DEPENDENT_FIELDS = ['id', 'meters_per_pixel', 'lens', 'model', 'manufacturer'];

/** Dependent fields that define a data-acq device's identity beyond its `name`. */
export const DATA_ACQ_DEPENDENT_FIELDS = ['system', 'amplifier', 'adc_circuit'];

/**
 * Build the camera-name identity registry from every animal in the workspace,
 * excluding the camera currently being edited (so editing it is not self-divergent).
 *
 * @param {object} workspace - The workspace slice (`{ animals }`).
 * @param {{animalId: string, id: number}|null} [exclude] - The camera being edited.
 * @returns {Array<{name: string, fields: Record<string, *>, label: string}>}
 */
export function collectCameraIdentities(workspace, exclude = null) {
  const registry = [];
  for (const animal of Object.values(workspace?.animals || {})) {
    for (const camera of animal.cameras || []) {
      if (exclude && animal.id === exclude.animalId && camera.id === exclude.id) continue;
      registry.push({
        name: camera.camera_name,
        label: `${animal.id} camera ${camera.id}`,
        fields: {
          id: camera.id,
          meters_per_pixel: camera.meters_per_pixel,
          lens: camera.lens,
          model: camera.model,
          manufacturer: camera.manufacturer,
        },
      });
    }
  }
  return registry;
}

/**
 * Build the data-acq-name identity registry from every animal in the workspace,
 * excluding the animal currently being edited.
 *
 * @param {object} workspace - The workspace slice (`{ animals }`).
 * @param {string|null} [excludeAnimalId] - The animal being edited.
 * @returns {Array<{name: string, fields: Record<string, *>, label: string}>}
 */
export function collectDataAcqIdentities(workspace, excludeAnimalId = null) {
  const registry = [];
  for (const animal of Object.values(workspace?.animals || {})) {
    if (animal.id === excludeAnimalId) continue;
    for (const device of animal.devices?.data_acq_device || []) {
      registry.push({
        name: device.name,
        label: `${animal.id} data-acq device`,
        fields: {
          system: device.system,
          amplifier: device.amplifier,
          adc_circuit: device.adc_circuit,
        },
      });
    }
  }
  return registry;
}
