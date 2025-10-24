/**
 * @file App-addArrayItem.test.jsx
 * @description Tests for addArrayItem function in App.js
 *
 * Function: addArrayItem(key, count = 1)
 * Location: src/App.js:364-392
 *
 * Purpose: Add new items to array fields (cameras, tasks, electrode_groups, etc.)
 *
 * Behavior:
 * 1. Clones formData using structuredClone
 * 2. Gets default value template from arrayDefaultValues[key]
 * 3. Creates count number of items from template
 * 4. Auto-increments IDs if template has id field
 * 5. Pushes new items to form[key] array
 * 6. Updates formData state
 *
 * ID Management:
 * - If arrayDefaultValue has id field: auto-increment from max existing ID
 * - Starts from 0 if array is empty
 * - Increments by 1 for each new item
 * - Example: existing IDs [0, 1, 2] → new items get IDs [3, 4, 5]
 */

import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useState } from 'react';
import { arrayDefaultValues } from '../../../valueList';

/**
 * Mock implementation of addArrayItem function
 * Mirrors the actual implementation in App.js:364-392
 * Named with "use" prefix to satisfy React hooks rules
 */
function useAddArrayItemHook() {
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
  });

  const addArrayItem = (key, count = 1) => {
    const form = structuredClone(formData);
    const arrayDefaultValue = arrayDefaultValues[key];
    const items = Array(count).fill({ ...arrayDefaultValue });
    const formItems = form[key];
    const idValues = formItems
      .map((formItem) => formItem.id)
      .filter((formItem) => formItem !== undefined);
    // -1 means no id field, else there it exist and get max
    let maxId = -1;

    if (arrayDefaultValue?.id !== undefined) {
      maxId = idValues.length > 0 ? Math.max(...idValues) + 1 : 0;
    }

    items.forEach((item) => {
      const selectedItem = { ...item }; // best never to directly alter iterator

      // if id exist, increment to avoid duplicates
      if (maxId !== -1) {
        maxId += 1;
        selectedItem.id = maxId - 1; // -1 makes this start from 0
      }

      formItems.push(selectedItem);
    });

    setFormData(form);
  };

  return { formData, addArrayItem };
}

describe('addArrayItem', () => {
  describe('Basic Functionality', () => {
    it('should add single item to empty cameras array', () => {
      const { result } = renderHook(() => useAddArrayItemHook());

      expect(result.current.formData.cameras).toHaveLength(0);

      act(() => {
        result.current.addArrayItem('cameras');
      });

      expect(result.current.formData.cameras).toHaveLength(1);
      expect(result.current.formData.cameras[0]).toHaveProperty('id', 0);
      expect(result.current.formData.cameras[0]).toHaveProperty('meters_per_pixel', 0);
    });

    it('should add single item to empty tasks array', () => {
      const { result } = renderHook(() => useAddArrayItemHook());

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
      const { result } = renderHook(() => useAddArrayItemHook());

      act(() => {
        result.current.addArrayItem('behavioral_events');
      });

      expect(result.current.formData.behavioral_events).toHaveLength(1);
      expect(result.current.formData.behavioral_events[0]).toHaveProperty('description', 'Din1');
      expect(result.current.formData.behavioral_events[0]).toHaveProperty('name', '');
    });

    it('should add single item to empty electrode_groups array', () => {
      const { result } = renderHook(() => useAddArrayItemHook());

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
      const { result } = renderHook(() => useAddArrayItemHook());

      act(() => {
        result.current.addArrayItem('cameras', 3);
      });

      expect(result.current.formData.cameras).toHaveLength(3);
      expect(result.current.formData.cameras[0].id).toBe(0);
      expect(result.current.formData.cameras[1].id).toBe(1);
      expect(result.current.formData.cameras[2].id).toBe(2);
    });

    it('should add 5 tasks at once', () => {
      const { result } = renderHook(() => useAddArrayItemHook());

      act(() => {
        result.current.addArrayItem('tasks', 5);
      });

      expect(result.current.formData.tasks).toHaveLength(5);
    });

    it('should default count to 1 when not provided', () => {
      const { result } = renderHook(() => useAddArrayItemHook());

      act(() => {
        result.current.addArrayItem('cameras'); // No count parameter
      });

      expect(result.current.formData.cameras).toHaveLength(1);
    });
  });

  describe('ID Auto-Increment Logic', () => {
    it('should auto-increment IDs from max existing ID', () => {
      const { result } = renderHook(() => useAddArrayItemHook());

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
      const { result } = renderHook(() => useAddArrayItemHook());

      act(() => {
        result.current.addArrayItem('cameras');
      });

      expect(result.current.formData.cameras[0].id).toBe(0);
    });

    it('should handle arrays without id field (behavioral_events)', () => {
      const { result } = renderHook(() => useAddArrayItemHook());

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
      const { result } = renderHook(() => useAddArrayItemHook());

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
      const { result } = renderHook(() => useAddArrayItemHook());

      const originalData = result.current.formData;

      act(() => {
        result.current.addArrayItem('cameras');
      });

      // formData should be a new object (not mutated)
      expect(result.current.formData).not.toBe(originalData);
      expect(result.current.formData.cameras).not.toBe(originalData.cameras);
    });

    it('should update formData state after adding items', () => {
      const { result } = renderHook(() => useAddArrayItemHook());

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
      const { result } = renderHook(() => useAddArrayItemHook());

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
      const { result } = renderHook(() => useAddArrayItemHook());

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
      const { result } = renderHook(() => useAddArrayItemHook());

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
      const { result } = renderHook(() => useAddArrayItemHook());

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
      const { result } = renderHook(() => useAddArrayItemHook());

      act(() => {
        result.current.addArrayItem('cameras', 0);
      });

      expect(result.current.formData.cameras).toHaveLength(0);
    });

    it('should handle large count values', () => {
      const { result } = renderHook(() => useAddArrayItemHook());

      act(() => {
        result.current.addArrayItem('cameras', 100);
      });

      expect(result.current.formData.cameras).toHaveLength(100);
      expect(result.current.formData.cameras[99].id).toBe(99);
    });

    it('should not mutate arrayDefaultValues template', () => {
      const { result } = renderHook(() => useAddArrayItemHook());

      const originalTemplate = { ...arrayDefaultValues.cameras };

      act(() => {
        result.current.addArrayItem('cameras');
      });

      // Modify added item
      result.current.formData.cameras[0].manufacturer = 'TestManufacturer';

      // Original template should remain unchanged
      expect(arrayDefaultValues.cameras.manufacturer).toBe(originalTemplate.manufacturer);
      expect(arrayDefaultValues.cameras.manufacturer).not.toBe('TestManufacturer');
    });
  });

  describe('Integration with Form State', () => {
    it('should add items to correct array key', () => {
      const { result } = renderHook(() => useAddArrayItemHook());

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
      const { result } = renderHook(() => useAddArrayItemHook());

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
      const { result } = renderHook(() => useAddArrayItemHook());

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
