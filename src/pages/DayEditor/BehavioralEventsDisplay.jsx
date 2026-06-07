import { useState } from 'react';
import PropTypes from 'prop-types';
import './BehavioralEventsDisplay.scss';

/**
 * BehavioralEventsDisplay - shows the animal's inherited behavioral events as a
 * read-only, lock-marked list, and (unless `readOnly`) an optional collapsible
 * section for adding day-specific events.
 *
 * Inherited events are never editable here — they belong to the animal and are
 * edited in the Animal Editor. Day-specific events write through `onDayEventsChange`
 * (wired by the parent to `onFieldUpdate('behavioral_events', …)`). A day-specific
 * event whose name duplicates an inherited event is flagged as a non-blocking
 * warning; it is still saved.
 *
 * @param {object} props
 * @param {Array<{name: string, description: string}>} props.inheritedEvents - Animal events.
 * @param {Array<{name: string, description: string}>} props.dayEvents - Day-specific events.
 * @param {Function} props.onDayEventsChange - Called with the next day-events array.
 * @param {boolean} [props.readOnly] - When true, render only the inherited list.
 * @returns {JSX.Element}
 */
export default function BehavioralEventsDisplay({
  inheritedEvents,
  dayEvents,
  onDayEventsChange,
  readOnly,
}) {
  // Tolerate corrupt persisted state: a non-array events list (`{}`) must not crash
  // `.map`. Surfaced + reset by the step's raw-shape notice; rendered empty here.
  const events = Array.isArray(inheritedEvents) ? inheritedEvents : [];
  const dayItems = Array.isArray(dayEvents) ? dayEvents : [];

  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState({ name: '', description: '' });

  const inheritedNames = new Set(events.map((e) => e.name));
  const duplicateNames = dayItems
    .map((e) => e.name)
    .filter((name) => inheritedNames.has(name));
  // The day events are what export (day.behavioral_events). Day names already used, so a library
  // event isn't offered for "Use on this day" twice.
  const dayNames = new Set(dayItems.map((e) => e.name));
  // A duplicate DESCRIPTION among the exported day events is a downstream hard `raise ValueError`
  // in trodes_to_nwb — surface it inline (the export-blocking rule gates it, but flag it here too).
  const descriptionCounts = dayItems.reduce((acc, e) => {
    const desc = (e.description || '').trim();
    if (desc !== '') acc.set(desc, (acc.get(desc) || 0) + 1);
    return acc;
  }, new Map());
  const duplicateDescriptions = [...descriptionCounts.entries()]
    .filter(([, count]) => count > 1)
    .map(([desc]) => desc);

  /**
   * Copy an inherited (library) event into this day's exported event list.
   * @param {{name: string, description: string}} event
   */
  function handleUseOnThisDay(event) {
    if (!onDayEventsChange) return;
    onDayEventsChange([...dayItems, { name: event.name, description: event.description || '' }]);
  }

  /**
   * Begin adding a day-specific event.
   */
  function startAdd() {
    setDraft({ name: '', description: '' });
    setAdding(true);
  }

  /**
   * Commit the in-progress day-specific event.
   */
  function saveDraft() {
    onDayEventsChange([...dayItems, { name: draft.name.trim(), description: draft.description.trim() }]);
    setAdding(false);
    setDraft({ name: '', description: '' });
  }

  /**
   * Remove a day-specific event by index.
   * @param {number} index Index in the day events array.
   */
  function removeDayEvent(index) {
    onDayEventsChange(dayItems.filter((_, i) => i !== index));
  }

  return (
    <div className="behavioral-events-display">
      <h3 className="behavioral-events-display-heading">Behavioral events (inherited)</h3>
      {events.length === 0 ? (
        <p className="behavioral-events-display-empty">
          No behavioral events are defined for this animal.
        </p>
      ) : (
        <>
          <p className="behavioral-events-display-note">
            These behavioral events are defined on the animal for reference. They are
            not written to this day&apos;s metadata.
            {!readOnly && ' Only the day-specific events below are exported with this recording day.'}
          </p>
          <ul className="inherited-events-list" aria-label="Inherited behavioral events">
            {events.map((event) => (
              <li key={event.name} className="inherited-event">
                <span className="lock-icon" aria-hidden="true">🔒</span>
                <span className="inherited-event-name">{event.name}</span>
                {event.description && (
                  <span className="inherited-event-description">{event.description}</span>
                )}
                <span className="sr-only"> (inherited, read-only)</span>
                {/* Library → exported: copy this reference event into the day's exported list.
                    Hidden once the day already uses it (by name). */}
                {!readOnly && !dayNames.has(event.name) && (
                  <button
                    type="button"
                    className="button-small"
                    onClick={() => handleUseOnThisDay(event)}
                    aria-label={`Use ${event.name} on this day`}
                  >
                    Use on this day
                  </button>
                )}
              </li>
            ))}
          </ul>
        </>
      )}

      {!readOnly && (
        <div className="day-specific-events">
          <h4 className="day-specific-events-heading">Day-specific behavioral events</h4>

          {duplicateNames.length > 0 && (
            <div className="inline-warning" role="status">
              {duplicateNames.map((name) => (
                `"${name}" matches an inherited animal-level event; only this day-specific entry is exported with this day.`
              )).join(' ')}
            </div>
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

          {dayItems.length > 0 && (
            <ul className="day-events-list" aria-label="Day-specific behavioral events">
              {dayItems.map((event, index) => (
                <li key={index} className="day-event">
                  <span className="day-event-name">{event.name || <em>unnamed</em>}</span>
                  {event.description && (
                    <span className="day-event-description">{event.description}</span>
                  )}
                  <button
                    type="button"
                    className="button-small button-danger"
                    onClick={() => removeDayEvent(index)}
                    aria-label={`Remove day-specific event ${event.name}`}
                  >
                    Remove
                  </button>
                </li>
              ))}
            </ul>
          )}

          {adding ? (
            <div className="day-event-editor">
              <label className="day-event-field">
                <span>Event name</span>
                <input
                  type="text"
                  value={draft.name}
                  onChange={(e) => setDraft((prev) => ({ ...prev, name: e.target.value }))}
                  autoFocus
                />
              </label>
              <label className="day-event-field">
                <span>Description</span>
                <input
                  type="text"
                  value={draft.description}
                  onChange={(e) => setDraft((prev) => ({ ...prev, description: e.target.value }))}
                />
              </label>
              <div className="day-event-actions">
                <button
                  type="button"
                  className="button-small button-primary"
                  onClick={saveDraft}
                  disabled={draft.name.trim() === ''}
                >
                  Save
                </button>
                <button
                  type="button"
                  className="button-small"
                  onClick={() => setAdding(false)}
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              className="button-secondary"
              onClick={startAdd}
            >
              + Add day-specific event
            </button>
          )}
        </div>
      )}
    </div>
  );
}

BehavioralEventsDisplay.propTypes = {
  inheritedEvents: PropTypes.arrayOf(
    PropTypes.shape({ name: PropTypes.string, description: PropTypes.string })
  ),
  dayEvents: PropTypes.arrayOf(
    PropTypes.shape({ name: PropTypes.string, description: PropTypes.string })
  ),
  onDayEventsChange: PropTypes.func,
  readOnly: PropTypes.bool,
};

BehavioralEventsDisplay.defaultProps = {
  inheritedEvents: [],
  dayEvents: [],
  onDayEventsChange: null,
  readOnly: false,
};
