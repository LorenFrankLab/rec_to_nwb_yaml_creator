import React, { useState } from 'react';
import PropTypes from 'prop-types';
import Modal from '../../components/Modal/Modal';
import BrainRegionAutocomplete from '../../components/BrainRegionAutocomplete';
import { deviceTypes } from '../../valueList';
import './ElectrodeGroupModal.scss';

/**
 * Compute initial form state once, from props, at mount. The parent Modal only
 * renders this form while open, so it remounts on each open and this initializer
 * runs fresh — no unstable-dependency init effect needed.
 *
 * @param {string} mode 'add' or 'edit'.
 * @param {object|null} group Electrode group being edited (edit mode).
 * @returns {object} Initial form values.
 */
function getInitialFormData(mode, group) {
  if (mode === 'edit' && group) {
    return {
      device_type: group.device_type || '',
      location: group.location || '',
      targeted_x: group.targeted_x !== undefined && group.targeted_x !== '' ? String(group.targeted_x) : '',
      targeted_y: group.targeted_y !== undefined && group.targeted_y !== '' ? String(group.targeted_y) : '',
      targeted_z: group.targeted_z !== undefined && group.targeted_z !== '' ? String(group.targeted_z) : '',
      units: group.units || 'mm',
      bad_channels: group.bad_channels || '',
      count: '1',
    };
  }
  return {
    device_type: '',
    location: '',
    targeted_x: '',
    targeted_y: '',
    targeted_z: '',
    units: 'mm',
    bad_channels: '',
    count: '1',
  };
}

/**
 * Electrode group add/edit form. Rendered as Modal children (only while open), so
 * its state initializes once per open. Field/validation/save behavior unchanged.
 *
 * @param {object} props
 * @param {string} props.mode 'add' or 'edit'.
 * @param {object|null} props.group Group data for edit mode.
 * @param {Function} props.onSave Save callback with the cleaned group object.
 * @param {Function} props.onCancel Cancel callback.
 * @returns {JSX.Element}
 */
function ElectrodeGroupForm({ mode, group, onSave, onCancel }) {
  const [formData, setFormData] = useState(() => getInitialFormData(mode, group));

  const isFormValid = () => {
    const { device_type, location, targeted_x, targeted_y, targeted_z, count } = formData;
    const isCountValid = mode === 'edit' || (count && parseInt(count, 10) > 0 && parseInt(count, 10) <= 100);
    return (
      device_type.trim() !== '' &&
      location.trim() !== '' &&
      targeted_x.trim() !== '' &&
      targeted_y.trim() !== '' &&
      targeted_z.trim() !== '' &&
      isCountValid
    );
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSave = () => {
    if (!isFormValid()) return;
    onSave({
      device_type: formData.device_type,
      location: formData.location,
      targeted_x: parseFloat(formData.targeted_x),
      targeted_y: parseFloat(formData.targeted_y),
      targeted_z: parseFloat(formData.targeted_z),
      units: formData.units,
      bad_channels: formData.bad_channels,
      count: mode === 'add' ? parseInt(formData.count, 10) : 1,
    });
  };

  return (
    <form className="electrode-group-modal-form">
      {/* Device Type (single source: valueList deviceTypes()) */}
      <div className="form-group">
        <label htmlFor="device_type">Device Type</label>
        <select
          id="device_type"
          name="device_type"
          value={formData.device_type}
          onChange={handleInputChange}
          required
        >
          <option value="">Select device type...</option>
          {deviceTypes().map((deviceType) => (
            <option key={deviceType} value={deviceType}>
              {deviceType}
            </option>
          ))}
        </select>
      </div>

      {/* Count (Add mode only) */}
      {mode === 'add' && (
        <div className="form-group">
          <label htmlFor="count">Number of Electrode Groups</label>
          <input
            id="count"
            type="number"
            name="count"
            min="1"
            max="100"
            value={formData.count}
            onChange={handleInputChange}
            required
          />
          <span className="help-text">
            Create multiple identical electrode groups at once (e.g., 4 tetrodes in CA1)
          </span>
        </div>
      )}

      {/* Location */}
      <div className="form-group">
        <BrainRegionAutocomplete
          value={formData.location}
          onChange={(value) => setFormData((prev) => ({ ...prev, location: value }))}
          label="Location"
          name="location"
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
        <select id="units" name="units" value={formData.units} onChange={handleInputChange} required>
          <option value="mm">mm</option>
          <option value="μm">μm</option>
        </select>
      </div>

      {/* Bad Channels */}
      <div className="form-group">
        <label htmlFor="bad_channels">Bad Channels (comma-separated)</label>
        <input
          id="bad_channels"
          type="text"
          name="bad_channels"
          placeholder="e.g., 0,1,5"
          value={formData.bad_channels}
          onChange={handleInputChange}
        />
        <span className="help-text">List channel indices that are non-functional (optional)</span>
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
  );
}

ElectrodeGroupForm.propTypes = {
  mode: PropTypes.oneOf(['add', 'edit']).isRequired,
  group: PropTypes.object,
  onSave: PropTypes.func.isRequired,
  onCancel: PropTypes.func.isRequired,
};

ElectrodeGroupForm.defaultProps = { group: null };

/**
 * ElectrodeGroupModal - Add/edit an electrode group. Dialog accessibility (focus
 * trap, focus return, ESC/overlay close, scroll lock) is provided by the shared
 * Modal primitive.
 *
 * @param {object} props Component properties
 * @param {boolean} props.isOpen Whether modal is currently open
 * @param {string} props.mode 'add' or 'edit'
 * @param {object} props.group Electrode group data (optional for add mode)
 * @param {Function} props.onSave Callback with form data when saved
 * @param {Function} props.onCancel Callback when modal is cancelled/closed
 * @returns {JSX.Element}
 */
const ElectrodeGroupModal = ({ isOpen, mode = 'add', group = null, onSave, onCancel }) => (
  <Modal
    isOpen={isOpen}
    onClose={onCancel}
    title={mode === 'edit' ? 'Edit Electrode Group' : 'Add Electrode Group'}
    titleId="electrode-group-modal-title"
    className="electrode-group-modal-content"
  >
    <ElectrodeGroupForm mode={mode} group={group} onSave={onSave} onCancel={onCancel} />
  </Modal>
);

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
    bad_channels: PropTypes.string,
  }),
  onSave: PropTypes.func.isRequired,
  onCancel: PropTypes.func.isRequired,
};

ElectrodeGroupModal.defaultProps = {
  mode: 'add',
  group: null,
};

export default ElectrodeGroupModal;
