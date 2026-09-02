/**
 * A stored 0 must render as "0", not as an empty field.
 *
 * These inputs guarded their value with `||`, so a stored 0 displayed blank;
 * leaving the field then parsed that blank to NaN and wrote it to form state,
 * which validation rejects as a type error on export. emptyFormData seeds both
 * fields with 0, so a failed or partial import reaches this state.
 */

import { describe, it, expect } from 'vitest';
import React from 'react';
import { screen } from '@testing-library/react';
import { renderWithProviders } from '../../__tests__/helpers/test-utils';
import { useStoreContext } from '../../state/StoreContext';
import TechnicalFields from '../TechnicalFields';

function StateProbe() {
  const { model } = useStoreContext();
  return (
    <span data-testid="state">
      {JSON.stringify([model.times_period_multiplier, model.raw_data_to_volts])}
    </span>
  );
}

const fields = [
  ['Times Period Multiplier', 'times_period_multiplier'],
  ['Ephys-to-Volt Conversion Factor', 'raw_data_to_volts'],
];

describe('TechnicalFields - zero values', () => {
  it.each(fields)('renders a stored 0 in %s', (label) => {
    renderWithProviders(<TechnicalFields />, {
      initialState: { times_period_multiplier: 0, raw_data_to_volts: 0 },
    });
    expect(screen.getByLabelText(new RegExp(label, 'i'))).toHaveValue(0);
  });

  it('keeps 0 in state after the field is focused and left', async () => {
    const { user } = renderWithProviders(
      <><TechnicalFields /><StateProbe /></>,
      { initialState: { times_period_multiplier: 0, raw_data_to_volts: 0 } }
    );

    await user.click(screen.getByLabelText(/Times Period Multiplier/i));
    await user.tab();
    await user.tab();

    expect(JSON.parse(screen.getByTestId('state').textContent)).toEqual([0, 0]);
  });
});
