import { useMemo, useCallback, useState } from 'react';
import PropTypes from 'prop-types';
import ReadOnlyDeviceInfo from './ReadOnlyDeviceInfo';
import BadChannelsEditor from './BadChannelsEditor';
import ReconfigWizard from './ReconfigWizard';
import { reconcileAppliedToDays } from '../../state/configDiff';
import { resolveDayConfig } from '../../state/workspaceUtils';
import './DayEditor.scss';

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
 * @param {object[]} [props.animalDays] - The animal's days (sorted by date); enables the
 *   configuration-version indicator + reconfiguration wizard. Omitted in isolated tests.
 * @param {object} [props.actions] - Store actions (`addConfigurationSnapshot`,
 *   `applyConfigurationForward`); when provided, the reconfiguration wizard is available.
 * @returns {JSX.Element}
 */
export default function DevicesStep({ animal, day, mergedDay, onFieldUpdate, animalDays = undefined, actions = undefined }) {
  const [wizardOpen, setWizardOpen] = useState(false);

  // Render the day's EFFECTIVE (pinned) configuration, not live `animal.devices`.
  // On a historical day, `animal.devices` mirrors the *latest* version, so editing
  // bad channels against it would target the wrong ntrode list. `resolveDayConfig`
  // gives the snapshot the day is actually pinned to — matching what the export uses.
  const effectiveConfig = useMemo(() => resolveDayConfig(animal, day), [animal, day]);
  const electrodeGroups = effectiveConfig.electrode_groups;

  // Configuration-version legibility (only when wired with store actions + the
  // animal's days, i.e. inside the real Day Editor — not in isolated unit renders).
  const reconfigEnabled = !!actions && Array.isArray(animalDays) && animalDays.length > 0;

  const reconfig = useMemo(() => {
    if (!reconfigEnabled) return null;
    const version = effectiveConfig.configurationVersion;
    const snapshot = (animal.configurationHistory || []).find((s) => s.version === version) || null;
    const daysById = Object.fromEntries(animalDays.map((d) => [d.id, d]));
    const appliedCount = (reconcileAppliedToDays(animal, daysById)[version] || []).length;
    const idx = animalDays.findIndex((d) => d.id === day.id);
    const prevDay = idx > 0 ? animalDays[idx - 1] : null;
    const candidateDays = idx >= 0 ? animalDays.slice(idx) : [day];
    const history = animal.configurationHistory || [];
    const latestVersion = history.length > 0 ? history[history.length - 1].version : version;
    return { version, snapshot, appliedCount, prevDay, candidateDays, isLatest: version === latestVersion };
  }, [reconfigEnabled, animal, day, animalDays, effectiveConfig.configurationVersion]);

  // Wrap in useMemo to prevent changing on every render
  const ntrodeChannelMap = useMemo(() => {
    return effectiveConfig.ntrode_electrode_group_channel_map || [];
  }, [effectiveConfig.ntrode_electrode_group_channel_map]);

  // Effective bad channels by ntrode ID. `resolveDayConfig` has already applied the
  // day-level replacement semantics onto the pinned snapshot, so this is exactly the
  // channel state export will encode.
  const badChannels = useMemo(() => {
    return Object.fromEntries(
      ntrodeChannelMap.map((ntrode) => [
        String(ntrode.ntrode_id),
        Array.isArray(ntrode.bad_channels) ? ntrode.bad_channels : [],
      ])
    );
  }, [ntrodeChannelMap]);

  /**
   * Get ntrodes for a specific electrode group
   * @param {number|string} groupId - Electrode group ID
   * @returns {Array} Ntrodes belonging to this group
   */
  const getNtrodesForGroup = useCallback((groupId) => {
    return ntrodeChannelMap.filter(ntrode => String(ntrode.electrode_group_id) === String(groupId));
  }, [ntrodeChannelMap]);

  /**
   * Calculate status for an electrode group
   * @param {number|string} groupId - Electrode group ID
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
   * @param {number|string} groupId - Electrode group ID
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
   * @param {number|string} ntrodeId - Ntrode ID
   * @param {number[]} badChannelArray - Array of bad channel numbers
   * @returns {object|null} Error or warning message
   */
  const validateBadChannels = useCallback((ntrodeId, badChannelArray) => {
    const ntrode = ntrodeChannelMap.find(n => String(n.ntrode_id) === String(ntrodeId));
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
      const validation = validateBadChannels(ntrodeId, badChannels[ntrodeId]);
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
          <a href={`#/animal/${animal.id}/editor`} className="button-primary">
            Configure Electrode Groups at Animal Level
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
        <a href={`#/animal/${animal.id}/editor`}>Edit at Animal Level</a>
      </div>

      {/* Configuration-version indicator + reconfiguration entry point. The wizard
          is a sibling of the bar (not nested inside the flex layout div) so the
          dialog is not a descendant of a layout container. */}
      {reconfig && (
        <>
          <div className="config-version-bar">
            <div className="config-version-info">
              <span className="config-version-label">
                Configuration version {reconfig.version}
                {reconfig.snapshot
                  ? `: ${reconfig.snapshot.description || 'No description'} (${reconfig.snapshot.date || 'date unknown'})`
                  : ''}
                <span
                  className={`config-version-tag config-version-tag-${reconfig.isLatest ? 'latest' : 'historical'}`}
                >
                  {reconfig.isLatest ? 'latest' : 'historical'}
                </span>
              </span>
              <span className="config-version-applied">
                {reconfig.isLatest
                  ? 'Editing day-level bad channels against the latest configuration. Probe geometry is edited in the Animal Editor.'
                  : 'This is a historical configuration. You are editing day-level bad channels against a pinned past snapshot, not changing probe geometry.'}
              </span>
              <span className="config-version-applied">
                Applied to {reconfig.appliedCount} {reconfig.appliedCount === 1 ? 'day' : 'days'}
              </span>
            </div>
            <button
              type="button"
              className="config-reconfig-button"
              onClick={() => setWizardOpen(true)}
            >
              Reconfigure devices…
            </button>
          </div>
          <ReconfigWizard
            // Remount per day/version so reopening shows fresh form state.
            key={`${day.id}-${reconfig.version}`}
            isOpen={wizardOpen}
            onClose={() => setWizardOpen(false)}
            animal={animal}
            day={day}
            prevDay={reconfig.prevDay}
            candidateDays={reconfig.candidateDays}
            actions={actions}
          />
        </>
      )}

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
                    <a href={`#/animal/${animal.id}/editor`}>Fix in Animal Editor</a>
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
          ntrode_id: PropTypes.oneOfType([PropTypes.number, PropTypes.string]).isRequired,
          electrode_group_id: PropTypes.oneOfType([PropTypes.number, PropTypes.string]).isRequired,
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
  // animalDays + actions are supplied together by DayEditorStepper to enable the
  // configuration-version indicator and reconfiguration wizard; omitting both (e.g.
  // in isolated unit renders) simply hides that section.
  animalDays: PropTypes.arrayOf(PropTypes.object),
  actions: PropTypes.shape({
    addConfigurationSnapshot: PropTypes.func,
    applyConfigurationForward: PropTypes.func,
  }),
};
