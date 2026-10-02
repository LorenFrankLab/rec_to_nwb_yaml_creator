/**
 * Tests for YAML.parse() error handling in importFile()
 *
 * Critical scenario:
 * 1. User has filled out complex metadata form (30 minutes of work)
 * 2. User tries to import a reference YAML file
 * 3. YAML file is malformed (syntax error, encoding issue, etc.)
 *
 * The app must not crash, must say what went wrong, and must keep the form
 * exactly as it was: a file that cannot be read used to replace the form with
 * an empty one.
 */

import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { App } from '../../../App';
import { StoreProvider } from '../../../state/StoreContext';
import { getMainForm, getFileInput, getById } from '../../helpers/test-selectors';

describe('App.js - importFile() YAML.parse() Error Handling', () => {
  describe('CRITICAL: Malformed YAML Handling', () => {
    it('should not crash when importing malformed YAML', async () => {
      const user = userEvent.setup();
      render(
        <StoreProvider>
          <App />
        </StoreProvider>
      );

      // Create malformed YAML file (invalid syntax)
      const malformedYAML = `
session_id: test_session
invalid yaml syntax here: [unclosed bracket
another_field: value
`;

      const yamlFile = new File([malformedYAML], 'malformed.yml', {
        type: 'text/yaml',
      });

      const fileInput = getFileInput();

      // Attempt to upload malformed YAML
      // This should NOT crash the app
      await user.upload(fileInput, yamlFile);

      // App should still be mounted (not crashed)
      expect(getMainForm()).toBeInTheDocument();
    });

    it('should show error message when YAML parsing fails', async () => {
      const user = userEvent.setup();
      render(
        <StoreProvider>
          <App />
        </StoreProvider>
      );

      // Spy on window.alert to capture error message
      const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});

      // Malformed YAML with syntax error
      const malformedYAML = `
session_id: test
subject:
  subject_id: invalid yaml: {{unclosed
`;

      const yamlFile = new File([malformedYAML], 'malformed.yml', {
        type: 'text/yaml',
      });

      const fileInput = getFileInput();
      await user.upload(fileInput, yamlFile);

      // Wait for file processing
      await new Promise(resolve => setTimeout(resolve, 200));

      // Should show error message to user
      expect(alertSpy).toHaveBeenCalled();

      // Error message should mention YAML or parsing
      const alertCall = alertSpy.mock.calls[0]?.[0];
      if (alertCall) {
        const hasYAMLError =
          alertCall.includes('YAML') ||
          alertCall.includes('parse') ||
          alertCall.includes('Invalid') ||
          alertCall.includes('error');
        expect(hasYAMLError).toBe(true);
      }

      alertSpy.mockRestore();
    });

    it('keeps what the form holds when YAML parsing fails', async () => {
      const user = userEvent.setup();
      render(
        <StoreProvider>
          <App />
        </StoreProvider>
      );

      // Mock alert to suppress error messages
      const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});

      // Fill out some form data first
      const sessionIdInput = getById('session_id');
      await user.type(sessionIdInput, 'my_session');
      sessionIdInput.blur();
      await new Promise(resolve => setTimeout(resolve, 100));

      // Now try to import malformed YAML
      const malformedYAML = 'invalid: yaml: syntax: [[[';

      const yamlFile = new File([malformedYAML], 'malformed.yml', {
        type: 'text/yaml',
      });

      const fileInput = getFileInput();
      await user.upload(fileInput, yamlFile);

      await new Promise(resolve => setTimeout(resolve, 200));

      // The form keeps what the user typed
      expect(getById('session_id')).toHaveValue('my_session');

      alertSpy.mockRestore();
    });
  });

  describe('Edge Cases: YAML Parsing Errors', () => {
    it('should handle completely empty file', async () => {
      const user = userEvent.setup();
      render(
        <StoreProvider>
          <App />
        </StoreProvider>
      );

      const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});

      // Empty file
      const emptyFile = new File([''], 'empty.yml', {
        type: 'text/yaml',
      });

      const fileInput = getFileInput();
      await user.upload(fileInput, emptyFile);

      await new Promise(resolve => setTimeout(resolve, 200));

      // Should not crash
      expect(getMainForm()).toBeInTheDocument();

      alertSpy.mockRestore();
    });

    it('should handle binary file uploaded as YAML', async () => {
      const user = userEvent.setup();
      render(
        <StoreProvider>
          <App />
        </StoreProvider>
      );

      const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});

      // Binary data that's not YAML
      const binaryData = new Uint8Array([0xFF, 0xD8, 0xFF, 0xE0]); // JPEG header
      const binaryFile = new File([binaryData], 'image.yml', {
        type: 'text/yaml',
      });

      const fileInput = getFileInput();
      await user.upload(fileInput, binaryFile);

      await new Promise(resolve => setTimeout(resolve, 200));

      // Should not crash
      expect(getMainForm()).toBeInTheDocument();

      alertSpy.mockRestore();
    });

    it('should handle YAML with invalid characters', async () => {
      const user = userEvent.setup();
      render(
        <StoreProvider>
          <App />
        </StoreProvider>
      );

      const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});

      // YAML with null bytes and other invalid characters
      const invalidYAML = "session_id: test\x00invalid\x01\x02";

      const yamlFile = new File([invalidYAML], 'invalid.yml', {
        type: 'text/yaml',
      });

      const fileInput = getFileInput();
      await user.upload(fileInput, yamlFile);

      await new Promise(resolve => setTimeout(resolve, 200));

      // Should not crash
      expect(getMainForm()).toBeInTheDocument();

      alertSpy.mockRestore();
    });
  });

  describe('FileReader Error Handling', () => {
    it('should handle FileReader errors gracefully', async () => {
      const user = userEvent.setup();
      render(
        <StoreProvider>
          <App />
        </StoreProvider>
      );

      const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});

      // Create a file
      const yamlFile = new File(['session_id: test'], 'test.yml', {
        type: 'text/yaml',
      });

      // Mock FileReader to simulate error
      const originalFileReader = window.FileReader;
      window.FileReader = class MockFileReader {
        readAsText() {
          // Simulate error during file read
          if (this.onerror) {
            setTimeout(() => {
              const errorEvent = new ErrorEvent('error', {
                error: new Error('File read failed'),
                message: 'File read failed'
              });
              this.onerror(errorEvent);
            }, 10);
          }
        }
      };

      const fileInput = getFileInput();
      await user.upload(fileInput, yamlFile);

      await new Promise(resolve => setTimeout(resolve, 200));

      // Should not crash (may or may not show alert depending on implementation)
      expect(getMainForm()).toBeInTheDocument();

      // Restore original FileReader
      window.FileReader = originalFileReader;
      alertSpy.mockRestore();
    });
  });

  describe('Data Loss Prevention', () => {
    it('keeps existing form data when a malformed file is uploaded', async () => {
      const user = userEvent.setup();
      render(
        <StoreProvider>
          <App />
        </StoreProvider>
      );

      const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});

      // User fills out important data
      const sessionIdInput = getById('session_id');
      const subjectIdInput = getById('subject-subjectId');

      await user.type(sessionIdInput, 'critical_experiment_session');
      sessionIdInput.blur();
      await new Promise(resolve => setTimeout(resolve, 100));

      await user.type(subjectIdInput, 'rare_animal_001');
      subjectIdInput.blur();
      await new Promise(resolve => setTimeout(resolve, 100));

      // Verify data is there
      expect(sessionIdInput.value).toBe('critical_experiment_session');
      expect(subjectIdInput.value).toBe('rare_animal_001');

      // User accidentally tries to import malformed YAML
      const malformedYAML = 'this is not: valid: yaml: :::';
      const yamlFile = new File([malformedYAML], 'bad.yml', {
        type: 'text/yaml',
      });

      const fileInput = getFileInput();
      await user.upload(fileInput, yamlFile);

      await new Promise(resolve => setTimeout(resolve, 200));

      // The app has not crashed, and nothing the user typed was lost
      expect(getMainForm()).toBeInTheDocument();
      expect(getById('session_id')).toHaveValue('critical_experiment_session');
      expect(getById('subject-subjectId')).toHaveValue('rare_animal_001');

      alertSpy.mockRestore();
    });
  });
});
