import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import DevicesStep from '../DevicesStep';

describe('DevicesStep', () => {
  const mockAnimal = {
    id: 'test-animal',
    devices: {
      electrode_groups: [
        {
          id: 0,
          location: 'CA1',
          device_type: 'tetrode_12.5',
          description: 'Dorsal CA1 tetrode',
          targeted_location: 'CA1',
          targeted_x: 2.6,
          targeted_y: -3.8,
          targeted_z: 1.5,
          units: 'mm',
        },
        {
          id: 1,
          location: 'PFC',
          device_type: 'tetrode_12.5',
          description: 'Prefrontal cortex tetrode',
          targeted_location: 'PFC',
          targeted_x: 1.0,
          targeted_y: 2.0,
          targeted_z: 2.5,
          units: 'mm',
        },
      ],
      ntrode_electrode_group_channel_map: [
        {
          ntrode_id: 0,
          electrode_group_id: 0,
          bad_channels: [],
          map: { 0: 0, 1: 1, 2: 2, 3: 3 },
        },
        {
          ntrode_id: 1,
          electrode_group_id: 1,
          bad_channels: [],
          map: { 0: 4, 1: 5, 2: 6, 3: 7 },
        },
      ],
    },
  };

  const mockDay = {
    id: 'test-animal-2023-06-22',
    animalId: 'test-animal',
    date: '2023-06-22',
    deviceOverrides: {
      bad_channels: {
        '0': [],
        '1': [1, 3],
      },
    },
  };

  const mockMergedDay = {
    ...mockDay,
    ...mockAnimal,
  };

  let mockOnFieldUpdate;

  beforeEach(() => {
    mockOnFieldUpdate = vi.fn();
  });

  it('renders section heading', () => {
    render(
      <DevicesStep
        animal={mockAnimal}
        day={mockDay}
        mergedDay={mockMergedDay}
        onFieldUpdate={mockOnFieldUpdate}
      />
    );

    expect(screen.getByRole('heading', { name: /devices configuration/i })).toBeInTheDocument();
  });

  it('displays inherited notice with link to edit animal', () => {
    render(
      <DevicesStep
        animal={mockAnimal}
        day={mockDay}
        mergedDay={mockMergedDay}
        onFieldUpdate={mockOnFieldUpdate}
      />
    );

    expect(screen.getByText(/device configuration inherited from animal/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /edit animal/i })).toHaveAttribute(
      'href',
      '#/animal/test-animal'
    );
  });

  it('renders all electrode groups as collapsed details elements', () => {
    render(
      <DevicesStep
        animal={mockAnimal}
        day={mockDay}
        mergedDay={mockMergedDay}
        onFieldUpdate={mockOnFieldUpdate}
      />
    );

    // Use getAllByText since "Electrode Group X: Y" appears in both summary and content
    const group0Texts = screen.getAllByText(/electrode group 0: CA1/i);
    const group1Texts = screen.getAllByText(/electrode group 1: PFC/i);

    expect(group0Texts[0]).toBeInTheDocument();
    expect(group1Texts[0]).toBeInTheDocument();

    // Should be collapsed by default - details element exists but open attribute is false
    const detailsElements = screen.getAllByRole('group');
    detailsElements.forEach(details => {
      if (details.tagName === 'DETAILS') {
        expect(details).not.toHaveAttribute('open');
      }
    });
  });

  it('shows status badge "All channels OK" when no bad channels', () => {
    const dayWithNoFailures = {
      ...mockDay,
      deviceOverrides: {
        bad_channels: {
          '0': [],
          '1': [],
        },
      },
    };

    render(
      <DevicesStep
        animal={mockAnimal}
        day={dayWithNoFailures}
        mergedDay={mockMergedDay}
        onFieldUpdate={mockOnFieldUpdate}
      />
    );

    const statusBadges = screen.getAllByText(/all channels ok/i);
    expect(statusBadges.length).toBeGreaterThan(0);
  });

  it('shows status badge with failed channel count', () => {
    render(
      <DevicesStep
        animal={mockAnimal}
        day={mockDay}
        mergedDay={mockMergedDay}
        onFieldUpdate={mockOnFieldUpdate}
      />
    );

    expect(screen.getByText(/2 failed channels/i)).toBeInTheDocument();
  });

  it('expands electrode group when clicked', async () => {
    const user = userEvent.setup();

    render(
      <DevicesStep
        animal={mockAnimal}
        day={mockDay}
        mergedDay={mockMergedDay}
        onFieldUpdate={mockOnFieldUpdate}
      />
    );

    // Get the first occurrence (summary element)
    const group0Summaries = screen.getAllByText(/electrode group 0: CA1/i);
    await user.click(group0Summaries[0]);

    // Content should now be visible - check for text that should appear
    const shankTexts = screen.getAllByText(/this tetrode_12\.5 has 1 shank/i);
    expect(shankTexts[0]).toBeVisible();
    const failedChannelsLabels = screen.getAllByText(/failed channels/i);
    expect(failedChannelsLabels[0]).toBeVisible();
  });

  it('shows read-only device info when expanded', async () => {
    const user = userEvent.setup();

    render(
      <DevicesStep
        animal={mockAnimal}
        day={mockDay}
        mergedDay={mockMergedDay}
        onFieldUpdate={mockOnFieldUpdate}
      />
    );

    const group0Summaries = screen.getAllByText(/electrode group 0: CA1/i);
    await user.click(group0Summaries[0]);

    // Device config is inside a nested collapsible section, need to expand it too
    const viewConfigButtons = screen.getAllByText(/view device configuration/i);
    await user.click(viewConfigButtons[0]); // Click the first one (for group 0)

    const deviceTypes = screen.getAllByText('tetrode_12.5');
    expect(deviceTypes[0]).toBeVisible();
    expect(screen.getByText(/\(2\.6, -3\.8, 1\.5\) mm/)).toBeVisible();
  });

  it('calls onFieldUpdate when bad channels are changed', async () => {
    const user = userEvent.setup();

    render(
      <DevicesStep
        animal={mockAnimal}
        day={mockDay}
        mergedDay={mockMergedDay}
        onFieldUpdate={mockOnFieldUpdate}
      />
    );

    // Expand group 0
    const group0Summaries = screen.getAllByText(/electrode group 0: CA1/i);
    await user.click(group0Summaries[0]);

    // Check channel 1 as failed (use getAllByLabelText since multiple groups may be open)
    const channel1Checkboxes = screen.getAllByLabelText(/channel 1/i);
    await user.click(channel1Checkboxes[0]); // Click the first one (group 0, ntrode 0)

    expect(mockOnFieldUpdate).toHaveBeenCalledWith('deviceOverrides.bad_channels.0', [1]);
  });

  it('handles empty state when no electrode groups', () => {
    const animalWithNoGroups = {
      ...mockAnimal,
      devices: {
        electrode_groups: [],
        ntrode_electrode_group_channel_map: [],
      },
    };

    render(
      <DevicesStep
        animal={animalWithNoGroups}
        day={mockDay}
        mergedDay={mockMergedDay}
        onFieldUpdate={mockOnFieldUpdate}
      />
    );

    expect(screen.getByText(/no electrode groups configured/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /configure electrode groups/i })).toHaveAttribute(
      'href',
      '#/animal/test-animal'
    );
  });

  it('displays warning when all channels in a group are marked as failed', () => {
    const dayWithAllFailed = {
      ...mockDay,
      deviceOverrides: {
        bad_channels: {
          '0': [0, 1, 2, 3], // All 4 channels failed
          '1': [],
        },
      },
    };

    render(
      <DevicesStep
        animal={mockAnimal}
        day={dayWithAllFailed}
        mergedDay={mockMergedDay}
        onFieldUpdate={mockOnFieldUpdate}
      />
    );

    expect(screen.getByText(/all channels failed - group inactive/i)).toBeInTheDocument();
  });

  it('handles missing deviceOverrides gracefully', () => {
    const dayWithoutOverrides = {
      ...mockDay,
      deviceOverrides: undefined,
    };

    render(
      <DevicesStep
        animal={mockAnimal}
        day={dayWithoutOverrides}
        mergedDay={mockMergedDay}
        onFieldUpdate={mockOnFieldUpdate}
      />
    );

    // Should render without errors
    expect(screen.getByRole('heading', { name: /devices configuration/i })).toBeInTheDocument();
  });

  it('allows multiple groups to be expanded simultaneously', async () => {
    const user = userEvent.setup();

    render(
      <DevicesStep
        animal={mockAnimal}
        day={mockDay}
        mergedDay={mockMergedDay}
        onFieldUpdate={mockOnFieldUpdate}
      />
    );

    // Expand both groups
    const group0Summaries = screen.getAllByText(/electrode group 0: CA1/i);
    const group1Summaries = screen.getAllByText(/electrode group 1: PFC/i);

    await user.click(group0Summaries[0]);
    await user.click(group1Summaries[0]);

    // Both should be visible - check for text in each group's expanded content
    const shankTexts = screen.getAllByText(/this tetrode_12\.5 has 1 shank/i);
    expect(shankTexts[0]).toBeVisible();
    expect(shankTexts[1]).toBeVisible();
  });

  it('renders explanatory header when electrode group is expanded', async () => {
    const user = userEvent.setup();

    render(
      <DevicesStep
        animal={mockAnimal}
        day={mockDay}
        mergedDay={mockMergedDay}
        onFieldUpdate={mockOnFieldUpdate}
      />
    );

    const group0Summaries = screen.getAllByText(/electrode group 0: CA1/i);
    await user.click(group0Summaries[0]);

    const shankTexts = screen.getAllByText(/this tetrode_12\.5 has 1 shank/i);
    expect(shankTexts[0]).toBeVisible();
    const markChannelsTexts = screen.getAllByText(/mark individual channels that have failed/i);
    expect(markChannelsTexts[0]).toBeVisible();
  });

  it('handles data corruption (missing ntrode maps)', () => {
    const animalWithMissingMaps = {
      ...mockAnimal,
      devices: {
        electrode_groups: mockAnimal.devices.electrode_groups,
        ntrode_electrode_group_channel_map: [], // Missing maps
      },
    };

    render(
      <DevicesStep
        animal={animalWithMissingMaps}
        day={mockDay}
        mergedDay={mockMergedDay}
        onFieldUpdate={mockOnFieldUpdate}
      />
    );

    // Should still render without crashing
    expect(screen.getByRole('heading', { name: /devices configuration/i })).toBeInTheDocument();
  });

  it('uses aria-label on status badges for accessibility', () => {
    render(
      <DevicesStep
        animal={mockAnimal}
        day={mockDay}
        mergedDay={mockMergedDay}
        onFieldUpdate={mockOnFieldUpdate}
      />
    );

    const statusBadge = screen.getByLabelText(/status: all channels ok/i);
    expect(statusBadge).toBeInTheDocument();
  });
});
