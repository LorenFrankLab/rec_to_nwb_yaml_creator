/**
 * Validation Summary View - Cross-Day Validation (Stub for M2)
 *
 * Placeholder for batch validation and export interface.
 * Will be implemented in M9.
 */

import React from 'react';

/**
 *
 */
export function ValidationSummary() {
  return (
    <main id="main-content" tabIndex="-1" role="main" aria-labelledby="validation-heading">
      <h1 id="validation-heading">Validation Summary</h1>

      <div className="feature-preview" role="region" aria-label="Feature status">
        <p>
          <strong>Status:</strong> In Development (Milestone 9)
        </p>

        <p>This view will allow you to:</p>
        <ul>
          <li>View validation status for all recording days</li>
          <li>Batch validate multiple sessions at once</li>
          <li>Export only valid sessions</li>
          <li>See detailed validation errors with scroll-to-field links</li>
          <li>Track which days are draft, validated, or exported</li>
        </ul>

        <p>
          <strong>Current workflow:</strong> Use the{' '}
          <a href="#/">legacy form</a> to create and validate individual YAML files.
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

export default ValidationSummary;
