import PropTypes from 'prop-types';
import {
  duplicateBehavioralEventDescriptions,
  duplicateBehavioralEventNames,
} from '../../validation/behavioralEvents';
import { behavioralEventsNames } from '../../valueList';
import {
  nextInstanceNumber,
  isStandardEventName,
  setChannelName,
} from '../../utils/behavioralEventSet';
import SuggestionCombobox from '../../components/SuggestionCombobox';
import './BehavioralEventsDisplay.scss';

/**
 * The SpikeGadgets ECU exposes a fixed digital I/O space: Din1…Din32 (inputs) and Dout1…Dout32
 * (outputs), verified against Trodes `.trodesconf` configs. The board determines the space — a
 * no-ECU board has no Din/Dout — but trodes_to_nwb only consumes the ECU digital stream, so the
 * authoring grid presents the full ECU range. Which channel carries which event is a per-experiment
 * wiring choice, so the editor presents every channel and the user names only the ones they use.
 */
const ECU_DIGITAL_CHANNELS = 32;

const GROUPS = [
  { type: 'Din', heading: 'Inputs (Din)', blurb: 'Sensors the animal triggers — pokes, beam breaks.' },
  {
    type: 'Dout',
    heading: 'Outputs (Dout)',
    blurb: 'Things you drive — lights, pumps, optogenetics.',
  },
];

/**
 * The ordered channel ids for a direction, e.g. ["Din1", … "Din32"].
 * @param type
 */
const channelsFor = (type) =>
  Array.from({ length: ECU_DIGITAL_CHANNELS }, (_, i) => `${type}${i + 1}`);

/**
 * Sanitize a channel id for use in an element id.
 * @param description
 */
const channelId = (description) => String(description).replace(/[^a-zA-Z0-9_-]/g, '-');

/**
 * BehavioralEventsDisplay — the per-day behavioral-events (DIO) editor, presented as the ECU's
 * hardware channel grid.
 *
 * Every digital channel (Din1–32 inputs, Dout1–32 outputs) is a row; the user types the event NAME
 * for the channels their rig uses and leaves the rest blank. A named channel is a real event
 * (`day.behavioral_events`); a blank channel is unused and is NOT written to the exported YAML.
 * Event names must be unique (a duplicate collides on the Spyglass DIOEvents primary key). A new day
 * carries the previous day's names forward; this editor edits them in place. An imported event whose
 * channel isn't a standard Din/Dout line is preserved in an "Other" group rather than dropped.
 *
 * @param {object} props
 * @param {Array<{name: string, description: string}>} props.dayEvents - The day's exported events.
 * @param {Function} props.onDayEventsChange - Called with the next day-events array.
 * @returns {JSX.Element}
 */
