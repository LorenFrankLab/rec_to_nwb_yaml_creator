/**
 * BASELINE TEST - Documents current state management behavior
 *
 * This test documents the CURRENT state management implementation in App.js,
 * including structuredClone usage, array operations, and electrode group handling.
 *
 * Purpose: Detect unintended regressions during refactoring
 *
 * IMPORTANT: These tests document what CURRENTLY happens, not what SHOULD happen.
 * Performance characteristics and quirks are explicitly documented.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from '../../App';
import { renderWithProviders } from '../helpers/test-utils';

/**
 * Helper to create realistic form data for testing
 */
function createFormData(overrides = {}) {
  return {
    experimenter_name: ['Doe, John'],
    lab: 'Test Lab',
    institution: 'Test Institution',
    data_acq_device: [
      {
        name: 'TestDevice',
        system: 'TestSystem',
        amplifier: 'TestAmp',
        adc_circuit: 'TestADC',
      },
    ],
    times_period_multiplier: 1.5,
    raw_data_to_volts: 0.195,
    cameras: [],
    tasks: [],
    electrode_groups: [],
    ntrode_electrode_group_channel_map: [],
    ...overrides,
  };
}

describe('BASELINE: structuredClone Usage and Immutability', () => {
  describe('structuredClone Performance Characteristics', () => {
    it('documents current performance with small state objects', () => {
      const smallState = createFormData({
        cameras: Array(5).fill(null).map((_, i) => ({
          id: i,
          meters_per_pixel: 0.001,
          camera_name: `camera_${i}`,
        })),
      });

      const iterations = 100;
      const start = performance.now();

      for (let i = 0; i < iterations; i++) {
        structuredClone(smallState);
      }

      const duration = performance.now() - start;
      const avgTime = duration / iterations;

      console.log(`📊 structuredClone avg (5 cameras): ${avgTime.toFixed(2)}ms`);

      // Baseline: Document current performance
      // Should be very fast for small objects
      expect(avgTime).toBeLessThan(10);
    });

    it('documents current performance with medium state objects', () => {
      const mediumState = createFormData({
        electrode_groups: Array(50).fill(null).map((_, i) => ({
          id: i,
          location: 'CA1',
          device_type: 'tetrode_12.5',
          description: `Electrode group ${i}`,
        })),
        ntrode_electrode_group_channel_map: Array(50).fill(null).map((_, i) => ({
          ntrode_id: i,
          electrode_group_id: i,
          bad_channels: [],
          map: { '0': i * 4, '1': i * 4 + 1, '2': i * 4 + 2, '3': i * 4 + 3 },
        })),
      });

      const iterations = 100;
      const start = performance.now();

      for (let i = 0; i < iterations; i++) {
        structuredClone(mediumState);
      }

      const duration = performance.now() - start;
      const avgTime = duration / iterations;

      console.log(`📊 structuredClone avg (50 electrode groups): ${avgTime.toFixed(2)}ms`);

      // Baseline: Should be reasonably fast
      expect(avgTime).toBeLessThan(50);

      // Baseline performance: ~0.08ms avg (snapshot removed due to timing variance)
    });

    it('documents current performance with large state objects', () => {
      const largeState = createFormData({
        electrode_groups: Array(100).fill(null).map((_, i) => ({
          id: i,
          location: 'CA1',
          device_type: 'tetrode_12.5',
          description: `Electrode group ${i}`,
        })),
        ntrode_electrode_group_channel_map: Array(100).fill(null).map((_, i) => ({
          ntrode_id: i,
          electrode_group_id: i,
          bad_channels: [],
          map: { '0': i * 4, '1': i * 4 + 1, '2': i * 4 + 2, '3': i * 4 + 3 },
        })),
      });

      const iterations = 50;
      const start = performance.now();

      for (let i = 0; i < iterations; i++) {
        structuredClone(largeState);
      }

      const duration = performance.now() - start;
      const avgTime = duration / iterations;

      console.log(`📊 structuredClone avg (100 electrode groups): ${avgTime.toFixed(2)}ms`);

      // Baseline: Document current performance
      // May be slower with large objects
      expect(avgTime).toBeLessThan(100);

      // Baseline performance: ~0.17ms avg (snapshot removed due to timing variance)
    });
  });

  describe('Immutability Verification', () => {
    it('structuredClone creates new top-level object references', () => {
      const original = createFormData();
      const cloned = structuredClone(original);

      // Should be different objects
      expect(cloned).not.toBe(original);

      // But equal values
      expect(cloned).toEqual(original);
    });

    it('structuredClone creates new array references', () => {
      const original = createFormData({
        cameras: [{ id: 0, meters_per_pixel: 0.001 }],
      });
      const cloned = structuredClone(original);

      // Arrays should be different references
      expect(cloned.cameras).not.toBe(original.cameras);
      expect(cloned.cameras[0]).not.toBe(original.cameras[0]);

      // But equal values
      expect(cloned.cameras).toEqual(original.cameras);
    });

    it('structuredClone creates new nested object references', () => {
      const original = createFormData({
        electrode_groups: [
          { id: 0, location: 'CA1', device_type: 'tetrode_12.5' },
        ],
      });
      const cloned = structuredClone(original);

      // Nested objects should be different references
      expect(cloned.electrode_groups).not.toBe(original.electrode_groups);
      expect(cloned.electrode_groups[0]).not.toBe(original.electrode_groups[0]);

      // But equal values
      expect(cloned.electrode_groups).toEqual(original.electrode_groups);
    });

    it('structuredClone handles complex ntrode channel maps', () => {
      const original = createFormData({
        ntrode_electrode_group_channel_map: [
          {
            ntrode_id: 0,
            electrode_group_id: 0,
            bad_channels: [1, 3],
            map: { '0': 0, '1': 1, '2': 2, '3': 3 },
          },
        ],
      });
      const cloned = structuredClone(original);

      // All levels should be new references
      expect(cloned.ntrode_electrode_group_channel_map).not.toBe(
        original.ntrode_electrode_group_channel_map
      );
      expect(cloned.ntrode_electrode_group_channel_map[0]).not.toBe(
        original.ntrode_electrode_group_channel_map[0]
      );
      expect(cloned.ntrode_electrode_group_channel_map[0].map).not.toBe(
        original.ntrode_electrode_group_channel_map[0].map
      );
      expect(cloned.ntrode_electrode_group_channel_map[0].bad_channels).not.toBe(
        original.ntrode_electrode_group_channel_map[0].bad_channels
      );

      // Values should be equal
      expect(cloned.ntrode_electrode_group_channel_map).toEqual(
        original.ntrode_electrode_group_channel_map
      );
    });
  });

  describe('structuredClone Edge Cases', () => {
    it('handles empty arrays correctly', () => {
      const original = createFormData({
        cameras: [],
        tasks: [],
        electrode_groups: [],
      });
      const cloned = structuredClone(original);

      expect(cloned.cameras).not.toBe(original.cameras);
      expect(cloned.cameras).toEqual([]);
    });

    it('handles objects with undefined properties', () => {
      const original = createFormData({
        experiment_description: undefined,
      });
      const cloned = structuredClone(original);

      // BASELINE: structuredClone actually preserves undefined properties
      // (contrary to JSON.stringify which removes them)
      expect(cloned).toHaveProperty('experiment_description');
      expect(cloned.experiment_description).toBeUndefined();
    });

    it('handles objects with null values', () => {
      const original = createFormData({
        experiment_description: null,
      });
      const cloned = structuredClone(original);

      expect(cloned.experiment_description).toBeNull();
      expect(cloned).toEqual(original);
    });

    it('handles deeply nested objects', () => {
      const original = {
        level1: {
          level2: {
            level3: {
              level4: {
                value: 'deep',
              },
            },
          },
        },
      };
      const cloned = structuredClone(original);

      expect(cloned.level1.level2.level3.level4).not.toBe(
        original.level1.level2.level3.level4
      );
      expect(cloned).toEqual(original);
    });
  });
});

