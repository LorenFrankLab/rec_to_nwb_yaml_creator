import React from 'react';
import PropTypes from 'prop-types';
import { sanitizeTitle, stringToInteger } from '../utils';
import InfoIcon from './InfoIcon';

/**
 * Checkbox collection where multiple items can be selected
 *
 * @param {Object} prop Custom element's properties
 *
 * @returns Virtual DOM collection for multi-select checkboxes
 */
const CheckboxList = (prop) => {
  const {
    id,
    name,
    title,
    dataItems,
    objectKind,
    placeholder,
    defaultValue,
    updateFormArray,
    metaData,
  } = prop;

  const onChecked = (e) => {
    const { target } = e;
    const value = parseInt(target.value, 10);
    // const values = Array.from(
    //   target.parentElement.querySelectorAll('input[type="checkbox"]:checked')
    // ).map((a) => parseInt(a.value, 10));

    const { nameValue, keyValue, index } = metaData;
    updateFormArray(nameValue, value, keyValue, index, e.target.checked);
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
                  type="checkbox"
                  id={`${id}-${dataItemIndex}`}
                  name={`${name}-${id}`}
                  value={dataItem}
                  defaultChecked={defaultValue.includes(stringToInteger(dataItem))}
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

CheckboxList.propTypes = {
  title: PropTypes.string.isRequired,
  defaultValue: PropTypes.instanceOf(Array),
  dataItems: PropTypes.arrayOf(PropTypes.string),
  id: PropTypes.string.isRequired,
  objectKind: PropTypes.string,
  type: PropTypes.string.isRequired,
  name: PropTypes.string.isRequired,
  placeholder: PropTypes.string,
  updateFormArray: PropTypes.func,
  metaData: PropTypes.instanceOf(Object),
};

CheckboxList.defaultProps = {
  defaultValue: '',
  placeholder: '',
  objectKind: '',
};

export default CheckboxList;
