/**
 * Tests for App.js onBlur transformation functions
 *
 * Phase 1: Testing Foundation - Week 3
 *
 * These tests verify that onBlur correctly transforms input values
 * before updating form state. The onBlur function handles:
 * - Number parsing (parseFloat for type="number")
 * - Comma-separated strings to arrays
 * - Comma-separated numbers to integer arrays
 * - String pass-through for text inputs
 */

import { render, fireEvent } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { App } from '../../../App';
import {
  commaSeparatedStringToNumber,
  formatCommaSeparatedString,
  isInteger,
  isNumeric
} from '../../../utils';

describe('App onBlur Transformations', () => {
  describe('Utility Functions - commaSeparatedStringToNumber', () => {
    it('should convert comma-separated numbers to integer array', () => {
      const result = commaSeparatedStringToNumber('1, 2, 3');
      expect(result).toEqual([1, 2, 3]);
    });

    it('should remove duplicates from comma-separated numbers', () => {
      const result = commaSeparatedStringToNumber('1, 2, 2, 3, 1');
      expect(result).toEqual([1, 2, 3]);
    });

    it('should trim whitespace around numbers', () => {
      const result = commaSeparatedStringToNumber('  1  ,  2  ,  3  ');
      expect(result).toEqual([1, 2, 3]);
    });

    it('should filter out non-numeric values', () => {
      const result = commaSeparatedStringToNumber('1, abc, 2, xyz, 3');
      expect(result).toEqual([1, 2, 3]);
    });

    it('should filter out decimal numbers (only integers)', () => {
      const result = commaSeparatedStringToNumber('1, 2.5, 3');
      expect(result).toEqual([1, 3]);
    });

    it('should handle empty string', () => {
      const result = commaSeparatedStringToNumber('');
      expect(result).toEqual([]);
    });

    it('should handle single number', () => {
      const result = commaSeparatedStringToNumber('42');
      expect(result).toEqual([42]);
    });

    it('should handle numbers with extra commas', () => {
      const result = commaSeparatedStringToNumber('1,,2,,,3');
      expect(result).toEqual([1, 2, 3]);
    });

    it('should filter out negative numbers (not integers by isInteger regex)', () => {
      const result = commaSeparatedStringToNumber('1, -2, 3');
      expect(result).toEqual([1, 3]);
    });

    it('should handle large numbers', () => {
      const result = commaSeparatedStringToNumber('1000, 2000, 3000');
      expect(result).toEqual([1000, 2000, 3000]);
    });
  });

  describe('Utility Functions - formatCommaSeparatedString', () => {
    it('should convert comma-separated strings to array', () => {
      const result = formatCommaSeparatedString('apple, banana, cherry');
      expect(result).toEqual(['apple', 'banana', 'cherry']);
    });

    it('should remove duplicates from comma-separated strings', () => {
      const result = formatCommaSeparatedString('apple, banana, apple, cherry');
      expect(result).toEqual(['apple', 'banana', 'cherry']);
    });

    it('should trim whitespace around strings', () => {
      const result = formatCommaSeparatedString('  apple  ,  banana  ,  cherry  ');
      expect(result).toEqual(['apple', 'banana', 'cherry']);
    });

    it('should filter out empty strings', () => {
      const result = formatCommaSeparatedString('apple, , banana, , cherry');
      expect(result).toEqual(['apple', 'banana', 'cherry']);
    });

    it('should handle single string', () => {
      const result = formatCommaSeparatedString('onlyOne');
      expect(result).toEqual(['onlyOne']);
    });

    it('should handle empty string', () => {
      const result = formatCommaSeparatedString('');
      expect(result).toEqual([]);
    });

    it('should preserve strings with numbers', () => {
      const result = formatCommaSeparatedString('item1, item2, item3');
      expect(result).toEqual(['item1', 'item2', 'item3']);
    });

    it('should preserve special characters in strings', () => {
      const result = formatCommaSeparatedString('foo@bar, baz-qux, test_123');
      expect(result).toEqual(['foo@bar', 'baz-qux', 'test_123']);
    });
  });

  describe('Utility Functions - isInteger', () => {
    it('should return true for positive integers', () => {
      expect(isInteger('123')).toBe(true);
      expect(isInteger('0')).toBe(true);
      expect(isInteger('999')).toBe(true);
    });

    it('should return false for negative numbers', () => {
      expect(isInteger('-123')).toBe(false);
    });

    it('should return false for decimals', () => {
      expect(isInteger('12.5')).toBe(false);
      expect(isInteger('0.5')).toBe(false);
    });

    it('should return false for non-numeric strings', () => {
      expect(isInteger('abc')).toBe(false);
      expect(isInteger('12a')).toBe(false);
    });

    it('should return false for empty string', () => {
      expect(isInteger('')).toBe(false);
    });
  });

  describe('Utility Functions - isNumeric', () => {
    it('should return true for integers', () => {
      expect(isNumeric('123')).toBe(true);
      expect(isNumeric('0')).toBe(true);
    });

    it('should return true for decimals', () => {
      expect(isNumeric('12.5')).toBe(true);
      expect(isNumeric('0.5')).toBe(true);
    });

    it('should return true for negative numbers', () => {
      expect(isNumeric('-123')).toBe(true);
      expect(isNumeric('-12.5')).toBe(true);
    });

    it('should return false for non-numeric strings', () => {
      expect(isNumeric('abc')).toBe(false);
      expect(isNumeric('12a')).toBe(false);
    });

    it('should return false for empty string', () => {
      expect(isNumeric('')).toBe(false);
    });
  });

  describe('onBlur - Number Input Transformations', () => {
    it('should parse float on blur for number inputs', () => {
      const { container } = render(<App />);

      const weightInput = container.querySelector('input[id="subject-weight"]');

      // Change value (as string)
      fireEvent.change(weightInput, { target: { value: '250.5' } });

      // Blur should convert to number
      fireEvent.blur(weightInput);

      // Value should now be a number
      expect(weightInput.value).toBe('250.5');
    });

    it('should handle integer values in number inputs', () => {
      const { container } = render(<App />);

      const weightInput = container.querySelector('input[id="subject-weight"]');

      fireEvent.change(weightInput, { target: { value: '300' } });
      fireEvent.blur(weightInput);

      expect(weightInput.value).toBe('300');
    });

    it('should handle decimal values with leading zero', () => {
      const { container } = render(<App />);

      const multiplierInput = container.querySelector('input[name="times_period_multiplier"]');

      fireEvent.change(multiplierInput, { target: { value: '0.5' } });
      fireEvent.blur(multiplierInput);

      expect(multiplierInput).toHaveValue(0.5);
    });

    it('should handle very small decimal values', () => {
      const { container } = render(<App />);

      const multiplierInput = container.querySelector('input[name="times_period_multiplier"]');

      fireEvent.change(multiplierInput, { target: { value: '0.001' } });
      fireEvent.blur(multiplierInput);

      expect(multiplierInput).toHaveValue(0.001);
    });

    it('should handle zero values', () => {
      const { container } = render(<App />);

      const weightInput = container.querySelector('input[id="subject-weight"]');

      fireEvent.change(weightInput, { target: { value: '0' } });
      fireEvent.blur(weightInput);

      expect(weightInput).toHaveValue(0);
    });

    it('should handle negative numbers', () => {
      const { container } = render(<App />);

      const weightInput = container.querySelector('input[id="subject-weight"]');

      fireEvent.change(weightInput, { target: { value: '-50' } });
      fireEvent.blur(weightInput);

      expect(weightInput).toHaveValue(-50);
    });
  });

  describe('onBlur - Text Input Pass-through', () => {
    it('should not transform text input values', () => {
      const { container } = render(<App />);

      const labInput = container.querySelector('input[name="lab"]');

      fireEvent.change(labInput, { target: { value: 'My Lab Name' } });
      fireEvent.blur(labInput);

      expect(labInput).toHaveValue('My Lab Name');
    });

    it('should preserve whitespace in text inputs', () => {
      const { container } = render(<App />);

      const descInput = container.querySelector('input[name="experiment_description"]');

      fireEvent.change(descInput, { target: { value: '  spaced  text  ' } });
      fireEvent.blur(descInput);

      expect(descInput).toHaveValue('  spaced  text  ');
    });

    it('should preserve special characters in text inputs', () => {
      const { container } = render(<App />);

      const descInput = container.querySelector('input[name="session_description"]');

      const specialText = 'Test & <script> "quotes" \'apostrophe\'';
      fireEvent.change(descInput, { target: { value: specialText } });
      fireEvent.blur(descInput);

      expect(descInput).toHaveValue(specialText);
    });

    it('should handle empty string in text inputs', () => {
      const { container } = render(<App />);

      const labInput = container.querySelector('input[name="lab"]');

      fireEvent.change(labInput, { target: { value: '' } });
      fireEvent.blur(labInput);

      expect(labInput).toHaveValue('');
    });
  });

  describe('onBlur - Edge Cases', () => {
    it('should handle rapid change and blur events', () => {
      const { container } = render(<App />);

      const weightInput = container.querySelector('input[id="subject-weight"]');

      fireEvent.change(weightInput, { target: { value: '100' } });
      fireEvent.blur(weightInput);
      fireEvent.change(weightInput, { target: { value: '200' } });
      fireEvent.blur(weightInput);
      fireEvent.change(weightInput, { target: { value: '300' } });
      fireEvent.blur(weightInput);

      expect(weightInput).toHaveValue(300);
    });

    it('should handle blur without change', () => {
      const { container } = render(<App />);

      const labInput = container.querySelector('input[name="lab"]');
      const originalValue = labInput.value;

      // Blur without changing
      fireEvent.blur(labInput);

      expect(labInput).toHaveValue(originalValue);
    });

    it('should handle blur on empty number input', () => {
      const { container } = render(<App />);

      const weightInput = container.querySelector('input[id="subject-weight"]');

      fireEvent.change(weightInput, { target: { value: '' } });
      fireEvent.blur(weightInput);

      // Empty string in number input becomes NaN which shows as empty
      expect(weightInput.value).toBe('');
    });
  });
});
