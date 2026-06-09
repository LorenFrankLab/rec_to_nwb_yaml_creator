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

import { getAnimalCameras, getDataAcqDevices } from '../../state/workspaceSelectors';

// The pure identity-divergence core lives in `state/` so both this page-layer editing surface
// and state-layer consumers (the YAML import reconciler) share ONE implementation without a
// reversed page→state import. Re-exported here so existing importers of this module are unchanged.
export { findIdentityDivergence } from '../../state/identityDivergence';

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

/**
 * Dependent fields that define a camera's identity beyond its `camera_name`, keyed by `id` for the
 * Spyglass divergent-reuse registry (same name + different dependents = a divergence).
 *
 * NOTE: distinct from {@link CAMERA_IDENTITY_FIELDS} (below) on purpose — that one INCLUDES
 * `camera_name` and EXCLUDES `id` because it answers a different question (does an in-place edit make
 * this a new identity?). Don't "harmonize" the two: dropping `id` here would break the divergence
 * registry; adding `id` there would break the immutable-once-referenced gate.
 */
export const CAMERA_DEPENDENT_FIELDS = ['id', 'meters_per_pixel', 'lens', 'model', 'manufacturer'];

/**
 * The fields whose change makes a camera a DIFFERENT identity (name + calibration/hardware). The
 * `id` is excluded because it is the immutable catalog key, rendered read-only in the camera modal
 * (`CameraModal`) — it cannot change on an in-place edit, so it never needs identity-change
 * detection (there is no separate handling because none is reachable). Used by the immutable-once-referenced rule
 * (Phase 8.7 Task 5b): changing any of these on a camera that recording days already reference is a
 * NEW camera by default, not a silent retroactive edit of those days' exports.
 *
 * NOTE: distinct from {@link CAMERA_DEPENDENT_FIELDS} (above) — see the note there.
 *
 * @type {ReadonlyArray<string>}
 */
export const CAMERA_IDENTITY_FIELDS = ['camera_name', 'meters_per_pixel', 'lens', 'model', 'manufacturer'];

/**
 * Whether an edited camera differs from the original in any identity field (treating
 * null/undefined/'' as equivalent so "absent" vs "blank" is not a spurious change).
 *
 * @param {object} original - The saved camera.
 * @param {object} edited - The edited camera data.
 * @returns {boolean}
 */
export function cameraIdentityChanged(original, edited) {
  const norm = (v) => (v === null || v === undefined ? '' : v);
  return CAMERA_IDENTITY_FIELDS.some((field) => norm(original?.[field]) !== norm(edited?.[field]));
}

/** Dependent fields that define a data-acq device's identity beyond its `name`. */
export const DATA_ACQ_DEPENDENT_FIELDS = ['system', 'amplifier', 'adc_circuit'];

/**
 * Build the camera-name identity registry from every animal in the workspace,
 * excluding the camera currently being edited when requested.
 *
 * @param {object} workspace - The workspace slice (`{ animals }`).
 * @param {{animalId: string, id?: number}|null} [exclude] - The camera (or whole animal) being
 *   edited. With `id`, only that one camera is excluded; with `animalId` alone (`id` omitted), the
 *   animal's ENTIRE camera catalog is excluded — mirroring {@link collectDataAcqIdentities}, so a
 *   caller comparing a whole copied catalog against the rest of the workspace isn't tripped by the
 *   target's own cameras.
 * @returns {Array<{name: string, fields: Record<string, *>, label: string}>}
 */
export function collectCameraIdentities(workspace, exclude = null) {
  const registry = [];
  for (const animal of Object.values(workspace?.animals || {})) {
    for (const camera of getAnimalCameras(animal)) {
      if (exclude && animal.id === exclude.animalId && (exclude.id == null || camera.id === exclude.id)) continue;
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
 * excluding either an animal or one selected item when requested.
 *
 * @param {object} workspace - The workspace slice (`{ animals }`).
 * @param {string|{animalId: string, index?: number}|null} [exclude] - The animal or item being edited.
 * @returns {Array<{name: string, fields: Record<string, *>, label: string}>}
 */
export function collectDataAcqIdentities(workspace, exclude = null) {
  const excludeAnimalId = typeof exclude === 'string' ? exclude : exclude?.animalId;
  const excludeIndex = exclude && typeof exclude === 'object' ? exclude.index : null;
  const registry = [];
  for (const animal of Object.values(workspace?.animals || {})) {
    // Read through the canonical selector: a corrupt non-array data_acq_device (`|| []`
    // preserves a string/object and throws on `.entries()`) is treated as no devices.
    for (const [index, device] of getDataAcqDevices(animal).entries()) {
      if (animal.id === excludeAnimalId && (excludeIndex == null || index === excludeIndex)) continue;
      registry.push({
        name: device.name,
        label: `${animal.id} data-acq device${index > 0 ? ` ${index + 1}` : ''}`,
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
