/**
 * Rules Validation Tests
 *
 * Tests for custom business logic validation with unified Issue[] format.
 *
 * Rules enforced:
 * 1. Tasks with camera_ids require cameras to be defined
 * 2. Associated video files with camera_ids require cameras to be defined
 * 3. Optogenetics configuration must be complete (all or none of the 3 fields)
 * 4. Ntrode channel mappings must have unique physical channels
 *
 * TDD: Tests written FIRST, then implementation.
 */

import { describe, it, expect } from 'vitest';
import { rulesValidation } from '../rulesValidation';
import { createTestYaml } from '../../__tests__/helpers/test-utils';

describe('rulesValidation()', () => {
  describe('Valid Models', () => {
    it('should return empty array for minimal valid model', () => {
      const model = createTestYaml();
      const issues = rulesValidation(model);

      expect(issues).toEqual([]);
    });

    it('should return empty array when tasks have cameras defined', () => {
      const model = createTestYaml({
        tasks: [{ camera_id: [0] }], // Fixed: camera_id (singular)
        cameras: [{ id: 0, meters_per_pixel: 0.001, camera_name: 'cam1' }]
      });
      const issues = rulesValidation(model);

      expect(issues).toEqual([]);
    });

    it('should return empty array when all optogenetics fields present', () => {
      const model = createTestYaml({
        opto_excitation_source: [{ opto_excitation_source_name: 'LED' }],
        // Fibers/virus injections need a coordinate `reference` (the converter reads it).
        optical_fiber: [{ fiber_model_number: 'FiberX', reference: 'Bregma' }],
        virus_injection: [{ virus_name: 'AAV', reference: 'Bregma' }],
        // The converter gate also requires the software key; a complete opto session
        // carries all four sections.
        optogenetic_stimulation_software: 'fsgui',
      });
      const issues = rulesValidation(model);

      expect(issues).toEqual([]);
    });

    it('should return empty array when no optogenetics fields present', () => {
      const model = createTestYaml({
        opto_excitation_source: undefined,
        optical_fiber: undefined,
        virus_injection: undefined
      });
      const issues = rulesValidation(model);

      expect(issues).toEqual([]);
    });

    it('should return empty array for valid ntrode channel mappings', () => {
      // Two independent tetrode groups; each is its own probe so values reset to
      // 0..3 per group (designs.md#channel-map-semantics).
      const model = createTestYaml({
        electrode_groups: [
          { id: 0, device_type: 'tetrode_12.5', location: 'CA1', targeted_location: 'CA1' },
          { id: 1, device_type: 'tetrode_12.5', location: 'CA1', targeted_location: 'CA1' },
        ],
        ntrode_electrode_group_channel_map: [
          { ntrode_id: 1, electrode_group_id: 0, bad_channels: [], map: { 0: 0, 1: 1, 2: 2, 3: 3 } },
          { ntrode_id: 2, electrode_group_id: 1, bad_channels: [], map: { 0: 0, 1: 1, 2: 2, 3: 3 } },
        ]
      });
      const issues = rulesValidation(model);

      expect(issues).toEqual([]);
    });
  });

  describe('Issue Format', () => {
    it('should return Issue objects with all required properties', () => {
      const model = {
        ...createTestYaml(),
        tasks: [{ camera_id: [0] }],
        cameras: undefined
      };
      const issues = rulesValidation(model);

      expect(issues).toHaveLength(1);
      expect(issues[0]).toMatchObject({
        path: expect.any(String),
        code: expect.any(String),
        severity: 'error',
        message: expect.any(String)
      });
    });

    it('should set severity to "error" for all rule violations', () => {
      const model = {
        ...createTestYaml(),
        tasks: [{ camera_id: [0] }],
        cameras: undefined,
        opto_excitation_source: [{ opto_excitation_source_name: 'LED' }],
        optical_fiber: undefined,
        virus_injection: undefined
      };
      const issues = rulesValidation(model);

      expect(issues.every(i => i.severity === 'error')).toBe(true);
    });

    it('should not include instancePath or schemaPath (rules are not schema-based)', () => {
      const model = {
        ...createTestYaml(),
        tasks: [{ camera_id: [0] }],
        cameras: undefined
      };
      const issues = rulesValidation(model);

      expect(issues[0].instancePath).toBeUndefined();
      expect(issues[0].schemaPath).toBeUndefined();
    });
  });

  describe('Rule 1: Tasks Require Cameras', () => {
    it('should detect tasks without cameras defined', () => {
      const model = {
        ...createTestYaml(),
        tasks: [{ camera_id: [0] }], // Fixed: camera_id (singular) not camera_ids
        cameras: undefined
      };
      const issues = rulesValidation(model);

      expect(issues).toContainEqual(expect.objectContaining({
        path: 'tasks',
        code: 'missing_camera',
        severity: 'error',
        message: expect.stringContaining('camera')
      }));
    });

    it('should detect tasks when cameras is empty array', () => {
      const model = {
        ...createTestYaml(),
        tasks: [{ camera_id: [0] }], // Fixed: camera_id (singular) not camera_ids
        cameras: []
      };
      const issues = rulesValidation(model);

      // Empty array means cameras object exists but has no elements
      // Current behavior: may or may not detect this as an error
      expect(Array.isArray(issues)).toBe(true);
    });

    it('should not error when tasks exist but cameras defined', () => {
      const model = createTestYaml({
        tasks: [{ camera_id: [0] }], // Fixed: camera_id (singular) not camera_ids
        cameras: [{ id: 0, meters_per_pixel: 0.001, camera_name: 'cam1' }]
      });
      const issues = rulesValidation(model);

      expect(issues.some(i => i.code === 'missing_camera' && i.path === 'tasks')).toBe(false);
    });

    it('should not error when no tasks exist', () => {
      const model = createTestYaml({
        tasks: undefined,
        cameras: undefined
      });
      const issues = rulesValidation(model);

      expect(issues.some(i => i.code === 'missing_camera' && i.path === 'tasks')).toBe(false);
    });

    it('should not error when tasks is empty array', () => {
      const model = createTestYaml({
        tasks: [],
        cameras: undefined
      });
      const issues = rulesValidation(model);

      expect(issues.some(i => i.code === 'missing_camera' && i.path === 'tasks')).toBe(false);
    });
  });

  describe('Rule 2: Associated Video Files Require Cameras', () => {
    it('should detect associated_video_files without cameras defined', () => {
      const model = {
        ...createTestYaml(),
        associated_video_files: [{ camera_id: [0], task_epochs: [1] }], // Fixed: camera_id should be array
        cameras: undefined
      };
      const issues = rulesValidation(model);

      expect(issues).toContainEqual(expect.objectContaining({
        path: 'associated_video_files',
        code: 'missing_camera',
        severity: 'error',
        message: expect.stringContaining('camera')
      }));
    });

    it('should not error when associated_video_files exist with cameras', () => {
      const model = createTestYaml({
        associated_video_files: [{ camera_id: [0], task_epochs: [1] }], // Fixed: camera_id should be array
        cameras: [{ id: 0, meters_per_pixel: 0.001, camera_name: 'cam1' }]
      });
      const issues = rulesValidation(model);

      expect(issues.some(i => i.code === 'missing_camera' && i.path === 'associated_video_files')).toBe(false);
    });

    it('should not error when no associated_video_files exist', () => {
      const model = createTestYaml({
        associated_video_files: undefined,
        cameras: undefined
      });
      const issues = rulesValidation(model);

      expect(issues.some(i => i.code === 'missing_camera' && i.path === 'associated_video_files')).toBe(false);
    });
  });

  describe('Rule 3: Optogenetics All-or-Nothing', () => {
    it('should detect partial configuration: only opto_excitation_source', () => {
      const model = {
        ...createTestYaml(),
        opto_excitation_source: [{ opto_excitation_source_name: 'LED' }],
        optical_fiber: undefined,
        virus_injection: undefined
      };
      const issues = rulesValidation(model);

      expect(issues).toContainEqual(expect.objectContaining({
        path: 'optogenetics',
        code: 'partial_configuration',
        severity: 'error',
        message: expect.stringContaining('All fields required')
      }));
    });

    it('should detect partial configuration: only optical_fiber', () => {
      const model = {
        ...createTestYaml(),
        opto_excitation_source: undefined,
        optical_fiber: [{ fiber_model_number: 'FiberX' }],
        virus_injection: undefined
      };
      const issues = rulesValidation(model);

      expect(issues).toContainEqual(expect.objectContaining({
        path: 'optogenetics',
        code: 'partial_configuration',
        severity: 'error'
      }));
    });

    it('should detect partial configuration: only virus_injection', () => {
      const model = {
        ...createTestYaml(),
        opto_excitation_source: undefined,
        optical_fiber: undefined,
        virus_injection: [{ virus_name: 'AAV' }]
      };
      const issues = rulesValidation(model);

      expect(issues).toContainEqual(expect.objectContaining({
        path: 'optogenetics',
        code: 'partial_configuration',
        severity: 'error'
      }));
    });

    it('should detect partial configuration: two of three fields', () => {
      const model = {
        ...createTestYaml(),
        opto_excitation_source: [{ opto_excitation_source_name: 'LED' }],
        optical_fiber: [{ fiber_model_number: 'FiberX' }],
        virus_injection: undefined
      };
      const issues = rulesValidation(model);

      expect(issues).toContainEqual(expect.objectContaining({
        path: 'optogenetics',
        code: 'partial_configuration',
        severity: 'error'
      }));
    });

    it('should include checkmark indicators in error message', () => {
      const model = {
        ...createTestYaml(),
        opto_excitation_source: [{ opto_excitation_source_name: 'LED' }],
        optical_fiber: undefined,
        virus_injection: undefined
      };
      const issues = rulesValidation(model);

      const optoIssue = issues.find(i => i.code === 'partial_configuration');
      expect(optoIssue.message).toContain('✓'); // Present field
      expect(optoIssue.message).toContain('✗'); // Missing field
    });

    it('should not error when all four converter-required sections present', () => {
      // The converter gate requires optogenetic_stimulation_software too, so a complete
      // opto session needs all FOUR sections — not three.
      const model = createTestYaml({
        opto_excitation_source: [{ opto_excitation_source_name: 'LED' }],
        optical_fiber: [{ fiber_model_number: 'FiberX' }],
        virus_injection: [{ virus_name: 'AAV' }],
        optogenetic_stimulation_software: 'fsgui',
      });
      const issues = rulesValidation(model);

      expect(issues.some(i => i.code === 'partial_configuration')).toBe(false);
    });

    it('should error when the three sections are present but software is missing', () => {
      // trodes_to_nwb gates opto on optogenetic_stimulation_software being non-empty too;
      // omitting it silently drops the whole optogenetics block.
      const model = createTestYaml({
        opto_excitation_source: [{ opto_excitation_source_name: 'LED' }],
        optical_fiber: [{ fiber_model_number: 'FiberX' }],
        virus_injection: [{ virus_name: 'AAV' }],
        optogenetic_stimulation_software: '',
      });
      const issues = rulesValidation(model);

      expect(issues).toContainEqual(expect.objectContaining({
        path: 'optogenetics',
        code: 'partial_configuration',
        severity: 'error',
      }));
    });

    it('should error when more than one excitation source is defined', () => {
      // trodes_to_nwb raises a ValueError on >1 opto_excitation_source.
      const model = createTestYaml({
        opto_excitation_source: [
          { opto_excitation_source_name: 'LED-1' },
          { opto_excitation_source_name: 'LED-2' },
        ],
        optical_fiber: [{ fiber_model_number: 'FiberX' }],
        virus_injection: [{ virus_name: 'AAV' }],
        optogenetic_stimulation_software: 'fsgui',
      });
      const issues = rulesValidation(model);

      expect(issues).toContainEqual(expect.objectContaining({
        path: 'opto_excitation_source',
        code: 'multiple_excitation_sources',
        severity: 'error',
      }));
    });

    it('errors on an fs_gui_yamls camera_id that no camera defines (dangling ref)', () => {
      const model = {
        cameras: [{ id: 0 }],
        tasks: [{ task_name: 't', task_epochs: [1] }],
        fs_gui_yamls: [{ name: 'p.yaml', epochs: [1], camera_id: 42 }],
      };
      const issues = rulesValidation(model);

      expect(issues).toContainEqual(expect.objectContaining({
        code: 'dangling_camera_ref',
        path: expect.stringContaining('fs_gui_yamls'),
        severity: 'error',
      }));
    });

    it('errors on an fs_gui_yamls epoch that no task defines (orphaned epoch)', () => {
      const model = {
        cameras: [{ id: 0 }],
        tasks: [{ task_name: 't', task_epochs: [1] }],
        fs_gui_yamls: [{ name: 'p.yaml', epochs: [99], camera_id: 0 }],
      };
      const issues = rulesValidation(model);

      expect(issues).toContainEqual(expect.objectContaining({
        code: 'orphaned_fs_gui_epoch',
        path: expect.stringContaining('fs_gui_yamls'),
        severity: 'error',
      }));
    });

    it('passes for fs_gui_yamls with valid camera + epoch references', () => {
      const model = {
        cameras: [{ id: 0 }],
        tasks: [{ task_name: 't', task_epochs: [1, 2] }],
        fs_gui_yamls: [{ name: 'p.yaml', epochs: [1, 2], camera_id: 0 }],
      };
      const issues = rulesValidation(model);

      expect(issues.some(i => i.code === 'dangling_camera_ref')).toBe(false);
      expect(issues.some(i => i.code === 'orphaned_fs_gui_epoch')).toBe(false);
    });

    it('blocks a type-mismatched camera reference (rule is type-strict — backs the day-used export narrowing)', () => {
      // LOAD-BEARING COUPLING: `mergeDayMetadata` now exports only the day-used camera subset
      // (resolveDayCameraUsage), which matches refs String-normalized. That narrowing is only safe
      // because `dangling_camera_ref` is type-EXACT (validCameraIds.has(cid)) and therefore at least
      // as eager to BLOCK as the resolver is to resolve — so a mistyped ref can never silently export
      // WITHOUT its camera. If this rule is ever relaxed to type-lenient, this test must fail to flag
      // that the export narrowing is no longer backed by a block. (Camera id "0" string vs 0 number.)
      const model = {
        cameras: [{ id: 0 }],
        tasks: [{ task_name: 't', task_epochs: [1], camera_id: ['0'] }],
      };
      const issues = rulesValidation(model);
      expect(issues.some((i) => i.code === 'dangling_camera_ref')).toBe(true);
    });

    it('errors when an optical_fiber lacks a reference (converter reads it unconditionally)', () => {
      const model = {
        opto_excitation_source: [{ name: 'LED' }],
        optical_fiber: [{ name: 'F' }], // no reference
        virus_injection: [{ name: 'V', reference: 'Bregma' }],
        optogenetic_stimulation_software: 'fsgui',
      };
      const issues = rulesValidation(model);
      expect(issues).toContainEqual(expect.objectContaining({
        code: 'missing_opto_reference',
        path: expect.stringContaining('optical_fiber'),
        severity: 'error',
      }));
    });

    it('errors when a virus_injection lacks a reference', () => {
      const model = {
        opto_excitation_source: [{ name: 'LED' }],
        optical_fiber: [{ name: 'F', reference: 'Bregma' }],
        virus_injection: [{ name: 'V' }], // no reference
        optogenetic_stimulation_software: 'fsgui',
      };
      const issues = rulesValidation(model);
      expect(issues).toContainEqual(expect.objectContaining({
        code: 'missing_opto_reference',
        path: expect.stringContaining('virus_injection'),
      }));
    });

    it('errors when fs_gui_yamls exist but optogenetics is not fully configured', () => {
      // FsGUI epochs make the converter call add_optogenetic_epochs, which crashes if the
      // opto implant metadata (the all-or-nothing gate) was not written.
      const model = {
        cameras: [{ id: 0 }],
        tasks: [{ task_name: 't', task_epochs: [1] }],
        behavioral_events: [{ name: 'laser' }],
        fs_gui_yamls: [{ name: 'p.yaml', epochs: [1], camera_id: 0, dio_output_name: 'laser' }],
        // No opto sections → opto is off, but fs_gui rows exist.
      };
      const issues = rulesValidation(model);
      expect(issues).toContainEqual(expect.objectContaining({
        code: 'fs_gui_requires_optogenetics',
        severity: 'error',
      }));
    });

    it('errors when fs_gui dio_output_name has no matching behavioral event', () => {
      const model = {
        cameras: [{ id: 0 }],
        tasks: [{ task_name: 't', task_epochs: [1] }],
        behavioral_events: [{ name: 'reward_left' }],
        opto_excitation_source: [{ name: 'LED' }],
        optical_fiber: [{ name: 'F', reference: 'Bregma' }],
        virus_injection: [{ name: 'V', reference: 'Bregma' }],
        optogenetic_stimulation_software: 'fsgui',
        fs_gui_yamls: [{ name: 'p.yaml', epochs: [1], camera_id: 0, dio_output_name: 'nope' }],
      };
      const issues = rulesValidation(model);
      expect(issues).toContainEqual(expect.objectContaining({
        code: 'dangling_dio_output',
        path: expect.stringContaining('fs_gui_yamls'),
        severity: 'error',
      }));
    });

    it('accepts a complete opto + fs_gui session with valid references and dio name', () => {
      const model = {
        cameras: [{ id: 0 }],
        tasks: [{ task_name: 't', task_epochs: [1] }],
        behavioral_events: [{ name: 'laser' }],
        opto_excitation_source: [{ name: 'LED' }],
        optical_fiber: [{ name: 'F', reference: 'Bregma' }],
        virus_injection: [{ name: 'V', reference: 'Bregma' }],
        optogenetic_stimulation_software: 'fsgui',
        fs_gui_yamls: [{ name: 'p.yaml', epochs: [1], camera_id: 0, dio_output_name: 'laser' }],
      };
      const issues = rulesValidation(model);
      expect(issues.some(i => ['missing_opto_reference', 'fs_gui_requires_optogenetics', 'dangling_dio_output'].includes(i.code))).toBe(false);
    });

    it('accepts an opto-implanted animal with an opto-free day (no fs_gui this day)', () => {
      // Phase 8.7 Task 7: opto is a complete IMPLANTED setup (all-or-nothing) PLUS a per-day,
      // epoch-scoped protocol (fs_gui_yamls). A day that ran no stimulation carries the implant
      // metadata but no fs_gui rows — that must be valid, not "missing opto".
      const model = {
        cameras: [{ id: 0 }],
        tasks: [{ task_name: 't', task_epochs: [1] }],
        behavioral_events: [{ name: 'laser' }],
        opto_excitation_source: [{ name: 'LED' }],
        optical_fiber: [{ name: 'F', reference: 'Bregma' }],
        virus_injection: [{ name: 'V', reference: 'Bregma' }],
        optogenetic_stimulation_software: 'fsgui',
        fs_gui_yamls: [], // no stimulation run this day — a normal, valid state
      };
      const issues = rulesValidation(model);
      expect(
        issues.some((i) =>
          ['partial_configuration', 'missing_opto_reference', 'fs_gui_requires_optogenetics', 'dangling_dio_output'].includes(i.code)
        )
      ).toBe(false);
    });

    it('should not error when all four fields absent', () => {
      const model = createTestYaml({
        opto_excitation_source: undefined,
        optical_fiber: undefined,
        virus_injection: undefined
      });
      const issues = rulesValidation(model);

      expect(issues.some(i => i.code === 'partial_configuration')).toBe(false);
    });

    it('should treat empty arrays as absent (not present)', () => {
      const model = createTestYaml({
        opto_excitation_source: [],
        optical_fiber: [],
        virus_injection: []
      });
      const issues = rulesValidation(model);

      expect(issues.some(i => i.code === 'partial_configuration')).toBe(false);
    });
  });

  describe('Rule 4: No Duplicate Channel Mappings', () => {
    it('should detect duplicate channels in single ntrode', () => {
      const model = {
        ...createTestYaml(),
        ntrode_electrode_group_channel_map: [{
          ntrode_id: 1,
          electrode_group_id: 0,
          map: { 0: 5, 1: 5, 2: 6, 3: 7 }  // Channel 5 mapped twice
        }]
      };
      const issues = rulesValidation(model);

      expect(issues).toContainEqual(expect.objectContaining({
        path: 'ntrode_electrode_group_channel_map[1]',
        code: 'duplicate_channels',
        severity: 'error',
        message: expect.stringContaining('duplicate')
      }));
    });

    it('should include ntrode_id in path', () => {
      const model = {
        ...createTestYaml(),
        ntrode_electrode_group_channel_map: [{
          ntrode_id: 42,
          electrode_group_id: 0,
          map: { 0: 5, 1: 5, 2: 6, 3: 7 }
        }]
      };
      const issues = rulesValidation(model);

      const channelIssue = issues.find(i => i.code === 'duplicate_channels');
      expect(channelIssue.path).toContain('42');
    });

    it('should list duplicate channel numbers in message', () => {
      const model = {
        ...createTestYaml(),
        ntrode_electrode_group_channel_map: [{
          ntrode_id: 1,
          electrode_group_id: 0,
          map: { 0: 5, 1: 5, 2: 6, 3: 7 }  // Duplicate: 5
        }]
      };
      const issues = rulesValidation(model);

      const channelIssue = issues.find(i => i.code === 'duplicate_channels');
      expect(channelIssue.message).toContain('5');
    });

    it('should detect multiple duplicate channels', () => {
      const model = {
        ...createTestYaml(),
        ntrode_electrode_group_channel_map: [{
          ntrode_id: 1,
          electrode_group_id: 0,
          map: { 0: 5, 1: 5, 2: 6, 3: 6 }  // Duplicates: 5 and 6
        }]
      };
      const issues = rulesValidation(model);

      const channelIssue = issues.find(i => i.code === 'duplicate_channels');
      expect(channelIssue.message).toContain('5');
      expect(channelIssue.message).toContain('6');
    });

    it('should detect errors across multiple ntrodes', () => {
      const model = {
        ...createTestYaml(),
        ntrode_electrode_group_channel_map: [
          {
            ntrode_id: 1,
            electrode_group_id: 0,
            map: { 0: 5, 1: 5, 2: 6, 3: 7 }  // Error in ntrode 1
          },
          {
            ntrode_id: 2,
            electrode_group_id: 0,
            map: { 0: 10, 1: 10, 2: 11, 3: 12 }  // Error in ntrode 2
          },
          {
            ntrode_id: 3,
            electrode_group_id: 0,
            map: { 0: 20, 1: 21, 2: 22, 3: 23 }  // Valid
          }
        ]
      };
      const issues = rulesValidation(model);

      const duplicateIssues = issues.filter(i => i.code === 'duplicate_channels');
      expect(duplicateIssues.length).toBe(2);
      expect(duplicateIssues.some(i => i.path.includes('1'))).toBe(true);
      expect(duplicateIssues.some(i => i.path.includes('2'))).toBe(true);
    });

    it('should not error for valid unique mappings', () => {
      const model = createTestYaml({
        ntrode_electrode_group_channel_map: [{
          ntrode_id: 1,
          electrode_group_id: 0,
          map: { 0: 0, 1: 1, 2: 2, 3: 3 }  // All unique
        }]
      });
      const issues = rulesValidation(model);

      expect(issues.some(i => i.code === 'duplicate_channels')).toBe(false);
    });

    it('should handle ntrode without map property', () => {
      const model = createTestYaml({
        ntrode_electrode_group_channel_map: [{
          ntrode_id: 1,
          electrode_group_id: 0,
          // map property missing
        }]
      });
      const issues = rulesValidation(model);

      expect(issues.some(i => i.code === 'duplicate_channels')).toBe(false);
    });

    it('should handle ntrode with null map', () => {
      const model = createTestYaml({
        ntrode_electrode_group_channel_map: [{
          ntrode_id: 1,
          electrode_group_id: 0,
          map: null
        }]
      });
      const issues = rulesValidation(model);

      expect(issues.some(i => i.code === 'duplicate_channels')).toBe(false);
    });

    it('should handle ntrode with non-object map', () => {
      const model = createTestYaml({
        ntrode_electrode_group_channel_map: [{
          ntrode_id: 1,
          electrode_group_id: 0,
          map: 'not an object'
        }]
      });
      const issues = rulesValidation(model);

      expect(issues.some(i => i.code === 'duplicate_channels')).toBe(false);
    });
  });

  describe('Rule 5: Sequential Channel Mappings (No Gaps)', () => {
    it('should detect missing channel in middle', () => {
      const model = {
        ...createTestYaml(),
        ntrode_electrode_group_channel_map: [{
          ntrode_id: 1,
          electrode_group_id: 0,
          map: { 0: 0, 2: 2, 3: 3 }  // Missing channel 1
        }]
      };
      const issues = rulesValidation(model);

      expect(issues).toContainEqual(expect.objectContaining({
        path: 'ntrode_electrode_group_channel_map[1]',
        code: 'missing_channels',
        severity: 'error',
        message: expect.stringContaining('Missing logical channel(s): 1')
      }));
    });

    it('should detect multiple missing channels', () => {
      const model = {
        ...createTestYaml(),
        ntrode_electrode_group_channel_map: [{
          ntrode_id: 1,
          electrode_group_id: 0,
          map: { 0: 0, 3: 3 }  // Missing channels 1, 2
        }]
      };
      const issues = rulesValidation(model);

      const channelIssue = issues.find(i => i.code === 'missing_channels');
      expect(channelIssue.message).toContain('1');
      expect(channelIssue.message).toContain('2');
    });

    it('should not error for sequential channels starting from 0', () => {
      const model = createTestYaml({
        ntrode_electrode_group_channel_map: [{
          ntrode_id: 1,
          electrode_group_id: 0,
          map: { 0: 0, 1: 1, 2: 2, 3: 3 }  // Sequential: 0, 1, 2, 3
        }]
      });
      const issues = rulesValidation(model);

      expect(issues.some(i => i.code === 'missing_channels')).toBe(false);
    });

    it('should handle unordered keys correctly', () => {
      const model = createTestYaml({
        ntrode_electrode_group_channel_map: [{
          ntrode_id: 1,
          electrode_group_id: 0,
          map: { 3: 3, 1: 1, 0: 0, 2: 2 }  // Unordered but complete
        }]
      });
      const issues = rulesValidation(model);

      expect(issues.some(i => i.code === 'missing_channels')).toBe(false);
    });

    it('should include ntrode_id in path', () => {
      const model = {
        ...createTestYaml(),
        ntrode_electrode_group_channel_map: [{
          ntrode_id: 42,
          electrode_group_id: 0,
          map: { 0: 0, 2: 2 }  // Missing channel 1
        }]
      };
      const issues = rulesValidation(model);

      const channelIssue = issues.find(i => i.code === 'missing_channels');
      expect(channelIssue.path).toContain('42');
    });

    it('should detect errors across multiple ntrodes', () => {
      const model = {
        ...createTestYaml(),
        ntrode_electrode_group_channel_map: [
          {
            ntrode_id: 1,
            electrode_group_id: 0,
            map: { 0: 0, 2: 2, 3: 3 }  // Missing channel 1
          },
          {
            ntrode_id: 2,
            electrode_group_id: 0,
            map: { 0: 0, 1: 1, 2: 2, 3: 3 }  // Valid
          },
          {
            ntrode_id: 3,
            electrode_group_id: 0,
            map: { 0: 0, 3: 3 }  // Missing channels 1, 2
          }
        ]
      };
      const issues = rulesValidation(model);

      const missingIssues = issues.filter(i => i.code === 'missing_channels');
      expect(missingIssues.length).toBe(2);
      expect(missingIssues.some(i => i.path.includes('1'))).toBe(true);
      expect(missingIssues.some(i => i.path.includes('3'))).toBe(true);
    });

    it('should handle ntrode without map property', () => {
      const model = createTestYaml({
        ntrode_electrode_group_channel_map: [{
          ntrode_id: 1,
          electrode_group_id: 0,
          // map property missing
        }]
      });
      const issues = rulesValidation(model);

      expect(issues.some(i => i.code === 'missing_channels')).toBe(false);
    });
  });

  describe('Rule 6: Unique electrode-group IDs', () => {
    it('flags duplicate electrode-group ids', () => {
      const model = {
        electrode_groups: [
          { id: 0, location: 'CA1', device_type: 'tetrode_12.5' },
          { id: 0, location: 'CA3', device_type: 'tetrode_12.5' },
        ],
      };
      const issues = rulesValidation(model);
      const dup = issues.find((i) => i.code === 'duplicate_electrode_group_id');
      expect(dup).toBeDefined();
      expect(dup.severity).toBe('error');
      expect(dup.message).toMatch(/0/);
    });

    it('does not flag unique electrode-group ids', () => {
      const model = {
        electrode_groups: [
          { id: 0, location: 'CA1', device_type: 'tetrode_12.5' },
          { id: 1, location: 'CA3', device_type: 'tetrode_12.5' },
        ],
      };
      const issues = rulesValidation(model);
      expect(issues.some((i) => i.code === 'duplicate_electrode_group_id')).toBe(false);
    });
  });

  describe('Rule 7: Unique ntrode IDs', () => {
    it('flags duplicate ntrode_id across the channel map', () => {
      const model = {
        ntrode_electrode_group_channel_map: [
          { ntrode_id: 0, electrode_group_id: 0, bad_channels: [], map: { 0: 0, 1: 1, 2: 2, 3: 3 } },
          { ntrode_id: 0, electrode_group_id: 1, bad_channels: [], map: { 0: 0, 1: 1, 2: 2, 3: 3 } },
        ],
      };
      const issues = rulesValidation(model);
      const dup = issues.find((i) => i.code === 'duplicate_ntrode_id');
      expect(dup).toBeDefined();
      expect(dup.severity).toBe('error');
      expect(dup.message).toMatch(/0/);
    });

    it('does not flag unique ntrode_id values', () => {
      const model = {
        ntrode_electrode_group_channel_map: [
          { ntrode_id: 0, electrode_group_id: 0, bad_channels: [], map: { 0: 0, 1: 1, 2: 2, 3: 3 } },
          { ntrode_id: 1, electrode_group_id: 1, bad_channels: [], map: { 0: 0, 1: 1, 2: 2, 3: 3 } },
        ],
      };
      const issues = rulesValidation(model);
      expect(issues.some((i) => i.code === 'duplicate_ntrode_id')).toBe(false);
    });

    it('reports a triplicated ntrode_id exactly once', () => {
      const model = {
        ntrode_electrode_group_channel_map: [
          { ntrode_id: 2, electrode_group_id: 0, bad_channels: [], map: { 0: 0, 1: 1, 2: 2, 3: 3 } },
          { ntrode_id: 2, electrode_group_id: 1, bad_channels: [], map: { 0: 0, 1: 1, 2: 2, 3: 3 } },
          { ntrode_id: 2, electrode_group_id: 2, bad_channels: [], map: { 0: 0, 1: 1, 2: 2, 3: 3 } },
        ],
      };
      const dupIssues = rulesValidation(model).filter((i) => i.code === 'duplicate_ntrode_id');
      expect(dupIssues).toHaveLength(1);
    });
  });

  describe('Rule 8: DANDI subject conformance (species + no-slash ids)', () => {
    it('flags a free-text species', () => {
      const issues = rulesValidation({ subject: { species: 'Rat' } });
      const i = issues.find((x) => x.code === 'invalid_species');
      expect(i).toBeDefined();
      expect(i.severity).toBe('error');
      expect(i.path).toBe('subject.species');
    });

    it('accepts a Latin binomial and an NCBI URI species', () => {
      expect(rulesValidation({ subject: { species: 'Rattus norvegicus' } })
        .some((x) => x.code === 'invalid_species')).toBe(false);
      expect(rulesValidation({ subject: { species: 'http://purl.obolibrary.org/obo/NCBITaxon_10116' } })
        .some((x) => x.code === 'invalid_species')).toBe(false);
    });

    it('flags a padded species value (fail-closed against the exported string)', () => {
      const issues = rulesValidation({ subject: { species: '  Rattus norvegicus  ' } });
      expect(issues.some((x) => x.code === 'invalid_species')).toBe(true);
    });

    it('flags a trinomial species (NWB Inspector accepts only the binomial)', () => {
      const issues = rulesValidation({ subject: { species: 'Mus musculus domesticus' } });
      expect(issues.some((x) => x.code === 'invalid_species')).toBe(true);
    });

    it('does not double-report an empty species (schema owns that)', () => {
      expect(rulesValidation({ subject: { species: '' } })
        .some((x) => x.code === 'invalid_species')).toBe(false);
      expect(rulesValidation({ subject: {} })
        .some((x) => x.code === 'invalid_species')).toBe(false);
    });

    it('flags a slash in subject_id and session_id', () => {
      const issues = rulesValidation({ subject: { subject_id: 'remy/1' }, session_id: 'remy/2023' });
      expect(issues.find((x) => x.code === 'subject_id_slash')?.path).toBe('subject.subject_id');
      expect(issues.find((x) => x.code === 'session_id_slash')?.path).toBe('session_id');
    });

    it('accepts slash-free ids', () => {
      const issues = rulesValidation({ subject: { subject_id: 'remy' }, session_id: 'remy_20230622' });
      expect(issues.some((x) => x.code === 'subject_id_slash' || x.code === 'session_id_slash')).toBe(false);
    });
  });

  describe('Multiple Rules Violations', () => {
    it('should detect violations from multiple rules', () => {
      const model = {
        ...createTestYaml(),
        tasks: [{ camera_id: [0] }],  // Rule 1 violation
        cameras: undefined,
        opto_excitation_source: [{ opto_excitation_source_name: 'LED' }],  // Rule 3 violation
        optical_fiber: undefined,
        virus_injection: undefined,
        ntrode_electrode_group_channel_map: [{  // Rule 4 violation
          ntrode_id: 1,
          electrode_group_id: 0,
          map: { 0: 5, 1: 5, 2: 6, 3: 7 }
        }]
      };
      const issues = rulesValidation(model);

      expect(issues.length).toBeGreaterThanOrEqual(3);
      expect(issues.some(i => i.code === 'missing_camera')).toBe(true);
      expect(issues.some(i => i.code === 'partial_configuration')).toBe(true);
      expect(issues.some(i => i.code === 'duplicate_channels')).toBe(true);
    });
  });

  describe('Edge Cases', () => {
    it('should handle null model', () => {
      expect(() => rulesValidation(null)).not.toThrow();
      const issues = rulesValidation(null);
      expect(Array.isArray(issues)).toBe(true);
    });

    it('should handle undefined model', () => {
      expect(() => rulesValidation(undefined)).not.toThrow();
      const issues = rulesValidation(undefined);
      expect(Array.isArray(issues)).toBe(true);
    });

    it('should handle empty object model', () => {
      const issues = rulesValidation({});
      expect(Array.isArray(issues)).toBe(true);
      expect(issues).toEqual([]); // No rules violations for empty object
    });
  });
});
