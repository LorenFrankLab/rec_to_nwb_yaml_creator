/**
 * Inputs for virus injection volume and fsgui train interval must be bound to
 * the keys the schema and trodes_to_nwb read (volume_in_ul, trainInterval).
 */

import { describe, it, expect } from 'vitest';
import React from 'react';
import { screen } from '@testing-library/react';
import { renderWithProviders } from '../../__tests__/helpers/test-utils';
import { useStoreContext } from '../../state/StoreContext';
import { arrayDefaultValues } from '../../valueList';
import OptogeneticsFields from '../OptogeneticsFields';

function StateProbe() {
  const { model } = useStoreContext();
  return (
    <div>
      <span data-testid="virus">{JSON.stringify(model.virus_injection[0])}</span>
      <span data-testid="fsgui">{JSON.stringify(model.fs_gui_yamls[0])}</span>
    </div>
  );
}

const initialState = {
  virus_injection: [{ ...arrayDefaultValues.virus_injection }],
  fs_gui_yamls: [{ ...arrayDefaultValues.fs_gui_yamls, state_script_parameters: true }],
  opto_excitation_source: [],
  optical_fiber: [],
};

describe('OptogeneticsFields - schema key bindings', () => {
  it('stores the injection volume under volume_in_ul only', async () => {
    const { user } = renderWithProviders(
      <>
        <OptogeneticsFields />
        <StateProbe />
      </>,
      { initialState }
    );
    const input = screen.getByLabelText('Volume (ul)');
    await user.clear(input);
    await user.type(input, '0.6');
    await user.tab();

    const virus = JSON.parse(screen.getByTestId('virus').textContent);
    expect(virus.volume_in_ul).toBe(0.6);
    expect(virus).not.toHaveProperty('volume_in_uL');
  });

  it('stores the train interval under trainInterval only', async () => {
    const { user } = renderWithProviders(
      <>
        <OptogeneticsFields />
        <StateProbe />
      </>,
      { initialState }
    );
    const input = screen.getByLabelText('Train Interval (ms)');
    await user.clear(input);
    await user.type(input, '6000');
    await user.tab();

    const fsgui = JSON.parse(screen.getByTestId('fsgui').textContent);
    expect(fsgui.trainInterval).toBe(6000);
    expect(fsgui).not.toHaveProperty('train_interval');
  });
});
