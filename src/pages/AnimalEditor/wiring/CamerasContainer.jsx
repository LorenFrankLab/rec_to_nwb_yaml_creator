/**
 * CamerasContainer — the camera catalog section + its identity-safety wiring.
 *
 * Owns camera add/edit/delete: opens {@link CameraModal}, enforces the dataset-wide Spyglass
 * `camera_name` identity (a divergent reuse is blocked with a side-by-side comparison), applies
 * the immutable-once-referenced rule (editing the identity of a camera that recording days
 * reference surfaces a NEW-vs-CORRECT decision instead of silently rewriting those days' exports),
 * and persists via the `onFieldUpdate('cameras', …)` contract. Hosted by the tabbed Animal View's
 * cameras tab. (Originally extracted from the legacy stepper's HardwareConfigStep for a shared
 * implementation; the stepper was removed in Phase 5.)
 */
import React, { useState, useMemo, useEffect } from 'react';
import PropTypes from 'prop-types';
import { useStoreContext } from '../../../state/StoreContext';
import { getAnimalCameras, getAnimalDayIds } from '../../../state/workspaceSelectors';
import { findCameraAffectedDays } from '../../../state/cameraUsage';
import { ConfirmDialog } from '../../../components/Modal';
import { rawArray } from '../../../components/rawPropTypes';
import CamerasSection from '../CamerasSection';
import CameraModal from '../CameraModal';
import CameraReferenceDialog from '../CameraReferenceDialog';
import {
  collectCameraIdentities,
  findIdentityDivergence,
  cameraIdentityChanged,
  CAMERA_DEPENDENT_FIELDS,
} from '../identitySafety';

/**
 * @param {object} props
 * @param {object} props.animal - Animal record.
 * @param {Function} props.onFieldUpdate - Field-update callback (writes `cameras`).
 * @param {Function} [props.onPendingEditsChange] - Called with `true` while the add/edit
 *   CameraModal is open (an in-progress edit the user could lose) and `false` otherwise / on
 *   unmount. The tabbed AnimalView consults this to guard a section-nav switch (charter
 *   decision 2); the temporary stepper omits it (no nav under it), so its path is byte-unchanged.
 * @returns {JSX.Element}
 */
