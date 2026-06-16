import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import GeneratedValue from '../GeneratedValue';

describe('GeneratedValue (derived vs manual file value)', () => {
  it('shows the derived value as a read-only generated chip with an Override action', () => {
    render(
      <GeneratedValue
        value="20230622_a.h264"
        derived
        onOverride={() => {}}
        onRevert={() => {}}
        overrideLabel="Rename"
      />,
    );
    expect(screen.getByText('20230622_a.h264')).toBeInTheDocument();
    expect(screen.getByText(/generated/i)).toBeInTheDocument();
    // Generated values are read-only — not an editable-looking input.
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Rename' })).toBeInTheDocument();
  });

  it('calls onOverride when the override action is used', async () => {
    const user = userEvent.setup();
    const onOverride = vi.fn();
    render(
      <GeneratedValue
        value="x"
        derived
        onOverride={onOverride}
        onRevert={() => {}}
        overrideLabel="Override path"
      />,
    );
    await user.click(screen.getByRole('button', { name: 'Override path' }));
    expect(onOverride).toHaveBeenCalledTimes(1);
  });

  it('in manual mode shows an editable field, a manual tag, and Revert', async () => {
    const user = userEvent.setup();
    const onRevert = vi.fn();
    render(
      <GeneratedValue
        value="custom.h264"
        derived={false}
        onOverride={() => {}}
        onRevert={onRevert}
        overrideLabel="Rename"
      />,
    );
    expect(screen.getByRole('textbox')).toHaveValue('custom.h264');
    expect(screen.getByText(/manual/i)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /revert/i }));
    expect(onRevert).toHaveBeenCalledTimes(1);
  });

  it('reports manual edits via onChange and keeps the typed value when the value prop changes', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const { rerender } = render(
      <GeneratedValue
        value="seed.h264"
        derived={false}
        onOverride={() => {}}
        onRevert={() => {}}
        overrideLabel="Rename"
        onChange={onChange}
      />,
    );
    const input = screen.getByRole('textbox');
    await user.clear(input);
    await user.type(input, 'typed.h264');
    expect(onChange).toHaveBeenCalled();
    expect(onChange.mock.calls.at(-1)[0]).toBe('typed.h264');

    // The manual field is uncontrolled — a later `value` prop must NOT overwrite the user's text.
    rerender(
      <GeneratedValue
        value="newseed.h264"
        derived={false}
        onOverride={() => {}}
        onRevert={() => {}}
        overrideLabel="Rename"
        onChange={onChange}
      />,
    );
    expect(screen.getByRole('textbox')).toHaveValue('typed.h264');
  });
});
