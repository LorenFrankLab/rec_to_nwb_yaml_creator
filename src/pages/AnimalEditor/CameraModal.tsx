import { useState, useRef } from 'react';
import type { ChangeEvent } from 'react';
import Modal from '../../components/Modal/Modal';
import { IDENTITY_FIELD_LABELS } from './identitySafety';
import type { IdentityDivergence } from './identitySafety';
import type { Camera } from '../../state/workspaceTypes';
import './CameraModal.scss';

const TYPICAL_MIN = 0.0005;
const TYPICAL_MAX = 0.002;

/** Local form state for the camera editor (all fields are strings while editing). */
interface CameraFormData {
  id: string;
  camera_name: string;
  manufacturer: string;
  model: string;
  lens: string;
  meters_per_pixel: string;
}

/**
 * Compute the initial form state once, from props, at mount. Because the parent
 * Modal only renders this form while open, the form remounts on each open and this
 * initializer runs fresh — no unstable-dependency init effect needed.
 *
 * @param mode - 'add' or 'edit'.
 * @param camera - Camera being edited (edit mode).
 * @param existingCameras - Existing cameras (for next-id assignment).
 * @returns Initial form values.
 */
function getInitialFormData(mode: string, camera: Camera | null, existingCameras: Camera[]): CameraFormData {
  if (mode === 'edit' && camera) {
    return {
      id: String(camera.id),
      camera_name: camera.camera_name || '',
      manufacturer: camera.manufacturer || '',
      model: camera.model || '',
      lens: camera.lens || '',
      meters_per_pixel:
        camera.meters_per_pixel !== undefined && (camera.meters_per_pixel as number | string) !== ''
          ? String(camera.meters_per_pixel)
          : '',
    };
  }
  const nextId = existingCameras.length === 0 ? 0 : Math.max(...existingCameras.map((cam) => cam.id)) + 1;
  return {
    id: String(nextId),
    camera_name: '',
    manufacturer: '',
    model: '',
    lens: '',
    meters_per_pixel: '',
  };
}

interface CameraFormProps {
  /** 'add' or 'edit'. */
  mode: 'add' | 'edit';
  /** Camera data for edit mode. */
  camera?: Camera | null;
  /** Existing cameras (ID assignment). */
  existingCameras: Camera[];
  /** Save callback with the cleaned camera object. */
  onSave: (camera: Camera) => void;
  /** Cancel callback. */
  onCancel: () => void;
  /** Identity divergence (same name, different dependent fields), or null. */
  divergence?: IdentityDivergence | null;
  /** Steer the user to a new camera name (focuses the name input). */
  onUseNewName?: (() => void) | null;
}

/**
 * Camera add/edit form. Rendered as Modal children (only while open), so its state
 * initializes once per open. Owns field/validation/save behavior unchanged.
 */
