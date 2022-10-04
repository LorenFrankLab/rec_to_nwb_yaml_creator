import React from 'react';
import PropTypes from 'prop-types';
import { sanitizeTitle } from './utils';

const DataListElement = (prop) => {
  const { id, name, title, dataItems, defaultValue, type, onChange } = prop;

  return (
    <label className="container" htmlFor={id}>
      <div className="item1">{title}</div>
      <div className="item2 data-list">
        <input
          id={id}
          type={type}
          list={`${id}-list`}
          name={name}
          defaultValue={defaultValue}
          onChange={onChange}
        />
        <datalist id={`${id}-list`} name={name}>
          {dataItems.map((dataItem) => {
            return (
              <option
                key={sanitizeTitle(dataItem)}
                defaultValue={defaultValue}
                name={name}
                value={dataItem}
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

DataListElement.propType = {
  title: PropTypes.string.isRequired,
  type: PropTypes.oneOf([PropTypes.string, PropTypes.number]),
  defaultValue: PropTypes.oneOf([PropTypes.string, PropTypes.number]),
  dataItems: PropTypes.arrayOf(PropTypes.string),
  id: PropTypes.string.isRequired,
  name: PropTypes.string.isRequired,
  onChange: PropTypes.func,
};

DataListElement.defaultProps = {
  type: 'text',
  defaultValue: '',
  onChange: () => {},
};

export default DataListElement;
