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
 */
export default function TaskContextScopeDialog({
  isOpen,
  taskName,
  changedLabel,
  affectedDays,
  hasUnresolvableDays = false,
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
          <Button variant="secondary" onClick={onCorrectEarlierDays}>
            {`Also correct those ${count} ${dayWord}`}
          </Button>
          <Button onClick={onKeepEarlierDays}>Keep earlier days as recorded (recommended)</Button>
        </div>
      }
    >
      <p id={msgId}>
        {count} recording {dayWord} still {count === 1 ? 'follows' : 'follow'} this task type&apos;s{' '}
        {changedLabel}, so changing it would change what {count === 1 ? 'that day exports' : 'those days export'}.
        By default those {dayWord} keep what they recorded and the new {changedLabel} applies to days
        created from now on. Correct them instead only if the old value was wrong for those sessions.
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
