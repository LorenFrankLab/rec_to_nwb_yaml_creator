import React from 'react';
import PropTypes from 'prop-types';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';

/**
 * Provides a text box
 *
 * @param {Object} prop Custom element's properties
 *
 * @returns Virtual DOM for creating an input[type="string|number"] with
 * supporting HTML tags and code
 */
const DatePickerElement = (prop) => {
  const {
    id,
    title,
    name,
    placeholder,
    defaultValue,
    onChange,
    dateFormat,
    required,
  } = prop;

  return (
    <div>
      <label className="container" htmlFor={id}>
        <div className="item1" title={placeholder}>
          {title}
        </div>
        <div className="item2">
          <DatePicker
            id={id}
            selected={!defaultValue ? '' : new Date(defaultValue)}
            name={name}
            placeholder={placeholder}
            onChange={onChange}
            key={defaultValue}
            dateFormat={dateFormat}
            required={required}
          />
        </div>
      </label>
    </div>
  );
};

DatePickerElement.propType = {
  title: PropTypes.string.isRequired,
  id: PropTypes.string.isRequired,
  type: PropTypes.string.isRequired,
  name: PropTypes.string.isRequired,
  placeholder: PropTypes.string,
  readOnly: PropTypes.bool,
  required: PropTypes.bool,
  dateFormat: PropTypes.string,
  defaultValue: PropTypes.oneOf([PropTypes.string, PropTypes.number]),
  onChange: PropTypes.func,
};

DatePickerElement.defaultProps = {
  required: false,
  placeholder: '',
  defaultValue: '',
  readOnly: false,
  dateFormat: 'yyyy/MM/dd',
  onChange: () => {},
};

export default DatePickerElement;
