/**
 * Animal Workspace View - Day Management (Stub for M2)
 *
 * Placeholder for multi-day management interface.
 * Will be implemented in M4.
 */

import React from 'react';

/**
 *
 */
export function AnimalWorkspace() {
  return (
    <main id="main-content" tabIndex="-1" role="main" aria-labelledby="workspace-heading">
      <h1 id="workspace-heading">Animal Workspace</h1>

      <div className="feature-preview" role="region" aria-label="Feature status">
        <p>
          <strong>Status:</strong> In Development (Milestone 4)
        </p>

        <p>This view will allow you to:</p>
        <ul>
          <li>Manage multiple recording days for one animal</li>
          <li>Batch create session metadata</li>
          <li>View validation status across all days</li>
          <li>Export multiple YAML files at once</li>
          <li>Track probe reconfigurations over time</li>
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

export default AnimalWorkspace;
