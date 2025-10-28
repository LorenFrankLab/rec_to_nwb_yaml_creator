/**
 * Feature Flags for Incremental Refactoring
 *
 * This file defines feature flags that control which features are enabled during
 * the incremental refactoring process. All flags default to FALSE to ensure the
 * current application behavior is preserved until explicitly enabled.
 *
 * Philosophy:
 * - New features are hidden behind flags until fully tested
 * - Flags allow A/B testing and gradual rollout
 * - Legacy behavior remains default until new features reach parity
 * - Flags can be toggled per-environment (dev/staging/prod)
 *
 * Usage:
 * ```javascript
 * import { FLAGS, isFeatureEnabled } from './featureFlags';
 *
 * // Simple check
 * if (FLAGS.newNavigation) {
 *   return <NewNavigationComponent />;
 * }
 *
 * // With utility
 * if (isFeatureEnabled('newNavigation')) {
 *   return <NewNavigationComponent />;
 * }
 * ```
 *
 * Lifecycle:
 * 1. Add flag (default: false)
 * 2. Implement feature behind flag
 * 3. Test with flag enabled
 * 4. Gradual rollout (dev → staging → prod)
 * 5. Remove flag after stabilization (1+ releases)
 *
 * @module featureFlags
 */

/**
 * Feature flag definitions
 *
 * All flags default to FALSE to preserve existing behavior.
 * Flags are grouped by milestone for easier tracking.
 */
export const FLAGS = {
  // ============================================================================
  // M1: Pure Utilities & Shadow Export
  // ============================================================================

  /**
   * Enable shadow export validation in tests
   *
   * When true, runs both old and new YAML export implementations and compares
   * outputs byte-for-byte. Fails tests if outputs differ.
   *
   * Purpose: Ensure YAML export parity during refactoring
   * Milestone: M1
   * Default: true (always validate in tests)
   */
  shadowExportStrict: true,

  /**
   * Log shadow export mismatches in development
   *
   * When true, logs differences between old and new YAML exports to console
   * without failing tests. Useful for debugging export issues.
   *
   * Purpose: Debug YAML export differences
   * Milestone: M1
   * Default: true (helpful for development)
   */
  shadowExportLog: true,

  // ============================================================================
  // M2: UI Skeleton & Navigation
  // ============================================================================

  /**
   * Enable new hash-based navigation system
   *
   * When true, shows new navigation bar with routes:
   * - #/ (home)
   * - #/workspace (animal workspace)
   * - #/day/:id (day editor)
   * - #/validation (validation summary)
   *
   * When false, shows legacy single-page form.
   *
   * Purpose: Gradual rollout of new navigation
   * Milestone: M2
   * Default: false (legacy is default)
   */
  newNavigation: false,

  /**
   * Show "Use Legacy Editor" toggle in UI
   *
   * When true, displays toggle to switch between new and legacy editors.
   * Useful for beta testing and comparing behaviors.
   *
   * Purpose: Allow users to revert to legacy UI
   * Milestone: M2
   * Default: false (no toggle in legacy mode)
   */
  showLegacyToggle: false,

  // ============================================================================
  // M3: Animal/Day Hierarchy
  // ============================================================================

  /**
   * Enable animal workspace (multi-animal management)
   *
   * When true, allows creating/managing multiple animals with multiple days.
   * When false, legacy single-session editor.
   *
   * Purpose: Enable multi-animal workflows
   * Milestone: M3
   * Default: false (legacy is default)
   */
  animalWorkspace: false,

  /**
   * Enable localStorage persistence for animal/day data
   *
   * When true, automatically saves animal/day state to localStorage.
   * When false, state only persists in memory during session.
   *
   * Purpose: Autosave functionality
   * Milestone: M3
   * Default: false (memory-only)
   */
  localStoragePersistence: false,

  // ============================================================================
  // M4-M5: Day Editor
  // ============================================================================

  /**
   * Enable new stepper-based day editor
   *
   * When true, day editor uses stepper navigation (Overview → Devices → Epochs → Export).
   * When false, legacy single-page form.
   *
   * Purpose: Guided workflow for day editing
   * Milestone: M4
   * Default: false (legacy is default)
   */
  newDayEditor: false,

  /**
   * Enable inline validation in day editor
   *
   * When true, validates fields as user types/blurs.
   * When false, validation only runs on form submission.
   *
   * Purpose: Immediate feedback for users
   * Milestone: M5
   * Default: false (legacy submit-time validation)
   */
  inlineValidation: false,

  // ============================================================================
  // M6: Channel Map Editor
  // ============================================================================

  /**
   * Enable new channel map grid editor
   *
   * When true, shows interactive grid for editing ntrode channel maps.
   * When false, legacy table-based editor.
   *
   * Purpose: Improved UX for channel mapping
   * Milestone: M6
   * Default: false (legacy table)
   */
  channelMapEditor: false,

  /**
   * Enable CSV import/export for channel maps
   *
   * When true, allows importing/exporting channel maps as CSV files.
   * When false, manual entry only.
   *
   * Purpose: Bulk channel map editing
   * Milestone: M6
   * Default: false (manual entry)
   */
  channelMapCSV: false,

  // ============================================================================
  // M7-M9: Validation & Export
  // ============================================================================

  /**
   * Enable cross-day validation
   *
   * When true, validates consistency across multiple days for same animal
   * (e.g., probe configuration changes).
   * When false, validates single day only.
   *
   * Purpose: Detect cross-day inconsistencies
   * Milestone: M7
   * Default: false (single-day validation)
   */
  crossDayValidation: false,

  /**
   * Enable validation summary page
   *
   * When true, shows aggregate validation status for all animals/days.
   * When false, validation shown inline only.
   *
   * Purpose: Batch validation overview
   * Milestone: M9
   * Default: false (inline only)
   */
  validationSummary: false,

  /**
   * Enable batch export (multiple YAMLs)
   *
   * When true, allows exporting multiple days as ZIP archive.
   * When false, single-day export only.
   *
   * Purpose: Bulk export functionality
   * Milestone: M9
   * Default: false (single-day export)
   */
  batchExport: false,

  // ============================================================================
  // M10: Probe Reconfiguration
  // ============================================================================

  /**
   * Enable probe reconfiguration wizard
   *
   * When true, shows diff when device configuration changes between days.
   * When false, no automatic detection of probe changes.
   *
   * Purpose: Track probe reconfiguration across sessions
   * Milestone: M10
   * Default: false (no tracking)
   */
  probeReconfigWizard: false,

  // ============================================================================
  // M11: Accessibility
  // ============================================================================

  /**
   * Enable global keyboard shortcuts
   *
   * When true, adds keyboard shortcuts for common actions:
   * - Ctrl+S: Save
   * - Ctrl+Enter: Next step
   * - Ctrl+Shift+E: Add epoch
   * - etc.
   *
   * Purpose: Power user shortcuts
   * Milestone: M11
   * Default: false (mouse/touch only)
   */
  keyboardShortcuts: false,

  /**
   * Enable high contrast mode
   *
   * When true, applies high contrast color scheme for accessibility.
   * When false, default color scheme.
   *
   * Purpose: Accessibility for visual impairments
   * Milestone: M11
   * Default: false (default colors)
   */
  highContrastMode: false,

  // ============================================================================
  // Development & Testing Flags
  // ============================================================================

  /**
   * Enable debug logging
   *
   * When true, logs detailed state changes, validation results, and actions.
   * When false, production logging only (errors/warnings).
   *
   * Purpose: Development debugging
   * Default: false (production mode)
   */
  debugLogging: false,

  /**
   * Enable performance profiling
   *
   * When true, logs render times, state update times, and performance metrics.
   * When false, no performance tracking.
   *
   * Purpose: Performance optimization
   * Default: false (no overhead)
   */
  performanceProfiling: false,

  /**
   * Simulate slow network (for testing)
   *
   * When true, adds artificial delays to file operations.
   * When false, normal speed.
   *
   * Purpose: Test loading states
   * Default: false (normal speed)
   */
  simulateSlowNetwork: false,
};

