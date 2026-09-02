/**
 * The optogenetic stimulation software input must read and write the
 * `optogenetic_stimulation_software` key: that is the key in the form
 * defaults, the schema, and the one trodes_to_nwb reads. Binding it to any
 * other key makes the field show blank after import and exports a stray key.
 */

import { describe, it, expect } from 'vitest';
import React from 'react';
import { screen } from '@testing-library/react';
import { renderWithProviders } from '../../__tests__/helpers/test-utils';
import { useStoreContext } from '../../state/StoreContext';
import OptogeneticsFields from '../OptogeneticsFields';

function StateProbe() {
  const { model } = useStoreContext();
  return (
    <div>
      <span data-testid="software">{String(model.optogenetic_stimulation_software)}</span>
      <span data-testid="stray-key">{String('opto_software' in model)}</span>
    </div>
  );
}

describe('OptogeneticsFields - stimulation software', () => {
  it('shows the imported optogenetic_stimulation_software value', () => {
    renderWithProviders(<OptogeneticsFields />, {
      initialState: { optogenetic_stimulation_software: 'fsgui' },
    });
    expect(screen.getByLabelText('Optogenetic Stimulation Software')).toHaveValue('fsgui');
  });

  it('writes typed text to optogenetic_stimulation_software only', async () => {
    const { user } = renderWithProviders(
      <>
        <OptogeneticsFields />
        <StateProbe />
      </>,
      { initialState: { optogenetic_stimulation_software: '' } }
    );
    const input = screen.getByLabelText('Optogenetic Stimulation Software');
    await user.type(input, 'fsgui');
    await user.tab();

    expect(screen.getByTestId('software')).toHaveTextContent('fsgui');
    expect(screen.getByTestId('stray-key')).toHaveTextContent('false');
  });
});
