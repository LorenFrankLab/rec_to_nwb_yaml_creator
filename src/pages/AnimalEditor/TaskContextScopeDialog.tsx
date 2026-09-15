import { useId } from 'react';
import Modal from '../../components/Modal/Modal';
import Button from '../../components/ui/Button';
import { pluralize } from '../../utils/pluralize';
import styles from './TaskContextScopeDialog.module.css';

interface TaskContextScopeDialogProps {
  /** Whether the dialog is shown. */
  isOpen: boolean;
  /** The task type whose default is changing. */
  taskName: string;
  /** What changed: 'environment', 'cameras', or both. */
  changedLabel: string;
  /** The recording days that currently follow the old default. */
  affectedDays: Array<{ id: string; date?: string }>;
  /** Whether some of the animal's days could not be loaded (their references are uncheckable). */
  hasUnresolvableDays?: boolean;
  /**
   * Whether the earlier days CAN keep what they had. False when the task type had no value for a
   * changed field: those days were following "no value", which cannot be recorded as an override,
   * so the keep route is not offered (only an explicit correction, or cancel).
   */
  canKeepEarlierDays?: boolean;
  /** Keep the earlier days as recorded: pin the old values, then save the new default. */
  onKeepEarlierDays: () => void;
  /** Correct history too: save the new default and let those days follow it. */
  onCorrectEarlierDays: () => void;
  /** Dismiss without changing anything. */
  onCancel: () => void;
}

/**
 * TaskContextScopeDialog — "from now on" vs "that was wrong all along", for a task type's default
 * environment / cameras (F3).
 *
 * A task type's environment and cameras are only the DEFAULT a new recording day starts from; the
 * days that already ran the task recorded what they actually used. So changing the default is a
 * scoped decision that names the affected dates first:
 *  - **Keep earlier days as recorded** (default / recommended): the old values are pinned onto those
 *    days as their own, and the new default applies to days created from now on.
 *  - **Also correct those days**: the earlier days keep following the default, so their exports
 *    change too — the right choice when the old value was simply wrong.
 *
 * When the task type had NO value for a changed field, the keep route is withheld rather than
 * offered and quietly broken: those days were following "no value", and absence cannot be recorded
 * as a day's own value. The dialog says so and leaves only the explicit correction, or cancel.
 */
export default function TaskContextScopeDialog({
  isOpen,
  taskName,
  changedLabel,
  affectedDays,
  hasUnresolvableDays = false,
  canKeepEarlierDays = true,
  onKeepEarlierDays,
  onCorrectEarlierDays,
  onCancel,
}: TaskContextScopeDialogProps) {
  const baseId = useId();
  const titleId = `${baseId}-title`;
  const msgId = `${baseId}-msg`;
  if (!isOpen) return null;

  const count = affectedDays.length;
  const dayWord = pluralize(count, 'day');

  return (
    <Modal
      isOpen={isOpen}
      onClose={onCancel}
      title={`${count} recording ${dayWord} ran "${taskName}" with the current ${changedLabel}`}
      titleId={titleId}
      role="alertdialog"
      closeOnOverlayClick={false}
      describedById={msgId}
      className={styles.dialog}
      footer={
        <div className="form-actions">
          <Button variant="neutral" onClick={onCancel}>
            Cancel
          </Button>
          <Button
            variant={canKeepEarlierDays ? 'secondary' : 'primary'}
            onClick={onCorrectEarlierDays}
          >
            {`Also correct those ${count} ${dayWord}`}
          </Button>
          {canKeepEarlierDays && (
            <Button onClick={onKeepEarlierDays}>Keep earlier days as recorded (recommended)</Button>
          )}
        </div>
      }
    >
      <p id={msgId}>
        {count} recording {dayWord} still {count === 1 ? 'follows' : 'follow'} this task type&apos;s{' '}
        {changedLabel}, so changing it would change what {count === 1 ? 'that day exports' : 'those days export'}.
        {canKeepEarlierDays ? (
          <>
            {' '}By default those {dayWord} keep what they recorded and the new {changedLabel} applies
            to days created from now on. Correct them instead only if the old value was wrong for
            those sessions.
          </>
        ) : (
          <>
            {' '}This task type had no {changedLabel} before, so {count === 1 ? 'that day' : 'those days'}{' '}
            <strong>cannot keep</strong> what {count === 1 ? 'it was' : 'they were'} exporting — there
            is no earlier value to record on {count === 1 ? 'it' : 'them'}. Continue only if the new{' '}
            {changedLabel} is also true of {count === 1 ? 'that session' : 'those sessions'}; otherwise
            cancel and give {count === 1 ? 'that day' : 'each day'} its own value in its Epochs tab
            first.
          </>
        )}
      </p>
      {hasUnresolvableDays && (
        <p className={styles.uncheckable}>
          Plus recording days that couldn&apos;t be loaded and may also run this task.
        </p>
      )}
      <ul className={styles.affected}>
        {affectedDays.map((day) => (
          <li key={day.id}>{day.date || day.id}</li>
        ))}
      </ul>
    </Modal>
  );
}
