/**
 * Path Normalization Tests
 *
 * Tests for converting AJV instancePath (slash-separated) to normalized
 * dot notation with array brackets.
 *
 * TDD: Tests written FIRST, then implementation.
 */

import { describe, it, expect } from 'vitest';
import { normalizeAjvPath } from '../paths';

describe('normalizeAjvPath()', () => {
  describe('Root Paths', () => {
    it('should convert root field path', () => {
      expect(normalizeAjvPath('/experimenter')).toBe('experimenter');
    });

    it('should convert another root field', () => {
      expect(normalizeAjvPath('/lab')).toBe('lab');
    });

    it('should convert session_start_time', () => {
      expect(normalizeAjvPath('/session_start_time')).toBe('session_start_time');
    });
  });

  describe('Nested Object Paths', () => {
    it('should convert nested path with dot notation', () => {
      expect(normalizeAjvPath('/subject/weight')).toBe('subject.weight');
    });

    it('should convert another nested path', () => {
      expect(normalizeAjvPath('/subject/sex')).toBe('subject.sex');
    });

    it('should convert data_acq_device nested paths', () => {
      expect(normalizeAjvPath('/data_acq_device/name')).toBe('data_acq_device.name');
      expect(normalizeAjvPath('/data_acq_device/system')).toBe('data_acq_device.system');
    });

    it('should convert deeply nested paths', () => {
      expect(normalizeAjvPath('/a/b/c/d')).toBe('a.b.c.d');
    });
  });

  describe('Array Paths', () => {
    it('should convert array index to bracket notation', () => {
      expect(normalizeAjvPath('/cameras/0')).toBe('cameras[0]');
    });

    it('should convert array element property path', () => {
      expect(normalizeAjvPath('/cameras/0/id')).toBe('cameras[0].id');
    });

    it('should convert another array element property', () => {
      expect(normalizeAjvPath('/cameras/0/manufacturer')).toBe('cameras[0].manufacturer');
    });

    it('should handle multiple array levels', () => {
      expect(normalizeAjvPath('/tasks/0/camera_ids/0')).toBe('tasks[0].camera_ids[0]');
    });

    it('should handle double-digit array indices', () => {
      expect(normalizeAjvPath('/cameras/15/id')).toBe('cameras[15].id');
      expect(normalizeAjvPath('/electrode_groups/99/location')).toBe('electrode_groups[99].location');
    });
  });

  describe('Complex Nested Array Paths', () => {
    it('should convert electrode_groups array path', () => {
      expect(normalizeAjvPath('/electrode_groups/0/targeted_x')).toBe('electrode_groups[0].targeted_x');
    });

    it('should convert ntrode_electrode_group_channel_map path', () => {
      expect(normalizeAjvPath('/ntrode_electrode_group_channel_map/0/ntrode_id'))
        .toBe('ntrode_electrode_group_channel_map[0].ntrode_id');
    });

    it('should handle array of objects with nested properties', () => {
      expect(normalizeAjvPath('/tasks/0/task_name')).toBe('tasks[0].task_name');
      expect(normalizeAjvPath('/tasks/0/task_description')).toBe('tasks[0].task_description');
    });

    it('should handle optogenetics arrays', () => {
      expect(normalizeAjvPath('/opto_excitation_source/0/opto_excitation_source_name'))
        .toBe('opto_excitation_source[0].opto_excitation_source_name');
      expect(normalizeAjvPath('/optical_fiber/0/fiber_model_number'))
        .toBe('optical_fiber[0].fiber_model_number');
      expect(normalizeAjvPath('/virus_injection/0/virus_name'))
        .toBe('virus_injection[0].virus_name');
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty string', () => {
      expect(normalizeAjvPath('')).toBe('');
    });

    it('should handle root slash only', () => {
      expect(normalizeAjvPath('/')).toBe('');
    });

    it('should handle path with trailing slash', () => {
      expect(normalizeAjvPath('/experimenter/')).toBe('experimenter');
    });

    it('should handle path with multiple trailing slashes', () => {
      expect(normalizeAjvPath('/experimenter///')).toBe('experimenter');
    });

    it('should handle path with double slashes in middle', () => {
      expect(normalizeAjvPath('/subject//weight')).toBe('subject.weight');
    });
  });

  describe('Real-World AJV Paths', () => {
    it('should handle actual AJV error paths from schema', () => {
      // From actual validation errors in the app
      const realPaths = [
        { input: '/experimenter', expected: 'experimenter' },
        { input: '/lab', expected: 'lab' },
        { input: '/institution', expected: 'institution' },
        { input: '/session_start_time', expected: 'session_start_time' },
        { input: '/subject/date_of_birth', expected: 'subject.date_of_birth' },
        { input: '/subject/weight', expected: 'subject.weight' },
        { input: '/subject/sex', expected: 'subject.sex' },
        { input: '/cameras/0/id', expected: 'cameras[0].id' },
        { input: '/cameras/0/meters_per_pixel', expected: 'cameras[0].meters_per_pixel' },
        { input: '/electrode_groups/0/location', expected: 'electrode_groups[0].location' },
        { input: '/ntrode_electrode_group_channel_map/0/map', expected: 'ntrode_electrode_group_channel_map[0].map' },
      ];

      realPaths.forEach(({ input, expected }) => {
        expect(normalizeAjvPath(input)).toBe(expected);
      });
    });
  });

  describe('Path Component Handling', () => {
    it('should preserve underscores in field names', () => {
      expect(normalizeAjvPath('/session_start_time')).toBe('session_start_time');
      expect(normalizeAjvPath('/data_acq_device/adc_circuit')).toBe('data_acq_device.adc_circuit');
    });

    it('should handle numeric-looking field names that are not indices', () => {
      // This is edge case - field names that look like numbers but aren't array indices
      // In practice, this shouldn't happen in our schema
      expect(normalizeAjvPath('/field123/value')).toBe('field123.value');
    });

    it('should distinguish between array index and property name', () => {
      // Array index: /cameras/0/id → cameras[0].id
      expect(normalizeAjvPath('/cameras/0/id')).toBe('cameras[0].id');

      // Property name that's a number: /object/123 → object.123 (if not in array context)
      // But in our schema, numbers after properties are always array indices
    });
  });
});
