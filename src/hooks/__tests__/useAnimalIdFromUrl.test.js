// src/hooks/__tests__/useAnimalIdFromUrl.test.js
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';
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
});
