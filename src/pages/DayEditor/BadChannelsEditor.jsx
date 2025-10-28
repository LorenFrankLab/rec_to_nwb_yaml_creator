import { useState } from 'react';
import PropTypes from 'prop-types';

/**
 * BadChannelsEditor - Edit failed channels for electrode groups
 *
 * Allows users to mark which hardware channels have failed on a specific
 * recording day. This is the only day-level device configuration that changes
 * over time (channels fail due to hardware degradation, tissue reactions, etc.).
 *
 * @param {object} props
 * @param {Array} props.ntrodes - Ntrode channel maps for this electrode group
 * @param {object} props.badChannels - Current bad channels: { [ntrodeId]: [channelNumbers] }
 * @param {Function} props.onUpdate - Callback: (ntrodeId, badChannelArray) => void
 * @param {object} props.errors - Validation errors: { [ntrodeId]: errorMessage }
 * @param {object} props.warnings - Validation warnings: { [ntrodeId]: warningMessage }
 * @returns {JSX.Element}
 */
export default function BadChannelsEditor({ ntrodes, badChannels, onUpdate, errors, warnings }) {
  const [expandedMaps, setExpandedMaps] = useState({});

  if (!ntrodes || ntrodes.length === 0) {
    return null;
  }

  /**
   * Handle checkbox change for a channel
   * @param {number} ntrodeId - Ntrode ID
   * @param {number} channelNum - Channel number
   * @param {boolean} isChecked - Whether checkbox is checked
   */
  const handleChannelToggle = (ntrodeId, channelNum, isChecked) => {
    const currentBadChannels = badChannels[ntrodeId] || [];
    let updatedBadChannels;

    if (isChecked) {
      // Add channel to bad channels
      updatedBadChannels = [...currentBadChannels, channelNum].sort((a, b) => a - b);
    } else {
      // Remove channel from bad channels
      updatedBadChannels = currentBadChannels.filter(ch => ch !== channelNum);
    }

    onUpdate(String(ntrodeId), updatedBadChannels);
  };

  /**
   * Toggle channel map visibility
   * @param {number} ntrodeId - Ntrode ID
   */
  const toggleChannelMap = (ntrodeId) => {
    setExpandedMaps(prev => ({
      ...prev,
      [ntrodeId]: !prev[ntrodeId],
    }));
  };

  return (
    <div className="bad-channels-editor">
      <p className="field-help-text">
        Only mark channels with hardware failures. Analysis quality issues should be handled during spike sorting.
      </p>

      {ntrodes.map((ntrode, index) => {
        const ntrodeId = ntrode.ntrode_id;
        const currentBadChannels = badChannels[ntrodeId] || [];
        const channels = Object.keys(ntrode.map).map(Number).sort((a, b) => a - b);
        const error = errors?.[ntrodeId];
        const warning = warnings?.[ntrodeId];

        return (
          <fieldset key={ntrodeId} className="ntrode-fieldset">
            <legend>Shank #{index + 1} (Ntrode ID: {ntrodeId})</legend>

            <div className="failed-channels-section">
              <label htmlFor={`failed-channels-${ntrodeId}`}>Failed Channels</label>

              <div
                id={`failed-channels-${ntrodeId}`}
                className="bad-channels-checkboxes"
                role="group"
                aria-label={`Failed channels for Shank ${index + 1}`}
              >
                {channels.map(channelNum => (
                  <div key={channelNum} className="checkbox-item">
                    <input
                      type="checkbox"
                      id={`channel-${ntrodeId}-${channelNum}`}
                      checked={currentBadChannels.includes(channelNum)}
                      onChange={(e) => handleChannelToggle(ntrodeId, channelNum, e.target.checked)}
                    />
                    <label htmlFor={`channel-${ntrodeId}-${channelNum}`}>
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
                aria-expanded={expandedMaps[ntrodeId] || false}
                aria-controls={`channel-map-${ntrodeId}`}
              >
                <span className="toggle-icon" aria-hidden="true">
                  {expandedMaps[ntrodeId] ? '▼' : '▶'}
                </span>
                View Channel Map
              </button>

              {expandedMaps[ntrodeId] && (
                <div id={`channel-map-${ntrodeId}`} className="channel-map-content">
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
  errors: PropTypes.object,
  warnings: PropTypes.object,
};

BadChannelsEditor.defaultProps = {
  errors: {},
  warnings: {},
};
