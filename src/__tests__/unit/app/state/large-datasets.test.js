/**
 * @vitest-environment jsdom
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useState } from 'react';

/**
 * Large Dataset State Management Tests
 *
 * These tests verify that state management performs efficiently and correctly
 * with large datasets that may occur in real-world usage (100-200 electrode groups).
 *
 * Performance considerations:
 * - structuredClone performance with large objects
 * - Memory efficiency
 * - Update responsiveness
 *
 * These tests establish baseline performance metrics to detect regressions.
 */

describe('Large Dataset State Management Tests', () => {
  describe('structuredClone Performance', () => {
    it('clones 100 electrode groups efficiently', () => {
      const largeState = {
        electrode_groups: Array(100)
          .fill(null)
          .map((_, i) => ({
            id: i,
            location: `CA${i % 3 + 1}`,
            device_type: 'tetrode_12.5',
            description: `Electrode group ${i}`,
            targeted_location: `CA${i % 3 + 1}`,
            targeted_x: Math.random() * 10,
            targeted_y: Math.random() * 10,
            targeted_z: Math.random() * 10,
          })),
      };

      const iterations = 10;
      const start = performance.now();

      for (let i = 0; i < iterations; i++) {
        structuredClone(largeState);
      }

      const duration = performance.now() - start;
      const avgTime = duration / iterations;

      // Should be fast (< 10ms per clone for 100 electrode groups)
      // Current baseline: ~0.15ms per clone
      expect(avgTime).toBeLessThan(10);
    });

    it('clones 200 electrode groups with ntrode maps efficiently', () => {
      const largeState = {
        electrode_groups: Array(200)
          .fill(null)
          .map((_, i) => ({
            id: i,
            location: `Region${i}`,
            device_type: 'tetrode_12.5',
          })),
        ntrode_electrode_group_channel_map: Array(200)
          .fill(null)
          .map((_, i) => ({
            ntrode_id: i,
            electrode_group_id: i,
            bad_channels: [],
            map: { 0: i * 4, 1: i * 4 + 1, 2: i * 4 + 2, 3: i * 4 + 3 },
          })),
      };

      const start = performance.now();
      const cloned = structuredClone(largeState);
      const duration = performance.now() - start;

      // Should complete in reasonable time (< 20ms)
      // Current baseline: ~0.2-0.3ms
      expect(duration).toBeLessThan(20);

      // Verify clone is correct
      expect(cloned.electrode_groups).toHaveLength(200);
      expect(cloned.ntrode_electrode_group_channel_map).toHaveLength(200);
      expect(cloned).not.toBe(largeState);
    });

    it('clones maximum realistic metadata structure', () => {
      // Realistic maximum: 200 electrode groups, 50 cameras, 10 tasks
      const maxState = {
        experimenter: ['Doe, John', 'Smith, Jane', 'Brown, Bob'],
        lab: 'Neuroscience Lab',
        institution: 'University',
        session_id: 'complex_session_001',
        session_description: 'Maximum complexity test session',
        subject: {
          subject_id: 'rat01',
          sex: 'M',
          species: 'Rattus norvegicus',
          weight: 300,
          date_of_birth: '2024-01-01',
          description: 'Test subject',
        },
        electrode_groups: Array(200)
          .fill(null)
          .map((_, i) => ({
            id: i,
            location: `Region${i}`,
            device_type: 'tetrode_12.5',
            description: `Electrode group ${i}`,
          })),
        ntrode_electrode_group_channel_map: Array(200)
          .fill(null)
          .map((_, i) => ({
            ntrode_id: i,
            electrode_group_id: i,
            bad_channels: i % 10 === 0 ? [1, 3] : [],
            map: { 0: i * 4, 1: i * 4 + 1, 2: i * 4 + 2, 3: i * 4 + 3 },
          })),
        cameras: Array(50)
          .fill(null)
          .map((_, i) => ({
            id: i,
            meters_per_pixel: 0.001 * (i + 1),
            manufacturer: `CamCo${i}`,
            model: `Model${i}`,
            lens: `Lens${i}`,
          })),
        tasks: Array(10)
          .fill(null)
          .map((_, i) => ({
            task_name: `Task${i}`,
            task_description: `Description for task ${i}`,
            task_environment: 'arena',
            camera_id: [0, 1, 2],
            task_epochs: [],
          })),
        associated_files: [],
        associated_video_files: [],
      };

      const start = performance.now();
      const cloned = structuredClone(maxState);
      const duration = performance.now() - start;

      // Should handle maximum complexity (< 50ms)
      // Current baseline: ~1-2ms
      expect(duration).toBeLessThan(50);

      // Verify structure
      expect(cloned.electrode_groups).toHaveLength(200);
      expect(cloned.ntrode_electrode_group_channel_map).toHaveLength(200);
      expect(cloned.cameras).toHaveLength(50);
      expect(cloned.tasks).toHaveLength(10);
      expect(cloned).not.toBe(maxState);
    });
  });

  describe('Large Dataset State Updates', () => {
    function useLargeFormData() {
      const [formData, setFormData] = useState({
        electrode_groups: Array(100)
          .fill(null)
          .map((_, i) => ({
            id: i,
            location: `CA${i % 3 + 1}`,
            device_type: 'tetrode_12.5',
          })),
        ntrode_electrode_group_channel_map: Array(100)
          .fill(null)
          .map((_, i) => ({
            ntrode_id: i,
            electrode_group_id: i,
            bad_channels: [],
            map: { 0: i * 4, 1: i * 4 + 1, 2: i * 4 + 2, 3: i * 4 + 3 },
          })),
      });

      const updateElectrodeGroup = (index, field, value) => {
        const form = structuredClone(formData);
        form.electrode_groups[index][field] = value;
        setFormData(form);
      };

      const addElectrodeGroup = () => {
        const form = structuredClone(formData);
        const newId = form.electrode_groups.length;
        form.electrode_groups.push({
          id: newId,
          location: 'DG',
          device_type: 'tetrode_12.5',
        });
        setFormData(form);
      };

      const removeElectrodeGroup = (index) => {
        const form = structuredClone(formData);
        const items = structuredClone(form.electrode_groups);
        items.splice(index, 1);
        form.electrode_groups = items;
        setFormData(form);
      };

      return { formData, updateElectrodeGroup, addElectrodeGroup, removeElectrodeGroup };
    }

    it('updates single field in large dataset efficiently', () => {
      const { result } = renderHook(() => useLargeFormData());

      const start = performance.now();
      act(() => {
        result.current.updateElectrodeGroup(50, 'location', 'DG');
      });
      const duration = performance.now() - start;

      // Should be fast despite large dataset (< 100ms)
      // Current baseline: ~1-5ms
      expect(duration).toBeLessThan(100);

      // Verify update
      expect(result.current.formData.electrode_groups[50].location).toBe('DG');
      expect(result.current.formData.electrode_groups).toHaveLength(100);
    });

    it('adds item to large dataset efficiently', () => {
      const { result } = renderHook(() => useLargeFormData());

      const start = performance.now();
      act(() => {
        result.current.addElectrodeGroup();
      });
      const duration = performance.now() - start;

      // Should be fast (< 100ms)
      expect(duration).toBeLessThan(100);

      // Verify addition
      expect(result.current.formData.electrode_groups).toHaveLength(101);
      expect(result.current.formData.electrode_groups[100].location).toBe('DG');
    });

    it('removes item from large dataset efficiently', () => {
      const { result } = renderHook(() => useLargeFormData());

      const start = performance.now();
      act(() => {
        result.current.removeElectrodeGroup(50);
      });
      const duration = performance.now() - start;

      // Should be fast (< 100ms)
      expect(duration).toBeLessThan(100);

      // Verify removal
      expect(result.current.formData.electrode_groups).toHaveLength(99);
    });

    it('handles multiple sequential updates to large dataset', () => {
      const { result } = renderHook(() => useLargeFormData());

      const start = performance.now();

      // 10 sequential updates - each needs its own act() call
      for (let i = 0; i < 10; i++) {
        act(() => {
          result.current.updateElectrodeGroup(i, 'location', `Updated${i}`);
        });
      }

      const duration = performance.now() - start;

      // 10 updates should be fast (< 500ms)
      // Current baseline: ~10-50ms total
      expect(duration).toBeLessThan(500);

      // Verify all updates applied
      expect(result.current.formData.electrode_groups[0].location).toBe('Updated0');
      expect(result.current.formData.electrode_groups[9].location).toBe('Updated9');
    });
  });

  describe('Memory and Reference Behavior with Large Datasets', () => {
    // Re-declare the hook here for this describe block
    function useLargeFormData() {
      const [formData, setFormData] = useState({
        electrode_groups: Array(100)
          .fill(null)
          .map((_, i) => ({
            id: i,
            location: `CA${i % 3 + 1}`,
            device_type: 'tetrode_12.5',
          })),
        ntrode_electrode_group_channel_map: Array(100)
          .fill(null)
          .map((_, i) => ({
            ntrode_id: i,
            electrode_group_id: i,
            bad_channels: [],
            map: { 0: i * 4, 1: i * 4 + 1, 2: i * 4 + 2, 3: i * 4 + 3 },
          })),
      });

      const updateElectrodeGroup = (index, field, value) => {
        const form = structuredClone(formData);
        form.electrode_groups[index][field] = value;
        setFormData(form);
      };

      return { formData, updateElectrodeGroup };
    }

    it('maintains immutability with 100+ electrode groups', () => {
      const largeState = {
        electrode_groups: Array(100)
          .fill(null)
          .map((_, i) => ({ id: i, location: 'CA1' })),
      };

      const cloned = structuredClone(largeState);

      // All array items should be new references
      for (let i = 0; i < 100; i++) {
        expect(cloned.electrode_groups[i]).not.toBe(largeState.electrode_groups[i]);
      }

      // Modifying clone should not affect original
      cloned.electrode_groups[50].location = 'Modified';
      expect(largeState.electrode_groups[50].location).toBe('CA1');
    });

    it('handles rapid state updates without memory leaks', () => {
      const { result } = renderHook(() => useLargeFormData());

      // Simulate rapid user interactions
      for (let i = 0; i < 20; i++) {
        act(() => {
          result.current.updateElectrodeGroup(i % 100, 'location', `Rapid${i}`);
        });
      }

      // Should not throw or hang
      expect(result.current.formData.electrode_groups).toHaveLength(100);

      // Final state should reflect last update for each modified item
      // i=0 updates index 0 to 'Rapid0'
      // i=10 updates index 10 to 'Rapid10'
      // i=20 would update index 0 to 'Rapid20', but we only loop to i=19
      expect(result.current.formData.electrode_groups[0].location).toBe('Rapid0');
      expect(result.current.formData.electrode_groups[10].location).toBe('Rapid10');
      expect(result.current.formData.electrode_groups[19].location).toBe('Rapid19');
    });

    it('clones nested maps efficiently in large datasets', () => {
      const largeState = {
        ntrode_electrode_group_channel_map: Array(200)
          .fill(null)
          .map((_, i) => ({
            ntrode_id: i,
            electrode_group_id: i,
            bad_channels: [],
            map: { 0: i * 4, 1: i * 4 + 1, 2: i * 4 + 2, 3: i * 4 + 3 },
          })),
      };

      const start = performance.now();
      const cloned = structuredClone(largeState);
      const duration = performance.now() - start;

      // Should be fast despite complex nested structure
      expect(duration).toBeLessThan(20);

      // All maps should be new references
      expect(cloned.ntrode_electrode_group_channel_map[0].map).not.toBe(
        largeState.ntrode_electrode_group_channel_map[0].map
      );
      expect(cloned.ntrode_electrode_group_channel_map[100].map).not.toBe(
        largeState.ntrode_electrode_group_channel_map[100].map
      );
    });
  });

  describe('Edge Cases with Large Datasets', () => {
    it('handles maximum array length', () => {
      const maxState = {
        items: Array(200).fill({ id: 0, value: 'test' }),
      };

      const cloned = structuredClone(maxState);

      expect(cloned.items).toHaveLength(200);
      expect(cloned.items).not.toBe(maxState.items);
    });

    it('handles sparse large arrays', () => {
      const sparseArray = Array(100);
      sparseArray[0] = { id: 0 };
      sparseArray[50] = { id: 50 };
      sparseArray[99] = { id: 99 };

      const state = { sparse: sparseArray };
      const cloned = structuredClone(state);

      expect(cloned.sparse).toHaveLength(100);
      expect(cloned.sparse[0]).toEqual({ id: 0 });
      expect(cloned.sparse[50]).toEqual({ id: 50 });
      expect(cloned.sparse[99]).toEqual({ id: 99 });
      expect(cloned.sparse[25]).toBe(undefined);
    });

    it('handles mixed empty and filled items in large arrays', () => {
      const state = {
        mixed: Array(100)
          .fill(null)
          .map((_, i) => (i % 2 === 0 ? { id: i, data: 'filled' } : null)),
      };

      const cloned = structuredClone(state);

      expect(cloned.mixed).toHaveLength(100);
      expect(cloned.mixed[0]).toEqual({ id: 0, data: 'filled' });
      expect(cloned.mixed[1]).toBe(null);
      expect(cloned.mixed[98]).toEqual({ id: 98, data: 'filled' });
      expect(cloned.mixed[99]).toBe(null);
    });

    it('maintains property order in large objects', () => {
      const largeObject = {};
      for (let i = 0; i < 200; i++) {
        largeObject[`prop${i}`] = `value${i}`;
      }

      const state = { large: largeObject };
      const cloned = structuredClone(state);

      const originalKeys = Object.keys(state.large);
      const clonedKeys = Object.keys(cloned.large);

      expect(clonedKeys).toEqual(originalKeys);
    });
  });

  describe('Performance Regression Detection', () => {
    it('establishes baseline for 100 electrode groups clone', () => {
      const state = {
        electrode_groups: Array(100)
          .fill(null)
          .map((_, i) => ({
            id: i,
            location: 'CA1',
            device_type: 'tetrode_12.5',
          })),
      };

      const iterations = 100;
      const times = [];

      for (let i = 0; i < iterations; i++) {
        const start = performance.now();
        structuredClone(state);
        const duration = performance.now() - start;
        times.push(duration);
      }

      const avgTime = times.reduce((a, b) => a + b, 0) / iterations;
      const maxTime = Math.max(...times);
      const minTime = Math.min(...times);

      // Log for baseline documentation
      console.log(
        `Baseline - 100 electrode groups: avg=${avgTime.toFixed(3)}ms, min=${minTime.toFixed(
          3
        )}ms, max=${maxTime.toFixed(3)}ms`
      );

      // Should average < 5ms (current baseline: ~0.15ms)
      expect(avgTime).toBeLessThan(5);
    });

    it('establishes baseline for 200 electrode groups + ntrode maps clone', () => {
      const state = {
        electrode_groups: Array(200)
          .fill(null)
          .map((_, i) => ({
            id: i,
            location: 'CA1',
            device_type: 'tetrode_12.5',
          })),
        ntrode_electrode_group_channel_map: Array(200)
          .fill(null)
          .map((_, i) => ({
            ntrode_id: i,
            electrode_group_id: i,
            bad_channels: [],
            map: { 0: i * 4, 1: i * 4 + 1, 2: i * 4 + 2, 3: i * 4 + 3 },
          })),
      };

      const iterations = 100;
      const times = [];

      for (let i = 0; i < iterations; i++) {
        const start = performance.now();
        structuredClone(state);
        const duration = performance.now() - start;
        times.push(duration);
      }

      const avgTime = times.reduce((a, b) => a + b, 0) / iterations;
      const maxTime = Math.max(...times);
      const minTime = Math.min(...times);

      // Log for baseline documentation
      console.log(
        `Baseline - 200 EG + ntrode maps: avg=${avgTime.toFixed(
          3
        )}ms, min=${minTime.toFixed(3)}ms, max=${maxTime.toFixed(3)}ms`
      );

      // Should average < 10ms (current baseline: ~0.2-0.3ms)
      expect(avgTime).toBeLessThan(10);
    });
  });
});
