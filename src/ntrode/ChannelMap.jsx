import React from 'react';
import PropTypes from 'prop-types';
import InputElement from '../element/InputElement';
import CheckboxList from '../element/CheckboxList';
import { isNumeric, sanitizeTitle } from '../utils';
import InfoIcon from './../element/InfoIcon';


/**
 * Generates a custom element for ntrode_electrode_group_channel_map's map
 *
 * @param {Object} prop Custom element's properties
 *
 * @returns Virtual DOM of the map for ntrode_electrode_group_channel_map
 */
const ChannelMap = (prop) => {
  const { nTrodeItems, onBlur, onMapInput, electrodeGroupId, updateFormArray, metaData } =
    prop;

  const getOptions = (options, mapValue, mapValues) => {
    const items = [...new Set([
      -1,
      ...options.filter((i) => !mapValues.includes(i)),
      mapValue,
    ])].sort()

    return items;
  }

  return (
    <div className="container">
      <div className="item1"> </div>
      <div className="item2">
        {nTrodeItems.map((item, index) => {
          const mapKeys = Object.keys(item.map).map((i) => parseInt(i, 10));
          const mapValues = Object.values(item.map).filter((i) => isNumeric(i));
          const options = [...mapKeys];
          const keyBase = 'nTrode-container';

          return (
            <div
              className="nTrode-container"
              key={`${keyBase}-${index}`}
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
                    readOnly
                    onBlur={onBlur}
                  />
                  <CheckboxList
                    id={`ntrode_electrode_group_channel_map-bad_channels-${index}`}
                    type="number"
                    name="bad_channels"
                    title="Bad Channels"
                    placeholder="Bad Channels"
                    defaultValue={item.bad_channels}
                    dataItems={Object.keys(item.map)}
                    updateFormArray={updateFormArray}
                    metaData={{
                      nameValue: 'bad_channels',
                      index: metaData.index,
                      keyValue: 'ntrode_electrode_group_channel_map',
                    }}
                    onChange={updateFormArray}
                  />
                  <div className="container">
                    <div className="item1">
                      Map  <InfoIcon infoText="Electrode Map. Right Hand Side is expected mapping. Left Hand Side is actual mapping"/>
                    </div>
                    <div className="item2">
                      <div className="ntrode-maps">
                        {mapKeys.map((nTrodeKey, nTrodeKeyIndex) => {
                          const optionsLength = options.length;
                          const mapValue = mapValues[nTrodeKeyIndex];
                          const nTrodeKeyId = nTrodeKey + mapKeys.length * index;
                          const mapId = `ntrode_electrode_group_channel_map-map-${nTrodeKeyId}-${index}-${nTrodeKeyIndex}`;

                          return (
                            <div
                              className="ntrode-map"
                              key={`${mapId}`}
                            >
                              <label htmlFor={mapId}>{nTrodeKey}</label>
                              <select
                                id={mapId}
                                required
                                defaultValue={nTrodeKeyId}
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
                                {getOptions(options.map((o) => o + optionsLength * index), mapValue, mapValues).map((option, optionIndex) => {
                                  return (
                                    <option
                                      key={`${mapId}-option-${optionIndex}`}
                                    >
                                      {option !== -1 ? option : ''}
                                      {/* {item.map[option]} */}
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

ChannelMap.propTypes = {
  electrodeGroupId: PropTypes.number,
  nTrodeItems: PropTypes.instanceOf(Object),
  onBlur: PropTypes.func,
  updateFormArray: PropTypes.func,
  onMapInput: PropTypes.func,
  metaData: PropTypes.instanceOf(Object),
};

export default ChannelMap;
