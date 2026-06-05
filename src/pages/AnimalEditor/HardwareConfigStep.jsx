import { useState, useMemo } from 'react';
import PropTypes from 'prop-types';
import { useStoreContext } from '../../state/StoreContext';
import { getAnimalCameras } from '../../state/workspaceSelectors';
import { ConfirmDialog } from '../../components/Modal';
import CamerasSection from './CamerasSection';
import CameraModal from './CameraModal';
import DataAcqSection from './DataAcqSection';
import BehavioralEventsSection from './BehavioralEventsSection';
import RawCorruptionBanner from '../../components/RawCorruptionBanner';
import { rawArray } from '../../components/rawPropTypes';
import SaveIndicator from '../DayEditor/SaveIndicator';
import {
  collectCameraIdentities,
  collectDataAcqIdentities,
  findIdentityDivergence,
  CAMERA_DEPENDENT_FIELDS,
} from './identitySafety';
import './HardwareConfigStep.scss';

/**
 * HardwareConfigStep - Animal Editor Step 3: Cameras, Hardware & Behavioral Events.
 *
 * Owns camera add/edit/delete (the buttons were previously inert): it opens
 * {@link CameraModal}, enforces the dataset-wide Spyglass `camera_name` identity
 * (reusing a name with a different id/calibration/lens/model/manufacturer is blocked
 * with a side-by-side comparison and a steer to a new name), and persists via
 * `updateAnimal({ cameras })`. Data-acq and behavioral-events editing is delegated to
 * the child sections, which write to the model locations the export reads.
 *
 * @param {object} props
 * @param {object} props.animal - Animal record.
 * @param {Function} props.onFieldUpdate - Field update callback from AnimalEditorStepper.
 * @param {Function} props.onNavigateBack - Navigate back to Step 2 (Channel Maps).
 * @param {Function} props.onNavigateNext - Navigate to Step 4 (Optogenetics) or exit.
 * @param props.onRepair
 * @returns {JSX.Element}
 */
export default function HardwareConfigStep({
  animal,
  onFieldUpdate,
  onNavigateBack,
  onNavigateNext,
  onRepair,
}) {
  const { model, persistence } = useStoreContext();

  const [cameraModal, setCameraModal] = useState({ open: false, mode: 'add', camera: null });
  const [cameraDivergence, setCameraDivergence] = useState(null);
  const [pendingDelete, setPendingDelete] = useState(null);

  // A repair routed to this editor must not dead-end by crashing on the corruption it
  // exists to fix. Read cameras through the canonical selector: a non-array `cameras`
  // (`|| []` would PRESERVE a string and crash CamerasSection's `.reduce`) renders safely.
  const cameras = useMemo(() => getAnimalCameras(animal), [animal]);

  // Data-acq identities elsewhere in the dataset (plus any other items on this
  // animal), for the DataAcqSection divergent-reuse check.
  const dataAcqRegistry = useMemo(
    () => collectDataAcqIdentities(model.workspace, { animalId: animal.id, index: 0 }),
    [model.workspace, animal.id]
  );

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
   * Persist a camera unless its name diverges from an existing camera identity in the
   * dataset, in which case surface the comparison and keep the modal open.
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

    const next =
      cameraModal.mode === 'edit' && cameraModal.camera
        ? cameras.map((c) => (c.id === cameraModal.camera.id ? cameraData : c))
        : [...cameras, cameraData];
    onFieldUpdate('cameras', next);
    closeCameraModal();
  };

  const confirmDeleteCamera = () => {
    if (pendingDelete == null) return;
    onFieldUpdate('cameras', cameras.filter((c) => c.id !== pendingDelete.id));
    setPendingDelete(null);
  };

  return (
    <div className="hardware-config-step">
      <header className="step-header">
        <h2>Cameras, Hardware & Behavioral Events</h2>
        <SaveIndicator
          enabled={persistence.enabled}
          lastSaved={persistence.lastSaved}
          error={persistence.saveError}
          pending={persistence.hasPendingWrite}
        />
      </header>

      <div className="step-content">
        {/* Destination repair surface: a corrupt cameras / data_acq_device /
            configurationHistory would otherwise hide behind a section's empty state. The
            banner surfaces it with an executable reset, so a repair routed here is never a
            dead-end. */}
        <RawCorruptionBanner
          animal={animal}
          fields={['cameras', 'data_acq_device', 'configurationHistory']}
          onRepair={onRepair}
        />

        <section className="section-elevation-1" aria-label="Cameras">
          <CamerasSection
            animal={animal}
            onFieldUpdate={onFieldUpdate}
            onAdd={openAddCamera}
            onEdit={openEditCamera}
            onDelete={(camera) => setPendingDelete(camera)}
          />
        </section>

        <section className="section-elevation-0" aria-label="Data acquisition device">
          <DataAcqSection
            animal={animal}
            onFieldUpdate={onFieldUpdate}
            dataAcqRegistry={dataAcqRegistry}
          />
        </section>

        <section className="section-elevation-1" aria-label="Behavioral events">
          <BehavioralEventsSection
            animal={animal}
            onFieldUpdate={onFieldUpdate}
          />
        </section>
      </div>

      <footer className="step-footer">
        <button type="button" className="button-secondary" onClick={() => onNavigateBack?.()}>
          Back to Channel Maps
        </button>
        <button type="button" className="button-primary" onClick={() => onNavigateNext?.()}>
          Continue
        </button>
      </footer>

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
    </div>
  );
}

HardwareConfigStep.propTypes = {
  animal: PropTypes.shape({
    id: PropTypes.string.isRequired,
    // Tolerant: this step is a repair destination for corrupt animal hardware.
    cameras: rawArray(PropTypes.object),
    devices: PropTypes.object,
    technicalDefaults: PropTypes.object,
    behavioral_events: rawArray(PropTypes.object),
  }).isRequired,
  onFieldUpdate: PropTypes.func.isRequired,
  onNavigateBack: PropTypes.func,
  onNavigateNext: PropTypes.func,
  onRepair: PropTypes.func,
};

HardwareConfigStep.defaultProps = {
  onNavigateBack: null,
  onNavigateNext: null,
  onRepair: undefined,
};
