import React from 'react';
import PropTypes from 'prop-types';
import InfoIcon from './InfoIcon';
import { useQuickChecks } from '../validation/useQuickChecks';
import { HintDisplay } from '../validation/HintDisplay';
import { useStableId } from '../hooks/useStableId';

/**
 * Provides a text box
 *
 * Supports both controlled and uncontrolled patterns:
 * - Controlled: pass `value` + `onChange` props
 * - Uncontrolled: pass `defaultValue` prop (legacy, for backward compatibility)
 *
 * @param {Object} prop Custom element's properties
 *
 * @returns Virtual DOM for creating an input[type="string|number"] with
 * supporting HTML tags and code
 */
const InputElement = (prop) => {
  const {
    id: providedId,
    type,
    title,
    name,
    placeholder,
    value,
    defaultValue,
    onChange,
    min,
    required,
    onBlur,
    readOnly,
    pattern,
    step,
    validation,
  } = prop;

  // Generate stable, unique ID
  const id = useStableId(providedId, 'input');

  // Determine if controlled or uncontrolled
  const isControlled = value !== undefined;

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

  // Handle input/change events
  const handleChange = (e) => {
    // Call parent onChange for controlled components
    if (onChange) {
      onChange(e);
    }

    // Run validation if enabled
    if (validation) {
      // For type="number", check validity.badInput (browser blocked invalid chars)
      if (type === 'number' && e.target.validity?.badInput) {
        quickChecks.validate(name, 'INVALID_NUMBER_INPUT');
        return;
      }

      // Normal validation for all other cases
      quickChecks.validate(name, e.target.value);
    }
  };

  // Handle blur event to escalate hint to error if invalid
  const handleBlur = (e) => {
    // Call validation first (escalate to error if needed)
    if (validation) {
      // For type="number", check badInput again in case user blurred with invalid chars
      if (type === 'number' && e.target.validity?.badInput) {
        quickChecks.validateOnBlur(name, 'INVALID_NUMBER_INPUT');
      } else {
        quickChecks.validateOnBlur(name, e.target.value);
      }
    }

    // Then call parent onBlur for any additional processing
    if (onBlur) {
      onBlur(e);
    }
  };

  // Helper to format date values for controlled inputs
  const getDateValue = (val) => {
    if (!val) {
      return '';
    }

    const valString = String(val);

    // If value is already in YYYY-MM-DD format, return it directly
    if (/^\d{4}-\d{2}-\d{2}$/.test(valString)) {
      return valString;
    }

    // For ISO 8601 datetime strings, extract the date part
    if (valString.includes('T')) {
      return valString.split('T')[0];
    }

    // Fallback: parse as date (this may have timezone issues)
    const dateObj = new Date(valString);

    const month = `0${dateObj.getMonth() + 1}`.slice(-2);
    const day = `0${dateObj.getDate()}`.slice(-2);
    const year = dateObj.getFullYear();

    return `${year}-${month}-${day}`;
  };

  // Helper to format date values for uncontrolled inputs (legacy)
  const getDefaultDateValue = () => {
    if (!defaultValue) {
      return '';
    }

    return getDateValue(defaultValue);
  };

  // Generate hint ID for aria-describedby linking
  const hintId = validation ? `${id}-hint` : undefined;

  // Prepare input props based on controlled/uncontrolled mode
  const inputProps = {
    id,
    type,
    name,
    className: `base-width ${readOnly ? 'gray-out' : ''}`,
    placeholder,
    required,
    readOnly,
    step,
    min,
    pattern,
    'aria-describedby': hintId,
    onBlur: handleBlur,
  };

  if (isControlled) {
    // Controlled mode: use value + onChange
    inputProps.value = type === 'date' ? getDateValue(value) : value;
    inputProps.onChange = handleChange;
  } else {
    // Uncontrolled mode: use defaultValue
    inputProps.defaultValue = type === 'date' ? getDefaultDateValue() : defaultValue;
    // If validation enabled in uncontrolled mode, still need to trigger validation
    if (validation || onChange) {
      inputProps.onChange = handleChange;
    }
  }

  return (
    <label className="container" htmlFor={id}>
      <div className="item1">
        {title} <InfoIcon infoText={placeholder} />
      </div>
      <div className="item2">
        <input
          {...inputProps}
          key={!isControlled ? (type === 'date' ? getDefaultDateValue() : defaultValue) : undefined}
        />
        {validation && (
          <HintDisplay id={hintId} hint={quickChecks.hint} isRequired={required} />
        )}
      </div>
    </label>
  );
};

InputElement.propTypes = {
  title: PropTypes.string.isRequired,
  id: PropTypes.string, // Optional - will be auto-generated if not provided
  type: PropTypes.string.isRequired,
  name: PropTypes.string.isRequired,
  placeholder: PropTypes.string,
  readOnly: PropTypes.bool,
  required: PropTypes.bool,
  step: PropTypes.string,
  min: PropTypes.string,
  // Controlled mode
  value: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  onChange: PropTypes.func,
  // Uncontrolled mode (legacy)
  defaultValue: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  pattern: PropTypes.string,
  onBlur: PropTypes.func,
  validation: PropTypes.shape({
    type: PropTypes.oneOf(['required', 'dateFormat', 'enum', 'numberRange', 'pattern']).isRequired,
    debounceMs: PropTypes.number,
    validValues: PropTypes.arrayOf(PropTypes.string),
    min: PropTypes.number,
    max: PropTypes.number,
    unit: PropTypes.string,
    pattern: PropTypes.instanceOf(RegExp),
    patternMessage: PropTypes.string,
  }),
};

InputElement.defaultProps = {
  id: undefined,
  required: false,
  placeholder: '',
  value: undefined,
  defaultValue: '',
  onChange: undefined,
  readOnly: false,
  step: 'any',
  pattern: '^.+$',
  min: '',
  onBlur: undefined,
  validation: null,
};

export default InputElement;
