import React, { useState } from 'react';
import PropTypes from 'prop-types';
import Modal from '../../components/Modal/Modal';
import BrainRegionAutocomplete, { canonicalizeRegion, BRAIN_REGIONS } from '../../components/BrainRegionAutocomplete';
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
      description: group.description || '',
      targeted_location: group.targeted_location || '',
      targeted_x: group.targeted_x !== undefined && group.targeted_x !== '' ? String(group.targeted_x) : '',
      targeted_y: group.targeted_y !== undefined && group.targeted_y !== '' ? String(group.targeted_y) : '',
      targeted_z: group.targeted_z !== undefined && group.targeted_z !== '' ? String(group.targeted_z) : '',
      units: group.units || 'mm',
      count: '1',
    };
  }
  return {
    device_type: '',
    location: '',
    description: '',
    targeted_location: '',
    targeted_x: '',
    targeted_y: '',
    targeted_z: '',
    units: 'mm',
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
 * @param {string[]} props.knownRegions Canonical regions already used in the workspace.
 * @param {Function} props.onSave Save callback with the cleaned group object.
 * @param {Function} props.onCancel Cancel callback.
 * @returns {JSX.Element}
 */
function ElectrodeGroupForm({ mode, group, knownRegions, onSave, onCancel }) {
  const [formData, setFormData] = useState(() => getInitialFormData(mode, group));

  const isFiniteCoordinate = (value) => value.trim() !== '' && Number.isFinite(Number(value));

  const isFormValid = () => {
    const { device_type, location, description, targeted_location, targeted_x, targeted_y, targeted_z, count } = formData;
    const isCountValid = mode === 'edit' || (count && parseInt(count, 10) > 0 && parseInt(count, 10) <= 100);
    return (
      device_type.trim() !== '' &&
      location.trim() !== '' &&
      description.trim() !== '' &&
      targeted_location.trim() !== '' &&
      isFiniteCoordinate(targeted_x) &&
      isFiniteCoordinate(targeted_y) &&
      isFiniteCoordinate(targeted_z) &&
      isCountValid
    );
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSave = () => {
    if (!isFormValid()) return;
    // Snap region fields to their canonical spelling so a case-only variant
    // (e.g. "ca1") does not fragment Spyglass BrainRegion rows. Canonicalize
    // against the standard regions plus any already used in this workspace.
    const canonicalRegions = [...BRAIN_REGIONS, ...knownRegions];
    onSave({
      device_type: formData.device_type,
      location: canonicalizeRegion(formData.location, canonicalRegions),
      description: formData.description.trim(),
      targeted_location: canonicalizeRegion(formData.targeted_location, canonicalRegions),
      targeted_x: Number(formData.targeted_x),
      targeted_y: Number(formData.targeted_y),
      targeted_z: Number(formData.targeted_z),
      units: formData.units,
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
          suggestions={knownRegions}
          required
        />
        <span className="help-text">
          Actual recorded brain region (e.g., CA1). Becomes the NWB ElectrodeGroup
          location and a Spyglass brain region — keep spelling consistent across groups.
        </span>
      </div>

      {/* Description (schema-required, e.g. "Dorsal CA1 right hemisphere tetrode") */}
      <div className="form-group">
        <label htmlFor="description">Description</label>
        <input
          id="description"
          type="text"
          name="description"
          placeholder="e.g., Dorsal CA1 right hemisphere tetrode"
          value={formData.description}
          onChange={handleInputChange}
          required
        />
        <span className="help-text">
          Free-text label for this group in the NWB file (e.g., hemisphere and depth target).
        </span>
      </div>

      {/* Targeted Location (planned implant target; schema-required) */}
      <div className="form-group">
        <BrainRegionAutocomplete
          value={formData.targeted_location}
          onChange={(value) => setFormData((prev) => ({ ...prev, targeted_location: value }))}
          label="Targeted Location"
          name="targeted_location"
          suggestions={knownRegions}
          required
        />
        <span className="help-text">
          Planned implant target region. May differ from Location if the probe drifted.
        </span>
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

      {/* Bad channels are not set here — they vary per recording day. */}
      <p className="help-text">
        Failed channels are marked per recording day in the Day Editor (Devices step),
        not here, since channels fail over time.
      </p>

      {/* Tell the user what is still missing rather than leaving Save silently disabled. */}
      {!isFormValid() && (
        <p className="form-invalid-hint" role="status">
          Fill in all required fields (device type, location, description, targeted
          location, and the AP/ML/DV coordinates) to save.
        </p>
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
  knownRegions: PropTypes.arrayOf(PropTypes.string),
  onSave: PropTypes.func.isRequired,
  onCancel: PropTypes.func.isRequired,
};

ElectrodeGroupForm.defaultProps = { group: null, knownRegions: [] };

/**
 * ElectrodeGroupModal - Add/edit an electrode group. Dialog accessibility (focus
 * trap, focus return, ESC/overlay close, scroll lock) is provided by the shared
 * Modal primitive.
 *
 * @param {object} props Component properties
 * @param {boolean} props.isOpen Whether modal is currently open
 * @param {string} props.mode 'add' or 'edit'
 * @param {object} props.group Electrode group data (optional for add mode)
 * @param {string[]} props.knownRegions Canonical regions already used in the workspace
 * @param {Function} props.onSave Callback with form data when saved
 * @param {Function} props.onCancel Callback when modal is cancelled/closed
 * @returns {JSX.Element}
 */
const ElectrodeGroupModal = ({ isOpen, mode = 'add', group = null, knownRegions = [], onSave, onCancel }) => (
  <Modal
    isOpen={isOpen}
    onClose={onCancel}
    title={mode === 'edit' ? 'Edit Electrode Group' : 'Add Electrode Group'}
    titleId="electrode-group-modal-title"
    className="electrode-group-modal-content"
  >
    <ElectrodeGroupForm mode={mode} group={group} knownRegions={knownRegions} onSave={onSave} onCancel={onCancel} />
  </Modal>
);

ElectrodeGroupModal.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  mode: PropTypes.oneOf(['add', 'edit']),
  group: PropTypes.shape({
    id: PropTypes.number,
    device_type: PropTypes.string,
    location: PropTypes.string,
    description: PropTypes.string,
    targeted_location: PropTypes.string,
    targeted_x: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
    targeted_y: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
    targeted_z: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
    units: PropTypes.string,
  }),
  knownRegions: PropTypes.arrayOf(PropTypes.string),
  onSave: PropTypes.func.isRequired,
  onCancel: PropTypes.func.isRequired,
};

ElectrodeGroupModal.defaultProps = {
  mode: 'add',
  group: null,
  knownRegions: [],
};

export default ElectrodeGroupModal;
