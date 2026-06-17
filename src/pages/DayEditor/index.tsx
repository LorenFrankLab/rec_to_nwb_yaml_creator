/**
 * Day Editor View — recording-session metadata editor (`#/day/:id`).
 *
 * Renders the tabbed {@link DayEditorFrame} (Day / Epochs / Failed channels / DIO, plus the
 * export-preview surface). This replaced the legacy multi-step `DayEditorStepper` in the
 * epoch-editor redesign; the per-section content now lives in the frame's tabs.
 */

import DayEditorFrame from './DayEditorFrame';
import './DayEditor.scss';

interface DayEditorProps {
  /**
   * Day identifier from the URL (provided by AppLayout). Unused here — the frame reads the
   * hash directly via `useDayIdFromUrl` — but kept on the contract AppLayout passes.
   */
  dayId?: string;
}

/**
 * Day Editor - Entry point for day editing workflow
 *
 * Renders the DayEditorFrame, which manages the day-editor chrome (header chips + readiness bar +
 * the Day / Epochs / Failed channels / DIO tab bar).
 */
export function DayEditor(_props: DayEditorProps) {
  // DayEditorFrame reads dayId from URL via useDayIdFromUrl hook
  // We don't need to pass it as a prop since it parses the hash directly
  return <DayEditorFrame />;
}

export default DayEditor;
