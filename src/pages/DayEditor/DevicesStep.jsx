import { useMemo, useCallback } from 'react';
import PropTypes from 'prop-types';
import ReadOnlyDeviceInfo from './ReadOnlyDeviceInfo';
import BadChannelsEditor from './BadChannelsEditor';

/**
 * DevicesStep - Devices configuration step (Step 2 of Day Editor)
 *
 * Displays inherited electrode group configuration from animal level and allows
 * editing of day-specific bad channels. This is the only device configuration
 * that changes day-to-day as hardware channels fail over time.
 *
 * Design: Accordion/collapsible sections (one per electrode group)
 * - All groups collapsed by default
 * - Status badges show health at-a-glance
 * - Failed channels editor prioritized (editable content first)
 * - Device config collapsible (secondary reference info)
 *
 * @param {object} props
 * @param {object} props.animal - Animal record (read-only context)
 * @param {object} props.day - Day record (editable)
 * @param {object} props.mergedDay - Merged animal + day for validation
 * @param {Function} props.onFieldUpdate - Callback: (fieldPath, value) => void
 * @returns {JSX.Element}
 */
export default function DevicesStep({ animal, day, mergedDay, onFieldUpdate }) {
  const electrodeGroups = animal.devices?.electrode_groups || [];

  // Wrap in useMemo to prevent changing on every render
  const ntrodeChannelMap = useMemo(() => {
    return animal.devices?.ntrode_electrode_group_channel_map || [];
  }, [animal.devices?.ntrode_electrode_group_channel_map]);

  // Get bad channels for current day (with safe fallback)
  const badChannels = useMemo(() => {
    return day.deviceOverrides?.bad_channels || {};
  }, [day.deviceOverrides?.bad_channels]);

  /**
   * Get ntrodes for a specific electrode group
   * @param {number} groupId - Electrode group ID
   * @returns {Array} Ntrodes belonging to this group
   */
  const getNtrodesForGroup = useCallback((groupId) => {
    return ntrodeChannelMap.filter(ntrode => ntrode.electrode_group_id === groupId);
  }, [ntrodeChannelMap]);

  /**
   * Calculate status for an electrode group
   * @param {number} groupId - Electrode group ID
   * @returns {object} { status: 'clean'|'warning'|'error', badChannelCount: number, allBad: boolean }
   */
  const getGroupStatus = useCallback((groupId) => {
    const ntrodes = getNtrodesForGroup(groupId);
    let totalBadChannels = 0;
    let totalChannels = 0;

    ntrodes.forEach(ntrode => {
      const ntrodeId = ntrode.ntrode_id;
      const currentBadChannels = badChannels[ntrodeId] || [];
      const channelCount = Object.keys(ntrode.map).length;

      totalBadChannels += currentBadChannels.length;
      totalChannels += channelCount;
    });

    const allBad = totalChannels > 0 && totalBadChannels === totalChannels;

    return {
      status: allBad ? 'error' : totalBadChannels > 0 ? 'warning' : 'clean',
      badChannelCount: totalBadChannels,
      allBad,
    };
  }, [badChannels, getNtrodesForGroup]);

  /**
   * Get status badge text and aria-label
   * @param {number} groupId - Electrode group ID
   * @returns {object} { text: string, ariaLabel: string, className: string }
   */
  const getStatusBadge = useCallback((groupId) => {
    const { badChannelCount, allBad } = getGroupStatus(groupId);

    if (allBad) {
      return {
        text: '⚠ All channels failed - Group inactive',
        ariaLabel: 'Status: All channels failed - Group inactive',
        className: 'status-error',
      };
    }

    if (badChannelCount > 0) {
      return {
        text: `⚠ ${badChannelCount} failed ${badChannelCount === 1 ? 'channel' : 'channels'}`,
        ariaLabel: `Status: ${badChannelCount} failed ${badChannelCount === 1 ? 'channel' : 'channels'}`,
        className: 'status-warning',
      };
    }

    return {
      text: '✓ All channels OK',
      ariaLabel: 'Status: All channels OK',
      className: 'status-clean',
    };
  }, [getGroupStatus]);

  /**
   * Handle bad channels update
   * @param {string} ntrodeId - Ntrode ID
   * @param {number[]} badChannelArray - Array of bad channel numbers
   */
  const handleBadChannelsUpdate = useCallback((ntrodeId, badChannelArray) => {
    onFieldUpdate(`deviceOverrides.bad_channels.${ntrodeId}`, badChannelArray);
  }, [onFieldUpdate]);

  /**
   * Validate bad channels
   * @param {number} ntrodeId - Ntrode ID
   * @param {number[]} badChannelArray - Array of bad channel numbers
   * @returns {object|null} Error or warning message
   */
  const validateBadChannels = useCallback((ntrodeId, badChannelArray) => {
    const ntrode = ntrodeChannelMap.find(n => n.ntrode_id === ntrodeId);
    if (!ntrode) return null;

    const validChannels = Object.keys(ntrode.map).map(Number);
    const invalidChannels = badChannelArray.filter(ch => !validChannels.includes(ch));

    if (invalidChannels.length > 0) {
      return {
        type: 'error',
        message: `Invalid channels: ${invalidChannels.join(', ')}. Valid channels are: ${validChannels.join(', ')}`,
      };
    }

    // Warning: All channels marked as bad
    if (badChannelArray.length === validChannels.length && badChannelArray.length > 0) {
      return {
        type: 'warning',
        message: `All ${badChannelArray.length} channels marked as failed. This electrode group will be excluded from analysis. Confirm this is intentional.`,
      };
    }

    return null;
  }, [ntrodeChannelMap]);

  // Compute validation errors and warnings
  const { errors, warnings } = useMemo(() => {
    const errors = {};
    const warnings = {};

    Object.keys(badChannels).forEach(ntrodeId => {
      const validation = validateBadChannels(Number(ntrodeId), badChannels[ntrodeId]);
      if (validation) {
        if (validation.type === 'error') {
          errors[ntrodeId] = validation.message;
        } else if (validation.type === 'warning') {
          warnings[ntrodeId] = validation.message;
        }
      }
    });

    return { errors, warnings };
  }, [badChannels, validateBadChannels]);

  // Empty state: No electrode groups
  if (electrodeGroups.length === 0) {
    return (
      <div className="devices-step">
        <h2>Devices Configuration</h2>
        <div className="empty-state">
          <p>No electrode groups configured for {animal.id}</p>
          <p className="empty-state-hint">
            Electrode groups are configured at the animal level and inherited by all days.
          </p>
          <a href="#/legacy" className="button-primary">
            Configure Electrode Groups (Legacy Editor)
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="devices-step">
      <h2>Devices Configuration</h2>

      {/* Inherited notice */}
      <div className="inherited-notice">
        Device configuration inherited from Animal
        <a href="#/legacy">Edit Animal (Legacy Editor)</a>
      </div>

      {/* Electrode groups (accordion) */}
      <section className="electrode-groups-section" aria-label="Electrode Groups">
        {electrodeGroups.map((group) => {
          const ntrodes = getNtrodesForGroup(group.id);
          const statusBadge = getStatusBadge(group.id);
          const ntrodeCount = ntrodes.length;

          // Check if this group has missing ntrode maps (data corruption)
          if (ntrodes.length === 0) {
            return (
              <details key={group.id} className="electrode-group-details">
                <summary className="electrode-group-summary">
                  <span className="electrode-group-label">
                    <span className="toggle-icon" aria-hidden="true">▶</span>
                    Electrode Group {group.id}: {group.location}
                  </span>
                  <span className="status-badge status-error" role="status" aria-label="Status: Error">
                    ⚠ No channel mapping
                  </span>
                </summary>

                <div className="electrode-group-content">
                  <div className="error-state-inline">
                    <p>⚠ No channel mapping found for this electrode group.</p>
                    <p>This usually indicates data corruption. Please review animal configuration.</p>
                    <a href="#/legacy">Fix in Animal Editor (Legacy)</a>
                  </div>
                </div>
              </details>
            );
          }

          return (
            <details key={group.id} className="electrode-group-details">
              <summary className="electrode-group-summary">
                <span className="electrode-group-label">
                  <span className="toggle-icon" aria-hidden="true">▶</span>
                  Electrode Group {group.id}: {group.location}
                </span>
                <span
                  className={`status-badge ${statusBadge.className}`}
                  role="status"
                  aria-label={statusBadge.ariaLabel}
                >
                  <span aria-hidden="true">
                    {statusBadge.text.split(' ')[0]}
                  </span>
                  {' '}
                  {statusBadge.text.split(' ').slice(1).join(' ')}
                </span>
              </summary>

              <div className="electrode-group-content">
                {/* Explanatory header */}
                <div className="electrode-group-header">
                  <h3>Electrode Group {group.id}: {group.location}</h3>
                  <p className="field-help-text">
                    This {group.device_type} has {ntrodeCount} {ntrodeCount === 1 ? 'shank' : 'shanks'}.
                    Mark individual channels that have failed on each shank.
                  </p>
                </div>

                {/* Failed Channels Editor (EDITABLE - prioritized at top) */}
                <BadChannelsEditor
                  ntrodes={ntrodes}
                  badChannels={badChannels}
                  onUpdate={handleBadChannelsUpdate}
                  errors={errors}
                  warnings={warnings}
                />

                {/* Device Configuration (READ-ONLY - collapsible, secondary) */}
                <details className="device-config-details">
                  <summary className="device-config-toggle">
                    <span className="toggle-icon" aria-hidden="true">▶</span>
                    View Device Configuration
                  </summary>
                  <ReadOnlyDeviceInfo group={group} />
                </details>
              </div>
            </details>
          );
        })}
      </section>
    </div>
  );
}

DevicesStep.propTypes = {
  animal: PropTypes.shape({
    id: PropTypes.string.isRequired,
    devices: PropTypes.shape({
      electrode_groups: PropTypes.arrayOf(
        PropTypes.shape({
          id: PropTypes.number.isRequired,
          location: PropTypes.string.isRequired,
          device_type: PropTypes.string.isRequired,
          description: PropTypes.string.isRequired,
          targeted_location: PropTypes.string.isRequired,
          targeted_x: PropTypes.number.isRequired,
          targeted_y: PropTypes.number.isRequired,
          targeted_z: PropTypes.number.isRequired,
          units: PropTypes.string.isRequired,
        })
      ),
      ntrode_electrode_group_channel_map: PropTypes.arrayOf(
        PropTypes.shape({
          ntrode_id: PropTypes.number.isRequired,
          electrode_group_id: PropTypes.number.isRequired,
          bad_channels: PropTypes.arrayOf(PropTypes.number),
          map: PropTypes.objectOf(PropTypes.number).isRequired,
        })
      ),
    }),
  }).isRequired,
  day: PropTypes.shape({
    id: PropTypes.string.isRequired,
    animalId: PropTypes.string.isRequired,
    date: PropTypes.string.isRequired,
    deviceOverrides: PropTypes.shape({
      bad_channels: PropTypes.object,
    }),
  }).isRequired,
  mergedDay: PropTypes.object.isRequired,
  onFieldUpdate: PropTypes.func.isRequired,
};
