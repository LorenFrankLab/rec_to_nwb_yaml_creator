import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act, fireEvent } from '@testing-library/react';
import { useState } from 'react';
import { useDraftField } from '../useDraftField';
import {
  flushAllDrafts,
  hasPendingDrafts,
  hasUnflushableDrafts,
  registerDraft,
  resetDraftRegistryForTests,
} from '../../state/draftRegistry';

/**
 * A minimal store-backed textarea using the hook, like DayTab's session description.
 *
 * @param {object} props
 * @param {(v: string) => void} props.onCommit - Commit spy.
 * @param {number} [props.debounceMs] - Debounce.
 * @returns {JSX.Element}
 */
function Harness({ onCommit, debounceMs = 400 }) {
  const [committed, setCommitted] = useState('old');
  const field = useDraftField({
    value: committed,
    onCommit: (v) => {
      setCommitted(v);
      onCommit(v);
    },
    debounceMs,
    label: 'test',
  });
  return (
    <>
      <textarea aria-label="desc" value={field.value} onChange={(e) => field.setValue(e.target.value)} onBlur={field.flush} />
      <output data-testid="committed">{committed}</output>
    </>
  );
}

describe('useDraftField + draftRegistry', () => {
  beforeEach(() => {
    resetDraftRegistryForTests();
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('shows the typed text immediately and reports a pending draft before the debounce fires', () => {
    const onCommit = vi.fn();
    render(<Harness onCommit={onCommit} />);
    const box = screen.getByLabelText('desc');
    fireEvent.change(box, { target: { value: 'new text' } });
    expect(box.value).toBe('new text');
    expect(hasPendingDrafts()).toBe(true);
    expect(onCommit).not.toHaveBeenCalled();
  });

  it('commits on the debounce and clears the pending state', () => {
    const onCommit = vi.fn();
    render(<Harness onCommit={onCommit} />);
    fireEvent.change(screen.getByLabelText('desc'), { target: { value: 'typed' } });
    act(() => {
      vi.advanceTimersByTime(400);
    });
    expect(onCommit).toHaveBeenCalledWith('typed');
    expect(screen.getByTestId('committed').textContent).toBe('typed');
    expect(hasPendingDrafts()).toBe(false);
  });

  it('flushAllDrafts commits a focused, still-debouncing field (the Ctrl/Cmd+S path)', () => {
    const onCommit = vi.fn();
    render(<Harness onCommit={onCommit} />);
    fireEvent.change(screen.getByLabelText('desc'), { target: { value: 'mid-typing' } });
    let flushed = 0;
    act(() => {
      flushed = flushAllDrafts();
    });
    expect(flushed).toBe(1);
    expect(onCommit).toHaveBeenCalledWith('mid-typing');
    expect(hasPendingDrafts()).toBe(false);
  });

  it('blur commits immediately', () => {
    const onCommit = vi.fn();
    render(<Harness onCommit={onCommit} />);
    const box = screen.getByLabelText('desc');
    fireEvent.change(box, { target: { value: 'blurred' } });
    fireEvent.blur(box);
    expect(onCommit).toHaveBeenCalledWith('blurred');
  });

  it('typing back to the committed value is not a pending draft', () => {
    const onCommit = vi.fn();
    render(<Harness onCommit={onCommit} />);
    const box = screen.getByLabelText('desc');
    fireEvent.change(box, { target: { value: 'oldx' } });
    fireEvent.change(box, { target: { value: 'old' } });
    expect(hasPendingDrafts()).toBe(false);
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(onCommit).not.toHaveBeenCalled();
  });

  it('commits a pending draft on unmount rather than dropping it', () => {
    const onCommit = vi.fn();
    const { unmount } = render(<Harness onCommit={onCommit} />);
    fireEvent.change(screen.getByLabelText('desc'), { target: { value: 'leaving' } });
    unmount();
    expect(onCommit).toHaveBeenCalledWith('leaving');
    expect(hasPendingDrafts()).toBe(false);
  });

  it('an unflushable registration (dialog draft) arms the pending state but is skipped by flushAll', () => {
    const unregister = registerDraft({ isDirty: () => true, flush: null, label: 'dialog' });
    expect(hasPendingDrafts()).toBe(true);
    expect(hasUnflushableDrafts()).toBe(true);
    expect(flushAllDrafts()).toBe(0);
    unregister();
    expect(hasPendingDrafts()).toBe(false);
  });
});
