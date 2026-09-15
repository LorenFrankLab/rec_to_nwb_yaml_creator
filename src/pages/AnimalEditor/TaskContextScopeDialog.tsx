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
   * The changed fields the earlier days CAN keep ("environment", "cameras", or both) — empty when
   * none, which withholds the keep route entirely.
   */
  keepableLabel?: string;
  /**
   * The changed fields those days CANNOT keep, because the task type had no value there and absence
   * cannot be recorded as a day's own value. Empty when none.
   */
  unkeepableLabel?: string;
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
 * The keep/cannot-keep split is PER FIELD. A field the type had no value for cannot be kept (those
 * days were following "no value", and absence cannot be recorded as a day's own value), and the copy
 * says so; when it is the ONLY changed field the keep route is withheld rather than offered and
 * quietly broken. A mixed edit still offers keep — for the field that has something to preserve.
 */
export default function TaskContextScopeDialog({
  isOpen,
  taskName,
  changedLabel,
  affectedDays,
  hasUnresolvableDays = false,
  keepableLabel = '',
  unkeepableLabel = '',
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
  const canKeep = keepableLabel !== '';
  const theseDays = count === 1 ? 'that day' : 'those days';

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
          <Button variant={canKeep ? 'secondary' : 'primary'} onClick={onCorrectEarlierDays}>
            {`Also correct those ${count} ${dayWord}`}
          </Button>
          {canKeep && (
            <Button onClick={onKeepEarlierDays}>Keep earlier days as recorded (recommended)</Button>
          )}
        </div>
      }
    >
      <p id={msgId}>
        {count} recording {dayWord} still {count === 1 ? 'follows' : 'follow'} this task type&apos;s{' '}
        {changedLabel}, so changing it would change what {count === 1 ? 'that day exports' : 'those days export'}.
        {canKeep && (
          <>
            {' '}By default {theseDays} keep the {keepableLabel} they recorded, and the new value
            applies to days created from now on. Correct {theseDays} instead only if the old value was
            wrong for {count === 1 ? 'that session' : 'those sessions'}.
          </>
        )}
        {unkeepableLabel !== '' && (
          <>
            {' '}This task type had no {unkeepableLabel} before, so {theseDays}{' '}
            <strong>cannot keep</strong> {count === 1 ? 'its' : 'their'} {unkeepableLabel} — there is
            no earlier value to record. Continue only if the new {unkeepableLabel} is also true of{' '}
            {count === 1 ? 'that session' : 'those sessions'}; otherwise cancel and give{' '}
            {count === 1 ? 'that day' : 'each day'} its own value in its Epochs tab first.
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
