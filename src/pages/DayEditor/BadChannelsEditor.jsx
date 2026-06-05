import { useState } from 'react';
import PropTypes from 'prop-types';
import { getProbeShanks, getProbeElectrodeIds } from '../../ntrode/probeCatalog';
import './DayEditor.scss';

/**
 * BadChannelsEditor - Edit failed channels for electrode groups
 *
 * Allows users to mark which hardware channels have failed on a specific
 * recording day. This is the only day-level device configuration that changes
 * over time (channels fail due to hardware degradation, tissue reactions, etc.).
 *
 * MULTI-SHANK CONTRACT (converter truth): trodes_to_nwb reads `bad_channels` ONLY
 * from an electrode group's FIRST ntrode row and interprets them as PROBE-LOCAL
 * electrode indices `0..N-1` spanning ALL shanks (convert_yaml.add_electrode_groups).
 * A row-local per-shank UI therefore cannot reach a valid bad channel like `42` on
 * shank 3 of a 64c-3s probe. So for a MULTI-shank group we present ONE selector over
 * the probe's full electrode-id range (`getProbeElectrodeIds`) and write the whole
 * selection to the FIRST ntrode row's id — exactly what the converter honors, and the
 * shape the `multishank_bad_channels_ignored` rule expects. Single-shank groups keep
 * the per-row checkbox behavior (row-local == probe-local for one shank).
 *
 * @param {object} props
 * @param {Array} props.ntrodes - Ntrode channel maps for this electrode group
 * @param {object} props.badChannels - Current bad channels: { [ntrodeId]: [channelNumbers] }
 * @param {Function} props.onUpdate - Callback: (ntrodeId, badChannelArray) => void
 * @param {string} [props.deviceType] - The electrode group's device type; enables the
 *   probe-wide selector for multi-shank probes (via the verified probe catalog).
 * @param {object} props.errors - Validation errors: { [ntrodeId]: errorMessage }
 * @param {object} props.warnings - Validation warnings: { [ntrodeId]: warningMessage }
 * @returns {JSX.Element}
 */