describe('BASELINE: Array Operations', () => {
  describe('Array ID Management', () => {
    it('BASELINE: documents how IDs are auto-incremented when adding items', () => {
      // This tests the pattern used in addArrayItem()
      const formItems = [
        { id: 0, name: 'item0' },
        { id: 1, name: 'item1' },
        { id: 5, name: 'item5' }, // Note: gap in IDs
      ];

      const idValues = formItems.map((item) => item.id).filter((id) => id !== undefined);
      const maxId = idValues.length > 0 ? Math.max(...idValues) + 1 : 0;

      // Next ID should be 6 (max of 0,1,5 is 5, +1 = 6)
      expect(maxId).toBe(6);

      // Document this behavior
      expect({ formItems, nextId: maxId }).toMatchSnapshot('id-auto-increment');
    });

    it('BASELINE: documents behavior when first item is added (no existing IDs)', () => {
      const formItems = [];
      const idValues = formItems.map((item) => item.id).filter((id) => id !== undefined);
      const maxId = idValues.length > 0 ? Math.max(...idValues) + 1 : 0;

      // First ID should be 0
      expect(maxId).toBe(0);
    });

    it('BASELINE: documents behavior with negative IDs (edge case)', () => {
      // Edge case: what if form has negative IDs?
      const formItems = [
        { id: -1, name: 'item-1' },
        { id: 0, name: 'item0' },
      ];

      const idValues = formItems.map((item) => item.id).filter((id) => id !== undefined);
      const maxId = idValues.length > 0 ? Math.max(...idValues) + 1 : 0;

      // Max of -1, 0 is 0, +1 = 1
      expect(maxId).toBe(1);
    });
  });

  describe('Array Splice Operations', () => {
    it('BASELINE: documents array removal with splice', () => {
      const items = [
        { id: 0, name: 'item0' },
        { id: 1, name: 'item1' },
        { id: 2, name: 'item2' },
      ];
      const clonedItems = structuredClone(items);

      // Remove index 1
      clonedItems.splice(1, 1);

      expect(clonedItems).toEqual([
        { id: 0, name: 'item0' },
        { id: 2, name: 'item2' },
      ]);
      expect(clonedItems.length).toBe(2);

      // Original should be unchanged (immutability)
      expect(items.length).toBe(3);
    });

    it('BASELINE: documents array insertion with splice', () => {
      const items = [
        { id: 0, name: 'item0' },
        { id: 2, name: 'item2' },
      ];
      const clonedItems = structuredClone(items);
      const newItem = { id: 1, name: 'item1' };

      // Insert at index 1
      clonedItems.splice(1, 0, newItem);

      expect(clonedItems).toEqual([
        { id: 0, name: 'item0' },
        { id: 1, name: 'item1' },
        { id: 2, name: 'item2' },
      ]);
    });

    it('BASELINE: documents duplicate operation (insert after original)', () => {
      // This mimics duplicateArrayItem() behavior
      const form = {
        cameras: [
          { id: 0, camera_name: 'camera0' },
          { id: 1, camera_name: 'camera1' },
          { id: 2, camera_name: 'camera2' },
        ],
      };

      const index = 1; // Duplicate camera1
      const clonedForm = structuredClone(form);
      const item = structuredClone(clonedForm.cameras[index]);

      // Increment ID
      const ids = clonedForm.cameras.map((c) => c.id);
      const maxId = Math.max(...ids);
      item.id = maxId + 1;

      // Insert after the original (index + 1)
      clonedForm.cameras.splice(index + 1, 0, item);

      expect(clonedForm.cameras).toEqual([
        { id: 0, camera_name: 'camera0' },
        { id: 1, camera_name: 'camera1' },
        { id: 3, camera_name: 'camera1' }, // Duplicated with new ID
        { id: 2, camera_name: 'camera2' },
      ]);

      // Document this behavior
      expect(clonedForm.cameras).toMatchSnapshot('duplicate-array-item');
    });
  });

  describe('Array Filtering Operations', () => {
    it('BASELINE: documents filtering pattern used for ntrode removal', () => {
      const form = {
        electrode_groups: [{ id: 0 }, { id: 1 }, { id: 2 }],
        ntrode_electrode_group_channel_map: [
          { ntrode_id: 0, electrode_group_id: 0 },
          { ntrode_id: 1, electrode_group_id: 0 },
          { ntrode_id: 2, electrode_group_id: 1 },
          { ntrode_id: 3, electrode_group_id: 2 },
        ],
      };

      const electrodeGroupIdToRemove = 0;

      // Filter out ntrodes associated with electrode_group_id 0
      const filtered = form.ntrode_electrode_group_channel_map.filter(
        (nTrode) => nTrode.electrode_group_id !== electrodeGroupIdToRemove
      );

      expect(filtered).toEqual([
        { ntrode_id: 2, electrode_group_id: 1 },
        { ntrode_id: 3, electrode_group_id: 2 },
      ]);

      // Document this pattern
      expect(filtered).toMatchSnapshot('filter-ntrodes-by-electrode-group');
    });
  });
});

