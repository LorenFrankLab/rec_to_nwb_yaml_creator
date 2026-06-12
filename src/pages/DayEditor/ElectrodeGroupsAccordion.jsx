import { useCallback } from 'react';
import PropTypes from 'prop-types';
import ReadOnlyDeviceInfo from './ReadOnlyDeviceInfo';
import BadChannelsEditor from './BadChannelsEditor';

/**
 * The per-electrode-group accordion of failed-channel editors. One collapsible `<details>` per
 * electrode group, with a health status badge, the editable {@link BadChannelsEditor} (prioritized
 * at top), and the read-only device configuration. A group with no channel mapping renders a data-
 * corruption notice instead. Extracted verbatim from `pages/DayEditor/DevicesStep.jsx` (Phase 9c-3)
 * with no behavior change — it owns the per-group derivations (ntrodes-for-group / status badge)
 * over the effective channel map + bad-channel state the parent computes.
 *
 * @param {object} props
 * @param {object[]} props.electrodeGroups - The day's EFFECTIVE electrode groups (pinned snapshot).
 * @param {object[]} props.ntrodeChannelMap - The day's EFFECTIVE ntrode channel map.
 * @param {Object<string, number[]>} props.badChannels - Effective bad channels by ntrode id.
 * @param {string} props.ownerKey - The resolved store owner key (animal-editor "Fix" links).
 * @param {Function} props.onBadChannelsUpdate - `(ntrodeId, number[]) => void` per-ntrode write.
 * @param {Function} props.onBadChannelsBatchUpdate - `(map) => void` whole-map atomic write.
 * @param {Object<string, number[]>} props.priorBadByNtrode - Earlier same-config bad channels (un-mark guard).
 * @param {Function} props.onAcknowledgeRemoval - `(ntrodeId, channel) => void` off-export un-mark ack.
 * @param {Object<string, string>} props.errors - Per-ntrode validation errors.
 * @param {Object<string, string>} props.warnings - Per-ntrode validation warnings.
 * @returns {JSX.Element}
 */
export default function ElectrodeGroupsAccordion({
  electrodeGroups,
  ntrodeChannelMap,
  badChannels,
  ownerKey,
  onBadChannelsUpdate,
  onBadChannelsBatchUpdate,
  priorBadByNtrode,
  onAcknowledgeRemoval,
  errors,
  warnings,
}) {
  /**
   * Get ntrodes for a specific electrode group
   * @param {number} groupId - Integer electrode group ID
   * @returns {Array} Ntrodes belonging to this group
   */
  const getNtrodesForGroup = useCallback((groupId) => {
    // electrode_group_id and group ids are integers end-to-end (schema contract).
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
      const ntrodeId = String(ntrode.ntrode_id);
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

  return (
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
                  {/* Channel maps are auto-generated from each electrode group's device_type, so a
                      missing map is fixed on the electrode-groups tab (its owner), not a channel-maps editor. */}
                  <a href={`#/animal/${ownerKey}/electrode-groups?field=electrode_groups`}>Fix in Animal Setup</a>
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
                deviceType={group.device_type}
                badChannels={badChannels}
                onUpdate={onBadChannelsUpdate}
                onBatchUpdate={onBadChannelsBatchUpdate}
                priorBadByNtrode={priorBadByNtrode}
                onAcknowledgeRemoval={onAcknowledgeRemoval}
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
  );
}

ElectrodeGroupsAccordion.propTypes = {
  electrodeGroups: PropTypes.arrayOf(PropTypes.object).isRequired,
  ntrodeChannelMap: PropTypes.arrayOf(PropTypes.object).isRequired,
  badChannels: PropTypes.object.isRequired,
  ownerKey: PropTypes.string,
  onBadChannelsUpdate: PropTypes.func.isRequired,
  onBadChannelsBatchUpdate: PropTypes.func.isRequired,
  priorBadByNtrode: PropTypes.object.isRequired,
  onAcknowledgeRemoval: PropTypes.func.isRequired,
  errors: PropTypes.object.isRequired,
  warnings: PropTypes.object.isRequired,
};

ElectrodeGroupsAccordion.defaultProps = {
  ownerKey: undefined,
};
