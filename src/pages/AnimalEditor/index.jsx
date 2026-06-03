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
 * hook in AnimalEditorStepper. AnimalEditorStepper (and its error screen) render the
 * single <main id="main-content"> for this route, so this entry adds no wrapper
 * landmark (avoids a duplicate <main>/#main-content).
 *
 * @returns {JSX.Element}
 */
export default function AnimalEditor() {
  return <AnimalEditorStepper />;
}
