import { describe, it, expect, vi } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import UndoToast, { useUndoToast } from '../UndoToast';

describe('UndoToast (reversible-action confirmation)', () => {
  it('announces via a polite status live region', () => {
    render(<UndoToast message="Deleted day" onDismiss={() => {}} />);
    const status = screen.getByRole('status');
    expect(status).toHaveAttribute('aria-live', 'polite');
    expect(status).toHaveTextContent('Deleted day');
  });

  it('shows an Undo button only when the action is reversible (onUndo given)', () => {
    const { rerender } = render(<UndoToast message="Deleted day" onUndo={() => {}} onDismiss={() => {}} />);
    expect(screen.getByRole('button', { name: /undo/i })).toBeInTheDocument();
    rerender(<UndoToast message="Saved" onDismiss={() => {}} />);
    expect(screen.queryByRole('button', { name: /undo/i })).not.toBeInTheDocument();
  });

  it('fires onUndo when Undo is clicked', async () => {
    const onUndo = vi.fn();
    const user = userEvent.setup();
    render(<UndoToast message="Deleted day" onUndo={onUndo} onDismiss={() => {}} />);
    await user.click(screen.getByRole('button', { name: /undo/i }));
    expect(onUndo).toHaveBeenCalledTimes(1);
  });

  it('offers a dismiss control even when not reversible', async () => {
    const onDismiss = vi.fn();
    const user = userEvent.setup();
    render(<UndoToast message="Saved" onDismiss={onDismiss} />);
    await user.click(screen.getByRole('button', { name: /dismiss/i }));
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it('auto-dismisses after autoHideMs', () => {
    vi.useFakeTimers();
    try {
      const onDismiss = vi.fn();
      render(<UndoToast message="Saved" onDismiss={onDismiss} autoHideMs={3000} />);
      expect(onDismiss).not.toHaveBeenCalled();
      act(() => {
        vi.advanceTimersByTime(3000);
      });
      expect(onDismiss).toHaveBeenCalledTimes(1);
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('useUndoToast (single host toast)', () => {
  it('mounts one toast and shows messages on demand, hiding after Undo', async () => {
    const user = userEvent.setup();
    const onUndo = vi.fn();
    /**
     * Harness that drives the toast through the host hook.
     * @returns {JSX.Element} A trigger button plus the hosted toast node.
     */
    function Host() {
      const { show, node } = useUndoToast();
      return (
        <>
          <button type="button" onClick={() => show('Deleted day', onUndo)}>
            trigger
          </button>
          {node}
        </>
      );
    }
    render(<Host />);
    expect(screen.queryByRole('status')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'trigger' }));
    expect(screen.getByRole('status')).toHaveTextContent('Deleted day');

    await user.click(screen.getByRole('button', { name: /undo/i }));
    expect(onUndo).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('shows a dismiss-only toast (no Undo) for a non-reversible message', async () => {
    const user = userEvent.setup();
    /**
     * Harness that raises a non-reversible toast (no onUndo).
     * @returns {JSX.Element} A trigger button plus the hosted toast node.
     */
    function Host() {
      const { show, node } = useUndoToast();
      return (
        <>
          <button type="button" onClick={() => show('Saved')}>
            trigger
          </button>
          {node}
        </>
      );
    }
    render(<Host />);
    await user.click(screen.getByRole('button', { name: 'trigger' }));
    expect(screen.getByRole('status')).toHaveTextContent('Saved');
    expect(screen.queryByRole('button', { name: /undo/i })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /dismiss/i })).toBeInTheDocument();
  });

  it('gives each successive toast its own full auto-hide window', () => {
    vi.useFakeTimers();
    try {
      /**
       * Harness with a short auto-hide window to exercise back-to-back toasts.
       * @returns {JSX.Element} A trigger button plus the hosted toast node.
       */
      function Host() {
        const { show, node } = useUndoToast(1000);
        return (
          <>
            <button type="button" onClick={() => show('msg')}>
              trigger
            </button>
            {node}
          </>
        );
      }
      render(<Host />);

      act(() => {
        screen.getByRole('button', { name: 'trigger' }).click();
      });
      expect(screen.getByRole('status')).toBeInTheDocument();

      // 900ms into the first toast's window, raise a second toast.
      act(() => {
        vi.advanceTimersByTime(900);
      });
      act(() => {
        screen.getByRole('button', { name: 'trigger' }).click();
      });

      // The second toast must NOT inherit the first's nearly-elapsed timer.
      act(() => {
        vi.advanceTimersByTime(200);
      });
      expect(screen.getByRole('status')).toBeInTheDocument();

      // It dismisses only after its own full window elapses.
      act(() => {
        vi.advanceTimersByTime(800);
      });
      expect(screen.queryByRole('status')).not.toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });
});
