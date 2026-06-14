import { getDaySession } from '../../state/workspaceSelectors';
import { mergeDayMetadata } from '../../state/workspaceUtils';
import type { Animal, Day } from '../../state/workspaceTypes';
import { getDayRowStatus } from '../../domain/workflowStatus';
import { DAY_LIFECYCLE } from '../../domain/dayLifecycle';
import { humanizeValidationMessage } from '../../domain/humanizeValidationMessage';
import { DAY_STATUS, dayHasArtifacts, describeOwner } from '../../domain/dayRecovery';
import type { DayClassificationRow } from '../../domain/dayRecovery';
import styles from './AnimalWorkspace.module.css';

// The day-row status separator between "Needs fixing" and its reason (em-dash, padded).
const NEEDS_FIXING_SEPARATOR = ' — ';

/**
 * Display-only: humanize the reason half of a "Needs fixing — {reason}" row label. The reason is a
 * raw validation message that can expose a schema key (e.g. `experiment_description cannot be empty`
 * or `must have required property 'task_environment'`); we sentence-case/translate it for users.
 * The "Needs fixing" prefix and the non-needs-fixing labels (Draft/Ready/Exported) pass through
 * unchanged. Pure.
 *
 * @param label - The row status label from getDayRowStatus.
 * @returns The display label.
 */
function humanizeNeedsFixingLabel(label: string): string {
  if (typeof label !== 'string') return label;
  const sepIndex = label.indexOf(NEEDS_FIXING_SEPARATOR);
  if (sepIndex === -1) return label;
  const prefix = label.slice(0, sepIndex + NEEDS_FIXING_SEPARATOR.length);
  const reason = label.slice(sepIndex + NEEDS_FIXING_SEPARATOR.length);
  return `${prefix}${humanizeValidationMessage(reason)}`;
}

interface DayListProps {
  /** The domain day classification ({@link classifyAnimalDays}). */
  classification: DayClassificationRow[];
  /** Whether the day-index reference is malformed (empty-state copy). */
  daysCorrupt: boolean;
  /** The owning animal (for links + the unlink dispatch). */
  animalId: string;
  /** The animal record (per-row merge + status). */
  animal: Animal;
  /** The animal's OK day records, date-sorted (bad-channel context). */
  animalDays: Array<Record<string, unknown>>;
  /** `(animalId, dayId) => void` — unlink a wrong-owner day. */
  onUnlinkDayReference: (animalId: string, dayId: string) => void;
  /** `({ dayId, date }) => void` — open the duplicate picker. */
  onDuplicateDay: (arg: { dayId: string; date?: string }) => void;
  /** `({ dayId, date, sessionId, hasArtifacts }) => void` — open delete. */
  onDeleteDay: (arg: { dayId: string; date?: string; sessionId?: string; hasArtifacts: boolean }) => void;
}

/**
 * The per-animal recording-day list: the empty state, and one row per classified day (ok /
 * dangling_reference / recovered_unlinked / wrong_owner) with its plain-language lifecycle status
 * and the per-row actions. Extracted from `pages/AnimalWorkspace/RecordingDaysTab.jsx` (Phase 9c-2)
 * with no behavior change — it renders the domain classification and dispatches the row actions back
 * to the parent (unlink / duplicate / delete).
 */
