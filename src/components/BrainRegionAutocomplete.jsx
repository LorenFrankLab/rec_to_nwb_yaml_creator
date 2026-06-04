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

export const BRAIN_REGIONS = [
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

/**
 * Resolve a typed region value to its canonical form against a list of known
 * regions, preventing case-only spelling drift (e.g. `ca1` → `CA1`) that would
 * fragment Spyglass `BrainRegion` rows.
 *
 * - Empty / whitespace-only input returns `''` (the caller treats this as invalid).
 * - An exact match returns the value unchanged.
 * - A case-insensitive match snaps to the canonical known spelling.
 * - Anything else returns the trimmed value (a legitimate new "other" region).
 *
 * @param {string} value - Raw typed value.
 * @param {string[]} [knownRegions=BRAIN_REGIONS] - Canonical region list.
 * @returns {string} Canonical region string (or '' when blank).
 */
export function canonicalizeRegion(value, knownRegions = BRAIN_REGIONS) {
  const trimmed = (value ?? '').trim();
  if (trimmed === '') return '';
  if (knownRegions.includes(trimmed)) return trimmed;
  const caseMatch = knownRegions.find((r) => r.toLowerCase() === trimmed.toLowerCase());
  return caseMatch || trimmed;
}

const BrainRegionAutocompleteComponent = ({
  value = '',
  onChange,
  label = 'Brain Region',
  name,
  required = false,
  suggestions = [],
}) => {
  const id = useStableId(undefined, 'brain-region');
  const datalistId = `${id}-list`;

  // Merge the canonical regions with any workspace-derived suggestions, deduped
  // and order-stable (canonical first), so already-used regions are also offered.
  const regionOptions = [...new Set([...BRAIN_REGIONS, ...suggestions])];

  const handleChange = (e) => {
    if (onChange) {
      onChange(e.target.value);
    }
  };

  // Snap to the canonical spelling on blur so a case-only variant (e.g. "ca1")
  // visibly becomes the known region ("CA1") while the user is still in the form,
  // rather than changing silently on save.
  const handleBlur = () => {
    if (!onChange) return;
    const snapped = canonicalizeRegion(value, regionOptions);
    if (snapped !== '' && snapped !== value) {
      onChange(snapped);
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
        onBlur={handleBlur}
        name={name}
        required={required}
      />
      <datalist id={datalistId}>
        {regionOptions.map((region) => (
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
  suggestions: PropTypes.arrayOf(PropTypes.string),
};

BrainRegionAutocompleteComponent.defaultProps = {
  value: '',
  label: 'Brain Region',
  name: undefined,
  required: false,
  suggestions: [],
};

const arePropsEqual = (prevProps, nextProps) => {
  return (
    prevProps.value === nextProps.value &&
    prevProps.label === nextProps.label &&
    prevProps.name === nextProps.name &&
    prevProps.required === nextProps.required &&
    prevProps.suggestions === nextProps.suggestions
  );
};

const BrainRegionAutocomplete = memo(BrainRegionAutocompleteComponent, arePropsEqual);

export default BrainRegionAutocomplete;
