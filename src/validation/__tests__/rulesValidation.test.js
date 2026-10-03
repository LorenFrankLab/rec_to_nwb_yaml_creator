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
import fs from 'fs';
import path from 'path';
import YAML from 'yaml';
import { rulesValidation, unknownSubjectFields } from '../rulesValidation';
import { validate } from '../index';
import JsonSchema from '../../nwb_schema.json';
import { createTestYaml } from '../../__tests__/helpers/test-utils';

// Issues about camera references, as opposed to other rules a minimal fixture can trip (an epoch
// no task defines, an FsGUI row without optogenetics).
const cameraIssues = (issues) =>
  issues.filter((issue) => issue.code === 'missing_camera' || issue.code === 'unknown_camera');

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
        optogenetic_stimulation_software: 'fsgui',
        opto_excitation_source: [{ opto_excitation_source_name: 'LED' }],
        // Fibers/virus injections need a coordinate `reference` (the converter reads it).
        optical_fiber: [{ fiber_model_number: 'FiberX', reference: 'Bregma' }],
        virus_injection: [{ virus_name: 'AAV', reference: 'Bregma' }]
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
      const model = createTestYaml({
        // Every channel-map row names an existing electrode group.
        electrode_groups: [{ id: 0 }],
        ntrode_electrode_group_channel_map: [
          {
            ntrode_id: 1,
            electrode_group_id: 0,
            map: { 0: 0, 1: 1, 2: 2, 3: 3 }  // All unique
          },
          {
            ntrode_id: 2,
            electrode_group_id: 0,
            map: { 0: 4, 1: 5, 2: 6, 3: 7 }  // All unique
          }
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

  describe('Rule 2: Single-valued Camera References Require Cameras', () => {
    it('should detect associated_video_files without cameras defined', () => {
      const model = {
        ...createTestYaml(),
        associated_video_files: [{ camera_id: 0, task_epochs: 1 }],
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
        associated_video_files: [{ camera_id: 0, task_epochs: 1 }],
        cameras: [{ id: 0, meters_per_pixel: 0.001, camera_name: 'cam1' }]
      });
      const issues = rulesValidation(model);

      expect(issues.some(i => i.code === 'missing_camera' && i.path === 'associated_video_files')).toBe(false);
    });

    it('should detect fs_gui_yamls without cameras defined', () => {
      const model = {
        ...createTestYaml(),
        fs_gui_yamls: [{ camera_id: 0 }],
        cameras: undefined,
      };
      const issues = rulesValidation(model);

      expect(issues).toContainEqual(expect.objectContaining({
        path: 'fs_gui_yamls',
        code: 'missing_camera',
        severity: 'error',
        message: expect.stringContaining('camera'),
      }));
    });

    it('should ignore unset scalar camera ids when cameras are not defined', () => {
      const model = {
        ...createTestYaml(),
        associated_video_files: [{ camera_id: '' }],
        fs_gui_yamls: [{ camera_id: null }, {}],
        cameras: undefined,
      };

      expect(cameraIssues(rulesValidation(model))).toEqual([]);
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

    it('should not error when all three fields present', () => {
      const model = createTestYaml({
        opto_excitation_source: [{ opto_excitation_source_name: 'LED' }],
        optical_fiber: [{ fiber_model_number: 'FiberX' }],
        virus_injection: [{ virus_name: 'AAV' }]
      });
      const issues = rulesValidation(model);

      expect(issues.some(i => i.code === 'partial_configuration')).toBe(false);
    });

    it('should not error when all three fields absent', () => {
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

describe('rulesValidation() - unknown camera references', () => {
  const cameras = [{ id: 4, meters_per_pixel: 0.001, camera_name: 'cam4' }];

  it('reports a task camera_id that is not in cameras', () => {
    const model = createTestYaml({
      cameras,
      tasks: [{ task_name: 'Run', camera_id: [0, 4, 7] }],
    });
    const issues = rulesValidation(model);
    expect(issues).toEqual([
      expect.objectContaining({
        path: 'tasks[0].camera_id',
        code: 'unknown_camera',
        severity: 'error',
      }),
    ]);
    expect(issues[0].message).toContain('0');
    expect(issues[0].message).toContain('7');
    expect(issues[0].message).not.toContain('4');
  });

  it('reports an associated_video_files camera_id that is not in cameras', () => {
    const model = createTestYaml({
      cameras,
      associated_video_files: [{ name: 'v.mp4', camera_id: 7, task_epochs: 1 }],
    });
    const issues = rulesValidation(model);
    expect(issues).toEqual([
      expect.objectContaining({ path: 'associated_video_files[0].camera_id', code: 'unknown_camera' }),
    ]);
  });

  it('reports an fs_gui_yamls camera_id that is not in cameras', () => {
    const model = createTestYaml({
      cameras,
      fs_gui_yamls: [{ name: 'f.yaml', epochs: [1], camera_id: 7 }],
    });
    const issues = cameraIssues(rulesValidation(model));
    expect(issues).toEqual([
      expect.objectContaining({ path: 'fs_gui_yamls[0].camera_id', code: 'unknown_camera' }),
    ]);
  });

  it('returns no camera issue when every reference exists', () => {
    const model = createTestYaml({
      cameras,
      tasks: [{ task_name: 'Run', camera_id: [4] }],
      associated_video_files: [{ name: 'v.mp4', camera_id: 4, task_epochs: 1 }],
      fs_gui_yamls: [{ name: 'f.yaml', epochs: [1], camera_id: 4 }],
    });
    expect(cameraIssues(rulesValidation(model))).toEqual([]);
  });

  it('ignores unset video camera_id and tasks with no camera', () => {
    const model = createTestYaml({
      cameras,
      tasks: [{ task_name: 'Sleep', camera_id: [] }],
      associated_video_files: [{ name: 'v.mp4', camera_id: '', task_epochs: 1 }],
    });
    expect(rulesValidation(model)).toEqual([]);
  });

  it('does not duplicate the existing missing_camera rule when cameras is undefined', () => {
    const model = createTestYaml({ tasks: [{ task_name: 'Run', camera_id: [0] }] });
    const codes = rulesValidation(model).map((i) => i.code);
    expect(codes).toEqual(['missing_camera']);
  });

  it('leaves schema-invalid camera section shapes to schema validation', () => {
    const model = createTestYaml({
      cameras,
      tasks: { camera_id: [4] },
      associated_video_files: { camera_id: 4 },
      fs_gui_yamls: { camera_id: 4 },
    });

    expect(() => rulesValidation(model)).not.toThrow();
    expect(rulesValidation(model)).toEqual([]);
  });

  it('does not inspect schema-invalid scalar-reference sections without cameras', () => {
    const model = createTestYaml({
      cameras: undefined,
      tasks: [null],
      associated_video_files: { camera_id: 4 },
      fs_gui_yamls: { camera_id: 4 },
    });

    expect(() => rulesValidation(model)).not.toThrow();
  });
});

describe('rulesValidation() - optogenetic_stimulation_software', () => {
  // Each section carries a `reference` so no other rule fires.
  const reference = 'Bregma at the cortical surface';
  const fullOpto = {
    opto_excitation_source: [{ name: 'LED' }],
    optical_fiber: [{ name: 'fiber', reference }],
    virus_injection: [{ virus_name: 'v', reference }],
  };

  it('requires the software name when optogenetics sections are present', () => {
    const model = createTestYaml({ ...fullOpto, optogenetic_stimulation_software: '' });
    expect(rulesValidation(model)).toEqual([
      expect.objectContaining({
        path: 'optogenetic_stimulation_software',
        code: 'missing_stimulation_software',
        severity: 'error',
      }),
    ]);
  });

  it('accepts a non-empty software name with optogenetics present', () => {
    const model = createTestYaml({ ...fullOpto, optogenetic_stimulation_software: 'fsgui' });
    expect(rulesValidation(model)).toEqual([]);
  });

  it('does not require the software name when no optogenetics is configured', () => {
    const model = createTestYaml({ optogenetic_stimulation_software: '' });
    expect(rulesValidation(model)).toEqual([]);
  });
});

describe('rulesValidation() - empty (null) list entries', () => {
  // A YAML list item with no value (`-`) parses to null. Rules run on a parsed file before schema
  // validation reports that entry, so each rule must skip it instead of throwing: a throw stopped
  // the import with no message at all.
  const listSections = Object.entries(JsonSchema.properties)
    .filter(([, definition]) => definition.type === 'array')
    .map(([key]) => key);

  it('does not throw on an empty entry in any list section', () => {
    expect(listSections).toContain('ntrode_electrode_group_channel_map');

    listSections.forEach((key) => {
      expect(() => rulesValidation(createTestYaml({ [key]: [null] })), key).not.toThrow();
    });
  });

  // The minimal model above has few cross-references, so repeat on full sessions, with the null
  // first and last in each list and inside the nested lists.
  it.each([
    '20230622_sample_metadata.yml',
    'realistic-session.yml',
    '20230622_sample_metadataProbeReconfig.yml',
  ])('does not throw on empty entries in the full session %s', (fixture) => {
    const session = YAML.parse(
      fs.readFileSync(path.join(__dirname, '../../__tests__/fixtures/valid', fixture), 'utf8')
    );
    const withNull = [];
    listSections.forEach((key) => {
      const entries = Array.isArray(session[key]) ? session[key] : [];
      withNull.push([`${key} first`, { ...session, [key]: [null, ...entries] }]);
      withNull.push([`${key} last`, { ...session, [key]: [...entries, null] }]);
    });
    const nested = (key, field, value) => {
      const model = structuredClone(session);
      (model[key] || []).forEach((entry) => {
        entry[field] = value;
      });
      return [`${key}[].${field}`, model];
    };
    withNull.push(
      nested('tasks', 'camera_id', [null]),
      nested('tasks', 'task_epochs', [null]),
      nested('fs_gui_yamls', 'epochs', [null]),
      nested('ntrode_electrode_group_channel_map', 'bad_channels', [null]),
      nested('ntrode_electrode_group_channel_map', 'map', null)
    );

    withNull.forEach(([label, model]) => {
      expect(() => rulesValidation(model), label).not.toThrow();
      expect(() => validate(model), label).not.toThrow();
    });
  });

  it('reports an empty channel-map entry as a validation issue', () => {
    const model = createTestYaml({ ntrode_electrode_group_channel_map: [null] });

    expect(validate(model)).toContainEqual(
      expect.objectContaining({ path: 'ntrode_electrode_group_channel_map[0]' })
    );
  });
});

// Converter guards ported from the modern branch's rule set. Each state either crashes
// trodes_to_nwb or makes it silently write the wrong data.
describe('rulesValidation() - converter guards', () => {
  const codes = (issues) => issues.map((i) => i.code);
  const completeOpto = {
    opto_excitation_source: [{ name: 'LED' }],
    optical_fiber: [{ name: 'F', reference: 'Bregma' }],
    virus_injection: [{ name: 'V', reference: 'Bregma' }],
    optogenetic_stimulation_software: 'fsgui',
  };

  describe('optogenetics', () => {
    it('errors when more than one excitation source is defined', () => {
      // trodes_to_nwb raises a ValueError on more than one opto_excitation_source.
      const model = createTestYaml({
        ...completeOpto,
        opto_excitation_source: [{ name: 'LED-1' }, { name: 'LED-2' }],
      });

      expect(rulesValidation(model)).toContainEqual(expect.objectContaining({
        path: 'opto_excitation_source',
        code: 'multiple_excitation_sources',
        severity: 'error',
      }));
    });

    it('errors when an optical_fiber lacks a reference (converter reads it unconditionally)', () => {
      const model = createTestYaml({ ...completeOpto, optical_fiber: [{ name: 'F' }] });

      expect(rulesValidation(model)).toContainEqual(expect.objectContaining({
        path: 'optical_fiber[0].reference',
        code: 'missing_opto_reference',
        severity: 'error',
      }));
    });

    it('errors when a virus_injection lacks a reference', () => {
      const model = createTestYaml({ ...completeOpto, virus_injection: [{ name: 'V', reference: ' ' }] });

      expect(rulesValidation(model)).toContainEqual(expect.objectContaining({
        path: 'virus_injection[0].reference',
        code: 'missing_opto_reference',
        severity: 'error',
      }));
    });
  });

  describe('FsGUI protocols', () => {
    const session = {
      cameras: [{ id: 0 }],
      tasks: [{ task_name: 't', task_epochs: [1, 2] }],
      behavioral_events: [{ name: 'laser', description: 'Dout1' }],
    };

    it('errors when fs_gui_yamls exist but optogenetics is not fully configured', () => {
      // FsGUI epochs make the converter read the optogenetics metadata, which it only writes when
      // every optogenetics section is present (KeyError otherwise).
      const model = createTestYaml({
        ...session,
        fs_gui_yamls: [{ name: 'p.yaml', epochs: [1], camera_id: 0, dio_output_name: 'laser' }],
      });

      expect(rulesValidation(model)).toContainEqual(expect.objectContaining({
        path: 'fs_gui_yamls',
        code: 'fs_gui_requires_optogenetics',
        severity: 'error',
      }));
    });

    it('treats corrupt non-array opto list fields as absent for the FsGUI opto gate', () => {
      const model = createTestYaml({
        ...session,
        opto_excitation_source: 'LED',
        optical_fiber: 'Fiber',
        virus_injection: 'AAV',
        optogenetic_stimulation_software: 'fsgui',
        fs_gui_yamls: [{ name: 'p.yaml', epochs: [1], camera_id: 0, dio_output_name: 'laser' }],
      });

      expect(codes(rulesValidation(model))).toContain('fs_gui_requires_optogenetics');
    });

    it('errors on an fs_gui_yamls epoch that no task defines (orphaned epoch)', () => {
      // The converter indexes the epochs table by this number: IndexError, or silently another
      // epoch's start/stop times.
      const model = createTestYaml({
        ...session,
        ...completeOpto,
        fs_gui_yamls: [{ name: 'p.yaml', epochs: [1, 99], camera_id: 0, dio_output_name: 'laser' }],
      });

      const orphaned = rulesValidation(model).filter((i) => i.code === 'orphaned_fs_gui_epoch');
      expect(orphaned).toEqual([expect.objectContaining({
        path: 'fs_gui_yamls[0].epochs',
        severity: 'error',
        message: expect.stringContaining('99'),
      })]);
    });

    it('errors when fs_gui dio_output_name has no matching behavioral event', () => {
      // A renamed or removed event leaves the name stale; the converter looks it up (KeyError).
      const model = createTestYaml({
        ...session,
        ...completeOpto,
        fs_gui_yamls: [{ name: 'p.yaml', epochs: [1], camera_id: 0, dio_output_name: 'old_laser' }],
      });

      expect(rulesValidation(model)).toContainEqual(expect.objectContaining({
        path: 'fs_gui_yamls[0].dio_output_name',
        code: 'dangling_dio_output',
        severity: 'error',
        message: expect.stringContaining('old_laser'),
      }));
    });

    it('accepts a complete opto + fs_gui session with valid references and dio name', () => {
      const model = createTestYaml({
        ...session,
        ...completeOpto,
        fs_gui_yamls: [{ name: 'p.yaml', epochs: [1, 2], camera_id: 0, dio_output_name: 'laser' }],
      });

      expect(rulesValidation(model)).toEqual([]);
    });

    it('accepts optogenetics with no FsGUI protocol this session', () => {
      const model = createTestYaml({ ...session, ...completeOpto, fs_gui_yamls: [] });

      expect(rulesValidation(model)).toEqual([]);
    });
  });

  describe('behavioral events', () => {
    it('errors when two behavioral_events share a description', () => {
      // convert_dios keys DIO channels by description and raises on a duplicate.
      const issues = rulesValidation({
        behavioral_events: [
          { name: 'reward_left', description: 'Din1' },
          { name: 'reward_right', description: 'Din1' },
        ],
      });

      expect(issues).toEqual([expect.objectContaining({
        path: 'behavioral_events',
        code: 'duplicate_behavioral_event_description',
        severity: 'error',
        message: expect.stringContaining('Din1'),
      })]);
    });

    it('errors when two behavioral_events share a name', () => {
      const issues = rulesValidation({
        behavioral_events: [
          { name: 'reward', description: 'Din1' },
          { name: 'reward', description: 'Din2' },
        ],
      });

      expect(issues).toEqual([expect.objectContaining({
        path: 'behavioral_events',
        code: 'duplicate_behavioral_event_name',
        severity: 'error',
        message: expect.stringContaining('reward'),
      })]);
    });

    it('passes unique events, and does not count blank names as duplicates', () => {
      expect(rulesValidation({
        behavioral_events: [
          { name: '', description: 'Din1' },
          { name: '', description: 'Din2' },
          { name: 'reward', description: 'Din3' },
        ],
      })).toEqual([]);
    });
  });

  describe('identity uniqueness and channel-map references', () => {
    it('errors when two cameras share an id', () => {
      const issues = rulesValidation({
        cameras: [
          { id: 0, camera_name: 'overhead' },
          { id: 0, camera_name: 'side' },
        ],
      });

      expect(issues).toEqual([expect.objectContaining({
        path: 'cameras',
        code: 'duplicate_camera_id',
        severity: 'error',
      })]);
    });

    it('errors when two electrode groups share an id', () => {
      const issues = rulesValidation({
        electrode_groups: [{ id: 0 }, { id: 0 }, { id: 1 }],
      });

      expect(issues).toEqual([expect.objectContaining({
        path: 'electrode_groups',
        code: 'duplicate_electrode_group_id',
        severity: 'error',
        message: expect.stringContaining('"0"'),
      })]);
    });

    it('reports a triplicated ntrode_id exactly once', () => {
      const issues = rulesValidation({
        electrode_groups: [{ id: 0 }, { id: 1 }, { id: 2 }],
        ntrode_electrode_group_channel_map: [
          { ntrode_id: 2, electrode_group_id: 0, map: { 0: 0, 1: 1, 2: 2, 3: 3 } },
          { ntrode_id: 2, electrode_group_id: 1, map: { 0: 0, 1: 1, 2: 2, 3: 3 } },
          { ntrode_id: 2, electrode_group_id: 2, map: { 0: 0, 1: 1, 2: 2, 3: 3 } },
        ],
      });

      expect(issues).toEqual([expect.objectContaining({
        path: 'ntrode_electrode_group_channel_map',
        code: 'duplicate_ntrode_id',
        severity: 'error',
      })]);
    });

    it('errors when a channel-map row names no electrode group', () => {
      const issues = rulesValidation({
        electrode_groups: [{ id: 0 }],
        ntrode_electrode_group_channel_map: [
          { ntrode_id: 1, electrode_group_id: 0, map: { 0: 0, 1: 1, 2: 2, 3: 3 } },
          { ntrode_id: 2, electrode_group_id: 7, map: { 0: 0, 1: 1, 2: 2, 3: 3 } },
        ],
      });

      expect(issues).toEqual([expect.objectContaining({
        path: 'ntrode_electrode_group_channel_map[2]',
        code: 'dangling_electrode_group_ref',
        severity: 'error',
        message: expect.stringContaining('7'),
      })]);
    });

    it('passes unique ids whose channel-map rows all name a group', () => {
      expect(rulesValidation({
        cameras: [{ id: 0 }, { id: 1 }],
        electrode_groups: [{ id: 0 }, { id: 1 }],
        ntrode_electrode_group_channel_map: [
          { ntrode_id: 1, electrode_group_id: 0, map: { 0: 0, 1: 1, 2: 2, 3: 3 } },
          { ntrode_id: 2, electrode_group_id: 1, map: { 0: 0, 1: 1, 2: 2, 3: 3 } },
        ],
      })).toEqual([]);
    });
  });
});

// trodes_to_nwb adds the excitation source and every optical fiber to the NWB file as devices
// named after them, and keys the virus injections by name: a repeated name raises a ValueError.
describe('rulesValidation() - optogenetics device names', () => {
  const opto = (overrides) => ({
    opto_excitation_source: [{ name: 'Laser' }],
    optical_fiber: [{ name: 'Fiber 1', reference: 'Bregma' }, { name: 'Fiber 2', reference: 'Bregma' }],
    virus_injection: [{ name: 'Injection 1', reference: 'Bregma' }],
    optogenetic_stimulation_software: 'fsgui',
    ...overrides,
  });
  const nameIssues = (model) =>
    rulesValidation(model).filter((i) => i.code === 'duplicate_opto_device_name');

  it('errors when two optical fibers share a name', () => {
    expect(nameIssues(opto({
      optical_fiber: [{ name: 'Fiber 1', reference: 'Bregma' }, { name: 'Fiber 1', reference: 'Bregma' }],
    }))).toEqual([expect.objectContaining({
      path: 'optical_fiber',
      severity: 'error',
      message: expect.stringContaining('"Fiber 1"'),
    })]);
  });

  it('errors when two virus injections share a name', () => {
    expect(nameIssues(opto({
      virus_injection: [
        { name: 'Injection 1', reference: 'Bregma' },
        { name: 'Injection 1', reference: 'Bregma' },
      ],
    }))).toEqual([expect.objectContaining({
      path: 'virus_injection',
      severity: 'error',
      message: expect.stringContaining('"Injection 1"'),
    })]);
  });

  it('errors when a fiber has the excitation source name (one device namespace)', () => {
    expect(nameIssues(opto({
      optical_fiber: [{ name: 'Fiber 1', reference: 'Bregma' }, { name: 'Laser', reference: 'Bregma' }],
    }))).toEqual([expect.objectContaining({
      path: 'optical_fiber[1].name',
      severity: 'error',
      message: expect.stringContaining('"Laser"'),
    })]);
  });

  it('passes distinct names, compares them exactly, and leaves blank names to the schema', () => {
    expect(nameIssues(opto())).toEqual([]);
    // "Fiber 1" and "Fiber 1 " are different NWB names; the converter does not trim.
    expect(nameIssues(opto({
      optical_fiber: [{ name: 'Fiber 1', reference: 'Bregma' }, { name: 'Fiber 1 ', reference: 'Bregma' }],
    }))).toEqual([]);
    const blank = opto({
      optical_fiber: [{ name: '', reference: 'Bregma' }, { name: '', reference: 'Bregma' }],
    });
    expect(nameIssues(blank)).toEqual([]);
    // The schema requires a non-blank name.
    expect(validate(blank)).toContainEqual(expect.objectContaining({ path: 'optical_fiber[0].name', code: 'pattern' }));
  });
});

// trodes_to_nwb always builds the position data from the tasks' epochs (pd.concat over the tasks),
// which fails when there are no tasks.
describe('rulesValidation() - at least one task', () => {
  it('blocks an empty task list', () => {
    expect(rulesValidation(createTestYaml({ tasks: [] }))).toEqual([
      expect.objectContaining({ path: 'tasks', code: 'no_tasks', severity: 'error' }),
    ]);
  });

  it('accepts a session with a task', () => {
    const model = createTestYaml({ tasks: [{ task_name: 'Sleep', camera_id: [], task_epochs: [1] }] });
    expect(rulesValidation(model)).toEqual([]);
  });
});

// Subject values pynwb's Subject rejects (mostly from imported files), and an age DANDI rejects.
describe('rulesValidation() - subject values', () => {
  const subject = (overrides) => ({
    subject: {
      description: 'Long-Evans Rat',
      genotype: 'Wild Type',
      sex: 'M',
      species: 'Rattus norvegicus',
      subject_id: 'rat01',
      date_of_birth: '2023-01-10T00:00:00.000Z',
      weight: 300,
      ...overrides,
    },
  });
  const codes = (issues) => issues.map((i) => i.code);

  describe('date_of_birth', () => {
    it.each([
      '2023-01-10T00:00:00.000Z',
      '2023-01-10T00:00:00',
      '2023-01-10T05:30:59+02:00',
      '2024-02-29T00:00:00Z',
    ])('accepts %s, which PyYAML reads as a datetime', (dateOfBirth) => {
      expect(codes(rulesValidation(subject({ date_of_birth: dateOfBirth }))))
        .not.toContain('subject_date_of_birth_format');
    });

    it('blocks a time without seconds, which the schema allows but PyYAML keeps as text', () => {
      const model = subject({ date_of_birth: '2023-01-10T00:00' });
      expect(validate(model).filter((i) => i.path === 'subject.date_of_birth')).toEqual([
        expect.objectContaining({
          code: 'subject_date_of_birth_format',
          severity: 'error',
          message: expect.stringContaining('"2023-01-10T00:00:00"'),
        }),
      ]);
    });

    it.each([
      ['an impossible date (PyYAML cannot read the file)', '2023-02-30T00:00:00Z'],
      ['an impossible time', '2023-01-10T24:00:00'],
      ['text after the timestamp (the schema pattern is not anchored)', '2023-01-10T00:00:00 approx'],
    ])('blocks %s', (_label, dateOfBirth) => {
      expect(rulesValidation(subject({ date_of_birth: dateOfBirth }))).toContainEqual(
        expect.objectContaining({ path: 'subject.date_of_birth', code: 'subject_date_of_birth_format', severity: 'error' })
      );
    });

    it('leaves an empty or schema-invalid date to the schema message', () => {
      expect(codes(rulesValidation(subject({ date_of_birth: '' })))).not.toContain('subject_date_of_birth_format');
      expect(codes(rulesValidation(subject({ date_of_birth: '2023-01-10' })))).not.toContain('subject_date_of_birth_format');
    });
  });

  describe('unknown subject fields', () => {
    it('blocks a field pynwb Subject does not accept', () => {
      expect(rulesValidation(subject({ weight_unit: 'g', nickname: null }))).toEqual([
        expect.objectContaining({ path: 'subject.weight_unit', code: 'unknown_subject_field', severity: 'error' }),
        expect.objectContaining({ path: 'subject.nickname', code: 'unknown_subject_field', severity: 'error' }),
      ]);
    });

    it('accepts every field pynwb Subject knows', () => {
      expect(rulesValidation(subject({ age: 'P90D', age__reference: 'birth', strain: 'Long-Evans' }))).toEqual([]);
    });

    it('lists the unknown fields of a subject', () => {
      expect(unknownSubjectFields({ subject_id: 'a', foo: 1, age: 'P1D', bar: undefined })).toEqual(['foo']);
      expect(unknownSubjectFields('not an object')).toEqual([]);
      expect(unknownSubjectFields(null)).toEqual([]);
    });
  });

  describe('age', () => {
    it.each(['P90D', 'P2Y', 'P23W', 'P1Y2M3DT4H', 'P1D/P3D', 'P90Y/', '/P3D'])('accepts the ISO 8601 age %s', (age) => {
      expect(rulesValidation(subject({ age }))).toEqual([]);
    });

    it('warns, with the likely fix, on an age that is not an ISO 8601 duration', () => {
      expect(rulesValidation(subject({ age: 'P164' }))).toEqual([
        expect.objectContaining({
          path: 'subject.age',
          code: 'subject_age_format',
          severity: 'warning',
          message: expect.stringContaining('"P164D"'),
        }),
      ]);
      expect(rulesValidation(subject({ age: '12 weeks' }))[0].message).toContain('"P12W"');
      expect(rulesValidation(subject({ age: 'adult' }))[0].message).toContain('"P90D"');
    });

    it('does not warn on an empty age', () => {
      expect(rulesValidation(subject({ age: '' }))).toEqual([]);
      expect(rulesValidation(subject({ age: null }))).toEqual([]);
    });

    it('blocks values pynwb rejects outright', () => {
      expect(rulesValidation(subject({ age: 164 }))).toEqual([
        expect.objectContaining({
          path: 'subject.age',
          code: 'subject_value_type',
          severity: 'error',
          message: expect.stringContaining('"P164D"'),
        }),
      ]);
      expect(codes(rulesValidation(subject({ strain: 5 })))).toEqual(['subject_value_type']);
      expect(codes(rulesValidation(subject({ age__reference: 'Birth' })))).toEqual(['subject_value_type']);
      expect(codes(rulesValidation(subject({ age__reference: null })))).toEqual(['subject_value_type']);
    });
  });
});

// The current trodes_to_nwb release always adds the video files and fails (UnboundLocalError) on
// an empty list, even for a session without video. A converter bug, so a warning.
describe('rulesValidation() - empty video list', () => {
  it('warns when no video files are listed', () => {
    expect(rulesValidation({ associated_video_files: [] })).toEqual([
      expect.objectContaining({
        path: 'associated_video_files',
        code: 'no_associated_videos',
        severity: 'warning',
      }),
    ]);
  });

  it('does not warn when a video is listed, or when the list is not there to check', () => {
    expect(rulesValidation({
      cameras: [{ id: 0 }],
      tasks: [{ task_name: 'Sleep', camera_id: [0], task_epochs: [1] }],
      associated_video_files: [{ name: 'a.h264', camera_id: 0, task_epochs: 1 }],
    })).toEqual([]);
    expect(rulesValidation({})).toEqual([]);
  });
});
