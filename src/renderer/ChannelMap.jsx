import React from 'react';
import PropTypes from 'prop-types';
import InputElement from './InputElement';
import CheckboxList from './CheckboxList';
import { sanitizeTitle } from './utils';

/**
 * Generates a custom element for ntrode_electrode_group_channel_map's map
 *
 * @param {Object} prop Custom element's properties
 *
 * @returns Virtual DOM of the map for ntrode_electrode_group_channel_map
 */
const ChannelMap = (prop) => {
  const { nTrodeItems, onBlur, onMapInput, electrodeGroupId, updateFormData } =
    prop;

  return (
    <div className="container">
      <div className="item1"> </div>
      <div className="item2">
        {nTrodeItems.map((item, index) => {
          const mapKeys = Object.keys(item.map).map((i) => parseInt(i, 10));
          const options = [...mapKeys];
          const keyBase = 'nTrode-container';

          return (
            <div
              className="nTrode-container"
              key={`${keyBase}-${sanitizeTitle(index)}`}
            >
              <fieldset>
                <legend>Shank #{index + 1}</legend>
                <div className="form-container">
                  <InputElement
                    id={`ntrode_electrode_group_channel_map-ntrode_id-${index}`}
                    type="number"
                    name="ntrode_id"
                    title="Ntrode Id"
                    required
                    defaultValue={item.ntrode_id}
                    placeholder="Ntrode Id"
                    onBlur={onBlur}
                  />
                  <CheckboxList
                    id={`ntrode_electrode_group_channel_map-bad_channels-${index}`}
                    type="number"
                    name="bad_channels"
                    title="Bad Channels"
                    placeholder="Bad Channels"
                    defaultValue={item.bad_channels}
                    dataItems={[...new Set(Object.values(item.map || []))].sort(
                      (a, b) => a - b
                    )}
                    updateFormData={updateFormData}
                    metaData={{
                      nameValue: 'bad_channels',
                      index: 0,
                      keyValue: 'ntrode_electrode_group_channel_map',
                    }}
                    onChange={updateFormData}
                  />
                  <div className="container">
                    <div className="item1">Map</div>
                    <div className="item2">
                      <div className="ntrode-maps">
                        {mapKeys.map((nTrodeKey, nTrodeKeyIndex) => {
                          const itemMapId = `${nTrodeKeyIndex}`;
                          const optionsLength = options.length;
                          const mapId = `ntrode_electrode_group_channel_map-map-${itemMapId}`;

                          return (
                            <div
                              className="ntrode-map"
                              key={`${mapId}-${sanitizeTitle(nTrodeKeyIndex)}`}
                            >
                              <label htmlFor={mapId}>{nTrodeKey}</label>
                              <select
                                id={mapId}
                                defaultValue={item.map[nTrodeKey]}
                                onChange={(e) =>
                                  onMapInput(e, {
                                    key: 'ntrode_electrode_group_channel_map',
                                    index: nTrodeKey,
                                    shankNumber: index,
                                    totalItems: optionsLength,
                                    electrodeGroupId,
                                  })
                                }
                              >
                                {options.map((option) => {
                                  return (
                                    <option
                                      key={`${mapId}-${keyBase}-${sanitizeTitle(
                                        option
                                      )}${nTrodeKey}`}
                                    >
                                      {item.map[option]}
                                    </option>
                                  );
                                })}
                              </select>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </div>
              </fieldset>
            </div>
          );
        })}
      </div>
    </div>
  );
};

ChannelMap.propType = {
  electrodeGroupId: PropTypes.number,
  nTrodeItems: PropTypes.instanceOf(Object),
  onBlur: PropTypes.func,
  updateFormData: PropTypes.func,
  onMapInput: PropTypes.func,
};

export default ChannelMap;
