/**
 * @vitest-environment jsdom
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { showErrorMessage, displayErrorOnUI, setAlertCallback } from '../errorDisplay';

/**
 * Tests for AlertModal callback integration in errorDisplay.js
 *
 * New functionality (P1.3.2):
 * - setAlertCallback() registers callback function
 * - showErrorMessage() uses callback when available
 * - displayErrorOnUI() uses callback when available
 * - Backward compatibility: falls back to window.alert if no callback
 */

describe('errorDisplay - AlertModal callback integration', () => {
  let mockCallback;

  beforeEach(() => {
    // Mock window.alert
    vi.spyOn(window, 'alert').mockImplementation(() => {});

    // Create mock callback
    mockCallback = vi.fn();

    // Reset callback to null before each test
    setAlertCallback(null);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    setAlertCallback(null);
  });

  describe('setAlertCallback', () => {
    it('should register a callback function', () => {
      setAlertCallback(mockCallback);

      // Verify by calling showErrorMessage which should use the callback
      const error = {
        message: 'test error',
        instancePath: '/nonexistent/field',
      };

      showErrorMessage(error);

      expect(mockCallback).toHaveBeenCalled();
      expect(window.alert).not.toHaveBeenCalled();
    });

    it('should allow callback to be set to null', () => {
      setAlertCallback(mockCallback);
      setAlertCallback(null);

      const error = {
        message: 'test error',
        instancePath: '/nonexistent/field',
      };

      showErrorMessage(error);

      expect(mockCallback).not.toHaveBeenCalled();
      expect(window.alert).toHaveBeenCalled();
    });

    it('should allow callback to be updated', () => {
      const firstCallback = vi.fn();
      const secondCallback = vi.fn();

      setAlertCallback(firstCallback);
      setAlertCallback(secondCallback);

      const error = {
        message: 'test error',
        instancePath: '/nonexistent/field',
      };

      showErrorMessage(error);

      expect(firstCallback).not.toHaveBeenCalled();
      expect(secondCallback).toHaveBeenCalled();
      expect(window.alert).not.toHaveBeenCalled();
    });
  });

  describe('showErrorMessage with callback', () => {
    it('should use callback instead of window.alert when callback is set', () => {
      setAlertCallback(mockCallback);

      const error = {
        message: 'must not be empty',
        instancePath: '/subject/species',
      };

      showErrorMessage(error);

      expect(mockCallback).toHaveBeenCalledTimes(1);
      expect(mockCallback).toHaveBeenCalledWith(' Subject Species - must not be empty');
      expect(window.alert).not.toHaveBeenCalled();
    });

    it('should fallback to window.alert when no callback is set', () => {
      // No callback set
      const error = {
        message: 'must not be empty',
        instancePath: '/subject/species',
      };

      showErrorMessage(error);

      expect(mockCallback).not.toHaveBeenCalled();
      expect(window.alert).toHaveBeenCalledTimes(1);
      expect(window.alert).toHaveBeenCalledWith(' Subject Species - must not be empty');
    });

    it('should not call callback for INPUT elements (uses setCustomValidity)', () => {
      setAlertCallback(mockCallback);

      // Create an INPUT element in the DOM
      const inputElement = document.createElement('input');
      inputElement.id = 'subject';
      document.body.appendChild(inputElement);

      const error = {
        message: 'must not be empty',
        instancePath: '/subject',
      };

      showErrorMessage(error);

      // Should use setCustomValidity, not callback or alert
      expect(mockCallback).not.toHaveBeenCalled();
      expect(window.alert).not.toHaveBeenCalled();

      document.body.removeChild(inputElement);
    });

    it('should handle date_of_birth special message with callback', () => {
      setAlertCallback(mockCallback);

      const error = {
        message: 'must match format',
        instancePath: '/subject/date_of_birth',
      };

      showErrorMessage(error);

      expect(mockCallback).toHaveBeenCalledWith(
        ' Subject Date Of Birth - Date of birth needs to comply with ISO 8061 format (https://en.wikipedia.org/wiki/ISO_8601)'
      );
      expect(window.alert).not.toHaveBeenCalled();
    });

    it('should handle nested paths correctly with callback', () => {
      setAlertCallback(mockCallback);

      const error = {
        message: 'must be valid',
        instancePath: '/electrode_groups/0/device_type',
      };

      showErrorMessage(error);

      expect(mockCallback).toHaveBeenCalledWith(
        ' Electrode Groups 0 Device Type - must be valid'
      );
      expect(window.alert).not.toHaveBeenCalled();
    });
  });

  describe('displayErrorOnUI with callback', () => {
    it('should use callback instead of window.alert when callback is set', () => {
      setAlertCallback(mockCallback);

      // Non-existent element (will trigger alert/callback)
      displayErrorOnUI('nonexistent-element', 'Custom error message');

      expect(mockCallback).toHaveBeenCalledTimes(1);
      expect(mockCallback).toHaveBeenCalledWith('Custom error message');
      expect(window.alert).not.toHaveBeenCalled();
    });

    it('should fallback to window.alert when no callback is set', () => {
      // No callback set
      displayErrorOnUI('nonexistent-element', 'Custom error message');

      expect(mockCallback).not.toHaveBeenCalled();
      expect(window.alert).toHaveBeenCalledTimes(1);
      expect(window.alert).toHaveBeenCalledWith('Custom error message');
    });

    it('should not call callback for INPUT elements (uses setCustomValidity)', () => {
      setAlertCallback(mockCallback);

      // Create an INPUT element in the DOM
      const inputElement = document.createElement('input');
      inputElement.id = 'test-input';
      document.body.appendChild(inputElement);

      displayErrorOnUI('test-input', 'Custom error message');

      // Should use setCustomValidity, not callback or alert
      expect(mockCallback).not.toHaveBeenCalled();
      expect(window.alert).not.toHaveBeenCalled();

      document.body.removeChild(inputElement);
    });

    it('should handle empty error message with callback', () => {
      setAlertCallback(mockCallback);

      displayErrorOnUI('nonexistent-element', '');

      expect(mockCallback).toHaveBeenCalledWith('');
      expect(window.alert).not.toHaveBeenCalled();
    });

    it('should handle long error messages with callback', () => {
      setAlertCallback(mockCallback);

      const longMessage = 'Error: ' + 'x'.repeat(1000);
      displayErrorOnUI('nonexistent-element', longMessage);

      expect(mockCallback).toHaveBeenCalledWith(longMessage);
      expect(window.alert).not.toHaveBeenCalled();
    });
  });

  describe('Backward compatibility', () => {
    it('should work exactly as before when no callback is set', () => {
      // Test showErrorMessage
      const error1 = {
        message: 'must not be empty',
        instancePath: '/subject/species',
      };

      showErrorMessage(error1);
      expect(window.alert).toHaveBeenCalledWith(' Subject Species - must not be empty');

      vi.clearAllMocks();

      // Test displayErrorOnUI
      displayErrorOnUI('nonexistent', 'Error message');
      expect(window.alert).toHaveBeenCalledWith('Error message');
    });

    it('should not break existing code that does not call setAlertCallback', () => {
      // Simulate existing code that never heard of callbacks

      const error = {
        message: 'invalid value',
        instancePath: '/session_id',
      };

      // This should work without any setup
      showErrorMessage(error);

      expect(window.alert).toHaveBeenCalled();
      // No errors thrown
    });

    it('should allow switching between callback and window.alert', () => {
      // Start with callback
      setAlertCallback(mockCallback);

      const error = {
        message: 'test',
        instancePath: '/test',
      };

      showErrorMessage(error);
      expect(mockCallback).toHaveBeenCalledTimes(1);
      expect(window.alert).not.toHaveBeenCalled();

      vi.clearAllMocks();

      // Remove callback
      setAlertCallback(null);

      showErrorMessage(error);
      expect(mockCallback).not.toHaveBeenCalled();
      expect(window.alert).toHaveBeenCalledTimes(1);
    });
  });

  describe('Edge cases', () => {
    it('should handle callback that throws an error gracefully', () => {
      const throwingCallback = vi.fn(() => {
        throw new Error('Callback error');
      });

      setAlertCallback(throwingCallback);

      const error = {
        message: 'test',
        instancePath: '/test',
      };

      // This should throw since we're not catching errors
      expect(() => showErrorMessage(error)).toThrow('Callback error');
    });

    it('should handle callback that is not a function', () => {
      // Set callback to a non-function value
      setAlertCallback('not a function');

      const error = {
        message: 'test',
        instancePath: '/test',
      };

      // Should throw because 'not a function' is not callable
      expect(() => showErrorMessage(error)).toThrow();
    });

    it('should handle multiple rapid calls with callback', () => {
      setAlertCallback(mockCallback);

      // Rapid successive calls
      for (let i = 0; i < 10; i++) {
        displayErrorOnUI('nonexistent', `Error ${i}`);
      }

      expect(mockCallback).toHaveBeenCalledTimes(10);
      expect(window.alert).not.toHaveBeenCalled();
    });
  });
});
