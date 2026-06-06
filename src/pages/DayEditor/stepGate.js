/**
 * Day-editor export gate — re-export of the domain gate.
 *
 * The implementation moved to `src/domain/stepGate.js` (Phase 8.6) so the workflow-status
 * helper can consult the same gate the UI enforces without crossing a page boundary. This
 * file is kept as a thin re-export so the in-folder Day Editor consumers (StepNavigation,
 * DayEditorStepper, ExportStep) and their tests keep their existing import path.
 *
 * @module pages/DayEditor/stepGate
 */
export { isExportEnabled, exportBlockReason } from '../../domain/stepGate';
