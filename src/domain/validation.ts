/**
 * @fileoverview Workspace day-validation and repair-routing domain module (public barrel).
 *
 * The single owner of app-wide day validation composition, step-status computation,
 * issue→step/owner routing, and Animal-Editor deep-link routing. Consumed by the Day
 * Editor steps, the Animal Editor, the Validation summary, the Export step, and the
 * shared RepairActions — none of which may own this behavior themselves. Builds on the
 * core schema/rules validation in `src/validation`; the page-only field-blur helper
 * (`validateField`) stays in `pages/DayEditor/validation.js`.
 *
 * Phase 9a split the former ~1200-LOC monolith into focused, individually-testable modules
 * with NO behavior change (golden baselines byte-identical; contract/guard tests unchanged).
 * This barrel re-exports their stable public surface so every existing
 * `import … from '.../domain/validation'` keeps working:
 *   - {@link module:domain/dayValidationComposer} — `validateDay` (the authoritative issue list);
 *   - {@link module:domain/stepStatus} — `computeStepStatus` (+ the per-step helpers, `STEP_STATUS`);
 *   - {@link module:domain/repairRouting} — issue→step/surface/animal-tab routing (`repairTargetForIssue`,
 *     `stepIdForIssue`, `animalSetupTabForFieldPath`, `STEP_LABELS`, `SURFACE_BY_CODE`, `ANIMAL_SETUP_TABS`);
 *   - {@link module:domain/dayOverrideValidation} — the override / data-acq / bad-channel issue producers;
 *   - {@link module:domain/geometryProvenance} — geometry-override provenance (internal to the composer).
 */

export { validateDay } from './dayValidationComposer';

export {
  STEP_STATUS,
  computeStepStatus,
  computeEpochsStatus,
  computeBehavioralStatus,
  computeDevicesStatus,
  groupErrorsByStep,
} from './stepStatus';

export {
  STEP_LABELS,
  SURFACE_BY_CODE,
  ANIMAL_SETUP_TABS,
  stepIdForIssue,
  animalSetupTabForFieldPath,
  repairTargetForIssue,
} from './repairRouting';

export {
  dayOverrideIssues,
  danglingDataAcqRefIssue,
  divergentDataAcqCatalogIssue,
  badChannelUnfailIssues,
} from './dayOverrideValidation';
