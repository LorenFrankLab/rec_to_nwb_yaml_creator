import { render } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { StoreProvider } from '../../state/StoreContext';

/**
 * Custom render with common providers (includes StoreProvider)
 */
export function renderWithProviders(ui, options = {}) {
  const user = userEvent.setup();

  return {
    user,
    ...render(<StoreProvider>{ui}</StoreProvider>, options),
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
