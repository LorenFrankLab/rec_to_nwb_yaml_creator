import BehavioralEventsDisplay from './BehavioralEventsDisplay';
import type { CopyableDioSource } from './BehavioralEventsDisplay';
import MalformedCollectionNotice from './MalformedCollectionNotice';
import { getDayBehavioralEvents } from '../../state/workspaceSelectors';
import { RAW_DAY_ARRAY_FIELDS } from '../../validation/rawShape';
import { useDayEditorContext } from './DayEditorContext';
import type { DayEditorBundle } from './DayEditorContext';

interface BehavioralEventsStepProps extends DayEditorBundle {
  /** Other animals' DIO sets that can seed a blank first day; offered as a bootstrap CTA when empty. */
  copyableDioSources?: CopyableDioSource[];
}

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
 */
export default function BehavioralEventsStep(props: BehavioralEventsStepProps) {
  // `day` + `onFieldUpdate` come from DayEditorContext in the Day Editor (an isolated render
  // passes them as props). `copyableDioSources` is section-specific, so it stays a direct prop.
  const { day, onFieldUpdate } = useDayEditorContext(props);
  const { copyableDioSources = [] } = props;
  return (
    <div className="behavioral-events-step">
      <h2>Behavioral Events</h2>
      {/* A corrupt (non-array) behavioral_events badges this tab; its reset control renders here so
          the badge is actionable on the same tab. */}
      <MalformedCollectionNotice
        // A clean `Day` is a valid possibly-corrupt-record input to this tolerant reader (it
        // detects non-array collections); the interface lacks an index signature, hence the cast.
        day={day as unknown as Record<string, unknown>}
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
