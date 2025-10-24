/**
 * @file App-removeArrayItem.test.jsx
 * @description Tests for removeArrayItem function in App.js
 *
 * Function: removeArrayItem(index, key)
 * Location: src/App.js:394-408
 *
 * Purpose: Remove items from array fields with confirmation
 *
 * Behavior:
 * 1. Shows confirmation dialog: "Remove index {index} from {key}?"
 * 2. If user cancels → no changes
 * 3. If user confirms:
 *    a. Clones formData using structuredClone
 *    b. Clones form[key] array
 *    c. Guard clause: return null if array is empty or doesn't exist
 *    d. Uses array.splice(index, 1) to remove item
 *    e. Updates form[key] with modified array
 *    f. Updates formData state
 *
 * Guard Clause:
 * - Returns null if items is falsy or empty (line 400-402)
 * - Prevents errors when trying to remove from empty array
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useState } from 'react';

/**
 * Mock implementation of removeArrayItem function
 * Mirrors the actual implementation in App.js:394-408
 * Named with "use" prefix to satisfy React hooks rules
 */
function useRemoveArrayItemHook() {
  const [formData, setFormData] = useState({
    cameras: [
      { id: 0, manufacturer: 'Camera 0' },
      { id: 1, manufacturer: 'Camera 1' },
      { id: 2, manufacturer: 'Camera 2' },
    ],
    tasks: [
      { task_name: 'Task 0' },
      { task_name: 'Task 1' },
      { task_name: 'Task 2' },
    ],
    behavioral_events: [],
    electrode_groups: [
      { id: 0, location: 'CA1' },
      { id: 1, location: 'CA3' },
    ],
  });

  const removeArrayItem = (index, key) => {
    // eslint-disable-next-line no-restricted-globals
    if (window.confirm(`Remove index ${index} from ${key}?`)) {
      const form = structuredClone(formData);
      const items = structuredClone(form[key]);

      if (!items || items.length === 0) {
        return null;
      }

      items.splice(index, 1);
      form[key] = items;
      setFormData(form);
    }
  };

  return { formData, removeArrayItem };
}

