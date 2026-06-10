import { useState } from 'react';
import PropTypes from 'prop-types';
import { duplicateBehavioralEventDescriptions } from '../../validation/behavioralEvents';
import { behavioralEventsDescription, behavioralEventsNames } from '../../valueList';
import { splitDioDescription, joinDioDescription } from '../../utils/dioDescription';
import SuggestionCombobox from '../../components/SuggestionCombobox';
import { ConfirmDialog } from '../../components/Modal';
import InfoIcon from '../../element/InfoIcon';
import './BehavioralEventsDisplay.scss';

// Reserved words that nudge a warning: they work but may collide with system events.
const RESERVED_WORDS = ['reward', 'choice', 'start', 'end', 'trigger', 'sync'];

/**
 * Direction grouping for a day's behavioral (DIO) events. The direction is read from the
 * description's recognized type: Din → an input the animal triggers (poke, beam break); Dout →
 * an output you drive (light, pump, opto). An unrecognized/analog description (e.g. an imported
 * "Accel5") falls into "Other" so it is never dropped.
 */
const GROUPS = [
  {
    key: 'Din',
    seed: 'Din1',
    heading: 'Inputs (Din)',
    blurb: 'Sensors the animal triggers — pokes, beam breaks.',
    addLabel: 'Add input event',
  },
  {
    key: 'Dout',
    seed: 'Dout1',
    heading: 'Outputs (Dout)',
    blurb: 'Things you drive — lights, pumps, optogenetics.',
    addLabel: 'Add output event',
  },
];

/**
 * BehavioralEventsDisplay — the per-day behavioral-events (DIO) editor.
 *
 * The day owns its set of events and they are what export (`day.behavioral_events`); there is no
 * separate animal-level library. The set is presented as a wiring table grouped into Inputs (Din)
 * and Outputs (Dout), reading like the physical rig. Each row maps a hardware DIO channel (the
 * `description`, e.g. "Din1") to a semantic event identity (the `name`, e.g. "Poke1"). A new day
 * carries the previous day's set forward; this editor edits it in place.
 *
 * @param {object} props
 * @param {Array<{name: string, description: string}>} props.dayEvents - The day's exported events.
 * @param {Function} props.onDayEventsChange - Called with the next day-events array.
 * @returns {JSX.Element}
 */
