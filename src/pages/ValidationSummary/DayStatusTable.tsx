import type { Animal, Day } from '../../state/workspaceTypes';
import type { WorkflowCommand } from '../../viewModels/types';
import type { DayStatusRowViewModel } from '../../viewModels/validationSummaryViewModel';
import EffectiveDayReview from './EffectiveDayReview';
import styles from './ValidationSummary.module.css';

const noop = () => {};

interface DayStatusTableProps {
  /** The table-ordered day rows from `buildValidationSummaryViewModel`. */
  rows: DayStatusRowViewModel[];
  /** Per-animal mode: the scan cell becomes an effective-setup expander. */
  scoped: boolean;
  /**
   * Raw `{ animal, day }` records keyed by day id, consumed ONLY to mount the scoped
   * `EffectiveDayReview` (which does its own merge from the records). The view-model carries every
   * other rendered value; this is the narrow escape hatch for that one read-only detail panel.
   */
  effectiveRecords?: Record<string, { animal: Animal; day: Day }>;
  /**
   * Dispatch a row's recovery repair (remove dangling ref / unlink wrong-owner / re-link recovered).
   * The command is the VM's own `row.recoveryDetail.repair.command` — the page resolves it through
   * the command layer, so this table never reconstructs the intent/target.
   */
  onRepairCommand?: (command: WorkflowCommand) => void;
}

/**
 * The cross-day status table: one row per recording day across the workspace (or, when `scoped`,
 * one animal's days), with the per-day scan summary, the lifecycle status chip, and the editor /
 * repair cell. Renders straight from the {@link DayStatusRowViewModel} the page's view-model builds —
 * the row status, label, recovery classification, owner description, scan cells, and repair targets
 * are all decided in `buildValidationSummaryViewModel`, never re-derived here.
 *
 * The three repair callbacks are BRANCH-SPECIFIC: each is invoked only when a row of the matching
 * recovery status is present (missing-record / wrong-owner / recovered-unlinked), so they are
 * optional. The standalone page wires all three from the store (their actions are part of the
 * pinned public API, so they are always present in production); a focused test that renders only
 * one row type may pass only the callback it exercises, and the unused ones default to a no-op.
 */
