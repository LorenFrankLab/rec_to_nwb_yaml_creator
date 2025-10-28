/**
 * @file Tests for animal state management in workspace
 *
 * Tests the animal CRUD operations (create, read, update, delete) and
 * configuration history tracking. These tests follow TDD - they define
 * the expected API before implementation exists.
 *
 * Test Structure:
 * - Animal Creation: Initial setup with defaults
 * - Animal Updates: Modify animal metadata
 * - Configuration History: Track probe reconfigurations
 * - Animal Deletion: Cleanup and cascade rules
 *
 * @see docs/ANIMAL_WORKSPACE_DESIGN.md for data model
 */

import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useStore } from '../../../state/store';

describe('Animal State Management', () => {
  describe('createAnimal', () => {
    it('creates animal with minimal required fields', () => {
      const { result } = renderHook(() => useStore());

      act(() => {
        result.current.actions.createAnimal('remy', {
          species: 'Rattus norvegicus',
          sex: 'M',
          genotype: 'Wild Type',
          date_of_birth: '2023-01-10T00:00:00Z',
          description: 'Test subject',
        });
      });

      const animal = result.current.model.workspace.animals['remy'];

      expect(animal).toBeDefined();
      expect(animal.id).toBe('remy');
      expect(animal.subject.subject_id).toBe('remy');
      expect(animal.subject.species).toBe('Rattus norvegicus');
      expect(animal.subject.sex).toBe('M');
      expect(animal.days).toEqual([]);
      expect(animal.configurationHistory).toHaveLength(1);
      expect(animal.configurationHistory[0].version).toBe(1);
      expect(animal.created).toMatch(/^\d{4}-\d{2}-\d{2}T/); // ISO timestamp
      expect(animal.lastModified).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    });

    it('creates animal with full metadata including devices', () => {
      const { result } = renderHook(() => useStore());

      act(() => {
        result.current.actions.createAnimal('remy', {
          species: 'Rattus norvegicus',
          sex: 'M',
          genotype: 'Wild Type',
          date_of_birth: '2023-01-10T00:00:00Z',
          description: 'Test subject',
          weight: 450,
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

      const animal = result.current.model.workspace.animals['remy'];

      expect(animal.devices.data_acq_device).toHaveLength(1);
      expect(animal.devices.electrode_groups).toHaveLength(1);
      expect(animal.cameras).toHaveLength(1);
      expect(animal.experimenters.lab).toBe('Frank');
      expect(animal.subject.weight).toBe(450);
    });

    it('creates initial configuration snapshot automatically', () => {
      const { result } = renderHook(() => useStore());

      act(() => {
        result.current.actions.createAnimal('remy', {
          species: 'Rattus norvegicus',
          sex: 'M',
          genotype: 'Wild Type',
          date_of_birth: '2023-01-10T00:00:00Z',
          description: 'Test subject',
        }, {
          devices: {
            electrode_groups: [
              { id: 0, location: 'CA1', device_type: 'tetrode_12.5', description: 'CA1 tetrode' }
            ],
            ntrode_electrode_group_channel_map: [
              { ntrode_id: 0, electrode_group_id: 0, map: { 0: 0, 1: 1, 2: 2, 3: 3 }, bad_channels: [] }
            ],
          },
        });
      });

      const animal = result.current.model.workspace.animals['remy'];
      const config = animal.configurationHistory[0];

      expect(config.version).toBe(1);
      expect(config.description).toBe('Initial configuration');
      expect(config.devices.electrode_groups).toHaveLength(1);
      expect(config.appliedToDays).toEqual([]);
      expect(config.date).toMatch(/^\d{4}-\d{2}-\d{2}$/); // YYYY-MM-DD
    });

    it('throws error if animal ID already exists', () => {
      const { result } = renderHook(() => useStore());

      act(() => {
        result.current.actions.createAnimal('remy', {
          species: 'Rattus norvegicus',
          sex: 'M',
          genotype: 'Wild Type',
          date_of_birth: '2023-01-10T00:00:00Z',
          description: 'First remy',
        });
      });

      expect(() => {
        act(() => {
          result.current.actions.createAnimal('remy', {
            species: 'Mus musculus',
            sex: 'F',
            genotype: 'C57BL/6',
            date_of_birth: '2023-02-10T00:00:00Z',
            description: 'Duplicate remy',
          });
        });
      }).toThrow(/already exists/i);
    });

    it('applies workspace default settings to new animal', () => {
      const { result } = renderHook(() => useStore());

      // Set workspace defaults
      act(() => {
        result.current.actions.updateWorkspaceSettings({
          defaultLab: 'Frank',
          defaultInstitution: 'UCSF',
          defaultExperimenters: ['Guidera, Jennifer', 'Comrie, Alison'],
        });
      });

      act(() => {
        result.current.actions.createAnimal('remy', {
          species: 'Rattus norvegicus',
          sex: 'M',
          genotype: 'Wild Type',
          date_of_birth: '2023-01-10T00:00:00Z',
          description: 'Test subject',
        });
      });

      const animal = result.current.model.workspace.animals['remy'];

      expect(animal.experimenters.lab).toBe('Frank');
      expect(animal.experimenters.institution).toBe('UCSF');
      expect(animal.experimenters.experimenter_name).toEqual(['Guidera, Jennifer', 'Comrie, Alison']);
    });
  });

  describe('updateAnimal', () => {
    it('updates animal subject metadata', () => {
      const { result } = renderHook(() => useStore());

      act(() => {
        result.current.actions.createAnimal('remy', {
          species: 'Rattus norvegicus',
          sex: 'M',
          genotype: 'Wild Type',
          date_of_birth: '2023-01-10T00:00:00Z',
          description: 'Original description',
          weight: 450,
        });
      });

      act(() => {
        result.current.actions.updateAnimal('remy', {
          subject: {
            description: 'Updated description',
            weight: 485,
          },
        });
      });

      const animal = result.current.model.workspace.animals['remy'];

      expect(animal.subject.description).toBe('Updated description');
      expect(animal.subject.weight).toBe(485);
      // Other fields unchanged
      expect(animal.subject.species).toBe('Rattus norvegicus');
      expect(animal.subject.sex).toBe('M');
    });

    it('updates animal experimenters', () => {
      const { result } = renderHook(() => useStore());

      act(() => {
        result.current.actions.createAnimal('remy', {
          species: 'Rattus norvegicus',
          sex: 'M',
          genotype: 'Wild Type',
          date_of_birth: '2023-01-10T00:00:00Z',
          description: 'Test subject',
        }, {
          experimenters: {
            experimenter_name: ['Original Experimenter'],
            lab: 'Original Lab',
            institution: 'Original Institution',
          },
        });
      });

      act(() => {
        result.current.actions.updateAnimal('remy', {
          experimenters: {
            experimenter_name: ['Guidera, Jennifer', 'Comrie, Alison'],
            lab: 'Frank',
          },
        });
      });

      const animal = result.current.model.workspace.animals['remy'];

      expect(animal.experimenters.experimenter_name).toEqual(['Guidera, Jennifer', 'Comrie, Alison']);
      expect(animal.experimenters.lab).toBe('Frank');
      expect(animal.experimenters.institution).toBe('Original Institution'); // Unchanged
    });

    it('updates lastModified timestamp', () => {
      const { result } = renderHook(() => useStore());

      act(() => {
        result.current.actions.createAnimal('remy', {
          species: 'Rattus norvegicus',
          sex: 'M',
          genotype: 'Wild Type',
          date_of_birth: '2023-01-10T00:00:00Z',
          description: 'Test subject',
        });
      });

      const originalTimestamp = result.current.model.workspace.animals['remy'].lastModified;

      act(() => {
        result.current.actions.updateAnimal('remy', {
          subject: { weight: 500 },
        });
      });

      const newTimestamp = result.current.model.workspace.animals['remy'].lastModified;
      // Timestamp should exist and be a valid ISO string
      expect(newTimestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);
      // Should be greater than or equal to original (updates can be very fast)
      expect(newTimestamp >= originalTimestamp).toBe(true);
    });

    it('throws error if animal does not exist', () => {
      const { result } = renderHook(() => useStore());

      expect(() => {
        act(() => {
          result.current.actions.updateAnimal('nonexistent', {
            subject: { weight: 500 },
          });
        });
      }).toThrow(/not found/i);
    });
  });

  describe('deleteAnimal', () => {
    it('deletes animal and all associated days', () => {
      const { result } = renderHook(() => useStore());

      act(() => {
        result.current.actions.createAnimal('remy', {
          species: 'Rattus norvegicus',
          sex: 'M',
          genotype: 'Wild Type',
          date_of_birth: '2023-01-10T00:00:00Z',
          description: 'Test subject',
        });

        result.current.actions.createDay('remy', '2023-06-01', {
          session_id: 'remy_20230601',
          session_description: 'Day 1',
        });

        result.current.actions.createDay('remy', '2023-06-02', {
          session_id: 'remy_20230602',
          session_description: 'Day 2',
        });
      });

      // Verify animal and days exist
      expect(result.current.model.workspace.animals['remy']).toBeDefined();
      expect(result.current.model.workspace.days['remy-2023-06-01']).toBeDefined();
      expect(result.current.model.workspace.days['remy-2023-06-02']).toBeDefined();

      act(() => {
        result.current.actions.deleteAnimal('remy');
      });

      // Verify animal and days deleted
      expect(result.current.model.workspace.animals['remy']).toBeUndefined();
      expect(result.current.model.workspace.days['remy-2023-06-01']).toBeUndefined();
      expect(result.current.model.workspace.days['remy-2023-06-02']).toBeUndefined();
    });

    it('throws error if animal does not exist', () => {
      const { result } = renderHook(() => useStore());

      expect(() => {
        act(() => {
          result.current.actions.deleteAnimal('nonexistent');
        });
      }).toThrow(/not found/i);
    });
  });

  describe('addConfigurationSnapshot', () => {
    it('adds new configuration version', () => {
      const { result } = renderHook(() => useStore());

      act(() => {
        result.current.actions.createAnimal('remy', {
          species: 'Rattus norvegicus',
          sex: 'M',
          genotype: 'Wild Type',
          date_of_birth: '2023-01-10T00:00:00Z',
          description: 'Test subject',
        }, {
          devices: {
            electrode_groups: [
              { id: 0, location: 'CA1', device_type: 'tetrode_12.5', description: 'CA1 tetrode', targeted_z: '2.0' }
            ],
            ntrode_electrode_group_channel_map: [
              { ntrode_id: 0, electrode_group_id: 0, map: { 0: 0, 1: 1, 2: 2, 3: 3 }, bad_channels: [] }
            ],
          },
        });
      });

      act(() => {
        result.current.actions.addConfigurationSnapshot('remy', {
          date: '2023-06-15',
          description: 'Lowered CA1 tetrodes by 40um',
          devices: {
            electrode_groups: [
              { id: 0, location: 'CA1', device_type: 'tetrode_12.5', description: 'CA1 tetrode', targeted_z: '1.96' }
            ],
            ntrode_electrode_group_channel_map: [
              { ntrode_id: 0, electrode_group_id: 0, map: { 0: 0, 1: 1, 2: 2, 3: 3 }, bad_channels: [] }
            ],
          },
        });
      });

      const animal = result.current.model.workspace.animals['remy'];

      expect(animal.configurationHistory).toHaveLength(2);
      expect(animal.configurationHistory[1].version).toBe(2);
      expect(animal.configurationHistory[1].description).toBe('Lowered CA1 tetrodes by 40um');
      expect(animal.configurationHistory[1].date).toBe('2023-06-15');
      expect(animal.configurationHistory[1].devices.electrode_groups[0].targeted_z).toBe('1.96');
    });

    it('increments version number automatically', () => {
      const { result } = renderHook(() => useStore());

      act(() => {
        result.current.actions.createAnimal('remy', {
          species: 'Rattus norvegicus',
          sex: 'M',
          genotype: 'Wild Type',
          date_of_birth: '2023-01-10T00:00:00Z',
          description: 'Test subject',
        });
      });

      // Add multiple configurations
      act(() => {
        result.current.actions.addConfigurationSnapshot('remy', {
          date: '2023-06-15',
          description: 'Config 2',
          devices: { electrode_groups: [], ntrode_electrode_group_channel_map: [] },
        });

        result.current.actions.addConfigurationSnapshot('remy', {
          date: '2023-07-01',
          description: 'Config 3',
          devices: { electrode_groups: [], ntrode_electrode_group_channel_map: [] },
        });
      });

      const animal = result.current.model.workspace.animals['remy'];

      expect(animal.configurationHistory[0].version).toBe(1);
      expect(animal.configurationHistory[1].version).toBe(2);
      expect(animal.configurationHistory[2].version).toBe(3);
    });
  });

  describe('workspace.animals selector', () => {
    it('returns empty object initially', () => {
      const { result } = renderHook(() => useStore());

      expect(result.current.model.workspace.animals).toEqual({});
    });

    it('returns all animals keyed by ID', () => {
      const { result } = renderHook(() => useStore());

      act(() => {
        result.current.actions.createAnimal('remy', {
          species: 'Rattus norvegicus',
          sex: 'M',
          genotype: 'Wild Type',
          date_of_birth: '2023-01-10T00:00:00Z',
          description: 'Rat 1',
        });

        result.current.actions.createAnimal('bean', {
          species: 'Rattus norvegicus',
          sex: 'F',
          genotype: 'Wild Type',
          date_of_birth: '2023-02-15T00:00:00Z',
          description: 'Rat 2',
        });
      });

      const animals = result.current.model.workspace.animals;

      expect(Object.keys(animals)).toEqual(['remy', 'bean']);
      expect(animals['remy'].subject.sex).toBe('M');
      expect(animals['bean'].subject.sex).toBe('F');
    });
  });
});
