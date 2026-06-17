import type { ComponentProps } from 'react';
import type { DayRowViewModel, WorkflowCommand } from '../../viewModels/types';
import StatusPill from '../../components/ui/StatusPill';
import Button from '../../components/ui/Button';
import EmptyState from '../../components/ui/EmptyState';
import OverflowMenu from '../../components/OverflowMenu';
import styles from './AnimalWorkspace.module.css';

interface DayListProps {
  /** The per-day rows from `buildAnimalWorkspaceViewModel` (status, label, recovery, repair). */
  rows: DayRowViewModel[];
  /** Whether the day-index reference is malformed (empty-state copy). */
  daysCorrupt: boolean;
  /** The owning animal (for the dangling-row export link). */
  animalId: string;
  /** Which OK rows are currently selected (for the checkbox column + bulk bar). */
  selectedDayIds: Set<string>;
  /** Whether the select-all box is checked (every selectable OK row is selected). */
  allSelected: boolean;
  /** Toggle every selectable OK row on/off. */
  onToggleAll: (checked: boolean) => void;
  /** Toggle one OK row's selection. */
  onToggleDay: (dayId: string, checked: boolean) => void;
  /** Dispatch a row's recovery repair (the VM's `recoveryDetail.repair.command`, e.g. unlink). */
  onRepairCommand: (command: WorkflowCommand) => void;
  /** Navigate to a day (the ⋯ menu's "Open" — the date/chevron are real links besides). */
  onOpenDay: (dayId: string) => void;
  /** Open the duplicate picker for a row's `duplicateDay` command (the parent confirms, then runs it). */
  onDuplicateDay: (command: WorkflowCommand) => void;
  /** Export exactly this day (the shared single-day export path). */
  onExportDay: (dayId: string) => void;
  /** Delete this day (undo-able — the parent shows the UndoToast; no hard confirm). */
  onDeleteDay: (dayId: string) => void;
  /** Open the add-recording-days affordance from the zero-state CTA (omitted → no CTA shown). */
  onAddDay?: () => void;
}

/** The command carried by the row action with the given id (delete / duplicate). */
const rowCommand = (row: DayRowViewModel, id: string): WorkflowCommand | undefined =>
  row.actions.find((action) => action.command?.id === id)?.command;

/** StatusPill's variant union, derived without exporting it (chipVariant is a DAY_LIFECYCLE value here). */
type PillVariant = ComponentProps<typeof StatusPill>['variant'];

/**
 * The per-animal recording-day table: the empty state, and one row per classified day (ok /
 * dangling_reference / recovered_unlinked / wrong_owner). OK rows carry a selection checkbox + a ⋯
 * overflow menu (Open / Duplicate day / Export this day / Delete day); the date and a trailing chevron
 * are real links (the accessible-row contract — no clickable `<tr>`). Renders straight from the
 * view-model's `dayRows` — the status, label, recovery classification, owner description, and the
 * orphan "Re-link to export" override are all decided in `buildAnimalWorkspaceViewModel`.
 */
