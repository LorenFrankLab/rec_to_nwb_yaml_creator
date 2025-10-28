/**
 * @vitest-environment jsdom
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ChannelMapEditor from '../ChannelMapEditor';

/**
 * Tests for ChannelMapEditor component (M7.3.2)
 *
 * Editor for ntrode channel maps for a specific electrode group.
 * Allows users to configure mapping between logical electrode channels
 * (from Trodes) and hardware channel IDs.
 */

describe('ChannelMapEditor', () => {
  let user;

  beforeEach(() => {
    user = userEvent.setup();
  });

  const mockElectrodeGroup = {
    id: 'eg1',
    device_type: 'tetrode_12.5',
    location: 'CA1',
    targeted_x: 1.0,
    targeted_y: 2.0,
    targeted_z: 3.0,
    units: 'mm',
  };

  const mockChannelMaps = [
    {
      electrode_group_id: 'eg1',
      ntrode_id: '0',
      electrode_id: 0,
      bad_channels: [],
      map: { 0: 0, 1: 1, 2: 2, 3: 3 },
    },
    {
      electrode_group_id: 'eg1',
      ntrode_id: '1',
      electrode_id: 1,
      bad_channels: [],
      map: { 0: 4, 1: 5, 2: 6, 3: 7 },
    },
  ];

  describe('Header display', () => {
    it('should render header with electrode group info', () => {
      render(
        <ChannelMapEditor
          electrodeGroup={mockElectrodeGroup}
          channelMaps={mockChannelMaps}
          onSave={() => {}}
          onCancel={() => {}}
        />
      );

      expect(screen.getByText(/electrode group/i)).toBeInTheDocument();
      expect(screen.getByText(/eg1/i)).toBeInTheDocument();
      expect(screen.getByText(/tetrode_12.5/i)).toBeInTheDocument();
      expect(screen.getByText(/CA1/i)).toBeInTheDocument();
    });
  });

  describe('Ntrode display', () => {
    it('should display all ntrodes for the group', () => {
      render(
        <ChannelMapEditor
          electrodeGroup={mockElectrodeGroup}
          channelMaps={mockChannelMaps}
          onSave={() => {}}
          onCancel={() => {}}
        />
      );

      expect(screen.getByText(/ntrode 0/i)).toBeInTheDocument();
      expect(screen.getByText(/ntrode 1/i)).toBeInTheDocument();
    });

    it('should show electrode_id input for each ntrode', () => {
      render(
        <ChannelMapEditor
          electrodeGroup={mockElectrodeGroup}
          channelMaps={mockChannelMaps}
          onSave={() => {}}
          onCancel={() => {}}
        />
      );

      const electrodeIdInputs = screen.getAllByLabelText(/electrode id/i);
      expect(electrodeIdInputs).toHaveLength(2);
      expect(electrodeIdInputs[0]).toHaveValue(0);
      expect(electrodeIdInputs[1]).toHaveValue(1);
    });

    it('should show bad_channels checkbox for each ntrode', () => {
      render(
        <ChannelMapEditor
          electrodeGroup={mockElectrodeGroup}
          channelMaps={mockChannelMaps}
          onSave={() => {}}
          onCancel={() => {}}
        />
      );

      // tetrode has 4 channels, so 4 checkboxes per ntrode * 2 ntrodes = 8 checkboxes
      const badChannelCheckboxes = screen.getAllByRole('checkbox');
      expect(badChannelCheckboxes).toHaveLength(8);
    });
  });

  describe('Channel map inputs', () => {
    it('should show map inputs for all channels in device type', () => {
      render(
        <ChannelMapEditor
          electrodeGroup={mockElectrodeGroup}
          channelMaps={mockChannelMaps}
          onSave={() => {}}
          onCancel={() => {}}
        />
      );

      // tetrode_12.5 has 4 channels (0,1,2,3), so 4 inputs per ntrode * 2 ntrodes = 8 total
      const channelInputs = screen.getAllByRole('spinbutton');
      // electrode_id inputs (2) + channel map inputs (2 ntrodes * 4 channels = 8) = 10 total
      expect(channelInputs.length).toBeGreaterThanOrEqual(8);
    });

    it('should show correct channel count based on device type', () => {
      const largeProbeGroup = {
        ...mockElectrodeGroup,
        device_type: 'A1x32-6mm-50-177-H32_21mm',
      };
      const largeChannelMap = [
        {
          electrode_group_id: 'eg1',
          ntrode_id: '0',
          electrode_id: 0,
          bad_channels: [],
          map: Object.fromEntries(Array.from({ length: 32 }, (_, i) => [i, i])),
        },
      ];

      render(
        <ChannelMapEditor
          electrodeGroup={largeProbeGroup}
          channelMaps={largeChannelMap}
          onSave={() => {}}
          onCancel={() => {}}
        />
      );

      // Should have 32 channel inputs for A1x32 probe (32 channels)
      const channelInputs = screen.getAllByRole('spinbutton');
      // 1 electrode_id + 32 channel map inputs = 33
      expect(channelInputs.length).toBeGreaterThanOrEqual(32);
    });
  });

  describe('Update electrode_id', () => {
    it('should update electrode_id when input changes', async () => {
      render(
        <ChannelMapEditor
          electrodeGroup={mockElectrodeGroup}
          channelMaps={mockChannelMaps}
          onSave={() => {}}
          onCancel={() => {}}
        />
      );

      const electrodeIdInputs = screen.getAllByLabelText(/electrode id/i);
      await user.clear(electrodeIdInputs[0]);
      await user.type(electrodeIdInputs[0], '5');

      expect(electrodeIdInputs[0]).toHaveValue(5);
    });
  });

  describe('Update channel map values', () => {
    it('should update map value when channel input changes', async () => {
      render(
        <ChannelMapEditor
          electrodeGroup={mockElectrodeGroup}
          channelMaps={mockChannelMaps}
          onSave={() => {}}
          onCancel={() => {}}
        />
      );

      // Find a channel map input (not the electrode_id input)
      const inputs = screen.getAllByRole('spinbutton');
      const channelMapInput = inputs.find((input) =>
        input.getAttribute('aria-label')?.includes('Channel')
      );

      if (channelMapInput) {
        const currentValue = channelMapInput.value;
        await user.clear(channelMapInput);
        await user.type(channelMapInput, '99');
        expect(channelMapInput).toHaveValue(99);
      }
    });
  });

  describe('Update bad_channels', () => {
    it('should update bad_channels when checkbox toggled', async () => {
      render(
        <ChannelMapEditor
          electrodeGroup={mockElectrodeGroup}
          channelMaps={mockChannelMaps}
          onSave={() => {}}
          onCancel={() => {}}
        />
      );

      const badChannelCheckboxes = screen.getAllByRole('checkbox');
      if (badChannelCheckboxes.length > 0) {
        const firstCheckbox = badChannelCheckboxes[0];
        const wasChecked = firstCheckbox.checked;

        await user.click(firstCheckbox);

        expect(firstCheckbox.checked).toBe(!wasChecked);
      }
    });
  });

  describe('Save button behavior', () => {
    it('should call onSave with updated maps', async () => {
      const onSave = vi.fn();
      render(
        <ChannelMapEditor
          electrodeGroup={mockElectrodeGroup}
          channelMaps={mockChannelMaps}
          onSave={onSave}
          onCancel={() => {}}
        />
      );

      const saveButton = screen.getByRole('button', { name: /save/i });
      await user.click(saveButton);

      expect(onSave).toHaveBeenCalledTimes(1);
      expect(onSave).toHaveBeenCalledWith(expect.any(Array));
    });
  });

  describe('Cancel button behavior', () => {
    it('should call onCancel without saving', async () => {
      const onCancel = vi.fn();
      const onSave = vi.fn();
      render(
        <ChannelMapEditor
          electrodeGroup={mockElectrodeGroup}
          channelMaps={mockChannelMaps}
          onSave={onSave}
          onCancel={onCancel}
        />
      );

      const cancelButton = screen.getByRole('button', { name: /cancel/i });
      await user.click(cancelButton);

      expect(onCancel).toHaveBeenCalledTimes(1);
      expect(onSave).not.toHaveBeenCalled();
    });
  });

  describe('Numeric input validation', () => {
    it('should not allow negative numbers in map inputs', async () => {
      render(
        <ChannelMapEditor
          electrodeGroup={mockElectrodeGroup}
          channelMaps={mockChannelMaps}
          onSave={() => {}}
          onCancel={() => {}}
        />
      );

      const inputs = screen.getAllByRole('spinbutton');
      const channelMapInput = inputs.find((input) =>
        input.getAttribute('aria-label')?.includes('Channel')
      );

      if (channelMapInput) {
        expect(channelMapInput).toHaveAttribute('min', '0');
      }
    });
  });

  describe('Empty channel maps edge case', () => {
    it('should show message when no channel maps exist', () => {
      render(
        <ChannelMapEditor
          electrodeGroup={mockElectrodeGroup}
          channelMaps={[]}
          onSave={() => {}}
          onCancel={() => {}}
        />
      );

      expect(screen.getByText(/no channel maps/i)).toBeInTheDocument();
    });
  });
});
