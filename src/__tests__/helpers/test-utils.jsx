import { render } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { StoreProvider } from '../../state/StoreContext';
import { defaultYMLValues } from '../../valueList';

/**
 * Custom render with common providers (includes StoreProvider)
 *
 * @param {React.ReactElement} ui - Component to render
 * @param {Object} options - Render options
 * @param {Object} options.initialState - Initial state for the store (merged with defaults)
 * @param {Object} options.renderOptions - Additional options to pass to render()
 * @returns {Object} Render result with user-event instance
 *
 * @example
 * renderWithProviders(<SubjectFields />, {
 *   initialState: { subject: { subject_id: 'rat01' } }
 * });
 */
export function renderWithProviders(ui, options = {}) {
  const { initialState, ...renderOptions } = options;
  const user = userEvent.setup();

  // Merge initialState with defaults (deep merge for nested objects)
  const mergedState = initialState
    ? { ...defaultYMLValues, ...initialState }
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