function CameraForm({ mode, camera = null, existingCameras, onSave, onCancel, divergence = null, onUseNewName = null }: CameraFormProps) {
  const [formData, setFormData] = useState<CameraFormData>(() => getInitialFormData(mode, camera, existingCameras));
  const [metersPerPixelWarning, setMetersPerPixelWarning] = useState('');
  const nameInputRef = useRef<HTMLInputElement>(null);

  const isFormValid = () => {
    const { camera_name, manufacturer, model, lens, meters_per_pixel } = formData;
    // `lens` is schema-required (nwb_schema.json camera item), so it is required here.
    if (!camera_name.trim() || !manufacturer.trim() || !model.trim() || !lens.trim()) {
      return false;
    }
    if (!meters_per_pixel || meters_per_pixel === '') {
      return false;
    }
    const mppValue = parseFloat(meters_per_pixel);
    return !isNaN(mppValue) && mppValue > 0;
  };

  const focusName = () => {
    onUseNewName?.();
    if (nameInputRef.current) nameInputRef.current.focus();
  };

  const handleInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }) as CameraFormData);

    if (name === 'meters_per_pixel') {
      const mppValue = parseFloat(value);
      if (!isNaN(mppValue) && mppValue > 0 && (mppValue < TYPICAL_MIN || mppValue > TYPICAL_MAX)) {
        setMetersPerPixelWarning(`Value outside typical range (${TYPICAL_MIN} - ${TYPICAL_MAX})`);
      } else {
        setMetersPerPixelWarning('');
      }
    }
  };

  const handleSave = () => {
    if (!isFormValid()) return;
    onSave({
      id: parseInt(formData.id, 10),
      camera_name: formData.camera_name.trim(),
      manufacturer: formData.manufacturer.trim(),
      model: formData.model.trim(),
      lens: formData.lens.trim(),
      meters_per_pixel: parseFloat(formData.meters_per_pixel),
    });
  };

  return (
    <form className="camera-modal-form">
      {/* Camera ID (read-only, auto-assigned) */}
      <div className="form-group">
        <label htmlFor="camera_id">Camera ID</label>
        <input id="camera_id" type="text" name="id" value={formData.id} readOnly disabled />
        <span className="help-text">Automatically assigned</span>
      </div>

      {/* Camera Name */}
      <div className="form-group">
        <label htmlFor="camera_name">Camera Name</label>
        <input
          id="camera_name"
          type="text"
          name="camera_name"
          ref={nameInputRef}
          placeholder="e.g., HomeBox_camera"
          value={formData.camera_name}
          onChange={handleInputChange}
          aria-describedby="camera_name_help"
          required
        />
        {/* Proactive Spyglass identity guidance (the divergence alert below is the reactive
            catch). camera_name is the CameraDevice primary key downstream. */}
        <span id="camera_name_help" className="help-text">
          Same name means the same camera. A camera with a different zoom, calibration, lens,
          model, or id is a different camera — give it a different name.
        </span>
      </div>

      {/* Manufacturer */}
      <div className="form-group">
        <label htmlFor="manufacturer">Manufacturer</label>
        <input
          id="manufacturer"
          type="text"
          name="manufacturer"
          placeholder="e.g., Manta"
          value={formData.manufacturer}
          onChange={handleInputChange}
          required
        />
      </div>

      {/* Model */}
      <div className="form-group">
        <label htmlFor="model">Model</label>
        <input
          id="model"
          type="text"
          name="model"
          placeholder="e.g., G-146B"
          value={formData.model}
          onChange={handleInputChange}
          required
        />
      </div>

      {/* Lens (schema-required) */}
      <div className="form-group">
        <label htmlFor="lens">Lens</label>
        <input
          id="lens"
          type="text"
          name="lens"
          placeholder="e.g., 16mm"
          value={formData.lens}
          onChange={handleInputChange}
          required
        />
      </div>

      {/* Meters per Pixel */}
      <div className="form-group">
        <label htmlFor="meters_per_pixel">Meters per Pixel</label>
        <input
          id="meters_per_pixel"
          type="number"
          name="meters_per_pixel"
          placeholder="0.000842"
          step="0.000001"
          min="0"
          value={formData.meters_per_pixel}
          onChange={handleInputChange}
          required
        />
        <span className="help-text">
          Spatial calibration — meters per pixel (how many meters one pixel spans in the tracking
          video). Typical overhead tracking: 0.0005–0.002 m/px. Changing this is a new camera
          identity.
        </span>
        {metersPerPixelWarning && (
          <span className="warning-text" role="alert">
            {metersPerPixelWarning}
          </span>
        )}
      </div>

      {/* Identity divergence: reusing a camera_name with different dependent fields. */}
      {divergence && (
        <div className="identity-divergence" role="alert">
          <p className="identity-divergence-title">
            The name “{formData.camera_name.trim()}” is already used by {divergence.existing.label}
            {' '}with different settings. The same camera name must mean the same camera. Give this
            camera a new name.
          </p>
          <table className="identity-divergence-table">
            <thead>
              <tr><th>Field</th><th>Existing</th><th>This camera</th></tr>
            </thead>
            <tbody>
              {divergence.differingFields.map((field) => (
                <tr key={field}>
                  <td>{IDENTITY_FIELD_LABELS[field] || field}</td>
                  <td>{String(divergence.existing.fields[field] ?? '')}</td>
                  <td>{String(formData[field as keyof CameraFormData] ?? '')}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <button type="button" className="btn-save" onClick={focusName}>
            Use a new camera name
          </button>
        </div>
      )}

      {/* Buttons */}
      <div className="form-actions">
        <button
          type="button"
          className="btn-cancel"
          onClick={onCancel}
          aria-label="Cancel and close modal"
        >
          Cancel
        </button>
        <button
          type="button"
          className="btn-save"
          onClick={handleSave}
          disabled={!isFormValid()}
          aria-label="Save camera configuration"
        >
          Save
        </button>
      </div>
    </form>
  );
}

interface CameraModalProps {
  /** Whether modal is currently open. */
  isOpen: boolean;
  /** 'add' or 'edit'. */
  mode?: 'add' | 'edit';
  /** Camera data (required for edit mode). */
  camera?: Camera | null;
  /** Existing cameras (for ID assignment). */
  existingCameras?: Camera[];
  /** Callback with form data when saved. */
  onSave: (camera: Camera) => void;
  /** Callback when modal is cancelled/closed. */
  onCancel: () => void;
  /** Identity divergence (same name, different dependent fields), or null. */
  divergence?: IdentityDivergence | null;
  /** Steer the user to a new camera name (focuses the name input). */
  onUseNewName?: (() => void) | null;
}

/**
 * CameraModal - Add/edit a camera. Dialog accessibility (focus trap, focus return,
 * ESC/overlay close, scroll lock) is provided by the shared Modal primitive.
 */
const CameraModal = ({ isOpen, mode = 'add', camera = null, existingCameras = [], onSave, onCancel, divergence = null, onUseNewName = null }: CameraModalProps) => (
  <Modal
    isOpen={isOpen}
    onClose={onCancel}
    title={mode === 'edit' ? 'Edit Camera' : 'Add Camera'}
    titleId="camera-modal-title"
    className="camera-modal-content"
  >
    <CameraForm
      mode={mode}
      camera={camera}
      existingCameras={existingCameras}
      onSave={onSave}
      onCancel={onCancel}
      divergence={divergence}
      onUseNewName={onUseNewName}
    />
  </Modal>
);

export default CameraModal;
