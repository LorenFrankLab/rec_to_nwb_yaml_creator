import React, { useRef } from 'react';
import PropTypes from 'prop-types';
import { sanitizeTitle } from '../utils';
import { behavioralEventsDescription } from '../valueList';
import InfoIcon from './InfoIcon';

/**
 * Takes in a string consisting of text and a number, like abc5, and returns
 * an array with the text and number split, like- { text: 'abc', number: 5, }
 *
 * @param {string} textNumber String consisting of text and number, like Din1
 * @returns Array with text and number separated
 */
export const splitTextNumber = (textNumber) => {
  if (!textNumber || textNumber.trim() === '') {
    return { text: 'Din', number: 1 };
  }

  const numericPart = textNumber.match(/\d+/g);
  const textPart = textNumber.match(/[a-zA-Z]+/g);
  const eventsDescription = behavioralEventsDescription();

  let number = '';
  let text = '';

  // if true, description may be valid
  // if (
  //   numericPart &&
  //   numericPart.length === 1 &&
  //   textPart.length === 1 &&
  //   eventsDescription.includes(textPart[0])
  // ) {
  //   const parsedInt = parseInt(numericPart[0], 10);

  //   number = Number.isNaN(parsedInt) ? 1 : parsedInt;
  //   [text] = textPart;
  // }
  if (textPart.length === 1 && eventsDescription.includes(textPart[0])) {
    [text] = textPart;
  }

  if (numericPart && numericPart.length === 1) {
    const parsedInt = parseInt(numericPart[0], 10);

    number = Number.isNaN(parsedInt) ? 1 : parsedInt;
  }

  return { text, number };
};

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
    step,
    min,
    placeholder,
    defaultValue,
    required,
    metaData,
    onBlur,
    readOnly,
  } = prop;

  const selectRef = useRef(null);
  const inputRef = useRef(null);
  const onSelectPairInput = () => {
    const value = `${selectRef.current.value}${inputRef.current.value}`;
    const eventData = {
      target: {
        name,
        value,
        type: 'text',
      },
    };

    onBlur(eventData, metaData);
  };

  const splitTextNumberText = splitTextNumber(defaultValue).text;
  const splitTextNumberNumber = splitTextNumber(defaultValue).number;

  return (
    <div>
      <label className="container" htmlFor={id}>
        <div className="item1">
          {title} <InfoIcon infoText={placeholder} />
        </div>
        <div className="item2">
          <div className="select-input-pair">
            <div className="select-input-pair__item1">
              <>
                Type:&nbsp;
                <select
                  name={name}
                  id={`${id}-list`}
                  onBlur={onSelectPairInput}
                  ref={selectRef}
                  defaultValue={splitTextNumberText}
                >
                  {items.map((item) => {
                    return (
                      <option key={sanitizeTitle(item)} value={item}>
                        {item}
                      </option>
                    );
                  })}
                </select>
              </>
            </div>
            <div className="select-input-pair__item2">
              <>
                &nbsp;&nbsp;Index:&nbsp;
                <input
                  id={id}
                  ref={inputRef}
                  type={type}
                  name={name}
                  step={step}
                  min={min}
                  className="select-input-pair__item2"
                  placeholder={placeholder}
                  defaultValue={splitTextNumberNumber}
                  required={required}
                  readOnly={readOnly}
                  onBlur={onSelectPairInput}
                />
              </>
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
  min: PropTypes.string,
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
  min: '',
  readOnly: false,
  step: 'any',
  type: 'text',
  onBlur: () => {},
};

export default SelectInputPairElement;
