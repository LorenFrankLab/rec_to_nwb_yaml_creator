/**
 * Bad-channel checkboxes must write to the ntrode they are rendered for.
 *
 * ntrode_electrode_group_channel_map is one flat array across all electrode
 * groups, so the target must be located by the ntrode's position in that
 * array, not by the electrode group's index (which only coincides for
 * single-shank groups in creation order).
 */

import { describe, it, expect } from 'vitest';
import React from 'react';
import { screen, within } from '@testing-library/react';
import { renderWithProviders } from '../../__tests__/helpers/test-utils';
import { useStoreContext } from '../../state/StoreContext';
import ElectrodeGroupFields from '../ElectrodeGroupFields';

function StateProbe() {
  const { model } = useStoreContext();
  return (
    <span data-testid="bad">
      {JSON.stringify(model.ntrode_electrode_group_channel_map.map((n) => n.bad_channels))}
    </span>
  );
}

const group = (id, device_type) => ({
  id,
  location: 'CA1',
  device_type,
  description: '',
  targeted_location: '',
  targeted_x: 0,
  targeted_y: 0,
  targeted_z: 0,
  units: 'mm',
});
const ntrode = (electrode_group_id, ntrode_id, offset) => ({
  electrode_group_id,
  ntrode_id,
  bad_channels: [],
  map: { 0: offset, 1: offset + 1, 2: offset + 2, 3: offset + 3 },
});

const badChannelsOf = () => JSON.parse(screen.getByTestId('bad').textContent);
const badChannelBox = (shankFieldset, channel) =>
  within(within(shankFieldset).getByText('Bad Channels').closest('fieldset')).getByLabelText(channel);


describe('ElectrodeGroupFields - bad channels target the rendered ntrode', () => {
  it('writes to the second shank of a multi-shank group', async () => {
    const { user } = renderWithProviders(
      <>
        <ElectrodeGroupFields />
        <StateProbe />
      </>,
      {
        initialState: {
          electrode_groups: [group(0, '32c-2s8mm6cm-20um-40um-dl')],
          ntrode_electrode_group_channel_map: [ntrode(0, 1, 0), ntrode(0, 2, 4)],
        },
      }
    );
    const shank2 = screen.getByText('Shank #2').closest('fieldset');
    await user.click(badChannelBox(shank2, '1'));

    expect(badChannelsOf()).toEqual([[], [1]]);
  });

  it('writes to the right ntrode when an earlier group has several shanks', async () => {
    const { user } = renderWithProviders(
      <>
        <ElectrodeGroupFields />
        <StateProbe />
      </>,
      {
        initialState: {
          electrode_groups: [group(0, '32c-2s8mm6cm-20um-40um-dl'), group(1, 'tetrode_12.5')],
          ntrode_electrode_group_channel_map: [ntrode(0, 1, 0), ntrode(0, 2, 4), ntrode(1, 3, 8)],
        },
      }
    );
    const secondGroup = document.querySelector('#electrode_group_item_1-area');
    const shank = within(secondGroup).getByText('Shank #1').closest('fieldset');
    await user.click(badChannelBox(shank, '2'));

    expect(badChannelsOf()).toEqual([[], [], [2]]);
  });
});
