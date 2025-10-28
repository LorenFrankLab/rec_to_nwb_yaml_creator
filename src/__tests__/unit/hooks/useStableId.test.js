/**
 * @file Tests for useStableId hook
 * @description Ensures unique, stable IDs for form inputs to support accessibility
 */

import { describe, it, expect } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useStableId } from '../../../hooks/useStableId';

describe('useStableId', () => {
  describe('Basic Functionality', () => {
    it('should return the provided ID when given', () => {
      const { result } = renderHook(() => useStableId('my-custom-id'));
      expect(result.current).toBe('my-custom-id');
    });

    it('should generate a unique ID when none provided', () => {
      const { result: result1 } = renderHook(() => useStableId());
      const { result: result2 } = renderHook(() => useStableId());

      expect(result1.current).toBeTruthy();
      expect(result2.current).toBeTruthy();
      expect(result1.current).not.toBe(result2.current);
    });

    it('should generate ID with default prefix when no ID provided', () => {
      const { result } = renderHook(() => useStableId());
      expect(result.current).toMatch(/^stable-id-\d+$/);
    });

    it('should accept custom prefix for generated IDs', () => {
      const { result } = renderHook(() => useStableId(undefined, 'input'));
      expect(result.current).toMatch(/^input-\d+$/);
    });
  });

  describe('Stability', () => {
    it('should return same ID across re-renders', () => {
      const { result, rerender } = renderHook(() => useStableId());
      const firstId = result.current;

      rerender();
      rerender();
      rerender();

      expect(result.current).toBe(firstId);
    });

    it('should return same ID when provided ID changes to undefined', () => {
      const { result, rerender } = renderHook(
        ({ id }) => useStableId(id),
        { initialProps: { id: 'initial-id' } }
      );

      expect(result.current).toBe('initial-id');

      // Simulate prop change to undefined
      rerender({ id: undefined });

      // Should keep the original ID, not generate new one
      expect(result.current).toBe('initial-id');
    });

    it('should update ID when provided ID changes to a new value', () => {
      const { result, rerender } = renderHook(
        ({ id }) => useStableId(id),
        { initialProps: { id: 'initial-id' } }
      );

      expect(result.current).toBe('initial-id');

      rerender({ id: 'new-id' });

      expect(result.current).toBe('new-id');
    });
  });

  describe('Uniqueness', () => {
    it('should generate unique IDs for multiple instances', () => {
      const ids = new Set();

      for (let i = 0; i < 100; i++) {
        const { result } = renderHook(() => useStableId());
        ids.add(result.current);
      }

      // All 100 IDs should be unique
      expect(ids.size).toBe(100);
    });

    it('should not collide with provided IDs', () => {
      const { result: provided } = renderHook(() => useStableId('user-provided'));
      const { result: generated } = renderHook(() => useStableId());

      expect(provided.current).not.toBe(generated.current);
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty string as provided ID', () => {
      const { result } = renderHook(() => useStableId(''));
      expect(result.current).toMatch(/^stable-id-\d+$/);
    });

    it('should handle null as provided ID', () => {
      const { result } = renderHook(() => useStableId(null));
      expect(result.current).toMatch(/^stable-id-\d+$/);
    });

    it('should handle whitespace-only ID', () => {
      const { result } = renderHook(() => useStableId('   '));
      expect(result.current).toMatch(/^stable-id-\d+$/);
    });

    it('should preserve IDs with special characters', () => {
      const specialId = 'my-id_123.test[0]';
      const { result } = renderHook(() => useStableId(specialId));
      expect(result.current).toBe(specialId);
    });

    it('should work with numeric IDs', () => {
      const { result } = renderHook(() => useStableId(123));
      expect(result.current).toBe('123');
    });
  });

  describe('Component Integration', () => {
    it('should work in array contexts with indices', () => {
      const items = ['a', 'b', 'c'];
      const hooks = items.map((_, index) =>
        renderHook(() => useStableId(`item-${index}`))
      );

      expect(hooks[0].result.current).toBe('item-0');
      expect(hooks[1].result.current).toBe('item-1');
      expect(hooks[2].result.current).toBe('item-2');
    });

    it('should support dynamic array items with fallback generation', () => {
      const { result: result1 } = renderHook(() => useStableId(undefined, 'array-item'));
      const { result: result2 } = renderHook(() => useStableId(undefined, 'array-item'));

      expect(result1.current).toMatch(/^array-item-\d+$/);
      expect(result2.current).toMatch(/^array-item-\d+$/);
      expect(result1.current).not.toBe(result2.current);
    });
  });
});
