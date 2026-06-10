import { useState } from 'react';
import PropTypes from 'prop-types';
import { ConfirmDialog } from '../../components/Modal';
import { getAnimalBehavioralEvents } from '../../state/workspaceSelectors';
import { behavioralEventsDescription, behavioralEventsNames } from '../../valueList';
import { splitDioDescription, joinDioDescription } from '../../utils/dioDescription';
import SuggestionCombobox from '../../components/SuggestionCombobox';
import InfoIcon from '../../element/InfoIcon';
import './BehavioralEventsSection.scss';

/**
 * BehavioralEventsSection - Behavioral events (DIO channels) configuration section for Animal Editor
 *
 * Provides inline editing interface for behavioral events.
 * Displays event name and description.
 * Validates unique names, valid identifiers, and warns about reserved words.
 *
 * @param {object} props
 * @param {object} props.animal - Animal record with behavioral_events array
 * @param {Function} props.onFieldUpdate - Field update callback
 * @returns {JSX.Element}
 */
/**
 * Build a behavioral-event name from a picked suggestion plus the DIO line index, so several
 * events of the same kind get distinct, downstream-valid names — e.g. picking "Poke" on Din2
 * yields "Poke_2", mirroring the lab convention (Light_1, Light_2) and keeping the Spyglass DIO
 * event name (its primary key) unique. A blank / non-numeric index yields the bare label.
 *
 * @param {string} label - The picked suggestion (e.g. "Poke").
 * @param {number|string} index - The DIO line index (from {@link splitDioDescription}).
 * @returns {string} The constructed event name.
 */
function buildEventName(label, index) {
  return Number.isFinite(index) ? `${label}_${index}` : label;
}

/**
 * If `name` is an auto-built `{knownSuggestion}_{number}` (e.g. "Poke_1"), return it with the
 * numeric suffix retargeted to `newIndex` so the name keeps tracking the DIO line index ("Poke_1"
 * → "Poke_2"). Returns null — leave the name untouched — for a free-typed name (no
 * `{knownSuggestion}_{digits}` shape, e.g. "beam_break", "light1", "reward_left") or when
 * `newIndex` is not a finite number (the index field is mid-edit / blank).
 *
 * @param {string} name - The current event name.
 * @param {number|string} newIndex - The new DIO line index.
 * @returns {string|null} The retargeted name, or null to leave it unchanged.
 */
function followDioIndexInName(name, newIndex) {
  if (!Number.isFinite(newIndex)) return null;
  const match = (name ?? '').match(/^(.+)_\d+$/);
  if (match && behavioralEventsNames().includes(match[1])) {
    return `${match[1]}_${newIndex}`;
  }
  return null;
}

/**
 *
 * @param root0
 * @param root0.animal
 * @param root0.onFieldUpdate
 */
