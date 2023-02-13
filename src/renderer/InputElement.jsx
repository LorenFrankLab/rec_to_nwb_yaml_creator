import React from 'react';
import PropTypes from 'prop-types';

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
    required,
    onBlur,
    readOnly,
    step,
  } = prop;

  return (
    <div>
      <label className="container" htmlFor={id}>
        <div className="item1" title={placeholder}>
          {title}
        </div>
        <div className="item2">
          <input
            id={id}
            type={type}
            name={name}
            className="base-width"
            placeholder={placeholder}
            defaultValue={defaultValue}
            required={required}
            readOnly={readOnly}
            step={step}
            onBlur={(e) => onBlur(e)}
            onChange={() => {}} // done to quiet a react warning in the console
          />
        </div>
      </label>
    </div>
  );
};

InputElement.propType = {
  title: PropTypes.string.isRequired,
  id: PropTypes.string.isRequired,
  type: PropTypes.string.isRequired,
  name: PropTypes.string.isRequired,
  placeholder: PropTypes.string,
  readOnly: PropTypes.bool,
  required: PropTypes.bool,
  step: PropTypes.string,
  defaultValue: PropTypes.oneOf([PropTypes.string, PropTypes.number]),
  onBlur: PropTypes.func,
};

InputElement.defaultProps = {
  required: false,
  placeholder: '',
  defaultValue: '',
  readOnly: false,
  step: 'any',
  onBlur: () => {},
};

export default InputElement;
