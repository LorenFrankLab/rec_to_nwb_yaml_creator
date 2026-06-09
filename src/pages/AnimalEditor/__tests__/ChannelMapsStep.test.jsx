import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ChannelMapsStep from '../ChannelMapsStep';

describe('ChannelMapsStep', () => {
  const mockAnimal = {
    id: 'remy',
    devices: {
      electrode_groups: [
        { id: 0, device_type: 'tetrode_12.5', location: 'CA1', targeted_x: 2.6, targeted_y: -3.8, targeted_z: 0, units: 'mm' },
        { id: 1, device_type: 'tetrode_12.5', location: 'CA3', targeted_x: 2.8, targeted_y: -3.6, targeted_z: 0, units: 'mm' }
      ],
      ntrode_electrode_group_channel_map: [
        { ntrode_id: 0, electrode_group_id: 0, map: { 0: 0, 1: 1, 2: 2, 3: 3 }, bad_channels: [] },
        { ntrode_id: 1, electrode_group_id: 0, map: { 0: 4, 1: 5, 2: 6, 3: 7 }, bad_channels: [] },
        { ntrode_id: 2, electrode_group_id: 0, map: { 0: 8, 1: 9, 2: 10, 3: 11 }, bad_channels: [] },
        { ntrode_id: 3, electrode_group_id: 0, map: { 0: 12, 1: 13, 2: 14, 3: 15 }, bad_channels: [] },
        // Group 1 is partially mapped (only 2 out of 4 channels)
        { ntrode_id: 4, electrode_group_id: 1, map: { 0: 0, 1: 1 }, bad_channels: [] },
      ]
    }
  };

  const mockOnEditChannelMap = vi.fn();

  it('renders an em dash (not 0) for an unknown/uncatalogued device type', () => {
    const animal = {
      id: 'remy',
      devices: {
        electrode_groups: [
          { id: 0, device_type: 'mystery-probe-9000', location: 'CA1', targeted_x: 1, targeted_y: 2, targeted_z: 3, units: 'mm' },
        ],
        ntrode_electrode_group_channel_map: [],
      },
    };
    render(<ChannelMapsStep animal={animal} onEditChannelMap={mockOnEditChannelMap} />);
    expect(screen.getByText('—', { selector: '[data-label="Channels"]' })).toBeInTheDocument();
    expect(screen.getByText('—', { selector: '[data-label="Shanks"]' })).toBeInTheDocument();
    expect(screen.queryByText('0', { selector: '[data-label="Channels"]' })).not.toBeInTheDocument();
  });

  it('shows the shank count from the catalog (uneven 64c-3s = 3 shanks)', () => {
    const animal = {
      id: 'remy',
      devices: {
        electrode_groups: [
          { id: 0, device_type: '64c-3s6mm6cm-20um-40um-sl', location: 'CA1', targeted_x: 1, targeted_y: 2, targeted_z: 3, units: 'mm' },
        ],
        ntrode_electrode_group_channel_map: [],
      },
    };
    render(<ChannelMapsStep animal={animal} onEditChannelMap={mockOnEditChannelMap} />);
    expect(screen.getByText('64', { selector: '[data-label="Channels"]' })).toBeInTheDocument();
    expect(screen.getByText('3', { selector: '[data-label="Shanks"]' })).toBeInTheDocument();
  });

  it('renders table with all electrode groups', () => {
    render(<ChannelMapsStep animal={mockAnimal} onEditChannelMap={mockOnEditChannelMap} />);

    // Should display both electrode groups by ID (scope to the ID column — the
    // Shanks column can also read "1" for a single-shank probe).
    expect(screen.getByText('0', { selector: '[data-label="ID"]' })).toBeInTheDocument();
    expect(screen.getByText('1', { selector: '[data-label="ID"]' })).toBeInTheDocument();
  });

  it('shows correct device type for each group', () => {
    render(<ChannelMapsStep animal={mockAnimal} onEditChannelMap={mockOnEditChannelMap} />);

    const deviceTypes = screen.getAllByText('tetrode_12.5');
    expect(deviceTypes.length).toBeGreaterThanOrEqual(2);
  });

  it('shows channel count from device type metadata', () => {
    render(<ChannelMapsStep animal={mockAnimal} onEditChannelMap={mockOnEditChannelMap} />);

    // tetrode_12.5 has 4 channels
    const channelCounts = screen.getAllByText('4');
    expect(channelCounts.length).toBeGreaterThan(0);
  });

  it('shows map status badge - fully mapped (✓)', () => {
    render(<ChannelMapsStep animal={mockAnimal} onEditChannelMap={mockOnEditChannelMap} />);

    // Group 0 has all 4 channels mapped
    const completeBadges = screen.getAllByText('✓');
    expect(completeBadges.length).toBeGreaterThan(0);
  });

  it('shows map status badge - partially mapped (⚠)', () => {
    render(<ChannelMapsStep animal={mockAnimal} onEditChannelMap={mockOnEditChannelMap} />);

    // Group 1 has only 2 out of 4 channels mapped
    const partialBadges = screen.getAllByText('⚠');
    expect(partialBadges.length).toBeGreaterThan(0);
  });

  it('shows map status badge - unmapped (❌)', () => {
    const animalWithUnmapped = {
      ...mockAnimal,
      devices: {
        electrode_groups: [
          { id: 0, device_type: 'tetrode_12.5', location: 'CA1' }
        ],
        ntrode_electrode_group_channel_map: []
      }
    };

    render(<ChannelMapsStep animal={animalWithUnmapped} onEditChannelMap={mockOnEditChannelMap} />);

    // Badge appears in both legend and table row
    const unmappedBadges = screen.getAllByText('❌');
    expect(unmappedBadges.length).toBeGreaterThan(0);
  });

  it('shows Edit button for each group', () => {
    render(<ChannelMapsStep animal={mockAnimal} onEditChannelMap={mockOnEditChannelMap} />);

    const editButtons = screen.getAllByText('Edit');
    expect(editButtons).toHaveLength(2);
  });

  it('calls onEditChannelMap when Edit clicked', async () => {
    const user = userEvent.setup();
    render(<ChannelMapsStep animal={mockAnimal} onEditChannelMap={mockOnEditChannelMap} />);

    const editButtons = screen.getAllByText('Edit');
    await user.click(editButtons[0]);

    expect(mockOnEditChannelMap).toHaveBeenCalledWith(0);
  });

  it('shows empty state when no electrode groups', () => {
    const emptyAnimal = {
      ...mockAnimal,
      devices: {
        electrode_groups: [],
        ntrode_electrode_group_channel_map: []
      }
    };

    render(<ChannelMapsStep animal={emptyAnimal} onEditChannelMap={mockOnEditChannelMap} />);

    expect(screen.getByText(/Add electrode groups before mapping channels/i)).toBeInTheDocument();
  });

  it.each([
    ['a string', 'corrupt'],
    ['a plain object', {}],
    ['a number', 42],
  ])('renders the empty state instead of throwing when electrode_groups is %s', (_label, corrupt) => {
    const corruptAnimal = {
      ...mockAnimal,
      devices: {
        electrode_groups: corrupt,
        ntrode_electrode_group_channel_map: mockAnimal.devices.ntrode_electrode_group_channel_map,
      },
    };

    expect(() =>
      render(<ChannelMapsStep animal={corruptAnimal} onEditChannelMap={mockOnEditChannelMap} />)
    ).not.toThrow();
    expect(screen.getByText(/Add electrode groups before mapping channels/i)).toBeInTheDocument();
  });

  it.each([
    ['a string', 'corrupt'],
    ['a plain object', {}],
    ['a number', 42],
  ])('renders unmapped status instead of throwing when channel maps is %s', (_label, corrupt) => {
    const corruptAnimal = {
      ...mockAnimal,
      devices: {
        electrode_groups: mockAnimal.devices.electrode_groups,
        ntrode_electrode_group_channel_map: corrupt,
      },
    };

    expect(() =>
      render(<ChannelMapsStep animal={corruptAnimal} onEditChannelMap={mockOnEditChannelMap} />)
    ).not.toThrow();
    expect(screen.getAllByText('❌').length).toBeGreaterThan(0);
  });

  it('displays group location correctly', () => {
    render(<ChannelMapsStep animal={mockAnimal} onEditChannelMap={mockOnEditChannelMap} />);

    expect(screen.getByText('CA1')).toBeInTheDocument();
    expect(screen.getByText('CA3')).toBeInTheDocument();
  });

  it('names the section "Channel Maps" without a "Step N:" wizard prefix', () => {
    render(<ChannelMapsStep animal={mockAnimal} onEditChannelMap={mockOnEditChannelMap} />);

    expect(screen.getByRole('heading', { name: 'Channel Maps' })).toBeInTheDocument();
    expect(screen.queryByText(/Step 2:/)).not.toBeInTheDocument();
  });

  it('intro describes wiring (mapping channels to positions) and defers bad channels to the Day Editor', () => {
    render(<ChannelMapsStep animal={mockAnimal} onEditChannelMap={mockOnEditChannelMap} />);

    expect(screen.getByText(/map each probe channel to its electrode position/i)).toBeInTheDocument();
    // Bad channels are day-owned now — the intro must point users to the Day Editor, not
    // describe an animal-level bad-channel job here.
    expect(screen.getByText(/marked per recording day in the day editor/i)).toBeInTheDocument();
  });

  // Bad channels are day-owned: the animal Channel Maps table must NOT carry a bad-channel
  // column or count. Pinned against re-introduction.
  it('renders no "Bad Channels" column or count', () => {
    const animal = {
      id: 'remy',
      devices: {
        electrode_groups: [
          { id: 0, device_type: 'tetrode_12.5', location: 'CA1' },
        ],
        ntrode_electrode_group_channel_map: [
          { ntrode_id: 0, electrode_group_id: 0, map: { 0: 0, 1: 1, 2: 2, 3: 3 }, bad_channels: [1, 2] },
        ],
      },
    };
    render(<ChannelMapsStep animal={animal} onEditChannelMap={mockOnEditChannelMap} />);

    expect(screen.queryByRole('columnheader', { name: /bad channels/i })).not.toBeInTheDocument();
    expect(screen.queryByText(/bad \//i)).not.toBeInTheDocument();
    expect(document.querySelector('[data-label="Bad Channels"]')).toBeNull();
  });
});
