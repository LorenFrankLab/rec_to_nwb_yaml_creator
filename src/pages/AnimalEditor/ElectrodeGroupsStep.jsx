import { useState } from 'react';
import PropTypes from 'prop-types';
import { deviceTypeMap } from '../../ntrode/deviceTypes';
import './ElectrodeGroupsStep.scss';

/**
 * ElectrodeGroupsStep - Step 1 of Animal Editor
 *
 * Provides CRUD interface for electrode groups with table view.
 *
 * @param {object} props
 * @param {object} props.animal - Animal record with devices.electrode_groups
 * @param {Function} props.onFieldUpdate - Field update callback
 * @param {Function} [props.onEdit] - Edit button click handler
 * @param {Function} [props.onAdd] - Add button click handler
 * @param {Function} [props.onDelete] - Delete button click handler
 * @returns {JSX.Element}
 */
export default function ElectrodeGroupsStep({ animal, onFieldUpdate, onEdit, onAdd, onDelete }) {
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showCopyDialog, setShowCopyDialog] = useState(false);

  const electrodeGroups = animal.devices?.electrode_groups || [];

  /**
   * Get channel count for a device type
   * @param {string} deviceType
   * @returns {number}
   */
  function getChannelCount(deviceType) {
    const channels = deviceTypeMap(deviceType);
    return channels ? channels.length : 0;
  }

  /**
   * Compute status badge (✓ complete, ⚠ incomplete, ❌ missing required)
   * @param {object} group
   * @returns {string}
   */
  function getStatus(group) {
    // Required fields
    const required = ['device_type', 'location', 'targeted_x', 'targeted_y', 'targeted_z', 'units'];
    const hasRequired = required.every(field => group[field] !== undefined && group[field] !== '');

    if (!hasRequired) {
      return '❌';
    }

    // Has all fields (complete)
    return '✓';
  }

  /**
   * Handle add button click
   */
  const handleAddClick = () => {
    if (onAdd) {
      onAdd();
    } else {
      setShowAddDialog(true);
    }
  };

  /**
   * Handle copy button click
   */
  const handleCopyClick = () => {
    setShowCopyDialog(true);
  };

  /**
   * Handle edit button click
   * @param groupId
   */
  const handleEditClick = (groupId) => {
    if (onEdit) {
      onEdit(groupId);
    }
  };

  /**
   * Handle delete button click
   * @param group - Electrode group to delete
   */
  const handleDeleteClick = (group) => {
    if (onDelete) {
      onDelete(group);
    }
  };

  // Empty state
  if (electrodeGroups.length === 0) {
    return (
      <div className="electrode-groups-step empty-state">
        <div className="empty-state-icon">🔌</div>
        <h3>No Electrode Groups Configured</h3>
        <p>
          Electrode groups define your recording hardware: brain regions, device types, and stereotaxic coordinates.
        </p>
        <p className="empty-state-hint">
          After adding electrode groups, you'll configure channel maps to match your Trodes hardware setup.
        </p>
        <button className="button-primary" onClick={handleAddClick}>
          Add First Electrode Group
        </button>
        <button className="button-secondary" onClick={handleCopyClick}>
          Copy from Existing Animal
        </button>
      </div>
    );
  }

  // Table view
  return (
    <div className="electrode-groups-step">
      <header className="step-header">
        <h2>Step 1: Electrode Groups</h2>
        <p>Configure the electrode groups for this animal.</p>
      </header>

      <div className="table-actions">
        <button className="button-primary" onClick={handleAddClick}>
          + Add Electrode Group
        </button>
        <button className="button-secondary" onClick={handleCopyClick}>
          Copy from Animal
        </button>
      </div>

      <table className="electrode-groups-table">
        <thead>
          <tr>
            <th>ID</th>
            <th>Device Type</th>
            <th>Location</th>
            <th>Channels</th>
            <th>Status</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {electrodeGroups.map((group) => (
            <tr key={group.id}>
              <td data-label="ID">{group.id}</td>
              <td data-label="Device Type">{group.device_type}</td>
              <td data-label="Location">{group.location}</td>
              <td data-label="Channels">{getChannelCount(group.device_type)}</td>
              <td data-label="Status">
                <span className={`status-badge status-${getStatus(group)}`}>
                  {getStatus(group)}
                </span>
              </td>
              <td data-label="Actions">
                <button className="button-small" onClick={() => handleEditClick(group.id)}>Edit</button>
                <button
                  className="button-small button-danger"
                  onClick={() => handleDeleteClick(group)}
                  aria-label={`Delete electrode group ${group.id}`}
                >
                  Delete
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Dialogs will be implemented in next tasks */}
    </div>
  );
}

ElectrodeGroupsStep.propTypes = {
  animal: PropTypes.shape({
    id: PropTypes.string.isRequired,
    devices: PropTypes.shape({
      electrode_groups: PropTypes.arrayOf(PropTypes.object),
      ntrode_electrode_group_channel_map: PropTypes.arrayOf(PropTypes.object),
    })
  }).isRequired,
  onFieldUpdate: PropTypes.func.isRequired,
  onEdit: PropTypes.func,
  onAdd: PropTypes.func,
  onDelete: PropTypes.func,
};

ElectrodeGroupsStep.defaultProps = {
  onEdit: null,
  onAdd: null,
  onDelete: null,
};
