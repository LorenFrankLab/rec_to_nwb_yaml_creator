import React from 'react';
import PropTypes from 'prop-types';
import { sanitizeTitle } from '../utils';
import InfoIcon from './InfoIcon';
import { useStableId } from '../hooks/useStableId';



/**
 * Radio collection where only one item can be selected
 *
 * Uses semantic HTML with fieldset/legend for accessibility
 *
 * @param {object} prop Custom element's properties
 *
 * @returns Virtual DOM collection for single-select radio buttons
 */
const RadioList = (prop) => {
  const {
    id: providedId,
    name,
    title,
    dataItems,
    objectKind,
    placeholder,
    defaultValue,
    updateFormData,
    metaData,
    type = 'number',
    required,
  } = prop;

  const id = useStableId(providedId, 'radio-list');

  const onChecked = (e) => {
    const { target } = e;
    const { value } = target;
    let radioValue;
    if (type === 'number') {
      radioValue = parseInt(value, 10);
    }
    else {radioValue = value;}
    const { nameValue, keyValue, index } = metaData;

    updateFormData(nameValue, radioValue, keyValue, index);
  };

  return (
    <div className="container">
      <div className="item1">
        <InfoIcon infoText={placeholder} />
      </div>
      <div className="item2">
        <fieldset aria-required={required || undefined}>
          <legend>{title}</legend>
          <div className={`checkbox-list ${dataItems.length > 0 ? '' : 'hide'}`}>
            {dataItems.map((dataItem, dataItemIndex) => {
              return (
                <div
                  className="checkbox-list-item"
                  key={`${id}-${dataItemIndex}-${sanitizeTitle(dataItem)}`}
                >
                  <input
                    type="radio"
                    id={`${id}-${dataItemIndex}`}
                    name={`${name}-${id}`}
                    value={dataItem}
                    defaultChecked={defaultValue === dataItem}
                    onClick={onChecked}
                    required={required || undefined}
                  />
                  <label htmlFor={`${id}-${dataItemIndex}`}> {dataItem}</label>
                </div>
              );
            })}
          </div>
          {dataItems.length === 0 ? (
            <span className="checkbox-list--no-data ">
              No {objectKind} Item available
            </span>
          ) : null}
        </fieldset>
      </div>
    </div>
  );
};

RadioList.propTypes = {
  title: PropTypes.string.isRequired,
  defaultValue: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  dataItems: PropTypes.arrayOf(PropTypes.oneOfType([PropTypes.string, PropTypes.number])),
  id: PropTypes.string,
  objectKind: PropTypes.string,
  type: PropTypes.string,
  name: PropTypes.string.isRequired,
  placeholder: PropTypes.string,
  updateFormData: PropTypes.func,
  metaData: PropTypes.instanceOf(Object),
  required: PropTypes.bool,
};

RadioList.defaultProps = {
  id: undefined,
  defaultValue: '',
  dataItems: [],
  placeholder: '',
  objectKind: '',
  updateFormData: () => {},
  metaData: {},
  required: false,
};

export default RadioList;
