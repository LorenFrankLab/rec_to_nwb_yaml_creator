/**
 * Tests for Feature Flags
 *
 * Validates:
 * - All flags default to false (except explicitly enabled ones)
 * - Utility functions work correctly
 * - Override/restore mechanism for testing
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  FLAGS,
  isFeatureEnabled,
  getEnabledFeatures,
  getDisabledFeatures,
  getFlagSummary,
  overrideFlags,
  restoreFlags,
} from '../../featureFlags';

describe('featureFlags', () => {
  describe('Default Flag States', () => {
    it('should have shadowExportStrict enabled by default', () => {
      expect(FLAGS.shadowExportStrict).toBe(true);
    });

    it('should have shadowExportLog enabled by default', () => {
      expect(FLAGS.shadowExportLog).toBe(true);
    });

    it('should have all new feature flags disabled by default', () => {
      // M2: Navigation
      expect(FLAGS.newNavigation).toBe(false);
      expect(FLAGS.showLegacyToggle).toBe(false);

      // M3: Animal workspace
      expect(FLAGS.animalWorkspace).toBe(false);
      expect(FLAGS.localStoragePersistence).toBe(false);

      // M4-M5: Day editor
      expect(FLAGS.newDayEditor).toBe(false);
      expect(FLAGS.inlineValidation).toBe(false);

      // M6: Channel map
      expect(FLAGS.channelMapEditor).toBe(false);
      expect(FLAGS.channelMapCSV).toBe(false);

      // M7-M9: Validation
      expect(FLAGS.crossDayValidation).toBe(false);
      expect(FLAGS.validationSummary).toBe(false);
      expect(FLAGS.batchExport).toBe(false);

      // M10: Probe reconfig
      expect(FLAGS.probeReconfigWizard).toBe(false);

      // M11: Accessibility
      expect(FLAGS.keyboardShortcuts).toBe(false);
      expect(FLAGS.highContrastMode).toBe(false);

      // Development
      expect(FLAGS.debugLogging).toBe(false);
      expect(FLAGS.performanceProfiling).toBe(false);
      expect(FLAGS.simulateSlowNetwork).toBe(false);
    });

    it('should have exactly 2 flags enabled by default', () => {
      const enabledCount = Object.values(FLAGS).filter(Boolean).length;
      expect(enabledCount).toBe(2); // shadowExportStrict, shadowExportLog
    });
  });

  describe('isFeatureEnabled', () => {
    it('should return true for enabled flags', () => {
      expect(isFeatureEnabled('shadowExportStrict')).toBe(true);
      expect(isFeatureEnabled('shadowExportLog')).toBe(true);
    });

    it('should return false for disabled flags', () => {
      expect(isFeatureEnabled('newNavigation')).toBe(false);
      expect(isFeatureEnabled('animalWorkspace')).toBe(false);
    });

    it('should return false and warn for unknown flags', () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      const result = isFeatureEnabled('unknownFlag');

      expect(result).toBe(false);
      expect(consoleSpy).toHaveBeenCalledWith('Unknown feature flag: unknownFlag');

      consoleSpy.mockRestore();
    });

    it('should handle empty string', () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      const result = isFeatureEnabled('');

      expect(result).toBe(false);
      expect(consoleSpy).toHaveBeenCalled();

      consoleSpy.mockRestore();
    });
  });

  describe('getEnabledFeatures', () => {
    it('should return array of enabled feature names', () => {
      const enabled = getEnabledFeatures();

      expect(enabled).toBeInstanceOf(Array);
      expect(enabled).toContain('shadowExportStrict');
      expect(enabled).toContain('shadowExportLog');
      expect(enabled).toHaveLength(2);
    });

    it('should not include disabled features', () => {
      const enabled = getEnabledFeatures();

      expect(enabled).not.toContain('newNavigation');
      expect(enabled).not.toContain('animalWorkspace');
    });
  });

  describe('getDisabledFeatures', () => {
    it('should return array of disabled feature names', () => {
      const disabled = getDisabledFeatures();

      expect(disabled).toBeInstanceOf(Array);
      expect(disabled).toContain('newNavigation');
      expect(disabled).toContain('animalWorkspace');
    });

    it('should not include enabled features', () => {
      const disabled = getDisabledFeatures();

      expect(disabled).not.toContain('shadowExportStrict');
      expect(disabled).not.toContain('shadowExportLog');
    });

    it('should return correct count of disabled features', () => {
      const disabled = getDisabledFeatures();
      const totalFlags = Object.keys(FLAGS).length;

      // Should be totalFlags - 2 (shadowExportStrict, shadowExportLog)
      expect(disabled).toHaveLength(totalFlags - 2);
    });
  });

  describe('getFlagSummary', () => {
    it('should return summary object with correct structure', () => {
      const summary = getFlagSummary();

      expect(summary).toHaveProperty('total');
      expect(summary).toHaveProperty('enabled');
      expect(summary).toHaveProperty('disabled');
      expect(summary).toHaveProperty('enabledFeatures');
      expect(summary).toHaveProperty('disabledFeatures');
    });

    it('should have correct total count', () => {
      const summary = getFlagSummary();
      const flagCount = Object.keys(FLAGS).length;

      expect(summary.total).toBe(flagCount);
    });

    it('should have correct enabled count', () => {
      const summary = getFlagSummary();

      expect(summary.enabled).toBe(2); // shadowExportStrict, shadowExportLog
    });

    it('should have correct disabled count', () => {
      const summary = getFlagSummary();
      const flagCount = Object.keys(FLAGS).length;

      expect(summary.disabled).toBe(flagCount - 2);
    });

    it('should have enabled + disabled = total', () => {
      const summary = getFlagSummary();

      expect(summary.enabled + summary.disabled).toBe(summary.total);
    });

    it('should have enabledFeatures as array', () => {
      const summary = getFlagSummary();

      expect(summary.enabledFeatures).toBeInstanceOf(Array);
      expect(summary.enabledFeatures).toHaveLength(summary.enabled);
    });

    it('should have disabledFeatures as array', () => {
      const summary = getFlagSummary();

      expect(summary.disabledFeatures).toBeInstanceOf(Array);
      expect(summary.disabledFeatures).toHaveLength(summary.disabled);
    });
  });

  describe('overrideFlags and restoreFlags', () => {
    afterEach(() => {
      restoreFlags(); // Ensure flags are restored after each test
    });

    it('should override single flag', () => {
      expect(FLAGS.newNavigation).toBe(false);

      overrideFlags({ newNavigation: true });

      expect(FLAGS.newNavigation).toBe(true);
    });

    it('should override multiple flags', () => {
      expect(FLAGS.newNavigation).toBe(false);
      expect(FLAGS.animalWorkspace).toBe(false);

      overrideFlags({
        newNavigation: true,
        animalWorkspace: true,
      });

      expect(FLAGS.newNavigation).toBe(true);
      expect(FLAGS.animalWorkspace).toBe(true);
    });

    it('should restore flags to original values', () => {
      expect(FLAGS.newNavigation).toBe(false);

      overrideFlags({ newNavigation: true });
      expect(FLAGS.newNavigation).toBe(true);

      restoreFlags();
      expect(FLAGS.newNavigation).toBe(false);
    });

    it('should restore multiple flags', () => {
      overrideFlags({
        newNavigation: true,
        animalWorkspace: true,
        channelMapEditor: true,
      });

      expect(FLAGS.newNavigation).toBe(true);
      expect(FLAGS.animalWorkspace).toBe(true);
      expect(FLAGS.channelMapEditor).toBe(true);

      restoreFlags();

      expect(FLAGS.newNavigation).toBe(false);
      expect(FLAGS.animalWorkspace).toBe(false);
      expect(FLAGS.channelMapEditor).toBe(false);
    });

    it('should not affect unoverridden flags', () => {
      expect(FLAGS.shadowExportStrict).toBe(true);

      overrideFlags({ newNavigation: true });

      expect(FLAGS.shadowExportStrict).toBe(true);

      restoreFlags();

      expect(FLAGS.shadowExportStrict).toBe(true);
    });

    it('should allow multiple override/restore cycles', () => {
      // First cycle
      overrideFlags({ newNavigation: true });
      expect(FLAGS.newNavigation).toBe(true);
      restoreFlags();
      expect(FLAGS.newNavigation).toBe(false);

      // Second cycle
      overrideFlags({ animalWorkspace: true });
      expect(FLAGS.animalWorkspace).toBe(true);
      restoreFlags();
      expect(FLAGS.animalWorkspace).toBe(false);
    });

    it('should handle restoreFlags when no override was made', () => {
      expect(FLAGS.newNavigation).toBe(false);

      // Should not throw error
      expect(() => restoreFlags()).not.toThrow();

      expect(FLAGS.newNavigation).toBe(false);
    });

    it('should handle multiple restoreFlags calls', () => {
      overrideFlags({ newNavigation: true });
      restoreFlags();

      // Second restore should not throw or change state
      expect(() => restoreFlags()).not.toThrow();
      expect(FLAGS.newNavigation).toBe(false);
    });
  });

  describe('Flag Groups by Milestone', () => {
    it('should have M1 flags (shadow export)', () => {
      expect(FLAGS).toHaveProperty('shadowExportStrict');
      expect(FLAGS).toHaveProperty('shadowExportLog');
    });

    it('should have M2 flags (navigation)', () => {
      expect(FLAGS).toHaveProperty('newNavigation');
      expect(FLAGS).toHaveProperty('showLegacyToggle');
    });

    it('should have M3 flags (animal workspace)', () => {
      expect(FLAGS).toHaveProperty('animalWorkspace');
      expect(FLAGS).toHaveProperty('localStoragePersistence');
    });

    it('should have M4-M5 flags (day editor)', () => {
      expect(FLAGS).toHaveProperty('newDayEditor');
      expect(FLAGS).toHaveProperty('inlineValidation');
    });

    it('should have M6 flags (channel map)', () => {
      expect(FLAGS).toHaveProperty('channelMapEditor');
      expect(FLAGS).toHaveProperty('channelMapCSV');
    });

    it('should have M7-M9 flags (validation)', () => {
      expect(FLAGS).toHaveProperty('crossDayValidation');
      expect(FLAGS).toHaveProperty('validationSummary');
      expect(FLAGS).toHaveProperty('batchExport');
    });

    it('should have M10 flags (probe reconfig)', () => {
      expect(FLAGS).toHaveProperty('probeReconfigWizard');
    });

    it('should have M11 flags (accessibility)', () => {
      expect(FLAGS).toHaveProperty('keyboardShortcuts');
      expect(FLAGS).toHaveProperty('highContrastMode');
    });

    it('should have development flags', () => {
      expect(FLAGS).toHaveProperty('debugLogging');
      expect(FLAGS).toHaveProperty('performanceProfiling');
      expect(FLAGS).toHaveProperty('simulateSlowNetwork');
    });
  });

  describe('Integration with isFeatureEnabled', () => {
    afterEach(() => {
      restoreFlags();
    });

    it('should reflect overridden flag values in isFeatureEnabled', () => {
      expect(isFeatureEnabled('newNavigation')).toBe(false);

      overrideFlags({ newNavigation: true });

      expect(isFeatureEnabled('newNavigation')).toBe(true);
    });

    it('should reflect restored flag values in isFeatureEnabled', () => {
      overrideFlags({ newNavigation: true });
      expect(isFeatureEnabled('newNavigation')).toBe(true);

      restoreFlags();

      expect(isFeatureEnabled('newNavigation')).toBe(false);
    });
  });

  describe('Integration with getEnabledFeatures', () => {
    afterEach(() => {
      restoreFlags();
    });

    it('should include overridden flags in enabled list', () => {
      overrideFlags({ newNavigation: true });

      const enabled = getEnabledFeatures();

      expect(enabled).toContain('newNavigation');
    });

    it('should exclude disabled flags from enabled list after restore', () => {
      overrideFlags({ newNavigation: true });
      restoreFlags();

      const enabled = getEnabledFeatures();

      expect(enabled).not.toContain('newNavigation');
    });
  });
});
