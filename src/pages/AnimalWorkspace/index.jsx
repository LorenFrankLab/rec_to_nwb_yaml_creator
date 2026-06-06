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
import { getAnimalDayIds, getConfigHistory } from '../../state/workspaceSelectors';
import { getAnimalSetupChecklist, SETUP_STATE } from '../../domain/workflowStatus';
import { validateDay } from '../../domain/validation';
import { mergeDayMetadata } from '../../state/workspaceUtils';
import { validateRawAnimal } from '../../validation/rawShape';
import { applyRepairCommand } from '../../state/repairCommands';
import RawCorruptionBanner from '../../components/RawCorruptionBanner';
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
 * Collect the error-severity issues that drive the setup checklist's per-item `has_errors`:
 * the animal's raw-shape corruption PLUS the setup validation errors surfaced by validating
 * each of its days (electrode geometry, camera/data-acq identity, etc. only manifest through
 * the merged day). `mergeDayMetadata` throws on a corrupt/missing configuration; that day is
 * skipped (the corruption is already surfaced by the review banner / raw issues).
 *
 * @param {object} animal - The selected animal.
 * @param {object} days - The workspace `days` record.
 * @returns {Array} Error-severity validation issues for the animal's setup.
 */
function collectAnimalSetupIssues(animal, days) {
  const issues = [...validateRawAnimal(animal)];
  for (const dayId of getAnimalDayIds(animal)) {
    const dayRecord = days[dayId];
    if (!dayRecord) continue;
    try {
      const merged = mergeDayMetadata(animal, dayRecord);
      for (const issue of validateDay(dayRecord, merged, animal)) {
        if (issue.severity === 'error') issues.push(issue);
      }
    } catch {
      // Corrupt/missing configuration — surfaced by the review banner; skip aggregation.
    }
  }
  return issues;
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

  /**
   * Execute a raw-shape corruption repair in place (same executor the editor banners use),
   * so recovered/imported corruption can be cleared from the review state without leaving the
   * workspace.
   *
   * @param {object} issue - A raw-shape issue carrying a `repairCommand`.
   */
  function handleRepair(issue) {
    if (!issue?.repairCommand || !selectedAnimalId) return;
    applyRepairCommand(issue.repairCommand, {
      actions,
      animalId: selectedAnimalId,
      animal: selectedAnimal,
    });
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
                  // Raw-shape corruption drives the existing-data review state below; the full
                  // setup-issue set (raw corruption + per-day setup validation errors) drives
                  // the checklist's per-item has_errors so a real setup error (empty location,
                  // divergent camera/data-acq identity, …) badges its owning item, not just
                  // structural corruption.
                  const rawIssues = validateRawAnimal(selectedAnimal);
                  const setupIssues = collectAnimalSetupIssues(selectedAnimal, days);
                  const checklist = getAnimalSetupChecklist(selectedAnimal, { issues: setupIssues });
                  const electrodes = checklist.find((i) => i.key === 'electrodes');
                  const needsElectrodeSetup = electrodes?.state === SETUP_STATE.NOT_STARTED;
                  const dayCount = getAnimalDayIds(selectedAnimal).length;
                  const configCount = getConfigHistory(selectedAnimal).length;
                  // Existing data needs an explicit review state: recovered/imported setup must
                  // not look silently trusted. Show it once there ARE recording days to export,
                  // or whenever raw-shape corruption is present.
                  const showReview = dayCount > 0 || rawIssues.length > 0;
                  return (
                    <>
                      <section className="setup-checklist" aria-label="Animal setup">
                        <h3 className="setup-checklist-heading">Animal setup</h3>
                        <p className="setup-checklist-intro">
                          {needsElectrodeSetup
                            ? 'Set up shared hardware before creating or exporting recording days. ' +
                              "Electrodes/probes are configured once for the animal and shared across all of its days."
                            : 'Shared hardware for this animal. Review recovered or imported setup before exporting.'}
                        </p>
                        <ul className="setup-checklist-list">
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

                      {showReview && (
                        <section
                          className={`existing-data-review ${rawIssues.length > 0 ? 'existing-data-review-corrupt' : ''}`}
                          aria-label="Existing data review"
                        >
                          <h3 className="existing-data-review-heading">Review existing data</h3>
                          <p className="existing-data-review-intro">
                            Found {dayCount} recording {dayCount === 1 ? 'day' : 'days'} and{' '}
                            {configCount} hardware {configCount === 1 ? 'configuration' : 'configurations'} for{' '}
                            {selectedAnimal.id}.{' '}
                            {rawIssues.length > 0
                              ? 'Some saved data is corrupt — repair it below before exporting.'
                              : 'Review electrodes and cameras before exporting to confirm they match this animal.'}
                          </p>
                          {/* Reuse the shipped recovery surface: executable resets for corrupt
                              animal-owned collections. Self-hides when there is no corruption. */}
                          <RawCorruptionBanner
                            animal={selectedAnimal}
                            fields={['cameras', 'data_acq_device', 'configurationHistory']}
                            onRepair={handleRepair}
                          />
                          <a className="existing-data-review-link" href="#/validation">
                            Open validation summary
                          </a>
                        </section>
                      )}
                    </>
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
