import React, { useState, useId } from 'react';
import PropTypes from 'prop-types';
import Modal from '../../components/Modal/Modal';
import { getChannelCount } from '../../utils/deviceTypeUtils';
import { getProbeShanks } from '../../ntrode/probeCatalog';
import InfoIcon from '../../element/InfoIcon';
import './ChannelMapEditor.scss';

/**
 * ChannelMapEditor - Editor for the ntrode channel MAP (wiring) of an electrode group.
 *
 * WIRING-ONLY: This editor edits only the channel→hardware `map` assignments. Bad
 * channels are NOT edited here — they are owned per recording day and edited in the Day
 * Editor's BadChannelsEditor (the export merge reads bad channels from the day overrides
 * only, never from the animal-level config). This editor neither displays nor mutates an
 * electrode group's `bad_channels`; stored `bad_channels` records pass through the save
 * untouched.
 *
 * Per-shank grids are derived from the VERIFIED probe catalog (`getProbeShanks`),
 * matching ntrode rows to shanks BY ORDER, so an UNEVEN probe like
 * `64c-3s6mm6cm-20um-40um-sl` (21/21/22) renders its third shank's full 22
 * channels instead of a uniform 21. Falls back to the row's own map keys when the
 * device is uncatalogued or there are more rows than shanks.
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
  // Stable id wiring the shared Modal's title to aria-labelledby.
  const titleId = useId();

  // Local state for editing channel maps
  const [localChannelMaps, setLocalChannelMaps] = useState(
    JSON.parse(JSON.stringify(channelMaps))
  );

  // Inline validation errors shown on save (replaces a blocking alert()).
  const [validationErrors, setValidationErrors] = useState([]);

  // Per-shank electrode-id partition (converter truth), matched to ntrode rows by
  // order. The maximum map VALUE is the total probe channel count − 1.
  const probeShanks = getProbeShanks(electrodeGroup.device_type);
  const maxChannelValue = getChannelCount(electrodeGroup.device_type) - 1;

  /**
   * Local channel keys (0 … len-1) for the ntrode row at `ntrodeIndex`.
   * Uses the catalog shank for that row; falls back to the row's own map keys
   * (uncatalogued device or excess rows) so the editor never silently drops keys.
   * @param {number} ntrodeIndex
   * @returns {number[]}
   */
  const channelKeysForRow = (ntrodeIndex) => {
    const shank = probeShanks[ntrodeIndex];
    if (shank) {
      return shank.electrodeIds.map((_, i) => i);
    }
    const map = localChannelMaps[ntrodeIndex]?.map || {};
    return Object.keys(map)
      .map(Number)
      .sort((a, b) => a - b);
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

  // Handle Save button click
  const handleSave = () => {
    // Validate channel maps before saving
    const errors = validateChannelMaps(localChannelMaps, electrodeGroup.device_type);

    if (errors.length > 0) {
      setValidationErrors(errors);
      return;
    }

    setValidationErrors([]);
    onSave(localChannelMaps);
  };

  // Validate channel maps (wiring only).
  const validateChannelMaps = (maps, deviceType) => {
    const errors = [];
    const maxValue = getChannelCount(deviceType) - 1;

    maps.forEach((ntrodeMap) => {
      // Validate channel values are within range
      Object.entries(ntrodeMap.map).forEach(([chIdx, hwChannel]) => {
        if (hwChannel !== -1 && (hwChannel < 0 || hwChannel > maxValue)) {
          errors.push(
            `Ntrode ${ntrodeMap.ntrode_id}: Channel ${chIdx} maps to invalid hardware channel ${hwChannel} (valid range: 0-${maxValue})`
          );
        }
      });

      // Reject UNSET (-1) entries. The -1 sentinel is the dropdown's blank
      // option; saving it persists a converter-invalid map (the export gate catches
      // it later, but surface it at edit time). Every channel must map to a real id.
      const unsetChannels = Object.entries(ntrodeMap.map)
        .filter(([, hwChannel]) => hwChannel === -1)
        .map(([chIdx]) => chIdx);
      if (unsetChannels.length > 0) {
        errors.push(
          `Ntrode ${ntrodeMap.ntrode_id}: Channel(s) ${unsetChannels.join(', ')} are unset ` +
          `(no hardware channel selected). Select a hardware channel for every entry before saving.`
        );
      }

      // Validate no duplicate hardware channels within same ntrode
      const hwChannels = Object.values(ntrodeMap.map).filter(val => val !== -1);
      const duplicates = hwChannels.filter((val, idx) => hwChannels.indexOf(val) !== idx);
      if (duplicates.length > 0) {
        const uniqueDupes = [...new Set(duplicates)].join(', ');
        errors.push(
          `Ntrode ${ntrodeMap.ntrode_id}: Duplicate hardware channels detected: ${uniqueDupes}`
        );
      }
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
      <Modal
        isOpen
        onClose={onCancel}
        title="Channel Map Editor"
        titleId={titleId}
        className="channel-map-editor-modal"
      >
        <div className="channel-map-editor-header">
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
      </Modal>
    );
  }

  return (
    <Modal
      isOpen
      onClose={onCancel}
      title="Channel Map Editor"
      titleId={titleId}
      className="channel-map-editor-modal"
    >
      <div data-testid="channel-map-editor" data-group-id={electrodeGroup.id}>
        {/* Header */}
        <div className="channel-map-editor-header">
          <div className="electrode-group-info">
            <span>Electrode Group: {electrodeGroup.id}</span>
            <span>Device Type: {electrodeGroup.device_type}</span>
            <span>Location: {electrodeGroup.location}</span>
            {probeShanks.length > 0 ? (
              <>
                <span data-testid="editor-shank-count">
                  {probeShanks.length} shanks
                </span>
                <span data-testid="editor-channel-count">
                  {getChannelCount(electrodeGroup.device_type)} channels
                </span>
              </>
            ) : (
              <span data-testid="editor-catalog-unavailable">
                Catalog unavailable — channel layout from saved data
              </span>
            )}
            <span data-testid="editor-channel-map-count">{localChannelMaps.length} maps</span>
          </div>
        </div>

      {/* Content */}
      <div className="channel-map-editor-content">
        {localChannelMaps.map((ntrodeMap, ntrodeIndex) => {
          const channelKeys = channelKeysForRow(ntrodeIndex);
          return (
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

              {/* Map - Select Dropdowns */}
              <div className="map-field">
                <label>
                  Map
                  <InfoIcon infoText="Electrode Map. Right Hand Side is expected mapping. Left Hand Side is actual mapping" />
                </label>
                <div className="ntrode-maps">
                  {channelKeys.map((channelIndex) => {
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
          );
        })}
      </div>

      {/* Validation errors (inline, replaces a blocking alert) */}
      {validationErrors.length > 0 && (
        <div className="channel-map-editor-errors" role="alert">
          <p>Cannot save — please fix the following issues:</p>
          <ul>
            {validationErrors.map((err) => (
              <li key={err}>{err}</li>
            ))}
          </ul>
        </div>
      )}

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
    </Modal>
  );
};

ChannelMapEditor.propTypes = {
  electrodeGroup: PropTypes.shape({
    id: PropTypes.number.isRequired,
    device_type: PropTypes.string.isRequired,
    location: PropTypes.string.isRequired,
    targeted_x: PropTypes.number,
    targeted_y: PropTypes.number,
    targeted_z: PropTypes.number,
    units: PropTypes.string,
  }).isRequired,
  channelMaps: PropTypes.arrayOf(
    PropTypes.shape({
      electrode_group_id: PropTypes.number.isRequired,
      ntrode_id: PropTypes.number.isRequired,
      map: PropTypes.object.isRequired,
    })
  ).isRequired,
  onSave: PropTypes.func.isRequired,
  onCancel: PropTypes.func.isRequired,
};

export default ChannelMapEditor;
