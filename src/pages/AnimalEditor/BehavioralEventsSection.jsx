import { useState } from 'react';
import PropTypes from 'prop-types';
import './BehavioralEventsSection.scss';

/**
 * BehavioralEventsSection - Behavioral events (DIO channels) configuration section for Animal Editor (M8a Task 4)
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
export default function BehavioralEventsSection({ animal, onFieldUpdate }) {
  const events = animal.behavioral_events || [];
  const [editingIndex, setEditingIndex] = useState(null);
  const [editingEvent, setEditingEvent] = useState(null);
  const [validationError, setValidationError] = useState(null);
  const [validationWarning, setValidationWarning] = useState(null);

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
    const event = events[index];
    const confirmed = window.confirm(
      `Delete behavioral event "${event.name}"?\n\nThis will remove the event from this animal's configuration.`
    );

    if (confirmed) {
      const updatedEvents = events.filter((_, i) => i !== index);
      onFieldUpdate('behavioral_events', updatedEvents);
    }
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
          Define event names and descriptions. These will be inherited by all recording days for this animal.
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
        <h2>Behavioral Events</h2>
        <p>Define DIO events for experimental triggers and synchronization.</p>
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
              return (
                <tr key={index} className="editing-row">
                  <td data-label="Name">
                    <input
                      type="text"
                      className={validationError ? 'error' : validationWarning ? 'warning' : ''}
                      value={editingEvent?.name || ''}
                      onChange={(e) => handleFieldChange('name', e.target.value)}
                      onKeyDown={handleKeyDown}
                      placeholder="event_name"
                      autoFocus
                      aria-invalid={!!validationError}
                      aria-describedby={validationError ? 'name-error' : undefined}
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
                    <input
                      type="text"
                      value={editingEvent?.description || ''}
                      onChange={(e) => handleFieldChange('description', e.target.value)}
                      onKeyDown={handleKeyDown}
                      placeholder="Description of this event"
                    />
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
