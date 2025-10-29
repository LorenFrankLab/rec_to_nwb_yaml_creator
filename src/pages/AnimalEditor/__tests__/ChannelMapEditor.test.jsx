/**
 * @vitest-environment jsdom
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ChannelMapEditor from '../ChannelMapEditor';

/**
 * Tests for ChannelMapEditor component (M7.3.2)
 *
 * Editor for ntrode channel maps for a specific electrode group.
 * Allows users to configure mapping between logical electrode channels
 * (from Trodes) and hardware channel IDs.
 *
 * LEGACY LAYOUT MATCH: Tests verify exact layout from original ChannelMap.jsx:
 * - Fieldset with "Shank #N" legend
 * - Readonly "Ntrode Id" field with InfoIcon
 * - "Bad Channels" checkbox grid (NOT comma-separated input)
 * - "Map" section with select dropdowns (NOT number inputs)
 */

describe('ChannelMapEditor', () => {
  let user;

  beforeEach(() => {
    user = userEvent.setup();
    // Mock window.alert to prevent "Not implemented" errors in validation
    vi.stubGlobal('alert', vi.fn());
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
      bad_channels: [1],
      map: { 0: 0, 1: 1, 2: 2, 3: 3 },
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

  describe('Ntrode display (Legacy Layout)', () => {
    it('should display "Shank #N" fieldsets for all ntrodes', () => {
      render(
        <ChannelMapEditor
          electrodeGroup={mockElectrodeGroup}
          channelMaps={mockChannelMaps}
          onSave={() => {}}
          onCancel={() => {}}
        />
      );

      // Legacy layout uses "Shank #1", "Shank #2" instead of "Ntrode 0", "Ntrode 1"
      expect(screen.getByText('Shank #1')).toBeInTheDocument();
      expect(screen.getByText('Shank #2')).toBeInTheDocument();
    });

    it('should show readonly Ntrode Id field for each shank', () => {
      render(
        <ChannelMapEditor
          electrodeGroup={mockElectrodeGroup}
          channelMaps={mockChannelMaps}
          onSave={() => {}}
          onCancel={() => {}}
        />
      );

      // Ntrode Id fields are readonly (disabled) in legacy layout
      const ntrodeIdInput0 = screen.getByTestId('ntrode-id-0');
      const ntrodeIdInput1 = screen.getByTestId('ntrode-id-1');

      expect(ntrodeIdInput0).toBeInTheDocument();
      expect(ntrodeIdInput1).toBeInTheDocument();
      expect(ntrodeIdInput0).toHaveValue(0);
      expect(ntrodeIdInput1).toHaveValue(1);
      expect(ntrodeIdInput0).toBeDisabled();
      expect(ntrodeIdInput1).toBeDisabled();
    });

    it('should show bad channels checkbox grid for each ntrode', () => {
      render(
        <ChannelMapEditor
          electrodeGroup={mockElectrodeGroup}
          channelMaps={mockChannelMaps}
          onSave={() => {}}
          onCancel={() => {}}
        />
      );

      // Legacy layout uses individual checkboxes, NOT comma-separated input
      const badChannelsCheckboxes0 = screen.getByTestId('bad-channels-checkboxes-0');
      const badChannelsCheckboxes1 = screen.getByTestId('bad-channels-checkboxes-1');

      expect(badChannelsCheckboxes0).toBeInTheDocument();
      expect(badChannelsCheckboxes1).toBeInTheDocument();

      // Ntrode 1 should have channel 1 checked (from mock bad_channels: [1])
      const channel1Checkbox = screen.getByLabelText('Mark channel 1 as bad for ntrode 1');
      expect(channel1Checkbox).toBeChecked();
    });
  });

  describe('Channel map selects (Legacy Layout)', () => {
    it('should show select dropdowns for all channels in device type', () => {
      render(
        <ChannelMapEditor
          electrodeGroup={mockElectrodeGroup}
          channelMaps={mockChannelMaps}
          onSave={() => {}}
          onCancel={() => {}}
        />
      );

      // Legacy layout uses <select> dropdowns, NOT number inputs
      // tetrode_12.5 has 4 channels (0,1,2,3), so 4 selects per ntrode * 2 ntrodes = 8 total
      const channelSelects = screen.getAllByRole('combobox');
      expect(channelSelects.length).toBe(8);
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

      // Should have 32 channel select dropdowns for A1x32 probe (32 channels)
      const channelSelects = screen.getAllByRole('combobox');
      expect(channelSelects).toHaveLength(32);
    });
  });

  describe('Update channel map values (Legacy Layout)', () => {
    it('should update map value when select dropdown changes', async () => {
      render(
        <ChannelMapEditor
          electrodeGroup={mockElectrodeGroup}
          channelMaps={mockChannelMaps}
          onSave={() => {}}
          onCancel={() => {}}
        />
      );

      // Find a channel map select dropdown
      const channelSelect = screen.getByLabelText('Hardware channel mapping for channel 0 in ntrode 0');

      expect(channelSelect).toBeInTheDocument();
      expect(channelSelect.tagName).toBe('SELECT');

      // Change value using fireEvent (select dropdowns)
      fireEvent.change(channelSelect, { target: { value: '2' } });

      expect(channelSelect).toHaveValue('2');
    });
  });

  describe('Update bad_channels (Legacy Layout)', () => {
    it('should update bad_channels when checkbox toggled', async () => {
      render(
        <ChannelMapEditor
          electrodeGroup={mockElectrodeGroup}
          channelMaps={mockChannelMaps}
          onSave={() => {}}
          onCancel={() => {}}
        />
      );

      // Legacy layout uses checkboxes, NOT comma-separated text input
      const channel0Checkbox = screen.getByLabelText('Mark channel 0 as bad for ntrode 0');
      const channel2Checkbox = screen.getByLabelText('Mark channel 2 as bad for ntrode 0');

      expect(channel0Checkbox).not.toBeChecked();
      expect(channel2Checkbox).not.toBeChecked();

      // Toggle checkboxes
      await user.click(channel0Checkbox);
      await user.click(channel2Checkbox);

      expect(channel0Checkbox).toBeChecked();
      expect(channel2Checkbox).toBeChecked();
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
