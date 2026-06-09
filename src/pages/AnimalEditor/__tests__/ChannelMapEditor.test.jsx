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
 * WIRING-ONLY: this editor edits only the channel→hardware `map` assignments.
 * Bad channels are owned per recording day (Day Editor's BadChannelsEditor) and are
 * neither displayed nor edited here. Tests verify:
 * - Fieldset with "Shank #N" legend
 * - Readonly "Ntrode Id" field with InfoIcon
 * - "Map" section with select dropdowns (NOT number inputs)
 * - NO bad-channel control of any kind renders
 */

describe('ChannelMapEditor', () => {
  let user;

  beforeEach(() => {
    user = userEvent.setup();
    // Mock window.alert to prevent "Not implemented" errors in validation
    vi.stubGlobal('alert', vi.fn());
  });

  const mockElectrodeGroup = {
    id: 1,
    device_type: 'tetrode_12.5',
    location: 'CA1',
    targeted_x: 1.0,
    targeted_y: 2.0,
    targeted_z: 3.0,
    units: 'mm',
  };

  const mockChannelMaps = [
    {
      electrode_group_id: 1,
      ntrode_id: 0,
      bad_channels: [],
      map: { 0: 0, 1: 1, 2: 2, 3: 3 },
    },
    {
      electrode_group_id: 1,
      ntrode_id: 1,
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

      expect(screen.getByText(/electrode group: 1/i)).toBeInTheDocument();
      expect(screen.getByText(/tetrode_12.5/i)).toBeInTheDocument();
      expect(screen.getByText(/CA1/i)).toBeInTheDocument();
    });

    it('renders with integer IDs without PropType warnings', () => {
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      render(
        <ChannelMapEditor
          electrodeGroup={mockElectrodeGroup}
          channelMaps={mockChannelMaps}
          onSave={() => {}}
          onCancel={() => {}}
        />
      );
      const propTypeWarnings = errorSpy.mock.calls.filter(
        (args) => typeof args[0] === 'string' && args[0].includes('Failed prop type')
      );
      expect(propTypeWarnings).toEqual([]);
      errorSpy.mockRestore();
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

  });

  // Bad channels are owned per recording day, not at the animal level. This editor is
  // wiring-only: it must render NO bad-channel control (checkbox grid, probe-wide
  // selector, repair button, or "Bad Channels" label). Pinned against re-introduction.
  describe('No bad-channel UI (day-owned; wiring-only editor)', () => {
    it('renders no bad-channel control for a single-shank group', () => {
      const { container } = render(
        <ChannelMapEditor
          electrodeGroup={mockElectrodeGroup}
          channelMaps={mockChannelMaps}
          onSave={() => {}}
          onCancel={() => {}}
        />
      );

      // No checkbox grid testids, no checkboxes at all, no "Bad Channels" label/heading.
      expect(screen.queryByTestId('bad-channels-checkboxes-0')).not.toBeInTheDocument();
      expect(screen.queryByTestId('bad-channels-checkboxes-1')).not.toBeInTheDocument();
      expect(container.querySelectorAll('input[type="checkbox"]')).toHaveLength(0);
      expect(screen.queryByText(/bad channel/i)).not.toBeInTheDocument();
      expect(screen.queryByText(/mark.*as bad/i)).not.toBeInTheDocument();
    });

    it('renders no probe-wide bad-channel selector for a multi-shank group', () => {
      const group64c3s = {
        id: 2,
        device_type: '64c-3s6mm6cm-20um-40um-sl',
        location: 'CA1',
        units: 'mm',
      };
      const shankMap = (offset, len) =>
        Object.fromEntries(Array.from({ length: len }, (_, i) => [i, offset + i]));
      const maps = [
        { electrode_group_id: 2, ntrode_id: 0, bad_channels: [], map: shankMap(0, 21) },
        { electrode_group_id: 2, ntrode_id: 1, bad_channels: [], map: shankMap(21, 21) },
        { electrode_group_id: 2, ntrode_id: 2, bad_channels: [], map: shankMap(42, 22) },
      ];
      const { container } = render(
        <ChannelMapEditor
          electrodeGroup={group64c3s}
          channelMaps={maps}
          onSave={() => {}}
          onCancel={() => {}}
        />
      );

      expect(screen.queryByTestId('bad-channels-checkboxes-0')).not.toBeInTheDocument();
      expect(container.querySelectorAll('input[type="checkbox"]')).toHaveLength(0);
      expect(screen.queryByText(/bad channel/i)).not.toBeInTheDocument();
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
          electrode_group_id: 1,
          ntrode_id: 0,
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

  describe('Probe Metadata Contract: per-shank grids (uneven 64c-3s)', () => {
    // 64c-3s partitions 64 electrodes UNEVENLY across 3 shanks (21/21/22). The
    // editor must derive each shank's Map grid from the probe catalog, not from a
    // single uniform channel array — otherwise shank 3 (22 channels) loses key 21
    // (electrode id 63) from its Map dropdowns. (Bad channels are day-owned and not
    // edited here.)
    const group64c3s = {
      id: 2,
      device_type: '64c-3s6mm6cm-20um-40um-sl',
      location: 'CA1',
      targeted_x: 1.0,
      targeted_y: 2.0,
      targeted_z: 3.0,
      units: 'mm',
    };
    const shankMap = (offset, len) =>
      Object.fromEntries(Array.from({ length: len }, (_, i) => [i, offset + i]));
    const maps64c3s = [
      { electrode_group_id: 2, ntrode_id: 0, bad_channels: [], map: shankMap(0, 21) },
      { electrode_group_id: 2, ntrode_id: 1, bad_channels: [], map: shankMap(21, 21) },
      { electrode_group_id: 2, ntrode_id: 2, bad_channels: [], map: shankMap(42, 22) },
    ];

    it('renders the third shank with 22 channels (keys 0..21), not 21', () => {
      const { container } = render(
        <ChannelMapEditor
          electrodeGroup={group64c3s}
          channelMaps={maps64c3s}
          onSave={() => {}}
          onCancel={() => {}}
        />
      );

      const fieldsets = container.querySelectorAll('.ntrode-fieldset');
      expect(fieldsets).toHaveLength(3);

      // Per-shank map dropdown counts must be 21 / 21 / 22.
      const mapSelectCounts = Array.from(fieldsets).map(
        (fs) => fs.querySelectorAll('.ntrode-map select').length
      );
      expect(mapSelectCounts).toEqual([21, 21, 22]);

      // The third shank's last Map channel (local key 21 → electrode id 63) must
      // exist as a Map dropdown.
      const lastFieldsetSelects = fieldsets[2].querySelectorAll('.ntrode-map select');
      expect(lastFieldsetSelects).toHaveLength(22);
    });

    it('saves without dropping electrode id 63 (no spurious validation error)', () => {
      const onSave = vi.fn();
      render(
        <ChannelMapEditor
          electrodeGroup={group64c3s}
          channelMaps={maps64c3s}
          onSave={onSave}
          onCancel={() => {}}
        />
      );
      fireEvent.click(screen.getByTestId('editor-save'));
      expect(onSave).toHaveBeenCalledTimes(1);
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
