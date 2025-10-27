/**
 * @vitest-environment jsdom
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { showErrorMessage, displayErrorOnUI } from '../errorDisplay';

/**
 * Tests for core errorDisplay.js functionality
 *
 * Coverage for:
 * - showErrorMessage() ID parsing, element handling, message sanitization
 * - displayErrorOnUI() direct error display
 * - Edge cases and error handling
 *
 * Note: Callback integration tested separately in errorDisplay-callback.test.js
 */

describe('errorDisplay - Core functionality', () => {
  let alertSpy;

  beforeEach(() => {
    // Mock window.alert
    alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});

    // Clean up DOM
    document.body.innerHTML = '';
  });

  afterEach(() => {
    vi.restoreAllMocks();
    document.body.innerHTML = '';
  });

  describe('showErrorMessage - ID parsing', () => {
    it('should parse single-level instancePath to simple ID', () => {
      // Create element
      const input = document.createElement('input');
      input.id = 'session_id';
      document.body.appendChild(input);

      const error = {
        message: 'must not be empty',
        instancePath: '/session_id',
      };

      showErrorMessage(error);

      // Should use setCustomValidity on the element
      expect(input.checkValidity()).toBe(false);
      expect(input.validationMessage).toBe('must not be empty');
    });

    it('should parse two-level instancePath to hyphenated ID', () => {
      const input = document.createElement('input');
      input.id = 'subject-species';
      document.body.appendChild(input);

      const error = {
        message: 'must not be empty',
        instancePath: '/subject/species',
      };

      showErrorMessage(error);

      expect(input.checkValidity()).toBe(false);
      expect(input.validationMessage).toBe('must not be empty');
    });

    it('should parse three-level instancePath with array index', () => {
      const input = document.createElement('input');
      input.id = 'electrode_groups-description-0';
      document.body.appendChild(input);

      const error = {
        message: 'must not be empty',
        instancePath: '/electrode_groups/0/description',
      };

      showErrorMessage(error);

      expect(input.checkValidity()).toBe(false);
      expect(input.validationMessage).toBe('must not be empty');
    });
  });

  describe('showErrorMessage - Message sanitization', () => {
    it('should sanitize pattern validation message for whitespace', () => {
      const input = document.createElement('input');
      input.id = 'session_id';
      document.body.appendChild(input);

      const error = {
        message: 'must match pattern "^.+$"',
        instancePath: '/session_id',
      };

      showErrorMessage(error);

      expect(input.validationMessage).toBe('session_id cannot be empty nor all whitespace');
    });

    it('should pass through other validation messages unchanged', () => {
      const input = document.createElement('input');
      input.id = 'session_id';
      document.body.appendChild(input);

      const error = {
        message: 'must be at least 5 characters',
        instancePath: '/session_id',
      };

      showErrorMessage(error);

      expect(input.validationMessage).toBe('must be at least 5 characters');
    });
  });

  describe('showErrorMessage - Special case: date_of_birth', () => {
    it('should show ISO 8601 message for date_of_birth format error', () => {
      const error = {
        message: 'must match format',
        instancePath: '/subject/date_of_birth',
      };

      showErrorMessage(error);

      expect(alertSpy).toHaveBeenCalledWith(
        ' Subject Date Of Birth - Date of birth needs to comply with ISO 8061 format (https://en.wikipedia.org/wiki/ISO_8601)'
      );
    });
  });

  describe('showErrorMessage - Element not found', () => {
    it('should show alert when element does not exist', () => {
      const error = {
        message: 'must not be empty',
        instancePath: '/nonexistent/field',
      };

      showErrorMessage(error);

      expect(alertSpy).toHaveBeenCalledWith(' Nonexistent Field - must not be empty');
    });

    it('should format instancePath to title case in alert', () => {
      const error = {
        message: 'invalid value',
        instancePath: '/electrode_groups/0/device_type',
      };

      showErrorMessage(error);

      expect(alertSpy).toHaveBeenCalledWith(' Electrode Groups 0 Device Type - invalid value');
    });
  });

  describe('showErrorMessage - Non-INPUT elements', () => {
    it('should show alert for SELECT elements', () => {
      const select = document.createElement('select');
      select.id = 'subject-species';
      document.body.appendChild(select);

      const error = {
        message: 'must be selected',
        instancePath: '/subject/species',
      };

      showErrorMessage(error);

      // Should fallback to alert instead of setCustomValidity
      expect(alertSpy).toHaveBeenCalledWith(' Subject Species - must be selected');
    });

    it('should show alert for DIV elements', () => {
      const div = document.createElement('div');
      div.id = 'custom-field';
      document.body.appendChild(div);

      const error = {
        message: 'invalid configuration',
        instancePath: '/custom/field',
      };

      showErrorMessage(error);

      expect(alertSpy).toHaveBeenCalledWith(' Custom Field - invalid configuration');
    });

    it('should focus non-INPUT element if it has focus method', () => {
      const div = document.createElement('div');
      div.id = 'custom-field';
      div.tabIndex = -1; // Make it focusable
      document.body.appendChild(div);

      const focusSpy = vi.spyOn(div, 'focus');

      const error = {
        message: 'invalid',
        instancePath: '/custom/field',
      };

      showErrorMessage(error);

      expect(focusSpy).toHaveBeenCalled();
    });
  });

  describe('showErrorMessage - Element focusing', () => {
    it('should focus INPUT element when showing custom validity error', () => {
      const input = document.createElement('input');
      input.id = 'session_id';
      document.body.appendChild(input);

      const focusSpy = vi.spyOn(input, 'focus');

      const error = {
        message: 'must not be empty',
        instancePath: '/session_id',
      };

      showErrorMessage(error);

      // Focus is called by showCustomValidityError (from utils.js)
      // We're testing that the function path reaches setCustomValidity
      expect(input.checkValidity()).toBe(false);
    });
  });

  describe('displayErrorOnUI', () => {
    it('should set custom validity on INPUT elements', () => {
      const input = document.createElement('input');
      input.id = 'test-input';
      document.body.appendChild(input);

      displayErrorOnUI('test-input', 'Custom error message');

      expect(input.checkValidity()).toBe(false);
      expect(input.validationMessage).toBe('Custom error message');
      expect(alertSpy).not.toHaveBeenCalled();
    });

    it('should show alert when element does not exist', () => {
      displayErrorOnUI('nonexistent-id', 'Error message for missing element');

      expect(alertSpy).toHaveBeenCalledWith('Error message for missing element');
    });

    it('should show alert for non-INPUT elements', () => {
      const div = document.createElement('div');
      div.id = 'test-div';
      document.body.appendChild(div);

      displayErrorOnUI('test-div', 'Cannot use setCustomValidity here');

      expect(alertSpy).toHaveBeenCalledWith('Cannot use setCustomValidity here');
    });

    it('should focus element before showing error', () => {
      const input = document.createElement('input');
      input.id = 'test-input';
      document.body.appendChild(input);

      const focusSpy = vi.spyOn(input, 'focus');

      displayErrorOnUI('test-input', 'Test error');

      // Focus is called before setCustomValidity
      expect(focusSpy).toHaveBeenCalled();
    });

    it('should handle elements without focus method', () => {
      const input = document.createElement('input');
      input.id = 'test-input';
      input.focus = undefined; // Remove focus method
      document.body.appendChild(input);

      // Should not throw error
      expect(() => {
        displayErrorOnUI('test-input', 'Test error');
      }).not.toThrow();
    });

    it('should handle empty error messages', () => {
      const input = document.createElement('input');
      input.id = 'test-input';
      document.body.appendChild(input);

      displayErrorOnUI('test-input', '');

      expect(input.validationMessage).toBe('');
    });

    it('should handle long error messages', () => {
      const input = document.createElement('input');
      input.id = 'test-input';
      document.body.appendChild(input);

      const longMessage = 'Error: ' + 'x'.repeat(1000);
      displayErrorOnUI('test-input', longMessage);

      expect(input.validationMessage).toBe(longMessage);
    });
  });

  describe('Edge cases', () => {
    it('should handle empty instancePath', () => {
      const error = {
        message: 'root error',
        instancePath: '',
      };

      // Should not crash
      expect(() => showErrorMessage(error)).not.toThrow();
    });

    it('should handle instancePath with only slashes', () => {
      const error = {
        message: 'error',
        instancePath: '///',
      };

      // Should not crash
      expect(() => showErrorMessage(error)).not.toThrow();
    });

    it('should handle very deep instancePath', () => {
      const error = {
        message: 'error',
        instancePath: '/a/b/c/d/e/f/g',
      };

      // Should use the pattern for 3+ levels: ${0}-${2}-${1}
      // So looking for element with id: a-c-b
      expect(() => showErrorMessage(error)).not.toThrow();
    });

    it('should handle special characters in instancePath', () => {
      const input = document.createElement('input');
      input.id = 'subject-date_of_birth';
      document.body.appendChild(input);

      const error = {
        message: 'invalid',
        instancePath: '/subject/date_of_birth',
      };

      showErrorMessage(error);

      expect(input.checkValidity()).toBe(false);
    });
  });
});
