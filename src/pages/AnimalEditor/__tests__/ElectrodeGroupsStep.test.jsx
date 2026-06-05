import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ElectrodeGroupsStep from '../ElectrodeGroupsStep';

describe('ElectrodeGroupsStep', () => {
  const mockAnimal = {
    id: 'remy',
    devices: {
      electrode_groups: [
        { id: 0, device_type: 'tetrode_12.5', location: 'CA1', description: 'CA1 tetrode', targeted_location: 'CA1', targeted_x: 2.6, targeted_y: -3.8, targeted_z: 0, units: 'mm' },
        { id: 1, device_type: 'tetrode_12.5', location: 'CA3', description: 'CA3 tetrode', targeted_location: 'CA3', targeted_x: 2.8, targeted_y: -3.6, targeted_z: 0, units: 'mm' }
      ],
      ntrode_electrode_group_channel_map: []
    }
  };

  const mockOnFieldUpdate = vi.fn();

  it('shows the full catalog channel count for an uneven multi-shank probe (64c-3s = 64)', () => {
    // ElectrodeGroupsStep must report the catalog channel count (64), not the
    // length of one shank. The old local helper used deviceTypeMap(...).length,
    // which is 21 for the uneven 64c-3s probe — a silent under-count.
    const animal = {
      id: 'remy',
      devices: {
        electrode_groups: [
          { id: 0, device_type: '64c-3s6mm6cm-20um-40um-sl', location: 'CA1', targeted_location: 'CA1', targeted_x: 1, targeted_y: 2, targeted_z: 3, units: 'mm' },
        ],
        ntrode_electrode_group_channel_map: [],
      },
    };
    render(<ElectrodeGroupsStep animal={animal} onFieldUpdate={mockOnFieldUpdate} />);
    const cell = screen.getByText('64', { selector: '[data-label="Channels"]' });
    expect(cell).toBeInTheDocument();
  });

  it('renders an em dash (not 0) for an unknown/uncatalogued device type', () => {
    const animal = {
      id: 'remy',
      devices: {
        electrode_groups: [
          { id: 0, device_type: 'mystery-probe-9000', location: 'CA1', targeted_location: 'CA1', targeted_x: 1, targeted_y: 2, targeted_z: 3, units: 'mm' },
        ],
        ntrode_electrode_group_channel_map: [],
      },
    };
    render(<ElectrodeGroupsStep animal={animal} onFieldUpdate={mockOnFieldUpdate} />);
    // An unknown probe is visually distinct: '—' for both channels and shanks, never 0.
    expect(screen.getByText('—', { selector: '[data-label="Channels"]' })).toBeInTheDocument();
    expect(screen.getByText('—', { selector: '[data-label="Shanks"]' })).toBeInTheDocument();
    expect(screen.queryByText('0', { selector: '[data-label="Channels"]' })).not.toBeInTheDocument();
  });

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

  it('marks a group missing its required targeted_location as incomplete', () => {
    const animalWithIncompleteGroup = {
      id: 'remy',
      devices: {
        electrode_groups: [
          // No targeted_location — the required region field. (location/description
          // are optional in the editor and filled in on save.)
          { id: 0, device_type: 'tetrode_12.5', targeted_x: 1, targeted_y: 2, targeted_z: 3, units: 'mm' },
        ],
        ntrode_electrode_group_channel_map: [],
      },
    };
    render(<ElectrodeGroupsStep animal={animalWithIncompleteGroup} onFieldUpdate={mockOnFieldUpdate} />);

    // Incomplete groups render the missing-required glyph, not the complete checkmark.
    expect(screen.queryAllByText('✓')).toHaveLength(0);
    expect(screen.getByText('❌')).toBeInTheDocument();
  });

  it('marks whitespace strings and non-finite coordinates as incomplete', () => {
    const animalWithInvalidGroup = {
      id: 'remy',
      devices: {
        electrode_groups: [
          {
            id: 0,
            device_type: 'tetrode_12.5',
            location: '   ',
            description: 'CA1 tetrode',
            targeted_location: 'CA1',
            targeted_x: Number.NaN,
            targeted_y: 2,
            targeted_z: 3,
            units: 'mm',
          },
        ],
        ntrode_electrode_group_channel_map: [],
      },
    };

    render(<ElectrodeGroupsStep animal={animalWithInvalidGroup} onFieldUpdate={mockOnFieldUpdate} />);

    expect(screen.queryAllByText('✓')).toHaveLength(0);
    expect(screen.getByText('❌')).toBeInTheDocument();
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

  it('calls onDelete when delete button clicked', async () => {
    const user = userEvent.setup();
    const mockOnDelete = vi.fn();

    render(
      <ElectrodeGroupsStep
        animal={mockAnimal}
        onFieldUpdate={mockOnFieldUpdate}
        onDelete={mockOnDelete}
      />
    );

    const deleteButtons = screen.getAllByText('Delete');
    await user.click(deleteButtons[0]);

    expect(mockOnDelete).toHaveBeenCalledWith(
      expect.objectContaining({ id: 0 })
    );
  });

  it('delete button has aria-label with group ID', () => {
    render(
      <ElectrodeGroupsStep
        animal={mockAnimal}
        onFieldUpdate={mockOnFieldUpdate}
      />
    );

    const button = screen.getByLabelText(/Delete electrode group 0/i);
    expect(button).toBeInTheDocument();
  });
});
