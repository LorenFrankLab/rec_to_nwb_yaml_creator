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

import React from 'react';
import PropTypes from 'prop-types';
import DayEditorStepper from './DayEditorStepper';
import './DayEditor.css';

/**
 * Day Editor - Entry point for day editing workflow
 *
 * Renders the DayEditorStepper which manages the multi-step interface.
 * The dayId prop is provided by AppLayout from the URL hash.
 *
 * @param {object} props
 * @param {string} props.dayId - Day identifier from URL (e.g., "remy-2023-06-22")
 * @returns {JSX.Element}
 */
export function DayEditor({ dayId }) {
  // DayEditorStepper reads dayId from URL via useDayIdFromUrl hook
  // We don't need to pass it as a prop since it parses the hash directly
  return <DayEditorStepper />;
}

DayEditor.propTypes = {
  dayId: PropTypes.string,
};

export default DayEditor;
