import React from 'react';
import PropTypes from 'prop-types';

const SelectElement = (property) => {
  const {
    id,
    examples,
    description,
    keyProp,
    title,
    dataMarker,
    itemSelectedHandler,
    itemSelectedHandlerData,
  } = property;

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
        <select
          id={id}
          name={title}
          data-marker={dataMarker}
          className="select-base-width"
          onChange={(e) => itemSelectedHandler(e, itemSelectedHandlerData)}
        >
          {examples?.map((example) => {
            const sanitizedKey = example?.trim()?.replaceAll(' ', '') || '';
            const sanitizedId = id?.replaceAll('#', '');
            const key =
              sanitizedKey === ''
                ? `blank-SelectElement-Item-${sanitizedId}`
                : sanitizedKey;
            return (
              <option id={example || 'blank'} value={example} key={key}>
                {example}
              </option>
            );
          })}
        </select>
      </div>
    </div>
  );
};

SelectElement.propType = {
  id: PropTypes.string.isRequired,
  examples: PropTypes.instanceOf(Array).isRequired,
  description: PropTypes.string,
  keyProp: PropTypes.string,
  title: PropTypes.string,
  dataMarker: PropTypes.string,
  itemSelectedHandler: PropTypes.func.isRequired,
  itemSelectedHandlerData: PropTypes.instanceOf(Object).isRequired,
  selected: PropTypes.string,
};

SelectElement.defaultProps = {
  itemSelectedHandler: () => {},
  itemSelectedHandlerData: {},
  dataMarker: 'n/a',
  selected: '',
};

export default SelectElement;
