import { useId } from 'react';
import type { ReactNode } from 'react';
import Modal from './Modal';
import './ConfirmDialog.scss';

interface ConfirmDialogProps {
  /** Whether the dialog is shown. */
  isOpen: boolean;
  /** Dialog heading. */
  title: ReactNode;
  /** Body / question. */
  message: ReactNode;
  /** Confirm button text (default 'Confirm'). */
  confirmLabel?: string;
  /** Cancel button text (default 'Cancel'). */
  cancelLabel?: string;
  /** Style the confirm action as destructive. */
  destructive?: boolean;
  /** Called when the user confirms. */
  onConfirm: () => void;
  /** Called for cancel / ESC / overlay close. */
  onCancel: () => void;
}

/**
 * Accessible confirm/cancel dialog built on the shared Modal primitive. Replaces
 * blocking window.confirm() prompts. Cancel, ESC, and overlay click all invoke
 * onCancel; only the Confirm button invokes onConfirm.
 */
const ConfirmDialog = ({
  isOpen,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  destructive = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) => {
  // Unique per instance so multiple dialogs in the tree can't collide on ids.
  const baseId = useId();
  const titleId = `${baseId}-title`;
  const messageId = `${baseId}-message`;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onCancel}
      title={title}
      titleId={titleId}
      // Destructive confirms are consequential: alertdialog asks AT to announce the
      // dialog and its described message immediately. Routine confirms stay 'dialog'.
      role={destructive ? 'alertdialog' : 'dialog'}
      // A destructive choice should be made deliberately — don't let a stray backdrop
      // click silently cancel it (ARIA alertdialog guidance). ESC/Cancel still close.
      closeOnOverlayClick={!destructive}
      describedById={messageId}
      className="confirm-dialog"
    >
      <p id={messageId} className="confirm-dialog-message">
        {message}
      </p>
      <div className="form-actions">
        <button type="button" className="btn-cancel" onClick={onCancel}>
          {cancelLabel}
        </button>
        <button
          type="button"
          className={destructive ? 'btn-danger' : 'btn-save'}
          onClick={onConfirm}
        >
          {confirmLabel}
        </button>
      </div>
    </Modal>
  );
};

export default ConfirmDialog;
