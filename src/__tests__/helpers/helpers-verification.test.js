/**
 * Verification test for test helpers
 *
 * This test ensures that our custom test utilities and matchers work correctly.
 */

import { describe, it, expect } from 'vitest';
import { createTestYaml, renderWithProviders } from './test-utils';
import App from '../../App';

describe('Test Helpers Verification', () => {
  describe('createTestYaml utility', () => {
    it('generates valid minimal YAML data', () => {
      const yaml = createTestYaml();

      // Should have required fields
      expect(yaml).toHaveProperty('experimenter_name');
      expect(yaml).toHaveProperty('lab');
      expect(yaml).toHaveProperty('institution');
      expect(yaml).toHaveProperty('data_acq_device');
    });

    it('allows overriding fields', () => {
      const yaml = createTestYaml({
        lab: 'Custom Lab',
      });

      expect(yaml.lab).toBe('Custom Lab');
    });
  });

  describe('toBeValidYaml matcher', () => {
    it('accepts valid YAML', () => {
      const validYaml = createTestYaml();

      // This uses our custom matcher
      expect(validYaml).toBeValidYaml();
    });

    it('rejects YAML missing required fields', () => {
      const invalidYaml = {
        lab: 'test',
        // Missing many required fields
      };

      // This should fail validation
      expect(() => {
        expect(invalidYaml).toBeValidYaml();
      }).toThrow();
    });
  });

  describe('toHaveValidationError matcher', () => {
    it('detects missing required field errors', () => {
      const yaml = createTestYaml();
      delete yaml.experimenter_name;

      // Should have error about missing experimenter_name
      expect(yaml).toHaveValidationError('experimenter_name');
    });
  });

  describe('renderWithProviders utility', () => {
    it('renders components with user event setup', () => {
      const { user, container } = renderWithProviders(<App />);

      // Should return user event instance
      expect(user).toBeDefined();

      // Should render the App
      expect(container).toBeTruthy();
    });
  });
});
