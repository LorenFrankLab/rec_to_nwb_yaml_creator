/**
 * Tests for useHashRouter hook
 *
 * Tests hash-based routing logic for M2 - AppLayout component.
 * Ensures route parsing is correct, stable, and handles edge cases.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { parseHashRoute, useHashRouter } from '../useHashRouter';

describe('parseHashRoute', () => {
  describe('legacy route (default)', () => {
    it('parses empty hash as legacy route', () => {
      expect(parseHashRoute('')).toEqual({ view: 'legacy', params: {} });
    });

    it('parses # as legacy route', () => {
      expect(parseHashRoute('#')).toEqual({ view: 'legacy', params: {} });
    });

    it('parses #/ as legacy route', () => {
      expect(parseHashRoute('#/')).toEqual({ view: 'legacy', params: {} });
    });

    it('handles SSR/testing environment where window is undefined', () => {
      // Temporarily remove window
      const originalWindow = global.window;
      delete global.window;

      expect(parseHashRoute()).toEqual({ view: 'legacy', params: {} });

      // Restore window
      global.window = originalWindow;
    });
  });

  describe('exact route matches', () => {
    it('parses #/home as home route', () => {
      expect(parseHashRoute('#/home')).toEqual({ view: 'home', params: {} });
    });

    it('parses #/workspace as workspace route', () => {
      expect(parseHashRoute('#/workspace')).toEqual({ view: 'workspace', params: {} });
    });

    it('parses #/validation as validation route', () => {
      expect(parseHashRoute('#/validation')).toEqual({ view: 'validation', params: {} });
    });
  });

  describe('routes with query parameters', () => {
    it('parses #/workspace?animal=bean correctly', () => {
      expect(parseHashRoute('#/workspace?animal=bean')).toEqual({ view: 'workspace', params: {} });
    });

    it('parses #/home?foo=bar correctly', () => {
      expect(parseHashRoute('#/home?foo=bar')).toEqual({ view: 'home', params: {} });
    });

    it('parses #/validation?status=draft correctly', () => {
      expect(parseHashRoute('#/validation?status=draft')).toEqual({ view: 'validation', params: {} });
    });

    it('parses #/day/123?view=details correctly', () => {
      expect(parseHashRoute('#/day/123?view=details')).toEqual({
        view: 'day',
        params: { id: '123' }
      });
    });
  });

  describe('day route with ID parameter', () => {
    it('parses #/day/123 with valid ID', () => {
      expect(parseHashRoute('#/day/123')).toEqual({
        view: 'day',
        params: { id: '123' }
      });
    });

    it('parses #/day/remy-2023-06-22 with complex ID', () => {
      expect(parseHashRoute('#/day/remy-2023-06-22')).toEqual({
        view: 'day',
        params: { id: 'remy-2023-06-22' }
      });
    });

    it('handles alphanumeric IDs with special characters', () => {
      expect(parseHashRoute('#/day/abc_123-XYZ')).toEqual({
        view: 'day',
        params: { id: 'abc_123-XYZ' }
      });
    });
  });

  describe('invalid day route validation', () => {
    it('rejects #/day/ with missing ID', () => {
      const result = parseHashRoute('#/day/');
      expect(result.view).toBe('legacy');
      expect(result.params).toEqual({});
    });

    it('rejects #/day with no trailing slash', () => {
      const result = parseHashRoute('#/day');
      expect(result.view).toBe('legacy');
      expect(result.params).toEqual({});
    });

    it('rejects #/day/   with whitespace-only ID', () => {
      const result = parseHashRoute('#/day/   ');
      expect(result.view).toBe('legacy');
      expect(result.params).toEqual({});
    });

    it('rejects #/day/123/extra with trailing segments', () => {
      const result = parseHashRoute('#/day/123/extra');
      expect(result.view).toBe('legacy');
      expect(result.params).toEqual({});
    });
  });

  describe('unknown routes', () => {
    it('marks unknown route with flag', () => {
      const result = parseHashRoute('#/unknown');
      expect(result.view).toBe('legacy');
      expect(result.isUnknownRoute).toBe(true);
    });

    it('falls back to legacy for #/daylight (near-miss)', () => {
      const result = parseHashRoute('#/daylight');
      expect(result.view).toBe('legacy');
      expect(result.isUnknownRoute).toBe(true);
    });

    it('falls back to legacy for malformed routes', () => {
      const result = parseHashRoute('#//workspace');
      expect(result.view).toBe('legacy');
    });
  });

  describe('console warnings', () => {
    let consoleWarnSpy;

    beforeEach(() => {
      consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    });

    afterEach(() => {
      consoleWarnSpy.mockRestore();
    });

    it('warns on empty day ID', () => {
      // #/day/ doesn't match regex, so it's treated as unknown route
      parseHashRoute('#/day/');
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('Unknown route'),
        '/day/'
      );
    });

    it('warns on whitespace-only day ID', () => {
      // #/day/   matches regex but ID is invalid
      parseHashRoute('#/day/   ');
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('Invalid day ID'),
        '/day/   '
      );
    });

    it('warns on unknown route', () => {
      parseHashRoute('#/unknown');
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('Unknown route'),
        '/unknown'
      );
    });
  });
});

describe('useHashRouter hook', () => {
  let originalLocation;

  beforeEach(() => {
    // Save original location
    originalLocation = window.location;

    // Mock window.location with hash support
    delete window.location;
    window.location = { hash: '#/' };
  });

  afterEach(() => {
    // Restore original location
    window.location = originalLocation;
  });

  describe('initial route parsing', () => {
    it('returns legacy route on initial render with #/', () => {
      window.location.hash = '#/';
      const { result } = renderHook(() => useHashRouter());

      expect(result.current).toEqual({ view: 'legacy', params: {} });
    });

    it('returns home route on initial render with #/home', () => {
      window.location.hash = '#/home';
      const { result } = renderHook(() => useHashRouter());

      expect(result.current).toEqual({ view: 'home', params: {} });
    });

    it('returns day route on initial render with #/day/123', () => {
      window.location.hash = '#/day/123';
      const { result } = renderHook(() => useHashRouter());

      expect(result.current).toEqual({ view: 'day', params: { id: '123' } });
    });
  });

  describe('hashchange event handling', () => {
    it('updates route when hash changes', async () => {
      window.location.hash = '#/';
      const { result } = renderHook(() => useHashRouter());

      expect(result.current.view).toBe('legacy');

      // Simulate hash change
      act(() => {
        window.location.hash = '#/workspace';
        window.dispatchEvent(new HashChangeEvent('hashchange'));
      });

      await waitFor(() => {
        expect(result.current).toEqual({ view: 'workspace', params: {} });
      });
    });

    it('updates multiple times as hash changes', async () => {
      window.location.hash = '#/';
      const { result } = renderHook(() => useHashRouter());

      // Change 1: legacy -> home
      act(() => {
        window.location.hash = '#/home';
        window.dispatchEvent(new HashChangeEvent('hashchange'));
      });

      await waitFor(() => {
        expect(result.current.view).toBe('home');
      });

      // Change 2: home -> workspace
      act(() => {
        window.location.hash = '#/workspace';
        window.dispatchEvent(new HashChangeEvent('hashchange'));
      });

      await waitFor(() => {
        expect(result.current.view).toBe('workspace');
      });

      // Change 3: workspace -> day
      act(() => {
        window.location.hash = '#/day/abc';
        window.dispatchEvent(new HashChangeEvent('hashchange'));
      });

      await waitFor(() => {
        expect(result.current).toEqual({ view: 'day', params: { id: 'abc' } });
      });
    });

    it('handles browser back navigation', async () => {
      window.location.hash = '#/workspace';
      const { result } = renderHook(() => useHashRouter());

      expect(result.current.view).toBe('workspace');

      // Simulate browser back button (hash changes to previous)
      act(() => {
        window.location.hash = '#/';
        window.dispatchEvent(new HashChangeEvent('hashchange'));
      });

      await waitFor(() => {
        expect(result.current.view).toBe('legacy');
      });
    });

    it('handles browser forward navigation', async () => {
      window.location.hash = '#/';
      const { result } = renderHook(() => useHashRouter());

      // Go forward
      act(() => {
        window.location.hash = '#/home';
        window.dispatchEvent(new HashChangeEvent('hashchange'));
      });

      await waitFor(() => {
        expect(result.current.view).toBe('home');
      });
    });
  });

  describe('cleanup and memory leaks', () => {
    it('removes event listener on unmount', () => {
      const addEventListenerSpy = vi.spyOn(window, 'addEventListener');
      const removeEventListenerSpy = vi.spyOn(window, 'removeEventListener');

      const { unmount } = renderHook(() => useHashRouter());

      // Verify listener was added
      expect(addEventListenerSpy).toHaveBeenCalledWith(
        'hashchange',
        expect.any(Function)
      );

      // Unmount and verify listener was removed
      unmount();

      expect(removeEventListenerSpy).toHaveBeenCalledWith(
        'hashchange',
        expect.any(Function)
      );

      addEventListenerSpy.mockRestore();
      removeEventListenerSpy.mockRestore();
    });

    it('does not update state after unmount', async () => {
      window.location.hash = '#/';
      const { result, unmount } = renderHook(() => useHashRouter());

      expect(result.current.view).toBe('legacy');

      // Unmount before hash change
      unmount();

      // Try to change hash (should not update state)
      act(() => {
        window.location.hash = '#/home';
        window.dispatchEvent(new HashChangeEvent('hashchange'));
      });

      // State should still be legacy (not updated after unmount)
      expect(result.current.view).toBe('legacy');
    });
  });

  describe('stability and re-render behavior', () => {
    it('does not cause infinite re-renders', () => {
      window.location.hash = '#/';

      let renderCount = 0;
      const { rerender } = renderHook(() => {
        renderCount++;
        return useHashRouter();
      });

      const initialRenderCount = renderCount;

      // Force a few re-renders
      rerender();
      rerender();
      rerender();

      // Should not have triggered additional renders beyond forced ones
      expect(renderCount).toBe(initialRenderCount + 3);
    });

    it('returns stable reference when route has not changed', () => {
      window.location.hash = '#/';
      const { result, rerender } = renderHook(() => useHashRouter());

      const firstResult = result.current;

      // Re-render without changing hash
      rerender();

      // Should be same object reference (stable)
      expect(result.current).toBe(firstResult);
    });
  });

  describe('edge cases', () => {
    it('handles rapid hash changes', async () => {
      window.location.hash = '#/';
      const { result } = renderHook(() => useHashRouter());

      // Rapid fire hash changes
      act(() => {
        window.location.hash = '#/home';
        window.dispatchEvent(new HashChangeEvent('hashchange'));

        window.location.hash = '#/workspace';
        window.dispatchEvent(new HashChangeEvent('hashchange'));

        window.location.hash = '#/validation';
        window.dispatchEvent(new HashChangeEvent('hashchange'));
      });

      // Should end up on last hash
      await waitFor(() => {
        expect(result.current.view).toBe('validation');
      });
    });

    it('handles hash with query parameters', () => {
      window.location.hash = '#/workspace?animal=remy';
      const { result } = renderHook(() => useHashRouter());

      // Should strip query params and match route correctly
      expect(result.current.view).toBe('workspace');
      expect(result.current.params).toEqual({});
    });

    it('handles hash with anchor fragments', () => {
      // Hash like #/workspace#section-cameras (unlikely but possible)
      window.location.hash = '#/workspace#cameras';
      const { result } = renderHook(() => useHashRouter());

      // Should treat as unknown route
      expect(result.current.view).toBe('legacy');
    });
  });
});

describe('integration scenarios', () => {
  let originalLocation;

  beforeEach(() => {
    originalLocation = window.location;
    delete window.location;
    window.location = { hash: '#/' };
  });

  afterEach(() => {
    window.location = originalLocation;
  });

  it('simulates full user navigation flow', async () => {
    // Start on legacy form
    window.location.hash = '#/';
    const { result } = renderHook(() => useHashRouter());
    expect(result.current.view).toBe('legacy');

    // User clicks link to home
    act(() => {
      window.location.hash = '#/home';
      window.dispatchEvent(new HashChangeEvent('hashchange'));
    });
    await waitFor(() => expect(result.current.view).toBe('home'));

    // User navigates to workspace
    act(() => {
      window.location.hash = '#/workspace';
      window.dispatchEvent(new HashChangeEvent('hashchange'));
    });
    await waitFor(() => expect(result.current.view).toBe('workspace'));

    // User opens day editor
    act(() => {
      window.location.hash = '#/day/remy-2023-06-22';
      window.dispatchEvent(new HashChangeEvent('hashchange'));
    });
    await waitFor(() => {
      expect(result.current.view).toBe('day');
      expect(result.current.params.id).toBe('remy-2023-06-22');
    });

    // User clicks browser back button
    act(() => {
      window.location.hash = '#/workspace';
      window.dispatchEvent(new HashChangeEvent('hashchange'));
    });
    await waitFor(() => expect(result.current.view).toBe('workspace'));

    // User clicks browser back again
    act(() => {
      window.location.hash = '#/home';
      window.dispatchEvent(new HashChangeEvent('hashchange'));
    });
    await waitFor(() => expect(result.current.view).toBe('home'));

    // User clicks logo to return to legacy form
    act(() => {
      window.location.hash = '#/';
      window.dispatchEvent(new HashChangeEvent('hashchange'));
    });
    await waitFor(() => expect(result.current.view).toBe('legacy'));
  });

  it('handles accidental navigation to unknown route', async () => {
    window.location.hash = '#/workspace';
    const { result } = renderHook(() => useHashRouter());

    // User types invalid URL
    act(() => {
      window.location.hash = '#/invalid-page';
      window.dispatchEvent(new HashChangeEvent('hashchange'));
    });

    await waitFor(() => {
      expect(result.current.view).toBe('legacy');
      expect(result.current.isUnknownRoute).toBe(true);
    });
  });

  it('parses #/animal/:id/editor route', () => {
    window.location.hash = '#/animal/remy/editor';
    const { result } = renderHook(() => useHashRouter());

    expect(result.current.view).toBe('animal-editor');
    expect(result.current.params.animalId).toBe('remy');
  });

  it('parses animal editor route with query params', () => {
    window.location.hash = '#/animal/bean/editor?step=groups';
    const { result } = renderHook(() => useHashRouter());

    expect(result.current.view).toBe('animal-editor');
    expect(result.current.params.animalId).toBe('bean');
  });
});

describe('animal editor route edge cases', () => {
  describe('valid animal IDs', () => {
    it('handles complex alphanumeric IDs with hyphens and underscores', () => {
      expect(parseHashRoute('#/animal/remy-2023_batch-1/editor')).toEqual({
        view: 'animal-editor',
        params: { animalId: 'remy-2023_batch-1' }
      });
    });

    it('handles numeric-only IDs', () => {
      expect(parseHashRoute('#/animal/12345/editor')).toEqual({
        view: 'animal-editor',
        params: { animalId: '12345' }
      });
    });

    it('handles uppercase IDs', () => {
      expect(parseHashRoute('#/animal/BEAN/editor')).toEqual({
        view: 'animal-editor',
        params: { animalId: 'BEAN' }
      });
    });
  });

  describe('invalid animal IDs', () => {
    it('rejects #/animal//editor with missing ID', () => {
      const result = parseHashRoute('#/animal//editor');
      expect(result.view).toBe('legacy');
      expect(result.params).toEqual({});
    });

    it('rejects #/animal/   /editor with whitespace-only ID', () => {
      const result = parseHashRoute('#/animal/   /editor');
      expect(result.view).toBe('legacy');
      expect(result.params).toEqual({});
    });

    it('rejects #/animal/remy with missing /editor suffix', () => {
      const result = parseHashRoute('#/animal/remy');
      expect(result.view).toBe('legacy');
      expect(result.params).toEqual({});
    });

    it('rejects #/animal/remy/editor/extra with trailing segments', () => {
      const result = parseHashRoute('#/animal/remy/editor/extra');
      expect(result.view).toBe('legacy');
      expect(result.params).toEqual({});
    });
  });

  describe('console warnings for invalid animal IDs', () => {
    let consoleWarnSpy;

    beforeEach(() => {
      consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    });

    afterEach(() => {
      consoleWarnSpy.mockRestore();
    });

    it('warns on whitespace-only animal ID', () => {
      parseHashRoute('#/animal/   /editor');
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('Invalid animal ID'),
        '/animal/   /editor'
      );
    });

    it('warns on empty animal ID (regex doesn\'t match)', () => {
      parseHashRoute('#/animal//editor');
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('Unknown route'),
        '/animal//editor'
      );
    });
  });
});
