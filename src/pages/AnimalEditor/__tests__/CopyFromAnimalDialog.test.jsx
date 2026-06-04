/**
 * @vitest-environment jsdom
 *
 * CopyFromAnimalDialog renders through the shared Modal primitive, which owns the
 * open/closed gating. These tests pin the open vs closed contract directly (the
 * `open={false}` path used to be a local `if (!open) return null` guard).
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import CopyFromAnimalDialog from '../CopyFromAnimalDialog';

const animals = {
  remy: { subject: { subject_id: 'remy' }, devices: { electrode_groups: [], ntrode_electrode_group_channel_map: [] } },
  bean: {
    subject: { subject_id: 'bean' },
    devices: {
      electrode_groups: [{ id: '0', device_type: 'tetrode_12.5', location: 'CA1' }],
      ntrode_electrode_group_channel_map: [],
    },
  },
};

describe('CopyFromAnimalDialog', () => {
  it('renders nothing when closed', () => {
    render(
      <CopyFromAnimalDialog
        open={false}
        currentAnimalId="remy"
        animals={animals}
        onCopy={vi.fn()}
        onCancel={vi.fn()}
      />
    );
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('renders an aria-modal dialog listing copyable source animals when open', () => {
    render(
      <CopyFromAnimalDialog
        open
        currentAnimalId="remy"
        animals={animals}
        onCopy={vi.fn()}
        onCancel={vi.fn()}
      />
    );
    const dialog = screen.getByRole('dialog', { name: /copy electrode groups/i });
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    // The other animal (bean, which has groups) is offered as a source.
    expect(screen.getByRole('radio', { name: /bean/i })).toBeInTheDocument();
  });

  it('copies groups and channel maps with integer IDs (not strings)', async () => {
    const user = userEvent.setup();
    const onCopy = vi.fn();
    const sourceAnimals = {
      remy: {
        subject: { subject_id: 'remy' },
        devices: {
          // Current animal already has one group/ntrode; copied IDs must come after.
          electrode_groups: [{ id: 0, device_type: 'tetrode_12.5', location: 'CA1' }],
          ntrode_electrode_group_channel_map: [
            { ntrode_id: 0, electrode_group_id: 0, bad_channels: [], map: { 0: 0, 1: 1, 2: 2, 3: 3 } },
          ],
        },
      },
      bean: {
        subject: { subject_id: 'bean' },
        devices: {
          electrode_groups: [
            { id: 0, device_type: 'tetrode_12.5', location: 'CA3', description: 'CA3', targeted_location: 'CA3' },
            { id: 1, device_type: 'tetrode_12.5', location: 'PFC', description: 'PFC', targeted_location: 'PFC' },
          ],
          ntrode_electrode_group_channel_map: [
            { ntrode_id: 0, electrode_group_id: 0, bad_channels: [], map: { 0: 0, 1: 1, 2: 2, 3: 3 } },
            { ntrode_id: 1, electrode_group_id: 1, bad_channels: [], map: { 0: 0, 1: 1, 2: 2, 3: 3 } },
          ],
        },
      },
    };

    render(
      <CopyFromAnimalDialog
        open
        currentAnimalId="remy"
        animals={sourceAnimals}
        onCopy={onCopy}
        onCancel={vi.fn()}
      />
    );

    await user.click(screen.getByRole('radio', { name: /bean/i }));
    await user.click(screen.getByRole('button', { name: /^copy$/i }));

    expect(onCopy).toHaveBeenCalledTimes(1);
    const { electrode_groups, ntrode_electrode_group_channel_map } = onCopy.mock.calls[0][0];

    // New group IDs are integers, starting after the current max (0) → 1, 2.
    expect(electrode_groups.map((g) => g.id)).toEqual([1, 2]);
    electrode_groups.forEach((g) => expect(typeof g.id).toBe('number'));

    // New ntrode IDs are integers, after the current max (0) → 1, 2; references updated.
    expect(ntrode_electrode_group_channel_map.map((n) => n.ntrode_id)).toEqual([1, 2]);
    ntrode_electrode_group_channel_map.forEach((n) => {
      expect(typeof n.ntrode_id).toBe('number');
      expect(typeof n.electrode_group_id).toBe('number');
    });
    // electrode_group_id references point at the new integer group IDs.
    expect(ntrode_electrode_group_channel_map.map((n) => n.electrode_group_id)).toEqual([1, 2]);
  });
});
