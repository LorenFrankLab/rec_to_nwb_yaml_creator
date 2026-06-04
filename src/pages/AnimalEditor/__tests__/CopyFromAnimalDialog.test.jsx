/**
 * @vitest-environment jsdom
 *
 * CopyFromAnimalDialog renders through the shared Modal primitive, which owns the
 * open/closed gating. These tests pin the open vs closed contract directly (the
 * `open={false}` path used to be a local `if (!open) return null` guard).
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
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
});
