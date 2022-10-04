import React, { useRef } from 'react';
import PropTypes from 'prop-types';
import { splitTextNumber, sanitizeTitle } from './utils';

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
    onInput,
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

    onInput(eventData, metaData);
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
                onInput={onSelectPairInput}
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
                onInput={onSelectPairInput}
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
  onInput: PropTypes.func,
};

SelectInputPairElement.defaultProps = {
  items: [],
  required: false,
  placeholder: '',
  defaultValue: '',
  readOnly: false,
  step: 'any',
  type: 'text',
  onInput: () => {},
};

export default SelectInputPairElement;
