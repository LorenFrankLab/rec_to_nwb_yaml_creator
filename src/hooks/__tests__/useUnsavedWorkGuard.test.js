import { describe, it, expect, vi, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useUnsavedWorkGuard } from '../useUnsavedWorkGuard';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('useUnsavedWorkGuard', () => {
  it('does not register a beforeunload listener when there is no unsaved work', () => {
    const addSpy = vi.spyOn(window, 'addEventListener');

    renderHook(() => useUnsavedWorkGuard(false));

    expect(addSpy).not.toHaveBeenCalledWith('beforeunload', expect.any(Function));
  });

  it('registers a beforeunload listener while work is unsaved and removes it on cleanup', () => {
    const addSpy = vi.spyOn(window, 'addEventListener');
    const removeSpy = vi.spyOn(window, 'removeEventListener');

    const { unmount } = renderHook(() => useUnsavedWorkGuard(true));

    expect(addSpy).toHaveBeenCalledWith('beforeunload', expect.any(Function));

    unmount();
    expect(removeSpy).toHaveBeenCalledWith('beforeunload', expect.any(Function));
  });

  it('unregisters the listener when unsaved work clears', () => {
    const removeSpy = vi.spyOn(window, 'removeEventListener');

    const { rerender } = renderHook(({ pending }) => useUnsavedWorkGuard(pending), {
      initialProps: { pending: true },
    });

    rerender({ pending: false });

    expect(removeSpy).toHaveBeenCalledWith('beforeunload', expect.any(Function));
  });

  it('the handler sets returnValue so the native prompt shows', () => {
    let captured;
    vi.spyOn(window, 'addEventListener').mockImplementation((type, handler) => {
      if (type === 'beforeunload') captured = handler;
    });

    renderHook(() => useUnsavedWorkGuard(true));

    const event = { preventDefault: vi.fn(), returnValue: undefined };
    captured(event);

    expect(event.preventDefault).toHaveBeenCalled();
    expect(event.returnValue).toBe('');
  });
});
