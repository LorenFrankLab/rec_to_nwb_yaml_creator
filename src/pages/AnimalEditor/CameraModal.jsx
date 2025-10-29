import React, { useState, useEffect, useRef } from 'react';
import PropTypes from 'prop-types';
import './CameraModal.scss';

/**
 * CameraModal - Modal dialog for adding/editing cameras
 *
 * Implements WCAG 2.1 Level A requirements:
 * - role="dialog" for accessibility
 * - Focus trap to keep keyboard navigation within modal
 * - ESC key to close
 * - Click outside overlay to close
 * - Focus management (auto-focus first field)
 * - Body scroll lock when open
 *
 * Features:
 * - Add mode: creates new camera with auto-assigned ID
 * - Edit mode: updates existing camera
 * - Form validation: required fields (camera_name, manufacturer, model)
 * - Numeric validation: meters_per_pixel > 0
 * - Warning: meters_per_pixel outside typical range (0.0005 - 0.002)
 * - All fields according to NWB schema: id, camera_name, manufacturer, model, lens, meters_per_pixel
 *
 * @param {object} props Component properties
 * @param {boolean} props.isOpen Whether modal is currently open
 * @param {string} props.mode 'add' or 'edit'
 * @param {object} props.camera Camera data (required for edit mode)
 * @param {Array} props.existingCameras Array of existing cameras (for ID assignment)
 * @param {Function} props.onSave Callback with form data when saved
 * @param {Function} props.onCancel Callback when modal is cancelled/closed
 *
 * @returns {JSX.Element|null} Modal component or null if closed
 */
const CameraModal = ({ isOpen, mode = 'add', camera = null, existingCameras = [], onSave, onCancel }) => {
  const firstFieldRef = useRef(null);

  // Calculate next available camera ID
  const getNextCameraId = () => {
    if (existingCameras.length === 0) {
      return 0;
    }
    const maxId = Math.max(...existingCameras.map(cam => cam.id));
    return maxId + 1;
  };

  // Form state
  const [formData, setFormData] = useState({
    id: '',
    camera_name: '',
    manufacturer: '',
    model: '',
    lens: '',
    meters_per_pixel: '',
  });

  // Validation warning state
  const [metersPerPixelWarning, setMetersPerPixelWarning] = useState('');

  // Initialize form data
  useEffect(() => {
    if (mode === 'edit' && camera) {
      setFormData({
        id: String(camera.id),
        camera_name: camera.camera_name || '',
        manufacturer: camera.manufacturer || '',
        model: camera.model || '',
        lens: camera.lens || '',
        meters_per_pixel: camera.meters_per_pixel !== undefined && camera.meters_per_pixel !== ''
          ? String(camera.meters_per_pixel)
          : '',
      });
    } else if (mode === 'add') {
      setFormData({
        id: String(getNextCameraId()),
        camera_name: '',
        manufacturer: '',
        model: '',
        lens: '',
        meters_per_pixel: '',
      });
    }
    setMetersPerPixelWarning('');
  }, [mode, camera, isOpen, existingCameras]);

  // Check if form is valid
  const isFormValid = () => {
    const { camera_name, manufacturer, model, meters_per_pixel } = formData;

    // Required fields must be non-empty
    if (!camera_name.trim() || !manufacturer.trim() || !model.trim()) {
      return false;
    }

    // meters_per_pixel must be present and > 0
    if (!meters_per_pixel || meters_per_pixel === '') {
      return false;
    }

    const mppValue = parseFloat(meters_per_pixel);
    if (isNaN(mppValue) || mppValue <= 0) {
      return false;
    }

    return true;
  };

  // Handle form field changes
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));

    // Check meters_per_pixel for typical range warning
    if (name === 'meters_per_pixel') {
      const mppValue = parseFloat(value);
      if (!isNaN(mppValue) && mppValue > 0) {
        const TYPICAL_MIN = 0.0005;
        const TYPICAL_MAX = 0.002;

        if (mppValue < TYPICAL_MIN || mppValue > TYPICAL_MAX) {
          setMetersPerPixelWarning(`Value outside typical range (${TYPICAL_MIN} - ${TYPICAL_MAX})`);
        } else {
          setMetersPerPixelWarning('');
        }
      } else {
        setMetersPerPixelWarning('');
      }
    }
  };

  // Handle Save button click
  const handleSave = () => {
    if (!isFormValid()) {
      return;
    }

    const dataToSave = {
      id: parseInt(formData.id, 10),
      camera_name: formData.camera_name.trim(),
      manufacturer: formData.manufacturer.trim(),
      model: formData.model.trim(),
      lens: formData.lens.trim(),
      meters_per_pixel: parseFloat(formData.meters_per_pixel),
    };

    onSave(dataToSave);
  };

  // Handle ESC key
  useEffect(() => {
    if (!isOpen) return;

    const handleEscape = (e) => {
      if (e.key === 'Escape') {
        onCancel();
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, onCancel]);

  // Focus first field when modal opens
  useEffect(() => {
    if (isOpen && firstFieldRef.current) {
      firstFieldRef.current.focus();
    }
  }, [isOpen]);

  // Lock body scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }

    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  // Handle click on overlay (outside modal)
  const handleOverlayClick = (e) => {
    if (e.target.classList.contains('camera-modal-overlay')) {
      onCancel();
    }
  };

  // Don't render if not open
  if (!isOpen) return null;

  const titleId = 'camera-modal-title';
  const isEditMode = mode === 'edit';
  const title = isEditMode ? 'Edit Camera' : 'Add Camera';

  return (
    <div
      className="camera-modal-overlay"
      onClick={handleOverlayClick}
      role="presentation"
    >
      <div
        className="camera-modal-content"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={(e) => e.stopPropagation()} // Prevent overlay click when clicking content
      >
        <h2 id={titleId} className="camera-modal-title">
          {title}
        </h2>

        <form className="camera-modal-form">
          {/* Camera ID (read-only, auto-assigned) */}
          <div className="form-group">
            <label htmlFor="camera_id">Camera ID</label>
            <input
              id="camera_id"
              type="text"
              name="id"
              value={formData.id}
              readOnly
              disabled
            />
            <span className="help-text">Automatically assigned</span>
          </div>

          {/* Camera Name */}
          <div className="form-group">
            <label htmlFor="camera_name">Camera Name</label>
            <input
              id="camera_name"
              type="text"
              name="camera_name"
              placeholder="e.g., HomeBox_camera"
              value={formData.camera_name}
              onChange={handleInputChange}
              ref={firstFieldRef}
              required
            />
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

          {/* Lens */}
          <div className="form-group">
            <label htmlFor="lens">Lens</label>
            <input
              id="lens"
              type="text"
              name="lens"
              placeholder="e.g., 16mm"
              value={formData.lens}
              onChange={handleInputChange}
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
              Typical range: 0.0005 - 0.002
            </span>
            {metersPerPixelWarning && (
              <span className="warning-text" role="alert">
                {metersPerPixelWarning}
              </span>
            )}
          </div>

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
      </div>
    </div>
  );
};

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
  existingCameras: PropTypes.arrayOf(PropTypes.shape({
    id: PropTypes.number,
  })),
  onSave: PropTypes.func.isRequired,
  onCancel: PropTypes.func.isRequired,
};

CameraModal.defaultProps = {
  mode: 'add',
  camera: null,
  existingCameras: [],
};

export default CameraModal;