export default function CamerasContainer({ animal, onFieldUpdate, onPendingEditsChange }) {
  const { model } = useStoreContext();

  const [cameraModal, setCameraModal] = useState({ open: false, mode: 'add', camera: null });
  const [cameraDivergence, setCameraDivergence] = useState(null);
  // Phase 8.7 Task 5b: pending decision when editing a camera that recording days reference.
  const [cameraRefDecision, setCameraRefDecision] = useState(null);
  const [pendingDelete, setPendingDelete] = useState(null);

  // Report "has pending edits" (the add/edit CameraModal being open) to a host that guards
  // navigation. Cleanup resets to false on unmount so a host doesn't hold a stale `true`.
  useEffect(() => {
    onPendingEditsChange?.(cameraModal.open);
    return () => onPendingEditsChange?.(false);
  }, [cameraModal.open, onPendingEditsChange]);

  // A repair routed here must not dead-end by crashing on the corruption it exists to fix. Read
  // cameras through the canonical selector: a non-array `cameras` renders safely.
  const cameras = useMemo(() => getAnimalCameras(animal), [animal]);

  // This animal's recording-day records (for the camera blast-radius: which days reference a camera
  // being edited). `hasUnresolvableDays` flags an index entry we could NOT load — we can't read its
  // camera references, so we must not silently take the "no day references this camera" fast-path.
  const { animalDays, hasUnresolvableDays } = useMemo(() => {
    const ids = getAnimalDayIds(animal);
    const resolved = ids.map((id) => model.workspace?.days?.[id]).filter(Boolean);
    return { animalDays: resolved, hasUnresolvableDays: resolved.length < ids.length };
  }, [animal, model.workspace]);

  const openAddCamera = () => {
    setCameraDivergence(null);
    setCameraModal({ open: true, mode: 'add', camera: null });
  };

  const openEditCamera = (cameraId) => {
    const camera = cameras.find((c) => c.id === cameraId);
    if (!camera) return;
    setCameraDivergence(null);
    setCameraModal({ open: true, mode: 'edit', camera });
  };

  const closeCameraModal = () => {
    setCameraDivergence(null);
    setCameraModal({ open: false, mode: 'add', camera: null });
  };

  /**
   * Persist a camera unless its name diverges from an existing camera identity in the dataset, in
   * which case surface the comparison and keep the modal open.
   *
   * @param {object} cameraData - Cleaned camera object from the modal.
   */
  const handleSaveCamera = (cameraData) => {
    const exclude =
      cameraModal.mode === 'edit' && cameraModal.camera
        ? { animalId: animal.id, id: cameraModal.camera.id }
        : null;
    const registry = collectCameraIdentities(model.workspace, exclude);
    const candidate = Object.fromEntries(CAMERA_DEPENDENT_FIELDS.map((f) => [f, cameraData[f]]));
    const currentIdentity =
      cameraModal.mode === 'edit' && cameraModal.camera
        ? [{
            name: cameraModal.camera.camera_name,
            label: `${animal.id} camera ${cameraModal.camera.id} saved identity`,
            fields: Object.fromEntries(CAMERA_DEPENDENT_FIELDS.map((f) => [f, cameraModal.camera[f]])),
          }]
        : [];
    const selfConflict = findIdentityDivergence(cameraData.camera_name, candidate, currentIdentity);
    const conflict = selfConflict || findIdentityDivergence(cameraData.camera_name, candidate, registry);
    if (conflict) {
      setCameraDivergence(conflict);
      return; // Block: a divergent reuse must get a new name.
    }

    // Phase 8.7 Task 5b (immutable-once-referenced): editing the identity of a camera that
    // recording days already reference would silently rewrite those days' exports. Intercept and
    // let the user choose: a NEW camera (keeps those days unchanged) or an explicit correction that
    // updates the named days.
    if (cameraModal.mode === 'edit' && cameraModal.camera) {
      const original = cameraModal.camera;
      const affectedIds = findCameraAffectedDays(animalDays, original.id);
      // Conservative: if any day record couldn't be resolved, we can't rule out that it references
      // this camera, so don't take the silent fast-path — let the user decide (new vs correct).
      if ((affectedIds.length > 0 || hasUnresolvableDays) && cameraIdentityChanged(original, cameraData)) {
        const affectedDays = affectedIds.map((id) => ({
          id,
          date: animalDays.find((d) => d.id === id)?.date,
        }));
        setCameraRefDecision({ camera: cameraData, original, affectedDays, hasUnresolvableDays });
        // Close the edit modal so ONLY the decision dialog is active — never two stacked
        // aria-modal dialogs (a11y) — and so the decision's Cancel/Escape both abort cleanly.
        closeCameraModal();
        return; // Defer the write until the user decides.
      }
    }

    const next =
      cameraModal.mode === 'edit' && cameraModal.camera
        ? cameras.map((c) => (c.id === cameraModal.camera.id ? cameraData : c))
        : [...cameras, cameraData];
    onFieldUpdate('cameras', next);
    closeCameraModal();
  };

  /** Next free numeric camera id (max existing + 1). */
  const nextCameraId = () =>
    cameras.reduce((max, c) => Math.max(max, typeof c.id === 'number' ? c.id : -1), -1) + 1;

  /**
   * Decision: keep the affected days unchanged — the edited values become a NEW camera, the
   * original is left as-is (immutable-once-referenced default).
   */
  const handleCreateNewCamera = () => {
    if (!cameraRefDecision) return;
    onFieldUpdate('cameras', [...cameras, { ...cameraRefDecision.camera, id: nextCameraId() }]);
    setCameraRefDecision(null);
    closeCameraModal();
  };

  /** Decision: overwrite the camera in place — explicitly updating the affected days. */
  const handleCorrectCamera = () => {
    if (!cameraRefDecision) return;
    const { original, camera: edited } = cameraRefDecision;
    onFieldUpdate('cameras', cameras.map((c) => (c.id === original.id ? edited : c)));
    setCameraRefDecision(null);
    closeCameraModal();
  };

  const confirmDeleteCamera = () => {
    if (pendingDelete == null) return;
    onFieldUpdate('cameras', cameras.filter((c) => c.id !== pendingDelete.id));
    setPendingDelete(null);
  };

  return (
    <>
      <CamerasSection
        animal={animal}
        onFieldUpdate={onFieldUpdate}
        onAdd={openAddCamera}
        onEdit={openEditCamera}
        onDelete={(camera) => setPendingDelete(camera)}
      />

      {cameraModal.open && (
        <CameraModal
          isOpen={cameraModal.open}
          mode={cameraModal.mode}
          camera={cameraModal.camera}
          existingCameras={cameras}
          onSave={handleSaveCamera}
          onCancel={closeCameraModal}
          divergence={cameraDivergence}
          onUseNewName={() => setCameraDivergence(null)}
        />
      )}

      <CameraReferenceDialog
        isOpen={cameraRefDecision != null}
        camera={cameraRefDecision?.original}
        affectedDays={cameraRefDecision?.affectedDays || []}
        hasUnresolvableDays={cameraRefDecision?.hasUnresolvableDays || false}
        onCreateNew={handleCreateNewCamera}
        onCorrect={handleCorrectCamera}
        onCancel={() => setCameraRefDecision(null)}
      />

      <ConfirmDialog
        isOpen={pendingDelete != null}
        title="Delete camera?"
        message={
          pendingDelete
            ? `Delete camera ${pendingDelete.id} (${pendingDelete.camera_name || 'unnamed'})? `
              + 'Any recording-day tasks or videos that reference this camera will lose their camera '
              + 'assignment. This cannot be undone.'
            : ''
        }
        confirmLabel="Delete"
        destructive
        onConfirm={confirmDeleteCamera}
        onCancel={() => setPendingDelete(null)}
      />
    </>
  );
}

CamerasContainer.propTypes = {
  animal: PropTypes.shape({
    id: PropTypes.string.isRequired,
    // Tolerant: this section is a repair destination for corrupt animal hardware.
    cameras: rawArray(PropTypes.object),
  }).isRequired,
  onFieldUpdate: PropTypes.func.isRequired,
  onPendingEditsChange: PropTypes.func,
};

CamerasContainer.defaultProps = {
  onPendingEditsChange: undefined,
};
