/**
 * Tests for Phase 2 Bug Fix: defaultProps Type Mismatches
 *
 * Bug: Components have PropTypes expecting arrays but defaultProps provide strings
 *
 * Components affected:
 * - CheckboxList: PropTypes.instanceOf(Array) but defaultProps: ''
 * - RadioList: PropTypes.instanceOf(Array) but defaultProps: ''
 * - ListElement: PropTypes.arrayOf(...) but defaultProps: ''
 *
 * Fix: Change defaultProps from '' to []
 */

import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import CheckboxList from '../../../element/CheckboxList';
import RadioList from '../../../element/RadioList';
import ListElement from '../../../element/ListElement';
import { getByClass } from '../../helpers/test-selectors';

describe('defaultProps Type Mismatches Fix', () => {
  describe('CheckboxList', () => {
    it('should not throw PropTypes warning when defaultValue is not provided', () => {
      // ARRANGE
      const consoleErrorSpy = vi.spyOn(console, 'error');
      const mockUpdateFormArray = vi.fn();

      // ACT
      render(
        <CheckboxList
          id="test-checkbox"
          name="test"
          title="Test Checkbox"
          type="number"
          dataItems={['1', '2', '3']}
          updateFormArray={mockUpdateFormArray}
          metaData={{ nameValue: 'test', keyValue: 'test', index: 0 }}
        />
      );

      // ASSERT - Should NOT have defaultValue PropTypes warning
      const propTypeWarnings = consoleErrorSpy.mock.calls.filter(call =>
        call[0]?.toString().includes('Invalid prop `defaultValue`')
      );
      expect(propTypeWarnings).toHaveLength(0);

      consoleErrorSpy.mockRestore();
    });

    it('should use empty array as default when defaultValue not provided', () => {
      // ARRANGE
      const mockUpdateFormArray = vi.fn();

      // ACT
      const { container } = render(
        <CheckboxList
          id="test-checkbox"
          name="test"
          title="Test Checkbox"
          type="number"
          dataItems={['1', '2', '3']}
          updateFormArray={mockUpdateFormArray}
          metaData={{ nameValue: 'test', keyValue: 'test', index: 0 }}
        />
      );

      // ASSERT - No checkboxes should be checked (empty array default)
      const checkboxes = container.querySelectorAll('input[type="checkbox"]');
      checkboxes.forEach(checkbox => {
        expect(checkbox.checked).toBe(false);
      });
    });
  });

  describe('RadioList', () => {
    it('should not throw PropTypes warning when defaultValue is not provided', () => {
      // ARRANGE
      const consoleErrorSpy = vi.spyOn(console, 'error');
      const mockUpdateFormData = vi.fn();

      // ACT
      render(
        <RadioList
          id="test-radio"
          name="test"
          title="Test Radio"
          type="number"
          dataItems={['1', '2', '3']}
          updateFormData={mockUpdateFormData}
          metaData={{ nameValue: 'test', keyValue: 'test', index: 0 }}
        />
      );

      // ASSERT - Should NOT have defaultValue PropTypes warning
      const propTypeWarnings = consoleErrorSpy.mock.calls.filter(call =>
        call[0]?.toString().includes('Invalid prop `defaultValue`')
      );
      expect(propTypeWarnings).toHaveLength(0);

      consoleErrorSpy.mockRestore();
    });

    it('should use empty array as default when defaultValue not provided', () => {
      // ARRANGE
      const mockUpdateFormData = vi.fn();

      // ACT
      const { container } = render(
        <RadioList
          id="test-radio"
          name="test"
          title="Test Radio"
          type="number"
          dataItems={['1', '2', '3']}
          updateFormData={mockUpdateFormData}
          metaData={{ nameValue: 'test', keyValue: 'test', index: 0 }}
        />
      );

      // ASSERT - No radios should be checked (empty array default)
      const radios = container.querySelectorAll('input[type="radio"]');
      radios.forEach(radio => {
        expect(radio.checked).toBe(false);
      });
    });
  });

  describe('ListElement', () => {
    it('should not throw PropTypes warning when defaultValue is not provided', () => {
      // ARRANGE
      const consoleErrorSpy = vi.spyOn(console, 'error');
      const mockUpdateFormData = vi.fn();

      // ACT
      render(
        <ListElement
          id="test-list"
          name="test"
          title="Test List"
          type="text"
          updateFormData={mockUpdateFormData}
          metaData={{ nameValue: 'test', keyValue: 'test', index: 0 }}
        />
      );

      // ASSERT - Should NOT have defaultValue PropTypes warning
      const propTypeWarnings = consoleErrorSpy.mock.calls.filter(call =>
        call[0]?.toString().includes('Invalid prop `defaultValue`') &&
        call[0]?.toString().includes('ListElement')
      );
      expect(propTypeWarnings).toHaveLength(0);

      consoleErrorSpy.mockRestore();
    });

    it('should use empty array as default when defaultValue not provided', () => {
      // ARRANGE
      const mockUpdateFormData = vi.fn();

      // ACT
      render(
        <ListElement
          id="test-list"
          name="test"
          title="Test List"
          type="text"
          updateFormData={mockUpdateFormData}
          metaData={{ nameValue: 'test', keyValue: 'test', index: 0 }}
        />
      );

      // ASSERT - Should show placeholder, not list items (empty array default)
      const listContainer = getByClass('list-of-items')[0];
      expect(listContainer).toBeTruthy();
      // With empty array, should show inputPlaceholder span
      const placeholderSpan = listContainer.querySelector('span');
      expect(placeholderSpan).toBeTruthy();
    });
  });

  describe('Type Consistency Verification', () => {
    it('CheckboxList defaultValue should be array type', () => {
      // ARRANGE
      const CheckboxListDefaults = CheckboxList.defaultProps;

      // ASSERT
      expect(Array.isArray(CheckboxListDefaults.defaultValue)).toBe(true);
      expect(CheckboxListDefaults.defaultValue).toEqual([]);
    });

    it('RadioList defaultValue should be string/number (single selection)', () => {
      // ARRANGE
      const RadioListDefaults = RadioList.defaultProps;

      // ASSERT
      // Radio buttons select ONE item, so defaultValue should be string/number, not array
      expect(typeof RadioListDefaults.defaultValue === 'string' ||
             typeof RadioListDefaults.defaultValue === 'number').toBe(true);
      expect(RadioListDefaults.defaultValue).toEqual('');
    });

    it('ListElement defaultValue should be array type', () => {
      // ARRANGE
      const ListElementDefaults = ListElement.defaultProps;

      // ASSERT
      expect(Array.isArray(ListElementDefaults.defaultValue)).toBe(true);
      expect(ListElementDefaults.defaultValue).toEqual([]);
    });
  });
});
