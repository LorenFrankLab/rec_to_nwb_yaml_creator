import React from 'react';
import PropTypes from 'prop-types';
import { sanitizeTitle } from '../utils';
import InfoIcon from './InfoIcon';



/**
 * Radio collection where multiple items can be selected
 *
 * @param {Object} prop Custom element's properties
 *
 * @returns Virtual DOM collection for multi-select Radios
 */
const RadioList = (prop) => {
  const {
    id,
    name,
    title,
    dataItems,
    objectKind,
    placeholder,
    defaultValue,
    updateFormData,
    metaData,
    type = 'number',
  } = prop;

  const onChecked = (e) => {
    const { target } = e;
    const { value } = target;
    // const radioValue = parseInt(value, 10);
    let radioValue;
    if (type === 'number') {
      radioValue = parseInt(value, 10);
    }
    else {radioValue = value;}
    const { nameValue, keyValue, index } = metaData;

    updateFormData(nameValue, radioValue, keyValue, index);
  };

  return (
    <label className="container" htmlFor={id}>
      <div className="item1">
      {title} <InfoIcon infoText={placeholder} />
      </div>
      <div className="item2">
        <div className={`checkbox-list ${dataItems.length > 0 ? '' : 'hide'}`}>
          {dataItems.map((dataItem, dataItemIndex) => {
            return (
              <div
                className="checkbox-list-item"
                key={`${id}-${sanitizeTitle(dataItem)}`}
              >
                <input
                  type="radio"
                  id={`${id}-${dataItemIndex}`}
                  name={`${name}-${id}`}
                  value={dataItem}
                  defaultChecked={defaultValue === dataItem}
                  onClick={onChecked}
                />
                <label htmlFor={`${id}-${dataItemIndex}`}> {dataItem}</label>
              </div>
            );
          })}
        </div>
        {dataItems.length === 0 ? (
          <span className="checkbox-list--no-data ">
            No {objectKind} Item available
          </span>
        ) : null}
      </div>
    </label>
  );
};

RadioList.propType = {
  title: PropTypes.string.isRequired,
  defaultValue: PropTypes.instanceOf(Array),
  dataItems: PropTypes.arrayOf(PropTypes.string),
  id: PropTypes.string.isRequired,
  objectKind: PropTypes.string,
  type: PropTypes.string.isRequired,
  name: PropTypes.string.isRequired,
  placeholder: PropTypes.string,
  updateFormData: PropTypes.func,
  metaData: PropTypes.instanceOf(Object),
};

RadioList.defaultProps = {
  defaultValue: '',
  placeholder: '',
  objectKind: '',
};

export default RadioList;
