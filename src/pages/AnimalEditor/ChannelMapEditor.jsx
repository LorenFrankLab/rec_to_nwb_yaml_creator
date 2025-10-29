import React, { useState } from 'react';
import PropTypes from 'prop-types';
import { deviceTypeMap } from '../../ntrode/deviceTypes';
import { getChannelCount } from '../../utils/deviceTypeUtils';
import InfoIcon from '../../element/InfoIcon';
import './ChannelMapEditor.scss';

/**
 * ChannelMapEditor - Editor for ntrode channel maps for a specific electrode group
 *
 * LEGACY LAYOUT MATCH: This component replicates the exact layout from the original
 * ChannelMap.jsx component (src/ntrode/ChannelMap.jsx) with:
 * - Fieldset with "Shank #N" legend
 * - Readonly "Ntrode Id" field with InfoIcon
 * - "Bad Channels" checkbox grid (NOT comma-separated input)
 * - "Map" section with select dropdowns (NOT number inputs)
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
  const maxChannelValue = getChannelCount(electrodeGroup.device_type) - 1;

  // Handle bad channel checkbox toggle
  const handleBadChannelToggle = (ntrodeIndex, channelIndex, isChecked) => {
    const updated = localChannelMaps.map((map, idx) => {
      if (idx !== ntrodeIndex) return map;

      const currentBadChannels = map.bad_channels || [];
      let newBadChannels;

      if (isChecked) {
        // Add to bad channels
        newBadChannels = [...currentBadChannels, channelIndex].sort((a, b) => a - b);
      } else {
        // Remove from bad channels
        newBadChannels = currentBadChannels.filter(ch => ch !== channelIndex);
      }

      return { ...map, bad_channels: newBadChannels };
    });

    setLocalChannelMaps(updated);
  };

  // Handle channel map select change
  const handleChannelMapChange = (ntrodeIndex, channelIndex, value) => {
    const parsedValue = value === '' ? -1 : parseInt(value, 10);

    const updated = localChannelMaps.map((map, idx) =>
      idx === ntrodeIndex
        ? { ...map, map: { ...map.map, [channelIndex]: parsedValue } }
        : map
    );
    setLocalChannelMaps(updated);
  };

  // Check if channel is marked as bad
  const isChannelBad = (ntrodeIndex, channelIndex) => {
    const badChannels = localChannelMaps[ntrodeIndex]?.bad_channels || [];
    return badChannels.includes(channelIndex);
  };

  // Handle Save button click
  const handleSave = () => {
    // Validate channel maps before saving
    const errors = validateChannelMaps(localChannelMaps, electrodeGroup.device_type, channelArray);

    if (errors.length > 0) {
      alert(`Cannot save - Please fix the following issues:\n\n${errors.join('\n')}`);
      return;
    }

    onSave(localChannelMaps);
  };

  // Validate channel maps for errors
  const validateChannelMaps = (maps, deviceType, channels) => {
    const errors = [];
    const maxChannelValue = getChannelCount(deviceType) - 1;
    const channelCount = channels.length;

    maps.forEach((ntrodeMap) => {
      // P0-2: Validate channel values are within range
      Object.entries(ntrodeMap.map).forEach(([chIdx, hwChannel]) => {
        if (hwChannel !== -1 && (hwChannel < 0 || hwChannel > maxChannelValue)) {
          errors.push(
            `Ntrode ${ntrodeMap.ntrode_id}: Channel ${chIdx} maps to invalid hardware channel ${hwChannel} (valid range: 0-${maxChannelValue})`
          );
        }
      });

      // P1-1: Validate no duplicate hardware channels within same ntrode
      const hwChannels = Object.values(ntrodeMap.map).filter(val => val !== -1);
      const duplicates = hwChannels.filter((val, idx) => hwChannels.indexOf(val) !== idx);
      if (duplicates.length > 0) {
        const uniqueDupes = [...new Set(duplicates)].join(', ');
        errors.push(
          `Ntrode ${ntrodeMap.ntrode_id}: Duplicate hardware channels detected: ${uniqueDupes}`
        );
      }

      // P1-2: Validate bad_channels indices are within valid range
      const badChannels = ntrodeMap.bad_channels || [];
      badChannels.forEach((badCh) => {
        if (badCh < 0 || badCh >= channelCount) {
          errors.push(
            `Ntrode ${ntrodeMap.ntrode_id}: Bad channel index ${badCh} is out of range (valid: 0-${channelCount - 1})`
          );
        }
      });
    });

    return errors;
  };

  // Handle Cancel button click
  const handleCancel = () => {
    onCancel();
  };

  // Handle edge case: no channel maps
  if (!channelMaps || channelMaps.length === 0) {
    return (
      <div className="channel-map-editor-overlay" role="presentation">
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
      </div>
    );
  }

  return (
    <div className="channel-map-editor-overlay" role="presentation">
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
          <fieldset key={ntrodeMap.ntrode_id} className="ntrode-fieldset">
            <legend>Shank #{ntrodeIndex + 1}</legend>

            <div className="form-container">
              {/* Ntrode Id - Readonly */}
              <div className="ntrode-field ntrode-id-field">
                <label htmlFor={`ntrode-id-${ntrodeMap.ntrode_id}`}>
                  Ntrode Id
                  <InfoIcon infoText="Ntrode identifier (read-only)" />
                </label>
                <input
                  id={`ntrode-id-${ntrodeMap.ntrode_id}`}
                  type="number"
                  value={ntrodeMap.ntrode_id}
                  readOnly
                  disabled
                  aria-label={`Ntrode ID ${ntrodeMap.ntrode_id} (read-only)`}
                  data-testid={`ntrode-id-${ntrodeMap.ntrode_id}`}
                />
              </div>

              {/* Bad Channels - Checkbox Grid */}
              <fieldset className="bad-channels-fieldset">
                <legend>
                  Bad Channels
                  <InfoIcon infoText="Select channels with hardware failures. Only mark channels with true hardware issues, not analysis quality problems." />
                </legend>
                <div className="checkbox-list" data-testid={`bad-channels-checkboxes-${ntrodeMap.ntrode_id}`}>
                  {channelArray.map((channelIndex) => (
                    <div key={channelIndex} className="checkbox-list-item">
                      <input
                        type="checkbox"
                        id={`bad-channel-${ntrodeMap.ntrode_id}-${channelIndex}`}
                        checked={isChannelBad(ntrodeIndex, channelIndex)}
                        onChange={(e) => handleBadChannelToggle(ntrodeIndex, channelIndex, e.target.checked)}
                        aria-label={`Mark channel ${channelIndex} as bad for ntrode ${ntrodeMap.ntrode_id}`}
                      />
                      <label htmlFor={`bad-channel-${ntrodeMap.ntrode_id}-${channelIndex}`}>
                        {channelIndex}
                      </label>
                    </div>
                  ))}
                </div>
              </fieldset>

              {/* Map - Select Dropdowns */}
              <div className="map-field">
                <label>
                  Map
                  <InfoIcon infoText="Electrode Map. Right Hand Side is expected mapping. Left Hand Side is actual mapping" />
                </label>
                <div className="ntrode-maps">
                  {channelArray.map((channelIndex) => {
                    // Generate options: -1 (empty), 0 to maxChannelValue
                    const options = [-1, ...Array.from({ length: maxChannelValue + 1 }, (_, i) => i)];
                    const currentValue = ntrodeMap.map[channelIndex] ?? channelIndex;

                    return (
                      <div key={channelIndex} className="ntrode-map">
                        <label htmlFor={`map-${ntrodeMap.ntrode_id}-${channelIndex}`}>
                          {channelIndex}
                        </label>
                        <select
                          id={`map-${ntrodeMap.ntrode_id}-${channelIndex}`}
                          value={currentValue}
                          onChange={(e) => handleChannelMapChange(ntrodeIndex, channelIndex, e.target.value)}
                          aria-label={`Hardware channel mapping for channel ${channelIndex} in ntrode ${ntrodeMap.ntrode_id}`}
                        >
                          {options.map((option) => (
                            <option key={option} value={option}>
                              {option !== -1 ? option : ''}
                            </option>
                          ))}
                        </select>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </fieldset>
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
