/**
 * Animal Workspace View - Multi-Day Management (M4)
 *
 * The legacy hub: an animal picker (left rail) + the per-animal recording-days pane. The pane
 * itself lives in {@link RecordingDaysTab} (extracted in Phase 1 — tabbed-workspace-ia — so the
 * new `#/animal/:id/days` route can render the same implementation without forking). This shell
 * owns only animal SELECTION; everything about a selected animal's days is the tab's concern.
 *
 * @see docs/ANIMAL_WORKSPACE_DESIGN.md for UI mockups
 * @see docs/animal_hierarchy.md for data model
 */

import React, { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import { useStoreContext } from '../../state/StoreContext';
import { classifyAnimalDays, isPresentRecordStatus } from '../../domain/dayRecovery';
import { RecordingDaysTab } from './RecordingDaysTab';
import './AnimalWorkspace.css';

/**
 * AnimalWorkspace Component
 *
 * Main workspace view for managing animals and their recording days.
 * Supports URL parameter ?animal=<id> to auto-select an animal on load.
 */
export function AnimalWorkspace() {
  const { model } = useStoreContext();
  const [selectedAnimalId, setSelectedAnimalId] = useState(null);

  // Default the required sections so a workspace that somehow reaches here without them
  // renders its empty state instead of crashing on Object.keys(undefined).
  const { animals = {}, days = {} } = model.workspace;
  const animalIds = Object.keys(animals);
  const hasAnimals = animalIds.length > 0;

  const selectedAnimal = selectedAnimalId ? animals[selectedAnimalId] : null;

  // On mount, select an animal so the setup/review state is visible immediately rather than
  // one click hidden: honor an explicit `?animal=<id>`; with no param, auto-select the SOLE
  // animal (the unambiguous case). An explicit-but-unknown `?animal` selects nothing (the user
  // asked for a specific animal — don't substitute a different one).
  useEffect(() => {
    const params = new URLSearchParams(window.location.hash.split('?')[1]);
    const animalParam = params.get('animal');

    if (animalParam) {
      if (animals[animalParam]) setSelectedAnimalId(animalParam);
      return;
    }
    const ids = Object.keys(animals);
    if (ids.length === 1) {
      setSelectedAnimalId(ids[0]);
    }
  }, []); // Run only on mount

  /**
   * Handle animal selection
   * @param {string} animalId - Animal identifier to select
   */
  function handleSelectAnimal(animalId) {
    setSelectedAnimalId(animalId);
  }

  return (
    <main id="main-content" tabIndex="-1" role="main" aria-labelledby="workspace-heading">
      <h1 id="workspace-heading">Animal Workspace</h1>

      {!hasAnimals ? (
        /* Empty State: No Animals */
        <div className="empty-state" role="region" aria-label="Empty workspace">
          <p className="empty-message">No animals created yet.</p>
          <p>Create your first animal to start managing recording sessions.</p>
          <a href="#/home" className="create-animal-link">
            Create Animal
          </a>
        </div>
      ) : (
        /* Main Content: Animal List + Day Management */
        <div className="workspace-content">
          {/* Animal List Sidebar */}
          <nav className="animal-list" aria-label="Animal list">
            <div className="animal-list-header">
              <h2>Animals</h2>
              <a href="#/home" className="btn-create-animal" aria-label="Create new animal">
                + New Animal
              </a>
            </div>
            {animalIds.map((animalId) => {
              const animal = animals[animalId];
              // Count day RECORDS present (indexed + recovered), via the recovery classifier, so
              // a missing/corrupt index doesn't under-count an animal with recovered records.
              const dayCount = classifyAnimalDays(animalId, animal, days).filter(
                (d) => isPresentRecordStatus(d.status)
              ).length;
              const isSelected = animalId === selectedAnimalId;

              return (
                <button
                  key={animalId}
                  className={`animal-card ${isSelected ? 'selected' : ''}`}
                  onClick={() => handleSelectAnimal(animalId)}
                  aria-pressed={isSelected}
                >
                  <div className="animal-name">{animalId}</div>
                  <div className="animal-day-count">
                    {dayCount} {dayCount === 1 ? 'day' : 'days'}
                  </div>
                </button>
              );
            })}
          </nav>

          {/* Day List Main Area */}
          <section className="day-management" aria-labelledby="day-list-heading">
            {!selectedAnimal ? (
              /* Prompt to select animal */
              <div className="empty-state">
                <p>Select an animal to view and manage recording days.</p>
              </div>
            ) : (
              <RecordingDaysTab animalId={selectedAnimalId} />
            )}
          </section>
        </div>
      )}
    </main>
  );
}

AnimalWorkspace.propTypes = {};

export default AnimalWorkspace;
