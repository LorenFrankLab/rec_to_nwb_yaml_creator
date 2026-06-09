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
import { mergeDayMetadata } from '../../../state/workspaceUtils';
import { encodeYaml } from '../../../io/yaml';

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

    it('with carryForwardFromDayId: new day copies the prior day tasks', () => {
      const { result } = renderHook(() => useStore());
      createTestAnimal(result);

      act(() => {
        result.current.actions.createDay('remy', '2023-06-22', {
          session_id: 'remy_20230622',
          session_description: 'Day 1',
        });
      });
      // Give the prior day some carryable content.
      act(() => {
        result.current.actions.updateDay('remy-2023-06-22', {
          tasks: [{ task_name: 'W-track', task_epochs: [1] }],
        });
      });
      act(() => {
        result.current.actions.createDay(
          'remy',
          '2023-06-23',
          { session_id: 'remy_20230623', session_description: 'Day 2' },
          { carryForwardFromDayId: 'remy-2023-06-22' }
        );
      });

      const day2 = result.current.model.workspace.days['remy-2023-06-23'];
      expect(day2.tasks).toEqual([{ task_name: 'W-track', task_epochs: [1] }]);
    });

    it('with no options: new day tasks stay empty (back-compat)', () => {
      const { result } = renderHook(() => useStore());
      createTestAnimal(result);
      act(() => {
        result.current.actions.createDay('remy', '2023-06-22', {
          session_id: 'remy_20230622',
          session_description: 'Day 1',
        });
      });
      act(() => {
        result.current.actions.updateDay('remy-2023-06-22', {
          tasks: [{ task_name: 'W-track', task_epochs: [1] }],
        });
      });
      act(() => {
        result.current.actions.createDay('remy', '2023-06-23', {
          session_id: 'remy_20230623',
          session_description: 'Day 2',
        });
      });
      expect(result.current.model.workspace.days['remy-2023-06-23'].tasks).toEqual([]);
    });

    it('with an unknown carryForwardFromDayId: builds a blank day (no throw)', () => {
      const { result } = renderHook(() => useStore());
      createTestAnimal(result);
      act(() => {
        result.current.actions.createDay(
          'remy',
          '2023-06-23',
          { session_id: 'remy_20230623', session_description: 'Day 2' },
          { carryForwardFromDayId: 'remy-9999-99-99' }
        );
      });
      expect(result.current.model.workspace.days['remy-2023-06-23'].tasks).toEqual([]);
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

      // Add a second configuration (atomic action, applied to no existing days → just appends v2)
      act(() => {
        result.current.actions.createConfigurationSnapshotAndApplyForward('remy', {
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
        }, []);
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

    it('persists keywords (the Overview keywords editor writes through updateDay)', () => {
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
          keywords: ['spatial', 'w-track'],
        });
      });

      expect(result.current.model.workspace.days['remy-2023-06-22'].keywords).toEqual([
        'spatial',
        'w-track',
      ]);

      // An explicit empty array clears keywords; an unrelated update preserves them.
      act(() => {
        result.current.actions.updateDay('remy-2023-06-22', { keywords: [] });
      });
      expect(result.current.model.workspace.days['remy-2023-06-22'].keywords).toEqual([]);

      act(() => {
        result.current.actions.updateDay('remy-2023-06-22', { keywords: ['replay'] });
        result.current.actions.updateDay('remy-2023-06-22', {
          session: { session_description: 'edited' },
        });
      });
      expect(result.current.model.workspace.days['remy-2023-06-22'].keywords).toEqual(['replay']);
    });

    it('persists data_acq_device_name through updateDay and clears it back to undefined', () => {
      const { result } = renderHook(() => useStore());
      createTestAnimal(result);

      act(() => {
        result.current.actions.createDay('remy', '2023-06-22', {
          session_id: 'remy_20230622',
          session_description: 'Test',
        });
      });

      act(() => {
        result.current.actions.updateDay('remy-2023-06-22', { data_acq_device_name: 'X' });
      });
      expect(result.current.model.workspace.days['remy-2023-06-22'].data_acq_device_name).toBe('X');

      // Clearing to undefined (the "Default" option) persists, reverting to the animal default.
      act(() => {
        result.current.actions.updateDay('remy-2023-06-22', { data_acq_device_name: undefined });
      });
      expect(
        result.current.model.workspace.days['remy-2023-06-22'].data_acq_device_name
      ).toBeUndefined();
    });

    it('persists cameras_used through updateDay (the explicit cameras-used checklist)', () => {
      const { result } = renderHook(() => useStore());
      createTestAnimal(result);

      act(() => {
        result.current.actions.createDay('remy', '2023-06-22', {
          session_id: 'remy_20230622',
          session_description: 'Test',
        });
      });

      act(() => {
        result.current.actions.updateDay('remy-2023-06-22', { cameras_used: [1] });
      });
      expect(result.current.model.workspace.days['remy-2023-06-22'].cameras_used).toEqual([1]);
    });

    it('replaces a malformed (non-record) current session instead of spreading it', () => {
      // A corrupt import can persist `session` as a scalar/array. A session update must not
      // spread that (`{...'corrupt'}` would scatter char-indexed keys into the record); the
      // merge guards the current value to a record first, so the reset writes cleanly.
      const { result } = renderHook(() => useStore());
      createTestAnimal(result);
      act(() => {
        result.current.actions.createDay('remy', '2023-06-22', {
          session_id: 'remy_20230622',
          session_description: 'Test',
        });
      });
      // Corrupt the persisted session, then update it.
      act(() => {
        result.current.model.workspace.days['remy-2023-06-22'].session = 'corrupt';
        result.current.actions.updateDay('remy-2023-06-22', {
          session: { session_id: 'remy_20230622' },
        });
      });
      expect(result.current.model.workspace.days['remy-2023-06-22'].session).toEqual({
        session_id: 'remy_20230622',
      });
    });

    it('persists fs_gui_yamls (the merge reads them, so a reset must write through)', () => {
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
          fs_gui_yamls: [{ name: 'protocol.yml', epochs: [1] }],
        });
      });
      expect(result.current.model.workspace.days['remy-2023-06-22'].fs_gui_yamls).toEqual([
        { name: 'protocol.yml', epochs: [1] },
      ]);

      // An explicit empty array clears them (the resetDayCollection repair path).
      act(() => {
        result.current.actions.updateDay('remy-2023-06-22', { fs_gui_yamls: [] });
      });
      expect(result.current.model.workspace.days['remy-2023-06-22'].fs_gui_yamls).toEqual([]);
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

    it('cleans the owning animal index for a corrupt day whose record has no animalId', () => {
      // A corrupt/partial import can leave a day indexed under its animal with NO `animalId` on
      // the record (the index is the authority — dayRecovery classifies it OK). deleteDay must
      // still remove the id from the owning animal's index and must NOT write a junk
      // `animals[undefined]`/`animals["undefined"]` entry or leave a dangling reference.
      const initialState = {
        workspace: {
          animals: {
            remy: {
              id: 'remy',
              subject: { subject_id: 'remy' },
              days: ['remy-2023-06-22', 'remy-2023-06-23'],
            },
          },
          days: {
            // No animalId on the record being deleted (the corrupt shape).
            'remy-2023-06-22': { id: 'remy-2023-06-22', date: '2023-06-22', session: { session_id: 's1' } },
            'remy-2023-06-23': { id: 'remy-2023-06-23', animalId: 'remy', date: '2023-06-23', session: { session_id: 's2' } },
          },
          settings: {},
        },
      };
      const { result } = renderHook(() => useStore(initialState));

      act(() => {
        result.current.actions.deleteDay('remy-2023-06-22', 'remy');
      });

      const { animals, days } = result.current.model.workspace;
      // Record gone, sibling intact.
      expect(days['remy-2023-06-22']).toBeUndefined();
      expect(days['remy-2023-06-23']).toBeDefined();
      // No dangling reference left in the owning animal's index.
      expect(animals.remy.days).toEqual(['remy-2023-06-23']);
      // No junk animal keyed by the missing animalId.
      expect(animals).not.toHaveProperty('undefined');
      expect(Object.keys(animals)).toEqual(['remy']);
    });
  });

  describe('relinkDayReference', () => {
    it('re-links an orphaned record (present in days, not in the index) back into the animal', () => {
      const { result } = renderHook(() => useStore());
      createTestAnimal(result);
      act(() => {
        result.current.actions.createDay('remy', '2023-06-22', {
          session_id: 'remy_20230622',
          session_description: 'Day 1',
        });
      });
      // Orphan it: the record stays in days, but the animal index drops it.
      act(() => {
        result.current.model.workspace.animals['remy'].days = [];
        result.current.actions.relinkDayReference('remy', 'remy-2023-06-22');
      });
      expect(result.current.model.workspace.animals['remy'].days).toEqual(['remy-2023-06-22']);
    });

    it('is a no-op for an unknown animal, a missing record, or an already-linked id', () => {
      const { result } = renderHook(() => useStore());
      createTestAnimal(result);
      act(() => {
        result.current.actions.createDay('remy', '2023-06-22', {
          session_id: 'remy_20230622',
          session_description: 'Day 1',
        });
      });
      expect(() => {
        act(() => {
          result.current.actions.relinkDayReference('ghost', 'x'); // unknown animal
          result.current.actions.relinkDayReference('remy', 'no-such-day'); // missing record
          result.current.actions.relinkDayReference('remy', 'remy-2023-06-22'); // already linked
        });
      }).not.toThrow();
      // The already-linked id is not duplicated.
      expect(result.current.model.workspace.animals['remy'].days).toEqual(['remy-2023-06-22']);
    });
  });

  describe('unlinkDayReference', () => {
    it('drops a genuine wrong-owner reference from the index but KEEPS the record for its real owner', () => {
      const { result } = renderHook(() => useStore());
      createTestAnimal(result, 'remy');
      createTestAnimal(result, 'bean');
      act(() => {
        result.current.actions.createDay('remy', '2023-06-22', {
          session_id: 'remy_20230622',
          session_description: 'Day 1',
        });
      });
      // Wrong-owner: bean's index lists remy's day record (record.animalId === 'remy').
      act(() => {
        result.current.model.workspace.animals['bean'].days = ['remy-2023-06-22'];
        result.current.actions.unlinkDayReference('bean', 'remy-2023-06-22');
      });
      // The misfiled reference is gone from bean...
      expect(result.current.model.workspace.animals['bean'].days).toEqual([]);
      // ...but the record itself survives intact for remy, its true owner.
      const record = result.current.model.workspace.days['remy-2023-06-22'];
      expect(record).toBeDefined();
      expect(record.animalId).toBe('remy');
    });

    it('is a no-op for a valid owned day — it must never strand a day this animal owns', () => {
      const { result } = renderHook(() => useStore());
      createTestAnimal(result, 'remy');
      act(() => {
        result.current.actions.createDay('remy', '2023-06-22', {
          session_id: 'remy_20230622',
          session_description: 'Day 1',
        });
      });
      // An accidental unlink on remy's OWN day (record.animalId === 'remy') must not remove it.
      act(() => {
        result.current.actions.unlinkDayReference('remy', 'remy-2023-06-22');
      });
      expect(result.current.model.workspace.animals['remy'].days).toEqual(['remy-2023-06-22']);
      expect(result.current.model.workspace.days['remy-2023-06-22']).toBeDefined();
    });

    it('is a no-op for an unknown animal or an id not in the index (no throw)', () => {
      const { result } = renderHook(() => useStore());
      createTestAnimal(result, 'remy');
      act(() => {
        result.current.actions.createDay('remy', '2023-06-22', {
          session_id: 'remy_20230622',
          session_description: 'Day 1',
        });
      });
      expect(() => {
        act(() => {
          result.current.actions.unlinkDayReference('ghost', 'x'); // unknown animal
          result.current.actions.unlinkDayReference('remy', 'no-such-day'); // not in index
        });
      }).not.toThrow();
      expect(result.current.model.workspace.animals['remy'].days).toEqual(['remy-2023-06-22']);
    });
  });

  describe('removeDayReference', () => {
    it('removes a dangling day reference (missing record) from the animal without throwing', () => {
      const { result } = renderHook(() => useStore());
      createTestAnimal(result);
      act(() => {
        result.current.actions.createDay('remy', '2023-06-22', {
          session_id: 'remy_20230622',
          session_description: 'Day 1',
        });
      });
      // Simulate a dangling reference: the animal points at a day id with no record.
      act(() => {
        result.current.model.workspace.animals['remy'].days = ['remy-2023-06-22', 'remy-2099-01-01'];
        result.current.actions.removeDayReference('remy', 'remy-2099-01-01');
      });
      const animal = result.current.model.workspace.animals['remy'];
      expect(animal.days).toEqual(['remy-2023-06-22']);
    });

    it('also drops a corrupt (non-record) leftover day record while removing the reference', () => {
      const { result } = renderHook(() => useStore());
      createTestAnimal(result);
      act(() => {
        result.current.actions.createDay('remy', '2023-06-22', {
          session_id: 'remy_20230622',
          session_description: 'Day 1',
        });
      });
      act(() => {
        // A truthy-but-non-record leftover survives as a dangling, unrepairable record.
        result.current.model.workspace.days['remy-2023-06-22'] = 'corrupt-leftover-string';
        result.current.actions.removeDayReference('remy', 'remy-2023-06-22');
      });
      expect(result.current.model.workspace.days['remy-2023-06-22']).toBeUndefined();
      expect(result.current.model.workspace.animals['remy'].days).toEqual([]);
    });

    it('is a no-op for an unknown animal (no throw)', () => {
      const { result } = renderHook(() => useStore());
      expect(() => {
        act(() => {
          result.current.actions.removeDayReference('ghost', 'ghost-2023-06-22');
        });
      }).not.toThrow();
    });

    it('normalizes a corrupt (non-record) days map to {} instead of spreading it', () => {
      const { result } = renderHook(() => useStore());
      createTestAnimal(result);
      act(() => {
        result.current.actions.createDay('remy', '2023-06-22', {
          session_id: 'remy_20230622',
          session_description: 'Day 1',
        });
      });
      // The whole days map is corrupt (a non-record). Removing a dangling ref must not spread
      // the string into a char-indexed object — it normalizes the map to {}.
      act(() => {
        result.current.model.workspace.days = 'corrupt-whole-map';
        result.current.actions.removeDayReference('remy', 'remy-2023-06-22');
      });
      expect(result.current.model.workspace.days).toEqual({});
      expect(result.current.model.workspace.animals['remy'].days).toEqual([]);
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

    it('excludes a wrong-owner record (indexed here but belonging to another animal)', () => {
      const { result } = renderHook(() => useStore());
      createTestAnimal(result);
      act(() => {
        result.current.actions.createDay('remy', '2023-06-22', {
          session_id: 'remy_20230622',
          session_description: 'Day 1',
        });
      });
      // Corrupt the index: remy lists a day whose record belongs to a different animal.
      act(() => {
        result.current.model.workspace.days['intruder'] = {
          id: 'intruder',
          animalId: 'someoneelse',
          date: '2023-06-23',
          session: { session_id: 'x' },
        };
        result.current.model.workspace.animals['remy'].days = ['remy-2023-06-22', 'intruder'];
      });
      const days = result.current.selectors.getAnimalDays('remy');
      // Only remy's own day is returned — the wrong-owner record must NOT be reconfigurable here.
      expect(days.map((d) => d.id)).toEqual(['remy-2023-06-22']);
    });

    it('excludes a record whose animalId is a non-string (object) — treated as wrong-owner, not ours', () => {
      const { result } = renderHook(() => useStore());
      createTestAnimal(result);
      act(() => {
        result.current.actions.createDay('remy', '2023-06-22', {
          session_id: 'remy_20230622',
          session_description: 'Day 1',
        });
      });
      // A corrupt import: the indexed record's animalId is an object (≠ the string store key 'remy').
      act(() => {
        result.current.model.workspace.days['intruder'] = {
          id: 'intruder',
          animalId: { not: 'a string' },
          date: '2023-06-23',
          session: { session_id: 'x' },
        };
        result.current.model.workspace.animals['remy'].days = ['remy-2023-06-22', 'intruder'];
      });
      const days = result.current.selectors.getAnimalDays('remy');
      expect(days.map((d) => d.id)).toEqual(['remy-2023-06-22']);
    });
  });

  describe('duplicateDay', () => {
    /**
     * Seed a source day with carryable day-owned content plus bad-channel overrides.
     * @param result
     * @param dayId
     */
    function seedSourceDay(result, dayId = 'remy-2023-06-22') {
      act(() => {
        result.current.actions.updateDay(dayId, {
          tasks: [{ task_name: 'W-track', task_epochs: [1] }],
          behavioral_events: [{ description: 'Din1', name: 'light1' }],
          keywords: ['spatial', 'w-track'],
          technical: { times_period_multiplier: 2.5, raw_data_to_volts: 0.42 },
          session: { experiment_description: 'Chronic recording', weight: 485 },
          deviceOverrides: {
            bad_channels: { 0: [2, 3] },
          },
        });
      });
    }

    it('clones day-owned content (cloned, not aliased) into the new day', () => {
      const { result } = renderHook(() => useStore());
      createTestAnimal(result);
      act(() => {
        result.current.actions.createDay('remy', '2023-06-22', {
          session_id: 'remy_20230622',
          session_description: 'Day 1',
        });
      });
      seedSourceDay(result);

      act(() => {
        result.current.actions.duplicateDay('remy-2023-06-22', '2023-06-23');
      });

      const source = result.current.model.workspace.days['remy-2023-06-22'];
      const dup = result.current.model.workspace.days['remy-2023-06-23'];

      expect(dup).toBeDefined();
      expect(dup.tasks).toEqual(source.tasks);
      expect(dup.behavioral_events).toEqual(source.behavioral_events);
      expect(dup.keywords).toEqual(source.keywords);
      expect(dup.technical.times_period_multiplier).toBe(2.5);
      expect(dup.technical.raw_data_to_volts).toBe(0.42);
      expect(dup.session.experiment_description).toBe('Chronic recording');
      expect(dup.session.weight).toBe(485);

      // Cloned, not aliased: mutating the duplicate must not touch the source.
      expect(dup.tasks).not.toBe(source.tasks);
      expect(dup.behavioral_events).not.toBe(source.behavioral_events);
      dup.tasks[0].task_name = 'CHANGED';
      expect(source.tasks[0].task_name).toBe('W-track');
    });

    it('pins the SOURCE configuration version, not the latest', () => {
      const { result } = renderHook(() => useStore());
      createTestAnimal(result);
      // Source day is created against version 1.
      act(() => {
        result.current.actions.createDay('remy', '2023-06-22', {
          session_id: 'remy_20230622',
          session_description: 'Day 1',
        });
      });
      // Add a version 2 (applied to no days) so the animal's LATEST is now 2,
      // while the source day stays pinned to 1.
      act(() => {
        result.current.actions.createConfigurationSnapshotAndApplyForward('remy', {
          date: '2023-06-15',
          description: 'Adjusted probes',
          devices: {
            electrode_groups: [
              { id: 0, location: 'CA1', device_type: 'tetrode_12.5', description: 'adjusted' },
            ],
            ntrode_electrode_group_channel_map: [
              { ntrode_id: 0, electrode_group_id: 0, map: { 0: 0, 1: 1, 2: 2, 3: 3 }, bad_channels: [] },
            ],
          },
        }, []);
      });

      expect(result.current.model.workspace.days['remy-2023-06-22'].configurationVersion).toBe(1);

      act(() => {
        result.current.actions.duplicateDay('remy-2023-06-22', '2023-06-23');
      });

      // The duplicate is the SAME version as its source (1), NOT the latest (2).
      expect(result.current.model.workspace.days['remy-2023-06-23'].configurationVersion).toBe(1);
    });

    it('carries bad-channel overrides (cloned, not aliased) even from a non-latest source', () => {
      const { result } = renderHook(() => useStore());
      createTestAnimal(result);
      act(() => {
        result.current.actions.createDay('remy', '2023-06-22', {
          session_id: 'remy_20230622',
          session_description: 'Day 1',
        });
      });
      seedSourceDay(result);
      // Fork a later version so the source is non-latest.
      act(() => {
        result.current.actions.createConfigurationSnapshotAndApplyForward('remy', {
          date: '2023-06-15',
          description: 'Adjusted probes',
          devices: {
            electrode_groups: [
              { id: 0, location: 'CA1', device_type: 'tetrode_12.5', description: 'adjusted' },
            ],
            ntrode_electrode_group_channel_map: [
              { ntrode_id: 0, electrode_group_id: 0, map: { 0: 0, 1: 1, 2: 2, 3: 3 }, bad_channels: [] },
            ],
          },
        }, []);
      });

      act(() => {
        result.current.actions.duplicateDay('remy-2023-06-22', '2023-06-23');
      });

      const source = result.current.model.workspace.days['remy-2023-06-22'];
      const dup = result.current.model.workspace.days['remy-2023-06-23'];

      expect(dup.configurationVersion).toBe(1);
      expect(dup.deviceOverrides).toEqual(source.deviceOverrides);
      expect(dup.deviceOverrides).not.toBe(source.deviceOverrides);
    });

    it('re-exports the duplicate with the SAME ntrode bad_channels as the source (day-owned, byte-level)', () => {
      const { result } = renderHook(() => useStore());
      createTestAnimal(result);
      act(() => {
        result.current.actions.createDay('remy', '2023-06-22', {
          session_id: 'remy_20230622',
          session_description: 'Day 1',
        });
      });
      // Source pins NON-latest version 1 and owns a bad-channel override on ntrode 1.
      act(() => {
        result.current.actions.updateDay('remy-2023-06-22', {
          deviceOverrides: { bad_channels: { 1: [2] } },
        });
      });
      act(() => {
        result.current.actions.createConfigurationSnapshotAndApplyForward('remy', {
          date: '2023-06-15',
          description: 'Adjusted probes',
          devices: {
            electrode_groups: [
              { id: 0, location: 'CA1', device_type: 'tetrode_12.5', description: 'adjusted' },
            ],
            ntrode_electrode_group_channel_map: [
              { ntrode_id: 0, electrode_group_id: 0, map: { 0: 0, 1: 1, 2: 2, 3: 3 }, bad_channels: [] },
            ],
          },
        }, []);
      });

      act(() => {
        result.current.actions.duplicateDay('remy-2023-06-22', '2023-06-23');
      });

      const animal = result.current.model.workspace.animals['remy'];
      const source = result.current.model.workspace.days['remy-2023-06-22'];
      const dup = result.current.model.workspace.days['remy-2023-06-23'];

      // The duplicate keeps the source's NON-latest pin.
      expect(dup.configurationVersion).toBe(source.configurationVersion);
      expect(dup.configurationVersion).toBe(1);

      // Re-export both: the ntrode bad_channels in the merged YAML must match byte-for-byte
      // (bad channels are day-owned; the merge reads only the day override).
      const ntrodesOf = (day) =>
        mergeDayMetadata(animal, day).ntrode_electrode_group_channel_map.map((n) => ({
          ntrode_id: n.ntrode_id,
          bad_channels: n.bad_channels,
        }));
      expect(ntrodesOf(dup)).toEqual(ntrodesOf(source));

      // And the encoded YAML for those rows is identical (the strongest guard).
      const badChannelLines = (day) =>
        encodeYaml(mergeDayMetadata(animal, day))
          .split('\n')
          .filter((line) => line.includes('bad_channels'));
      expect(badChannelLines(dup)).toEqual(badChannelLines(source));
    });

    it('derives session_id from the new date and session_description from the source', () => {
      const { result } = renderHook(() => useStore());
      createTestAnimal(result);
      act(() => {
        result.current.actions.createDay('remy', '2023-06-22', {
          session_id: 'remy_20230622',
          session_description: 'W-track spatial alternation',
        });
      });

      act(() => {
        result.current.actions.duplicateDay('remy-2023-06-22', '2023-06-23');
      });

      const dup = result.current.model.workspace.days['remy-2023-06-23'];
      // session_id is date-derived, NOT carried from the source.
      expect(dup.session.session_id).toBe('remy_20230623');
      // session_description is carried from the source.
      expect(dup.session.session_description).toBe('W-track spatial alternation');
    });

    it('derives an empty session_description when the source has none', () => {
      const { result } = renderHook(() => useStore());
      createTestAnimal(result);
      act(() => {
        result.current.actions.createDay('remy', '2023-06-22', {
          session_id: 'remy_20230622',
          session_description: '',
        });
      });

      act(() => {
        result.current.actions.duplicateDay('remy-2023-06-22', '2023-06-23');
      });

      expect(
        result.current.model.workspace.days['remy-2023-06-23'].session.session_description
      ).toBe('');
    });

    it('adds the new day id to the owning animal index', () => {
      const { result } = renderHook(() => useStore());
      createTestAnimal(result);
      act(() => {
        result.current.actions.createDay('remy', '2023-06-22', {
          session_id: 'remy_20230622',
          session_description: 'Day 1',
        });
      });

      act(() => {
        result.current.actions.duplicateDay('remy-2023-06-22', '2023-06-23');
      });

      expect(result.current.model.workspace.animals['remy'].days).toContain('remy-2023-06-23');
    });

    it('throws if the source day does not exist', () => {
      const { result } = renderHook(() => useStore());
      createTestAnimal(result);
      expect(() => {
        act(() => {
          result.current.actions.duplicateDay('remy-9999-99-99', '2023-06-23');
        });
      }).toThrow(/not found/i);
    });

    it('throws if the target date already exists for the animal', () => {
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
      expect(() => {
        act(() => {
          result.current.actions.duplicateDay('remy-2023-06-22', '2023-06-23');
        });
      }).toThrow(/already exists/i);
    });

    it('throws when the source record names an animal that does not exist, writing no junk entry', () => {
      // A corrupt/partial import can leave a day record whose animalId points at no animal.
      // Duplicating it must fail closed (throw before any write) rather than spread a junk
      // `animals.ghost`/`animals.undefined` entry while resolving the owning animal.
      const initialState = {
        workspace: {
          animals: {
            remy: { id: 'remy', subject: { subject_id: 'remy' }, days: [] },
          },
          days: {
            orphan: { id: 'orphan', animalId: 'ghost', date: '2023-06-22', session: { session_id: 's1' } },
          },
          settings: {},
        },
      };
      const { result } = renderHook(() => useStore(initialState));

      expect(() => {
        act(() => {
          result.current.actions.duplicateDay('orphan', '2023-06-23');
        });
      }).toThrow(/not found/i);

      const { animals } = result.current.model.workspace;
      expect(Object.keys(animals)).toEqual(['remy']);
      expect(animals).not.toHaveProperty('ghost');
      expect(animals).not.toHaveProperty('undefined');
    });
  });
});
