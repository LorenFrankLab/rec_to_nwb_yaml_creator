import React from 'react';
import PropTypes from 'prop-types';
import InputElement from './InputElement';
import CheckboxList from './CheckboxList';
import { sanitizeTitle } from './utils';

const ChannelMap = (prop) => {
  const { nTrodeItems, onInput, onMapInput, electrodeGroupId, updateFormData } =
    prop;

  return (
    <div className="container">
      <div className="item1"> </div>
      <div className="item2">
        {nTrodeItems.map((item, index) => {
          return (
            <div className="nTrode-container" key={sanitizeTitle(item)}>
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
                    onInput={onInput}
                  />
                  <CheckboxList
                    id={`ntrode_electrode_group_channel_map-bad_channels-${index}`}
                    type="number"
                    name="bad_channels"
                    title="Bad Channels"
                    placeholder="Bad Channels"
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
                        {Object.keys(item.map).map(
                          (nTrodeKey, nTrodeKeyIndex) => {
                            const options = Object.values(item.map);
                            const itemMapId = `${nTrodeKeyIndex}`;
                            const optionsLength = options.length;

                            return (
                              <div
                                className="ntrode-map"
                                key={sanitizeTitle(nTrodeKey)}
                              >
                                <label htmlFor={itemMapId}>{nTrodeKey}</label>
                                <select
                                  id={itemMapId}
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
                                        key={sanitizeTitle(option)}
                                        selected={
                                          option === parseInt(nTrodeKey, 10)
                                        }
                                      >
                                        {option}
                                      </option>
                                    );
                                  })}
                                </select>
                              </div>
                            );
                          }
                        )}
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
  onInput: PropTypes.func,
  updateFormData: PropTypes.func,
  onMapInput: PropTypes.func,
};

export default ChannelMap;
