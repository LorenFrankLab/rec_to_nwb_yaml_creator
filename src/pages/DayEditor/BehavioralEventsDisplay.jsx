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
 * The standard SpikeGadgets ECU digital configuration this grid authors for is Din1…Din32 (inputs)
 * and Dout1…Dout32 (outputs) — the documented maximum, per Trodes `.trodesconf` configs (the exact
 * lines are configuration-dependent: a no-ECU board has none, and some configs omit a line). Since
 * trodes_to_nwb only consumes the ECU digital stream and which channel carries which event is a
 * per-experiment wiring choice, the editor presents the full standard range and the user names the
 * channels they use. This constant is the single source of truth if the range ever needs to change.
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
 * @param {string} type - The DIO type, `"Din"` or `"Dout"`.
 * @returns {string[]} The channel ids `${type}1`…`${type}${ECU_DIGITAL_CHANNELS}`.
 */
const channelsFor = (type) =>
  Array.from({ length: ECU_DIGITAL_CHANNELS }, (_, i) => `${type}${i + 1}`);

/**
 * Sanitize a channel id for use in an element id.
 * @param {string} description - The channel id (e.g. `"Din1"`).
 * @returns {string} The id with non-`[A-Za-z0-9_-]` characters replaced by `-`.
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
  // trodes_to_nwb ValueError. The inline gates run on exactly what export sees — the NAMED events
  // (a blank channel is excluded from export, see workspaceUtils.js) — via the SAME helpers the
  // export rules use, so the inline banner and the export gate can never disagree.
  const exportedItems = dayItems.filter(
    (event) => typeof event?.name === 'string' && event.name.trim() !== ''
  );
  const duplicateNames = duplicateBehavioralEventNames(exportedItems);
  const duplicateDescriptions = [...duplicateBehavioralEventDescriptions(exportedItems)];

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
   * @param {*} rawName - The current event name ('' when unused); coerced if persisted corruption
   *   left a non-string here, so the editor survives it instead of crashing.
   * @returns {JSX.Element}
   */
  function renderNameField(description, rawName) {
    const name = typeof rawName === 'string' ? rawName : '';
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
              const rawName = byDescription.get(description)?.name;
              const name = typeof rawName === 'string' ? rawName : '';
              return (
                <tr
                  key={description}
                  className={name.trim() !== '' ? 'dio-row-named' : 'dio-row-unused'}
                >
                  <td data-label="DIO channel">{description}</td>
                  <td data-label="Event name">{renderNameField(description, rawName)}</td>
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

      {/* Inputs and Outputs sit side by side: two columns of 32 channels rather than 64 stacked
          rows. They stack on a narrow viewport (see SCSS). */}
      <div className="dio-grid-columns">{GROUPS.map(renderGroup)}</div>

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
