import React from 'react';
import PropTypes from 'prop-types';
import { sanitizeTitle } from '../utils';
import InfoIcon from './InfoIcon';
import { useQuickChecks } from '../validation/useQuickChecks';
import { HintDisplay } from '../validation/HintDisplay';

/**
 * Data list providing users options to select from and allowing them to write their own selection
 *
 * @param {Object} prop Custom element's properties
 *
 * @returns Virtual DOM contain an HTML Datalist with supporting HTML tags and code
 */
const DataListElement = (prop) => {
  const {
    id,
    name,
    title,
    dataItems,
    defaultValue,
    placeholder,
    type,
    onBlur,
    required,
    validation,
  } = prop;

  const quickChecks = useQuickChecks(
    validation?.type,
    {
      debounceMs: validation?.debounceMs,
      validValues: validation?.validValues,
      min: validation?.min,
      max: validation?.max,
      unit: validation?.unit,
      pattern: validation?.pattern,
      patternMessage: validation?.patternMessage,
    }
  );

  return (
    <label className="container" htmlFor={id}>
      <div className="item1">
        {title} <InfoIcon infoText={placeholder} />
      </div>
      <div className="item2 data-list">
        <input
          id={id}
          type={type}
          list={`${id}-list`}
          name={name}
          placeholder={placeholder}
          defaultValue={defaultValue}
          key={defaultValue}
          required={required}
          onChange={validation ? (e) => quickChecks.validate(name, e.target.value) : undefined}
          onBlur={onBlur}
        />
        <datalist id={`${id}-list`} name={name}>
          {dataItems.map((dataItem, dataItemIndex) => {
            return (
              <option
                key={`${dataItemIndex}-${sanitizeTitle(dataItem)}`}
                value={dataItem}
                name={name}
              >
                {dataItem}
              </option>
            );
          })}
        </datalist>
        {validation && (
          <HintDisplay hint={quickChecks.hint} isRequired={required} />
        )}
      </div>
    </label>
  );
};

DataListElement.propTypes = {
  title: PropTypes.string.isRequired,
  type: PropTypes.oneOf([PropTypes.string, PropTypes.number]),
  defaultValue: PropTypes.oneOf([PropTypes.string, PropTypes.number]),
  dataItems: PropTypes.arrayOf(PropTypes.string),
  placeholder: PropTypes.string,
  id: PropTypes.string.isRequired,
  name: PropTypes.string.isRequired,
  onBlur: PropTypes.func,
  required: PropTypes.bool,
  validation: PropTypes.shape({
    type: PropTypes.oneOf(['required', 'dateFormat', 'enum', 'numberRange', 'pattern']),
    debounceMs: PropTypes.number,
    validValues: PropTypes.array,
    min: PropTypes.number,
    max: PropTypes.number,
    pattern: PropTypes.instanceOf(RegExp),
    patternMessage: PropTypes.string,
  }),
};

DataListElement.defaultProps = {
  type: 'text',
  defaultValue: '',
  placeholder: '',
  onBlur: () => {},
  required: false,
  validation: null,
};

export default DataListElement;