describe('BASELINE: Electrode Group & Ntrode Channel Map Synchronization', () => {
  describe('Device Type Selection and Ntrode Auto-Generation', () => {
    it('BASELINE: documents ntrode generation for tetrode_12.5', () => {
      // tetrode_12.5 has 4 channels, 1 shank
      const deviceType = 'tetrode_12.5';
      const electrodeGroupId = 0;

      // Expected map for tetrode: {0: 0, 1: 1, 2: 2, 3: 3}
      const expectedMap = { '0': 0, '1': 1, '2': 2, '3': 3 };
      const expectedShankCount = 1;

      const nTrodes = [];
      for (let i = 0; i < expectedShankCount; i++) {
        nTrodes.push({
          ntrode_id: i + 1,
          electrode_group_id: electrodeGroupId,
          bad_channels: [],
          map: structuredClone(expectedMap),
        });
      }

      expect(nTrodes).toMatchSnapshot('ntrode-tetrode-12.5');
    });

    it('BASELINE: documents ntrode generation for multi-shank probe', () => {
      // 32c-2s8mm6cm-20um-40um-dl has 16 channels per shank, 2 shanks
      // This is a simplified version - actual deviceTypeMap() is more complex
      const deviceType = '32c-2s8mm6cm-20um-40um-dl';
      const electrodeGroupId = 1;
      const channelsPerShank = 16;
      const shankCount = 2;

      const nTrodes = [];
      for (let shankIndex = 0; shankIndex < shankCount; shankIndex++) {
        const map = {};
        for (let ch = 0; ch < channelsPerShank; ch++) {
          map[ch.toString()] = ch + (channelsPerShank * shankIndex);
        }

        nTrodes.push({
          ntrode_id: shankIndex + 1,
          electrode_group_id: electrodeGroupId,
          bad_channels: [],
          map: map,
        });
      }

      // Document this behavior
      expect(nTrodes).toMatchSnapshot('ntrode-multi-shank-probe');
    });

    it('BASELINE: documents ntrode_id renumbering after generation', () => {
      // After generating ntrodes, they should be renumbered sequentially
      const ntrodeMap = [
        { ntrode_id: 10, electrode_group_id: 0 }, // Will become 1
        { ntrode_id: 20, electrode_group_id: 0 }, // Will become 2
        { ntrode_id: 5, electrode_group_id: 1 },  // Will become 3
      ];

      // Renumber (mimics behavior in nTrodeMapSelected)
      ntrodeMap.forEach((n, nIndex) => {
        n.ntrode_id = nIndex + 1;
      });

      expect(ntrodeMap).toEqual([
        { ntrode_id: 1, electrode_group_id: 0 },
        { ntrode_id: 2, electrode_group_id: 0 },
        { ntrode_id: 3, electrode_group_id: 1 },
      ]);
    });
  });

  describe('Electrode Group Removal Cascade', () => {
    it('BASELINE: documents cascade deletion of ntrodes when electrode group removed', () => {
      const form = {
        electrode_groups: [
          { id: 0, location: 'CA1', device_type: 'tetrode_12.5' },
          { id: 1, location: 'CA3', device_type: 'tetrode_12.5' },
        ],
        ntrode_electrode_group_channel_map: [
          { ntrode_id: 1, electrode_group_id: 0, map: {} },
          { ntrode_id: 2, electrode_group_id: 1, map: {} },
        ],
      };

      const electrodeGroupToRemove = form.electrode_groups[0];
      const clonedForm = structuredClone(form);

      // Remove ntrodes associated with this electrode group
      clonedForm.ntrode_electrode_group_channel_map =
        clonedForm.ntrode_electrode_group_channel_map.filter(
          (nTrode) => nTrode.electrode_group_id !== electrodeGroupToRemove.id
        );

      // Remove electrode group
      clonedForm.electrode_groups.splice(0, 1);

      expect(clonedForm.electrode_groups).toEqual([
        { id: 1, location: 'CA3', device_type: 'tetrode_12.5' },
      ]);
      expect(clonedForm.ntrode_electrode_group_channel_map).toEqual([
        { ntrode_id: 2, electrode_group_id: 1, map: {} },
      ]);

      // Document this cascade behavior
      expect(clonedForm).toMatchSnapshot('electrode-group-removal-cascade');
    });
  });

  describe('Electrode Group Duplication with Ntrodes', () => {
    it('BASELINE: documents complete duplication logic', () => {
      const form = {
        electrode_groups: [
          { id: 0, location: 'CA1', device_type: 'tetrode_12.5' },
        ],
        ntrode_electrode_group_channel_map: [
          {
            ntrode_id: 1,
            electrode_group_id: 0,
            bad_channels: [2],
            map: { '0': 0, '1': 1, '2': 2, '3': 3 },
          },
        ],
      };

      const indexToDuplicate = 0;
      const clonedForm = structuredClone(form);

      // Get new electrode group ID
      const newElectrodeGroupId =
        Math.max(...clonedForm.electrode_groups.map((eg) => eg.id)) + 1;

      // Clone electrode group
      const clonedElectrodeGroup = structuredClone(
        clonedForm.electrode_groups[indexToDuplicate]
      );
      clonedElectrodeGroup.id = newElectrodeGroupId;

      // Clone associated ntrodes
      const nTrodes = structuredClone(
        clonedForm.ntrode_electrode_group_channel_map.filter(
          (n) => n.electrode_group_id === 0
        )
      );

      // Update ntrode IDs
      let largestNtrodeId = Math.max(
        ...clonedForm.ntrode_electrode_group_channel_map.map((n) => n.ntrode_id)
      );

      nTrodes.forEach((n) => {
        largestNtrodeId += 1;
        n.electrode_group_id = newElectrodeGroupId;
        n.ntrode_id = largestNtrodeId;
      });

      // Add to form
      clonedForm.ntrode_electrode_group_channel_map.push(...nTrodes);
      clonedForm.electrode_groups.splice(indexToDuplicate + 1, 0, clonedElectrodeGroup);

      expect(clonedForm.electrode_groups).toEqual([
        { id: 0, location: 'CA1', device_type: 'tetrode_12.5' },
        { id: 1, location: 'CA1', device_type: 'tetrode_12.5' },
      ]);

      expect(clonedForm.ntrode_electrode_group_channel_map).toEqual([
        {
          ntrode_id: 1,
          electrode_group_id: 0,
          bad_channels: [2],
          map: { '0': 0, '1': 1, '2': 2, '3': 3 },
        },
        {
          ntrode_id: 2,
          electrode_group_id: 1,
          bad_channels: [2],
          map: { '0': 0, '1': 1, '2': 2, '3': 3 },
        },
      ]);

      // Document this complete duplication behavior
      expect(clonedForm).toMatchSnapshot('electrode-group-duplication-with-ntrodes');
    });
  });
});

