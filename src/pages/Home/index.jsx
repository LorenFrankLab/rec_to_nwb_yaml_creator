/**
 * Home View - Animal Creation
 *
 * Container component for creating new animal subjects.
 * Integrates with store and handles navigation.
 */

import React from 'react';
import { useStoreContext } from '../../state/StoreContext';
import { buildAnimalFromForm, getDefaultExperimenters } from '../../domain/animalCreation';
import AnimalCreationForm from './AnimalCreationForm';
import './Home.css';

/**
 * Home - Animal Creation Container
 */
export function Home() {
  const { model, actions } = useStoreContext();

  const handleSubmit = (formData) => {
    // Build the subject + metadata shapes from the SAME glue the workspace's inline create panel
    // uses, so both entry points produce identical animals.
    const { animalId, subject, metadata } = buildAnimalFromForm(formData);

    try {
      // createAnimal applies the workspace update synchronously from the caller's
      // perspective; navigate immediately rather than via a setTimeout that could
      // fire before the entity exists. (Duplicate-id validation lives inside the
      // store updater and is not surfaced to this catch — a known gap, not relied on
      // here; the form already enforces id uniqueness before submit.)
      actions.createAnimal(animalId, subject, metadata);
      window.location.hash = `#/workspace?animal=${animalId}`;
    } catch (error) {
      console.error('Failed to create animal:', error);
      // Error is re-thrown to be handled by form
      throw error;
    }
  };

  const animals = model.workspace.animals || {};

  const handleCancel = () => {
    if (Object.keys(animals).length > 0) {
      // Animals exist - go to workspace
      window.location.hash = '#/workspace';
    } else {
      // No animals - go to legacy form
      window.location.hash = '#/';
    }
  };

  const defaultExperimenters = getDefaultExperimenters(model.workspace);
  const showCancelAsSkip = Object.keys(animals).length === 0;

  return (
    <main id="main-content" tabIndex="-1" role="main">
      <div className="animal-creation-container">
        {showCancelAsSkip && (
          <div className="first-time-user-notice" role="note">
            <p>
              <strong>Welcome!</strong> To get started, create your first animal subject.
            </p>
            <p>
              Need help?{' '}
              <a
                href="https://github.com/LorenFrankLab/rec_to_nwb_yaml_creator/blob/main/README.md"
                target="_blank"
                rel="noopener noreferrer"
              >
                Read Getting Started Guide
              </a>
            </p>
          </div>
        )}

        <AnimalCreationForm
          onSubmit={handleSubmit}
          onCancel={handleCancel}
          defaultExperimenters={defaultExperimenters}
          existingAnimals={animals}
          showCancelAsSkip={showCancelAsSkip}
        />
      </div>
    </main>
  );
}

export default Home;
