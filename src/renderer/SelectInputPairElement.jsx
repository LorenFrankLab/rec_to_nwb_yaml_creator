import React, { useRef } from 'react';
import PropTypes from 'prop-types';

const SelectInputPairElement = (property) => {
  const selectElement = useRef(null);
  const inputElement = useRef(null);
  const {
    id,
    dataList,
    description,
    keyProp,
    title,
    dataMarker,
    selected,
    type,
    itemSelectedHandler,
    itemSelectedHandlerData,
  } = property;
  const onChange = () => {
    const inputElementValue = inputElement.current.value;
    const selectElementValue = selectElement.current.value;
    const value = `${selectElementValue}${inputElementValue}`;

    const { key, subKey, index } = itemSelectedHandlerData;
    itemSelectedHandler(value, key, subKey, index);
  };

  return (
    <div className="container">
      <label
        htmlFor={title}
        className="item1"
        placeholder={description}
        key={keyProp}
      >
        <span>{title?.replaceAll('_', ' ')} &nbsp; </span>
      </label>
      <div className="item2">
        <div className="select-input-pair">
          <select
            ref={selectElement}
            id={id}
            name={title}
            data-marker={dataMarker}
            className="select-input-pair__item1"
            onChange={() => onChange()}
          >
            {dataList?.map((example) => (
              <option
                id={example || 'blank'}
                value={example}
                key={example.replaceAll(' ', '')}
                selected={example === selected}
              >
                {example}
              </option>
            ))}
          </select>
          <input
            ref={inputElement}
            type={type}
            className="select-input-pair__item1"
            onChange={() => onChange()}
          />
        </div>
      </div>
    </div>
  );
};

SelectInputPairElement.propType = {
  id: PropTypes.string.isRequired,
  dataList: PropTypes.instanceOf(Array).isRequired,
  description: PropTypes.string,
  keyProp: PropTypes.string,
  title: PropTypes.string,
  type: PropTypes.string,
  dataMarker: PropTypes.string,
  itemSelectedHandler: PropTypes.func.isRequired,
  itemSelectedHandlerData: PropTypes.instanceOf(Object).isRequired,
  selected: PropTypes.string,
};

SelectInputPairElement.defaultProps = {
  itemSelectedHandler: () => {},
  itemSelectedHandlerData: {},
  type: 'text',
  dataMarker: 'n/a',
  selected: '',
};

export default SelectInputPairElement;
