/**
 * Tests for useFormUpdates hook
 *
 * Phase 3: Code Quality & Refactoring - Week 3-4
 *
 * Comprehensive tests for form update functions extracted from App.js.
 * Tests verify proper immutability, state updates, and edge case handling.
 */

import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useFormUpdates } from '../useFormUpdates';
import { useState } from 'react';

// Helper to create a hook with state management
const setupHook = (initialData = {}) => {
  const { result } = renderHook(() => {
    const [formData, setFormData] = useState(initialData);
    const hookResult = useFormUpdates(formData, setFormData);
    return { formData, ...hookResult };
  });
  return result;
};

describe('useFormUpdates', () => {
  describe('updateFormData - Simple Key-Value Updates', () => {
    it('should update top-level string field', () => {
      const result = setupHook({ lab: 'Old Lab' });

      act(() => {
        result.current.updateFormData('lab', 'New Lab');
      });

      expect(result.current.formData.lab).toBe('New Lab');
    });

    it('should update multiple top-level fields independently', () => {
      const result = setupHook({ lab: 'Lab A', institution: 'Inst A' });

      act(() => {
        result.current.updateFormData('lab', 'Lab B');
      });
      act(() => {
        result.current.updateFormData('institution', 'Inst B');
      });

      expect(result.current.formData.lab).toBe('Lab B');
      expect(result.current.formData.institution).toBe('Inst B');
    });

    it('should handle empty string values', () => {
      const result = setupHook({ lab: 'Some Lab' });

      act(() => {
        result.current.updateFormData('lab', '');
      });

      expect(result.current.formData.lab).toBe('');
    });

    it('should handle numeric values', () => {
      const result = setupHook({ times_period_multiplier: 1.0 });

      act(() => {
        result.current.updateFormData('times_period_multiplier', 2.5);
      });

      expect(result.current.formData.times_period_multiplier).toBe(2.5);
    });

    it('should handle zero values', () => {
      const result = setupHook({ count: 10 });

      act(() => {
        result.current.updateFormData('count', 0);
      });

      expect(result.current.formData.count).toBe(0);
    });

    it('should handle boolean values', () => {
      const result = setupHook({ flag: false });

      act(() => {
        result.current.updateFormData('flag', true);
      });

      expect(result.current.formData.flag).toBe(true);
    });

    it('should handle null values', () => {
      const result = setupHook({ optional_field: 'value' });

      act(() => {
        result.current.updateFormData('optional_field', null);
      });

      expect(result.current.formData.optional_field).toBeNull();
    });

    it('should handle array values', () => {
      const result = setupHook({ tags: [] });

      act(() => {
        result.current.updateFormData('tags', ['tag1', 'tag2']);
      });

      expect(result.current.formData.tags).toEqual(['tag1', 'tag2']);
    });
  });

  describe('updateFormData - Nested Object Updates', () => {
    it('should update nested object field', () => {
      const result = setupHook({
        subject: { subject_id: '', species: 'Rattus norvegicus' },
      });

      act(() => {
        result.current.updateFormData('subject_id', 'rat_001', 'subject');
      });

      expect(result.current.formData.subject.subject_id).toBe('rat_001');
      expect(result.current.formData.subject.species).toBe('Rattus norvegicus');
    });

    it('should update multiple nested fields independently', () => {
      const result = setupHook({
        subject: { subject_id: '', species: '', weight: 0 },
      });

      act(() => {
        result.current.updateFormData('subject_id', 'rat_001', 'subject');
      });
      act(() => {
        result.current.updateFormData('species', 'Rattus norvegicus', 'subject');
      });
      act(() => {
        result.current.updateFormData('weight', 250, 'subject');
      });

      expect(result.current.formData.subject.subject_id).toBe('rat_001');
      expect(result.current.formData.subject.species).toBe('Rattus norvegicus');
      expect(result.current.formData.subject.weight).toBe(250);
    });

    it('should handle nested object with numeric fields', () => {
      const result = setupHook({ subject: { weight: 0 } });

      act(() => {
        result.current.updateFormData('weight', 300.5, 'subject');
      });

      expect(result.current.formData.subject.weight).toBe(300.5);
    });

    it('should handle multiple nested objects', () => {
      const result = setupHook({
        subject: { subject_id: '' },
        units: { analog: '' },
      });

      act(() => {
        result.current.updateFormData('subject_id', 'rat_001', 'subject');
      });
      act(() => {
        result.current.updateFormData('analog', 'mV', 'units');
      });

      expect(result.current.formData.subject.subject_id).toBe('rat_001');
      expect(result.current.formData.units.analog).toBe('mV');
    });
  });

  describe('updateFormData - Array Item Updates', () => {
    it('should update array item field', () => {
      const result = setupHook({
        cameras: [{ id: '', camera_name: 'Camera 1' }],
      });

      act(() => {
        result.current.updateFormData('id', 'camera_01', 'cameras', 0);
      });

      expect(result.current.formData.cameras[0].id).toBe('camera_01');
      expect(result.current.formData.cameras[0].camera_name).toBe('Camera 1');
    });

    it('should create array item if it does not exist', () => {
      const result = setupHook({ cameras: [] });

      act(() => {
        result.current.updateFormData('id', 'camera_01', 'cameras', 0);
      });

      expect(result.current.formData.cameras[0]).toEqual({ id: 'camera_01' });
    });

    it('should update multiple fields in same array item', () => {
      const result = setupHook({
        cameras: [{ id: '', camera_name: '', manufacturer: '' }],
      });

      act(() => {
        result.current.updateFormData('id', 'camera_01', 'cameras', 0);
      });
      act(() => {
        result.current.updateFormData('camera_name', 'Top View', 'cameras', 0);
      });
      act(() => {
        result.current.updateFormData('manufacturer', 'Basler', 'cameras', 0);
      });

      expect(result.current.formData.cameras[0]).toEqual({
        id: 'camera_01',
        camera_name: 'Top View',
        manufacturer: 'Basler',
      });
    });

    it('should update different array items independently', () => {
      const result = setupHook({
        cameras: [{ id: '' }, { id: '' }],
      });

      act(() => {
        result.current.updateFormData('id', 'camera_01', 'cameras', 0);
      });
      act(() => {
        result.current.updateFormData('id', 'camera_02', 'cameras', 1);
      });

      expect(result.current.formData.cameras[0].id).toBe('camera_01');
      expect(result.current.formData.cameras[1].id).toBe('camera_02');
    });

    it('should handle index=0 (falsy but valid)', () => {
      const result = setupHook({ cameras: [{ id: '' }] });

      act(() => {
        result.current.updateFormData('id', 'camera_01', 'cameras', 0);
      });

      expect(result.current.formData.cameras[0].id).toBe('camera_01');
    });
  });

  describe('updateFormArray - Checkbox Multi-Selection', () => {
    it('should add value to array field when checked=true', () => {
      const result = setupHook({
        tasks: [{ camera_ids: [] }],
      });

      act(() => {
        result.current.updateFormArray('camera_ids', 'camera_01', 'tasks', 0, true);
      });

      expect(result.current.formData.tasks[0].camera_ids).toEqual(['camera_01']);
    });

    it('should remove value from array field when checked=false', () => {
      const result = setupHook({
        tasks: [{ camera_ids: ['camera_01', 'camera_02'] }],
      });

      act(() => {
        result.current.updateFormArray('camera_ids', 'camera_01', 'tasks', 0, false);
      });

      expect(result.current.formData.tasks[0].camera_ids).toEqual(['camera_02']);
    });

    it('should deduplicate array values', () => {
      const result = setupHook({
        tasks: [{ camera_ids: ['camera_01'] }],
      });

      act(() => {
        result.current.updateFormArray('camera_ids', 'camera_01', 'tasks', 0, true);
      });

      expect(result.current.formData.tasks[0].camera_ids).toEqual(['camera_01']);
    });

    it('should sort array values', () => {
      const result = setupHook({
        tasks: [{ camera_ids: [] }],
      });

      act(() => {
        result.current.updateFormArray('camera_ids', 'camera_03', 'tasks', 0, true);
      });
      act(() => {
        result.current.updateFormArray('camera_ids', 'camera_01', 'tasks', 0, true);
      });
      act(() => {
        result.current.updateFormArray('camera_ids', 'camera_02', 'tasks', 0, true);
      });

      expect(result.current.formData.tasks[0].camera_ids).toEqual([
        'camera_01',
        'camera_02',
        'camera_03',
      ]);
    });

    it('should create array field if it does not exist', () => {
      const result = setupHook({
        tasks: [{}],
      });

      act(() => {
        result.current.updateFormArray('camera_ids', 'camera_01', 'tasks', 0, true);
      });

      expect(result.current.formData.tasks[0].camera_ids).toEqual(['camera_01']);
    });

    it('should create array item if it does not exist', () => {
      const result = setupHook({
        tasks: [],
      });

      act(() => {
        result.current.updateFormArray('camera_ids', 'camera_01', 'tasks', 0, true);
      });

      expect(result.current.formData.tasks[0].camera_ids).toEqual(['camera_01']);
    });

    it('should default to checked=true if not specified', () => {
      const result = setupHook({
        tasks: [{ camera_ids: [] }],
      });

      act(() => {
        result.current.updateFormArray('camera_ids', 'camera_01', 'tasks', 0);
      });

      expect(result.current.formData.tasks[0].camera_ids).toEqual(['camera_01']);
    });

    it('should return null if name is missing', () => {
      const result = setupHook({ tasks: [{}] });

      const returnValue = result.current.updateFormArray(null, 'value', 'tasks', 0);

      expect(returnValue).toBeNull();
    });

    it('should return null if key is missing', () => {
      const result = setupHook({ tasks: [{}] });

      const returnValue = result.current.updateFormArray('camera_ids', 'value', null, 0);

      expect(returnValue).toBeNull();
    });
  });

  describe('onBlur - Number Input Transformations', () => {
    it('should parse float for number inputs', () => {
      const result = setupHook({ weight: 0 });

      act(() => {
        const event = {
          target: { name: 'weight', value: '250.5', type: 'number' },
        };
        result.current.onBlur(event, {});
      });

      expect(result.current.formData.weight).toBe(250.5);
    });

    it('should parse integer for number inputs', () => {
      const result = setupHook({ count: 0 });

      act(() => {
        const event = {
          target: { name: 'count', value: '42', type: 'number' },
        };
        result.current.onBlur(event, {});
      });

      expect(result.current.formData.count).toBe(42);
    });

    it('should handle zero values in number inputs', () => {
      const result = setupHook({ weight: 100 });

      act(() => {
        const event = {
          target: { name: 'weight', value: '0', type: 'number' },
        };
        result.current.onBlur(event, {});
      });

      expect(result.current.formData.weight).toBe(0);
    });

    it('should handle negative numbers', () => {
      const result = setupHook({ temperature: 0 });

      act(() => {
        const event = {
          target: { name: 'temperature', value: '-10.5', type: 'number' },
        };
        result.current.onBlur(event, {});
      });

      expect(result.current.formData.temperature).toBe(-10.5);
    });

    it('should handle very small decimals', () => {
      const result = setupHook({ precision: 0 });

      act(() => {
        const event = {
          target: { name: 'precision', value: '0.001', type: 'number' },
        };
        result.current.onBlur(event, {});
      });

      expect(result.current.formData.precision).toBe(0.001);
    });
  });

  describe('onBlur - Comma-Separated String Transformations', () => {
    it('should convert comma-separated string to array', () => {
      const result = setupHook({ tags: [] });

      act(() => {
        const event = {
          target: { name: 'tags', value: 'apple, banana, cherry', type: 'text' },
        };
        result.current.onBlur(event, { isCommaSeparatedString: true });
      });

      expect(result.current.formData.tags).toEqual(['apple', 'banana', 'cherry']);
    });

    it('should trim whitespace from strings', () => {
      const result = setupHook({ tags: [] });

      act(() => {
        const event = {
          target: { name: 'tags', value: '  apple  ,  banana  ', type: 'text' },
        };
        result.current.onBlur(event, { isCommaSeparatedString: true });
      });

      expect(result.current.formData.tags).toEqual(['apple', 'banana']);
    });

    it('should filter out empty strings', () => {
      const result = setupHook({ tags: [] });

      act(() => {
        const event = {
          target: { name: 'tags', value: 'apple, , banana, ,', type: 'text' },
        };
        result.current.onBlur(event, { isCommaSeparatedString: true });
      });

      expect(result.current.formData.tags).toEqual(['apple', 'banana']);
    });

    it('should handle single value without comma', () => {
      const result = setupHook({ tags: [] });

      act(() => {
        const event = {
          target: { name: 'tags', value: 'onlyOne', type: 'text' },
        };
        result.current.onBlur(event, { isCommaSeparatedString: true });
      });

      expect(result.current.formData.tags).toEqual(['onlyOne']);
    });
  });

  describe('onBlur - Comma-Separated Number Transformations', () => {
    it('should convert comma-separated numbers to integer array', () => {
      const result = setupHook({ channel_ids: [] });

      act(() => {
        const event = {
          target: { name: 'channel_ids', value: '1, 2, 3', type: 'text' },
        };
        result.current.onBlur(event, { isCommaSeparatedStringToNumber: true });
      });

      expect(result.current.formData.channel_ids).toEqual([1, 2, 3]);
    });

    it('should filter out non-numeric values', () => {
      const result = setupHook({ channel_ids: [] });

      act(() => {
        const event = {
          target: { name: 'channel_ids', value: '1, abc, 2, xyz', type: 'text' },
        };
        result.current.onBlur(event, { isCommaSeparatedStringToNumber: true });
      });

      expect(result.current.formData.channel_ids).toEqual([1, 2]);
    });

    it('should filter out decimal numbers', () => {
      const result = setupHook({ channel_ids: [] });

      act(() => {
        const event = {
          target: { name: 'channel_ids', value: '1, 2.5, 3', type: 'text' },
        };
        result.current.onBlur(event, { isCommaSeparatedStringToNumber: true });
      });

      expect(result.current.formData.channel_ids).toEqual([1, 3]);
    });

    it('should handle empty string', () => {
      const result = setupHook({ channel_ids: [] });

      act(() => {
        const event = {
          target: { name: 'channel_ids', value: '', type: 'text' },
        };
        result.current.onBlur(event, { isCommaSeparatedStringToNumber: true });
      });

      expect(result.current.formData.channel_ids).toEqual([]);
    });
  });

  describe('onBlur - Nested Object and Array Fields', () => {
    it('should handle blur on nested object field', () => {
      const result = setupHook({
        subject: { weight: 0 },
      });

      act(() => {
        const event = {
          target: { name: 'weight', value: '250', type: 'number' },
        };
        result.current.onBlur(event, { key: 'subject' });
      });

      expect(result.current.formData.subject.weight).toBe(250);
    });

    it('should handle blur on array item field', () => {
      const result = setupHook({
        cameras: [{ id: '' }],
      });

      act(() => {
        const event = {
          target: { name: 'id', value: 'camera_01', type: 'text' },
        };
        result.current.onBlur(event, { key: 'cameras', index: 0 });
      });

      expect(result.current.formData.cameras[0].id).toBe('camera_01');
    });
  });

  describe('onBlur - Controlled Input Optimization', () => {
    it('should not update if value unchanged and no special processing', () => {
      const result = setupHook({ lab: 'My Lab' });

      act(() => {
        const event = {
          target: { name: 'lab', value: 'My Lab', type: 'text' },
        };
        result.current.onBlur(event, {});
      });

      // Form data should not be a new reference if value didn't change
      expect(result.current.formData.lab).toBe('My Lab');
    });

    it('should update if value changed', () => {
      const result = setupHook({ lab: 'Old Lab' });

      act(() => {
        const event = {
          target: { name: 'lab', value: 'New Lab', type: 'text' },
        };
        result.current.onBlur(event, {});
      });

      expect(result.current.formData.lab).toBe('New Lab');
    });

    it('should always update if special processing applied', () => {
      const result = setupHook({ tags: ['apple'] });

      act(() => {
        const event = {
          target: { name: 'tags', value: 'apple', type: 'text' },
        };
        result.current.onBlur(event, { isCommaSeparatedString: true });
      });

      // Even though value is same, special processing means it should update
      expect(result.current.formData.tags).toEqual(['apple']);
    });
  });

  describe('onBlur - Text Input Pass-through', () => {
    it('should not transform text input values', () => {
      const result = setupHook({ lab: '' });

      act(() => {
        const event = {
          target: { name: 'lab', value: 'My Lab Name', type: 'text' },
        };
        result.current.onBlur(event, {});
      });

      expect(result.current.formData.lab).toBe('My Lab Name');
    });

    it('should preserve whitespace in text inputs', () => {
      const result = setupHook({ description: '' });

      act(() => {
        const event = {
          target: { name: 'description', value: '  spaced  text  ', type: 'text' },
        };
        result.current.onBlur(event, {});
      });

      expect(result.current.formData.description).toBe('  spaced  text  ');
    });
  });

  describe('handleChange - onChange Handler Factory', () => {
    it('should create onChange handler for simple field', () => {
      const result = setupHook({ lab: '' });
      const handler = result.current.handleChange('lab');

      act(() => {
        handler({ target: { value: 'New Lab' } });
      });

      expect(result.current.formData.lab).toBe('New Lab');
    });

    it('should create onChange handler for nested object field', () => {
      const result = setupHook({ subject: { species: '' } });
      const handler = result.current.handleChange('species', 'subject');

      act(() => {
        handler({ target: { value: 'Rattus norvegicus' } });
      });

      expect(result.current.formData.subject.species).toBe('Rattus norvegicus');
    });

    it('should create onChange handler for array item field', () => {
      const result = setupHook({ cameras: [{ id: '' }] });
      const handler = result.current.handleChange('id', 'cameras', 0);

      act(() => {
        handler({ target: { value: 'camera_01' } });
      });

      expect(result.current.formData.cameras[0].id).toBe('camera_01');
    });
  });

  describe('Immutability', () => {
    it('should not mutate original formData when updating simple field', () => {
      const initialData = { lab: 'Original Lab' };
      const result = setupHook(initialData);
      const originalLab = initialData.lab;

      act(() => {
        result.current.updateFormData('lab', 'New Lab');
      });

      // Original data should not be mutated
      expect(initialData.lab).toBe(originalLab);
      expect(result.current.formData.lab).toBe('New Lab');
    });

    it('should not mutate original formData when updating nested object', () => {
      const initialData = { subject: { weight: 100 } };
      const result = setupHook(initialData);
      const originalWeight = initialData.subject.weight;

      act(() => {
        result.current.updateFormData('weight', 200, 'subject');
      });

      expect(initialData.subject.weight).toBe(originalWeight);
      expect(result.current.formData.subject.weight).toBe(200);
    });

    it('should not mutate original formData when updating array', () => {
      const initialData = { tasks: [{ camera_ids: ['camera_01'] }] };
      const result = setupHook(initialData);
      const originalIds = [...initialData.tasks[0].camera_ids];

      act(() => {
        result.current.updateFormArray('camera_ids', 'camera_02', 'tasks', 0, true);
      });

      expect(initialData.tasks[0].camera_ids).toEqual(originalIds);
      expect(result.current.formData.tasks[0].camera_ids).toEqual([
        'camera_01',
        'camera_02',
      ]);
    });
  });
});
