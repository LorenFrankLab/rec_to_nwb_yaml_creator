import React from 'react';
import PropTypes from 'prop-types';

const InputElement = (prop) => {
  const {
    id,
    type,
    title,
    name,
    placeholder,
    defaultValue,
    required,
    onInput,
    readOnly,
    step,
  } = prop;

  return (
    <div>
      <label className="container" htmlFor={id}>
        <div className="item1">{title}</div>
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
            onInput={(e) => onInput(e)}
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
  onInput: PropTypes.func,
};

InputElement.defaultProps = {
  required: false,
  placeholder: '',
  defaultValue: '',
  readOnly: false,
  step: 'any',
  onInput: () => {},
};

export default InputElement;
