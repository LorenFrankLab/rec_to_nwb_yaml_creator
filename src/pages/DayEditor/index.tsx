/**
 * Day Editor View - Session Metadata Editor (M5 Implementation)
 *
 * Multi-step guided editor for recording session metadata with:
 * - Overview: Session information with inherited animal defaults
 * - Devices: Electrode groups, cameras (M6 - stub)
 * - Epochs: Tasks, behavioral events (M7 - stub)
 * - Validation: Summary of all errors (M9 - stub)
 * - Export: YAML file download (M10 - stub)
 */

import DayEditorStepper from './DayEditorStepper';
import './DayEditor.scss';

interface DayEditorProps {
  /**
   * Day identifier from the URL (provided by AppLayout). Unused here — the stepper reads the
   * hash directly via `useDayIdFromUrl` — but kept on the contract AppLayout passes.
   */
  dayId?: string;
}

/**
 * Day Editor - Entry point for day editing workflow
 *
 * Renders the DayEditorStepper which manages the multi-step interface.
 */
export function DayEditor(_props: DayEditorProps) {
  // DayEditorStepper reads dayId from URL via useDayIdFromUrl hook
  // We don't need to pass it as a prop since it parses the hash directly
  return <DayEditorStepper />;
}

export default DayEditor;