export default function BadChannelsEditor({ ntrodes, badChannels, onUpdate, deviceType, errors, warnings }) {
  const [expandedMaps, setExpandedMaps] = useState({});

  if (!ntrodes || ntrodes.length === 0) {
    return null;
  }

  // Multi-shank iff the verified catalog reports >1 shank for this device. We also
  // require >1 ntrode row so a 1-row group never collapses to a degenerate selector.
  const probeShanks = getProbeShanks(deviceType);
  const isMultiShank = probeShanks.length > 1 && ntrodes.length > 1;

  /**
   * Handle checkbox change for a channel
   * @param {number|string} ntrodeId - Ntrode ID
   * @param {number} channelNum - Channel number
   * @param {boolean} isChecked - Whether checkbox is checked
   */
  const handleChannelToggle = (ntrodeId, channelNum, isChecked) => {
    const key = String(ntrodeId);
    const currentBadChannels = badChannels[key] || [];
    let updatedBadChannels;

    if (isChecked) {
      // Add channel to bad channels
      updatedBadChannels = [...currentBadChannels, channelNum].sort((a, b) => a - b);
    } else {
      // Remove channel from bad channels
      updatedBadChannels = currentBadChannels.filter(ch => ch !== channelNum);
    }

    onUpdate(key, updatedBadChannels);
  };

  /**
   * Toggle channel map visibility
   * @param {number|string} ntrodeId - Ntrode ID
   */
  const toggleChannelMap = (ntrodeId) => {
    const key = String(ntrodeId);
    setExpandedMaps(prev => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  // ── Multi-shank: ONE probe-wide selector written to the FIRST ntrode row. ──
  if (isMultiShank) {
    const firstNtrode = ntrodes[0];
    const firstKey = String(firstNtrode.ntrode_id);
    const electrodeIds = getProbeElectrodeIds(deviceType); // 0 … N-1
    const currentBadChannels = badChannels[firstKey] || [];
    const error = errors?.[firstKey];
    const warning = warnings?.[firstKey];

    return (
      <div className="bad-channels-editor">
        <p className="field-help-text">
          Only mark channels with hardware failures. Analysis quality issues should be handled during spike sorting.
        </p>
        <p className="field-help-text">
          This multi-shank probe is mapped by a single probe-local electrode index spanning
          all shanks. trodes_to_nwb reads failed channels from one list for the whole group.
        </p>

        <fieldset className="ntrode-fieldset">
          <legend>Failed Electrodes (probe-local 0–{electrodeIds.length - 1})</legend>

          <div className="failed-channels-section">
            <div
              id={`failed-channels-${firstKey}`}
              className="bad-channels-checkboxes"
              role="group"
              aria-label="Failed electrodes for this multi-shank probe"
            >
              {electrodeIds.map((electrodeId) => (
                <div key={electrodeId} className="checkbox-item">
                  <input
                    type="checkbox"
                    id={`electrode-${firstKey}-${electrodeId}`}
                    checked={currentBadChannels.includes(electrodeId)}
                    onChange={(e) => handleChannelToggle(firstNtrode.ntrode_id, electrodeId, e.target.checked)}
                  />
                  <label htmlFor={`electrode-${firstKey}-${electrodeId}`}>
                    Electrode {electrodeId}
                  </label>
                </div>
              ))}
            </div>

            {error && (
              <span className="validation-error" role="alert">
                {error}
              </span>
            )}

            {warning && (
              <span className="validation-warning" role="alert">
                {warning}
              </span>
            )}
          </div>
        </fieldset>
      </div>
    );
  }

  return (
    <div className="bad-channels-editor">
      <p className="field-help-text">
        Only mark channels with hardware failures. Analysis quality issues should be handled during spike sorting.
      </p>

      {ntrodes.map((ntrode, index) => {
        const ntrodeId = ntrode.ntrode_id;
        const ntrodeKey = String(ntrodeId);
        const currentBadChannels = badChannels[ntrodeKey] || [];
        const channels = Object.keys(ntrode.map).map(Number).sort((a, b) => a - b);
        const error = errors?.[ntrodeKey];
        const warning = warnings?.[ntrodeKey];

        return (
          <fieldset key={ntrodeKey} className="ntrode-fieldset">
            <legend>Shank #{index + 1} (Ntrode ID: {ntrodeId})</legend>

            <div className="failed-channels-section">
              <label htmlFor={`failed-channels-${ntrodeKey}`}>Failed Channels</label>

              <div
                id={`failed-channels-${ntrodeKey}`}
                className="bad-channels-checkboxes"
                role="group"
                aria-label={`Failed channels for Shank ${index + 1}`}
              >
                {channels.map(channelNum => (
                  <div key={channelNum} className="checkbox-item">
                    <input
                      type="checkbox"
                      id={`channel-${ntrodeKey}-${channelNum}`}
                      checked={currentBadChannels.includes(channelNum)}
                      onChange={(e) => handleChannelToggle(ntrodeId, channelNum, e.target.checked)}
                    />
                    <label htmlFor={`channel-${ntrodeKey}-${channelNum}`}>
                      Channel {channelNum}
                    </label>
                  </div>
                ))}
              </div>

              {error && (
                <span className="validation-error" role="alert">
                  {error}
                </span>
              )}

              {warning && (
                <span className="validation-warning" role="alert">
                  {warning}
                </span>
              )}
            </div>

            {/* Collapsible channel map for reference */}
            <div className="channel-map-reference">
              <button
                type="button"
                className="channel-map-toggle"
                onClick={() => toggleChannelMap(ntrodeId)}
                aria-expanded={expandedMaps[ntrodeKey] || false}
                aria-controls={`channel-map-${ntrodeKey}`}
              >
                <span className="toggle-icon" aria-hidden="true">
                  {expandedMaps[ntrodeKey] ? '▼' : '▶'}
                </span>
                View Channel Map
              </button>

              {expandedMaps[ntrodeKey] && (
                <div id={`channel-map-${ntrodeKey}`} className="channel-map-content">
                  <table className="channel-map-table">
                    <thead>
                      <tr>
                        <th>Electrode</th>
                        <th>Hardware Channel</th>
                      </tr>
                    </thead>
                    <tbody>
                      {channels.map(channelNum => (
                        <tr key={channelNum}>
                          <td>{channelNum}</td>
                          <td>{ntrode.map[channelNum]}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </fieldset>
        );
      })}
    </div>
  );
}

BadChannelsEditor.propTypes = {
  ntrodes: PropTypes.arrayOf(
    PropTypes.shape({
      ntrode_id: PropTypes.number.isRequired,
      electrode_group_id: PropTypes.number.isRequired,
      bad_channels: PropTypes.arrayOf(PropTypes.number),
      map: PropTypes.objectOf(PropTypes.number).isRequired,
    })
  ).isRequired,
  badChannels: PropTypes.objectOf(PropTypes.arrayOf(PropTypes.number)).isRequired,
  onUpdate: PropTypes.func.isRequired,
  deviceType: PropTypes.string,
  errors: PropTypes.object,
  warnings: PropTypes.object,
};

BadChannelsEditor.defaultProps = {
  deviceType: undefined,
  errors: {},
  warnings: {},
};
