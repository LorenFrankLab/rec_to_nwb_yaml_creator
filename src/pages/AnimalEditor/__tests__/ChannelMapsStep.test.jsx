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

  it('renders table with all electrode groups', () => {
    render(<ChannelMapsStep animal={mockAnimal} onEditChannelMap={mockOnEditChannelMap} />);

    // Should display both electrode groups by ID
    expect(screen.getByText('0')).toBeInTheDocument();
    expect(screen.getByText('1')).toBeInTheDocument();
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

    expect(screen.getByText(/Add electrode groups in Step 1 before configuring channel maps/i)).toBeInTheDocument();
  });

  it('displays group location correctly', () => {
    render(<ChannelMapsStep animal={mockAnimal} onEditChannelMap={mockOnEditChannelMap} />);

    expect(screen.getByText('CA1')).toBeInTheDocument();
    expect(screen.getByText('CA3')).toBeInTheDocument();
  });
});