export default function BehavioralEventsDisplay({ dayEvents, onDayEventsChange }) {
  // Tolerate corrupt persisted state: a non-array events list (`{}`) must not crash `.map`.
  const dayItems = Array.isArray(dayEvents) ? dayEvents : [];

  const [editingIndex, setEditingIndex] = useState(null);
  const [editingEvent, setEditingEvent] = useState(null);
  const [validationError, setValidationError] = useState(null);
  const [validationWarning, setValidationWarning] = useState(null);
  const [pendingDeleteIndex, setPendingDeleteIndex] = useState(null);

  // A duplicate DESCRIPTION among the exported day events is a downstream hard `raise ValueError`
  // in trodes_to_nwb — surfaced inline via the SAME helper the export-blocking rule uses, so the
  // inline gate and the export gate can never disagree (raw-string compare, no trim).
  const duplicateDescriptions = [...duplicateBehavioralEventDescriptions(dayItems)];

  /**
   * Validate an event name against the day set (Rule 14: names unique within the day).
   *
   * The only format requirement is the schema's: a non-empty, non-whitespace-only string
   * (`behavioral_events[].name` pattern `^(.|\s)*\S(.|\s)*$`; its own default is the multi-word
   * "Home box camera"). We deliberately do NOT impose a programming-identifier rule — spaces and
   * other characters the schema accepts must not be rejected here, or a suggested name (e.g.
   * "Home box camera", "Run Camera Ticks") would error.
   *
   * @param {string} name - Candidate name.
   * @param {number} currentIndex - Index being edited (excluded from the duplicate check).
   * @returns {{error: string|null, warning: string|null}}
   */
  function validateEventName(name, currentIndex) {
    const result = { error: null, warning: null };
    if (!name || name.trim() === '') {
      result.error = 'Event name is required';
      return result;
    }
    const isDuplicate = dayItems.some(
      (event, index) => index !== currentIndex && event.name === name
    );
    if (isDuplicate) {
      result.error = 'Event name must be unique within this day';
      return result;
    }
    if (RESERVED_WORDS.some((reserved) => name.toLowerCase().includes(reserved))) {
      result.warning =
        'This name contains a common reserved word. It will work but may conflict with system events.';
    }
    return result;
  }

  /**
   * Append a new event seeded to the group's default DIO line and open it for editing.
   * @param {{seed: string}} group - The direction group ({@link GROUPS}).
   */
  function handleAdd(group) {
    const newEvent = { name: '', description: group.seed };
    const next = [...dayItems, newEvent];
    onDayEventsChange(next);
    setEditingIndex(next.length - 1);
    setEditingEvent({ ...newEvent });
    setValidationError(null);
    setValidationWarning(null);
  }

  /**
   * Begin editing the day event at `index`.
   * @param {number} index
   */
  function handleEdit(index) {
    setEditingIndex(index);
    setEditingEvent({ ...dayItems[index] });
    setValidationError(null);
    setValidationWarning(null);
  }

  /**
   * Update a field of the event being edited; revalidate the name.
   * @param {string} field - 'name' or 'description'.
   * @param {string} value
   */
  function handleFieldChange(field, value) {
    const updated = { ...editingEvent, [field]: value };
    setEditingEvent(updated);
    if (field === 'name') {
      const validation = validateEventName(value, editingIndex);
      setValidationError(validation.error);
      setValidationWarning(validation.warning);
    }
  }

  /**
   * Commit the edit.
   */
  function handleSave() {
    if (editingIndex === null || editingEvent === null) return;
    const validation = validateEventName(editingEvent.name, editingIndex);
    if (validation.error) {
      setValidationError(validation.error);
      return;
    }
    const next = [...dayItems];
    next[editingIndex] = editingEvent;
    onDayEventsChange(next);
    setEditingIndex(null);
    setEditingEvent(null);
    setValidationError(null);
    setValidationWarning(null);
  }

  /**
   * Cancel editing (a freshly-added row stays, as in the animal editor).
   */
  function handleCancel() {
    setEditingIndex(null);
    setEditingEvent(null);
    setValidationError(null);
    setValidationWarning(null);
  }

  /**
   * Keyboard: Enter saves (unless invalid), Escape cancels.
   * @param {KeyboardEvent} e
   */
  function handleKeyDown(e) {
    if (e.key === 'Escape') {
      handleCancel();
    } else if (e.key === 'Enter' && e.target.tagName !== 'TEXTAREA') {
      e.preventDefault();
      if (!validationError) handleSave();
    }
  }

  /**
   * Remove the pending day event once confirmed.
   */
  function confirmDelete() {
    const index = pendingDeleteIndex;
    setPendingDeleteIndex(null);
    if (index == null) return;
    onDayEventsChange(dayItems.filter((_, i) => i !== index));
  }

  // Partition the day events into direction groups, preserving each event's flat array index
  // (edit/delete operate on the stored flat array).
  const grouped = { Din: [], Dout: [], Other: [] };
  dayItems.forEach((event, index) => {
    const { type } = splitDioDescription(event.description ?? '');
    if (type === 'Din') grouped.Din.push({ event, index });
    else if (type === 'Dout') grouped.Dout.push({ event, index });
    else grouped.Other.push({ event, index });
  });

  /**
   * Render one day-event row (read-only or, when it is the row being edited, the guided editor).
   * @param {{event: object, index: number}} entry
   * @returns {JSX.Element}
   */
  function renderRow({ event, index }) {
    if (editingIndex === index) {
      const dioTypes = behavioralEventsDescription();
      const { type: splitType, index: dioIndex } = splitDioDescription(
        editingEvent?.description ?? ''
      );
      const dioType = dioTypes.includes(splitType) ? splitType : dioTypes[0];
      const stored = editingEvent?.description ?? '';
      const willRewrite = stored !== '' && joinDioDescription(dioType, dioIndex) !== stored;
      const errId = `dio-day-name-error-${index}`;
      const hintId = `dio-day-name-hint-${index}`;
      // Associate both the "becomes the NWB name" hint and (when present) the error with the
      // Event field; SuggestionCombobox merges these with its own off-list nudge id.
      const describedBy = [hintId, validationError ? errId : null].filter(Boolean).join(' ');

      return (
        <tr key={index} className="editing-row">
          <td data-label="DIO channel">
            <div className="dio-description-fields">
              <span className="dio-description-fields__control">
                <label htmlFor={`dio-day-type-${index}`}>Type</label>
                <select
                  id={`dio-day-type-${index}`}
                  aria-label="DIO type"
                  value={dioType}
                  onChange={(e) =>
                    handleFieldChange('description', joinDioDescription(e.target.value, dioIndex))
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
                <label htmlFor={`dio-day-index-${index}`}>Index</label>
                <input
                  id={`dio-day-index-${index}`}
                  aria-label="DIO line index"
                  type="number"
                  min="0"
                  step="1"
                  value={dioIndex}
                  onChange={(e) =>
                    handleFieldChange('description', joinDioDescription(dioType, e.target.value))
                  }
                  onKeyDown={handleKeyDown}
                />
              </span>
              <InfoIcon infoText="DIO line name, e.g. Din1" />
            </div>
            {willRewrite && (
              <div className="inline-warning" role="status">
                {`This event's description ("${stored}") isn't a standard Din/Dout line; ` +
                  'editing the controls will rewrite it.'}
              </div>
            )}
          </td>
          <td data-label="Event">
            <SuggestionCombobox
              aria-label="Event"
              className={validationError ? 'error' : validationWarning ? 'warning' : ''}
              value={editingEvent?.name || ''}
              onChange={(v) => handleFieldChange('name', v)}
              suggestions={behavioralEventsNames()}
              onKeyDown={handleKeyDown}
              placeholder="event_name"
              autoFocus
              aria-invalid={!!validationError}
              aria-describedby={describedBy}
              warnOffList
              offListMessage="Not a standard event name. Pick a suggestion for consistency, or keep a custom name (e.g. numbered variants like “Poke1”)."
            />
            <p id={hintId} className="dio-day-event-hint">
              becomes the DIO event&apos;s name in the NWB file
            </p>
            {validationError && (
              <div id={errId} className="inline-error" role="alert">
                {validationError}
              </div>
            )}
            {validationWarning && !validationError && (
              <div className="inline-warning" role="status">
                {validationWarning}
              </div>
            )}
          </td>
          <td data-label="Actions">
            <button
              type="button"
              className="button-small button-primary"
              onClick={handleSave}
              disabled={!!validationError}
            >
              Save
            </button>
            <button type="button" className="button-small" onClick={handleCancel}>
              Cancel
            </button>
          </td>
        </tr>
      );
    }

    return (
      <tr key={index}>
        <td data-label="DIO channel">{event.description || <em>no channel</em>}</td>
        <td data-label="Event">{event.name || <em>unnamed</em>}</td>
        <td data-label="Actions">
          <button type="button" className="button-small" onClick={() => handleEdit(index)}>
            Edit
          </button>
          <button
            type="button"
            className="button-small button-danger"
            onClick={() => setPendingDeleteIndex(index)}
            aria-label={`Delete ${event.name || 'behavioral event'}`}
          >
            Delete
          </button>
        </td>
      </tr>
    );
  }

  /**
   * Render one direction group as a section + table (+ add button).
   * @param {object} group - A {@link GROUPS} entry.
   * @returns {JSX.Element}
   */
  function renderGroup(group) {
    const rows = grouped[group.key];
    return (
      <div className="dio-direction-group" key={group.key}>
        <header className="section-header">
          <h4 id={`dio-group-${group.key}`}>{group.heading}</h4>
          <p>{group.blurb}</p>
        </header>
        <div className="table-actions">
          <button
            type="button"
            className="button-primary"
            onClick={() => handleAdd(group)}
            aria-label={group.addLabel}
          >
            + Add event
          </button>
        </div>
        <table
          className="dio-wiring-table"
          role="table"
          aria-label={group.heading}
          aria-describedby="dio-direction-legend"
        >
          <thead>
            <tr>
              <th>DIO channel</th>
              <th>Event</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={3} className="dio-wiring-empty-row">
                  <em>No {group.key === 'Din' ? 'input' : 'output'} events yet.</em>
                </td>
              </tr>
            ) : (
              rows.map(renderRow)
            )}
          </tbody>
        </table>
      </div>
    );
  }

  return (
    <div className="behavioral-events-display">
      <header className="section-header">
        <h3>Behavioral events — how your hardware maps to the SpikeGadgets ECU</h3>
        <p>
          Each row maps a hardware DIO channel to the event it records. A new day carries forward
          the previous day&apos;s set — edit only if you rewired the rig.
        </p>
      </header>

      {/* Programmatically-associated legend (referenced by each table's aria-describedby);
          meaning is in text, not a color/emoji alone (WCAG 1.4.1). */}
      <p id="dio-direction-legend" className="dio-direction-legend">
        <strong>Din</strong> = inputs (sensors the animal triggers).{' '}
        <strong>Dout</strong> = outputs (things you drive).
      </p>

      {dayItems.length === 0 && (
        <p className="dio-wiring-empty">
          No behavioral events on this day yet. Add the inputs (sensors) and outputs
          (lights, pumps) your rig uses.
        </p>
      )}

      {duplicateDescriptions.length > 0 && (
        <div className="inline-error" role="alert">
          {duplicateDescriptions
            .map(
              (desc) =>
                `The description "${desc}" is used by more than one day event. trodes_to_nwb ` +
                `requires a unique description per event — rename one before export.`
            )
            .join(' ')}
        </div>
      )}

      {GROUPS.map(renderGroup)}

      {grouped.Other.length > 0 && (
        <div className="dio-direction-group">
          <header className="section-header">
            <h4>Other</h4>
            <p>
              Events whose channel isn&apos;t a standard Din/Dout line (e.g. an imported analog
              description). Re-point them to a Din/Dout line.
            </p>
          </header>
          <table
            className="dio-wiring-table"
            role="table"
            aria-label="Other"
            aria-describedby="dio-direction-legend"
          >
            <thead>
              <tr>
                <th>DIO channel</th>
                <th>Event</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>{grouped.Other.map(renderRow)}</tbody>
          </table>
        </div>
      )}

      <ConfirmDialog
        isOpen={pendingDeleteIndex != null}
        title="Delete behavioral event?"
        message={
          pendingDeleteIndex != null && dayItems[pendingDeleteIndex]
            ? `Delete behavioral event "${dayItems[pendingDeleteIndex].name || '(unnamed event)'}"? This removes it from this recording day.`
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

BehavioralEventsDisplay.propTypes = {
  dayEvents: PropTypes.arrayOf(
    PropTypes.shape({ name: PropTypes.string, description: PropTypes.string })
  ),
  onDayEventsChange: PropTypes.func,
};

BehavioralEventsDisplay.defaultProps = {
  dayEvents: [],
  onDayEventsChange: null,
};
