import React from 'react';
import PropTypes from 'prop-types';
import { sanitizeTitle } from './utils';

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
    defaultValue,
    updateFormData,
    metaData,
  } = prop;

  const onChecked = (e) => {
    const { target } = e;
    const values = Array.from(
      target.parentElement.querySelectorAll('input[type="Radio"]:checked')
    ).map((a) => parseInt(a.value, 10));

    const { nameValue, keyValue, index } = metaData;
    updateFormData(nameValue, values, keyValue, index);
  };

  return (
    <label className="container" htmlFor={id}>
      <div className="item1">{title}</div>
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
                  name={name}
                  value={dataItem}
                  defaultChecked={defaultValue.includes(dataItem)}
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
  updateFormData: PropTypes.func,
  metaData: PropTypes.instanceOf(Object),
};

RadioList.defaultProps = {
  defaultValue: '',
  objectKind: '',
};

export default RadioList;
