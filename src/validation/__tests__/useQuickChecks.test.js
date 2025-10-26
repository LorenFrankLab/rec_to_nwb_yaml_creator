/**
 * useQuickChecks Hook Tests
 *
 * Simplified tests focusing on core functionality without fake timer complexity.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useQuickChecks } from '../useQuickChecks';

describe('useQuickChecks', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  describe('Basic Functionality', () => {
    it('should initialize with null hint', () => {
      const { result } = renderHook(() => useQuickChecks('required'));
      expect(result.current.hint).toBeNull();
    });

    it('should provide validate function', () => {
      const { result } = renderHook(() => useQuickChecks('required'));
      expect(typeof result.current.validate).toBe('function');
    });

    it('should provide clear function', () => {
      const { result } = renderHook(() => useQuickChecks('required'));
      expect(typeof result.current.clear).toBe('function');
    });
  });

  describe('Debounced Validation', () => {
    it('should not validate immediately', () => {
      const { result } = renderHook(() => useQuickChecks('required'));

      act(() => {
        result.current.validate('field', '');
      });

      expect(result.current.hint).toBeNull();
    });

    it('should validate after debounce delay', () => {
      const { result } = renderHook(() => useQuickChecks('required'));

      act(() => {
        result.current.validate('field', '');
      });

      act(() => {
        vi.advanceTimersByTime(300);
      });

      expect(result.current.hint).toMatchObject({
        severity: 'hint',
        message: 'This field is required'
      });
    });

    it('should use custom debounce delay', () => {
      const { result } = renderHook(() => useQuickChecks('required', { debounceMs: 500 }));

      act(() => {
        result.current.validate('field', '');
      });

      act(() => {
        vi.advanceTimersByTime(300);
      });
      expect(result.current.hint).toBeNull();

      act(() => {
        vi.advanceTimersByTime(200);
      });
      expect(result.current.hint).not.toBeNull();
    });

    it('should cancel previous validation on rapid changes', () => {
      const { result } = renderHook(() => useQuickChecks('required'));

      act(() => {
        result.current.validate('field', '');
      });

      act(() => {
        vi.advanceTimersByTime(100);
      });

      act(() => {
        result.current.validate('field', 'valid');
      });

      act(() => {
        vi.advanceTimersByTime(300);
      });

      expect(result.current.hint).toBeNull();
    });
  });

  describe('Validation Types', () => {
    it('should validate required fields', () => {
      const { result } = renderHook(() => useQuickChecks('required'));

      act(() => {
        result.current.validate('lab', '');
        vi.advanceTimersByTime(300);
      });

      expect(result.current.hint).toMatchObject({
        severity: 'hint',
        message: 'This field is required'
      });
    });

    it('should validate date format', () => {
      const { result } = renderHook(() => useQuickChecks('dateFormat'));

      act(() => {
        result.current.validate('date', '06/22/2023');
        vi.advanceTimersByTime(300);
      });

      expect(result.current.hint).toMatchObject({
        severity: 'hint',
        message: expect.stringContaining('ISO 8601')
      });
    });

    it('should validate enum', () => {
      const { result } = renderHook(() =>
        useQuickChecks('enum', { validValues: ['M', 'F', 'U'] })
      );

      act(() => {
        result.current.validate('sex', 'X');
        vi.advanceTimersByTime(300);
      });

      expect(result.current.hint).toMatchObject({
        severity: 'hint',
        message: expect.stringContaining('Must be one of')
      });
    });

    it('should validate number range', () => {
      const { result } = renderHook(() =>
        useQuickChecks('numberRange', { min: 0, max: 1000 })
      );

      act(() => {
        result.current.validate('weight', -50);
        vi.advanceTimersByTime(300);
      });

      expect(result.current.hint).toMatchObject({
        severity: 'hint',
        message: expect.stringContaining('at least 0')
      });
    });

    it('should validate pattern', () => {
      const { result } = renderHook(() =>
        useQuickChecks('pattern', { pattern: /^[A-Z]/ })
      );

      act(() => {
        result.current.validate('lab', 'lowercase');
        vi.advanceTimersByTime(300);
      });

      expect(result.current.hint).toMatchObject({
        severity: 'hint',
        message: expect.stringContaining('invalid format')
      });
    });
  });

  describe('Clear Function', () => {
    it('should clear hint immediately', () => {
      const { result } = renderHook(() => useQuickChecks('required'));

      act(() => {
        result.current.validate('field', '');
        vi.advanceTimersByTime(300);
      });

      expect(result.current.hint).not.toBeNull();

      act(() => {
        result.current.clear();
      });

      expect(result.current.hint).toBeNull();
    });

    it('should cancel pending validation', () => {
      const { result } = renderHook(() => useQuickChecks('required'));

      act(() => {
        result.current.validate('field', '');
      });

      act(() => {
        result.current.clear();
        vi.advanceTimersByTime(300);
      });

      expect(result.current.hint).toBeNull();
    });
  });

  describe('Cleanup', () => {
    it('should cancel timer on unmount', () => {
      const { result, unmount } = renderHook(() => useQuickChecks('required'));

      act(() => {
        result.current.validate('field', '');
      });

      unmount();

      act(() => {
        vi.advanceTimersByTime(300);
      });

      expect(result.current.hint).toBeNull();
    });
  });

  describe('Edge Cases', () => {
    it('should handle null value', () => {
      const { result } = renderHook(() => useQuickChecks('required'));

      act(() => {
        result.current.validate('field', null);
        vi.advanceTimersByTime(300);
      });

      expect(result.current.hint).not.toBeNull();
    });

    it('should handle invalid check type', () => {
      const { result } = renderHook(() => useQuickChecks('invalid_type'));

      act(() => {
        result.current.validate('field', 'value');
        vi.advanceTimersByTime(300);
      });

      expect(result.current.hint).toBeNull();
    });
  });
});
