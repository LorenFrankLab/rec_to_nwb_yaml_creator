import { useCallback } from 'react';
import ReadOnlyDeviceInfo from './ReadOnlyDeviceInfo';
import BadChannelsEditor from './BadChannelsEditor';
import type { ElectrodeGroup, NtrodeMap } from '../../state/workspaceTypes';

interface ElectrodeGroupsAccordionProps {
  /** The day's EFFECTIVE electrode groups (pinned snapshot). */
  electrodeGroups: ElectrodeGroup[];
  /** The day's EFFECTIVE ntrode channel map. */
  ntrodeChannelMap: NtrodeMap[];
  /** Effective bad channels by ntrode id. */
  badChannels: Record<string, number[]>;
  /** The resolved store owner key (animal-editor "Fix" links). */
  ownerKey?: string;
  /** `(ntrodeId, number[]) => void` per-ntrode write. */
  onBadChannelsUpdate: (ntrodeId: string, badChannels: number[]) => void;
  /** `(map) => void` whole-map atomic write. */
  onBadChannelsBatchUpdate: (map: Record<string, number[]>) => void;
  /** Earlier same-config bad channels (un-mark guard). */
  priorBadByNtrode: Record<string, number[]>;
  /** `(ntrodeId, channel) => void` off-export un-mark ack. */
  onAcknowledgeRemoval: (ntrodeId: string, channel: number) => void;
  /** Per-ntrode validation errors. */
  errors: Record<string, string>;
  /** Per-ntrode validation warnings. */
  warnings: Record<string, string>;
}

/**
 * The per-electrode-group accordion of failed-channel editors. One collapsible `<details>` per
 * electrode group, with a health status badge, the editable {@link BadChannelsEditor} (prioritized
 * at top), and the read-only device configuration. A group with no channel mapping renders a data-
 * corruption notice instead. Extracted verbatim from `pages/DayEditor/DevicesStep.jsx` (Phase 9c-3)
 * with no behavior change — it owns the per-group derivations (ntrodes-for-group / status badge)
 * over the effective channel map + bad-channel state the parent computes.
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
}: ElectrodeGroupsAccordionProps) {
  /**
   * Get ntrodes for a specific electrode group.
   */
  const getNtrodesForGroup = useCallback((groupId: number) => {
    // electrode_group_id and group ids are integers end-to-end (schema contract).
    return ntrodeChannelMap.filter(ntrode => ntrode.electrode_group_id === groupId);
  }, [ntrodeChannelMap]);

  /**
   * Calculate status for an electrode group.
   */
  const getGroupStatus = useCallback((groupId: number) => {
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
   * Get status badge text and aria-label.
   */
  const getStatusBadge = useCallback((groupId: number) => {
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

