import React from 'react';
import PropTypes from 'prop-types';
import { sanitizeTitle } from '../utils';
import InfoIcon from './InfoIcon';
import { useQuickChecks } from '../validation/useQuickChecks';
import { HintDisplay } from '../validation/HintDisplay';
import { useStableId } from '../hooks/useStableId';

/**
 * Data list providing users options to select from and allowing them to write their own selection
 *
 * Supports both controlled and uncontrolled patterns:
 * - Controlled: pass `value` + `onChange` props
 * - Uncontrolled: pass `defaultValue` prop (legacy)
 *
 * @param {Object} prop Custom element's properties
 *
 * @returns Virtual DOM contain an HTML Datalist with supporting HTML tags and code
 */
const DataListElement = (prop) => {
  const {
    id: providedId,
    name,
    title,
    dataItems,
    value,
    defaultValue,
    onChange,
    placeholder,
    type,
    onBlur,
    required,
    validation,
  } = prop;

  const id = useStableId(providedId, 'datalist');
  const isControlled = value !== undefined;

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

  const handleChange = (e) => {
    if (onChange) {
      onChange(e);
    }

    if (validation) {
      quickChecks.validate(name, e.target.value);
    }
  };

  // Handle blur event to escalate hint to error if invalid
  const handleBlur = (e) => {
    // Call validation first (escalate to error if needed)
    if (validation) {
      quickChecks.validateOnBlur(name, e.target.value);
    }

    // Then call parent onBlur for any additional processing
    if (onBlur) {
      onBlur(e);
    }
  };

  // Generate hint ID for aria-describedby linking
  const hintId = validation ? `${id}-hint` : undefined;

  const inputProps = {
    id,
    type,
    list: `${id}-list`,
    name,
    placeholder,
    required,
    onBlur: handleBlur,
    'aria-describedby': hintId,
  };

  if (isControlled) {
    inputProps.value = value;
    inputProps.onChange = handleChange;
  } else {
    inputProps.defaultValue = defaultValue;
  }

  return (
    <label className="container" htmlFor={id}>
      <div className="item1">
        {title} <InfoIcon infoText={placeholder} />
      </div>
      <div className="item2 data-list">
        <input
          {...inputProps}
          key={!isControlled ? defaultValue : undefined}
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
          <HintDisplay id={hintId} hint={quickChecks.hint} isRequired={required} />
        )}
      </div>
    </label>
  );
};

DataListElement.propTypes = {
  title: PropTypes.string.isRequired,
  type: PropTypes.string,
  value: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  defaultValue: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  onChange: PropTypes.func,
  dataItems: PropTypes.arrayOf(PropTypes.string),
  placeholder: PropTypes.string,
  id: PropTypes.string,
  name: PropTypes.string.isRequired,
  onBlur: PropTypes.func,
  required: PropTypes.bool,
  validation: PropTypes.shape({
    type: PropTypes.oneOf(['required', 'dateFormat', 'enum', 'numberRange', 'pattern']),
    debounceMs: PropTypes.number,
    validValues: PropTypes.array,
    min: PropTypes.number,
    max: PropTypes.number,
    unit: PropTypes.string,
    pattern: PropTypes.instanceOf(RegExp),
    patternMessage: PropTypes.string,
  }),
};

DataListElement.defaultProps = {
  id: undefined,
  type: 'text',
  value: undefined,
  defaultValue: '',
  onChange: undefined,
  placeholder: '',
  dataItems: [],
  onBlur: undefined,
  required: false,
  validation: null,
};

export default DataListElement;
