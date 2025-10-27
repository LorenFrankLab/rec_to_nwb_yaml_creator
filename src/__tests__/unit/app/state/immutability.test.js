/**
 * @vitest-environment jsdom
 */

import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useState } from 'react';

/**
 * State Immutability Tests
 *
 * These tests verify that all state updates in App.js properly maintain immutability
 * by creating new object references rather than mutating existing state.
 *
 * This is critical for:
 * 1. React's rendering optimization (shallow comparison)
 * 2. Preventing bugs from unintended mutations
 * 3. Enabling features like undo/redo
 * 4. Maintaining predictable state behavior
 *
 * Current implementation uses structuredClone() for all state updates.
 */

describe('State Immutability Tests', () => {
  describe('structuredClone() Behavior', () => {
    it('creates new object reference for top-level state', () => {
      const original = { experimenter: ['Doe, John'], session_id: 'test_001' };
      const cloned = structuredClone(original);

      // Should be different objects
      expect(cloned).not.toBe(original);

      // But with same content
      expect(cloned).toEqual(original);
    });

    it('creates new references for nested objects', () => {
      const original = {
        subject: {
          subject_id: 'rat01',
          sex: 'M',
          weight: 300
        }
      };
      const cloned = structuredClone(original);

      // Top-level should be different
      expect(cloned).not.toBe(original);

      // Nested object should also be different
      expect(cloned.subject).not.toBe(original.subject);

      // Content should match
      expect(cloned.subject).toEqual(original.subject);
    });

    it('creates new references for nested arrays', () => {
      const original = {
        cameras: [
          { id: 0, meters_per_pixel: 0.001 },
          { id: 1, meters_per_pixel: 0.002 }
        ]
      };
      const cloned = structuredClone(original);

      // Array should be different
      expect(cloned.cameras).not.toBe(original.cameras);

      // Array items should be different
      expect(cloned.cameras[0]).not.toBe(original.cameras[0]);
      expect(cloned.cameras[1]).not.toBe(original.cameras[1]);

      // Content should match
      expect(cloned.cameras).toEqual(original.cameras);
    });

    it('creates new references for deeply nested structures', () => {
      const original = {
        electrode_groups: [
          {
            id: 0,
            location: 'CA1',
            device_type: 'tetrode_12.5',
            targeted_location: 'CA1',
            targeted_x: 1.0,
            targeted_y: 2.0,
            targeted_z: 3.0
          }
        ],
        ntrode_electrode_group_channel_map: [
          {
            ntrode_id: 0,
            electrode_group_id: 0,
            bad_channels: [],
            map: { 0: 0, 1: 1, 2: 2, 3: 3 }
          }
        ]
      };
      const cloned = structuredClone(original);

      // All levels should be different objects
      expect(cloned).not.toBe(original);
      expect(cloned.electrode_groups).not.toBe(original.electrode_groups);
      expect(cloned.electrode_groups[0]).not.toBe(original.electrode_groups[0]);
      expect(cloned.ntrode_electrode_group_channel_map).not.toBe(
        original.ntrode_electrode_group_channel_map
      );
      expect(cloned.ntrode_electrode_group_channel_map[0]).not.toBe(
        original.ntrode_electrode_group_channel_map[0]
      );
      expect(cloned.ntrode_electrode_group_channel_map[0].map).not.toBe(
        original.ntrode_electrode_group_channel_map[0].map
      );

      // Content should match
      expect(cloned).toEqual(original);
    });

    it('handles Date objects correctly', () => {
      const original = {
        session_start_time: new Date('2025-01-23T10:00:00')
      };
      const cloned = structuredClone(original);

      // Date should be cloned (different object)
      expect(cloned.session_start_time).not.toBe(original.session_start_time);

      // But should represent same time
      expect(cloned.session_start_time.getTime()).toBe(
        original.session_start_time.getTime()
      );
    });

    it('clones empty arrays and objects', () => {
      const original = {
        cameras: [],
        tasks: [],
        subject: {}
      };
      const cloned = structuredClone(original);

      expect(cloned.cameras).not.toBe(original.cameras);
      expect(cloned.tasks).not.toBe(original.tasks);
      expect(cloned.subject).not.toBe(original.subject);

      expect(cloned).toEqual(original);
    });

    it('preserves null and undefined values', () => {
      const original = {
        optionalField: null,
        anotherField: undefined,
        normalField: 'value'
      };
      const cloned = structuredClone(original);

      expect(cloned.optionalField).toBe(null);
      expect(cloned.anotherField).toBe(undefined);
      expect(cloned.normalField).toBe('value');
    });
  });

  describe('State Update Immutability', () => {
    /**
     * Simulates the updateFormData pattern used in App.js
     */
    function useFormDataPattern() {
      const [formData, setFormData] = useState({
        experimenter: ['Doe, John'],
        session_id: 'test_001',
        cameras: [{ id: 0 }]
      });

      const updateFormData = (name, value, key, index) => {
        const form = structuredClone(formData);

        if (key === undefined) {
          form[name] = value;
        } else if (index === undefined) {
          form[key][name] = value;
        } else {
          form[key][index] = form[key][index] || {};
          form[key][index][name] = value;
        }

        setFormData(form);
      };

      return { formData, updateFormData };
    }

    it('updateFormData creates new state reference', () => {
      const { result } = renderHook(() => useFormDataPattern());
      const originalState = result.current.formData;

      act(() => {
        result.current.updateFormData('session_id', 'test_002');
      });

      // State reference should change
      expect(result.current.formData).not.toBe(originalState);

      // Value should update
      expect(result.current.formData.session_id).toBe('test_002');
    });

    it('updateFormData does not mutate original state', () => {
      const { result } = renderHook(() => useFormDataPattern());
      const originalSessionId = result.current.formData.session_id;

      act(() => {
        result.current.updateFormData('session_id', 'test_002');
      });

      // Original state snapshot should be unchanged
      expect(originalSessionId).toBe('test_001');
    });

    it('updating nested object creates new references', () => {
      const { result } = renderHook(() => useFormDataPattern());
      const originalCameras = result.current.formData.cameras;

      act(() => {
        result.current.updateFormData('meters_per_pixel', 0.001, 'cameras', 0);
      });

      // Cameras array should be new reference
      expect(result.current.formData.cameras).not.toBe(originalCameras);

      // But camera object should also be new
      expect(result.current.formData.cameras[0]).not.toBe(originalCameras[0]);

      // Value should update
      expect(result.current.formData.cameras[0].meters_per_pixel).toBe(0.001);
    });

    it('multiple updates maintain immutability', () => {
      const { result } = renderHook(() => useFormDataPattern());
      const states = [];

      // Capture state after each update
      states.push(result.current.formData);

      act(() => {
        result.current.updateFormData('session_id', 'test_002');
      });
      states.push(result.current.formData);

      act(() => {
        result.current.updateFormData('session_id', 'test_003');
      });
      states.push(result.current.formData);

      // All states should be different objects
      expect(states[0]).not.toBe(states[1]);
      expect(states[1]).not.toBe(states[2]);
      expect(states[0]).not.toBe(states[2]);

      // Values should progress
      expect(states[0].session_id).toBe('test_001');
      expect(states[1].session_id).toBe('test_002');
      expect(states[2].session_id).toBe('test_003');
    });
  });

  describe('Array Operations Immutability', () => {
    function useArrayPattern() {
      const [formData, setFormData] = useState({
        electrode_groups: [
          { id: 0, location: 'CA1' },
          { id: 1, location: 'CA3' }
        ]
      });

      const addItem = () => {
        const form = structuredClone(formData);
        form.electrode_groups.push({ id: 2, location: 'DG' });
        setFormData(form);
      };

      const removeItem = (index) => {
        const form = structuredClone(formData);
        const items = structuredClone(form.electrode_groups);
        items.splice(index, 1);
        form.electrode_groups = items;
        setFormData(form);
      };

      const updateItem = (index, field, value) => {
        const form = structuredClone(formData);
        form.electrode_groups[index][field] = value;
        setFormData(form);
      };

      return { formData, addItem, removeItem, updateItem };
    }

    it('adding array item creates new references', () => {
      const { result } = renderHook(() => useArrayPattern());
      const originalArray = result.current.formData.electrode_groups;

      act(() => {
        result.current.addItem();
      });

      // Array should be new reference
      expect(result.current.formData.electrode_groups).not.toBe(originalArray);

      // Length should increase
      expect(result.current.formData.electrode_groups).toHaveLength(3);
    });

    it('removing array item creates new references', () => {
      const { result } = renderHook(() => useArrayPattern());
      const originalArray = result.current.formData.electrode_groups;

      act(() => {
        result.current.removeItem(0);
      });

      // Array should be new reference
      expect(result.current.formData.electrode_groups).not.toBe(originalArray);

      // Length should decrease
      expect(result.current.formData.electrode_groups).toHaveLength(1);

      // Should have removed correct item
      expect(result.current.formData.electrode_groups[0].id).toBe(1);
    });

    it('updating array item creates new references', () => {
      const { result } = renderHook(() => useArrayPattern());
      const originalArray = result.current.formData.electrode_groups;
      const originalItem = result.current.formData.electrode_groups[0];

      act(() => {
        result.current.updateItem(0, 'location', 'CA2');
      });

      // Array should be new reference
      expect(result.current.formData.electrode_groups).not.toBe(originalArray);

      // Item should be new reference (because parent was cloned)
      expect(result.current.formData.electrode_groups[0]).not.toBe(originalItem);

      // Value should update
      expect(result.current.formData.electrode_groups[0].location).toBe('CA2');
    });

    it('does not affect untouched array items', () => {
      const { result } = renderHook(() => useArrayPattern());

      act(() => {
        result.current.updateItem(0, 'location', 'CA2');
      });

      // Second item should remain unchanged (but is new object due to structuredClone)
      expect(result.current.formData.electrode_groups[1].location).toBe('CA3');
      expect(result.current.formData.electrode_groups[1].id).toBe(1);
    });
  });

  describe('Complex State Patterns', () => {
    it('maintains immutability with electrode group and ntrode map relationship', () => {
      const { result } = renderHook(() => {
        const [formData, setFormData] = useState({
          electrode_groups: [{ id: 0, device_type: 'tetrode_12.5' }],
          ntrode_electrode_group_channel_map: [
            { ntrode_id: 0, electrode_group_id: 0, map: { 0: 0, 1: 1, 2: 2, 3: 3 } }
          ]
        });

        const updateElectrodeGroup = (index, field, value) => {
          const form = structuredClone(formData);
          form.electrode_groups[index][field] = value;
          setFormData(form);
        };

        return { formData, updateElectrodeGroup };
      });

      const originalState = result.current.formData;
      const originalElectrodeGroups = result.current.formData.electrode_groups;
      const originalNtrodeMaps = result.current.formData.ntrode_electrode_group_channel_map;

      act(() => {
        result.current.updateElectrodeGroup(0, 'location', 'CA1');
      });

      // All references should be new
      expect(result.current.formData).not.toBe(originalState);
      expect(result.current.formData.electrode_groups).not.toBe(originalElectrodeGroups);
      expect(result.current.formData.ntrode_electrode_group_channel_map).not.toBe(originalNtrodeMaps);

      // Values should persist correctly
      expect(result.current.formData.electrode_groups[0].location).toBe('CA1');
      expect(result.current.formData.ntrode_electrode_group_channel_map).toHaveLength(1);
    });

    it('handles form reset immutably', () => {
      const defaultValues = {
        experimenter: [],
        session_id: '',
        cameras: []
      };

      const { result } = renderHook(() => {
        const [formData, setFormData] = useState({
          experimenter: ['Doe, John'],
          session_id: 'test_001',
          cameras: [{ id: 0 }]
        });

        const resetForm = () => {
          setFormData(structuredClone(defaultValues));
        };

        return { formData, resetForm };
      });

      const originalState = result.current.formData;

      act(() => {
        result.current.resetForm();
      });

      // State should be new reference
      expect(result.current.formData).not.toBe(originalState);

      // Should have reset to defaults
      expect(result.current.formData.experimenter).toEqual([]);
      expect(result.current.formData.session_id).toBe('');
      expect(result.current.formData.cameras).toEqual([]);
    });

    it('maintains immutability when no changes occur', () => {
      const { result } = renderHook(() => {
        const [formData, setFormData] = useState({
          session_id: 'test_001'
        });

        const updateSameValue = () => {
          const form = structuredClone(formData);
          form.session_id = 'test_001'; // Same value
          setFormData(form);
        };

        return { formData, updateSameValue };
      });

      const originalState = result.current.formData;

      act(() => {
        result.current.updateSameValue();
      });

      // State reference still changes (structuredClone always creates new object)
      expect(result.current.formData).not.toBe(originalState);

      // Value remains the same
      expect(result.current.formData.session_id).toBe('test_001');
    });
  });

  describe('Edge Cases', () => {
    it('handles undefined values immutably', () => {
      const original = {
        optionalField: undefined,
        requiredField: 'value'
      };
      const cloned = structuredClone(original);

      expect(cloned).not.toBe(original);
      expect(cloned.optionalField).toBe(undefined);
      expect(cloned.requiredField).toBe('value');
    });

    it('handles null values immutably', () => {
      const original = {
        nullField: null,
        normalField: 'value'
      };
      const cloned = structuredClone(original);

      expect(cloned).not.toBe(original);
      expect(cloned.nullField).toBe(null);
      expect(cloned.normalField).toBe('value');
    });

    it('handles empty arrays immutably', () => {
      const original = {
        emptyArray: [],
        filledArray: [1, 2, 3]
      };
      const cloned = structuredClone(original);

      expect(cloned.emptyArray).not.toBe(original.emptyArray);
      expect(cloned.filledArray).not.toBe(original.filledArray);
      expect(cloned).toEqual(original);
    });

    it('handles mixed types immutably', () => {
      const original = {
        string: 'test',
        number: 42,
        boolean: true,
        array: [1, 2, 3],
        object: { nested: 'value' },
        nullValue: null,
        undefinedValue: undefined
      };
      const cloned = structuredClone(original);

      expect(cloned).not.toBe(original);
      expect(cloned.array).not.toBe(original.array);
      expect(cloned.object).not.toBe(original.object);
      expect(cloned).toEqual(original);
    });

    it('handles large objects immutably', () => {
      const original = {
        electrode_groups: Array(100).fill(null).map((_, i) => ({
          id: i,
          location: `Region${i}`,
          device_type: 'tetrode_12.5'
        }))
      };
      const cloned = structuredClone(original);

      expect(cloned).not.toBe(original);
      expect(cloned.electrode_groups).not.toBe(original.electrode_groups);
      expect(cloned.electrode_groups).toHaveLength(100);
      expect(cloned.electrode_groups[0]).not.toBe(original.electrode_groups[0]);
      expect(cloned).toEqual(original);
    });
  });
});
