import React, { useRef } from 'react';
import PropTypes from 'prop-types';
import { splitTextNumber, sanitizeTitle } from './utils';

/**
 * Provides a means to get user data from a combination of select tag and input tag
 *
 * @param {Object} prop Custom element's properties
 *
 * @returns Virtual DOM for getting user input that combines a select tag and input tag
 */
const SelectInputPairElement = (prop) => {
  const {
    id,
    type,
    title,
    name,
    items,
    placeholder,
    defaultValue,
    required,
    metaData,
    onBlur,
    readOnly,
  } = prop;

  const selectRef = useRef(null);

  const inputRef = useRef(null);

  const splittedTextNumber = splitTextNumber(defaultValue);

  const onSelectPairInput = () => {
    const value = `${selectRef.current.value}${inputRef.current.value}`;
    const eventData = {
      target: {
        name,
        value,
        type,
      },
    };

    onBlur(eventData, metaData);
  };

  return (
    <div>
      <label className="container" htmlFor={id}>
        <div className="item1">{title}</div>
        <div className="item2">
          <div className="select-input-pair">
            <div className="select-input-pair__item1">
              <select
                name={name}
                id={`${id}-list`}
                onBlur={onSelectPairInput}
                ref={selectRef}
              >
                {items.map((item) => {
                  return (
                    <option
                      key={sanitizeTitle(item)}
                      defaultValue={splittedTextNumber.text}
                      value={item}
                    >
                      {item}
                    </option>
                  );
                })}
              </select>
            </div>
            <div className="select-input-pair__item2">
              <input
                id={id}
                ref={inputRef}
                type={type}
                name={name}
                className="select-input-pair__item2"
                placeholder={placeholder}
                defaultValue={splittedTextNumber.number}
                required={required}
                readOnly={readOnly}
                onBlur={onSelectPairInput}
              />
            </div>
          </div>
        </div>
      </label>
    </div>
  );
};

SelectInputPairElement.propType = {
  items: PropTypes.instanceOf(Array),
  title: PropTypes.string.isRequired,
  id: PropTypes.string.isRequired,
  type: PropTypes.string.isRequired,
  name: PropTypes.string.isRequired,
  placeholder: PropTypes.string,
  readOnly: PropTypes.bool,
  required: PropTypes.bool,
  step: PropTypes.string,
  metaData: PropTypes.instanceOf(Object),
  defaultValue: PropTypes.oneOf([PropTypes.string, PropTypes.number]),
  onBlur: PropTypes.func,
};

SelectInputPairElement.defaultProps = {
  items: [],
  required: false,
  placeholder: '',
  defaultValue: '',
  readOnly: false,
  step: 'any',
  type: 'text',
  onBlur: () => {},
};

export default SelectInputPairElement;
