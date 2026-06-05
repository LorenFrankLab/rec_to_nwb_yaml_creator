/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ChannelMapEditor from '../ChannelMapEditor';

/**
 * UX-nit review findings on ChannelMapEditor:
 *   (b) An uncatalogued device must NOT show "0 shanks"; show an explicit fallback.
 *   (c) Saving a map with an unset (-1) entry must be blocked at edit time.
 */
describe('ChannelMapEditor — uncatalogued device fallback header', () => {
  it('shows a catalog-unavailable fallback instead of "0 shanks"', () => {
    const group = { id: 1, device_type: 'mystery-probe-9000', location: 'CA1', units: 'mm' };
    const maps = [
      { electrode_group_id: 1, ntrode_id: 0, bad_channels: [], map: { 0: 0, 1: 1, 2: 2, 3: 3 } },
    ];
    render(<ChannelMapEditor electrodeGroup={group} channelMaps={maps} onSave={() => {}} onCancel={() => {}} />);

    // No misleading "0 shanks" header for an uncatalogued device…
    expect(screen.queryByText(/0 shanks/i)).not.toBeInTheDocument();
    // …instead an explicit fallback that the layout came from saved data.
    expect(screen.getByText(/catalog unavailable/i)).toBeInTheDocument();
    // Rows still render from the saved map keys (the editor never silently drops them).
    expect(screen.getByText('Shank #1')).toBeInTheDocument();
  });

  it('still shows the real shank count for a catalogued device', () => {
    const group = { id: 1, device_type: 'tetrode_12.5', location: 'CA1', units: 'mm' };
    const maps = [
      { electrode_group_id: 1, ntrode_id: 0, bad_channels: [], map: { 0: 0, 1: 1, 2: 2, 3: 3 } },
    ];
    render(<ChannelMapEditor electrodeGroup={group} channelMaps={maps} onSave={() => {}} onCancel={() => {}} />);
    expect(screen.getByText(/1 shanks/i)).toBeInTheDocument();
    expect(screen.queryByText(/catalog unavailable/i)).not.toBeInTheDocument();
  });
});

describe('ChannelMapEditor — reject unset (-1) map entries on Save', () => {
  let onSave;
  beforeEach(() => {
    onSave = vi.fn();
  });

  it('blocks Save and surfaces a message when a map entry is unset (-1)', async () => {
    const user = userEvent.setup();
    const group = { id: 1, device_type: 'tetrode_12.5', location: 'CA1', units: 'mm' };
    // Channel 2 is unset (-1) — valid downstream gate catches it later, but we must
    // surface it at edit time rather than letting the user Save a -1.
    const maps = [
      { electrode_group_id: 1, ntrode_id: 0, bad_channels: [], map: { 0: 0, 1: 1, 2: -1, 3: 3 } },
    ];
    render(<ChannelMapEditor electrodeGroup={group} channelMaps={maps} onSave={onSave} onCancel={() => {}} />);

    await user.click(screen.getByTestId('editor-save'));

    expect(onSave).not.toHaveBeenCalled();
    expect(screen.getByText(/cannot save/i)).toBeInTheDocument();
    // The message names the unset channel.
    expect(screen.getByText(/unset|not mapped|select a hardware channel/i)).toBeInTheDocument();
  });

  it('allows Save when every map entry is set', async () => {
    const user = userEvent.setup();
    const group = { id: 1, device_type: 'tetrode_12.5', location: 'CA1', units: 'mm' };
    const maps = [
      { electrode_group_id: 1, ntrode_id: 0, bad_channels: [], map: { 0: 0, 1: 1, 2: 2, 3: 3 } },
    ];
    render(<ChannelMapEditor electrodeGroup={group} channelMaps={maps} onSave={onSave} onCancel={() => {}} />);

    await user.click(screen.getByTestId('editor-save'));
    expect(onSave).toHaveBeenCalledTimes(1);
  });
});
