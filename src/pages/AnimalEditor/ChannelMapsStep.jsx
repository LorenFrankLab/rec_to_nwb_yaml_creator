import PropTypes from 'prop-types';
import { getAnimalElectrodeGroups, getAnimalNtrodeMaps } from '../../state/workspaceSelectors';
import { getChannelCount, getShankCount } from '../../utils/deviceTypeUtils';
import './ChannelMapsStep.scss';

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
 * ChannelMapsStep - the Channel Maps section of the Animal Editor.
 *
 * Provides read-only table view of channel map summaries for all electrode groups —
 * the channel→position mapping status and the bad-channel count per group.
 *
 * @param {object} props
 * @param {object} props.animal - Animal record with devices.electrode_groups and ntrode_electrode_group_channel_map
 * @param {Function} props.onEditChannelMap - Callback to open editor for specific group
 * @returns {JSX.Element}
 */
export default function ChannelMapsStep({ animal, onEditChannelMap }) {
  const electrodeGroups = getAnimalElectrodeGroups(animal);
  const channelMaps = getAnimalNtrodeMaps(animal);

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
   * Count channels marked bad for an electrode group, summed across its ntrode maps.
   * Bad channels are probe-local indices excluded from downstream analysis.
   * @param {object} group - Electrode group
   * @returns {number} Total bad-channel count for the group (0 when none/unmapped).
   */
  function getBadChannelCount(group) {
    return channelMaps
      .filter((map) => map.electrode_group_id === group.id)
      .reduce(
        (sum, map) => sum + (Array.isArray(map.bad_channels) ? map.bad_channels.length : 0),
        0
      );
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
          Add electrode groups before mapping channels and marking bad channels.
        </p>
      </div>
    );
  }

  // Table view
  return (
    <div className="channel-maps-step" data-testid="channel-maps-step">
      <header className="step-header">
        <h2>Channel Maps</h2>
        <p>
          Map each probe channel to its electrode position, and mark dead/bad channels. The map
          records which hardware channel reads which contact on the probe; bad channels are the
          ones to exclude from analysis.
        </p>
        <div className="badge-legend">
          <span><span className="status-badge status-✓" aria-label="All channels mapped">✓</span> All channels mapped</span>
          <span><span className="status-badge status-⚠" aria-label="Partially mapped">⚠</span> Partially mapped</span>
          <span><span className="status-badge status-❌" aria-label="Not mapped">❌</span> Not mapped</span>
        </div>
      </header>

      <table className="channel-maps-table">
        <thead>
          <tr>
            <th>ID</th>
            <th>Device Type</th>
            <th>Location</th>
            <th>Channels</th>
            <th>Shanks</th>
            <th>Map Status</th>
            <th>Bad Channels</th>
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
              <td data-label="Map Status">
                <span className={`status-badge status-${getMapStatus(group)}`}>
                  {getMapStatus(group)}
                </span>
              </td>
              {/* Denominator is the catalog per-group channel count (same basis as the Channels
                  column), NOT the count of currently-mapped channels — keep these consistent so a
                  future edit doesn't switch one to summing ntrode map sizes. */}
              <td data-label="Bad Channels">
                {getBadChannelCount(group)} bad / {formatGeometryCount(getChannelCount(group.device_type))}
              </td>
              <td data-label="Actions">
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
