import React from 'react';
import PropTypes from 'prop-types';
import InfoIcon from './InfoIcon';

/**
 * Provides a text box
 *
 * @param {Object} prop Custom element's properties
 *
 * @returns Virtual DOM for creating an input[type="string|number"] with
 * supporting HTML tags and code
 */
const InputElement = (prop) => {
  const {
    id,
    type,
    title,
    name,
    placeholder,
    defaultValue,
    min,
    required,
    onBlur,
    readOnly,
    pattern,
    step,
  } = prop;

  const getDefaultDateValue = () => {
    if (!defaultValue) {
      return '';
    }

    // If defaultValue is already in YYYY-MM-DD format, return it directly
    // This avoids timezone conversion issues with new Date()
    if (/^\d{4}-\d{2}-\d{2}$/.test(defaultValue)) {
      return defaultValue;
    }

    // For ISO 8601 datetime strings, extract the date part
    if (defaultValue.includes('T')) {
      return defaultValue.split('T')[0];
    }

    // Fallback: parse as date (this may have timezone issues)
    const dateObj = new Date(defaultValue);

    // get the month in this format of 04, the same for months
    const month = `0${dateObj.getMonth() + 1}`.slice(-2);
    const day = `0${dateObj.getDate()}`.slice(-2); // FIX: removed +1 (getDate already returns 1-31)
    const year = dateObj.getFullYear();

    const shortDate = `${year}-${month}-${day}`;

    return shortDate;
  };

  return (
    <label className="container" htmlFor={id}>
      <div className="item1">
        {title} <InfoIcon infoText={placeholder} />
      </div>
      <div className="item2">
        <input
          id={id}
          type={type}
          name={name}
          className={`base-width ${readOnly ? 'gray-out' : ''}`}
          placeholder={placeholder}
          defaultValue={type !== 'date' ? defaultValue : getDefaultDateValue()}
          key={defaultValue}
          required={required}
          readOnly={readOnly}
          step={step}
          min={min}
          onBlur={(e) => onBlur(e)}
          pattern={pattern}
        />
      </div>
    </label>
  );
};

InputElement.propTypes = {
  title: PropTypes.string.isRequired,
  id: PropTypes.string.isRequired,
  type: PropTypes.string.isRequired,
  name: PropTypes.string.isRequired,
  placeholder: PropTypes.string,
  readOnly: PropTypes.bool,
  required: PropTypes.bool,
  step: PropTypes.string,
  min: PropTypes.string,
  defaultValue: PropTypes.oneOf([PropTypes.string, PropTypes.number]),
  pattern: PropTypes.string,
  onBlur: PropTypes.func,
};

InputElement.defaultProps = {
  required: false,
  placeholder: '',
  defaultValue: '',
  readOnly: false,
  step: 'any',
  pattern: '^.+$',
  min: '',
  onBlur: () => {},
};

export default InputElement;