export default function DayList({
  classification,
  daysCorrupt,
  animalId,
  animal,
  animalDays,
  onUnlinkDayReference,
  onDuplicateDay,
  onDeleteDay,
}: DayListProps) {
  // Render straight from the domain classification (ok / dangling_reference /
  // recovered_unlinked), so the list shows recovered records (never hidden behind
  // "No recording days yet") and every row's kind is the single domain truth.
  if (classification.length === 0) {
    return daysCorrupt ? (
      /* Corrupt index AND no recoverable records — see the review state above. */
      <div className="empty-state">
        <p>This animal&apos;s recording-day list is corrupt and can&apos;t be shown.</p>
        <p>See &quot;Review existing data&quot; above to resolve it.</p>
      </div>
    ) : (
      /* Empty State: No Days */
      <div className="empty-state">
        <p>No recording days yet.</p>
        <p>Add your first recording day to get started.</p>
      </div>
    );
  }
  return (
    /* Day List. `role="list"` is NOT redundant here: `.day-list` sets `list-style: none`,
       which makes Safari + VoiceOver drop the implicit list role — the explicit role restores
       it. The jsx-a11y rule can't see the CSS, so it's suppressed deliberately. */
    // eslint-disable-next-line jsx-a11y/no-redundant-roles
    <ul className={styles.dayList} role="list">
      {classification.map(({ dayId, record, status }) => {
        // A dangling reference (no record) is surfaced, not dropped — otherwise a
        // recovered day disappears. Consistent with the cross-day Validation summary.
        if (status === DAY_STATUS.DANGLING_REFERENCE) {
          return (
            <li key={dayId} className={styles.dayItem}>
              <div className={`${styles.dayLink} ${styles.dayLinkMissing}`} role="alert">
                <div className={styles.dayInfo}>
                  <span className={styles.dayDate}>{dayId}</span>
                  <span className={styles.daySessionId}>
                    Saved record missing or corrupt —{' '}
                    <a href={`#/animal/${animalId}/export`}>
                      review in this animal&apos;s Validation &amp; Export
                    </a>
                    .
                  </span>
                </div>
                <div className={styles.dayStatus}>
                  <span className="status-chip error">Missing record</span>
                </div>
              </div>
            </li>
          );
        }

        // Wrong owner: indexed here but the record belongs to another animal. Don't
        // render it as an ordinary recording day (that implies it's this animal's and
        // exportable). Surface a warning + an in-place unlink repair.
        if (status === DAY_STATUS.WRONG_OWNER) {
          return (
            <li key={dayId} className={styles.dayItem}>
              <div className={`${styles.dayLink} ${styles.dayLinkMissing}`} role="alert">
                <div className={styles.dayInfo}>
                  <span className={styles.dayDate}>{(record as Record<string, unknown>).date as string || dayId}</span>
                  <span className={styles.daySessionId}>
                    Belongs to {describeOwner((record as Record<string, unknown>).animalId)} — listed here by mistake; not
                    exported with this animal.
                  </span>
                </div>
                <div className={styles.dayStatus}>
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={() => onUnlinkDayReference(animalId, dayId)}
                    aria-label={`Remove ${(record as Record<string, unknown>).date as string || dayId} from ${animalId} (belongs to ${describeOwner((record as Record<string, unknown>).animalId)})`}
                  >
                    Remove from this animal
                  </button>
                </div>
              </div>
            </li>
          );
        }

        const isOrphan = status === DAY_STATUS.RECOVERED_UNLINKED;
        // Non-null in OK / recovered-unlinked rows (the dangling/wrong-owner cases returned above).
        const rec = record as Record<string, unknown>;
        // Guard session: a recovered day can carry a malformed (scalar/array) session,
        // which a raw `.session_description` read would crash on (getDaySession → {}).
        const date = rec.date as string | undefined;
        const session = getDaySession(rec);
        // Decision 12: the row is triage. session description rides under the date ONLY
        // when present (a recognition aid, never a hole when absent), truncated by CSS.
        const sessionDescription =
          typeof session.session_description === 'string'
            ? session.session_description.trim()
            : '';
        // ONE plain-language status, read-only over the SAME export gate the day editor
        // uses (per row), so a day that went stale (validated/exported before a referenced
        // camera broke) reads the honest "Needs fixing", not a stale flag. mergeDayMetadata
        // throws on a corrupt/missing configuration — caught here and surfaced as a
        // needs-fixing row by getDayRowStatus(…, null), never a crash.
        let mergedDay: Record<string, unknown> | null = null;
        try {
          mergedDay = mergeDayMetadata(animal, rec as unknown as Day);
        } catch (err) {
          // eslint-disable-next-line no-console
          console.debug(`[recording-days] could not merge day "${dayId}" for status:`, err);
        }
        const rowStatus = getDayRowStatus(animal, rec, mergedDay, animalDays);
        // A recovered-unlinked day is valid metadata but NOT exportable until it is re-linked
        // (the batch export filters it out), so its row must not claim export-readiness. When
        // the validation lifecycle would read Ready/Validated/Exported, show the actionable
        // linkage blocker instead ("Re-link to export" — complements the date's "not in day
        // list" note); an orphan that Needs fixing / is Draft keeps that status (more urgent,
        // and it doesn't falsely claim exportable). Re-link from this animal's Validation &
        // Export tab (linked in the review section above).
        const claimsExportReady =
          rowStatus.variant === DAY_LIFECYCLE.READY ||
          rowStatus.variant === DAY_LIFECYCLE.VALIDATED ||
          rowStatus.variant === DAY_LIFECYCLE.EXPORTED;
        const displayStatus =
          isOrphan && claimsExportReady
            ? { variant: DAY_LIFECYCLE.DRAFT, label: 'Re-link to export' }
            : rowStatus;
        // The "Needs fixing — {reason}" reason is a raw validation message (a schema key can
        // leak through, e.g. `experiment_description …`). Humanize ONLY for this display label
        // — getDayRowStatus stays pure so its reason can still be parsed elsewhere if needed.
        const rowStatusLabel = humanizeNeedsFixingLabel(displayStatus.label);

        return (
          <li key={dayId} className={`${styles.dayItem} ${isOrphan ? styles.dayItemOrphan : ''}`}>
            <a href={`#/day/${dayId}`} className={styles.dayLink}>
              <div className={styles.dayInfo}>
                <span className={styles.dayDate}>
                  {date}
                  {isOrphan && (
                    <span className={styles.dayOrphanNote}> ⚠ not in day list</span>
                  )}
                </span>
                {sessionDescription && (
                  <span
                    className={styles.daySessionDesc}
                    data-testid="day-session-desc"
                    title={sessionDescription}
                  >
                    {sessionDescription}
                  </span>
                )}
              </div>
              <div className={styles.dayStatus}>
                {/* `day-row-status` (+ dynamic `-${variant}` suffix) is kept GLOBAL in the module so
                    the runtime-built class name resolves; a day-row test also queries it. */}
                <span className={`day-row-status day-row-status-${displayStatus.variant}`}>
                  {rowStatusLabel}
                </span>
              </div>
            </a>
            {/* Lifecycle cleanup (Task 8): a secondary/destructive delete, OUTSIDE
                the navigation link (not nested in the <a>) so it can't be hit while
                opening the day. Only on ordinary (OK) rows — recovered/wrong-owner
                rows have their own repair paths above. */}
            {status === DAY_STATUS.OK && (
              <div className={styles.dayItemActions}>
                <button
                  type="button"
                  className={styles.btnSecondaryText}
                  onClick={() => onDuplicateDay({ dayId, date })}
                  aria-label={`Duplicate recording day ${date || dayId}…`}
                >
                  Duplicate day…
                </button>
                <button
                  type="button"
                  className={styles.btnDangerText}
                  onClick={() =>
                    onDeleteDay({
                      dayId,
                      date,
                      sessionId: session.session_id,
                      hasArtifacts: dayHasArtifacts(rec),
                    })
                  }
                  aria-label={`Delete recording day ${date || dayId}…`}
                >
                  Delete day…
                </button>
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}