/**
 * Check if a feature is enabled
 *
 * @param {string} featureName - Name of feature flag
 * @returns {boolean} True if feature is enabled
 *
 * @example
 * if (isFeatureEnabled('newNavigation')) {
 *   return <NewNav />;
 * }
 */
export function isFeatureEnabled(featureName) {
  if (!(featureName in FLAGS)) {
    console.warn(`Unknown feature flag: ${featureName}`);
    return false;
  }
  return FLAGS[featureName];
}

/**
 * Get all enabled features
 *
 * @returns {string[]} Array of enabled feature names
 *
 * @example
 * const enabled = getEnabledFeatures();
 * console.log('Enabled features:', enabled.join(', '));
 */
export function getEnabledFeatures() {
  return Object.entries(FLAGS)
    .filter(([_, enabled]) => enabled)
    .map(([name, _]) => name);
}

/**
 * Get all disabled features
 *
 * @returns {string[]} Array of disabled feature names
 */
export function getDisabledFeatures() {
  return Object.entries(FLAGS)
    .filter(([_, enabled]) => !enabled)
    .map(([name, _]) => name);
}

/**
 * Override feature flags (for testing)
 *
 * WARNING: This mutates the FLAGS object. Only use in tests.
 *
 * @param {object} overrides - Object with flag overrides
 *
 * @example
 * // In test
 * overrideFlags({ newNavigation: true });
 * // ... test code ...
 * restoreFlags();
 */
let flagBackup = null;

/**
 *
 * @param overrides
 */
export function overrideFlags(overrides) {
  if (!flagBackup) {
    flagBackup = { ...FLAGS };
  }
  Object.assign(FLAGS, overrides);
}

/**
 * Restore original flag values (for testing)
 *
 * @example
 * afterEach(() => {
 *   restoreFlags();
 * });
 */
export function restoreFlags() {
  if (flagBackup) {
    Object.assign(FLAGS, flagBackup);
    flagBackup = null;
  }
}

/**
 * Get feature flag status summary (for debugging/logging)
 *
 * @returns {object} Summary of flag status
 *
 * @example
 * console.log('Feature flags:', getFlagSummary());
 */
export function getFlagSummary() {
  const enabled = getEnabledFeatures();
  const disabled = getDisabledFeatures();

  return {
    total: Object.keys(FLAGS).length,
    enabled: enabled.length,
    disabled: disabled.length,
    enabledFeatures: enabled,
    disabledFeatures: disabled,
  };
}

// Export default for convenience
export default FLAGS;