export default function BehavioralEventsDisplay({ dayEvents, onDayEventsChange }) {
  // Tolerate corrupt persisted state: a non-array events list (`{}`) must not crash.
  const dayItems = Array.isArray(dayEvents) ? dayEvents : [];

  // Channel → event lookup so each grid row can show its current name (first wins on a corrupt
  // duplicate-description import; the duplicate is surfaced by the banner below).
  const byDescription = new Map();
  dayItems.forEach((event) => {
    if (event && typeof event.description === 'string' && !byDescription.has(event.description)) {
      byDescription.set(event.description, event);
    }
  });

  // A duplicate NAME collides on the Spyglass DIOEvents primary key; a duplicate DESCRIPTION is a
  // trodes_to_nwb ValueError. Both are surfaced inline via the SAME helpers the export rules use, so
  // the inline gate and the export gate can never disagree.
  const duplicateNames = duplicateBehavioralEventNames(dayItems);
  const duplicateDescriptions = [...duplicateBehavioralEventDescriptions(dayItems)];

  // Events whose description is not a standard ECU channel (e.g. an imported analog/prose line, or a
  // channel outside 1–32) — shown in an "Other" group so they are never silently dropped.
  const gridDescriptions = new Set(GROUPS.flatMap((g) => channelsFor(g.type)));
  const otherEvents = dayItems.filter(
    (e) => !(e && typeof e.description === 'string' && gridDescriptions.has(e.description))
  );

  /**
   * Set the event name for a channel (blank removes it from the set).
   * @param {string} description - The channel id (e.g. "Din1").
   * @param {string} name - The event name.
   */
  function nameChannel(description, name) {
    onDayEventsChange(setChannelName(dayItems, description, name));
  }

  /**
   * Auto-number a PICKED name for a channel: `Poke` → `Poke1`, the next pick `Poke2`, …. The number
   * is the next per-label instance among the OTHER channels' events — never the channel index.
   * @param {string} description - The channel being named.
   * @param {string} label - The picked suggestion.
   */
  function selectName(description, label) {
    const others = dayItems.filter((e) => e?.description !== description);
    nameChannel(description, `${label}${nextInstanceNumber(label, others)}`);
  }

  /**
   * Render the editable Event-name cell for one channel.
   * @param {string} description - The channel id.
   * @param {string} name - The current event name ('' when unused).
   * @returns {JSX.Element}
   */
  function renderNameField(description, name) {
    const isDuplicate = name.trim() !== '' && duplicateNames.has(name);
    const errorId = `dio-dup-name-${channelId(description)}`;
    return (
      <>
        <SuggestionCombobox
          aria-label={`Event for ${description}`}
          value={name}
          onChange={(value) => nameChannel(description, value)}
          onSelect={(label) => selectName(description, label)}
          suggestions={behavioralEventsNames()}
          acceptsValue={isStandardEventName}
          placeholder="(unused)"
          className={isDuplicate ? 'error' : ''}
          aria-invalid={isDuplicate || undefined}
          aria-describedby={isDuplicate ? errorId : undefined}
          warnOffList
          offListMessage="Not a standard event name. Pick a suggestion for consistency, or keep a custom name."
        />
        {isDuplicate && (
          <div id={errorId} className="inline-error" role="alert">
            {`The name "${name}" is used by more than one channel — each behavioral event name must `}
            be unique.
          </div>
        )}
      </>
    );
  }

  /**
   * Render one direction's full channel table (all 32 rows).
   * @param {{type: string, heading: string, blurb: string}} group
   * @returns {JSX.Element}
   */
  function renderGroup(group) {
    return (
      <div className="dio-direction-group" key={group.type}>
        <header className="section-header">
          <h4 id={`dio-group-${group.type}`}>{group.heading}</h4>
          <p>{group.blurb}</p>
        </header>
        <table
          className="dio-wiring-table"
          aria-label={group.heading}
          aria-describedby="dio-direction-legend"
        >
          <thead>
            <tr>
              <th scope="col">DIO channel</th>
              <th scope="col">Event name</th>
            </tr>
          </thead>
          <tbody>
            {channelsFor(group.type).map((description) => {
              const name = byDescription.get(description)?.name ?? '';
              return (
                <tr
                  key={description}
                  className={name.trim() !== '' ? 'dio-row-named' : 'dio-row-unused'}
                >
                  <td data-label="DIO channel">{description}</td>
                  <td data-label="Event name">{renderNameField(description, name)}</td>
                </tr>
              );
            })}
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
          Every digital channel on the ECU is listed below. Type the event name for the channels
          your rig uses on this day; leave the rest blank — blank channels aren&apos;t written to the
          file. The name you enter becomes the DIO event&apos;s name in the NWB file. A new day
          carries the previous day&apos;s names forward, so edit only if you rewired the rig.
        </p>
      </header>

      {/* Programmatically-associated legend (referenced by each table's aria-describedby);
          meaning is in text, not a color/emoji alone (WCAG 1.4.1). */}
      <p id="dio-direction-legend" className="dio-direction-legend">
        <strong>Din</strong> = inputs (sensors the animal triggers).{' '}
        <strong>Dout</strong> = outputs (things you drive). Names must be unique.
      </p>

      {duplicateDescriptions.length > 0 && (
        <div className="inline-error" role="alert">
          {duplicateDescriptions
            .map(
              (desc) =>
                `The channel "${desc}" is used by more than one event. trodes_to_nwb requires a ` +
                `unique channel per event — rename one before export.`
            )
            .join(' ')}
        </div>
      )}

      {GROUPS.map(renderGroup)}

      {otherEvents.length > 0 && (
        <div className="dio-direction-group">
          <header className="section-header">
            <h4>Other</h4>
            <p>
              Imported events whose channel isn&apos;t a standard Din/Dout line. Re-point one by
              naming the matching Din/Dout channel above and clearing the name here.
            </p>
          </header>
          <table
            className="dio-wiring-table"
            aria-label="Other"
            aria-describedby="dio-direction-legend"
          >
            <thead>
              <tr>
                <th scope="col">DIO channel</th>
                <th scope="col">Event name</th>
              </tr>
            </thead>
            <tbody>
              {otherEvents.map((event, i) => (
                // A corrupt import can repeat a description, so disambiguate the row key by index.
                <tr key={`${event.description || '(no channel)'}-${i}`}>
                  <td data-label="DIO channel">{event.description || <em>no channel</em>}</td>
                  <td data-label="Event name">
                    {renderNameField(event.description || '', event.name ?? '')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
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
