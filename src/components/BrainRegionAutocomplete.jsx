import React, { memo } from 'react';
import PropTypes from 'prop-types';
import { useStableId } from '../hooks/useStableId';

/**
 * Brain Region Autocomplete Component
 *
 * Provides autocomplete input for selecting brain regions with predefined suggestions.
 * Allows custom input for novel regions while suggesting common rodent neuroscience
 * brain regions to promote naming consistency (preventing CA1 vs ca1 vs Ca1 variants).
 *
 * Critical for Spyglass database compatibility - consistent brain region naming
 * prevents fragmentation of database queries and ensures proper spatial analysis.
 *
 * Uses native HTML5 datalist for accessibility and no external dependencies.
 *
 * @component
 * @example
 * const [region, setRegion] = useState('');
 * <BrainRegionAutocomplete
 *   value={region}
 *   onChange={setRegion}
 *   label="Recording Location"
 *   name="brain_region"
 *   required={true}
 * />
 */

const BRAIN_REGIONS = [
  // Hippocampus
  'CA1',
  'CA2',
  'CA3',
  'DG',
  // Prefrontal Cortex
  'PFC',
  'mPFC',
  'OFC',
  // Motor Cortex
  'M1',
  'M2',
  // Somatosensory Cortex
  'S1',
  'S2',
  // Visual Cortex
  'V1',
  'V2',
  // Reward/Motivation Systems
  'NAc',
  'VTA',
  // Other Common Regions
  'Amy',
  'Striatum',
  'SNc',
];

const BrainRegionAutocompleteComponent = ({
  value = '',
  onChange,
  label = 'Brain Region',
  name,
  required = false,
}) => {
  const id = useStableId(undefined, 'brain-region');
  const datalistId = `${id}-list`;

  const handleChange = (e) => {
    if (onChange) {
      onChange(e.target.value);
    }
  };

  return (
    <label htmlFor={id}>
      {label}
      <input
        id={id}
        type="text"
        list={datalistId}
        value={value ?? ''}
        onChange={handleChange}
        name={name}
        required={required}
      />
      <datalist id={datalistId}>
        {BRAIN_REGIONS.map((region) => (
          <option key={region} value={region} />
        ))}
      </datalist>
    </label>
  );
};

BrainRegionAutocompleteComponent.propTypes = {
  value: PropTypes.string,
  onChange: PropTypes.func.isRequired,
  label: PropTypes.string,
  name: PropTypes.string,
  required: PropTypes.bool,
};

BrainRegionAutocompleteComponent.defaultProps = {
  value: '',
  label: 'Brain Region',
  name: undefined,
  required: false,
};

const arePropsEqual = (prevProps, nextProps) => {
  return (
    prevProps.value === nextProps.value &&
    prevProps.label === nextProps.label &&
    prevProps.name === nextProps.name &&
    prevProps.required === nextProps.required
  );
};

const BrainRegionAutocomplete = memo(BrainRegionAutocompleteComponent, arePropsEqual);

export default BrainRegionAutocomplete;