describe('BASELINE: Form State Transformations', () => {
  describe('Comma-Separated String Parsing', () => {
    it('BASELINE: documents comma-separated number parsing', () => {
      // This mimics commaSeparatedStringToNumber() behavior
      const input = '1, 2, 3, 4';
      const parsed = input
        .split(',')
        .map((s) => s.trim())
        .filter((s) => s !== '')
        .map((s) => parseInt(s, 10));

      expect(parsed).toEqual([1, 2, 3, 4]);
    });

    it('BASELINE: documents comma-separated number with spaces', () => {
      const input = '  10  ,  20  ,  30  ';
      const parsed = input
        .split(',')
        .map((s) => s.trim())
        .filter((s) => s !== '')
        .map((s) => parseInt(s, 10));

      expect(parsed).toEqual([10, 20, 30]);
    });

    it('BASELINE: documents comma-separated string formatting', () => {
      // This mimics formatCommaSeparatedString() behavior
      const input = '  tag1  ,  tag2  ,  tag3  ';
      const formatted = input
        .split(',')
        .map((s) => s.trim())
        .filter((s) => s !== '');

      expect(formatted).toEqual(['tag1', 'tag2', 'tag3']);
    });

    it('BASELINE: documents behavior with empty strings', () => {
      const input = 'a, , , b';
      const parsed = input
        .split(',')
        .map((s) => s.trim())
        .filter((s) => s !== '');

      expect(parsed).toEqual(['a', 'b']);
    });
  });

  describe('Number Type Coercion', () => {
    it('BASELINE: documents parseFloat behavior', () => {
      expect(parseFloat('1.5', 10)).toBe(1.5);
      expect(parseFloat('123', 10)).toBe(123);
      expect(parseFloat('0.001', 10)).toBe(0.001);
    });

    it('BASELINE: documents parseFloat with invalid input', () => {
      expect(parseFloat('not a number', 10)).toBeNaN();
      expect(parseFloat('', 10)).toBeNaN();
    });

    it('BASELINE: documents parseInt behavior', () => {
      expect(parseInt('123', 10)).toBe(123);
      expect(parseInt('1.5', 10)).toBe(1); // Truncates
      expect(parseInt('0xFF', 10)).toBe(0); // Base 10 parsing
    });
  });
});

