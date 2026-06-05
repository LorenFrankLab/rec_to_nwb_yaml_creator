import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import RawCorruptionBanner from './RawCorruptionBanner';

/**
 * The destination-side surface for raw-shape corruption. Given a raw animal/day, it
 * computes the owned raw-shape issues (which already carry executable repairCommands from
 * the validation layer) and renders an executable reset button per issue — so a repair that
 * routes here lands on a visible "Reset corrupt cameras to none" control, not an empty
 * "Add First Camera" state that hides the corruption.
 */
describe('RawCorruptionBanner', () => {
  it('renders nothing when there is no owned corruption', () => {
    const { container } = render(
      <RawCorruptionBanner animal={{ id: 'remy', cameras: [] }} fields={['cameras']} onRepair={vi.fn()} />
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('surfaces a corrupt animal camera collection with an executable reset button', async () => {
    const user = userEvent.setup();
    const onRepair = vi.fn();
    render(
      <RawCorruptionBanner
        animal={{ id: 'remy', cameras: 'nope' }}
        fields={['cameras']}
        onRepair={onRepair}
      />
    );
    expect(screen.getByText(/"cameras" is corrupt/i)).toBeInTheDocument();
    const button = screen.getByRole('button', { name: /^reset cameras$/i });
    await user.click(button);
    expect(onRepair).toHaveBeenCalledWith(
      expect.objectContaining({ repairCommand: { type: 'resetAnimalCameras' } })
    );
  });

  it('only shows the owned fields, not other corruptions on the same record', () => {
    render(
      <RawCorruptionBanner
        animal={{ id: 'remy', cameras: 'nope', devices: { data_acq_device: 'bad' } }}
        fields={['data_acq_device']}
        onRepair={vi.fn()}
      />
    );
    // data_acq is owned and shown…
    expect(screen.getByRole('button', { name: /reset data acquisition devices/i })).toBeInTheDocument();
    // …cameras is NOT owned by this banner instance, so no cameras button.
    expect(screen.queryByRole('button', { name: /^reset cameras$/i })).not.toBeInTheDocument();
  });

  it('surfaces a malformed day session with its resetDaySession button', async () => {
    const user = userEvent.setup();
    const onRepair = vi.fn();
    render(
      <RawCorruptionBanner day={{ session: 'corrupt' }} fields={['session']} onRepair={onRepair} />
    );
    const button = screen.getByRole('button', { name: /^reset session$/i });
    await user.click(button);
    expect(onRepair).toHaveBeenCalledWith(
      expect.objectContaining({ repairCommand: { type: 'resetDaySession' } })
    );
  });

  it('surfaces a missing configurationHistory (real animal) rebuild button', () => {
    render(
      <RawCorruptionBanner
        animal={{ id: 'remy', devices: { electrode_groups: [] }, configurationHistory: [] }}
        fields={['configurationHistory']}
        onRepair={vi.fn()}
      />
    );
    expect(
      screen.getByRole('button', { name: /rebuild device configuration history/i })
    ).toBeInTheDocument();
  });

  it('renders nothing without an onRepair executor (no dead controls)', () => {
    const { container } = render(
      <RawCorruptionBanner animal={{ id: 'remy', cameras: 'nope' }} fields={['cameras']} />
    );
    expect(container).toBeEmptyDOMElement();
  });
});
