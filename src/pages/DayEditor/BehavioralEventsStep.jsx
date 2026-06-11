import PropTypes from 'prop-types';
import BehavioralEventsDisplay from './BehavioralEventsDisplay';
import MalformedCollectionNotice from './MalformedCollectionNotice';
import { getDayBehavioralEvents } from '../../state/workspaceSelectors';
import { RAW_DAY_ARRAY_FIELDS } from '../../validation/rawShape';

// The day-owned collections whose corrupt-shape reset control belongs on THIS tab (one source of
// truth: the field's repairStep). So the corruption badges the Behavioral Events tab AND can be
// reset here — the badge is never a dead-end on a different tab.
const BEHAVIORAL_STEP_COLLECTIONS = RAW_DAY_ARRAY_FIELDS.filter((f) => f.repairStep === 'behavioral');

/**
 * BehavioralEventsStep — the Day Editor's **Behavioral Events** tab.
 *
 * Behavioral (DIO) events are a substantial, self-contained concern (the ECU hardware channel
 * grid), so they get their own day-editor step rather than being one of several stacked surfaces in
 * Tasks & Epochs. This step is a thin host: it reads the day's events and writes changes back
 * through `onFieldUpdate('behavioral_events', …)`; all editing lives in {@link BehavioralEventsDisplay}.
 *
 * @param {object} props
 * @param {object} props.day - The recording-day record (reads `behavioral_events`).
 * @param {Function} props.onFieldUpdate - Day field updater; called as `('behavioral_events', next)`.
 * @param {Array} [props.copyableDioSources] - Other animals' DIO sets that can seed a blank first
 *   day (computed by the stepper via `getCopyableDioSources`); offered as a bootstrap CTA when empty.
 * @returns {JSX.Element}
 */
export default function BehavioralEventsStep({ day, onFieldUpdate, copyableDioSources }) {
  return (
    <div className="behavioral-events-step">
      <h2>Behavioral Events</h2>
      {/* A corrupt (non-array) behavioral_events badges this tab; its reset control renders here so
          the badge is actionable on the same tab. */}
      <MalformedCollectionNotice
        day={day}
        fields={BEHAVIORAL_STEP_COLLECTIONS}
        onReset={(key) => onFieldUpdate(key, [])}
      />
      <BehavioralEventsDisplay
        dayEvents={getDayBehavioralEvents(day)}
        onDayEventsChange={(events) => onFieldUpdate('behavioral_events', events)}
        copyableSources={copyableDioSources}
      />
    </div>
  );
}

BehavioralEventsStep.propTypes = {
  day: PropTypes.object,
  onFieldUpdate: PropTypes.func.isRequired,
  copyableDioSources: PropTypes.array,
};

BehavioralEventsStep.defaultProps = {
  day: null,
  copyableDioSources: [],
};
