/**
 * In-context un-mark confirm — un-marking a channel that was bad on an EARLIER same-config day
 * is a monotonicity exception, so it must be deliberate. The editor intercepts that un-mark,
 * asks to confirm, and on confirm records an off-export acknowledgment AND applies the un-mark;
 * cancel leaves the channel marked. Un-marking a channel that was NOT prior-bad (a normal
 * same-day correction) never prompts.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import BadChannelsEditor from '../BadChannelsEditor';

describe('BadChannelsEditor — prior-bad un-mark confirm', () => {
  const ntrodes = [{ ntrode_id: 1, electrode_group_id: 0, bad_channels: [1, 2], map: { 0: 0, 1: 1, 2: 2, 3: 3 } }];
  let onUpdate;
  let onAcknowledgeRemoval;

  beforeEach(() => {
    onUpdate = vi.fn();
    onAcknowledgeRemoval = vi.fn();
  });

  const renderEditor = (props = {}) =>
    render(
      <BadChannelsEditor
        ntrodes={ntrodes}
        badChannels={{ '1': [1, 2] }}
        onUpdate={onUpdate}
        onAcknowledgeRemoval={onAcknowledgeRemoval}
        priorBadByNtrode={{ '1': [1] }} // channel 1 was bad on an earlier same-config day
        {...props}
      />
    );

  it('prompts before un-marking a channel that was bad on an earlier day', async () => {
    const user = userEvent.setup();
    renderEditor();
    await user.click(screen.getByLabelText(/channel 1/i)); // un-mark prior-bad channel 1
    // No immediate write — a confirm dialog appears instead.
    expect(onUpdate).not.toHaveBeenCalled();
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('on confirm: records the ack AND applies the un-mark', async () => {
    const user = userEvent.setup();
    renderEditor();
    await user.click(screen.getByLabelText(/channel 1/i));
    await user.click(screen.getByRole('button', { name: /un-mark|confirm/i }));
    expect(onAcknowledgeRemoval).toHaveBeenCalledWith('1', 1);
    expect(onUpdate).toHaveBeenCalledWith('1', [2]); // 1 removed, 2 kept
  });

  it('on cancel: leaves the channel marked (no write, no ack)', async () => {
    const user = userEvent.setup();
    renderEditor();
    await user.click(screen.getByLabelText(/channel 1/i));
    await user.click(screen.getByRole('button', { name: /keep it marked/i }));
    expect(onAcknowledgeRemoval).not.toHaveBeenCalled();
    expect(onUpdate).not.toHaveBeenCalled();
  });

  it('does NOT prompt when un-marking a channel that was NOT prior-bad', async () => {
    const user = userEvent.setup();
    renderEditor();
    await user.click(screen.getByLabelText(/channel 2/i)); // channel 2 not in priorBadByNtrode
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(onUpdate).toHaveBeenCalledWith('1', [1]); // immediate un-mark
    expect(onAcknowledgeRemoval).not.toHaveBeenCalled();
  });

  it('does NOT prompt when MARKING a channel (only un-marking is intercepted)', async () => {
    const user = userEvent.setup();
    render(
      <BadChannelsEditor
        ntrodes={ntrodes}
        badChannels={{ '1': [] }}
        onUpdate={onUpdate}
        onAcknowledgeRemoval={onAcknowledgeRemoval}
        priorBadByNtrode={{ '1': [1] }}
      />
    );
    await user.click(screen.getByLabelText(/channel 1/i)); // MARK channel 1
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(onUpdate).toHaveBeenCalledWith('1', [1]);
  });
});
