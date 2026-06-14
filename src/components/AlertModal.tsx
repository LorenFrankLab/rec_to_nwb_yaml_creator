import { useId } from 'react';
import type { ReactNode } from 'react';
import Modal from './Modal/Modal';
import './AlertModal.scss';

type AlertType = 'info' | 'success' | 'warning' | 'error';

interface AlertModalProps {
  /** Whether modal is currently open. */
  isOpen: boolean;
  /** Alert message to display. */
  message: ReactNode;
  /** Alert title (default: "Alert"). */
  title?: string;
  /** Callback when modal is closed. */
  onClose: () => void;
  /** Alert type (default: 'info'). */
  type?: AlertType;
}

/**
 * AlertModal component - Accessible modal for displaying alerts
 *
 * Replaces window.alert with proper accessible modal dialog.
 * Implements WCAG 2.1 Level A requirements:
 * - role="alertdialog" for screen readers
 * - Focus trap to keep keyboard navigation within modal
 * - ESC key to close
 * - Click outside overlay to close
 * - Focus management (auto-focus close button)
 * - Body scroll lock when open
 */
const AlertModal = ({ isOpen, message, title = 'Alert', onClose, type = 'info' }: AlertModalProps) => {
  // Unique per instance so multiple alerts in the tree can't collide on ids.
  const baseId = useId();
  const titleId = `${baseId}-alert-title`;
  const messageId = `${baseId}-alert-message`;

  // Icon mapping for accessibility (not relying on color alone)
  const iconMap = {
    info: 'ℹ️',
    success: '✅',
    warning: '⚠️',
    error: '❌',
  };

  // Built on the shared Modal primitive, which provides the focus trap, focus
  // return, ESC/overlay close, and scroll lock. AlertModal keeps its own visual
  // classes (alert-modal-content + type variant, message, close button).
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      role="alertdialog"
      titleId={titleId}
      describedById={messageId}
      className={`alert-modal-content alert-modal-${type}`}
      title={
        <>
          <span className="alert-modal-icon" aria-hidden="true">
            {iconMap[type]}
          </span>
          {title}
        </>
      }
      footer={
        <button type="button" onClick={onClose} className="alert-modal-close" aria-label="Close alert">
          Close
        </button>
      }
    >
      <p id={messageId} className="alert-modal-message">
        {message}
      </p>
    </Modal>
  );
};

export default AlertModal;
