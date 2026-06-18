import { useState } from 'react';
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
import type { BehavioralEvent } from '../../state/workspaceTypes';
import './BehavioralEventsDisplay.scss';

/** Another animal's DIO set, offered to seed a blank first day. */
export interface CopyableDioSource {
  id: string;
  name: string;
  events: BehavioralEvent[];
}

interface BehavioralEventsDisplayProps {
  /** The day's exported events. */
  dayEvents?: BehavioralEvent[];
  /** Called with the next day-events array. */
  onDayEventsChange: (events: BehavioralEvent[]) => void;
  /** Other animals whose DIO set can seed a blank first day. */
  copyableSources?: CopyableDioSource[];
}

/**
 * The standard SpikeGadgets ECU digital configuration this grid authors for is Din1…Din32 (inputs)
 * and Dout1…Dout32 (outputs) — the documented maximum, per Trodes `.trodesconf` configs (the exact
 * lines are configuration-dependent: a no-ECU board has none, and some configs omit a line). Since
 * trodes_to_nwb only consumes the ECU digital stream and which channel carries which event is a
 * per-experiment wiring choice, the editor presents the full standard range and the user names the
 * channels they use. This constant is the single source of truth if the range ever needs to change.
 */
const ECU_DIGITAL_CHANNELS = 32;

const GROUPS: Array<{ type: 'Din' | 'Dout'; heading: string; blurb: string }> = [
  { type: 'Din', heading: 'Inputs (Din)', blurb: 'Sensors the animal triggers — pokes, beam breaks.' },
  {
    type: 'Dout',
    heading: 'Outputs (Dout)',
    blurb: 'Things you drive — lights, pumps, optogenetics.',
  },
];

/**
 * The ordered channel ids for a direction, e.g. ["Din1", … "Din32"].
 */
const channelsFor = (type: string): string[] =>
  Array.from({ length: ECU_DIGITAL_CHANNELS }, (_, i) => `${type}${i + 1}`);

function channelSortKey(description: string): number {
  const match = description.match(/^(Din|Dout)(\d+)$/);
  if (!match) return Number.MAX_SAFE_INTEGER;
  return (match[1] === 'Din' ? 0 : 1000) + Number(match[2]);
}

/**
 * Sanitize a channel id for use in an element id.
 */
const channelId = (description: string): string => String(description).replace(/[^a-zA-Z0-9_-]/g, '-');

/**
 * BehavioralEventsDisplay — the per-day behavioral-events (DIO) editor, presented as the ECU's
 * hardware channel grid.
 *
 * The default editor shows only the named lines this rig uses plus an add-line control. The full
 * Din1–32 / Dout1–32 grid stays available as an advanced view. A named channel is a real event
 * (`day.behavioral_events`); an unnamed channel is unused and is NOT written to the exported YAML.
 * Event names must be unique (a duplicate collides on the Spyglass DIOEvents primary key). A new day
 * carries the previous day's names forward; this editor edits them in place. An imported event whose
 * channel isn't a standard Din/Dout line is preserved in an "Other" group rather than dropped.
 */