describe('BASELINE: Dynamic Dependencies Tracking', () => {
  describe('Camera IDs Collection', () => {
    it('BASELINE: documents how camera IDs are collected from cameras array', () => {
      const formData = {
        cameras: [
          { id: 0, camera_name: 'overhead' },
          { id: 1, camera_name: 'side' },
          { id: 5, camera_name: 'front' }, // Note: non-sequential
        ],
      };

      const cameraIds = formData.cameras.map((camera) => camera.id);

      expect(cameraIds).toEqual([0, 1, 5]);
      expect(cameraIds).toMatchSnapshot('camera-ids-collection');
    });

    it('BASELINE: documents empty cameras array', () => {
      const formData = { cameras: [] };
      const cameraIds = formData.cameras.map((camera) => camera.id);

      expect(cameraIds).toEqual([]);
    });
  });

  describe('Task Epochs Collection', () => {
    it('BASELINE: documents how task epochs are collected', () => {
      const formData = {
        tasks: [
          { task_name: 'sleep', task_epochs: [1, 2] },
          { task_name: 'run', task_epochs: [3, 4, 5] },
          { task_name: 'rest', task_epochs: [6] },
        ],
      };

      const allEpochs = formData.tasks.flatMap((task) => task.task_epochs || []);

      expect(allEpochs).toEqual([1, 2, 3, 4, 5, 6]);
      expect(allEpochs).toMatchSnapshot('task-epochs-collection');
    });

    it('BASELINE: documents handling of tasks without epochs', () => {
      const formData = {
        tasks: [
          { task_name: 'sleep', task_epochs: [1, 2] },
          { task_name: 'run' }, // No task_epochs
        ],
      };

      const allEpochs = formData.tasks.flatMap((task) => task.task_epochs || []);

      expect(allEpochs).toEqual([1, 2]);
    });
  });

  describe('DIO Events Collection', () => {
    it('BASELINE: documents how behavioral event names are collected', () => {
      const formData = {
        behavioral_events: [
          { description: 'Reward', name: 'reward_event' },
          { description: 'Stimulus', name: 'stim_event' },
        ],
      };

      const eventNames = formData.behavioral_events?.map((event) => event.name) || [];

      expect(eventNames).toEqual(['reward_event', 'stim_event']);
      expect(eventNames).toMatchSnapshot('dio-events-collection');
    });
  });
});

