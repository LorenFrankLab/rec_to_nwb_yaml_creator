// src/hooks/__tests__/useAnimalIdFromUrl.test.js
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useAnimalIdFromUrl } from '../useAnimalIdFromUrl';

describe('useAnimalIdFromUrl', () => {
  let originalHash;

  beforeEach(() => {
    originalHash = window.location.hash;
  });

  afterEach(() => {
    window.location.hash = originalHash;
  });

  it('extracts animal ID from #/animal/:id/editor route', () => {
    window.location.hash = '#/animal/remy/editor';
    const { result } = renderHook(() => useAnimalIdFromUrl());
    expect(result.current).toBe('remy');
  });

  it('extracts animal ID with hyphens', () => {
    window.location.hash = '#/animal/bean-whiskey/editor';
    const { result } = renderHook(() => useAnimalIdFromUrl());
    expect(result.current).toBe('bean-whiskey');
  });

  it('returns null for non-animal-editor routes', () => {
    window.location.hash = '#/workspace';
    const { result } = renderHook(() => useAnimalIdFromUrl());
    expect(result.current).toBeNull();
  });

  it('returns null for malformed routes', () => {
    window.location.hash = '#/animal/';
    const { result } = renderHook(() => useAnimalIdFromUrl());
    expect(result.current).toBeNull();
  });

  it('handles URL with query parameters', () => {
    window.location.hash = '#/animal/remy/editor?step=groups';
    const { result } = renderHook(() => useAnimalIdFromUrl());
    expect(result.current).toBe('remy');
  });

  it('decodes URL-encoded animal IDs with spaces', () => {
    window.location.hash = '#/animal/bean%20whiskey/editor';
    const { result } = renderHook(() => useAnimalIdFromUrl());
    expect(result.current).toBe('bean whiskey');
  });

  it('decodes URL-encoded special characters', () => {
    window.location.hash = '#/animal/test%2Fanimal/editor';
    const { result } = renderHook(() => useAnimalIdFromUrl());
    expect(result.current).toBe('test/animal');
  });

  it('handles complex IDs with underscores and periods', () => {
    window.location.hash = '#/animal/animal_01.2023/editor';
    const { result } = renderHook(() => useAnimalIdFromUrl());
    expect(result.current).toBe('animal_01.2023');
  });

  it('updates animal ID on hash change', () => {
    window.location.hash = '#/animal/remy/editor';
    const { result, rerender } = renderHook(() => useAnimalIdFromUrl());
    expect(result.current).toBe('remy');

    // Simulate navigation to different animal
    act(() => {
      window.location.hash = '#/animal/bean/editor';
      window.dispatchEvent(new HashChangeEvent('hashchange'));
    });
    rerender();
    expect(result.current).toBe('bean');
  });

  it('clears animal ID when navigating away', () => {
    window.location.hash = '#/animal/remy/editor';
    const { result, rerender } = renderHook(() => useAnimalIdFromUrl());
    expect(result.current).toBe('remy');

    // Navigate to different route
    act(() => {
      window.location.hash = '#/workspace';
      window.dispatchEvent(new HashChangeEvent('hashchange'));
    });
    rerender();
    expect(result.current).toBeNull();
  });
});
