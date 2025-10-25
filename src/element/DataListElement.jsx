import React from 'react';
import PropTypes from 'prop-types';
import { sanitizeTitle } from '../utils';
import InfoIcon from './InfoIcon';

/**
 * Data list providing users options to select from and allowing them to write their own selection
 *
 * @param {Object} prop Custom element's properties
 *
 * @returns Virtual DOM contain an HTML Datalist with supporting HTML tags and code
 */
const DataListElement = (prop) => {
  const {
    id,
    name,
    title,
    dataItems,
    defaultValue,
    placeholder,
    type,
    onBlur,
  } = prop;

  return (
    <label className="container" htmlFor={id}>
      <div className="item1">
        {title} <InfoIcon infoText={placeholder} />
      </div>
      <div className="item2 data-list">
        <input
          id={id}
          type={type}
          list={`${id}-list`}
          name={name}
          placeholder={placeholder}
          defaultValue={defaultValue}
          key={defaultValue}
          onBlur={onBlur}
        />
        <datalist id={`${id}-list`} name={name}>
          {dataItems.map((dataItem, dataItemIndex) => {
            return (
              <option
                key={`${dataItemIndex}-${sanitizeTitle(dataItem)}`}
                value={dataItem}
                name={name}
              >
                {dataItem}
              </option>
            );
          })}
        </datalist>
      </div>
    </label>
  );
};

DataListElement.propTypes = {
  title: PropTypes.string.isRequired,
  type: PropTypes.oneOf([PropTypes.string, PropTypes.number]),
  defaultValue: PropTypes.oneOf([PropTypes.string, PropTypes.number]),
  dataItems: PropTypes.arrayOf(PropTypes.string),
  placeholder: PropTypes.string,
  id: PropTypes.string.isRequired,
  name: PropTypes.string.isRequired,
  onBlur: PropTypes.func,
};

DataListElement.defaultProps = {
  type: 'text',
  defaultValue: '',
  placeholder: '',
  onBlur: () => {},
};

export default DataListElement;