export default function DayList({
  rows,
  daysCorrupt,
  animalId,
  selectedDayIds,
  allSelected,
  onToggleAll,
  onToggleDay,
  onRepairCommand,
  onOpenDay,
  onDuplicateDay,
  onExportDay,
  onDeleteDay,
  onAddDay,
}: DayListProps) {
  if (rows.length === 0) {
    return daysCorrupt ? (
      /* Corrupt index AND no recoverable records — see the review state above. This is an ERROR
         state (not onboarding), so it stays a plain notice that points at the review above. */
      <div className="empty-state">
        <p>This animal&apos;s recording-day list is corrupt and can&apos;t be shown.</p>
        <p>See &quot;Review existing data&quot; above to resolve it.</p>
      </div>
    ) : (
      /* Zero-days onboarding: the shared EmptyState with the "add recording day(s)" CTA. */
      <EmptyState
        icon="📅"
        title="No recording days yet"
        actions={
          onAddDay && (
            <Button variant="primary" onClick={onAddDay}>
              ＋ Add recording day(s)
            </Button>
          )
        }
      >
        Add the first recording day to log what the animal did and where the files are — the next
        day will pre-fill from it, so you only edit what changed.
      </EmptyState>
    );
  }

  // Whether ANY row is a selectable OK row — the select-all box is meaningless (and disabled) otherwise.
  const hasSelectable = rows.some((row) => row.recovery === 'ok');

  return (
    // Narrow-viewport strategy (shared with the Animals-home table): the table scrolls horizontally
    // inside this wrapper rather than overflowing the page on small / split-screen widths.
    <div className={styles.tableScroll}>
    <table className={styles.dayTable}>
      <thead>
        <tr>
          <th className={styles.cbxCell} scope="col">
            <input
              type="checkbox"
              aria-label="Select all recording days"
              checked={allSelected}
              disabled={!hasSelectable}
              onChange={(e) => onToggleAll(e.target.checked)}
            />
          </th>
          <th scope="col">Date</th>
          <th scope="col">Status</th>
          {/* Width carried on the header cell: `table-layout: fixed` reads column widths from the
              first row, so the narrow actions column must be sized here (Date/Status split the rest). */}
          <th className={styles.actionsCell} scope="col">
            <span className="visually-hidden">Actions</span>
          </th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => {
          const dayId = row.dayId;
          const dateText = row.date || dayId;

          // A dangling reference (no record) is surfaced, not dropped. No checkbox, no menu — it
          // offers a review path instead of ordinary day actions.
          if (row.recovery === 'dangling_reference') {
            return (
              <tr key={dayId} data-testid={`day-row-${dayId}`} className={styles.dayRowMissing}>
                <td className={styles.cbxCell} />
                <td className={styles.dateCell}>
                  <span className={styles.dayDate}>{dayId}</span>
                  <span className={styles.daySessionId}>
                    Saved record missing or corrupt —{' '}
                    <a href={`#/animal/${animalId}/export`}>review in this animal&apos;s Validation &amp; Export</a>.
                  </span>
                </td>
                <td className={styles.statusCell}>
                  <span className={styles.errorChip} role="alert">
                    {row.statusLabel}
                  </span>
                </td>
                <td className={styles.actionsCell} />
              </tr>
            );
          }

          // Wrong owner: indexed here but the record belongs to another animal. Surface a warning + an
          // in-place unlink repair instead of ordinary day actions.
          if (row.recovery === 'wrong_owner') {
            const owner = row.recoveryDetail?.ownerDescription;
            const unlinkCommand = row.recoveryDetail?.repair?.command;
            return (
              <tr key={dayId} data-testid={`day-row-${dayId}`} className={styles.dayRowMissing}>
                <td className={styles.cbxCell} />
                <td className={styles.dateCell}>
                  <span className={styles.dayDate}>{dateText}</span>
                  <span className={styles.daySessionId}>{row.statusLabel}</span>
                </td>
                <td className={styles.statusCell}>
                  <span className={styles.errorChip} role="alert">
                    Wrong owner
                  </span>
                </td>
                <td className={styles.actionsCell}>
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={() => unlinkCommand && onRepairCommand(unlinkCommand)}
                    aria-label={`Remove ${dateText} from ${animalId} (belongs to ${owner})`}
                  >
                    Remove from this animal
                  </button>
                </td>
              </tr>
            );
          }

          // Ordinary (OK) or recovered-unlinked row.
          const isOrphan = row.recovery === 'recovered_unlinked';
          const isOk = row.recovery === 'ok';
          const duplicateCommand = rowCommand(row, 'duplicateDay');
          return (
            <tr key={dayId} data-testid={`day-row-${dayId}`} className={isOrphan ? styles.dayRowOrphan : undefined}>
              <td className={styles.cbxCell}>
                {isOk && (
                  <input
                    type="checkbox"
                    aria-label={`Select ${dateText}`}
                    checked={selectedDayIds.has(dayId)}
                    onChange={(e) => onToggleDay(dayId, e.target.checked)}
                  />
                )}
              </td>
              <td className={styles.dateCell}>
                <a href={row.href} className={styles.dayDateLink}>
                  {row.date || dayId}
                </a>
                {isOrphan && <span className={styles.dayOrphanNote}> ⚠ not in day list</span>}
                {row.sessionDescription && (
                  <span
                    className={styles.daySessionDesc}
                    data-testid="day-session-desc"
                    title={row.sessionDescription}
                  >
                    {row.sessionDescription}
                  </span>
                )}
              </td>
              <td className={styles.statusCell}>
                {/* `wrap`: a long "Needs fixing — <reason>" label must wrap inside the fixed-layout
                    status column rather than force the column (and the page) wider than the viewport. */}
                <StatusPill variant={row.chipVariant as PillVariant} label={row.statusLabel} wrap />
              </td>
              <td className={styles.actionsCell}>
                {isOk && (
                  <OverflowMenu
                    label={`Actions for ${dateText}`}
                    items={[
                      { key: 'open', label: 'Open', onSelect: () => onOpenDay(dayId) },
                      {
                        key: 'duplicate',
                        label: 'Duplicate day…',
                        onSelect: () => duplicateCommand && onDuplicateDay(duplicateCommand),
                        disabled: !duplicateCommand,
                      },
                      { key: 'export', label: 'Export this day', onSelect: () => onExportDay(dayId) },
                      { key: 'delete', label: 'Delete day…', onSelect: () => onDeleteDay(dayId) },
                    ]}
                  />
                )}
                <a href={row.href} className={styles.chevLink} aria-label={`Open ${dateText}`}>
                  ›
                </a>
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
    </div>
  );
}
