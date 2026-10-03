/**
 * FsGUI epochs multi-select must stay in sync with stored state.
 *
 * The epochs CheckboxList for an fs_gui_yamls entry must show exactly the
 * epochs stored on that entry, and toggling a box must add/remove against that
 * entry's stored epochs. If the boxes do not reflect stored state, a user who
 * loads/imports an entry that already has epochs sees them all unchecked and,
 * by clicking, silently appends epochs onto the hidden set — so the exported
 * YAML accumulates epochs the user never intended.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { screen, within } from '@testing-library/react';
import { renderWithProviders } from '../../__tests__/helpers/test-utils';
import OptogeneticsFields from '../OptogeneticsFields';

describe('OptogeneticsFields - FsGUI epochs selection', () => {
  let initialState;

  beforeEach(() => {
    initialState = {
      // Tasks define which epoch numbers are selectable (1..7).
      tasks: [{ task_epochs: [1, 2, 3, 4, 5, 6, 7] }],
      // One FsGUI entry that already has epochs 1 and 3 stored on it.
      fs_gui_yamls: [
        {
          name: 'fsgui_test.yaml',
          power_in_mW: 20,
          epochs: [1, 3],
          dio_output_name: '',
          camera_id: '',
          state_script_parameters: false,
        },
      ],
    };
  });

  const epochsFieldset = () => screen.getByRole('group', { name: /Epochs/i });

  it('shows the epochs stored on the entry as checked', () => {
    renderWithProviders(<OptogeneticsFields />, { initialState });

    const fieldset = epochsFieldset();
    expect(within(fieldset).getByLabelText('1')).toBeChecked();
    expect(within(fieldset).getByLabelText('2')).not.toBeChecked();
    expect(within(fieldset).getByLabelText('3')).toBeChecked();
    expect(within(fieldset).getByLabelText('7')).not.toBeChecked();
  });

  it('unchecking an epoch removes only that epoch (no silent accumulation)', async () => {
    const { user } = renderWithProviders(<OptogeneticsFields />, {
      initialState,
    });

    // Stored epochs are [1, 3]; the user deselects epoch 1.
    await user.click(within(epochsFieldset()).getByLabelText('1'));

    expect(within(epochsFieldset()).getByLabelText('1')).not.toBeChecked();
    expect(within(epochsFieldset()).getByLabelText('3')).toBeChecked();
  });
});
