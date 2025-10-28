import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import BadChannelsEditor from '../BadChannelsEditor';

describe('BadChannelsEditor', () => {
  const mockNtrodes = [
    {
      ntrode_id: 0,
      electrode_group_id: 0,
      bad_channels: [],
      map: { 0: 0, 1: 1, 2: 2, 3: 3 }, // 4-channel tetrode
    },
    {
      ntrode_id: 1,
      electrode_group_id: 0,
      bad_channels: [1, 3],
      map: { 0: 4, 1: 5, 2: 6, 3: 7 }, // 4-channel tetrode
    },
  ];

  const mockBadChannels = {
    '0': [],
    '1': [1, 3],
  };

  let mockOnUpdate;

  beforeEach(() => {
    mockOnUpdate = vi.fn();
  });

  it('renders a fieldset for each ntrode', () => {
    render(
      <BadChannelsEditor
        ntrodes={mockNtrodes}
        badChannels={mockBadChannels}
        onUpdate={mockOnUpdate}
      />
    );

    expect(screen.getByText(/Shank #1 \(Ntrode ID: 0\)/i)).toBeInTheDocument();
    expect(screen.getByText(/Shank #2 \(Ntrode ID: 1\)/i)).toBeInTheDocument();
  });

  it('renders checkboxes for each channel in the ntrode map', () => {
    render(
      <BadChannelsEditor
        ntrodes={[mockNtrodes[0]]}
        badChannels={{ '0': [] }}
        onUpdate={mockOnUpdate}
      />
    );

    // Tetrode has 4 channels (0, 1, 2, 3)
    expect(screen.getByLabelText(/channel 0/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/channel 1/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/channel 2/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/channel 3/i)).toBeInTheDocument();
  });

  it('shows current bad channels as checked', () => {
    render(
      <BadChannelsEditor
        ntrodes={[mockNtrodes[1]]}
        badChannels={{ '1': [1, 3] }}
        onUpdate={mockOnUpdate}
      />
    );

    const channel0 = screen.getByLabelText(/channel 0/i);
    const channel1 = screen.getByLabelText(/channel 1/i);
    const channel2 = screen.getByLabelText(/channel 2/i);
    const channel3 = screen.getByLabelText(/channel 3/i);

    expect(channel0).not.toBeChecked();
    expect(channel1).toBeChecked(); // Bad channel
    expect(channel2).not.toBeChecked();
    expect(channel3).toBeChecked(); // Bad channel
  });

  it('calls onUpdate when checkbox is changed', async () => {
    const user = userEvent.setup();

    render(
      <BadChannelsEditor
        ntrodes={[mockNtrodes[0]]}
        badChannels={{ '0': [] }}
        onUpdate={mockOnUpdate}
      />
    );

    const channel1 = screen.getByLabelText(/channel 1/i);
    await user.click(channel1);

    expect(mockOnUpdate).toHaveBeenCalledWith('0', [1]);
  });

  it('handles unchecking a bad channel', async () => {
    const user = userEvent.setup();

    render(
      <BadChannelsEditor
        ntrodes={[mockNtrodes[1]]}
        badChannels={{ '1': [1, 3] }}
        onUpdate={mockOnUpdate}
      />
    );

    const channel1 = screen.getByLabelText(/channel 1/i);
    await user.click(channel1); // Uncheck

    expect(mockOnUpdate).toHaveBeenCalledWith('1', [3]);
  });

  it('displays explanatory text about hardware failures', () => {
    render(
      <BadChannelsEditor
        ntrodes={mockNtrodes}
        badChannels={mockBadChannels}
        onUpdate={mockOnUpdate}
      />
    );

    expect(
      screen.getByText(/only mark channels with hardware failures/i)
    ).toBeInTheDocument();
  });

  it('shows validation error when provided', () => {
    const mockErrors = {
      '0': 'Channel 5 does not exist in ntrode map',
    };

    render(
      <BadChannelsEditor
        ntrodes={[mockNtrodes[0]]}
        badChannels={{ '0': [] }}
        onUpdate={mockOnUpdate}
        errors={mockErrors}
      />
    );

    expect(
      screen.getByText(/channel 5 does not exist in ntrode map/i)
    ).toBeInTheDocument();
  });

  it('handles warning when all channels are marked as failed', () => {
    const mockWarnings = {
      '0': 'All 4 channels marked as failed. This electrode group will be excluded from analysis.',
    };

    render(
      <BadChannelsEditor
        ntrodes={[mockNtrodes[0]]}
        badChannels={{ '0': [0, 1, 2, 3] }}
        onUpdate={mockOnUpdate}
        warnings={mockWarnings}
      />
    );

    expect(
      screen.getByText(/all 4 channels marked as failed/i)
    ).toBeInTheDocument();
  });

  it('handles undefined badChannels gracefully', () => {
    render(
      <BadChannelsEditor
        ntrodes={[mockNtrodes[0]]}
        badChannels={{}}
        onUpdate={mockOnUpdate}
      />
    );

    const channel0 = screen.getByLabelText(/channel 0/i);
    expect(channel0).not.toBeChecked();
  });

  it('handles empty ntrodes array', () => {
    render(
      <BadChannelsEditor
        ntrodes={[]}
        badChannels={{}}
        onUpdate={mockOnUpdate}
      />
    );

    expect(screen.queryByRole('group')).not.toBeInTheDocument();
  });

  it('renders collapsible channel map for reference', () => {
    render(
      <BadChannelsEditor
        ntrodes={[mockNtrodes[0]]}
        badChannels={{ '0': [] }}
        onUpdate={mockOnUpdate}
      />
    );

    // Should have a collapsible section for the channel map
    expect(screen.getByText(/view channel map/i)).toBeInTheDocument();
  });

  it('allows multiple channels to be selected across shanks', async () => {
    const user = userEvent.setup();

    render(
      <BadChannelsEditor
        ntrodes={mockNtrodes}
        badChannels={{ '0': [], '1': [] }}
        onUpdate={mockOnUpdate}
      />
    );

    // Mark channel 1 as bad in shank #1
    const shank1Checkboxes = screen.getAllByLabelText(/channel 1/i);
    await user.click(shank1Checkboxes[0]);

    expect(mockOnUpdate).toHaveBeenCalledWith('0', [1]);

    // Mark channel 2 as bad in shank #2
    const shank2Checkboxes = screen.getAllByLabelText(/channel 2/i);
    await user.click(shank2Checkboxes[1]);

    expect(mockOnUpdate).toHaveBeenCalledWith('1', [2]);
  });
});