export default function BehavioralEventsSection({ animal, onFieldUpdate }) {
  const events = getAnimalBehavioralEvents(animal);
  const [editingIndex, setEditingIndex] = useState(null);
  const [editingEvent, setEditingEvent] = useState(null);
  const [validationError, setValidationError] = useState(null);
  const [validationWarning, setValidationWarning] = useState(null);
  const [pendingDeleteIndex, setPendingDeleteIndex] = useState(null);

  // Reserved words that should trigger warnings
  const RESERVED_WORDS = ['reward', 'choice', 'start', 'end', 'trigger', 'sync'];

  /**
   * Validate event name
   * @param {string} name - Event name to validate
   * @param {number} currentIndex - Index of event being edited (to exclude from duplicate check)
   * @returns {object} Validation result {error: string|null, warning: string|null}
   */
  function validateEventName(name, currentIndex) {
    const result = { error: null, warning: null };

    // Required field
    if (!name || name.trim() === '') {
      result.error = 'Event name is required';
      return result;
    }

    // Valid identifier pattern (alphanumeric + underscore)
    const identifierPattern = /^[a-zA-Z_][a-zA-Z0-9_]*$/;
    if (!identifierPattern.test(name)) {
      result.error = 'Event name must contain only letters, numbers, and underscores (cannot start with number)';
      return result;
    }

    // Check uniqueness
    const isDuplicate = events.some((event, index) =>
      index !== currentIndex && event.name === name
    );
    if (isDuplicate) {
      result.error = 'Event name must be unique';
      return result;
    }

    // Check reserved words (warning, not error)
    const isReserved = RESERVED_WORDS.some(reserved => name.toLowerCase().includes(reserved));
    if (isReserved) {
      result.warning = 'This name contains a common reserved word. It will work but may conflict with system events.';
    }

    return result;
  }

  /**
   * Handle add button click
   */
  const handleAddClick = () => {
    const newEvent = { name: '', description: '' };
    const updatedEvents = [...events, newEvent];
    onFieldUpdate('behavioral_events', updatedEvents);

    // Enter edit mode for new event
    setEditingIndex(updatedEvents.length - 1);
    setEditingEvent({ ...newEvent });
    setValidationError(null);
    setValidationWarning(null);
  };

  /**
   * Handle edit button click
   * @param {number} index - Index of event to edit
   */
  const handleEditClick = (index) => {
    setEditingIndex(index);
    setEditingEvent({ ...events[index] });
    setValidationError(null);
    setValidationWarning(null);
  };

  /**
   * Handle save button click
   */
  const handleSaveClick = () => {
    if (editingIndex === null || editingEvent === null) return;

    const validation = validateEventName(editingEvent.name, editingIndex);

    if (validation.error) {
      setValidationError(validation.error);
      return;
    }

    // Save changes
    const updatedEvents = [...events];
    updatedEvents[editingIndex] = editingEvent;
    onFieldUpdate('behavioral_events', updatedEvents);

    // Exit edit mode
    setEditingIndex(null);
    setEditingEvent(null);
    setValidationError(null);
    setValidationWarning(null);
  };

  /**
   * Handle cancel button click
   */
  const handleCancelClick = () => {
    setEditingIndex(null);
    setEditingEvent(null);
    setValidationError(null);
    setValidationWarning(null);
  };

  /**
   * Handle delete button click
   * @param {number} index - Index of event to delete
   */
  const handleDeleteClick = (index) => {
    setPendingDeleteIndex(index);
  };

  /**
   * Remove the pending event once the user confirms.
   */
  const confirmDelete = () => {
    const index = pendingDeleteIndex;
    setPendingDeleteIndex(null);
    if (index == null) return;
    const updatedEvents = events.filter((_, i) => i !== index);
    onFieldUpdate('behavioral_events', updatedEvents);
  };

  /**
   * Handle field change in edit mode
   * @param {string} field - Field name ('name' or 'description')
   * @param {string} value - New value
   */
  const handleFieldChange = (field, value) => {
    const updatedEvent = { ...editingEvent, [field]: value };
    setEditingEvent(updatedEvent);

    // Validate if name field
    if (field === 'name') {
      const validation = validateEventName(value, editingIndex);
      setValidationError(validation.error);
      setValidationWarning(validation.warning);
    }
  };

  /**
   * Handle the DIO line-index control changing: update the `description` and, when the name was
   * auto-built from a suggestion (`{known}_{number}`), keep its numeric suffix tracking the index
   * (the index is the DIO channel — its number disambiguates same-kind events). A free-typed name
   * is left untouched. Re-validates the name when it follows.
   *
   * @param {string} rawIndex - The raw value from the line-index input.
   */
  const handleDioIndexChange = (rawIndex) => {
    const dioTypes = behavioralEventsDescription();
    const { type: splitType } = splitDioDescription(editingEvent?.description ?? '');
    const dioType = dioTypes.includes(splitType) ? splitType : dioTypes[0];
    const newDescription = joinDioDescription(dioType, rawIndex);
    const { index: newIndex } = splitDioDescription(newDescription);

    const followedName = followDioIndexInName(editingEvent?.name ?? '', newIndex);
    setEditingEvent({
      ...editingEvent,
      description: newDescription,
      ...(followedName !== null ? { name: followedName } : {}),
    });
    if (followedName !== null) {
      const validation = validateEventName(followedName, editingIndex);
      setValidationError(validation.error);
      setValidationWarning(validation.warning);
    }
  };

  /**
   * Handle keyboard events
   * @param {KeyboardEvent} e
   */
  const handleKeyDown = (e) => {
    if (e.key === 'Escape') {
      handleCancelClick();
    } else if (e.key === 'Enter' && e.target.tagName !== 'TEXTAREA') {
      e.preventDefault();
      if (!validationError) {
        handleSaveClick();
      }
    }
  };

  // Empty state
  if (events.length === 0) {
    return (
      <div className="behavioral-events-section empty-state">
        <div className="empty-state-icon">⚡</div>
        <h3>No Behavioral Events Configured</h3>
        <p>
          Behavioral events are DIO (digital input/output) channels that record experimental events: rewards, choices, triggers, and synchronization signals.
        </p>
        <p className="empty-state-hint">
          This is a reusable <strong>library</strong> for the animal — these events are templates and
          are NOT exported on their own. Every recording day inherits the library; to export an event
          on a day, open that day in the Day Editor, go to its <strong>Tasks &amp; Epochs</strong>{' '}
          step, and choose &ldquo;Use on this day&rdquo; for the event. Only the day&apos;s own events
          are exported.
        </p>
        <button className="button-primary" onClick={handleAddClick}>
          Add First Behavioral Event
        </button>
      </div>
    );
  }

  // Table view
  return (
    <div className="behavioral-events-section">
      <header className="section-header">
        <h2>Behavioral Events / DIO library</h2>
        <p>
          A reusable library of DIO events for this animal. These are templates — they are NOT
          exported until a recording day uses one (in the Day Editor&apos;s Tasks &amp; Epochs step,
          via &ldquo;Use on this day&rdquo;); only that day&apos;s own events are exported.
        </p>
      </header>

      <div className="table-actions">
        <button className="button-primary" onClick={handleAddClick}>
          + Add Behavioral Event
        </button>
      </div>

      <table className="behavioral-events-table" role="table">
        <thead>
          <tr>
            <th>Name</th>
            <th>Description</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {events.map((event, index) => {
            const isEditing = editingIndex === index;

            if (isEditing) {
              // Guided DIO entry: the stored `description` is a hardware DIO line name (e.g.
              // "Din1"). Seed a Type dropdown + a line-index control from it, and write the
              // joined string back on change (recognition over recall; the exported string is
              // unchanged). `splitDioDescription` falls back to the first type when the stored
              // value is unrecognized free text — touching either control then normalizes it.
              const dioTypes = behavioralEventsDescription();
              const { type: splitType, index: dioIndex } = splitDioDescription(
                editingEvent?.description ?? ''
              );
              const dioType = dioTypes.includes(splitType) ? splitType : dioTypes[0];

              return (
                <tr key={index} className="editing-row">
                  <td data-label="Name">
                    {/* Editable combobox: catalog suggestions (legacy `behavioralEventsNames`)
                        that re-open after a pick, with free entry retained. */}
                    <SuggestionCombobox
                      aria-label="Event name"
                      className={validationError ? 'error' : validationWarning ? 'warning' : ''}
                      value={editingEvent?.name || ''}
                      onChange={(v) => handleFieldChange('name', v)}
                      onSelect={(option) =>
                        handleFieldChange('name', buildEventName(option, dioIndex))
                      }
                      suggestions={behavioralEventsNames()}
                      onKeyDown={handleKeyDown}
                      placeholder="event_name"
                      autoFocus
                      aria-invalid={!!validationError}
                      aria-describedby={validationError ? 'name-error' : undefined}
                      warnOffList
                      offListMessage="Not a standard event name. Pick one of the suggestions for consistency, or keep a custom name if you have a reason (e.g. numbered variants like “light1”)."
                    />
                    {validationError && (
                      <div id="name-error" className="inline-error" role="alert">
                        {validationError}
                      </div>
                    )}
                    {validationWarning && !validationError && (
                      <div className="inline-warning" role="status">
                        {validationWarning}
                      </div>
                    )}
                  </td>
                  <td data-label="Description">
                    <div className="dio-description-fields">
                      {/* Short visible labels keep the inline cluster compact; the full
                          accessible name is on each control via aria-label. */}
                      <span className="dio-description-fields__control">
                        <label htmlFor={`dio-type-${index}`}>Type</label>
                        <select
                          id={`dio-type-${index}`}
                          aria-label="DIO type"
                          value={dioType}
                          onChange={(e) =>
                            handleFieldChange(
                              'description',
                              joinDioDescription(e.target.value, dioIndex)
                            )
                          }
                          onKeyDown={handleKeyDown}
                        >
                          {dioTypes.map((typeOption) => (
                            <option key={typeOption} value={typeOption}>
                              {typeOption}
                            </option>
                          ))}
                        </select>
                      </span>
                      <span className="dio-description-fields__control">
                        <label htmlFor={`dio-index-${index}`}>Index</label>
                        <input
                          id={`dio-index-${index}`}
                          aria-label="DIO line index"
                          type="number"
                          min="0"
                          step="1"
                          value={dioIndex}
                          onChange={(e) => handleDioIndexChange(e.target.value)}
                          onKeyDown={handleKeyDown}
                        />
                      </span>
                      <InfoIcon infoText="DIO line name, e.g. Din1" />
                    </div>
                  </td>
                  <td data-label="Actions">
                    <button
                      className="button-small button-primary"
                      onClick={handleSaveClick}
                      disabled={!!validationError}
                    >
                      Save
                    </button>
                    <button
                      className="button-small"
                      onClick={handleCancelClick}
                    >
                      Cancel
                    </button>
                  </td>
                </tr>
              );
            }

            return (
              <tr key={index}>
                <td data-label="Name">{event.name || <em>unnamed</em>}</td>
                <td data-label="Description">{event.description || <em>no description</em>}</td>
                <td data-label="Actions">
                  <button
                    className="button-small"
                    onClick={() => handleEditClick(index)}
                  >
                    Edit
                  </button>
                  <button
                    className="button-small button-danger"
                    onClick={() => handleDeleteClick(index)}
                    aria-label={`Delete ${event.name}`}
                  >
                    Delete
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      <ConfirmDialog
        isOpen={pendingDeleteIndex != null}
        title="Delete behavioral event?"
        message={
          pendingDeleteIndex != null && events[pendingDeleteIndex]
            ? `Delete behavioral event "${events[pendingDeleteIndex].name || '(unnamed event)'}"? This will remove the event from this animal's configuration.`
            : ''
        }
        confirmLabel="Delete"
        destructive
        onConfirm={confirmDelete}
        onCancel={() => setPendingDeleteIndex(null)}
      />
    </div>
  );
}

BehavioralEventsSection.propTypes = {
  animal: PropTypes.shape({
    id: PropTypes.string.isRequired,
    behavioral_events: PropTypes.arrayOf(PropTypes.shape({
      name: PropTypes.string,
      description: PropTypes.string,
    })),
  }).isRequired,
  onFieldUpdate: PropTypes.func.isRequired,
};
