/**
 * @file Tests for day state management in workspace
 *
 * Tests the day CRUD operations (create, read, update, delete) and
 * day-to-animal relationships. These tests follow TDD - they define
 * the expected API before implementation exists.
 *
 * Test Structure:
 * - Day Creation: Linking to parent animal
 * - Day Updates: Modify session metadata
 * - Day State: Draft/validated/exported workflow
 * - Day Deletion: Cleanup and parent updates
 *
 * @see docs/ANIMAL_WORKSPACE_DESIGN.md for data model
 */

import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useStore } from '../../../state/store';

describe('Day State Management', () => {
  /**
   * Helper to create a test animal
   * @param result
   * @param animalId
   */
  function createTestAnimal(result, animalId = 'remy') {
    act(() => {
      result.current.actions.createAnimal(animalId, {
        species: 'Rattus norvegicus',
        sex: 'M',
        genotype: 'Wild Type',
        date_of_birth: '2023-01-10T00:00:00Z',
        description: 'Test subject',
      }, {
        devices: {
          data_acq_device: [
            { name: 'SpikeGadgets', system: 'SpikeGadgets', amplifier: 'Intan', adc_circuit: 'Intan' }
          ],
          device: { name: ['Trodes'] },
          electrode_groups: [
            { id: 0, location: 'CA1', device_type: 'tetrode_12.5', description: 'CA1 tetrode' }
          ],
          ntrode_electrode_group_channel_map: [
            { ntrode_id: 0, electrode_group_id: 0, map: { 0: 0, 1: 1, 2: 2, 3: 3 }, bad_channels: [] }
          ],
        },
        cameras: [
          { id: 0, meters_per_pixel: 0.00085, manufacturer: 'Allied Vision', model: 'Mako G-158' }
        ],
        experimenters: {
          experimenter_name: ['Guidera, Jennifer'],
          lab: 'Frank',
          institution: 'University of California, San Francisco',
        },
      });
    });
  }

  describe('createDay', () => {
    it('creates day with minimal required fields', () => {
      const { result } = renderHook(() => useStore());
      createTestAnimal(result);

      act(() => {
        result.current.actions.createDay('remy', '2023-06-22', {
          session_id: 'remy_20230622',
          session_description: 'Day 1 test session',
        });
      });

      const day = result.current.model.workspace.days['remy-2023-06-22'];
      const animal = result.current.model.workspace.animals['remy'];

      expect(day).toBeDefined();
      expect(day.id).toBe('remy-2023-06-22');
      expect(day.animalId).toBe('remy');
      expect(day.date).toBe('2023-06-22');
      expect(day.experimentDate).toBe('06222023'); // mmddYYYY format
      expect(day.session.session_id).toBe('remy_20230622');
      expect(day.session.session_description).toBe('Day 1 test session');
      expect(day.state.draft).toBe(true);
      expect(day.state.validated).toBe(false);
      expect(day.state.exported).toBe(false);
      expect(day.configurationVersion).toBe(1); // Uses animal's latest config
      expect(day.created).toMatch(/^\d{4}-\d{2}-\d{2}T/);
      expect(animal.days).toContain('remy-2023-06-22');
    });

    it('creates day with full session metadata', () => {
      const { result } = renderHook(() => useStore());
      createTestAnimal(result);

      act(() => {
        result.current.actions.createDay('remy', '2023-06-22', {
          session_id: 'remy_20230622',
          session_description: 'W-track spatial alternation',
          experiment_description: 'Chronic recording experiment',
          weight: 485,
        });
      });

      const day = result.current.model.workspace.days['remy-2023-06-22'];

      expect(day.session.experiment_description).toBe('Chronic recording experiment');
      expect(day.session.weight).toBe(485);
    });

    it('initializes day with empty arrays for tasks and files', () => {
      const { result } = renderHook(() => useStore());
      createTestAnimal(result);

      act(() => {
        result.current.actions.createDay('remy', '2023-06-22', {
          session_id: 'remy_20230622',
          session_description: 'Test',
        });
      });

      const day = result.current.model.workspace.days['remy-2023-06-22'];

      expect(day.tasks).toEqual([]);
      expect(day.behavioral_events).toEqual([]);
      expect(day.associated_files).toEqual([]);
      expect(day.associated_video_files).toEqual([]);
    });

    it('initializes technical parameters with defaults', () => {
      const { result } = renderHook(() => useStore());
      createTestAnimal(result);

      act(() => {
        result.current.actions.createDay('remy', '2023-06-22', {
          session_id: 'remy_20230622',
          session_description: 'Test',
        });
      });

      const day = result.current.model.workspace.days['remy-2023-06-22'];

      expect(day.technical.times_period_multiplier).toBe(1.5);
      expect(day.technical.raw_data_to_volts).toBe(0.195);
      expect(day.technical.default_header_file_path).toBe('');
    });

    it('adds day ID to animal.days array', () => {
      const { result } = renderHook(() => useStore());
      createTestAnimal(result);

      act(() => {
        result.current.actions.createDay('remy', '2023-06-22', {
          session_id: 'remy_20230622',
          session_description: 'Day 1',
        });

        result.current.actions.createDay('remy', '2023-06-23', {
          session_id: 'remy_20230623',
          session_description: 'Day 2',
        });
      });

      const animal = result.current.model.workspace.animals['remy'];

      expect(animal.days).toEqual(['remy-2023-06-22', 'remy-2023-06-23']);
    });

    it('throws error if animal does not exist', () => {
      const { result } = renderHook(() => useStore());

      expect(() => {
        act(() => {
          result.current.actions.createDay('nonexistent', '2023-06-22', {
            session_id: 'test',
            session_description: 'Test',
          });
        });
      }).toThrow(/animal.*not found/i);
    });

    it('throws error if day ID already exists', () => {
      const { result } = renderHook(() => useStore());
      createTestAnimal(result);

      act(() => {
        result.current.actions.createDay('remy', '2023-06-22', {
          session_id: 'remy_20230622',
          session_description: 'First day',
        });
      });

      expect(() => {
        act(() => {
          result.current.actions.createDay('remy', '2023-06-22', {
            session_id: 'duplicate',
            session_description: 'Duplicate day',
          });
        });
      }).toThrow(/already exists/i);
    });

    it('uses latest configuration version from animal', () => {
      const { result } = renderHook(() => useStore());
      createTestAnimal(result);

      // Add a second configuration
      act(() => {
        result.current.actions.addConfigurationSnapshot('remy', {
          date: '2023-06-15',
          description: 'Adjusted probes',
          devices: {
            electrode_groups: [
              { id: 0, location: 'CA1', device_type: 'tetrode_12.5', description: 'CA1 tetrode adjusted' }
            ],
            ntrode_electrode_group_channel_map: [
              { ntrode_id: 0, electrode_group_id: 0, map: { 0: 0, 1: 1, 2: 2, 3: 3 }, bad_channels: [] }
            ],
          },
        });
      });

      act(() => {
        result.current.actions.createDay('remy', '2023-06-22', {
          session_id: 'remy_20230622',
          session_description: 'Test',
        });
      });

      const day = result.current.model.workspace.days['remy-2023-06-22'];

      expect(day.configurationVersion).toBe(2); // Latest version
    });
  });

  describe('updateDay', () => {
    it('updates session metadata', () => {
      const { result } = renderHook(() => useStore());
      createTestAnimal(result);

      act(() => {
        result.current.actions.createDay('remy', '2023-06-22', {
          session_id: 'remy_20230622',
          session_description: 'Original description',
        });
      });

      act(() => {
        result.current.actions.updateDay('remy-2023-06-22', {
          session: {
            session_description: 'Updated description',
            experiment_description: 'Added experiment description',
          },
        });
      });

      const day = result.current.model.workspace.days['remy-2023-06-22'];

      expect(day.session.session_description).toBe('Updated description');
      expect(day.session.experiment_description).toBe('Added experiment description');
      expect(day.session.session_id).toBe('remy_20230622'); // Unchanged
    });

    it('updates tasks array', () => {
      const { result } = renderHook(() => useStore());
      createTestAnimal(result);

      act(() => {
        result.current.actions.createDay('remy', '2023-06-22', {
          session_id: 'remy_20230622',
          session_description: 'Test',
        });
      });

      act(() => {
        result.current.actions.updateDay('remy-2023-06-22', {
          tasks: [
            { task_name: 'sleep', task_description: 'Sleep epoch', task_epochs: [0] },
            { task_name: 'run', task_description: 'W-track', task_epochs: [1, 2] },
          ],
        });
      });

      const day = result.current.model.workspace.days['remy-2023-06-22'];

      expect(day.tasks).toHaveLength(2);
      expect(day.tasks[0].task_name).toBe('sleep');
      expect(day.tasks[1].task_epochs).toEqual([1, 2]);
    });

    it('updates day state (validation status)', () => {
      const { result } = renderHook(() => useStore());
      createTestAnimal(result);

      act(() => {
        result.current.actions.createDay('remy', '2023-06-22', {
          session_id: 'remy_20230622',
          session_description: 'Test',
        });
      });

      act(() => {
        result.current.actions.updateDay('remy-2023-06-22', {
          state: {
            draft: false,
            validated: true,
            exported: false,
          },
        });
      });

      const day = result.current.model.workspace.days['remy-2023-06-22'];

      expect(day.state.draft).toBe(false);
      expect(day.state.validated).toBe(true);
      expect(day.state.exported).toBe(false);
    });

    it('updates lastModified timestamp', () => {
      const { result } = renderHook(() => useStore());
      createTestAnimal(result);

      act(() => {
        result.current.actions.createDay('remy', '2023-06-22', {
          session_id: 'remy_20230622',
          session_description: 'Test',
        });
      });

      const originalTimestamp = result.current.model.workspace.days['remy-2023-06-22'].lastModified;

      act(() => {
        result.current.actions.updateDay('remy-2023-06-22', {
          session: { session_description: 'Updated' },
        });
      });

      const newTimestamp = result.current.model.workspace.days['remy-2023-06-22'].lastModified;
      // Timestamp should exist and be a valid ISO string
      expect(newTimestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);
      // Should be greater than or equal to original (updates can be very fast)
      expect(newTimestamp >= originalTimestamp).toBe(true);
    });

    it('throws error if day does not exist', () => {
      const { result } = renderHook(() => useStore());

      expect(() => {
        act(() => {
          result.current.actions.updateDay('nonexistent-2023-06-22', {
            session: { session_description: 'Test' },
          });
        });
      }).toThrow(/day.*not found/i);
    });
  });

  describe('deleteDay', () => {
    it('deletes day and removes from animal.days array', () => {
      const { result } = renderHook(() => useStore());
      createTestAnimal(result);

      act(() => {
        result.current.actions.createDay('remy', '2023-06-22', {
          session_id: 'remy_20230622',
          session_description: 'Day 1',
        });

        result.current.actions.createDay('remy', '2023-06-23', {
          session_id: 'remy_20230623',
          session_description: 'Day 2',
        });
      });

      act(() => {
        result.current.actions.deleteDay('remy-2023-06-22');
      });

      const animal = result.current.model.workspace.animals['remy'];

      expect(result.current.model.workspace.days['remy-2023-06-22']).toBeUndefined();
      expect(result.current.model.workspace.days['remy-2023-06-23']).toBeDefined();
      expect(animal.days).toEqual(['remy-2023-06-23']);
    });

    it('throws error if day does not exist', () => {
      const { result } = renderHook(() => useStore());

      expect(() => {
        act(() => {
          result.current.actions.deleteDay('nonexistent-2023-06-22');
        });
      }).toThrow(/day.*not found/i);
    });
  });

  describe('workspace.days selector', () => {
    it('returns empty object initially', () => {
      const { result } = renderHook(() => useStore());

      expect(result.current.model.workspace.days).toEqual({});
    });

    it('returns all days keyed by ID', () => {
      const { result } = renderHook(() => useStore());
      createTestAnimal(result, 'remy');
      createTestAnimal(result, 'bean');

      act(() => {
        result.current.actions.createDay('remy', '2023-06-22', {
          session_id: 'remy_20230622',
          session_description: 'Remy day 1',
        });

        result.current.actions.createDay('bean', '2023-07-01', {
          session_id: 'bean_20230701',
          session_description: 'Bean day 1',
        });
      });

      const days = result.current.model.workspace.days;

      expect(Object.keys(days)).toEqual(['remy-2023-06-22', 'bean-2023-07-01']);
      expect(days['remy-2023-06-22'].animalId).toBe('remy');
      expect(days['bean-2023-07-01'].animalId).toBe('bean');
    });
  });

  describe('getAnimalDays selector', () => {
    it('returns days for specific animal', () => {
      const { result } = renderHook(() => useStore());
      createTestAnimal(result, 'remy');
      createTestAnimal(result, 'bean');

      act(() => {
        result.current.actions.createDay('remy', '2023-06-22', {
          session_id: 'remy_20230622',
          session_description: 'Remy day 1',
        });

        result.current.actions.createDay('remy', '2023-06-23', {
          session_id: 'remy_20230623',
          session_description: 'Remy day 2',
        });

        result.current.actions.createDay('bean', '2023-07-01', {
          session_id: 'bean_20230701',
          session_description: 'Bean day 1',
        });
      });

      const remyDays = result.current.selectors.getAnimalDays('remy');

      expect(remyDays).toHaveLength(2);
      expect(remyDays[0].id).toBe('remy-2023-06-22');
      expect(remyDays[1].id).toBe('remy-2023-06-23');
    });

    it('returns empty array if animal has no days', () => {
      const { result } = renderHook(() => useStore());
      createTestAnimal(result);

      const days = result.current.selectors.getAnimalDays('remy');

      expect(days).toEqual([]);
    });

    it('returns days sorted by date', () => {
      const { result } = renderHook(() => useStore());
      createTestAnimal(result);

      act(() => {
        result.current.actions.createDay('remy', '2023-06-25', {
          session_id: 'remy_20230625',
          session_description: 'Day 3',
        });

        result.current.actions.createDay('remy', '2023-06-22', {
          session_id: 'remy_20230622',
          session_description: 'Day 1',
        });

        result.current.actions.createDay('remy', '2023-06-24', {
          session_id: 'remy_20230624',
          session_description: 'Day 2',
        });
      });

      const days = result.current.selectors.getAnimalDays('remy');

      expect(days[0].date).toBe('2023-06-22');
      expect(days[1].date).toBe('2023-06-24');
      expect(days[2].date).toBe('2023-06-25');
    });
  });
});
