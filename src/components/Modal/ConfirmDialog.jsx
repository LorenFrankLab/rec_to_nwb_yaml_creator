import React, { useId } from 'react';
import PropTypes from 'prop-types';
import Modal from './Modal';
import './ConfirmDialog.scss';

/**
 * Accessible confirm/cancel dialog built on the shared Modal primitive. Replaces
 * blocking window.confirm() prompts. Cancel, ESC, and overlay click all invoke
 * onCancel; only the Confirm button invokes onConfirm.
 *
 * @param {object} props
 * @param {boolean} props.isOpen Whether the dialog is shown.
 * @param {string} props.title Dialog heading.
 * @param {React.ReactNode} props.message Body / question.
 * @param {string} [props.confirmLabel] Confirm button text.
 * @param {string} [props.cancelLabel] Cancel button text.
 * @param {boolean} [props.destructive] Style the confirm action as destructive.
 * @param {Function} props.onConfirm Called when the user confirms.
 * @param {Function} props.onCancel Called for cancel / ESC / overlay close.
 * @returns {JSX.Element|null}
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
}) => {
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

ConfirmDialog.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  title: PropTypes.node.isRequired,
  message: PropTypes.node.isRequired,
  confirmLabel: PropTypes.string,
  cancelLabel: PropTypes.string,
  destructive: PropTypes.bool,
  onConfirm: PropTypes.func.isRequired,
  onCancel: PropTypes.func.isRequired,
};

export default ConfirmDialog;
