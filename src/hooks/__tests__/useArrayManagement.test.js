/**
 * @file useArrayManagement.test.js
 * @description Tests for useArrayManagement hook
 *
 * Hook: useArrayManagement(formData, setFormData)
 * Location: src/hooks/useArrayManagement.js
 *
 * Purpose: Manage array field operations (add, remove, duplicate)
 *
 * Functions tested:
 * - addArrayItem(key, count = 1)
 * - removeArrayItem(index, key)
 * - duplicateArrayItem(index, key)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useState } from 'react';
import { useArrayManagement } from '../useArrayManagement';
import { arrayDefaultValues } from '../../valueList';

/**
 * Test wrapper that provides formData state and useArrayManagement hook
 */
function useTestHook() {
  const [formData, setFormData] = useState({
    cameras: [],
    tasks: [],
    behavioral_events: [],
    electrode_groups: [],
    associated_files: [],
    associated_video_files: [],
    opto_excitation_source: [],
    optical_fiber: [],
    virus_injection: [],
    fs_gui_yamls: [],
    data_acq_device: [],
  });

  const { addArrayItem, removeArrayItem, duplicateArrayItem } = useArrayManagement(formData, setFormData);

  return { formData, addArrayItem, removeArrayItem, duplicateArrayItem };
}

describe('useArrayManagement', () => {
  describe('addArrayItem', () => {
    describe('Basic Functionality', () => {
      it('should add single item to empty cameras array', () => {
        const { result } = renderHook(() => useTestHook());

        expect(result.current.formData.cameras).toHaveLength(0);

        act(() => {
          result.current.addArrayItem('cameras');
        });

        expect(result.current.formData.cameras).toHaveLength(1);
        expect(result.current.formData.cameras[0]).toHaveProperty('id', 0);
        expect(result.current.formData.cameras[0]).toHaveProperty('meters_per_pixel', 0);
      });

      it('should add single item to empty tasks array', () => {
        const { result } = renderHook(() => useTestHook());

        act(() => {
          result.current.addArrayItem('tasks');
        });

        expect(result.current.formData.tasks).toHaveLength(1);
        expect(result.current.formData.tasks[0]).toHaveProperty('task_name', '');
        expect(result.current.formData.tasks[0]).toHaveProperty('task_description', '');
        expect(result.current.formData.tasks[0]).toHaveProperty('camera_id');
        expect(result.current.formData.tasks[0].camera_id).toEqual([]);
      });

      it('should add single item to empty behavioral_events array', () => {
        const { result } = renderHook(() => useTestHook());

        act(() => {
          result.current.addArrayItem('behavioral_events');
        });

        expect(result.current.formData.behavioral_events).toHaveLength(1);
        expect(result.current.formData.behavioral_events[0]).toHaveProperty('description', 'Din1');
        expect(result.current.formData.behavioral_events[0]).toHaveProperty('name', '');
      });

      it('should add single item to empty electrode_groups array', () => {
        const { result } = renderHook(() => useTestHook());

        act(() => {
          result.current.addArrayItem('electrode_groups');
        });

        expect(result.current.formData.electrode_groups).toHaveLength(1);
        expect(result.current.formData.electrode_groups[0]).toHaveProperty('id', 0);
        expect(result.current.formData.electrode_groups[0]).toHaveProperty('location', '');
        expect(result.current.formData.electrode_groups[0]).toHaveProperty('device_type', '');
      });
    });

    describe('Multiple Item Addition (count parameter)', () => {
      it('should add multiple items at once using count parameter', () => {
        const { result } = renderHook(() => useTestHook());

        act(() => {
          result.current.addArrayItem('cameras', 3);
        });

        expect(result.current.formData.cameras).toHaveLength(3);
        expect(result.current.formData.cameras[0].id).toBe(0);
        expect(result.current.formData.cameras[1].id).toBe(1);
        expect(result.current.formData.cameras[2].id).toBe(2);
      });

      it('should add 5 tasks at once', () => {
        const { result } = renderHook(() => useTestHook());

        act(() => {
          result.current.addArrayItem('tasks', 5);
        });

        expect(result.current.formData.tasks).toHaveLength(5);
      });

      it('should default count to 1 when not provided', () => {
        const { result } = renderHook(() => useTestHook());

        act(() => {
          result.current.addArrayItem('cameras'); // No count parameter
        });

        expect(result.current.formData.cameras).toHaveLength(1);
      });
    });

    describe('ID Auto-Increment Logic', () => {
      it('should auto-increment IDs from max existing ID', () => {
        const { result } = renderHook(() => useTestHook());

        // Add 3 cameras first
        act(() => {
          result.current.addArrayItem('cameras', 3);
        });

        expect(result.current.formData.cameras[0].id).toBe(0);
        expect(result.current.formData.cameras[1].id).toBe(1);
        expect(result.current.formData.cameras[2].id).toBe(2);

        // Add 2 more cameras
        act(() => {
          result.current.addArrayItem('cameras', 2);
        });

        expect(result.current.formData.cameras).toHaveLength(5);
        expect(result.current.formData.cameras[3].id).toBe(3);
        expect(result.current.formData.cameras[4].id).toBe(4);
      });

      it('should start from 0 when array is empty', () => {
        const { result } = renderHook(() => useTestHook());

        act(() => {
          result.current.addArrayItem('cameras');
        });

        expect(result.current.formData.cameras[0].id).toBe(0);
      });

      it('should handle arrays without id field (behavioral_events)', () => {
        const { result } = renderHook(() => useTestHook());

        // behavioral_events has no id field in arrayDefaultValues
        act(() => {
          result.current.addArrayItem('behavioral_events', 3);
        });

        expect(result.current.formData.behavioral_events).toHaveLength(3);
        // Items should not have id property
        expect(result.current.formData.behavioral_events[0]).not.toHaveProperty('id');
        expect(result.current.formData.behavioral_events[1]).not.toHaveProperty('id');
        expect(result.current.formData.behavioral_events[2]).not.toHaveProperty('id');
      });

      it('should increment IDs correctly for electrode_groups', () => {
        const { result } = renderHook(() => useTestHook());

        act(() => {
          result.current.addArrayItem('electrode_groups', 10);
        });

        expect(result.current.formData.electrode_groups).toHaveLength(10);
        result.current.formData.electrode_groups.forEach((group, index) => {
          expect(group.id).toBe(index);
        });
      });
    });

    describe('State Management', () => {
      it('should use structuredClone for immutability', () => {
        const { result } = renderHook(() => useTestHook());

        const originalData = result.current.formData;

        act(() => {
          result.current.addArrayItem('cameras');
        });

        // formData should be a new object (not mutated)
        expect(result.current.formData).not.toBe(originalData);
        expect(result.current.formData.cameras).not.toBe(originalData.cameras);
      });

      it('should update formData state after adding items', () => {
        const { result } = renderHook(() => useTestHook());

        expect(result.current.formData.cameras).toHaveLength(0);

        act(() => {
          result.current.addArrayItem('cameras');
        });

        // State should be updated
        expect(result.current.formData.cameras).toHaveLength(1);
      });
    });

    describe('Array Default Values', () => {
      it('should use correct template from arrayDefaultValues for cameras', () => {
        const { result } = renderHook(() => useTestHook());

        act(() => {
          result.current.addArrayItem('cameras');
        });

        const camera = result.current.formData.cameras[0];

        expect(camera).toHaveProperty('id');
        expect(camera).toHaveProperty('meters_per_pixel');
        expect(camera).toHaveProperty('manufacturer');
        expect(camera).toHaveProperty('model');
        expect(camera).toHaveProperty('lens');
        expect(camera).toHaveProperty('camera_name');
      });

      it('should use correct template from arrayDefaultValues for tasks', () => {
        const { result } = renderHook(() => useTestHook());

        act(() => {
          result.current.addArrayItem('tasks');
        });

        const task = result.current.formData.tasks[0];

        expect(task).toHaveProperty('task_name');
        expect(task).toHaveProperty('task_description');
        expect(task).toHaveProperty('task_environment');
        expect(task).toHaveProperty('camera_id');
        expect(task).toHaveProperty('task_epochs');
        expect(Array.isArray(task.camera_id)).toBe(true);
        expect(Array.isArray(task.task_epochs)).toBe(true);
      });

      it('should use correct template from arrayDefaultValues for electrode_groups', () => {
        const { result } = renderHook(() => useTestHook());

        act(() => {
          result.current.addArrayItem('electrode_groups');
        });

        const group = result.current.formData.electrode_groups[0];

        expect(group).toHaveProperty('id');
        expect(group).toHaveProperty('location');
        expect(group).toHaveProperty('device_type');
        expect(group).toHaveProperty('description');
        expect(group).toHaveProperty('targeted_location');
        expect(group).toHaveProperty('units', 'μm');
      });
    });

    describe('Edge Cases', () => {
      it('should handle adding to already populated array', () => {
        const { result } = renderHook(() => useTestHook());

        // Add initial items
        act(() => {
          result.current.addArrayItem('cameras', 2);
        });

        const lengthBefore = result.current.formData.cameras.length;

        // Add more items
        act(() => {
          result.current.addArrayItem('cameras', 3);
        });

        expect(result.current.formData.cameras).toHaveLength(lengthBefore + 3);
      });

      it('should handle count = 0 (no items added)', () => {
        const { result } = renderHook(() => useTestHook());

        act(() => {
          result.current.addArrayItem('cameras', 0);
        });

        expect(result.current.formData.cameras).toHaveLength(0);
      });

      it('should handle large count values', () => {
        const { result } = renderHook(() => useTestHook());

        act(() => {
          result.current.addArrayItem('cameras', 100);
        });

        expect(result.current.formData.cameras).toHaveLength(100);
        expect(result.current.formData.cameras[99].id).toBe(99);
      });

      it('should not mutate arrayDefaultValues template', () => {
        const { result } = renderHook(() => useTestHook());

        const originalTemplate = { ...arrayDefaultValues.cameras };

        act(() => {
          result.current.addArrayItem('cameras');
        });

        // Modify added item
        act(() => {
          result.current.formData.cameras[0].manufacturer = 'TestManufacturer';
        });

        // Original template should remain unchanged
        expect(arrayDefaultValues.cameras.manufacturer).toBe(originalTemplate.manufacturer);
        expect(arrayDefaultValues.cameras.manufacturer).not.toBe('TestManufacturer');
      });
    });

    describe('Integration with Form State', () => {
      it('should add items to correct array key', () => {
        const { result } = renderHook(() => useTestHook());

        act(() => {
          result.current.addArrayItem('cameras');
        });

        act(() => {
          result.current.addArrayItem('tasks');
        });

        act(() => {
          result.current.addArrayItem('behavioral_events');
        });

        expect(result.current.formData.cameras).toHaveLength(1);
        expect(result.current.formData.tasks).toHaveLength(1);
        expect(result.current.formData.behavioral_events).toHaveLength(1);
        expect(result.current.formData.electrode_groups).toHaveLength(0); // Not added
      });

      it('should preserve other array data when adding to one array', () => {
        const { result } = renderHook(() => useTestHook());

        // Add to cameras
        act(() => {
          result.current.addArrayItem('cameras', 2);
        });

        const camerasLength = result.current.formData.cameras.length;

        // Add to tasks
        act(() => {
          result.current.addArrayItem('tasks', 3);
        });

        // Cameras should remain unchanged
        expect(result.current.formData.cameras).toHaveLength(camerasLength);
        expect(result.current.formData.tasks).toHaveLength(3);
      });
    });

    describe('ID Field Detection Logic', () => {
      it('should detect id field exists in arrayDefaultValue', () => {
        const camerasDefault = arrayDefaultValues.cameras;
        expect(camerasDefault).toHaveProperty('id');

        const tasksDefault = arrayDefaultValues.tasks;
        expect(tasksDefault).not.toHaveProperty('id');

        const behavioralEventsDefault = arrayDefaultValues.behavioral_events;
        expect(behavioralEventsDefault).not.toHaveProperty('id');
      });

      it('should only auto-increment for arrays with id field', () => {
        const { result } = renderHook(() => useTestHook());

        // cameras has id field
        act(() => {
          result.current.addArrayItem('cameras');
        });
        expect(result.current.formData.cameras[0]).toHaveProperty('id', 0);

        // behavioral_events has no id field
        act(() => {
          result.current.addArrayItem('behavioral_events');
        });
        expect(result.current.formData.behavioral_events[0]).not.toHaveProperty('id');
      });
    });
  });

  describe('removeArrayItem', () => {
    beforeEach(() => {
      // Mock window.confirm to always return true for testing
      vi.stubGlobal('confirm', vi.fn(() => true));
    });

    it('should remove item from array', () => {
      const { result } = renderHook(() => useTestHook());

      // Add items first
      act(() => {
        result.current.addArrayItem('cameras', 3);
      });

      expect(result.current.formData.cameras).toHaveLength(3);

      // Remove middle item
      act(() => {
        result.current.removeArrayItem(1, 'cameras');
      });

      expect(result.current.formData.cameras).toHaveLength(2);
    });

    it('should show confirmation dialog before removing', () => {
      const confirmSpy = vi.fn(() => true);
      vi.stubGlobal('confirm', confirmSpy);

      const { result } = renderHook(() => useTestHook());

      act(() => {
        result.current.addArrayItem('cameras');
      });

      act(() => {
        result.current.removeArrayItem(0, 'cameras');
      });

      expect(confirmSpy).toHaveBeenCalledWith('Remove index 0 from cameras?');
    });

    it('should not remove item if user cancels confirmation', () => {
      vi.stubGlobal('confirm', vi.fn(() => false));

      const { result } = renderHook(() => useTestHook());

      act(() => {
        result.current.addArrayItem('cameras', 2);
      });

      expect(result.current.formData.cameras).toHaveLength(2);

      act(() => {
        result.current.removeArrayItem(0, 'cameras');
      });

      // Should still have 2 items
      expect(result.current.formData.cameras).toHaveLength(2);
    });

    it('should handle removing from empty array', () => {
      const { result } = renderHook(() => useTestHook());

      expect(result.current.formData.cameras).toHaveLength(0);

      act(() => {
        result.current.removeArrayItem(0, 'cameras');
      });

      // Should still be empty
      expect(result.current.formData.cameras).toHaveLength(0);
    });
  });

  describe('duplicateArrayItem', () => {
    it('should duplicate item and insert after original', () => {
      const { result } = renderHook(() => useTestHook());

      // Add a camera
      act(() => {
        result.current.addArrayItem('cameras');
      });

      expect(result.current.formData.cameras).toHaveLength(1);
      expect(result.current.formData.cameras[0].id).toBe(0);

      // Duplicate it
      act(() => {
        result.current.duplicateArrayItem(0, 'cameras');
      });

      expect(result.current.formData.cameras).toHaveLength(2);
      expect(result.current.formData.cameras[0].id).toBe(0); // Original
      expect(result.current.formData.cameras[1].id).toBe(1); // Duplicate with incremented ID
    });

    it('should auto-increment ID for duplicated item', () => {
      const { result } = renderHook(() => useTestHook());

      // Add 3 cameras
      act(() => {
        result.current.addArrayItem('cameras', 3);
      });

      // Duplicate the first one
      act(() => {
        result.current.duplicateArrayItem(0, 'cameras');
      });

      expect(result.current.formData.cameras).toHaveLength(4);
      // New item should have ID = max(0,1,2) + 1 = 3
      expect(result.current.formData.cameras[1].id).toBe(3);
    });

    it('should handle items without ID field', () => {
      const { result } = renderHook(() => useTestHook());

      // Add a behavioral event (no ID field)
      act(() => {
        result.current.addArrayItem('behavioral_events');
      });

      expect(result.current.formData.behavioral_events).toHaveLength(1);

      // Duplicate it
      act(() => {
        result.current.duplicateArrayItem(0, 'behavioral_events');
      });

      expect(result.current.formData.behavioral_events).toHaveLength(2);
    });

    it('should handle invalid index gracefully', () => {
      const { result } = renderHook(() => useTestHook());

      // Add a camera
      act(() => {
        result.current.addArrayItem('cameras');
      });

      // Try to duplicate non-existent index
      act(() => {
        result.current.duplicateArrayItem(5, 'cameras');
      });

      // Should still only have 1 item
      expect(result.current.formData.cameras).toHaveLength(1);
    });
  });
});
