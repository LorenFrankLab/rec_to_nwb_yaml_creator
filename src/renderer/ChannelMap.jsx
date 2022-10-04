import React from 'react';
import PropTypes from 'prop-types';

const ChannelMap = (channelData) => {
  const { property, electrodeGroupId, nTrode, onMapChanged } = channelData;
  const { title, description, items } = property;
  const channelMapList = Object.values(items?.properties) || [];
  const channelMapListLength = channelMapList.length;
  const shankCount = items?.shankCount || 0;
  const shanksIds = [...Array(shankCount).keys()];

  const itemSelected = (e, shankIndex, key) => {
    const nTrodes = nTrode.filter(
      (n) => n.electrode_group_id === electrodeGroupId
    );

    const nTrodeItem = nTrodes[shankIndex];
    const { value } = e.target;

    if (!nTrodeItem) {
      return null;
    }

    nTrodeItem.map[key] = value;
    onMapChanged(shankIndex, electrodeGroupId, key, value);

    return null;
  };

  return (
    <div className="container">
      <label
        htmlFor={title}
        className="item1"
        placeholder={description}
        key={property.$id}
      >
        <span>{title?.replaceAll('_', ' ')} &nbsp; </span>
      </label>
      <div className="item2">
        {shanksIds.map((shankId, shankIndex) => (
          <fieldset className="form-control shank" name={property.title}>
            <legend>Shank #{shankId + 1} &nbsp; </legend>
            <div className="nTrode-container">
              {channelMapList?.map((item) => {
                return (
                  <div className="ntrode-map">
                    <label htmlFor={item.$id}>{item.title}</label>
                    <select
                      id={item.$id}
                      name={title}
                      key={item.$id}
                      className="select-base-width"
                      onChange={(e) => itemSelected(e, shankIndex, item.title)}
                    >
                      return (
                      {item.examples.map((i) => {
                        const ItemValue = channelMapListLength * shankId + i;
                        return (
                          <option
                            id={item.$id}
                            defaultValue={ItemValue}
                            key={item.$id}
                            selected={item.default === i}
                          >
                            {ItemValue}
                          </option>
                        );
                      })}
                      )
                    </select>
                  </div>
                );
              })}
            </div>
          </fieldset>
        ))}
      </div>
    </div>
  );
};

ChannelMap.propType = {
  property: PropTypes.object.isRequired,
};

export default ChannelMap;
