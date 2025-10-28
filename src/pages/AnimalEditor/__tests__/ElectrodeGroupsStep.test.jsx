import { describe, it, expect, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ElectrodeGroupsStep from '../ElectrodeGroupsStep';

describe('ElectrodeGroupsStep', () => {
  const mockAnimal = {
    id: 'remy',
    devices: {
      electrode_groups: [
        { id: 0, device_type: 'tetrode_12.5', location: 'CA1', targeted_x: 2.6, targeted_y: -3.8, targeted_z: 0, units: 'mm' },
        { id: 1, device_type: 'tetrode_12.5', location: 'CA3', targeted_x: 2.8, targeted_y: -3.6, targeted_z: 0, units: 'mm' }
      ],
      ntrode_electrode_group_channel_map: []
    }
  };

  const mockOnFieldUpdate = vi.fn();

  it('renders table with electrode groups', () => {
    render(<ElectrodeGroupsStep animal={mockAnimal} onFieldUpdate={mockOnFieldUpdate} />);

    expect(screen.getByText('CA1')).toBeInTheDocument();
    expect(screen.getByText('CA3')).toBeInTheDocument();
  });

  it('shows correct device type for each group', () => {
    render(<ElectrodeGroupsStep animal={mockAnimal} onFieldUpdate={mockOnFieldUpdate} />);

    const rows = screen.getAllByText('tetrode_12.5');
    expect(rows).toHaveLength(2);
  });

  it('shows channel count based on device type', () => {
    render(<ElectrodeGroupsStep animal={mockAnimal} onFieldUpdate={mockOnFieldUpdate} />);

    // tetrode_12.5 has 4 channels
    const channelCounts = screen.getAllByText('4');
    expect(channelCounts.length).toBeGreaterThan(0);
  });

  it('shows status badge for each group', () => {
    render(<ElectrodeGroupsStep animal={mockAnimal} onFieldUpdate={mockOnFieldUpdate} />);

    // Both groups should have complete status badges
    const badges = screen.getAllByText('✓');
    expect(badges.length).toBeGreaterThan(0);
  });

  it('renders "Add Electrode Group" button', () => {
    render(<ElectrodeGroupsStep animal={mockAnimal} onFieldUpdate={mockOnFieldUpdate} />);

    expect(screen.getByText(/Add Electrode Group/)).toBeInTheDocument();
  });

  it('renders "Copy from Animal" button', () => {
    render(<ElectrodeGroupsStep animal={mockAnimal} onFieldUpdate={mockOnFieldUpdate} />);

    expect(screen.getByText(/Copy from Animal/)).toBeInTheDocument();
  });

  it('shows empty state when no electrode groups', () => {
    const emptyAnimal = {
      ...mockAnimal,
      devices: { electrode_groups: [], ntrode_electrode_group_channel_map: [] }
    };

    render(<ElectrodeGroupsStep animal={emptyAnimal} onFieldUpdate={mockOnFieldUpdate} />);

    expect(screen.getByText(/No Electrode Groups Configured/)).toBeInTheDocument();
  });

  it('has Edit button for each group', () => {
    render(<ElectrodeGroupsStep animal={mockAnimal} onFieldUpdate={mockOnFieldUpdate} />);

    const editButtons = screen.getAllByText('Edit');
    expect(editButtons).toHaveLength(2);
  });

  it('has Delete button for each group', () => {
    render(<ElectrodeGroupsStep animal={mockAnimal} onFieldUpdate={mockOnFieldUpdate} />);

    const deleteButtons = screen.getAllByText('Delete');
    expect(deleteButtons).toHaveLength(2);
  });
});
