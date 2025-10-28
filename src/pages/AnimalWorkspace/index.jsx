/**
 * Animal Workspace View - Multi-Day Management (M4)
 *
 * Provides interface for managing multiple recording days for one or more animals.
 * Displays animal list, day list with validation status, and day creation controls.
 *
 * Features:
 * - List animals with day counts
 * - Select animal to view/manage days
 * - Add recording days with default values
 * - Display validation status chips
 * - Navigate to day editor
 * - Batch create days (stub for future milestone)
 *
 * @see docs/ANIMAL_WORKSPACE_DESIGN.md for UI mockups
 * @see docs/animal_hierarchy.md for data model
 */

import React, { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import { useStoreContext } from '../../state/StoreContext';
import './AnimalWorkspace.css';

/**
 * AnimalWorkspace Component
 *
 * Main workspace view for managing animals and their recording days.
 * Supports URL parameter ?animal=<id> to auto-select an animal on load.
 */
export function AnimalWorkspace() {
  const { model, actions, selectors } = useStoreContext();
  const [selectedAnimalId, setSelectedAnimalId] = useState(null);

  const { animals, days } = model.workspace;
  const animalIds = Object.keys(animals);
  const hasAnimals = animalIds.length > 0;

  const selectedAnimal = selectedAnimalId ? animals[selectedAnimalId] : null;

  // Read ?animal=<id> URL parameter on mount to auto-select animal
  useEffect(() => {
    const params = new URLSearchParams(window.location.hash.split('?')[1]);
    const animalParam = params.get('animal');

    if (animalParam && animals[animalParam]) {
      setSelectedAnimalId(animalParam);
    }
  }, []); // Run only on mount

  /**
   * Handle animal selection
   * @param {string} animalId - Animal identifier to select
   */
  function handleSelectAnimal(animalId) {
    setSelectedAnimalId(animalId);
  }

  /**
   * Handle adding a new recording day
   */
  function handleAddDay() {
    if (!selectedAnimalId) return;

    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    const sessionId = `${selectedAnimalId}_${today.replace(/-/g, '')}`;

    try {
      actions.createDay(selectedAnimalId, today, {
        session_id: sessionId,
        session_description: `Recording session for ${selectedAnimalId} on ${today}`,
      });
    } catch (error) {
      alert(`Failed to create day: ${error.message}`);
      console.error('Error creating day:', error);
    }
  }

  /**
   * Handle batch create days (stub for future milestone)
   */
  function handleBatchCreateDays() {
    alert('Batch create days: Coming soon in future milestone!');
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
          <aside className="animal-list" role="navigation" aria-label="Animal list">
            <h2>Animals</h2>
            {animalIds.map((animalId) => {
              const animal = animals[animalId];
              const dayCount = animal.days?.length || 0;
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
          </aside>

          {/* Day List Main Area */}
          <section className="day-management" aria-labelledby="day-list-heading">
            {!selectedAnimal ? (
              /* Prompt to select animal */
              <div className="empty-state">
                <p>Select an animal to view and manage recording days.</p>
              </div>
            ) : (
              /* Selected Animal: Day List */
              <div>
                <header className="day-list-header">
                  <h2 id="day-list-heading">
                    Recording Days for {selectedAnimal.id}
                  </h2>
                  <div className="day-actions">
                    <button
                      className="btn-primary"
                      onClick={handleAddDay}
                      aria-label="Add recording day"
                    >
                      Add Recording Day
                    </button>
                    <button
                      className="btn-secondary"
                      onClick={handleBatchCreateDays}
                      aria-label="Batch create days"
                    >
                      Batch Create Days
                    </button>
                  </div>
                </header>

                {selectedAnimal.days.length === 0 ? (
                  /* Empty State: No Days */
                  <div className="empty-state">
                    <p>No recording days yet.</p>
                    <p>Add your first recording day to get started.</p>
                  </div>
                ) : (
                  /* Day List */
                  <ul className="day-list" role="list">
                    {selectedAnimal.days.map((dayId) => {
                      const day = days[dayId];
                      if (!day) return null;

                      const { date, session, state } = day;

                      return (
                        <li key={dayId} className="day-item">
                          <a href={`#/day/${dayId}`} className="day-link">
                            <div className="day-info">
                              <span className="day-date">{date}</span>
                              <span className="day-session-id">{session.session_id}</span>
                            </div>
                            <div className="day-status">
                              {state.draft && <span className="status-chip draft">Draft</span>}
                              {state.validated && <span className="status-chip validated">Validated</span>}
                              {state.exported && <span className="status-chip exported">Exported</span>}
                            </div>
                          </a>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            )}
          </section>
        </div>
      )}
    </main>
  );
}

AnimalWorkspace.propTypes = {};

export default AnimalWorkspace;
