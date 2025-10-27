import React, { memo } from 'react';
import PropTypes from 'prop-types';
import { sanitizeTitle } from '../utils';
import InfoIcon from './InfoIcon';
import { useQuickChecks } from '../validation/useQuickChecks';
import { HintDisplay } from '../validation/HintDisplay';


/**
 * Provides an extended select tag for selection one option from a list
 *
 * Performance: Wrapped in React.memo to prevent unnecessary re-renders
 *
 * @param {Object} prop Custom element's properties
 *
 * @returns Virtual DOM wrapping an HTML select tag and supporting markup and code
 */
const SelectElementComponent = (prop) => {
  const {
    id,
    name,
    type,
    title,
    dataItems,
    placeholder,
    dataItemsInfo,
    value,
    onChange,
    addBlankOption,
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

  const handleChange = (e) => {
    if (validation) {
      quickChecks.validate(name, e.target.value);
    }
    if (onChange) {
      onChange(e);
    }
  };

  // Handle blur event to escalate hint to error if invalid
  const handleBlur = (e) => {
    if (validation) {
      quickChecks.validateOnBlur(name, e.target.value);
    }
  };

  // Generate hint ID for aria-describedby linking
  const hintId = validation ? `${id}-hint` : undefined;

  return (
    <label className="container" htmlFor={id}>
      <div className="item1" title={title}>
        {title} <InfoIcon infoText={placeholder} />
      </div>
      <div className="item2">
        <select
          id={id}
          name={name}
          onChange={handleChange}
          onBlur={handleBlur}
          value={value}
          required={required}
          aria-describedby={hintId}
        >
          {addBlankOption ? (
            <option value="" name={name}>
              &nbsp;
            </option>
          ) : null}
          {[dataItems].flat().map((dataItem, dataItemIndex) => {
            const dataItemValue =
              type === 'number' && dataItem !== ''
                ? parseInt(dataItem, 10)
                : dataItem;

            // Include index in key to ensure uniqueness even with duplicate values
            const keyOption =
              dataItemValue !== ''
                ? `${dataItemIndex}-${dataItem}-${sanitizeTitle(dataItem)}`
                : `${title}-0-selectItem-${dataItemIndex}`;

            const TitleOption =
              dataItemsInfo?.length > 0
                ? `${dataItemValue} (${dataItemsInfo[dataItemIndex] || ''})`
                : dataItem;

            return (
              <option key={keyOption} value={dataItem} name={name}>
                {TitleOption}
              </option>
            );
          })}
        </select>
        {validation && (
          <HintDisplay id={hintId} hint={quickChecks.hint} isRequired={required} />
        )}
      </div>
    </label>
  );
};

SelectElementComponent.propTypes = {
  title: PropTypes.string.isRequired,
  value: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  dataItems: PropTypes.arrayOf(PropTypes.string).isRequired,
  dataItemsInfo: PropTypes.arrayOf(PropTypes.string),
  addBlankOption: PropTypes.bool,
  id: PropTypes.string.isRequired,
  type: PropTypes.string.isRequired,
  name: PropTypes.string.isRequired,
  placeholder: PropTypes.string,
  onChange: PropTypes.func,
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

SelectElementComponent.defaultProps = {
  value: '',
  placeholder: '',
  dataItemsInfo: [],
  addBlankOption: false,
  type: 'text',
  onChange: () => {},
  required: false,
  validation: null,
};

const arePropsEqual = (prevProps, nextProps) => {
  return (
    prevProps.value === nextProps.value &&
    prevProps.name === nextProps.name &&
    prevProps.dataItems === nextProps.dataItems &&
    prevProps.required === nextProps.required
  );
};

const SelectElement = memo(SelectElementComponent, arePropsEqual);

export default SelectElement;
