/**
 * @file Tests for mergeDayMetadata function
 *
 * Tests the critical YAML export logic that merges animal defaults with
 * day-specific data to produce complete NWB metadata.
 *
 * This is the MOST CRITICAL function in the workspace - it must produce
 * EXACTLY the same YAML output as the legacy single-session exporter.
 * Any deviation will corrupt the trodes_to_nwb pipeline.
 *
 * Test Structure:
 * - Basic Merging: Animal + Day → Complete metadata
 * - Inheritance: Animal defaults propagate to day
 * - Overrides: Day-specific values override animal defaults
 * - Configuration Versions: Correct probe config selected
 * - YAML Parity: Output matches legacy exporter
 *
 * @see docs/ANIMAL_WORKSPACE_DESIGN.md §5 YAML Export Flow
 */

import { describe, it, expect } from 'vitest';
import { mergeDayMetadata } from '../../../state/workspaceUtils';

describe('mergeDayMetadata', () => {
  /**
   * Helper to create a minimal animal for testing
   * @param overrides
   */
  function createTestAnimal(overrides = {}) {
    return {
      id: 'remy',
      subject: {
        subject_id: 'remy',
        species: 'Rattus norvegicus',
        sex: 'M',
        genotype: 'Wild Type',
        date_of_birth: '2023-01-10T00:00:00Z',
        description: 'Test subject',
        weight: 450,
      },
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
      configurationHistory: [
        {
          version: 1,
          date: '2023-06-01',
          description: 'Initial configuration',
          devices: {
            electrode_groups: [
              { id: 0, location: 'CA1', device_type: 'tetrode_12.5', description: 'CA1 tetrode' }
            ],
            ntrode_electrode_group_channel_map: [
              { ntrode_id: 0, electrode_group_id: 0, map: { 0: 0, 1: 1, 2: 2, 3: 3 }, bad_channels: [] }
            ],
          },
          appliedToDays: [],
        },
      ],
      days: [],
      created: '2023-06-01T10:00:00Z',
      lastModified: '2023-06-22T14:00:00Z',
      ...overrides,
    };
  }

  /**
   * Helper to create a minimal day for testing
   * @param overrides
   */
  function createTestDay(overrides = {}) {
    return {
      id: 'remy-2023-06-22',
      animalId: 'remy',
      date: '2023-06-22',
      experimentDate: '06222023',
      session: {
        session_id: 'remy_20230622',
        session_description: 'W-track spatial alternation',
      },
      tasks: [
        { task_name: 'sleep', task_description: 'Sleep epoch', task_epochs: [0] },
        { task_name: 'run', task_description: 'W-track', task_epochs: [1, 2] },
      ],
      behavioral_events: [
        { name: 'poke_center', description: 'Center well poke' },
      ],
      associated_files: [],
      associated_video_files: [],
      technical: {
        times_period_multiplier: 1.5,
        raw_data_to_volts: 0.195,
        default_header_file_path: '',
      },
      state: {
        draft: false,
        validated: true,
        exported: false,
      },
      created: '2023-06-22T10:00:00Z',
      lastModified: '2023-06-22T14:00:00Z',
      configurationVersion: 1,
      ...overrides,
    };
  }

  describe('Basic Merging', () => {
    it('merges animal and day into complete metadata', () => {
      const animal = createTestAnimal();
      const day = createTestDay();

      const merged = mergeDayMetadata(animal, day);

      // From animal
      expect(merged.experimenter_name).toEqual(['Guidera, Jennifer']);
      expect(merged.lab).toBe('Frank');
      expect(merged.institution).toBe('University of California, San Francisco');
      expect(merged.subject.subject_id).toBe('remy');
      expect(merged.subject.species).toBe('Rattus norvegicus');
      expect(merged.data_acq_device).toHaveLength(1);
      expect(merged.cameras).toHaveLength(1);
      expect(merged.electrode_groups).toHaveLength(1);

      // From day
      expect(merged.session_id).toBe('remy_20230622');
      expect(merged.session_description).toBe('W-track spatial alternation');
      expect(merged.tasks).toHaveLength(2);
      expect(merged.behavioral_events).toHaveLength(1);
      expect(merged.times_period_multiplier).toBe(1.5);
      expect(merged.raw_data_to_volts).toBe(0.195);
    });

    it('includes all required NWB fields', () => {
      const animal = createTestAnimal();
      const day = createTestDay();

      const merged = mergeDayMetadata(animal, day);

      // Required top-level fields
      expect(merged).toHaveProperty('experimenter_name');
      expect(merged).toHaveProperty('lab');
      expect(merged).toHaveProperty('institution');
      expect(merged).toHaveProperty('experiment_description');
      expect(merged).toHaveProperty('session_description');
      expect(merged).toHaveProperty('session_id');
      expect(merged).toHaveProperty('subject');
      expect(merged).toHaveProperty('data_acq_device');
      expect(merged).toHaveProperty('device');
      expect(merged).toHaveProperty('cameras');
      expect(merged).toHaveProperty('electrode_groups');
      expect(merged).toHaveProperty('ntrode_electrode_group_channel_map');
      expect(merged).toHaveProperty('tasks');
      expect(merged).toHaveProperty('behavioral_events');
      expect(merged).toHaveProperty('associated_files');
      expect(merged).toHaveProperty('associated_video_files');
      expect(merged).toHaveProperty('times_period_multiplier');
      expect(merged).toHaveProperty('raw_data_to_volts');
      expect(merged).toHaveProperty('default_header_file_path');
    });
  });

  describe('Inheritance', () => {
    it('uses animal weight if day does not override', () => {
      const animal = createTestAnimal({ subject: { weight: 485 } });
      const day = createTestDay();

      const merged = mergeDayMetadata(animal, day);

      expect(merged.subject.weight).toBe(485);
    });

    it('uses day weight if specified (override)', () => {
      const animal = createTestAnimal({ subject: { weight: 485 } });
      const day = createTestDay({
        session: {
          session_id: 'remy_20230622',
          session_description: 'Test',
          weight: 490,
        },
      });

      const merged = mergeDayMetadata(animal, day);

      expect(merged.subject.weight).toBe(490);
    });

    it('uses day experiment_description if specified (override)', () => {
      const animal = createTestAnimal();
      const day = createTestDay({
        session: {
          session_id: 'remy_20230622',
          session_description: 'Test',
          experiment_description: 'Day-specific experiment',
        },
      });

      const merged = mergeDayMetadata(animal, day);

      expect(merged.experiment_description).toBe('Day-specific experiment');
    });

    it('defaults experiment_description to empty string if not specified', () => {
      const animal = createTestAnimal();
      const day = createTestDay();

      const merged = mergeDayMetadata(animal, day);

      expect(merged.experiment_description).toBe('');
    });
  });

  describe('Device Overrides', () => {
    it('uses animal cameras if day has no override', () => {
      const animal = createTestAnimal({
        cameras: [
          { id: 0, meters_per_pixel: 0.00085, manufacturer: 'Allied Vision', model: 'Mako G-158' },
          { id: 1, meters_per_pixel: 0.00090, manufacturer: 'Basler', model: 'ace' },
        ],
      });
      const day = createTestDay();

      const merged = mergeDayMetadata(animal, day);

      expect(merged.cameras).toHaveLength(2);
      expect(merged.cameras[1].manufacturer).toBe('Basler');
    });

    it('uses day cameras if override specified', () => {
      const animal = createTestAnimal({
        cameras: [
          { id: 0, meters_per_pixel: 0.00085, manufacturer: 'Allied Vision', model: 'Mako G-158' },
        ],
      });
      const day = createTestDay({
        deviceOverrides: {
          cameras: [
            { id: 0, meters_per_pixel: 0.00090, manufacturer: 'Override Camera', model: 'OC-1' },
          ],
        },
      });

      const merged = mergeDayMetadata(animal, day);

      expect(merged.cameras).toHaveLength(1);
      expect(merged.cameras[0].manufacturer).toBe('Override Camera');
    });

    it('uses day electrode groups if override specified', () => {
      const animal = createTestAnimal();
      const day = createTestDay({
        deviceOverrides: {
          electrode_groups: [
            { id: 0, location: 'PFC', device_type: 'tetrode_12.5', description: 'Override electrode group' },
          ],
          ntrode_electrode_group_channel_map: [
            { ntrode_id: 0, electrode_group_id: 0, map: { 0: 4, 1: 5, 2: 6, 3: 7 }, bad_channels: [0] },
          ],
        },
      });

      const merged = mergeDayMetadata(animal, day);

      expect(merged.electrode_groups).toHaveLength(1);
      expect(merged.electrode_groups[0].location).toBe('PFC');
      expect(merged.ntrode_electrode_group_channel_map[0].map).toEqual({ 0: 4, 1: 5, 2: 6, 3: 7 });
    });
  });

  describe('Configuration Versions', () => {
    it('uses configuration version specified by day', () => {
      const animal = createTestAnimal({
        configurationHistory: [
          {
            version: 1,
            date: '2023-06-01',
            description: 'Initial config',
            devices: {
              electrode_groups: [
                { id: 0, location: 'CA1', device_type: 'tetrode_12.5', description: 'Version 1', targeted_z: '2.0' }
              ],
              ntrode_electrode_group_channel_map: [
                { ntrode_id: 0, electrode_group_id: 0, map: { 0: 0, 1: 1, 2: 2, 3: 3 }, bad_channels: [] }
              ],
            },
            appliedToDays: [],
          },
          {
            version: 2,
            date: '2023-06-15',
            description: 'Lowered by 40um',
            devices: {
              electrode_groups: [
                { id: 0, location: 'CA1', device_type: 'tetrode_12.5', description: 'Version 2', targeted_z: '1.96' }
              ],
              ntrode_electrode_group_channel_map: [
                { ntrode_id: 0, electrode_group_id: 0, map: { 0: 0, 1: 1, 2: 2, 3: 3 }, bad_channels: [] }
              ],
            },
            appliedToDays: [],
          },
        ],
      });

      const day = createTestDay({ configurationVersion: 2 });

      const merged = mergeDayMetadata(animal, day);

      expect(merged.electrode_groups[0].description).toBe('Version 2');
      expect(merged.electrode_groups[0].targeted_z).toBe('1.96');
    });

    it('falls back to version 1 if specified version not found', () => {
      const animal = createTestAnimal();
      const day = createTestDay({ configurationVersion: 999 }); // Invalid version

      const merged = mergeDayMetadata(animal, day);

      // Should use first configuration (version 1)
      expect(merged.electrode_groups).toHaveLength(1);
      expect(merged.electrode_groups[0].id).toBe(0);
    });

    it('uses latest version if configurationVersion is null', () => {
      const animal = createTestAnimal({
        configurationHistory: [
          {
            version: 1,
            date: '2023-06-01',
            description: 'Initial config',
            devices: {
              electrode_groups: [
                { id: 0, location: 'CA1', device_type: 'tetrode_12.5', description: 'Version 1' }
              ],
              ntrode_electrode_group_channel_map: [],
            },
            appliedToDays: [],
          },
          {
            version: 2,
            date: '2023-06-15',
            description: 'Latest config',
            devices: {
              electrode_groups: [
                { id: 0, location: 'CA1', device_type: 'tetrode_12.5', description: 'Version 2 (latest)' }
              ],
              ntrode_electrode_group_channel_map: [],
            },
            appliedToDays: [],
          },
        ],
      });

      const day = createTestDay({ configurationVersion: null });

      const merged = mergeDayMetadata(animal, day);

      expect(merged.electrode_groups[0].description).toBe('Version 2 (latest)');
    });
  });

  describe('Optogenetics', () => {
    it('includes optogenetics fields if animal has optogenetics', () => {
      const animal = createTestAnimal({
        optogenetics: {
          opto_excitation_source: [
            { name: 'LED-470', wavelength: 470, power: 10 },
          ],
          optical_fiber: [
            { name: 'Fiber1', location: 'CA1', coordinates: [-3.5, 2.5, -2.0] },
          ],
          virus_injection: [
            { virus_name: 'AAV-ChR2', location: 'CA1', coordinates: [-3.5, 2.5, -2.5], volume: 500 },
          ],
          optogenetic_stimulation_software: 'FsGUI',
        },
      });

      const day = createTestDay();

      const merged = mergeDayMetadata(animal, day);

      expect(merged.opto_excitation_source).toHaveLength(1);
      expect(merged.optical_fiber).toHaveLength(1);
      expect(merged.virus_injection).toHaveLength(1);
      expect(merged.optogenetic_stimulation_software).toBe('FsGUI');
    });

    it('excludes optogenetics fields if animal has no optogenetics', () => {
      const animal = createTestAnimal();
      const day = createTestDay();

      const merged = mergeDayMetadata(animal, day);

      expect(merged.opto_excitation_source).toBeUndefined();
      expect(merged.optical_fiber).toBeUndefined();
      expect(merged.virus_injection).toBeUndefined();
      expect(merged.optogenetic_stimulation_software).toBeUndefined();
    });
  });

  describe('YAML Parity', () => {
    it('produces same structure as legacy single-session exporter', () => {
      const animal = createTestAnimal();
      const day = createTestDay();

      const merged = mergeDayMetadata(animal, day);

      // Verify top-level structure matches legacy exporter
      const expectedKeys = [
        'experimenter_name',
        'lab',
        'institution',
        'experiment_description',
        'session_description',
        'session_id',
        'keywords',
        'subject',
        'data_acq_device',
        'device',
        'cameras',
        'electrode_groups',
        'ntrode_electrode_group_channel_map',
        'tasks',
        'behavioral_events',
        'associated_files',
        'associated_video_files',
        'times_period_multiplier',
        'raw_data_to_volts',
        'default_header_file_path',
        'units',
      ];

      expectedKeys.forEach(key => {
        expect(merged).toHaveProperty(key);
      });
    });

    it('initializes keywords as empty array', () => {
      const animal = createTestAnimal();
      const day = createTestDay();

      const merged = mergeDayMetadata(animal, day);

      expect(merged.keywords).toEqual([]);
    });

    it('initializes units as empty object if not specified', () => {
      const animal = createTestAnimal();
      const day = createTestDay({ technical: { units: undefined } });

      const merged = mergeDayMetadata(animal, day);

      expect(merged.units).toEqual({});
    });

    it('includes units if specified in day', () => {
      const animal = createTestAnimal();
      const day = createTestDay({
        technical: {
          times_period_multiplier: 1.5,
          raw_data_to_volts: 0.195,
          default_header_file_path: '',
          units: {
            analog: 'microvolts',
            behavioral_events: 'seconds',
          },
        },
      });

      const merged = mergeDayMetadata(animal, day);

      expect(merged.units.analog).toBe('microvolts');
      expect(merged.units.behavioral_events).toBe('seconds');
    });

    it('includes fs_gui_yamls if present in day', () => {
      const animal = createTestAnimal();
      const day = createTestDay({
        fs_gui_yamls: [
          { name: 'protocol1.yml', path: '/path/to/protocol1.yml', task_epochs: 1 },
        ],
      });

      const merged = mergeDayMetadata(animal, day);

      expect(merged.fs_gui_yamls).toHaveLength(1);
      expect(merged.fs_gui_yamls[0].name).toBe('protocol1.yml');
    });

    it('excludes fs_gui_yamls if not present in day', () => {
      const animal = createTestAnimal();
      const day = createTestDay();

      const merged = mergeDayMetadata(animal, day);

      // Should either be empty array or undefined (depending on implementation)
      // Most important: should not break YAML export
      if (merged.fs_gui_yamls !== undefined) {
        expect(merged.fs_gui_yamls).toEqual([]);
      }
    });
  });

  describe('Edge Cases', () => {
    it('handles missing optional fields gracefully', () => {
      const animal = createTestAnimal();
      const day = createTestDay({
        session: {
          session_id: 'remy_20230622',
          session_description: 'Test',
          // No experiment_description, no weight
        },
      });

      const merged = mergeDayMetadata(animal, day);

      expect(merged.experiment_description).toBe('');
      expect(merged.subject.weight).toBe(450); // From animal
    });

    it('handles empty arrays correctly', () => {
      const animal = createTestAnimal();
      const day = createTestDay({
        tasks: [],
        behavioral_events: [],
        associated_files: [],
        associated_video_files: [],
      });

      const merged = mergeDayMetadata(animal, day);

      expect(merged.tasks).toEqual([]);
      expect(merged.behavioral_events).toEqual([]);
      expect(merged.associated_files).toEqual([]);
      expect(merged.associated_video_files).toEqual([]);
    });
  });
});
