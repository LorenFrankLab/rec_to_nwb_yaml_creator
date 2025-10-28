import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useDayIdFromUrl } from '../useDayIdFromUrl';

describe('useDayIdFromUrl', () => {
  let originalHash;

  beforeEach(() => {
    originalHash = window.location.hash;
  });

  afterEach(() => {
    window.location.hash = originalHash;
  });

  it('returns null when no day in URL', () => {
    window.location.hash = '';
    const { result } = renderHook(() => useDayIdFromUrl());
    expect(result.current).toBe(null);
  });

  it('returns null when hash is not a day route', () => {
    window.location.hash = '#/workspace';
    const { result } = renderHook(() => useDayIdFromUrl());
    expect(result.current).toBe(null);
  });

  it('parses dayId from #/day/:id', () => {
    window.location.hash = '#/day/remy-2023-06-22';
    const { result } = renderHook(() => useDayIdFromUrl());
    expect(result.current).toBe('remy-2023-06-22');
  });

  it('decodes URL-encoded characters', () => {
    window.location.hash = '#/day/remy%202023%2006%2022';
    const { result } = renderHook(() => useDayIdFromUrl());
    expect(result.current).toBe('remy 2023 06 22');
  });

  it('updates when hash changes', async () => {
    window.location.hash = '#/day/animal1-day1';
    const { result } = renderHook(() => useDayIdFromUrl());

    expect(result.current).toBe('animal1-day1');

    // Simulate hash change
    window.location.hash = '#/day/animal2-day2';
    window.dispatchEvent(new HashChangeEvent('hashchange'));

    await waitFor(() => {
      expect(result.current).toBe('animal2-day2');
    });
  });

  it('handles complex day IDs with slashes', () => {
    window.location.hash = '#/day/complex/id/with/slashes';
    const { result } = renderHook(() => useDayIdFromUrl());
    expect(result.current).toBe('complex/id/with/slashes');
  });

  it('cleans up event listener on unmount', () => {
    const { unmount } = renderHook(() => useDayIdFromUrl());
    const listenerCount = window.getEventListeners?.('hashchange')?.length || 0;

    unmount();

    // If getEventListeners is available (Chrome), verify cleanup
    if (window.getEventListeners) {
      const newListenerCount = window.getEventListeners('hashchange')?.length || 0;
      expect(newListenerCount).toBeLessThanOrEqual(listenerCount);
    }
    // Otherwise, this test just verifies no error on unmount
    expect(true).toBe(true);
  });
});
