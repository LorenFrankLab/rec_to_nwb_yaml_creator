import { render } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { StoreProvider } from '../../state/StoreContext';
import { defaultYMLValues } from '../../valueList';

/**
 * Deep merge helper - recursively merges objects while preserving nested structure
 * @param {Object} target - Target object (defaults)
 * @param {Object} source - Source object (overrides)
 * @returns {Object} Deeply merged object
 */
function deepMerge(target, source) {
  const output = { ...target };

  Object.keys(source).forEach(key => {
    const sourceValue = source[key];
    const targetValue = target[key];

    // Deep merge nested objects (but not arrays)
    if (
      sourceValue &&
      typeof sourceValue === 'object' &&
      !Array.isArray(sourceValue) &&
      targetValue &&
      typeof targetValue === 'object' &&
      !Array.isArray(targetValue)
    ) {
      output[key] = deepMerge(targetValue, sourceValue);
    } else {
      // Replace primitives, arrays, or null values
      output[key] = sourceValue;
    }
  });

  return output;
}

/**
 * Custom render with common providers (includes StoreProvider)
 *
 * @param {React.ReactElement} ui - Component to render
 * @param {Object} options - Render options
 * @param {Object} options.initialState - Initial state for the store (deep-merged with defaults)
 * @param {Object} options.renderOptions - Additional options to pass to render()
 * @returns {Object} Render result with user-event instance
 *
 * @example
 * // Partial state - deep merges with defaults
 * renderWithProviders(<SubjectFields />, {
 *   initialState: { subject: { subject_id: 'rat01' } }
 * });
 * // Result: subject has subject_id='rat01' AND all other default subject fields
 *
 * @example
 * // Complete state override
 * renderWithProviders(<SubjectFields />, {
 *   initialState: {
 *     subject: {
 *       description: 'Test',
 *       species: 'Rattus',
 *       genotype: 'WT',
 *       sex: 'M',
 *       subject_id: 'rat01',
 *       date_of_birth: '2023-01-01',
 *       weight: '350'
 *     }
 *   }
 * });
 */
export function renderWithProviders(ui, options = {}) {
  const { initialState, ...renderOptions } = options;
  const user = userEvent.setup();

  // Deep merge initialState with defaults to preserve nested structure
  const mergedState = initialState
    ? deepMerge(defaultYMLValues, initialState)
    : defaultYMLValues;

  return {
    user,
    ...render(<StoreProvider initialState={mergedState}>{ui}</StoreProvider>, renderOptions),
  };
}

/**
 * Wait for async validation to complete
 */
export async function waitForValidation(timeout = 1000) {
  return new Promise(resolve => setTimeout(resolve, timeout));
}

/**
 * Generate test YAML data
 */
export function createTestYaml(overrides = {}) {
  const base = {
    experimenter_name: ['Doe, John'],
    lab: 'Test Lab',
    institution: 'Test Institution',
    data_acq_device: [
      {
        name: 'TestDevice',
        system: 'TestSystem',
        amplifier: 'TestAmp',
        adc_circuit: 'TestADC',
      },
    ],
    times_period_multiplier: 1.5,
    raw_data_to_volts: 0.195,
  };

  return { ...base, ...overrides };
}
