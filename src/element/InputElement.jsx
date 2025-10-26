import React from 'react';
import PropTypes from 'prop-types';
import InfoIcon from './InfoIcon';
import { useQuickChecks } from '../validation/useQuickChecks';
import { HintDisplay } from '../validation/HintDisplay';

/**
 * Provides a text box
 *
 * @param {Object} prop Custom element's properties
 *
 * @returns Virtual DOM for creating an input[type="string|number"] with
 * supporting HTML tags and code
 */
const InputElement = (prop) => {
  const {
    id,
    type,
    title,
    name,
    placeholder,
    defaultValue,
    min,
    required,
    onBlur,
    readOnly,
    pattern,
    step,
    validation,
  } = prop;

  // Initialize quick checks validation (always call hook per Rules of Hooks)
  // When validation prop is null, pass dummy values that won't be used
  const quickChecks = useQuickChecks(
    validation?.type || 'required',
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

  const getDefaultDateValue = () => {
    if (!defaultValue) {
      return '';
    }

    // If defaultValue is already in YYYY-MM-DD format, return it directly
    // This avoids timezone conversion issues with new Date()
    if (/^\d{4}-\d{2}-\d{2}$/.test(defaultValue)) {
      return defaultValue;
    }

    // For ISO 8601 datetime strings, extract the date part
    if (defaultValue.includes('T')) {
      return defaultValue.split('T')[0];
    }

    // Fallback: parse as date (this may have timezone issues)
    const dateObj = new Date(defaultValue);

    // get the month in this format of 04, the same for months
    const month = `0${dateObj.getMonth() + 1}`.slice(-2);
    const day = `0${dateObj.getDate()}`.slice(-2); // FIX: removed +1 (getDate already returns 1-31)
    const year = dateObj.getFullYear();

    const shortDate = `${year}-${month}-${day}`;

    return shortDate;
  };

  return (
    <label className="container" htmlFor={id}>
      <div className="item1">
        {title} <InfoIcon infoText={placeholder} />
      </div>
      <div className="item2">
        <input
          id={id}
          type={type}
          name={name}
          className={`base-width ${readOnly ? 'gray-out' : ''}`}
          placeholder={placeholder}
          defaultValue={type !== 'date' ? defaultValue : getDefaultDateValue()}
          key={defaultValue}
          required={required}
          readOnly={readOnly}
          step={step}
          min={min}
          onChange={validation ? (e) => quickChecks.validate(name, e.target.value) : undefined}
          onBlur={(e) => onBlur(e)}
          pattern={pattern}
        />
        {validation && (
          <HintDisplay hint={quickChecks.hint} isRequired={required} />
        )}
      </div>
    </label>
  );
};

InputElement.propTypes = {
  title: PropTypes.string.isRequired,
  id: PropTypes.string.isRequired,
  type: PropTypes.string.isRequired,
  name: PropTypes.string.isRequired,
  placeholder: PropTypes.string,
  readOnly: PropTypes.bool,
  required: PropTypes.bool,
  step: PropTypes.string,
  min: PropTypes.string,
  defaultValue: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  pattern: PropTypes.string,
  onBlur: PropTypes.func,
  validation: PropTypes.shape({
    type: PropTypes.oneOf(['required', 'dateFormat', 'enum', 'numberRange', 'pattern']).isRequired,
    debounceMs: PropTypes.number,
    validValues: PropTypes.arrayOf(PropTypes.string),
    min: PropTypes.number,
    max: PropTypes.number,
    pattern: PropTypes.instanceOf(RegExp),
    patternMessage: PropTypes.string,
  }),
};

InputElement.defaultProps = {
  required: false,
  placeholder: '',
  defaultValue: '',
  readOnly: false,
  step: 'any',
  pattern: '^.+$',
  min: '',
  onBlur: () => {},
  validation: null,
};

export default InputElement;
