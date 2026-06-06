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
 * - Navigate to animal editor for device configuration
 * - Batch create days (stub for future milestone)
 *
 * @see docs/ANIMAL_WORKSPACE_DESIGN.md for UI mockups
 * @see docs/animal_hierarchy.md for data model
 */

import React, { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import { useStoreContext } from '../../state/StoreContext';
import { getAnimalDayIds } from '../../state/workspaceSelectors';
import { getAnimalSetupChecklist, SETUP_STATE } from '../../domain/workflowStatus';
import { CalendarDayCreator } from '../../components/CalendarDayCreator/CalendarDayCreator';
import './AnimalWorkspace.css';

/** User-facing label for each setup-checklist item state. */
const SETUP_STATE_LABEL = {
  [SETUP_STATE.NOT_STARTED]: 'Not started',
  [SETUP_STATE.NEEDS_REVIEW]: 'Needs review',
  [SETUP_STATE.HAS_ERRORS]: 'Has errors',
  [SETUP_STATE.COMPLETE]: 'Complete',
};

/**
 * The Animal Editor route an action targets, deep-linked to the owning step via the field
 * hint (`?field=…`, resolved by `animalEditorStepForFieldPath`). Items with no editor target
 * (subject, days) return null and render as a state row without a button.
 *
 * @param {string} animalId
 * @param {{ fieldHint: (string|null) }} action
 * @returns {string|null}
 */
function setupActionHref(animalId, action) {
  if (!action?.fieldHint) return null;
  return `#/animal/${animalId}/editor?field=${action.fieldHint}`;
}

/**
 * AnimalWorkspace Component
 *
 * Main workspace view for managing animals and their recording days.
 * Supports URL parameter ?animal=<id> to auto-select an animal on load.
 */
export function AnimalWorkspace() {
  const { model, actions, selectors } = useStoreContext();
  const [selectedAnimalId, setSelectedAnimalId] = useState(null);
  const [showCalendar, setShowCalendar] = useState(false);

  // Default the required sections so a workspace that somehow reaches here without them
  // renders its empty state instead of crashing on Object.keys(undefined).
  const { animals = {}, days = {} } = model.workspace;
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
   * Handle creating multiple recording days from calendar
   * @param {string[]} dates - Array of ISO date strings (YYYY-MM-DD)
   */
  async function handleCreateDays(dates) {
    if (!selectedAnimalId || !dates || dates.length === 0) return;

    // Snapshot existing ids once, then accumulate locally. The `days` prop is the
    // render-time snapshot and does not reflect ids created earlier in this same
    // batch, so re-reading it per iteration would let a batch collide with its own
    // just-created days (e.g. a duplicate date in the input).
    const existingIds = new Set(Object.keys(days));

    for (const date of dates) {
      const sessionId = `${selectedAnimalId}_${date.replace(/-/g, '')}`;
      const dayId = `${selectedAnimalId}-${date}`;

      // Skip if the day already exists or was already created in this batch.
      if (existingIds.has(dayId)) {
        continue;
      }

      try {
        actions.createDay(selectedAnimalId, date, {
          session_id: sessionId,
          session_description: `Recording session for ${selectedAnimalId} on ${date}`,
        });
        existingIds.add(dayId);
      } catch (error) {
        console.error(`Failed to create day ${date}:`, error);
        throw new Error(`Failed to create day ${date}: ${error.message}`);
      }
    }
  }

  /**
   * Toggle calendar visibility
   */
  function handleToggleCalendar() {
    setShowCalendar(!showCalendar);
  }

  /**
   * Get existing days for selected animal
   * @returns {string[]} Array of ISO date strings
   */
  function getExistingDays() {
    if (!selectedAnimal) return [];
    return selectedAnimal.days.map((dayId) => days[dayId]?.date).filter(Boolean);
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
              const dayCount = getAnimalDayIds(animal).length;
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
              /* Selected Animal: Day List */
              <div>
                <header className="day-list-header">
                  <h2 id="day-list-heading">
                    Recording Days for {selectedAnimal.id}
                  </h2>
                  <div className="day-actions">
                    <a
                      href={`#/animal/${selectedAnimalId}/editor`}
                      className="btn-secondary"
                      aria-label="Edit Devices"
                    >
                      Edit Devices
                    </a>
                    <button
                      className="btn-primary"
                      onClick={handleToggleCalendar}
                      aria-label={showCalendar ? 'Hide calendar' : 'Show calendar'}
                      aria-expanded={showCalendar}
                    >
                      {showCalendar ? 'Hide Calendar' : 'Add Recording Days'}
                    </button>
                  </div>
                </header>

                {/* Setup checklist — shared animal hardware, the operational home for setup.
                    Electrode setup is a first-class action here so it is discoverable without
                    opening the Animal Editor or a recording day. */}
                {(() => {
                  const checklist = getAnimalSetupChecklist(selectedAnimal);
                  const electrodes = checklist.find((i) => i.key === 'electrodes');
                  const needsElectrodeSetup = electrodes?.state === SETUP_STATE.NOT_STARTED;
                  return (
                    <section className="setup-checklist" aria-label="Animal setup">
                      <h3 className="setup-checklist-heading">Animal setup</h3>
                      <p className="setup-checklist-intro">
                        {needsElectrodeSetup
                          ? 'Set up shared hardware before creating or exporting recording days. ' +
                            "Electrodes/probes are configured once for the animal and shared across all of its days."
                          : 'Shared hardware for this animal. Review recovered or imported setup before exporting.'}
                      </p>
                      <ul className="setup-checklist-list" role="list">
                        {checklist.map((item) => {
                          const href = setupActionHref(selectedAnimalId, item.action);
                          const isPrimary =
                            item.key === 'electrodes' && item.state === SETUP_STATE.NOT_STARTED;
                          return (
                            <li key={item.key} className={`setup-item setup-item-${item.state}`}>
                              <span className="setup-item-label">{item.label}</span>
                              <span className={`setup-state-badge setup-state-${item.state}`}>
                                {SETUP_STATE_LABEL[item.state]}
                              </span>
                              <span className="setup-item-summary">{item.summary}</span>
                              {href && (
                                <a
                                  href={href}
                                  className={`setup-item-action ${isPrimary ? 'setup-item-action-primary' : ''}`}
                                >
                                  {item.action.label}
                                </a>
                              )}
                            </li>
                          );
                        })}
                      </ul>
                    </section>
                  );
                })()}

                {/* Calendar for creating multiple days */}
                {showCalendar && (
                  <div className="calendar-container">
                    <CalendarDayCreator
                      animalId={selectedAnimalId}
                      existingDays={getExistingDays()}
                      onCreateDays={handleCreateDays}
                      onClose={() => setShowCalendar(false)}
                    />
                  </div>
                )}

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
