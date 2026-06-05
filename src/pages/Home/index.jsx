/**
 * Home View - Animal Creation
 *
 * Container component for creating new animal subjects.
 * Integrates with store and handles navigation.
 */

import React from 'react';
import { useStoreContext } from '../../state/StoreContext';
import AnimalCreationForm from './AnimalCreationForm';
import './Home.css';

/**
 * Get default experimenter values from workspace settings or last animal
 * @param {object} workspace - Workspace state
 * @returns {{ experimenter_names: string[], lab: string, institution: string }}
 */
function getDefaultExperimenters(workspace) {
  // Default `animals` so an incomplete workspace can't crash the Object.keys() below.
  const { settings, animals = {} } = workspace;

  // Priority 1: Workspace settings (if non-empty). Keys are camelCase to match the
  // canonical settings shape (createDefaultWorkspace / useWorkspace / WorkspaceSettings);
  // snake_case keys never exist at runtime, so reading them silently skipped this branch.
  if (settings?.defaultLab?.trim()) {
    return {
      experimenter_names: settings.defaultExperimenters || [''],
      lab: settings.defaultLab,
      institution: settings.defaultInstitution,
    };
  }

  // Priority 2: Most recent animal's experimenters
  const animalIds = Object.keys(animals).sort();
  if (animalIds.length > 0) {
    const lastAnimal = animals[animalIds[animalIds.length - 1]];
    return {
      experimenter_names: lastAnimal.experimenters.experimenter_name || [''],
      lab: lastAnimal.experimenters.lab || '',
      institution: lastAnimal.experimenters.institution || '',
    };
  }

  // Priority 3: Hardcoded Frank Lab defaults
  return {
    experimenter_names: [''],
    lab: 'Loren Frank Lab',
    institution: 'University of California, San Francisco',
  };
}

/**
 * Home - Animal Creation Container
 */
export function Home() {
  const { model, actions } = useStoreContext();

  const handleSubmit = (formData) => {
    const animalId = formData.subject_id.toLowerCase().trim();

    // Build subject object (matches NWB schema). `description` is schema-required
    // (non-empty); auto-generate a label from genotype + species when left blank.
    const subject = {
      subject_id: animalId,
      species: formData.species,
      sex: formData.sex,
      genotype: formData.genotype,
      date_of_birth: formData.date_of_birth,
      weight: formData.weight,
      description: formData.description?.trim()
        ? formData.description.trim()
        : `${formData.genotype} ${formData.species}`.trim(),
    };

    // Build metadata object
    const metadata = {
      experimenters: {
        experimenter_name: formData.experimenter_names.filter((n) => n.trim()),
        lab: formData.lab,
        institution: formData.institution,
      },
      // Devices auto-created empty (configured later in Day Editor). `device.name`
      // is schema-required (minItems: 1), so seed it with the legacy default.
      devices: {
        data_acq_device: [],
        device: { name: ['Trodes'] },
        electrode_groups: [],
        ntrode_electrode_group_channel_map: [],
      },
      cameras: [],
      technicalDefaults: {
        raw_data_to_volts: 0.195,
        times_period_multiplier: 1.5,
      },
    };

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
