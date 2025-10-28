import PropTypes from 'prop-types';
import { getChannelCount } from '../../utils/deviceTypeUtils';

/**
 * ChannelMapsStep - Step 2 of Animal Editor
 *
 * Provides read-only table view of channel map summaries for all electrode groups.
 *
 * @param {object} props
 * @param {object} props.animal - Animal record with devices.electrode_groups and ntrode_electrode_group_channel_map
 * @param {Function} props.onEditChannelMap - Callback to open editor for specific group
 * @returns {JSX.Element}
 */
export default function ChannelMapsStep({ animal, onEditChannelMap }) {
  const electrodeGroups = animal.devices?.electrode_groups || [];
  const channelMaps = animal.devices?.ntrode_electrode_group_channel_map || [];

  /**
   * Calculate map status for an electrode group
   * @param {object} group - Electrode group
   * @returns {string} - Status badge: ✓ (all mapped), ⚠ (partial), ❌ (unmapped)
   */
  function getMapStatus(group) {
    const expectedChannels = getChannelCount(group.device_type);

    // Get all ntrode maps for this electrode group
    const groupMaps = channelMaps.filter(
      (map) => map.electrode_group_id === group.id
    );

    if (groupMaps.length === 0) {
      return '❌'; // No maps at all
    }

    // Count total mapped channels
    let mappedChannels = 0;
    groupMaps.forEach((map) => {
      if (map.map) {
        mappedChannels += Object.keys(map.map).length;
      }
    });

    if (mappedChannels === 0) {
      return '❌'; // No channels mapped
    } else if (mappedChannels >= expectedChannels) {
      return '✓'; // All channels mapped
    } else {
      return '⚠'; // Partially mapped
    }
  }

  /**
   * Handle edit button click
   * @param {number} groupId - Electrode group ID
   */
  const handleEditClick = (groupId) => {
    if (onEditChannelMap) {
      onEditChannelMap(groupId);
    }
  };

  // Empty state
  if (electrodeGroups.length === 0) {
    return (
      <div className="channel-maps-step empty-state">
        <div className="empty-state-icon">🗺️</div>
        <h3>No Electrode Groups Configured</h3>
        <p>
          Add electrode groups in Step 1 before configuring channel maps.
        </p>
      </div>
    );
  }

  // Table view
  return (
    <div className="channel-maps-step" data-testid="channel-maps-step">
      <header className="step-header">
        <h2>Step 2: Channel Maps</h2>
        <p>Configure channel mappings for each electrode group.</p>
      </header>

      <table className="channel-maps-table">
        <thead>
          <tr>
            <th>ID</th>
            <th>Device Type</th>
            <th>Location</th>
            <th>Channels</th>
            <th>Map Status</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {electrodeGroups.map((group) => (
            <tr key={group.id}>
              <td>{group.id}</td>
              <td>{group.device_type}</td>
              <td>{group.location}</td>
              <td>{getChannelCount(group.device_type)}</td>
              <td>
                <span className={`status-badge status-${getMapStatus(group)}`}>
                  {getMapStatus(group)}
                </span>
              </td>
              <td>
                <button
                  className="button-small"
                  onClick={() => handleEditClick(group.id)}
                  aria-label={`Edit channel map for electrode group ${group.id}`}
                  data-testid={`edit-channel-map-${group.id}`}
                >
                  Edit
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

ChannelMapsStep.propTypes = {
  animal: PropTypes.shape({
    id: PropTypes.string.isRequired,
    devices: PropTypes.shape({
      electrode_groups: PropTypes.arrayOf(PropTypes.object),
      ntrode_electrode_group_channel_map: PropTypes.arrayOf(PropTypes.object),
    })
  }).isRequired,
  onEditChannelMap: PropTypes.func.isRequired,
};
