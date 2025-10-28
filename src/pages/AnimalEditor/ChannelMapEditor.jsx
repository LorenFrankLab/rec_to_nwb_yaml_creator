import React, { useState } from 'react';
import PropTypes from 'prop-types';
import { deviceTypeMap } from '../../ntrode/deviceTypes';
import './ChannelMapEditor.scss';

/**
 * ChannelMapEditor - Editor for ntrode channel maps for a specific electrode group
 *
 * Allows users to configure the mapping between logical electrode channels
 * (from Trodes) and hardware channel IDs.
 *
 * Features:
 * - Display electrode group header with ID, device type, and location
 * - Edit electrode_id for each ntrode
 * - Edit bad_channels checkbox for each channel
 * - Edit channel map values (hardware channel numbers)
 * - Save/Cancel buttons
 *
 * @param {object} props Component properties
 * @param {object} props.electrodeGroup Electrode group being edited
 * @param {Array} props.channelMaps Array of ntrode channel map objects for this group
 * @param {Function} props.onSave Callback with updated channel maps when saved
 * @param {Function} props.onCancel Callback to close editor without saving
 *
 * @returns {JSX.Element} Channel map editor component
 */
const ChannelMapEditor = ({ electrodeGroup, channelMaps, onSave, onCancel }) => {
  // Local state for editing channel maps
  const [localChannelMaps, setLocalChannelMaps] = useState(
    JSON.parse(JSON.stringify(channelMaps))
  );

  // Get channel array for this device type (e.g., [0,1,2,3] for tetrode)
  const channelArray = deviceTypeMap(electrodeGroup.device_type);

  // Handle electrode_id change
  const handleElectrodeIdChange = (ntrodeIndex, value) => {
    const updated = [...localChannelMaps];
    updated[ntrodeIndex].electrode_id = parseInt(value, 10) || 0;
    setLocalChannelMaps(updated);
  };

  // Handle channel map value change
  const handleChannelMapChange = (ntrodeIndex, channelIndex, value) => {
    const updated = [...localChannelMaps];
    updated[ntrodeIndex].map[channelIndex] = parseInt(value, 10) || 0;
    setLocalChannelMaps(updated);
  };

  // Handle bad_channels checkbox toggle
  const handleBadChannelToggle = (ntrodeIndex, channelIndex) => {
    const updated = [...localChannelMaps];
    const badChannels = updated[ntrodeIndex].bad_channels || [];

    const channelIndexInBadChannels = badChannels.indexOf(channelIndex);
    if (channelIndexInBadChannels > -1) {
      // Remove from bad_channels
      updated[ntrodeIndex].bad_channels = badChannels.filter((ch) => ch !== channelIndex);
    } else {
      // Add to bad_channels
      updated[ntrodeIndex].bad_channels = [...badChannels, channelIndex];
    }

    setLocalChannelMaps(updated);
  };

  // Check if channel is marked as bad
  const isChannelBad = (ntrodeIndex, channelIndex) => {
    const badChannels = localChannelMaps[ntrodeIndex]?.bad_channels || [];
    return badChannels.includes(channelIndex);
  };

  // Handle Save button click
  const handleSave = () => {
    onSave(localChannelMaps);
  };

  // Handle Cancel button click
  const handleCancel = () => {
    onCancel();
  };

  // Handle edge case: no channel maps
  if (!channelMaps || channelMaps.length === 0) {
    return (
      <div className="channel-map-editor">
        <div className="channel-map-editor-header">
          <h2>Channel Map Editor</h2>
          <div className="electrode-group-info">
            <span>Electrode Group: {electrodeGroup.id}</span>
            <span>Device Type: {electrodeGroup.device_type}</span>
            <span>Location: {electrodeGroup.location}</span>
          </div>
        </div>
        <div className="channel-map-editor-content">
          <p className="empty-message">
            No channel maps available. Please auto-generate channel maps first.
          </p>
        </div>
        <div className="channel-map-editor-actions">
          <button
            type="button"
            className="btn-cancel"
            onClick={handleCancel}
            aria-label="Cancel and close editor"
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      className="channel-map-editor"
      data-testid="channel-map-editor"
      data-group-id={electrodeGroup.id}
    >
      {/* Header */}
      <div className="channel-map-editor-header">
        <h2>Channel Map Editor</h2>
        <div className="electrode-group-info">
          <span>Electrode Group: {electrodeGroup.id}</span>
          <span>Device Type: {electrodeGroup.device_type}</span>
          <span>Location: {electrodeGroup.location}</span>
          <span data-testid="editor-channel-map-count">{localChannelMaps.length} maps</span>
        </div>
      </div>

      {/* Content */}
      <div className="channel-map-editor-content">
        {localChannelMaps.map((ntrodeMap, ntrodeIndex) => (
          <div key={ntrodeMap.ntrode_id} className="ntrode-section">
            <h3>Ntrode {ntrodeMap.ntrode_id}</h3>

            {/* Electrode ID */}
            <div className="ntrode-field">
              <label htmlFor={`electrode-id-${ntrodeMap.ntrode_id}`}>
                Electrode ID
              </label>
              <input
                id={`electrode-id-${ntrodeMap.ntrode_id}`}
                type="number"
                min="0"
                value={ntrodeMap.electrode_id}
                onChange={(e) => handleElectrodeIdChange(ntrodeIndex, e.target.value)}
                aria-label={`Electrode ID for ntrode ${ntrodeMap.ntrode_id}`}
              />
            </div>

            {/* Channel Map */}
            <div className="channel-map-grid">
              <div className="channel-map-header">
                <span>Channel</span>
                <span>Hardware ID</span>
                <span>Bad Channel</span>
              </div>
              {channelArray.map((channelIndex) => (
                <div key={channelIndex} className="channel-map-row">
                  <span className="channel-index">Channel {channelIndex}</span>
                  <input
                    type="number"
                    min="0"
                    value={ntrodeMap.map[channelIndex] ?? channelIndex}
                    onChange={(e) =>
                      handleChannelMapChange(ntrodeIndex, channelIndex, e.target.value)
                    }
                    aria-label={`Channel ${channelIndex} hardware mapping for ntrode ${ntrodeMap.ntrode_id}`}
                  />
                  <input
                    type="checkbox"
                    checked={isChannelBad(ntrodeIndex, channelIndex)}
                    onChange={() => handleBadChannelToggle(ntrodeIndex, channelIndex)}
                    aria-label={`Mark channel ${channelIndex} as bad for ntrode ${ntrodeMap.ntrode_id}`}
                  />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Actions */}
      <div className="channel-map-editor-actions">
        <button
          type="button"
          className="btn-cancel"
          onClick={handleCancel}
          aria-label="Cancel and close editor"
          data-testid="editor-cancel"
        >
          Cancel
        </button>
        <button
          type="button"
          className="btn-save"
          onClick={handleSave}
          aria-label="Save channel map changes"
          data-testid="editor-save"
        >
          Save
        </button>
      </div>
    </div>
  );
};

ChannelMapEditor.propTypes = {
  electrodeGroup: PropTypes.shape({
    id: PropTypes.string.isRequired,
    device_type: PropTypes.string.isRequired,
    location: PropTypes.string.isRequired,
    targeted_x: PropTypes.number,
    targeted_y: PropTypes.number,
    targeted_z: PropTypes.number,
    units: PropTypes.string,
  }).isRequired,
  channelMaps: PropTypes.arrayOf(
    PropTypes.shape({
      electrode_group_id: PropTypes.string.isRequired,
      ntrode_id: PropTypes.string.isRequired,
      electrode_id: PropTypes.number.isRequired,
      bad_channels: PropTypes.arrayOf(PropTypes.number),
      map: PropTypes.object.isRequired,
    })
  ).isRequired,
  onSave: PropTypes.func.isRequired,
  onCancel: PropTypes.func.isRequired,
};

export default ChannelMapEditor;
