/**
 * Editing an electrode group must change that group and nothing else, also
 * after Duplicate or Remove has moved the rows around.
 */

import { describe, it, expect, vi, afterEach } from 'vitest';
import React from 'react';
import { screen, within } from '@testing-library/react';
import { renderWithProviders } from '../../__tests__/helpers/test-utils';
import { useStoreContext } from '../../state/StoreContext';
import ElectrodeGroupFields from '../ElectrodeGroupFields';

function StateProbe() {
  const { model } = useStoreContext();
  return <span data-testid="model">{JSON.stringify(model)}</span>;
}

const model = () => JSON.parse(screen.getByTestId('model').textContent);
const groupArea = (id) => document.querySelector(`#electrode_group_item_${id}-area`);
const descriptionInput = (id) => within(groupArea(id)).getByPlaceholderText(/^Description$/);

const group = (id, description = '') => ({
  id,
  location: 'CA1',
  device_type: '',
  description,
  targeted_location: '',
  targeted_x: 0,
  targeted_y: 0,
  targeted_z: 0,
  units: 'mm',
});

const renderGroups = (state) =>
  renderWithProviders(
    <>
      <ElectrodeGroupFields />
      <StateProbe />
    </>,
    { initialState: { ntrode_electrode_group_channel_map: [], ...state } }
  );

afterEach(() => {
  vi.restoreAllMocks();
});

describe('ElectrodeGroupFields - rows that move', () => {
  it('types into the group typed into after Duplicate inserts copies before it', async () => {
    const { user } = renderGroups({ electrode_groups: [group(0)] });

    for (let i = 0; i < 3; i += 1) {
      await user.click(within(groupArea(0)).getByRole('button', { name: 'Duplicate' }));
    }
    expect(model().electrode_groups.map((g) => g.id)).toEqual([0, 3, 2, 1]);

    await user.type(descriptionInput(1), 'tetrode 1');
    await user.type(descriptionInput(2), 'tetrode 2');
    await user.type(descriptionInput(3), 'tetrode 3');

    expect(model().electrode_groups.map((g) => [g.id, g.description])).toEqual([
      [0, ''],
      [3, 'tetrode 3'],
      [2, 'tetrode 2'],
      [1, 'tetrode 1'],
    ]);
  });

  it('types into the group typed into after Remove shifts the rows up', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    const { user } = renderGroups({
      electrode_groups: [group(0, 'first'), group(1, 'second'), group(2, 'third')],
    });

    await user.click(within(groupArea(0)).getByRole('button', { name: 'Remove' }));
    await user.type(descriptionInput(2), '!');

    expect(model().electrode_groups.map((g) => [g.id, g.description])).toEqual([
      [1, 'second'],
      [2, 'third!'],
    ]);
  });
});
