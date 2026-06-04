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
   * @param {object} overrides Animal fields to override
   * @returns {object} Test animal
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
   * @param {object} overrides Day fields to override
   * @returns {object} Test day
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
    });
  });

  describe('Behavioral events are day-only (animal events are reference-only)', () => {
    it('does not export the animal behavioral_events with the day', () => {
      // The animal carries its own behavioral_events; the day carries one of its own.
      const animal = createTestAnimal({
        behavioral_events: [
          { name: 'animal_level_event', description: 'Defined on the animal' },
        ],
      });
      const day = createTestDay({
        behavioral_events: [{ name: 'poke_center', description: 'Center well poke' }],
      });

      const merged = mergeDayMetadata(animal, day);

      // Only the day's events are exported; the animal's are not concatenated in.
      expect(merged.behavioral_events).toEqual([
        { name: 'poke_center', description: 'Center well poke' },
      ]);
      expect(merged.behavioral_events).not.toContainEqual(
        expect.objectContaining({ name: 'animal_level_event' })
      );
    });

    it('exports no behavioral_events for a day with none, regardless of animal events', () => {
      const animal = createTestAnimal({
        behavioral_events: [{ name: 'animal_level_event', description: 'Defined on the animal' }],
      });
      const day = createTestDay({ behavioral_events: [] });

      const merged = mergeDayMetadata(animal, day);

      expect(merged.behavioral_events).toEqual([]);
    });
  });

  describe('Malformed animal guard', () => {
    it('throws an actionable error when the animal has no configuration history', () => {
      const animal = createTestAnimal({ configurationHistory: [] });
      const day = createTestDay();
      expect(() => mergeDayMetadata(animal, day)).toThrow(/configuration/i);
    });

    it('throws an actionable error when configurationHistory is missing entirely', () => {
      const animal = createTestAnimal({ configurationHistory: undefined });
      const day = createTestDay();
      expect(() => mergeDayMetadata(animal, day)).toThrow(/configuration/i);
    });
  });

  describe('Optional empty-key omission', () => {
    // The schema permits keywords / units / default_header_file_path to be ABSENT
    // (minimal-valid.yml and realistic-session.yml omit all three and validate
    // clean), but rejects them when present-but-empty (keywords minItems, units
    // required analog, default_header_file_path non-empty pattern). The merge must
    // therefore omit them when empty rather than manufacture a schema-invalid value.

    it('omits keywords when the day has none', () => {
      const merged = mergeDayMetadata(createTestAnimal(), createTestDay());
      expect(merged).not.toHaveProperty('keywords');
    });

    it('includes keywords when the day provides a non-empty list', () => {
      const merged = mergeDayMetadata(
        createTestAnimal(),
        createTestDay({ keywords: ['spatial', 'w-track'] })
      );
      expect(merged.keywords).toEqual(['spatial', 'w-track']);
    });

    it('omits units when the day does not specify them', () => {
      const merged = mergeDayMetadata(
        createTestAnimal(),
        createTestDay({
          technical: {
            times_period_multiplier: 1.5,
            raw_data_to_volts: 0.195,
            default_header_file_path: '',
            units: undefined,
          },
        })
      );
      expect(merged).not.toHaveProperty('units');
    });

    it('omits default_header_file_path when it is empty', () => {
      const merged = mergeDayMetadata(createTestAnimal(), createTestDay());
      expect(merged).not.toHaveProperty('default_header_file_path');
    });

    it('includes default_header_file_path when it is set', () => {
      const merged = mergeDayMetadata(
        createTestAnimal(),
        createTestDay({
          technical: {
            times_period_multiplier: 1.5,
            raw_data_to_volts: 0.195,
            default_header_file_path: 'default_header.xml',
          },
        })
      );
      expect(merged.default_header_file_path).toBe('default_header.xml');
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

    it('ignores legacy day camera overrides and uses animal cameras as source of truth', () => {
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
      expect(merged.cameras[0].manufacturer).toBe('Allied Vision');
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
      expect(merged.electrode_groups[0].targeted_z).toBe(1.96);
    });

    it('fails closed when the specified version is not found (does not silently fall back)', () => {
      const animal = createTestAnimal();
      const day = createTestDay({ configurationVersion: 999 }); // Invalid version

      // A pin with no matching snapshot is persisted-state corruption. It must throw
      // rather than silently export a different version's geometry.
      expect(() => mergeDayMetadata(animal, day)).toThrow(/configuration version/i);
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

    it('emits empty optogenetics fields if animal has no optogenetics (legacy parity)', () => {
      const animal = createTestAnimal();
      const day = createTestDay();

      const merged = mergeDayMetadata(animal, day);

      // The legacy formData always carries these keys; emit them empty (rather than
      // omit them) so the new export path is byte-identical to a legacy export.
      expect(merged.opto_excitation_source).toEqual([]);
      expect(merged.optical_fiber).toEqual([]);
      expect(merged.virus_injection).toEqual([]);
      expect(merged.optogenetic_stimulation_software).toBe('');
    });
  });

  describe('YAML Parity', () => {
    it('produces same structure as legacy single-session exporter', () => {
      const animal = createTestAnimal();
      const day = createTestDay();

      const merged = mergeDayMetadata(animal, day);

      // Top-level key ORDER matches the legacy exporter (defaultYMLValues order),
      // minus keywords / units / default_header_file_path — intentionally absent
      // here because this day leaves them empty (see "Optional empty-key omission").
      // Order-strict: this is the byte-for-byte legacy-parity guarantee.
      expect(Object.keys(merged)).toEqual([
        'experimenter_name',
        'lab',
        'institution',
        'experiment_description',
        'session_description',
        'session_id',
        'subject',
        'data_acq_device',
        'cameras',
        'tasks',
        'associated_files',
        'associated_video_files',
        'times_period_multiplier',
        'raw_data_to_volts',
        'behavioral_events',
        'device',
        'opto_excitation_source',
        'optical_fiber',
        'virus_injection',
        'fs_gui_yamls',
        'optogenetic_stimulation_software',
        'electrode_groups',
        'ntrode_electrode_group_channel_map',
      ]);
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

      // The legacy formData always carries fs_gui_yamls; emit it empty (not omitted)
      // so the new export path is byte-identical to a legacy export. Empty is
      // schema-valid, so it does not gate export.
      expect(merged.fs_gui_yamls).toEqual([]);
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

  describe('Ownership (returned object is safe to mutate)', () => {
    it('mutating nested arrays on the result does not corrupt the source animal/config', () => {
      const animal = createTestAnimal();
      const day = createTestDay();

      const merged = mergeDayMetadata(animal, day);

      // Mutate nested structures on the merged result.
      merged.electrode_groups.push({ id: 99, location: 'mutated' });
      merged.electrode_groups[0].location = 'MUTATED';
      merged.cameras.push({ id: 99 });
      merged.data_acq_device.push({ name: 'MUTATED' });
      merged.subject.weight = -1;

      // Source animal + its configuration snapshot must be untouched.
      const config = animal.configurationHistory.find((c) => c.version === day.configurationVersion);
      expect(config.devices.electrode_groups).toHaveLength(1);
      expect(config.devices.electrode_groups[0].location).toBe('CA1');
      expect(animal.cameras).toHaveLength(1);
      expect(animal.devices.data_acq_device).toHaveLength(1);
      expect(animal.subject.weight).toBe(450);
    });
  });
});
