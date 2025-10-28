/**
 * Home View - Animal Selection (Stub for M2)
 *
 * Placeholder for future animal selection interface.
 * Will be implemented in M3.
 */

import React from 'react';

/**
 *
 */
export function Home() {
  return (
    <main id="main-content" tabIndex="-1" role="main" aria-labelledby="home-heading">
      <h1 id="home-heading">Home - Animal Selection</h1>

      <div className="feature-preview" role="region" aria-label="Feature status">
        <p>
          <strong>Status:</strong> In Development (Milestone 3)
        </p>

        <p>This view will allow you to:</p>
        <ul>
          <li>Select an animal for multi-day metadata creation</li>
          <li>Create new animal profiles</li>
          <li>Import existing animal data</li>
          <li>View recently edited animals</li>
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

export default Home;