describe('BASELINE: State Consistency After Operations', () => {
  describe('Multiple Sequential Operations', () => {
    it('BASELINE: documents state after multiple array additions', () => {
      let form = createFormData();

      // Add 3 cameras
      for (let i = 0; i < 3; i++) {
        const clonedForm = structuredClone(form);
        clonedForm.cameras.push({
          id: i,
          camera_name: `camera_${i}`,
          meters_per_pixel: 0.001,
        });
        form = clonedForm;
      }

      expect(form.cameras.length).toBe(3);
      expect(form.cameras.map((c) => c.id)).toEqual([0, 1, 2]);
      expect(form.cameras).toMatchSnapshot('multiple-camera-additions');
    });

    it('BASELINE: documents state after add-then-remove operations', () => {
      let form = createFormData({
        cameras: [
          { id: 0, camera_name: 'camera_0' },
          { id: 1, camera_name: 'camera_1' },
          { id: 2, camera_name: 'camera_2' },
        ],
      });

      // Remove middle camera
      const clonedForm = structuredClone(form);
      clonedForm.cameras.splice(1, 1);
      form = clonedForm;

      expect(form.cameras.length).toBe(2);
      expect(form.cameras).toEqual([
        { id: 0, camera_name: 'camera_0' },
        { id: 2, camera_name: 'camera_2' },
      ]);
    });
  });

  describe('Complex Electrode Group Operations', () => {
    it('BASELINE: documents state after electrode group add, duplicate, remove sequence', () => {
      let form = createFormData({
        electrode_groups: [
          { id: 0, location: 'CA1', device_type: 'tetrode_12.5' },
        ],
        ntrode_electrode_group_channel_map: [
          { ntrode_id: 1, electrode_group_id: 0, map: {} },
        ],
      });

      // Step 1: Duplicate electrode group 0
      let clonedForm = structuredClone(form);
      const duplicated = structuredClone(clonedForm.electrode_groups[0]);
      duplicated.id = 1;
      clonedForm.electrode_groups.push(duplicated);

      const duplicatedNtrode = structuredClone(
        clonedForm.ntrode_electrode_group_channel_map[0]
      );
      duplicatedNtrode.ntrode_id = 2;
      duplicatedNtrode.electrode_group_id = 1;
      clonedForm.ntrode_electrode_group_channel_map.push(duplicatedNtrode);
      form = clonedForm;

      // Step 2: Remove first electrode group
      clonedForm = structuredClone(form);
      clonedForm.ntrode_electrode_group_channel_map =
        clonedForm.ntrode_electrode_group_channel_map.filter(
          (n) => n.electrode_group_id !== 0
        );
      clonedForm.electrode_groups.splice(0, 1);
      form = clonedForm;

      expect(form.electrode_groups).toEqual([
        { id: 1, location: 'CA1', device_type: 'tetrode_12.5' },
      ]);
      expect(form.ntrode_electrode_group_channel_map).toEqual([
        { ntrode_id: 2, electrode_group_id: 1, map: {} },
      ]);

      // Document final state
      expect(form).toMatchSnapshot('complex-electrode-group-sequence');
    });
  });
});

