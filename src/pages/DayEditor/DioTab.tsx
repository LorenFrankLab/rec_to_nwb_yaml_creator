import { useState } from 'react';
import BehavioralEventsDisplay from './BehavioralEventsDisplay';
import type { CopyableDioSource } from './BehavioralEventsDisplay';
import MalformedCollectionNotice from './MalformedCollectionNotice';
import { getDayBehavioralEvents } from '../../state/workspaceSelectors';
import {
  duplicateBehavioralEventNames,
  duplicateBehavioralEventDescriptions,
} from '../../validation/behavioralEvents';
import { RAW_DAY_ARRAY_FIELDS } from '../../validation/rawShape';
import { useDayEditorContext } from './DayEditorContext';
import type { DayEditorBundle } from './DayEditorContext';
import type { BehavioralEvent } from '../../state/workspaceTypes';
import styles from './DioTab.module.css';

interface DioTabProps extends DayEditorBundle {
  /** Other animals' DIO sets that can seed a blank first day; offered as a bootstrap CTA when empty. */
  copyableDioSources?: CopyableDioSource[];
  /**
   * The prior same-block day this day's DIO set carried forward from (the frame passes
   * `vm.chips.carriedFrom`). When present, the read-only summary reads "carried from <date> ·
   * unchanged" — the carry-forward provenance the user confirms at a glance.
   */
  carriedFrom?: string;
}

// The day-owned collections whose corrupt-shape reset control belongs on THIS tab (one source of
// truth: the field's repairStep). So the corruption badges the DIO tab AND can be reset here —
// the badge is never a dead-end on a different tab.
const BEHAVIORAL_STEP_COLLECTIONS = RAW_DAY_ARRAY_FIELDS.filter((f) => f.repairStep === 'behavioral');

/** The two ECU directions shown side by side in the read-only summary. */
const SUMMARY_GROUPS: Array<{ type: 'Din' | 'Dout'; heading: string }> = [
  { type: 'Din', heading: 'Inputs (Din)' },
  { type: 'Dout', heading: 'Outputs (Dout)' },
];

/** Parse a `Din12`/`Dout4` channel description into its direction + index (for grouped, ordered display). */
function parseChannel(description: unknown): { dir: 'Din' | 'Dout' | 'Other'; index: number } {
  if (typeof description === 'string') {
    const match = description.match(/^(Din|Dout)(\d+)$/);
    if (match) return { dir: match[1] as 'Din' | 'Dout', index: Number(match[2]) };
  }
  return { dir: 'Other', index: Number.MAX_SAFE_INTEGER };
}

/**
 * DioTab — the day editor's **DIO** (behavioral-events) tab (folded from the former
 * BehavioralEventsStep).
 *
 * Behavioral (DIO) events carry forward day to day and rarely change, so the tab opens on a
 * read-only **carry-forward summary** (the named Din/Dout channels in two columns, "carried from
 * <date> · unchanged"). Only when the user rewired the rig do they click **Edit · rewired the rig**
 * to reveal the full ECU channel editor ({@link BehavioralEventsDisplay}). An empty day opens
 * straight in the editor so the first naming / copy-from-animal bootstrap is one step away.
 *
 * The name/description collision gate is the SAME `duplicateBehavioralEvent*` helpers the editor and
 * the export rule use, so a blocking duplicate is surfaced on the summary (with a jump to Edit) and
 * inline in the editor — never silently passed.
 */
