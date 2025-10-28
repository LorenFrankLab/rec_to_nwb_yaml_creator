import React, { memo } from 'react';
import PropTypes from 'prop-types';
import { sanitizeTitle, stringToInteger } from '../utils';
import InfoIcon from './InfoIcon';
import { useStableId } from '../hooks/useStableId';

/**
 * Checkbox collection where multiple items can be selected
 *
 * Uses semantic HTML with fieldset/legend for accessibility
 * Performance: Wrapped in React.memo to prevent unnecessary re-renders
 *
 * @param {Object} prop Custom element's properties
 *
 * @returns Virtual DOM collection for multi-select checkboxes
 */
const CheckboxListComponent = (prop) => {
  const {
    id: providedId,
    name,
    title,
    dataItems,
    objectKind,
    placeholder,
    defaultValue,
    updateFormArray,
    metaData,
    required,
  } = prop;

  const id = useStableId(providedId, 'checkbox-list');

  const onChecked = (e) => {
    const { target } = e;
    const value = parseInt(target.value, 10);
    // const values = Array.from(
    //   target.parentElement.querySelectorAll('input[type="checkbox"]:checked')
    // ).map((a) => parseInt(a.value, 10));

    const { nameValue, keyValue, index } = metaData;
    updateFormArray(nameValue, value, keyValue, index, e.target.checked);
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
                    type="checkbox"
                    id={`${id}-${dataItemIndex}`}
                    name={`${name}-${id}`}
                    value={dataItem}
                    defaultChecked={defaultValue.includes(stringToInteger(dataItem))}
                    onClick={onChecked}
                    required={required && dataItemIndex === 0 ? true : undefined}
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

CheckboxListComponent.propTypes = {
  title: PropTypes.string.isRequired,
  defaultValue: PropTypes.instanceOf(Array),
  dataItems: PropTypes.arrayOf(PropTypes.oneOfType([PropTypes.string, PropTypes.number])),
  id: PropTypes.string,
  objectKind: PropTypes.string,
  type: PropTypes.string,
  name: PropTypes.string.isRequired,
  placeholder: PropTypes.string,
  updateFormArray: PropTypes.func,
  metaData: PropTypes.instanceOf(Object),
  required: PropTypes.bool,
};

CheckboxListComponent.defaultProps = {
  id: undefined,
  defaultValue: [],
  dataItems: [],
  placeholder: '',
  objectKind: '',
  updateFormArray: () => {},
  metaData: {},
  required: false,
};

const arePropsEqual = (prevProps, nextProps) => {
  return (
    prevProps.defaultValue === nextProps.defaultValue &&
    prevProps.dataItems === nextProps.dataItems &&
    prevProps.name === nextProps.name &&
    prevProps.required === nextProps.required
  );
};

const CheckboxList = memo(CheckboxListComponent, arePropsEqual);

// Copy static properties to memoized component for backward compatibility
CheckboxList.propTypes = CheckboxListComponent.propTypes;
CheckboxList.defaultProps = CheckboxListComponent.defaultProps;

export default CheckboxList;
