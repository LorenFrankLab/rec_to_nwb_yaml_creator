/**
 * Recovery review — the load-time "review recovered data" screen (`#/recovery`).
 *
 * When the workspace loads, some saved records may not fit the current shape: a day index entry with
 * no record (dangling), a real record its animal's index doesn't list (recovered-unlinked), a record
 * indexed under the wrong animal (wrong-owner), or a record whose owning animal is gone (orphan). The
 * app NEVER silently drops them — it preserves each and surfaces it here with a concrete repair.
 *
 * This screen RENDERS the existing classification (via {@link buildRecoveryReviewViewModel}, which
 * filters the shared ValidationSummary view-model) and dispatches the EXISTING repair commands through
 * the command layer — it recomputes nothing. The one destructive repair (removing a dangling
 * reference deletes the unreadable leftover) is gated by a confirm; the constructive moves run
 * directly and announce via a toast, so nothing is ever silent.
 *
 * Reached from the AppLayout load-notice banner.
 */

import { useMemo, useState } from 'react';
import { useStoreContext } from '../../state/StoreContext';
import {
  buildRecoveryReviewViewModel,
  type RecoveryRowViewModel,
} from '../../viewModels/recoveryReviewViewModel';
import { commandHandlers } from '../../viewModels/commands';
import type { CommandActions } from '../../viewModels/commands';
import Button from '../../components/ui/Button';
import ConfirmDialog from '../../components/Modal/ConfirmDialog';
import { useUndoToast } from '../../components/ui/UndoToast';
import styles from './RecoveryReview.module.css';

/**
 * The toast confirmation announced after a repair runs, worded per recovery class. There is no Undo
 * affordance: none of the recovery repairs has a faithful inverse among the existing store actions
 * (re-linking a removed wrong-owner ref, or restoring a deleted dangling leftover, is not a single
 * existing action), so the toast confirms rather than offers a lie of reversibility. The destructive
 * remove is gated by its own confirm beforehand.
 *
 * @param row - The repaired row.
 * @returns The announcement text.
 */
function repairAnnouncement(row: RecoveryRowViewModel): string {
  const when = row.date || row.dayId;
  switch (row.recovery) {
    case 'dangling_reference':
      return `Removed the missing day reference for ${row.subjectLabel}.`;
    case 'recovered_unlinked':
      return `Re-linked ${when} to ${row.subjectLabel}.`;
    case 'wrong_owner':
      return `Removed ${when} from ${row.subjectLabel} — it returns to its real owner.`;
    default:
      return `Resolved ${when}.`;
  }
}

/**
 * RecoveryReview — the recovered-data review page. Reads the workspace + the persistence load notice
 * from the store, renders the auto-recovered FYI and the needs-review records, and routes each repair
 * through the command layer (destructive ones via a confirm).
 */
export function RecoveryReview() {
  const { model, actions, persistence } = useStoreContext();

  const vm = useMemo(
    () => buildRecoveryReviewViewModel(model.workspace, persistence.loadNotice),
    [model.workspace, persistence.loadNotice]
  );

  // Day-reference repairs route through the shared descriptor command layer (one named write surface);
  // the recovery row carries the EXISTING command, so this screen never reconstructs the intent/target.
  const run = useMemo(
    () => commandHandlers({ actions: actions as unknown as CommandActions }),
    [actions]
  );

  // Undo-toast host (mounted once) — used here as a non-reversible confirmation after each repair.
  const toast = useUndoToast();
  // The row whose DESTRUCTIVE repair is awaiting confirmation (null when the confirm is closed).
  const [pendingDestructive, setPendingDestructive] = useState<RecoveryRowViewModel | null>(null);

  /**
   * Dispatch a row's repair command and announce it. The resolved record changes classification on
   * the next render, so it drops out of the needs-review list automatically.
   *
   * @param row - The row to repair (must carry a repair command).
   */
  const dispatchRepair = (row: RecoveryRowViewModel) => {
    if (!row.repair) return;
    run[row.repair.command.id]?.(row.repair.command);
    toast.show(repairAnnouncement(row));
  };

  /**
   * Handle a repair-button click: a destructive repair opens the confirm; a constructive one runs
   * immediately.
   *
   * @param row - The row whose repair was requested.
   */
  const onRepair = (row: RecoveryRowViewModel) => {
    if (row.repair?.destructive) setPendingDestructive(row);
    else dispatchRepair(row);
  };

  /** Run the confirmed destructive repair, then close the confirm. */
  const confirmDestructive = () => {
    if (pendingDestructive) dispatchRepair(pendingDestructive);
    setPendingDestructive(null);
  };

  return (
    <main
      id="main-content"
      tabIndex={-1}
      role="main"
      aria-labelledby="recovery-heading"
      className={styles.screen}
    >
      <p className={styles.crumb}>
        <a href="#/workspace">Animals</a> › Review recovered data
      </p>
      <h1 id="recovery-heading" className={styles.heading}>
        Review recovered data
      </h1>
      <p className={styles.lede}>
        When the workspace loaded, some saved records didn&apos;t fit the current shape.{' '}
        <strong>Nothing was discarded</strong> — resolve each below. Affected items can&apos;t export
        until they&apos;re sorted.
      </p>

      {vm.notice && (
        <div className={styles.noticeCard} role="status">
          <span aria-hidden="true">✓</span>
          <span>{vm.notice}</span>
        </div>
      )}

      {vm.allClear ? (
        <div className={styles.allClear} role="status">
          <p className={styles.allClearTitle}>Nothing to review</p>
          <p className={styles.allClearBody}>
            Every recovered record is in good shape — no day records need attention.
          </p>
          <a className={styles.primaryLink} href="#/workspace">
            Back to animals
          </a>
        </div>
      ) : (
        <>
          <div className={styles.secHead}>
            <h2 className={styles.secTitle}>Needs review</h2>
            <span className={styles.count}>{vm.reviewCount}</span>
          </div>

          <ul className={styles.flagList}>
            {vm.needsReview.map((row, index) => (
              <li key={`${row.dayId}-${index}`} className={styles.flag}>
                <div className={styles.flagBody}>
                  <div className={styles.flagTitle}>{row.title}</div>
                  <div className={styles.flagDetail}>{row.detail}</div>
                </div>
                <div className={styles.flagActions}>
                  {row.repair ? (
                    <Button
                      variant={row.repair.destructive ? 'dangerSubtle' : 'secondary'}
                      size="small"
                      onClick={() => onRepair(row)}
                    >
                      {row.repair.label}
                    </Button>
                  ) : (
                    <span className={styles.noRepair}>{row.message}</span>
                  )}
                </div>
              </li>
            ))}
          </ul>

          <p className={styles.note}>
            The app never silently drops a value it can&apos;t map — it preserves the original and
            surfaces it here. Format-only upgrades (key order, <code>task_epoch</code> →{' '}
            <code>task_epochs</code>) are applied automatically.
          </p>

          <div className={styles.pageActions}>
            <a className={styles.primaryLink} href="#/workspace">
              Done
            </a>
          </div>
        </>
      )}

      <ConfirmDialog
        isOpen={pendingDestructive != null}
        title="Remove this day reference?"
        message={
          pendingDestructive
            ? `${pendingDestructive.title}. This drops the index entry and deletes the unreadable ` +
              `leftover record. It can't be undone.`
            : ''
        }
        confirmLabel="Remove reference"
        destructive
        onConfirm={confirmDestructive}
        onCancel={() => setPendingDestructive(null)}
      />

      {toast.node}
    </main>
  );
}

export default RecoveryReview;
