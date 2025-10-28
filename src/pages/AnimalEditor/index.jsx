import React from 'react';
import AnimalEditorStepper from './AnimalEditorStepper';

/**
 * AnimalEditor - Entry point for animal-level device configuration
 *
 * Route: #/animal/{animalId}/editor
 * Example: #/animal/remy/editor
 *
 * Provides interface for:
 * - Electrode groups configuration (device type, location, coordinates)
 * - Channel maps editing (logical → hardware channel mapping)
 * - Copy/template from existing animals
 *
 * Note: Component receives no props - animal ID is obtained via useAnimalIdFromUrl
 * hook in AnimalEditorStepper.
 *
 * @returns {JSX.Element}
 */
export default function AnimalEditor() {
  return (
    <main
      id="main-content"
      role="main"
      tabIndex="-1"
    >
      <AnimalEditorStepper />
    </main>
  );
}
