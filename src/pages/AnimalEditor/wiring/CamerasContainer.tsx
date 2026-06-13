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
import { useState, useMemo, useEffect } from 'react';
import { useStoreContext } from '../../../state/StoreContext';
import { getAnimalCameras, getAnimalDayIds } from '../../../state/workspaceSelectors';
import type { Animal, Camera, Day } from '../../../state/workspaceTypes';
import { findCameraAffectedDays } from '../../../state/cameraUsage';
import { ConfirmDialog } from '../../../components/Modal';
import CamerasSection from '../CamerasSection';
import CameraModal from '../CameraModal';
import CameraReferenceDialog from '../CameraReferenceDialog';
import {
  collectCameraIdentities,
  findIdentityDivergence,
  cameraIdentityChanged,
  CAMERA_DEPENDENT_FIELDS,
} from '../identitySafety';
import type { IdentityDivergence } from '../identitySafety';

interface CamerasContainerProps {
  /** Animal record. */
  animal: Animal;
  /** Field-update callback (writes `cameras`). */
  onFieldUpdate: (field: string, value: unknown) => void;
  /** Called with `true` while the add/edit CameraModal is open and `false` otherwise / on unmount. */
  onPendingEditsChange?: (hasPending: boolean) => void;
}

/** The open add/edit camera modal state. */
interface CameraModalState {
  open: boolean;
  mode: 'add' | 'edit';
  camera: Camera | null;
}

/** Pending immutable-once-referenced decision when editing a camera that recording days reference. */
interface CameraRefDecision {
  camera: Camera;
  original: Camera;
  affectedDays: Array<{ id: number | string; date?: string }>;
  hasUnresolvableDays: boolean;
}

export default function CamerasContainer({ animal, onFieldUpdate, onPendingEditsChange }: CamerasContainerProps) {
  const { model } = useStoreContext();

  const [cameraModal, setCameraModal] = useState<CameraModalState>({ open: false, mode: 'add', camera: null });
  const [cameraDivergence, setCameraDivergence] = useState<IdentityDivergence | null>(null);
  // Phase 8.7 Task 5b: pending decision when editing a camera that recording days reference.
  const [cameraRefDecision, setCameraRefDecision] = useState<CameraRefDecision | null>(null);
  const [pendingDelete, setPendingDelete] = useState<Camera | null>(null);

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
    const resolved = ids.map((id) => model.workspace?.days?.[id]).filter((d): d is Day => Boolean(d));
    return { animalDays: resolved, hasUnresolvableDays: resolved.length < ids.length };
  }, [animal, model.workspace]);

  const openAddCamera = () => {
    setCameraDivergence(null);
    setCameraModal({ open: true, mode: 'add', camera: null });
  };

  const openEditCamera = (cameraId: number) => {
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
   */
  const handleSaveCamera = (cameraData: Camera) => {
    const exclude =
      cameraModal.mode === 'edit' && cameraModal.camera
        ? { animalId: animal.id, id: cameraModal.camera.id }
        : null;
    const registry = collectCameraIdentities(model.workspace, exclude);
    const candidate = Object.fromEntries(CAMERA_DEPENDENT_FIELDS.map((f): [string, unknown] => [f, cameraData[f as keyof Camera]]));

    // SELF-conflict: the edited camera is the SAME existing identity (same id + name).
    // Filling a dependent field that was EMPTY (null/undefined/'') on the saved camera COMPLETES
    // the identity — it does not diverge it — so such a field must NOT count as a self-divergence
    // (only a populated→different-populated change is a real self-divergence worth the "use a new
    // name" decision). We narrow ONLY the self-comparison: drop the candidate keys whose SAVED
    // value was empty, so they aren't compared here. The cross-camera `registry` comparison below
    // is unchanged, keeping the cross-animal / different-camera guards fully intact.
    const isEmpty = (v: unknown) => v === null || v === undefined || v === '';
    const currentIdentity =
      cameraModal.mode === 'edit' && cameraModal.camera
        ? [{
            name: cameraModal.camera.camera_name as string,
            label: `${animal.id} camera ${cameraModal.camera.id} saved identity`,
            fields: Object.fromEntries(CAMERA_DEPENDENT_FIELDS.map((f): [string, unknown] => [f, cameraModal.camera![f as keyof Camera]])),
          }]
        : [];
    const selfCandidate =
      cameraModal.mode === 'edit' && cameraModal.camera
        ? Object.fromEntries(
            CAMERA_DEPENDENT_FIELDS.filter((f) => !isEmpty(cameraModal.camera![f as keyof Camera])).map((f): [string, unknown] => [f, cameraData[f as keyof Camera]])
          )
        : candidate;
    const selfConflict = findIdentityDivergence(cameraData.camera_name as string, selfCandidate, currentIdentity);
    const conflict = selfConflict || findIdentityDivergence(cameraData.camera_name as string, candidate, registry);
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
          id: id as string,
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
        ? cameras.map((c) => (c.id === cameraModal.camera!.id ? cameraData : c))
        : [...cameras, cameraData];
    onFieldUpdate('cameras', next);
    closeCameraModal();
  };

  /** Next free numeric camera id (max existing + 1). */
  const nextCameraId = () =>
    cameras.reduce((max: number, c) => Math.max(max, typeof c.id === 'number' ? c.id : -1), -1) + 1;

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