export default function DayStatusTable({
  rows,
  scoped,
  effectiveRecords = {},
  onRepairCommand = noop,
}: DayStatusTableProps) {
  // Dispatch a row's VM-carried recovery repair command (no-op if the row has none).
  const repair = (row: DayStatusRowViewModel) => {
    const command = row.recoveryDetail?.repair?.command;
    if (command) onRepairCommand(command);
  };
  return (
    // The table can be wider than a phone viewport (6 columns of dense scan/session text), so
    // it scrolls horizontally WITHIN this container instead of forcing the whole page to
    // overflow — the page stays at the viewport width at ~390px and no cell is clipped off.
    <div className={styles.tableScroll} data-testid="validation-table-scroll">
      <table className={styles.table}>
        <caption className="visually-hidden">
          Recording days across all animals with validation status
        </caption>
        <thead>
          <tr>
            <th scope="col">Animal</th>
            <th scope="col">Date</th>
            <th scope="col">Session</th>
            <th scope="col">Setup</th>
            <th scope="col">Status</th>
            <th scope="col">Editor</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => {
            // The legacy row flags the cells branch on, recovered from the row's recovery
            // classification (the source of those flags). `unreadable` is folded into the chip's
            // `statusTitle`, so it isn't needed as a separate flag here.
            const missingRecord = row.recovery === 'dangling_reference';
            const ownerMissing = row.recovery === 'orphan_no_owner';
            const orphaned = row.recovery === 'recovered_unlinked' || ownerMissing;
            const wrongOwner = row.recovery === 'wrong_owner';
            const owner = row.recoveryDetail?.ownerDescription;
            const dateText = row.date || row.dayId;

            const hasScan = row.configVersionLabel != null;
            const scanSummary = hasScan ? (
              <>
                {row.configVersionLabel}
                {' · '}
                {row.cameras} {row.cameras === 1 ? 'camera' : 'cameras'}
                {row.cameraCalibration && (
                  <span className={styles.scanCameras}>
                    {' ('}
                    {row.cameraCalibration}
                    {')'}
                  </span>
                )}
                {' · '}
                {row.opto}
              </>
            ) : null;
            const records = effectiveRecords[row.dayId];

            return (
              // Key carries the map index so a corrupt duplicate-index workspace (the same day id
              // listed by two animals in unscoped mode) can't collide React keys.
              <tr key={`${row.dayId}-${index}`} data-testid={`day-row-${row.dayId}`}>
                <td>
                  {row.subjectLabel}
                  {orphaned && (
                    <span
                      className={styles.orphanNote}
                      title="This day record is not listed in its animal's recording-day index (the index is corrupt, missing, or doesn't reference it). It is shown here so it isn't lost; open it to review or re-link it."
                    >
                      {' '}⚠ not in day list
                    </span>
                  )}
                  {wrongOwner && (
                    <span
                      className={styles.orphanNote}
                      title={`This day is listed under ${row.subjectLabel} but its record belongs to ${owner}. It is NOT exported with this animal's metadata; remove it from this animal so it returns to its real owner.`}
                    >
                      {' '}⚠ belongs to {owner}
                    </span>
                  )}
                </td>
                <td>{row.date || '—'}</td>
                <td>
                  {row.sessionId || '—'}
                  {row.sessionDescription && (
                    <span
                      className={styles.sessionDescription}
                      data-testid={`session-description-${row.dayId}`}
                    >
                      {row.sessionDescription}
                    </span>
                  )}
                </td>
                <td>
                  {/* Scan fields: pinned configuration version, camera count + calibration, and the
                      day-protocol opto state — so days can be compared at a glance. Absent for
                      unreadable/missing/wrong-owner rows (no trustworthy merge), shown as "—". In the
                      SCOPED per-animal tab, the cell becomes an expander whose summary reads the same
                      unified config-version label and whose body is the read-only effective-setup-for-
                      this-day review. */}
                  {hasScan ? (
                    scoped ? (
                      <details className={styles.effective} data-testid={`effective-${row.dayId}`}>
                        <summary className={styles.scan}>{scanSummary}</summary>
                        {records && <EffectiveDayReview animal={records.animal} day={records.day} />}
                      </details>
                    ) : (
                      <span className={styles.scan}>{scanSummary}</span>
                    )
                  ) : (
                    '—'
                  )}
                </td>
                <td>
                  {/* The per-day chip uses the shared DAY_LIFECYCLE vocabulary: a live-valid day
                      is refined by its persisted state ("Validated"/"Exported") so saved
                      validation is distinct from a merely live-valid "Ready to export". An
                      unreadable day (its config could not be resolved) OR a reference that
                      resolves to no day record is shown as an error chip with an honest label,
                      so it is flagged for repair and counted — never silently dropped or
                      mistaken for a normal validation error. */}
                  <span
                    className={`status-chip status-chip--${row.chipVariant}`}
                    title={row.statusTitle}
                  >
                    {row.statusLabel}
                  </span>
                </td>
                <td>
                  {missingRecord ? (
                    // A missing/non-record day has nothing to open (the Day Editor would
                    // dead-end on "Day not found"). Offer an executable repair that drops
                    // the dangling reference from the owning animal instead.
                    <button
                      type="button"
                      className="validation-summary-repair"
                      onClick={() => repair(row)}
                      aria-label={`Remove dangling day reference ${row.dayId} from ${row.subjectLabel}`}
                    >
                      Remove day reference
                    </button>
                  ) : wrongOwner ? (
                    // Listed under the wrong animal. The repair unlinks it from THIS animal
                    // (keeping the record), so it returns to its real owner to be re-linked.
                    <button
                      type="button"
                      className="validation-summary-repair"
                      onClick={() => repair(row)}
                      aria-label={`Remove ${dateText} from ${row.subjectLabel} (it belongs to ${owner})`}
                    >
                      Remove from this animal
                    </button>
                  ) : orphaned && ownerMissing ? (
                    // The record exists but its owning animal is gone — "Open editor" would
                    // dead-end (the Day Editor needs the animal). There is no in-app relink
                    // target; state the recovery path instead of a dead control.
                    <span className="validation-summary-orphan-detail">
                      No owning animal — re-create the animal or re-import its data.
                    </span>
                  ) : (
                    <>
                      <a
                        href={`#/day/${row.dayId}`}
                        aria-label={`Open editor for ${row.subjectLabel} ${dateText}`}
                      >
                        Open editor
                      </a>
                      {orphaned && (
                        // The record exists and its owner is present — re-link it into the
                        // animal's day index so it rejoins the normal workflow.
                        <button
                          type="button"
                          className="validation-summary-repair"
                          onClick={() => repair(row)}
                          aria-label={`Add ${dateText} back to ${row.subjectLabel}'s day list`}
                        >
                          Add to day list
                        </button>
                      )}
                    </>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
