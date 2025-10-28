/**
 * Day Editor View - Session Metadata Editor (Stub for M2)
 *
 * Placeholder for guided day editor with stepper interface.
 * Will be implemented in M5-M7.
 */

import React from 'react';
import PropTypes from 'prop-types';

/**
 *
 * @param root0
 * @param root0.dayId
 */
export function DayEditor({ dayId }) {
  return (
    <main id="main-content" tabIndex="-1" role="main" aria-labelledby="editor-heading">
      <h1 id="editor-heading">Day Editor</h1>

      <div className="feature-preview" role="region" aria-label="Feature status">
        <p>
          <strong>Status:</strong> In Development (Milestone 5-7)
        </p>

        {dayId && (
          <p>
            <strong>Day ID:</strong> {dayId}
          </p>
        )}

        <p>This view will provide:</p>
        <ul>
          <li>Guided stepper interface (Overview, Devices, Epochs, Validation, Export)</li>
          <li>Field-level validation with inline error messages</li>
          <li>Channel map editor for electrode configuration</li>
          <li>Cross-reference validation (cameras, tasks, epochs)</li>
          <li>Safe export with shadow YAML comparison</li>
        </ul>

        <p>
          <strong>Current workflow:</strong> Use the{' '}
          <a href="#/">legacy form</a> to create individual YAML files.
        </p>

        <p className="help-text">
          Questions? See the{' '}
          <a
            href="https://github.com/LorenFrankLab/rec_to_nwb_yaml_creator/blob/main/docs/TASKS.md"
            target="_blank"
            rel="noopener noreferrer"
          >
            development roadmap
          </a>
          .
        </p>
      </div>
    </main>
  );
}

DayEditor.propTypes = {
  dayId: PropTypes.string,
};

export default DayEditor;
