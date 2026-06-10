import React, { useState, useRef } from 'react';
import PropTypes from 'prop-types';
import Modal from '../../components/Modal/Modal';
import { IDENTITY_FIELD_LABELS } from './identitySafety';
import './CameraModal.scss';

const TYPICAL_MIN = 0.0005;
const TYPICAL_MAX = 0.002;

/**
 * Compute the initial form state once, from props, at mount. Because the parent
 * Modal only renders this form while open, the form remounts on each open and this
 * initializer runs fresh — no unstable-dependency init effect needed.
 *
 * @param {string} mode 'add' or 'edit'.
 * @param {object|null} camera Camera being edited (edit mode).
 * @param {Array} existingCameras Existing cameras (for next-id assignment).
 * @returns {object} Initial form values.
 */
function getInitialFormData(mode, camera, existingCameras) {
  if (mode === 'edit' && camera) {
    return {
      id: String(camera.id),
      camera_name: camera.camera_name || '',
      manufacturer: camera.manufacturer || '',
      model: camera.model || '',
      lens: camera.lens || '',
      meters_per_pixel:
        camera.meters_per_pixel !== undefined && camera.meters_per_pixel !== ''
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

/**
 * Camera add/edit form. Rendered as Modal children (only while open), so its state
 * initializes once per open. Owns field/validation/save behavior unchanged.
 *
 * @param {object} props
 * @param {string} props.mode 'add' or 'edit'.
 * @param {object|null} props.camera Camera data for edit mode.
 * @param {Array} props.existingCameras Existing cameras (ID assignment).
 * @param {Function} props.onSave Save callback with the cleaned camera object.
 * @param {Function} props.onCancel Cancel callback.
 * @param props.divergence
 * @param props.onUseNewName
 * @returns {JSX.Element}
 */
function CameraForm({ mode, camera, existingCameras, onSave, onCancel, divergence, onUseNewName }) {
  const [formData, setFormData] = useState(() => getInitialFormData(mode, camera, existingCameras));
  const [metersPerPixelWarning, setMetersPerPixelWarning] = useState('');
  const nameInputRef = useRef(null);

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

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));

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
                  <td>{String(formData[field] ?? '')}</td>
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

CameraForm.propTypes = {
  mode: PropTypes.oneOf(['add', 'edit']).isRequired,
  camera: PropTypes.object,
  existingCameras: PropTypes.array.isRequired,
  onSave: PropTypes.func.isRequired,
  onCancel: PropTypes.func.isRequired,
  divergence: PropTypes.shape({
    existing: PropTypes.object,
    differingFields: PropTypes.arrayOf(PropTypes.string),
  }),
  onUseNewName: PropTypes.func,
};

CameraForm.defaultProps = { camera: null, divergence: null, onUseNewName: null };

/**
 * CameraModal - Add/edit a camera. Dialog accessibility (focus trap, focus return,
 * ESC/overlay close, scroll lock) is provided by the shared Modal primitive.
 *
 * @param {object} props Component properties
 * @param {boolean} props.isOpen Whether modal is currently open
 * @param {string} props.mode 'add' or 'edit'
 * @param {object} props.camera Camera data (required for edit mode)
 * @param {Array} props.existingCameras Existing cameras (for ID assignment)
 * @param {Function} props.onSave Callback with form data when saved
 * @param {Function} props.onCancel Callback when modal is cancelled/closed
 * @param props.divergence
 * @param props.onUseNewName
 * @returns {JSX.Element}
 */
const CameraModal = ({ isOpen, mode = 'add', camera = null, existingCameras = [], onSave, onCancel, divergence = null, onUseNewName = null }) => (
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

CameraModal.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  mode: PropTypes.oneOf(['add', 'edit']),
  camera: PropTypes.shape({
    id: PropTypes.number,
    camera_name: PropTypes.string,
    manufacturer: PropTypes.string,
    model: PropTypes.string,
    lens: PropTypes.string,
    meters_per_pixel: PropTypes.number,
  }),
  existingCameras: PropTypes.arrayOf(
    PropTypes.shape({
      id: PropTypes.number,
    })
  ),
  onSave: PropTypes.func.isRequired,
  onCancel: PropTypes.func.isRequired,
  divergence: PropTypes.shape({
    existing: PropTypes.object,
    differingFields: PropTypes.arrayOf(PropTypes.string),
  }),
  onUseNewName: PropTypes.func,
};

CameraModal.defaultProps = {
  mode: 'add',
  camera: null,
  existingCameras: [],
  divergence: null,
  onUseNewName: null,
};

export default CameraModal;