export default function DioTab(props: DioTabProps) {
  // `day` + `onFieldUpdate` come from DayEditorContext in the Day Editor (an isolated render passes
  // them as props). `copyableDioSources` / `carriedFrom` are section-specific, so they stay props.
  const { day, onFieldUpdate } = useDayEditorContext(props);
  const { copyableDioSources = [], carriedFrom } = props;
  const events = getDayBehavioralEvents(day);
  const named = events.filter((e) => typeof e?.name === 'string' && e.name.trim() !== '');

  // Open on the read-only summary when the day already has named events; an empty day opens in the
  // editor so the bootstrap / first naming is immediate. This is the initial state only — once the
  // user reveals the editor it stays open until they click back.
  const [mode, setMode] = useState<'summary' | 'edit'>(named.length > 0 ? 'summary' : 'edit');

  // The collision gate, reusing the SAME helpers the export rule uses, so a blocking duplicate is
  // visible even in the read-only summary (with a jump to Edit).
  const duplicateNames = duplicateBehavioralEventNames(named);
  const duplicateDescriptions = [...duplicateBehavioralEventDescriptions(named)];
  const hasCollision = duplicateNames.size > 0 || duplicateDescriptions.length > 0;

  return (
    <div className="behavioral-events-step">
      <div className={styles.header}>
        <h2>Behavioral events</h2>
        {mode === 'summary' ? (
          <button type="button" className="button-secondary" onClick={() => setMode('edit')}>
            Edit · rewired the rig
          </button>
        ) : (
          named.length > 0 && (
            <button type="button" className="button-secondary" onClick={() => setMode('summary')}>
              ← Back to summary
            </button>
          )
        )}
      </div>

      {/* A corrupt (non-array) behavioral_events badges this tab; its reset control renders here so
          the badge is actionable on the same tab — in either mode. */}
      <MalformedCollectionNotice
        // A clean `Day` is a valid possibly-corrupt-record input to this tolerant reader (it
        // detects non-array collections); the interface lacks an index signature, hence the cast.
        day={day as unknown as Record<string, unknown>}
        fields={BEHAVIORAL_STEP_COLLECTIONS}
        onReset={(key) => onFieldUpdate(key, [])}
      />

      {mode === 'summary' ? (
        <DioSummary
          named={named}
          carriedFrom={carriedFrom}
          hasCollision={hasCollision}
          onEdit={() => setMode('edit')}
        />
      ) : (
        <BehavioralEventsDisplay
          dayEvents={events}
          onDayEventsChange={(next) => onFieldUpdate('behavioral_events', next)}
          copyableSources={copyableDioSources}
        />
      )}
    </div>
  );
}

interface DioSummaryProps {
  /** The named (exported) events. */
  named: BehavioralEvent[];
  /** The prior day this set carried from, when known. */
  carriedFrom?: string;
  /** Whether a blocking name/description collision is present (jump-to-Edit prompt). */
  hasCollision: boolean;
  /** Reveal the editor. */
  onEdit: () => void;
}

/** The read-only carry-forward summary: the named Din/Dout channels in two columns. */
function DioSummary({ named, carriedFrom, hasCollision, onEdit }: DioSummaryProps) {
  const count = named.length;
  return (
    <div>
      <p className={styles.status}>
        <span className={styles.dot} aria-hidden="true" />
        <strong>{count} {count === 1 ? 'event' : 'events'}</strong>
        {carriedFrom ? <span className={styles.meta}> · carried from {carriedFrom} · unchanged</span> : null}
      </p>

      {hasCollision && (
        <div className="inline-error" role="alert">
          Two channels share a name or channel — each behavioral event must be unique.{' '}
          <button type="button" className={styles.inlineEdit} onClick={onEdit}>
            Edit to fix
          </button>
        </div>
      )}

      {count === 0 ? (
        <p className="field-help-text">
          No behavioral events yet. Click <strong>Edit · rewired the rig</strong> to name the
          channels this day&apos;s rig uses.
        </p>
      ) : (
        <div className={styles.columns}>
          {SUMMARY_GROUPS.map((group) => {
            const rows = named
              .filter((e) => parseChannel(e.description).dir === group.type)
              .sort((a, b) => parseChannel(a.description).index - parseChannel(b.description).index);
            return (
              <div className={styles.group} key={group.type}>
                <h3 className={styles.groupHeading}>{group.heading}</h3>
                {rows.length === 0 ? (
                  <p className="field-help-text">None.</p>
                ) : (
                  <ul className={styles.list}>
                    {rows.map((event, i) => (
                      <li className={styles.row} key={`${event.description}-${i}`}>
                        <span className={styles.channel}>{event.description}</span>
                        <span className={styles.name}>{event.name}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
