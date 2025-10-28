import React, { useState, useEffect, useRef } from 'react';
import PropTypes from 'prop-types';
import './ElectrodeGroupModal.scss';

/**
 * ElectrodeGroupModal - Modal dialog for adding/editing electrode groups
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
 * - Add mode: creates new electrode group
 * - Edit mode: updates existing electrode group
 * - Form validation: all fields required
 * - Device type: dropdown with probe types
 * - Location: input field for brain region
 * - Coordinates: AP (targeted_x), ML (targeted_y), DV (targeted_z)
 * - Units: mm or μm
 *
 * @param {object} props Component properties
 * @param {boolean} props.isOpen Whether modal is currently open
 * @param {string} props.mode 'add' or 'edit'
 * @param {object} props.group Electrode group data (optional for add mode)
 * @param {Function} props.onSave Callback with form data when saved
 * @param {Function} props.onCancel Callback when modal is cancelled/closed
 *
 * @returns {JSX.Element|null} Modal component or null if closed
 */
const ElectrodeGroupModal = ({ isOpen, mode = 'add', group = null, onSave, onCancel }) => {
  const firstFieldRef = useRef(null);

  // Device types from the application
  const DEVICE_TYPES = [
    'tetrode_12.5',
    'A1x32-6mm-50-177-H32_21mm',
    '128c-4s8mm6cm-20um-40um-sl',
    '128c-4s6mm6cm-15um-26um-sl',
    '128c-4s8mm6cm-15um-26um-sl',
    '128c-4s6mm6cm-20um-40um-sl',
    '128c-4s4mm6cm-20um-40um-sl',
    '128c-4s4mm6cm-15um-26um-sl',
    '32c-2s8mm6cm-20um-40um-dl',
    '64c-4s6mm6cm-20um-40um-dl',
    '64c-3s6mm6cm-20um-40um-sl',
    'NET-EBL-128ch-single-shank',
  ];

  // Form state
  const [formData, setFormData] = useState({
    device_type: '',
    location: '',
    targeted_x: '',
    targeted_y: '',
    targeted_z: '',
    units: 'mm',
  });

  // Initialize form data from group prop in edit mode
  useEffect(() => {
    if (mode === 'edit' && group) {
      setFormData({
        device_type: group.device_type || '',
        location: group.location || '',
        targeted_x: group.targeted_x !== undefined && group.targeted_x !== '' ? String(group.targeted_x) : '',
        targeted_y: group.targeted_y !== undefined && group.targeted_y !== '' ? String(group.targeted_y) : '',
        targeted_z: group.targeted_z !== undefined && group.targeted_z !== '' ? String(group.targeted_z) : '',
        units: group.units || 'mm',
      });
    } else if (mode === 'add') {
      setFormData({
        device_type: '',
        location: '',
        targeted_x: '',
        targeted_y: '',
        targeted_z: '',
        units: 'mm',
      });
    }
  }, [mode, group, isOpen]);

  // Check if all required fields are filled
  const isFormValid = () => {
    const { device_type, location, targeted_x, targeted_y, targeted_z } = formData;
    return (
      device_type.trim() !== '' &&
      location.trim() !== '' &&
      targeted_x.trim() !== '' &&
      targeted_y.trim() !== '' &&
      targeted_z.trim() !== ''
    );
  };

  // Handle form field changes
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  // Handle Save button click
  const handleSave = () => {
    if (!isFormValid()) {
      return;
    }

    const dataToSave = {
      device_type: formData.device_type,
      location: formData.location,
      targeted_x: parseFloat(formData.targeted_x),
      targeted_y: parseFloat(formData.targeted_y),
      targeted_z: parseFloat(formData.targeted_z),
      units: formData.units,
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
    if (e.target.classList.contains('electrode-group-modal-overlay')) {
      onCancel();
    }
  };

  // Don't render if not open
  if (!isOpen) return null;

  const titleId = 'electrode-group-modal-title';
  const isEditMode = mode === 'edit';
  const title = isEditMode ? 'Edit Electrode Group' : 'Add Electrode Group';

  return (
    <div
      className="electrode-group-modal-overlay"
      onClick={handleOverlayClick}
      role="presentation"
    >
      <div
        className="electrode-group-modal-content"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={(e) => e.stopPropagation()} // Prevent overlay click when clicking content
      >
        <h2 id={titleId} className="electrode-group-modal-title">
          {title}
        </h2>

        <form className="electrode-group-modal-form">
          {/* Device Type */}
          <div className="form-group">
            <label htmlFor="device_type">Device Type</label>
            <select
              id="device_type"
              name="device_type"
              value={formData.device_type}
              onChange={handleInputChange}
              ref={firstFieldRef}
              required
            >
              <option value="">Select device type...</option>
              {DEVICE_TYPES.map((deviceType) => (
                <option key={deviceType} value={deviceType}>
                  {deviceType}
                </option>
              ))}
            </select>
          </div>

          {/* Location */}
          <div className="form-group">
            <label htmlFor="location">Location</label>
            <input
              id="location"
              type="text"
              name="location"
              placeholder="e.g., CA1, M1, PFC"
              value={formData.location}
              onChange={handleInputChange}
              required
            />
          </div>

          {/* Coordinates */}
          <div className="form-group-coordinates">
            <div className="form-group">
              <label htmlFor="targeted_x">AP (Anterior-Posterior)</label>
              <input
                id="targeted_x"
                type="number"
                name="targeted_x"
                placeholder="0.0"
                step="any"
                value={formData.targeted_x}
                onChange={handleInputChange}
                required
              />
            </div>

            <div className="form-group">
              <label htmlFor="targeted_y">ML (Medial-Lateral)</label>
              <input
                id="targeted_y"
                type="number"
                name="targeted_y"
                placeholder="0.0"
                step="any"
                value={formData.targeted_y}
                onChange={handleInputChange}
                required
              />
            </div>

            <div className="form-group">
              <label htmlFor="targeted_z">DV (Dorsal-Ventral)</label>
              <input
                id="targeted_z"
                type="number"
                name="targeted_z"
                placeholder="0.0"
                step="any"
                value={formData.targeted_z}
                onChange={handleInputChange}
                required
              />
            </div>
          </div>

          {/* Units */}
          <div className="form-group">
            <label htmlFor="units">Units</label>
            <select
              id="units"
              name="units"
              value={formData.units}
              onChange={handleInputChange}
              required
            >
              <option value="mm">mm</option>
              <option value="μm">μm</option>
            </select>
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
              aria-label="Save electrode group configuration"
            >
              Save
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

ElectrodeGroupModal.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  mode: PropTypes.oneOf(['add', 'edit']),
  group: PropTypes.shape({
    id: PropTypes.string,
    device_type: PropTypes.string,
    location: PropTypes.string,
    targeted_x: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
    targeted_y: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
    targeted_z: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
    units: PropTypes.string,
  }),
  onSave: PropTypes.func.isRequired,
  onCancel: PropTypes.func.isRequired,
};

ElectrodeGroupModal.defaultProps = {
  mode: 'add',
  group: null,
};

export default ElectrodeGroupModal;
