import PropTypes from 'prop-types';
import {
  getAnimalElectrodeGroups,
  getConfigHistory,
  getProbeElectrodeGroups,
  getProbeNtrodeMaps,
} from '../../state/workspaceSelectors';
import { animalElectrodeSetupNeedsSync } from '../../domain/workflowStatus';
import { getChannelCount, getShankCount } from '../../utils/deviceTypeUtils';
import './ElectrodeGroupsStep.scss';

/**
 * Per-group completeness status: a decorative icon paired with a screen-reader
 * label so status is never conveyed by color/emoji alone (WCAG 1.4.1).
 */
const STATUS_META = {
  complete: { icon: '✓', label: 'Complete' },
  incomplete: { icon: '❌', label: 'Missing required fields' },
};

/**
 * @param {unknown} value - Candidate required value.
 * @returns {boolean} True when a required text-ish field has real content.
 */
function hasNonBlankValue(value) {
  return value != null && (typeof value !== 'string' || value.trim() !== '');
}

/**
 * @param {unknown} value - Candidate coordinate value.
 * @returns {boolean} True when the coordinate is present and finite.
 */
function hasFiniteCoordinate(value) {
  return value != null && value !== '' && Number.isFinite(Number(value));
}

/**
 * Render a catalog-derived geometry count, distinguishing an UNKNOWN probe (count 0,
 * which never occurs for a real catalogued probe) from a real zero. An em dash makes an
 * uncatalogued device visually distinct rather than reading as "0 channels/shanks".
 *
 * @param {number} count - Channel or shank count from the probe catalog.
 * @returns {number|string} The count, or '—' when 0 (unknown device).
 */
function formatGeometryCount(count) {
  return count > 0 ? count : '—';
}

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
 * @param {Function} [props.onCopy] - Copy from animal click handler
 * @returns {JSX.Element}
 */
export default function ElectrodeGroupsStep({ animal, onFieldUpdate, onEdit, onAdd, onDelete, onCopy }) {
  const electrodeGroups = getAnimalElectrodeGroups(animal);

  /**
   * Compute status badge (✓ complete, ⚠ incomplete, ❌ missing required)
   * @param {object} group
   * @returns {string}
   */
  function getStatusKey(group) {
    // `location` and `description` are optional in the editor (filled in on save),
    // so completeness keys off the fields the scientist must supply.
    const requiredText = ['device_type', 'targeted_location', 'units'];
    const hasRequired = (
      requiredText.every(field => hasNonBlankValue(group[field])) &&
      hasFiniteCoordinate(group.targeted_x) &&
      hasFiniteCoordinate(group.targeted_y) &&
      hasFiniteCoordinate(group.targeted_z)
    );
    return hasRequired ? 'complete' : 'incomplete';
  }

  /**
   * Handle add button click
   */
  const handleAddClick = () => {
    if (onAdd) {
      onAdd();
    }
  };

  /**
   * Handle copy button click
   */
  const handleCopyClick = () => {
    if (onCopy) {
      onCopy();
    }
  };

  /**
   * Handle edit button click
   * @param {number} groupId - Electrode group id.
   */
  const handleEditClick = (groupId) => {
    if (onEdit) {
      onEdit(groupId);
    }
  };

  /**
   * Handle delete button click
   * @param {object} group - Electrode group to delete.
   */
  const handleDeleteClick = (group) => {
    if (onDelete) {
      onDelete(group);
    }
  };

  // Mirror-divergence repair state: the saved configuration HAS electrode geometry but the
  // editable mirror (animal.devices) is empty (recovered/imported data). Offer a safe re-sync
  // instead of the blank "add your first group" state — adding a group here would OVERWRITE the
  // saved snapshot via the devices→snapshot mirror.
  if (animalElectrodeSetupNeedsSync(animal)) {
    const latest = getConfigHistory(animal).slice(-1)[0];
    const snapshotGroups = getProbeElectrodeGroups(latest?.devices);
    const handleLoadSaved = () => {
      onFieldUpdate('devices', {
        electrode_groups: snapshotGroups,
        ntrode_electrode_group_channel_map: getProbeNtrodeMaps(latest?.devices),
      });
    };
    return (
      <div className="electrode-groups-step">
        <section className="raw-corruption-banner" role="alert" aria-label="Electrode setup needs repair">
          <p className="field-help-text">
            This animal&apos;s saved configuration has {snapshotGroups.length} electrode{' '}
            {snapshotGroups.length === 1 ? 'group' : 'groups'} that {snapshotGroups.length === 1 ? 'is' : 'are'} not
            loaded for editing. Load the saved configuration to review or edit it — adding new
            groups here instead would replace the saved configuration.
          </p>
          <button type="button" className="button-primary" onClick={handleLoadSaved}>
            Load saved electrode configuration
          </button>
        </section>
      </div>
    );
  }

  // Empty state
  if (electrodeGroups.length === 0) {
    return (
      <div className="electrode-groups-step empty-state">
        <div className="empty-state-icon" aria-hidden="true">🔌</div>
        <h2>No Electrode Groups Configured</h2>
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
            <th>Shanks</th>
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
              <td data-label="Channels">{formatGeometryCount(getChannelCount(group.device_type))}</td>
              <td data-label="Shanks">{formatGeometryCount(getShankCount(group.device_type))}</td>
              <td data-label="Status">
                {(() => {
                  const key = getStatusKey(group);
                  const meta = STATUS_META[key];
                  return (
                    <span className={`status-badge status-${key}`} role="img" aria-label={meta.label}>
                      <span aria-hidden="true">{meta.icon}</span>
                    </span>
                  );
                })()}
              </td>
              <td data-label="Actions">
                <button
                  className="button-small"
                  onClick={() => handleEditClick(group.id)}
                  aria-label={`Edit electrode group ${group.id}`}
                >
                  Edit
                </button>
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
  onCopy: PropTypes.func,
};

ElectrodeGroupsStep.defaultProps = {
  onEdit: null,
  onAdd: null,
  onDelete: null,
  onCopy: null,
};
