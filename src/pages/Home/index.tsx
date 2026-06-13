/**
 * Home View - Animal Creation
 *
 * Container component for creating new animal subjects.
 * Integrates with store and handles navigation.
 */

import { useStoreContext } from '../../state/StoreContext';
import { buildAnimalFromForm, getDefaultExperimenters } from '../../domain/animalCreation';
import type { AnimalCreationFormData } from '../../domain/animalCreation';
import AnimalCreationForm from './AnimalCreationForm';
import './Home.css';

/**
 * Home - Animal Creation Container
 */
export function Home() {
  const { model, actions } = useStoreContext();

  const handleSubmit = (formData: AnimalCreationFormData) => {
    // Build the subject + metadata shapes from the SAME glue the workspace's inline create panel
    // uses, so both entry points produce identical animals.
    const { animalId, subject, metadata } = buildAnimalFromForm(formData);

    // Defense-in-depth: the store's createAnimal throws on a duplicate id, but it does so from
    // inside a React state updater — that throw can't be caught here, so an unconditional navigate
    // would falsely land the user "in the new animal" while the create failed. The form already
    // enforces uniqueness; this guard (reading the same animals map) keeps a future form regression
    // from becoming a silent false-success. On collision we don't navigate — the form owns the
    // user-facing "already exists" message.
    if (model.workspace.animals?.[animalId]) return;

    actions.createAnimal(animalId, subject, metadata);
    window.location.hash = `#/workspace?animal=${animalId}`;
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
    <main id="main-content" tabIndex={-1} role="main">
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
