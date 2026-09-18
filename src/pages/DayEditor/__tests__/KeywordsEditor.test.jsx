import { useState } from 'react';
import { describe, it, expect, vi } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import KeywordsEditor from '../KeywordsEditor';
import { flushAllDrafts } from '../../../state/draftRegistry';

describe('KeywordsEditor', () => {
  it('renders existing keywords in a visible editable list', () => {
    render(<KeywordsEditor value={['spatial', 'w-track']} onChange={vi.fn()} />);
    expect(screen.getByRole('textbox', { name: /keywords/i })).toHaveValue('spatial\nw-track');
  });

  it('saves all lines on blur, trimming and deduplicating without losing a pending keyword', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<KeywordsEditor value={[]} onChange={onChange} />);
    fireEvent.change(screen.getByRole('textbox'), { target: { value: ' opto \nhippocampus\n\nmPFC\nopto' } });
    screen.getByRole('textbox').focus();
    await user.tab();
    expect(onChange).toHaveBeenLastCalledWith(['opto', 'hippocampus', 'mPFC']);
  });

  it('flushes the focused draft before export without requiring blur or Enter', () => {
    const onChange = vi.fn();
    render(<KeywordsEditor value={[]} onChange={onChange} draftKey="test:keywords" />);
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'opto\nmPFC' } });
    act(() => { flushAllDrafts(); });
    expect(onChange).toHaveBeenCalledWith(['opto', 'mPFC']);
  });

  it('preserves a newly typed line break while autosave normalizes the stored list', () => {
    vi.useFakeTimers();
    /** Store-backed editor exercises normalization after an autosave. */
    function Editor() {
      const [value, setValue] = useState([]);
      return <KeywordsEditor value={value} onChange={setValue} />;
    }
    const { unmount } = render(<Editor />);
    const input = screen.getByRole('textbox');
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: 'opto\n' } });
    act(() => { vi.advanceTimersByTime(450); });
    expect(input).toHaveValue('opto\n');
    fireEvent.change(input, { target: { value: 'opto\nhippocampus' } });
    fireEvent.blur(input);
    expect(input).toHaveValue('opto\nhippocampus');
    unmount();
    vi.useRealTimers();
  });

  it('clearing the list saves an empty array', () => {
    const onChange = vi.fn();
    render(<KeywordsEditor value={['opto']} onChange={onChange} />);
    fireEvent.change(screen.getByRole('textbox'), { target: { value: '' } });
    fireEvent.blur(screen.getByRole('textbox'));
    expect(onChange).toHaveBeenCalledWith([]);
  });

  it('adds a previous keyword without losing a typed line', async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<KeywordsEditor value={[]} suggestions={['opto', 'opto']} onChange={onChange} />);
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'hippocampus' } });
    await user.click(screen.getByRole('button', { name: 'Add opto' }));
    expect(onChange).toHaveBeenLastCalledWith(['hippocampus', 'opto']);
  });
});
