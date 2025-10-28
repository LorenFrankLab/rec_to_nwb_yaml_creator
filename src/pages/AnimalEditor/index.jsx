import React from 'react';
import AnimalEditorStepper from './AnimalEditorStepper';

/**
 * AnimalEditor - Entry point for animal-level device configuration
 *
 * Route: #/animal/:id/editor
 *
 * Provides interface for:
 * - Electrode groups configuration (device type, location, coordinates)
 * - Channel maps editing (logical → hardware channel mapping)
 * - Copy/template from existing animals
 *
 * @returns {JSX.Element}
 */
export default function AnimalEditor() {
  return (
    <main
      id="main-content"
      role="main"
      aria-labelledby="animal-editor-heading"
      tabIndex="-1"
    >
      <AnimalEditorStepper />
    </main>
  );
}
