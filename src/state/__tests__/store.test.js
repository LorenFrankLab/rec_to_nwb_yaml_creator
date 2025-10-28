/**
 * @file store.test.js
 * @description Tests for store facade hook
 *
 * Hook: useStore()
 * Location: src/state/store.js
 *
 * Purpose: Provide unified access to form state, actions, and selectors
 *
 * Tests cover:
 * - Store initialization with default state
 * - Actions delegation to underlying hooks
 * - Selectors for derived data
 * - State updates propagation
 */

import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useStore } from '../store';

describe('useStore', () => {
  describe('Initialization', () => {
    it('should initialize with default form data', () => {
      const { result } = renderHook(() => useStore());

      expect(result.current.model).toBeDefined();
      expect(result.current.model).toHaveProperty('experimenter_name');
      expect(result.current.model).toHaveProperty('subject');
      expect(result.current.model).toHaveProperty('cameras');
      expect(result.current.model).toHaveProperty('tasks');
      expect(result.current.model).toHaveProperty('electrode_groups');
    });

    it('should provide actions object', () => {
      const { result } = renderHook(() => useStore());

      expect(result.current.actions).toBeDefined();
      expect(result.current.actions).toBeTypeOf('object');
    });

    it('should provide selectors object', () => {
      const { result } = renderHook(() => useStore());

      expect(result.current.selectors).toBeDefined();
      expect(result.current.selectors).toBeTypeOf('object');
    });
  });

  describe('Actions - Array Management', () => {
    it('should expose addArrayItem action', () => {
      const { result } = renderHook(() => useStore());

      expect(result.current.actions.addArrayItem).toBeDefined();
      expect(result.current.actions.addArrayItem).toBeTypeOf('function');
    });

    it('should expose removeArrayItem action', () => {
      const { result } = renderHook(() => useStore());

      expect(result.current.actions.removeArrayItem).toBeDefined();
      expect(result.current.actions.removeArrayItem).toBeTypeOf('function');
    });

    it('should expose duplicateArrayItem action', () => {
      const { result } = renderHook(() => useStore());

      expect(result.current.actions.duplicateArrayItem).toBeDefined();
      expect(result.current.actions.duplicateArrayItem).toBeTypeOf('function');
    });

    it('should add camera via addArrayItem action', () => {
      const { result } = renderHook(() => useStore());

      const initialCamerasCount = result.current.model.cameras.length;

      act(() => {
        result.current.actions.addArrayItem('cameras', 1);
      });

      expect(result.current.model.cameras).toHaveLength(initialCamerasCount + 1);
    });
  });

  describe('Actions - Form Updates', () => {
    it('should expose updateFormData action', () => {
      const { result } = renderHook(() => useStore());

      expect(result.current.actions.updateFormData).toBeDefined();
      expect(result.current.actions.updateFormData).toBeTypeOf('function');
    });

    it('should expose updateFormArray action', () => {
      const { result } = renderHook(() => useStore());

      expect(result.current.actions.updateFormArray).toBeDefined();
      expect(result.current.actions.updateFormArray).toBeTypeOf('function');
    });

    it('should expose onBlur action', () => {
      const { result } = renderHook(() => useStore());

      expect(result.current.actions.onBlur).toBeDefined();
      expect(result.current.actions.onBlur).toBeTypeOf('function');
    });

    it('should expose handleChange action', () => {
      const { result } = renderHook(() => useStore());

      expect(result.current.actions.handleChange).toBeDefined();
      expect(result.current.actions.handleChange).toBeTypeOf('function');
    });

    it('should update session_id via updateFormData action', () => {
      const { result } = renderHook(() => useStore());

      act(() => {
        result.current.actions.updateFormData('session_id', 'test_session_001');
      });

      expect(result.current.model.session_id).toBe('test_session_001');
    });
  });

  describe('Actions - Electrode Groups', () => {
    it('should expose nTrodeMapSelected action', () => {
      const { result } = renderHook(() => useStore());

      expect(result.current.actions.nTrodeMapSelected).toBeDefined();
      expect(result.current.actions.nTrodeMapSelected).toBeTypeOf('function');
    });

    it('should expose removeElectrodeGroupItem action', () => {
      const { result } = renderHook(() => useStore());

      expect(result.current.actions.removeElectrodeGroupItem).toBeDefined();
      expect(result.current.actions.removeElectrodeGroupItem).toBeTypeOf('function');
    });

    it('should expose duplicateElectrodeGroupItem action', () => {
      const { result } = renderHook(() => useStore());

      expect(result.current.actions.duplicateElectrodeGroupItem).toBeDefined();
      expect(result.current.actions.duplicateElectrodeGroupItem).toBeTypeOf('function');
    });
  });

  describe('Selectors - Camera IDs', () => {
    it('should provide getCameraIds selector', () => {
      const { result } = renderHook(() => useStore());

      expect(result.current.selectors.getCameraIds).toBeDefined();
      expect(result.current.selectors.getCameraIds).toBeTypeOf('function');
    });

    it('should return empty array when no cameras', () => {
      const { result } = renderHook(() => useStore());

      const cameraIds = result.current.selectors.getCameraIds();
      expect(cameraIds).toEqual([]);
    });

    it('should return camera IDs when cameras exist', () => {
      const { result } = renderHook(() => useStore());

      // Add cameras
      act(() => {
        result.current.actions.addArrayItem('cameras', 2);
      });

      const cameraIds = result.current.selectors.getCameraIds();
      expect(cameraIds).toHaveLength(2);
      expect(cameraIds).toContain('0');
      expect(cameraIds).toContain('1');
    });

    it('should filter out NaN camera IDs', () => {
      const { result } = renderHook(() => useStore());

      // Add camera
      act(() => {
        result.current.actions.addArrayItem('cameras', 1);
      });

      // Set camera id to NaN
      act(() => {
        result.current.actions.updateFormData('id', NaN, 'cameras', 0);
      });

      const cameraIds = result.current.selectors.getCameraIds();

      // Should not include NaN
      expect(cameraIds.every(id => !Number.isNaN(id))).toBe(true);
      expect(cameraIds).toHaveLength(0); // No valid IDs after filtering NaN
    });
  });

  describe('Selectors - Task Epochs', () => {
    it('should provide getTaskEpochs selector', () => {
      const { result } = renderHook(() => useStore());

      expect(result.current.selectors.getTaskEpochs).toBeDefined();
      expect(result.current.selectors.getTaskEpochs).toBeTypeOf('function');
    });

    it('should return empty array when no tasks', () => {
      const { result } = renderHook(() => useStore());

      const epochs = result.current.selectors.getTaskEpochs();
      expect(epochs).toEqual([]);
    });

    it('should return task epochs when tasks exist', () => {
      const { result } = renderHook(() => useStore());

      // Add task
      act(() => {
        result.current.actions.addArrayItem('tasks', 1);
      });

      // Add task epochs
      act(() => {
        result.current.actions.updateFormData('task_epochs', [1, 2, 3], 'tasks', 0);
      });

      const epochs = result.current.selectors.getTaskEpochs();
      expect(epochs).toContain(1);
      expect(epochs).toContain(2);
      expect(epochs).toContain(3);
    });

    it('should flatten epochs from multiple tasks', () => {
      const { result } = renderHook(() => useStore());

      // Add 2 tasks
      act(() => {
        result.current.actions.addArrayItem('tasks', 2);
      });

      // Add epochs to first task
      act(() => {
        result.current.actions.updateFormData('task_epochs', [1, 2], 'tasks', 0);
      });

      // Add epochs to second task
      act(() => {
        result.current.actions.updateFormData('task_epochs', [3, 4], 'tasks', 1);
      });

      const epochs = result.current.selectors.getTaskEpochs();
      expect(epochs).toHaveLength(4);
      expect(epochs).toContain(1);
      expect(epochs).toContain(2);
      expect(epochs).toContain(3);
      expect(epochs).toContain(4);
    });

    it('should deduplicate task epochs', () => {
      const { result } = renderHook(() => useStore());

      // Add 2 tasks
      act(() => {
        result.current.actions.addArrayItem('tasks', 2);
      });

      // Add overlapping epochs
      act(() => {
        result.current.actions.updateFormData('task_epochs', [1, 2], 'tasks', 0);
      });

      act(() => {
        result.current.actions.updateFormData('task_epochs', [2, 3], 'tasks', 1);
      });

      const epochs = result.current.selectors.getTaskEpochs();
      // Should deduplicate: [1, 2, 3] not [1, 2, 2, 3]
      expect(epochs).toHaveLength(3);
    });

    it('should sort task epochs', () => {
      const { result } = renderHook(() => useStore());

      // Add task
      act(() => {
        result.current.actions.addArrayItem('tasks', 1);
      });

      // Add unordered epochs
      act(() => {
        result.current.actions.updateFormData('task_epochs', [3, 1, 2], 'tasks', 0);
      });

      const epochs = result.current.selectors.getTaskEpochs();
      expect(epochs).toEqual([1, 2, 3]);
    });
  });

  describe('Selectors - DIO Events', () => {
    it('should provide getDioEvents selector', () => {
      const { result } = renderHook(() => useStore());

      expect(result.current.selectors.getDioEvents).toBeDefined();
      expect(result.current.selectors.getDioEvents).toBeTypeOf('function');
    });

    it('should return empty array when no behavioral events', () => {
      const { result } = renderHook(() => useStore());

      const dioEvents = result.current.selectors.getDioEvents();
      expect(dioEvents).toEqual([]);
    });

    it('should return behavioral event names when events exist', () => {
      const { result } = renderHook(() => useStore());

      // Add behavioral event
      act(() => {
        result.current.actions.addArrayItem('behavioral_events', 1);
      });

      // Set event name
      act(() => {
        result.current.actions.updateFormData('name', 'poke', 'behavioral_events', 0);
      });

      const dioEvents = result.current.selectors.getDioEvents();
      expect(dioEvents).toContain('poke');
    });
  });

  describe('State Propagation', () => {
    it('should reflect state changes in model', () => {
      const { result } = renderHook(() => useStore());

      const initialSessionId = result.current.model.session_id;

      act(() => {
        result.current.actions.updateFormData('session_id', 'new_session_002');
      });

      expect(result.current.model.session_id).not.toBe(initialSessionId);
      expect(result.current.model.session_id).toBe('new_session_002');
    });

    it('should trigger selector updates when state changes', () => {
      const { result } = renderHook(() => useStore());

      const initialCameraIds = result.current.selectors.getCameraIds();
      expect(initialCameraIds).toHaveLength(0);

      act(() => {
        result.current.actions.addArrayItem('cameras', 1);
      });

      const updatedCameraIds = result.current.selectors.getCameraIds();
      expect(updatedCameraIds).toHaveLength(1);
    });
  });

  describe('Store Instance Independence', () => {
    it('should create independent store instances', () => {
      const { result: store1 } = renderHook(() => useStore());
      const { result: store2 } = renderHook(() => useStore());

      // Modify store1
      act(() => {
        store1.current.actions.updateFormData('session_id', 'session_1');
      });

      // Modify store2
      act(() => {
        store2.current.actions.updateFormData('session_id', 'session_2');
      });

      // Stores should have independent state
      expect(store1.current.model.session_id).toBe('session_1');
      expect(store2.current.model.session_id).toBe('session_2');
    });
  });
});
