/**
 * @vitest-environment jsdom
 */

import { describe, it, expect } from 'vitest';

/**
 * Deep Cloning Behavior Tests
 *
 * These tests verify that structuredClone() properly performs deep cloning
 * at all nesting levels, ensuring no references leak between cloned objects.
 *
 * This is critical for preventing subtle bugs where modifying a "cloned"
 * object actually modifies the original due to shallow copying.
 *
 * Test Philosophy:
 * - Verify ALL nested levels are new references
 * - Test with realistic NWB metadata structures
 * - Cover edge cases (circular refs not supported by structuredClone)
 */

describe('Deep Cloning Behavior Tests', () => {
  describe('Nesting Level 1 - Shallow Objects', () => {
    it('clones flat object properties', () => {
      const original = {
        experimenter: 'Doe, John',
        session_id: 'test_001',
        institution: 'University',
        lab: 'Neuroscience Lab'
      };

      const cloned = structuredClone(original);

      // Top-level should be different
      expect(cloned).not.toBe(original);

      // Primitive values should match
      expect(cloned.experimenter).toBe(original.experimenter);
      expect(cloned.session_id).toBe(original.session_id);
    });

    it('clones flat arrays', () => {
      const original = {
        experimenter: ['Doe, John', 'Smith, Jane']
      };

      const cloned = structuredClone(original);

      // Array should be new reference
      expect(cloned.experimenter).not.toBe(original.experimenter);

      // Array contents should match
      expect(cloned.experimenter).toEqual(original.experimenter);
    });
  });

  describe('Nesting Level 2 - Single Nested Objects', () => {
    it('clones nested object properties', () => {
      const original = {
        subject: {
          subject_id: 'rat01',
          sex: 'M',
          weight: 300,
          description: 'Test subject'
        }
      };

      const cloned = structuredClone(original);

      // Both levels should be new references
      expect(cloned).not.toBe(original);
      expect(cloned.subject).not.toBe(original.subject);

      // Content should match
      expect(cloned.subject).toEqual(original.subject);

      // Modifying clone should not affect original
      cloned.subject.weight = 350;
      expect(original.subject.weight).toBe(300);
    });

    it('clones arrays of primitives', () => {
      const original = {
        experimenter: ['Doe, John', 'Smith, Jane', 'Brown, Bob']
      };

      const cloned = structuredClone(original);

      expect(cloned.experimenter).not.toBe(original.experimenter);

      // Modifying clone should not affect original
      cloned.experimenter.push('New, Experimenter');
      expect(original.experimenter).toHaveLength(3);
      expect(cloned.experimenter).toHaveLength(4);
    });

    it('clones arrays of objects', () => {
      const original = {
        cameras: [
          { id: 0, meters_per_pixel: 0.001, manufacturer: 'CamCo' },
          { id: 1, meters_per_pixel: 0.002, manufacturer: 'VidTech' }
        ]
      };

      const cloned = structuredClone(original);

      // Array and objects should be new references
      expect(cloned.cameras).not.toBe(original.cameras);
      expect(cloned.cameras[0]).not.toBe(original.cameras[0]);
      expect(cloned.cameras[1]).not.toBe(original.cameras[1]);

      // Modifying clone should not affect original
      cloned.cameras[0].meters_per_pixel = 0.005;
      expect(original.cameras[0].meters_per_pixel).toBe(0.001);
    });
  });

  describe('Nesting Level 3 - Deeply Nested Structures', () => {
    it('clones 3-level nested objects', () => {
      const original = {
        electrode_groups: [
          {
            id: 0,
            location: 'CA1',
            device_type: 'tetrode_12.5',
            description: {
              text: 'Primary recording site',
              notes: ['Note 1', 'Note 2']
            }
          }
        ]
      };

      const cloned = structuredClone(original);

      // All levels should be new references
      expect(cloned).not.toBe(original);
      expect(cloned.electrode_groups).not.toBe(original.electrode_groups);
      expect(cloned.electrode_groups[0]).not.toBe(original.electrode_groups[0]);
      expect(cloned.electrode_groups[0].description).not.toBe(
        original.electrode_groups[0].description
      );
      expect(cloned.electrode_groups[0].description.notes).not.toBe(
        original.electrode_groups[0].description.notes
      );

      // Modifying deep clone should not affect original
      cloned.electrode_groups[0].description.notes.push('Note 3');
      expect(original.electrode_groups[0].description.notes).toHaveLength(2);
    });

    it('clones complex ntrode channel maps', () => {
      const original = {
        ntrode_electrode_group_channel_map: [
          {
            ntrode_id: 0,
            electrode_group_id: 0,
            bad_channels: [1, 3],
            map: { 0: 0, 1: 1, 2: 2, 3: 3 }
          }
        ]
      };

      const cloned = structuredClone(original);

      // All levels should be new references
      expect(cloned.ntrode_electrode_group_channel_map).not.toBe(
        original.ntrode_electrode_group_channel_map
      );
      expect(cloned.ntrode_electrode_group_channel_map[0]).not.toBe(
        original.ntrode_electrode_group_channel_map[0]
      );
      expect(cloned.ntrode_electrode_group_channel_map[0].bad_channels).not.toBe(
        original.ntrode_electrode_group_channel_map[0].bad_channels
      );
      expect(cloned.ntrode_electrode_group_channel_map[0].map).not.toBe(
        original.ntrode_electrode_group_channel_map[0].map
      );

      // Modifying nested map should not affect original
      cloned.ntrode_electrode_group_channel_map[0].map[4] = 4;
      expect(original.ntrode_electrode_group_channel_map[0].map).not.toHaveProperty('4');
    });
  });

  describe('Nesting Level 4+ - Maximum Depth Structures', () => {
    it('clones 4+ level nested structures', () => {
      const original = {
        tasks: [
          {
            task_name: 'Sleep',
            task_description: 'Resting state',
            task_epochs: [
              {
                interval_list_name: 'epoch_01',
                notes: {
                  experimenter_notes: 'Good quality',
                  metadata: {
                    temperature: 22.5,
                    tags: ['baseline', 'control']
                  }
                }
              }
            ]
          }
        ]
      };

      const cloned = structuredClone(original);

      // Verify all 5 levels are new references
      expect(cloned).not.toBe(original); // Level 0
      expect(cloned.tasks).not.toBe(original.tasks); // Level 1
      expect(cloned.tasks[0]).not.toBe(original.tasks[0]); // Level 2
      expect(cloned.tasks[0].task_epochs).not.toBe(original.tasks[0].task_epochs); // Level 3
      expect(cloned.tasks[0].task_epochs[0]).not.toBe(original.tasks[0].task_epochs[0]); // Level 4
      expect(cloned.tasks[0].task_epochs[0].notes).not.toBe(
        original.tasks[0].task_epochs[0].notes
      ); // Level 5
      expect(cloned.tasks[0].task_epochs[0].notes.metadata).not.toBe(
        original.tasks[0].task_epochs[0].notes.metadata
      ); // Level 6
      expect(cloned.tasks[0].task_epochs[0].notes.metadata.tags).not.toBe(
        original.tasks[0].task_epochs[0].notes.metadata.tags
      ); // Level 7

      // Modifying deepest level should not affect original
      cloned.tasks[0].task_epochs[0].notes.metadata.tags.push('modified');
      expect(original.tasks[0].task_epochs[0].notes.metadata.tags).toHaveLength(2);
      expect(cloned.tasks[0].task_epochs[0].notes.metadata.tags).toHaveLength(3);
    });

    it('handles realistic full metadata structure', () => {
      // Realistic structure from actual NWB metadata
      const original = {
        experimenter: ['Doe, John'],
        lab: 'Neuroscience Lab',
        institution: 'University',
        subject: {
          subject_id: 'rat01',
          sex: 'M',
          weight: 300
        },
        electrode_groups: [
          {
            id: 0,
            location: 'CA1',
            device_type: 'tetrode_12.5'
          },
          {
            id: 1,
            location: 'CA3',
            device_type: 'tetrode_12.5'
          }
        ],
        ntrode_electrode_group_channel_map: [
          {
            ntrode_id: 0,
            electrode_group_id: 0,
            bad_channels: [],
            map: { 0: 0, 1: 1, 2: 2, 3: 3 }
          },
          {
            ntrode_id: 1,
            electrode_group_id: 1,
            bad_channels: [2],
            map: { 0: 4, 1: 5, 2: 6, 3: 7 }
          }
        ],
        cameras: [
          { id: 0, meters_per_pixel: 0.001 }
        ],
        tasks: [
          {
            task_name: 'Sleep',
            camera_id: [0],
            task_epochs: []
          }
        ]
      };

      const cloned = structuredClone(original);

      // Spot check various nesting levels
      expect(cloned).not.toBe(original);
      expect(cloned.subject).not.toBe(original.subject);
      expect(cloned.electrode_groups).not.toBe(original.electrode_groups);
      expect(cloned.electrode_groups[0]).not.toBe(original.electrode_groups[0]);
      expect(cloned.ntrode_electrode_group_channel_map[0].map).not.toBe(
        original.ntrode_electrode_group_channel_map[0].map
      );
      expect(cloned.cameras[0]).not.toBe(original.cameras[0]);
      expect(cloned.tasks[0]).not.toBe(original.tasks[0]);

      // Content should match
      expect(cloned).toEqual(original);
    });
  });

  describe('Mixed Type Deep Cloning', () => {
    it('clones objects containing arrays of arrays', () => {
      const original = {
        matrix: [
          [1, 2, 3],
          [4, 5, 6],
          [7, 8, 9]
        ]
      };

      const cloned = structuredClone(original);

      expect(cloned.matrix).not.toBe(original.matrix);
      expect(cloned.matrix[0]).not.toBe(original.matrix[0]);
      expect(cloned.matrix[1]).not.toBe(original.matrix[1]);
      expect(cloned.matrix[2]).not.toBe(original.matrix[2]);

      // Modify clone
      cloned.matrix[0][0] = 999;
      expect(original.matrix[0][0]).toBe(1);
    });

    it('clones objects with mixed primitives and objects', () => {
      const original = {
        string: 'test',
        number: 42,
        boolean: true,
        nullValue: null,
        undefinedValue: undefined,
        object: { nested: 'value' },
        array: [1, 2, 3]
      };

      const cloned = structuredClone(original);

      expect(cloned).not.toBe(original);
      expect(cloned.object).not.toBe(original.object);
      expect(cloned.array).not.toBe(original.array);

      // Primitives should be identical values
      expect(cloned.string).toBe(original.string);
      expect(cloned.number).toBe(original.number);
      expect(cloned.boolean).toBe(original.boolean);
      expect(cloned.nullValue).toBe(original.nullValue);
      expect(cloned.undefinedValue).toBe(original.undefinedValue);
    });

    it('clones Date objects deeply', () => {
      const original = {
        metadata: {
          timestamp: new Date('2025-01-23T10:00:00'),
          info: 'test'
        }
      };

      const cloned = structuredClone(original);

      expect(cloned.metadata).not.toBe(original.metadata);
      expect(cloned.metadata.timestamp).not.toBe(original.metadata.timestamp);
      expect(cloned.metadata.timestamp.getTime()).toBe(
        original.metadata.timestamp.getTime()
      );
    });
  });

  describe('Edge Cases and Boundaries', () => {
    it('clones empty nested structures', () => {
      const original = {
        emptyObject: {},
        emptyArray: [],
        nestedEmpty: {
          innerEmpty: {},
          innerArray: []
        }
      };

      const cloned = structuredClone(original);

      expect(cloned.emptyObject).not.toBe(original.emptyObject);
      expect(cloned.emptyArray).not.toBe(original.emptyArray);
      expect(cloned.nestedEmpty).not.toBe(original.nestedEmpty);
      expect(cloned.nestedEmpty.innerEmpty).not.toBe(original.nestedEmpty.innerEmpty);
      expect(cloned.nestedEmpty.innerArray).not.toBe(original.nestedEmpty.innerArray);
    });

    it('clones sparse arrays correctly', () => {
      const original = {
        sparse: [1, , 3, , 5] // eslint-disable-line no-sparse-arrays
      };

      const cloned = structuredClone(original);

      expect(cloned.sparse).not.toBe(original.sparse);
      expect(cloned.sparse).toHaveLength(5);
      expect(cloned.sparse[0]).toBe(1);
      expect(cloned.sparse[1]).toBe(undefined);
      expect(cloned.sparse[2]).toBe(3);
    });

    it('clones objects with numeric keys', () => {
      const original = {
        map: {
          0: 'zero',
          1: 'one',
          2: 'two'
        }
      };

      const cloned = structuredClone(original);

      expect(cloned.map).not.toBe(original.map);
      expect(cloned.map[0]).toBe('zero');
      expect(cloned.map[1]).toBe('one');
      expect(cloned.map[2]).toBe('two');
    });

    it('clones very large nested structures', () => {
      // Create a large structure (100 electrode groups with ntrode maps)
      const original = {
        electrode_groups: Array(100).fill(null).map((_, i) => ({
          id: i,
          location: `Region${i}`,
          device_type: 'tetrode_12.5'
        })),
        ntrode_electrode_group_channel_map: Array(100).fill(null).map((_, i) => ({
          ntrode_id: i,
          electrode_group_id: i,
          bad_channels: [],
          map: { 0: i * 4, 1: i * 4 + 1, 2: i * 4 + 2, 3: i * 4 + 3 }
        }))
      };

      const cloned = structuredClone(original);

      // Top-level arrays should be different
      expect(cloned.electrode_groups).not.toBe(original.electrode_groups);
      expect(cloned.ntrode_electrode_group_channel_map).not.toBe(
        original.ntrode_electrode_group_channel_map
      );

      // Spot check a few items
      expect(cloned.electrode_groups[0]).not.toBe(original.electrode_groups[0]);
      expect(cloned.electrode_groups[50]).not.toBe(original.electrode_groups[50]);
      expect(cloned.electrode_groups[99]).not.toBe(original.electrode_groups[99]);

      expect(cloned.ntrode_electrode_group_channel_map[0].map).not.toBe(
        original.ntrode_electrode_group_channel_map[0].map
      );

      // Content should match
      expect(cloned).toEqual(original);
    });

    it('preserves object property order', () => {
      const original = {
        z_field: 'third',
        a_field: 'first',
        m_field: 'second'
      };

      const cloned = structuredClone(original);

      const originalKeys = Object.keys(original);
      const clonedKeys = Object.keys(cloned);

      expect(clonedKeys).toEqual(originalKeys);
    });
  });

  describe('Mutation Isolation Tests', () => {
    it('modifying cloned nested object does not affect original', () => {
      const original = {
        electrode_groups: [
          { id: 0, location: 'CA1' },
          { id: 1, location: 'CA3' }
        ]
      };

      const cloned = structuredClone(original);

      // Modify clone
      cloned.electrode_groups[0].location = 'DG';
      cloned.electrode_groups.push({ id: 2, location: 'CA2' });

      // Original should be unchanged
      expect(original.electrode_groups[0].location).toBe('CA1');
      expect(original.electrode_groups).toHaveLength(2);
    });

    it('modifying cloned nested array does not affect original', () => {
      const original = {
        experimenter: ['Doe, John', 'Smith, Jane']
      };

      const cloned = structuredClone(original);

      // Modify clone
      cloned.experimenter[0] = 'Modified, Name';
      cloned.experimenter.push('New, Person');

      // Original should be unchanged
      expect(original.experimenter[0]).toBe('Doe, John');
      expect(original.experimenter).toHaveLength(2);
    });

    it('modifying cloned deep map does not affect original', () => {
      const original = {
        ntrode_electrode_group_channel_map: [
          {
            ntrode_id: 0,
            map: { 0: 0, 1: 1, 2: 2, 3: 3 }
          }
        ]
      };

      const cloned = structuredClone(original);

      // Modify clone's map
      cloned.ntrode_electrode_group_channel_map[0].map[0] = 999;
      delete cloned.ntrode_electrode_group_channel_map[0].map[3];
      cloned.ntrode_electrode_group_channel_map[0].map[4] = 4;

      // Original should be unchanged
      expect(original.ntrode_electrode_group_channel_map[0].map[0]).toBe(0);
      expect(original.ntrode_electrode_group_channel_map[0].map).toHaveProperty('3');
      expect(original.ntrode_electrode_group_channel_map[0].map).not.toHaveProperty('4');
    });

    it('multiple sequential clones maintain independence', () => {
      const original = { value: 1 };
      const clone1 = structuredClone(original);
      const clone2 = structuredClone(original);
      const clone3 = structuredClone(clone1);

      clone1.value = 2;
      clone2.value = 3;
      clone3.value = 4;

      expect(original.value).toBe(1);
      expect(clone1.value).toBe(2);
      expect(clone2.value).toBe(3);
      expect(clone3.value).toBe(4);
    });
  });
});
