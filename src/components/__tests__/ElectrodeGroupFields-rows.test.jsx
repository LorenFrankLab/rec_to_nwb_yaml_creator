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
  it('types into the group typed into after Duplicate inserts copies before it', { timeout: 30000 }, async () => {
    const { user } = renderGroups({ electrode_groups: [group(0)] });

    for (let i = 0; i < 3; i += 1) {
      await user.click(within(groupArea(0)).getByRole('button', { name: 'Duplicate' }));
    }
    expect(model().electrode_groups.map((g) => g.id)).toEqual([0, 3, 2, 1]);

    await user.type(descriptionInput(1), 'a');
    await user.type(descriptionInput(2), 'b');
    await user.type(descriptionInput(3), 'c');

    expect(model().electrode_groups.map((g) => [g.id, g.description])).toEqual([
      [0, ''],
      [3, 'c'],
      [2, 'b'],
      [1, 'a'],
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

  it('types into a group added after the others', async () => {
    const { user } = renderGroups({ electrode_groups: [group(0, 'first')] });

    await user.click(screen.getByRole('button', { name: '＋' }));
    await user.type(descriptionInput(1), 'second');

    expect(model().electrode_groups.map((g) => [g.id, g.description])).toEqual([
      [0, 'first'],
      [1, 'second'],
    ]);
  });
});

describe('ElectrodeGroupFields - editing a group id', () => {
  it('keeps the field focused while typing and stores an integer', async () => {
    const { user } = renderGroups({ electrode_groups: [group(0), group(1)] });

    const idInput = within(groupArea(1)).getByLabelText(/^Id$/);
    await user.clear(idInput);
    await user.type(idInput, '12');

    expect(idInput).toHaveFocus();
    expect(idInput).toHaveValue(12);

    await user.tab();

    expect(model().electrode_groups.map((g) => g.id)).toEqual([0, 12]);
  });
});

describe('ElectrodeGroupFields - read-only Ntrode Id', () => {
  // 64c-4s6mm6cm-20um-40um-dl: 4 shanks of 16 electrodes, ntrode ids 1-4
  const shankNtrode = (shank) => ({
    ntrode_id: shank + 1,
    electrode_group_id: 0,
    bad_channels: [],
    map: Object.fromEntries(Array.from({ length: 16 }, (_, k) => [k, shank * 16 + k])),
  });

  it('leaving the Ntrode Id fields changes no ntrode id', async () => {
    const { user } = renderGroups({
      electrode_groups: [{ ...group(0), device_type: '64c-4s6mm6cm-20um-40um-dl' }],
      ntrode_electrode_group_channel_map: [0, 1, 2, 3].map(shankNtrode),
    });
    const ntrodeIdInputs = screen.getAllByPlaceholderText('Ntrode Id');

    await user.click(ntrodeIdInputs[1]);
    await user.click(descriptionInput(0));
    expect(model().ntrode_electrode_group_channel_map.map((n) => n.ntrode_id)).toEqual([1, 2, 3, 4]);

    for (const input of ntrodeIdInputs) {
      await user.click(input);
    }
    await user.click(descriptionInput(0));
    expect(model().ntrode_electrode_group_channel_map.map((n) => n.ntrode_id)).toEqual([1, 2, 3, 4]);
  });
});