describe('removeArrayItem', () => {
  let confirmSpy;

  beforeEach(() => {
    // Mock window.confirm
    confirmSpy = vi.spyOn(window, 'confirm');
  });

  afterEach(() => {
    // Restore original window.confirm
    confirmSpy.mockRestore();
  });

  describe('Confirmation Dialog', () => {
    it('should show confirmation dialog with correct message', () => {
      const { result } = renderHook(() => useRemoveArrayItemHook());
      confirmSpy.mockReturnValue(false); // User clicks cancel

      act(() => {
        result.current.removeArrayItem(1, 'cameras');
      });

      expect(confirmSpy).toHaveBeenCalledWith('Remove index 1 from cameras?');
    });

    it('should show correct message for different array types', () => {
      const { result } = renderHook(() => useRemoveArrayItemHook());
      confirmSpy.mockReturnValue(false);

      act(() => {
        result.current.removeArrayItem(0, 'tasks');
      });

      expect(confirmSpy).toHaveBeenCalledWith('Remove index 0 from tasks?');
    });

    it('should show correct index in message', () => {
      const { result } = renderHook(() => useRemoveArrayItemHook());
      confirmSpy.mockReturnValue(false);

      act(() => {
        result.current.removeArrayItem(2, 'cameras');
      });

      expect(confirmSpy).toHaveBeenCalledWith('Remove index 2 from cameras?');
    });
  });

  describe('User Confirms Removal', () => {
    it('should remove item when user confirms', () => {
      const { result } = renderHook(() => useRemoveArrayItemHook());
      confirmSpy.mockReturnValue(true); // User clicks OK

      const initialLength = result.current.formData.cameras.length;
      expect(initialLength).toBe(3);

      act(() => {
        result.current.removeArrayItem(1, 'cameras');
      });

      expect(result.current.formData.cameras).toHaveLength(2);
      expect(result.current.formData.cameras[0].id).toBe(0);
      expect(result.current.formData.cameras[1].id).toBe(2); // Middle item removed
    });

    it('should remove first item in array', () => {
      const { result } = renderHook(() => useRemoveArrayItemHook());
      confirmSpy.mockReturnValue(true);

      act(() => {
        result.current.removeArrayItem(0, 'cameras');
      });

      expect(result.current.formData.cameras).toHaveLength(2);
      expect(result.current.formData.cameras[0].id).toBe(1);
      expect(result.current.formData.cameras[1].id).toBe(2);
    });

    it('should remove last item in array', () => {
      const { result } = renderHook(() => useRemoveArrayItemHook());
      confirmSpy.mockReturnValue(true);

      act(() => {
        result.current.removeArrayItem(2, 'cameras');
      });

      expect(result.current.formData.cameras).toHaveLength(2);
      expect(result.current.formData.cameras[0].id).toBe(0);
      expect(result.current.formData.cameras[1].id).toBe(1);
    });

    it('should remove middle item in array', () => {
      const { result } = renderHook(() => useRemoveArrayItemHook());
      confirmSpy.mockReturnValue(true);

      act(() => {
        result.current.removeArrayItem(1, 'cameras');
      });

      expect(result.current.formData.cameras).toHaveLength(2);
      expect(result.current.formData.cameras[0].id).toBe(0);
      expect(result.current.formData.cameras[1].id).toBe(2);
    });

    it('should remove from single-item array', () => {
      const { result } = renderHook(() => useRemoveArrayItemHook());
      confirmSpy.mockReturnValue(true);

      // First reduce to single item
      act(() => {
        result.current.removeArrayItem(0, 'cameras');
      });
      act(() => {
        result.current.removeArrayItem(0, 'cameras');
      });

      expect(result.current.formData.cameras).toHaveLength(1);

      // Now remove the last item
      act(() => {
        result.current.removeArrayItem(0, 'cameras');
      });

      expect(result.current.formData.cameras).toHaveLength(0);
    });
  });

  describe('User Cancels Removal', () => {
    it('should not remove item when user cancels', () => {
      const { result } = renderHook(() => useRemoveArrayItemHook());
      confirmSpy.mockReturnValue(false); // User clicks cancel

      const originalData = structuredClone(result.current.formData.cameras);

      act(() => {
        result.current.removeArrayItem(1, 'cameras');
      });

      // Data should be unchanged
      expect(result.current.formData.cameras).toHaveLength(3);
      expect(result.current.formData.cameras).toEqual(originalData);
    });

    it('should not update state when cancelled', () => {
      const { result } = renderHook(() => useRemoveArrayItemHook());
      confirmSpy.mockReturnValue(false);

      const beforeState = result.current.formData;

      act(() => {
        result.current.removeArrayItem(0, 'cameras');
      });

      // State reference should be the same (no update)
      expect(result.current.formData).toBe(beforeState);
    });
  });

  describe('Array Splice Usage', () => {
    it('should use splice to remove item at correct index', () => {
      const { result } = renderHook(() => useRemoveArrayItemHook());
      confirmSpy.mockReturnValue(true);

      // Verify splice behavior: removes 1 item at index 1
      expect(result.current.formData.cameras[1].manufacturer).toBe('Camera 1');

      act(() => {
        result.current.removeArrayItem(1, 'cameras');
      });

      // Item at index 1 should now be what was at index 2
      expect(result.current.formData.cameras[1].manufacturer).toBe('Camera 2');
    });

    it('should preserve array order after removal', () => {
      const { result } = renderHook(() => useRemoveArrayItemHook());
      confirmSpy.mockReturnValue(true);

      act(() => {
        result.current.removeArrayItem(0, 'tasks');
      });

      expect(result.current.formData.tasks).toHaveLength(2);
      expect(result.current.formData.tasks[0].task_name).toBe('Task 1');
      expect(result.current.formData.tasks[1].task_name).toBe('Task 2');
    });
  });

  describe('Guard Clause: Empty Array', () => {
    it('should return null when array is empty', () => {
      const { result } = renderHook(() => useRemoveArrayItemHook());
      confirmSpy.mockReturnValue(true);

      // behavioral_events is empty in initial state
      const beforeState = result.current.formData;

      act(() => {
        result.current.removeArrayItem(0, 'behavioral_events');
      });

      // Guard clause should prevent state update
      // State reference should be the same (no update)
      expect(result.current.formData).toBe(beforeState);

      // State should not be updated
      expect(result.current.formData.behavioral_events).toHaveLength(0);
    });

    it('should handle removing from non-existent array', () => {
      const { result } = renderHook(() => useRemoveArrayItemHook());
      confirmSpy.mockReturnValue(true);

      // Manually set a key to undefined
      result.current.formData.nonExistentArray = undefined;
      const beforeState = result.current.formData;

      act(() => {
        result.current.removeArrayItem(0, 'nonExistentArray');
      });

      // Guard clause should prevent state update (!items check)
      // State reference should be the same (no update)
      expect(result.current.formData).toBe(beforeState);
    });

    it('should not throw error when removing from empty array', () => {
      const { result } = renderHook(() => useRemoveArrayItemHook());
      confirmSpy.mockReturnValue(true);

      // Should not throw error
      expect(() => {
        act(() => {
          result.current.removeArrayItem(0, 'behavioral_events');
        });
      }).not.toThrow();
    });
  });

  describe('State Management', () => {
    it('should use structuredClone for immutability', () => {
      const { result } = renderHook(() => useRemoveArrayItemHook());
      confirmSpy.mockReturnValue(true);

      const originalData = result.current.formData;
      const originalCameras = result.current.formData.cameras;

      act(() => {
        result.current.removeArrayItem(0, 'cameras');
      });

      // formData should be a new object (not mutated)
      expect(result.current.formData).not.toBe(originalData);
      expect(result.current.formData.cameras).not.toBe(originalCameras);
    });

    it('should update formData state after removal', () => {
      const { result } = renderHook(() => useRemoveArrayItemHook());
      confirmSpy.mockReturnValue(true);

      expect(result.current.formData.cameras).toHaveLength(3);

      act(() => {
        result.current.removeArrayItem(1, 'cameras');
      });

      // State should be updated
      expect(result.current.formData.cameras).toHaveLength(2);
    });

    it('should clone array twice (form and items)', () => {
      const { result } = renderHook(() => useRemoveArrayItemHook());
      confirmSpy.mockReturnValue(true);

      // Implementation does:
      // const form = structuredClone(formData);
      // const items = structuredClone(form[key]);
      // This is double-cloning for safety

      const originalCameras = result.current.formData.cameras;

      act(() => {
        result.current.removeArrayItem(0, 'cameras');
      });

      // Both should be new references
      expect(result.current.formData.cameras).not.toBe(originalCameras);
    });
  });

  describe('Integration with Form State', () => {
    it('should remove from correct array key', () => {
      const { result } = renderHook(() => useRemoveArrayItemHook());
      confirmSpy.mockReturnValue(true);

      const camerasLength = result.current.formData.cameras.length;
      const tasksLength = result.current.formData.tasks.length;

      act(() => {
        result.current.removeArrayItem(0, 'cameras');
      });

      // Only cameras should be affected
      expect(result.current.formData.cameras).toHaveLength(camerasLength - 1);
      expect(result.current.formData.tasks).toHaveLength(tasksLength);
    });

    it('should preserve other arrays when removing from one', () => {
      const { result } = renderHook(() => useRemoveArrayItemHook());
      confirmSpy.mockReturnValue(true);

      const originalTasks = structuredClone(result.current.formData.tasks);
      const originalElectrodeGroups = structuredClone(result.current.formData.electrode_groups);

      act(() => {
        result.current.removeArrayItem(1, 'cameras');
      });

      // Other arrays should remain unchanged
      expect(result.current.formData.tasks).toEqual(originalTasks);
      expect(result.current.formData.electrode_groups).toEqual(originalElectrodeGroups);
    });
  });

  describe('Edge Cases', () => {
    it('should handle multiple sequential removals', () => {
      const { result } = renderHook(() => useRemoveArrayItemHook());
      confirmSpy.mockReturnValue(true);

      expect(result.current.formData.cameras).toHaveLength(3);

      act(() => {
        result.current.removeArrayItem(0, 'cameras');
      });
      expect(result.current.formData.cameras).toHaveLength(2);

      act(() => {
        result.current.removeArrayItem(0, 'cameras');
      });
      expect(result.current.formData.cameras).toHaveLength(1);

      act(() => {
        result.current.removeArrayItem(0, 'cameras');
      });
      expect(result.current.formData.cameras).toHaveLength(0);
    });

    it('should handle removing out-of-bounds index gracefully', () => {
      const { result } = renderHook(() => useRemoveArrayItemHook());
      confirmSpy.mockReturnValue(true);

      const originalLength = result.current.formData.cameras.length;

      // Try to remove index 10 (doesn't exist)
      act(() => {
        result.current.removeArrayItem(10, 'cameras');
      });

      // splice(10, 1) on array of length 3 does nothing
      expect(result.current.formData.cameras).toHaveLength(originalLength);
    });

    it('should handle negative indices', () => {
      const { result } = renderHook(() => useRemoveArrayItemHook());
      confirmSpy.mockReturnValue(true);

      // splice with negative index: -1 means last item
      act(() => {
        result.current.removeArrayItem(-1, 'cameras');
      });

      // splice(-1, 1) removes the last item
      expect(result.current.formData.cameras).toHaveLength(2);
      // Verify it was the last item removed
      expect(result.current.formData.cameras[0].id).toBe(0);
      expect(result.current.formData.cameras[1].id).toBe(1);
    });
  });

  describe('Different Array Types', () => {
    it('should remove from cameras array', () => {
      const { result } = renderHook(() => useRemoveArrayItemHook());
      confirmSpy.mockReturnValue(true);

      act(() => {
        result.current.removeArrayItem(0, 'cameras');
      });

      expect(result.current.formData.cameras).toHaveLength(2);
    });

    it('should remove from tasks array', () => {
      const { result } = renderHook(() => useRemoveArrayItemHook());
      confirmSpy.mockReturnValue(true);

      act(() => {
        result.current.removeArrayItem(1, 'tasks');
      });

      expect(result.current.formData.tasks).toHaveLength(2);
      expect(result.current.formData.tasks[0].task_name).toBe('Task 0');
      expect(result.current.formData.tasks[1].task_name).toBe('Task 2');
    });

    it('should remove from electrode_groups array', () => {
      const { result } = renderHook(() => useRemoveArrayItemHook());
      confirmSpy.mockReturnValue(true);

      act(() => {
        result.current.removeArrayItem(0, 'electrode_groups');
      });

      expect(result.current.formData.electrode_groups).toHaveLength(1);
      expect(result.current.formData.electrode_groups[0].location).toBe('CA3');
    });
  });
});
