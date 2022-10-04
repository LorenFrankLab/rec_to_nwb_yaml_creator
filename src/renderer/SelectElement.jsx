import React from 'react';
import PropTypes from 'prop-types';
import { sanitizeTitle } from './utils';

const SelectElement = (prop) => {
  const { id, name, title, dataItems, defaultValue, onChange } = prop;

  return (
    <label className="container" htmlFor={id}>
      <div className="item1">{title}</div>
      <div className="item2">
        <select id={id} name={name} onChange={onChange}>
          {dataItems.map((dataItem) => {
            return (
              <option
                key={sanitizeTitle(dataItem)}
                value={dataItem}
                name={name}
                selected={dataItem === defaultValue}
              >
                {dataItem}
              </option>
            );
          })}
        </select>
      </div>
    </label>
  );
};

SelectElement.propType = {
  title: PropTypes.string.isRequired,
  defaultValue: PropTypes.oneOf([PropTypes.string, PropTypes.number]),
  dataItems: PropTypes.arrayOf(PropTypes.string),
  id: PropTypes.string.isRequired,
  type: PropTypes.string.isRequired,
  name: PropTypes.string.isRequired,
  onChange: PropTypes.func,
};

SelectElement.defaultProps = {
  defaultValue: '',
  onChange: () => {},
};

export default SelectElement;