export default function BehavioralEventsDisplay({ dayEvents = [], onDayEventsChange, copyableSources = [] }: BehavioralEventsDisplayProps) {
  const [newLineType, setNewLineType] = useState<'Din' | 'Dout'>('Din');
  const [newLineIndex, setNewLineIndex] = useState(1);
  const [newLineName, setNewLineName] = useState('');
  const [advancedOpen, setAdvancedOpen] = useState(false);
  // Tolerate corrupt persisted state: a non-array events list (`{}`) must not crash.
  const dayItems = Array.isArray(dayEvents) ? dayEvents : [];

  // Channel → event lookup so each grid row can show its current name (first wins on a corrupt
  // duplicate-description import; the duplicate is surfaced by the banner below).
  const byDescription = new Map<string, BehavioralEvent>();
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
  const namedStandardEvents = dayItems
    .filter(
      (e) =>
        e &&
        typeof e.description === 'string' &&
        gridDescriptions.has(e.description) &&
        typeof e.name === 'string' &&
        e.name.trim() !== ''
    )
    .sort((a, b) => channelSortKey(a.description as string) - channelSortKey(b.description as string));

  /**
   * Set the event name for a channel (blank removes it from the set).
   */
  function nameChannel(description: string, name: string) {
    onDayEventsChange(setChannelName(dayItems, description, name));
  }

  /**
   * Auto-number a PICKED name for a channel: `Poke` → `Poke1`, the next pick `Poke2`, …. The number
   * is the next per-label instance among the OTHER channels' events — never the channel index.
   */
  function selectName(description: string, label: string) {
    const others = dayItems.filter((e) => e?.description !== description);
    nameChannel(description, `${label}${nextInstanceNumber(label, others)}`);
  }

  function addNamedLine() {
    const index = Math.max(1, Math.min(ECU_DIGITAL_CHANNELS, Number(newLineIndex) || 1));
    const name = newLineName.trim();
    if (!name) return;
    nameChannel(`${newLineType}${index}`, name);
    setNewLineName('');
  }

  function selectNewLineName(label: string) {
    const index = Math.max(1, Math.min(ECU_DIGITAL_CHANNELS, Number(newLineIndex) || 1));
    const description = `${newLineType}${index}`;
    const others = dayItems.filter((e) => e?.description !== description);
    setNewLineName(`${label}${nextInstanceNumber(label, others)}`);
  }

  /**
   * Render the editable Event-name cell for one channel. `rawName` is the current event name
   * ('' when unused), coerced if persisted corruption left a non-string here. `direction` is the
   * channel's direction (so the field suggests only inputs on Din / outputs on Dout); omit for "Other".
   */
  function renderNameField(
    description: string,
    rawName: unknown,
    direction?: 'Din' | 'Dout',
    labelPrefix = 'Event for'
  ) {
    const name = typeof rawName === 'string' ? rawName : '';
    const isDuplicate = name.trim() !== '' && duplicateNames.has(name);
    const errorId = `dio-dup-name-${channelId(description)}`;
    return (
      <>
        <SuggestionCombobox
          aria-label={`${labelPrefix} ${description}`}
          value={name}
          onChange={(value) => nameChannel(description, value)}
          onSelect={(label) => selectName(description, label)}
          suggestions={behavioralEventsNames(direction)}
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
   */
  function renderGroup(group: { type: 'Din' | 'Dout'; heading: string; blurb: string }) {
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
                  <td data-label="Event name">
                    {renderNameField(description, rawName, group.type, 'Advanced event for')}
                  </td>
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
          Name only the DIO lines this rig uses on this day. Unnamed ECU channels aren&apos;t written to
          the file. A new day carries the previous day&apos;s names forward, so edit only if you rewired
          the rig.
        </p>
      </header>

      {/* Programmatically-associated legend (referenced by each table's aria-describedby);
          meaning is in text, not a color/emoji alone (WCAG 1.4.1). */}
      <p id="dio-direction-legend" className="dio-direction-legend">
        <strong>Din</strong> = inputs (sensors the animal triggers).{' '}
        <strong>Dout</strong> = outputs (things you drive). Names must be unique.
      </p>

      {/* Empty-day bootstrap: a blank first day can reuse another animal's existing DIO setup
          (same rig, your own data) instead of re-keying it. Only shown while the day is empty. */}
      {dayItems.length === 0 && copyableSources.length > 0 && (
        <div className="dio-copy-cta">
          <p>
            This day has no behavioral events yet. Type the channels your rig uses below, or copy an
            existing setup from another animal:
          </p>
          <div className="dio-copy-cta__actions">
            {copyableSources.map((source) => (
              <button
                key={source.id}
                type="button"
                className="button-secondary"
                onClick={() => onDayEventsChange(structuredClone(source.events))}
              >
                {`Copy from ${source.name} (${source.events.length} ${
                  source.events.length === 1 ? 'event' : 'events'
                })`}
              </button>
            ))}
          </div>
        </div>
      )}

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

      <section className="dio-named-lines" aria-labelledby="dio-named-lines-heading">
        <header className="section-header">
          <h4 id="dio-named-lines-heading">Named DIO lines</h4>
          <p>Edit the lines this rig actually uses. Leave every other ECU channel unnamed.</p>
        </header>

        {namedStandardEvents.length === 0 ? (
          <p className="field-help-text">No named DIO lines yet.</p>
        ) : (
          <table className="dio-wiring-table dio-named-lines-table" aria-label="Named DIO lines">
            <thead>
              <tr>
                <th scope="col">DIO channel</th>
                <th scope="col">Event name</th>
              </tr>
            </thead>
            <tbody>
              {namedStandardEvents.map((event) => {
                const description = event.description as string;
                return (
                  <tr key={description} className="dio-row-named">
                    <td data-label="DIO channel">{description}</td>
                    <td data-label="Event name">
                      {renderNameField(
                        description,
                        event.name,
                        description.startsWith('Din') ? 'Din' : 'Dout'
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}

        <div className="dio-add-line" aria-label="Add DIO line">
          <label>
            Type
            <select value={newLineType} onChange={(e) => setNewLineType(e.target.value as 'Din' | 'Dout')}>
              <option value="Din">Din</option>
              <option value="Dout">Dout</option>
            </select>
          </label>
          <label>
            Index
            <input
              type="number"
              min="1"
              max={ECU_DIGITAL_CHANNELS}
              value={newLineIndex}
              onChange={(e) => setNewLineIndex(Number(e.target.value))}
            />
          </label>
          <label>
            Event name
            <SuggestionCombobox
              aria-label="New DIO event name"
              value={newLineName}
              onChange={setNewLineName}
              onSelect={selectNewLineName}
              suggestions={behavioralEventsNames(newLineType)}
              acceptsValue={isStandardEventName}
              placeholder="e.g. Poke1"
              warnOffList
              offListMessage="Not a standard event name. Pick a suggestion for consistency, or keep a custom name."
            />
          </label>
          <button type="button" className="button-secondary" onClick={addNamedLine} disabled={!newLineName.trim()}>
            Add line
          </button>
        </div>
      </section>

      <details className="dio-advanced-grid" onToggle={(event) => setAdvancedOpen(event.currentTarget.open)}>
        <summary>Advanced: show all ECU lines</summary>
        {/* Inputs and Outputs sit side by side: two columns of 32 channels rather than 64 stacked
            rows. They stack on a narrow viewport (see SCSS). */}
        {advancedOpen && <div className="dio-grid-columns">{GROUPS.map(renderGroup)}</div>}
      </details>

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