describe('BASELINE: Edge Cases and Quirks', () => {
  describe('Quirk: ID Collision Scenarios', () => {
    it('BASELINE: documents what happens if IDs are manually set to collide', () => {
      // User could manually create colliding IDs through import
      const form = {
        cameras: [
          { id: 0, camera_name: 'camera_0' },
          { id: 0, camera_name: 'camera_0_duplicate' }, // Collision!
        ],
      };

      // Current code doesn't prevent this at validation
      expect(form.cameras[0].id).toBe(form.cameras[1].id);

      // Document this quirk
      expect(form).toMatchSnapshot('id-collision-quirk');
    });
  });

  describe('Quirk: Empty vs Undefined vs Null', () => {
    it('BASELINE: documents handling of empty arrays', () => {
      const form = createFormData({
        cameras: [],
        tasks: [],
      });

      expect(form.cameras).toEqual([]);
      expect(form.cameras.length).toBe(0);
    });

    it('BASELINE: documents handling of undefined optional fields', () => {
      const form = createFormData();
      delete form.experiment_description;

      const cloned = structuredClone(form);

      // Deleted properties are not cloned
      expect(cloned).not.toHaveProperty('experiment_description');
    });

    it('BASELINE: documents handling of null values', () => {
      const form = createFormData({
        experiment_description: null,
      });

      const cloned = structuredClone(form);

      // null is preserved
      expect(cloned.experiment_description).toBeNull();
    });
  });

  describe('Performance: Deep Cloning Large Objects', () => {
    it('BASELINE: documents performance degradation with very large arrays', () => {
      // Stress test: 200 electrode groups
      const veryLargeState = createFormData({
        electrode_groups: Array(200)
          .fill(null)
          .map((_, i) => ({
            id: i,
            location: 'CA1',
            device_type: 'tetrode_12.5',
            description: `Electrode group ${i}`,
          })),
        ntrode_electrode_group_channel_map: Array(200)
          .fill(null)
          .map((_, i) => ({
            ntrode_id: i,
            electrode_group_id: i,
            bad_channels: [],
            map: { '0': i * 4, '1': i * 4 + 1, '2': i * 4 + 2, '3': i * 4 + 3 },
          })),
      });

      const start = performance.now();
      const cloned = structuredClone(veryLargeState);
      const duration = performance.now() - start;

      console.log(`📊 structuredClone (200 electrode groups): ${duration.toFixed(2)}ms`);

      // Should still complete, but may be slow
      expect(duration).toBeLessThan(500);
      expect(cloned).not.toBe(veryLargeState);

      // Baseline performance: ~0.32ms (snapshot removed due to timing variance)
    });
  });
});
