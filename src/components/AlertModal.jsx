import React, { useId } from 'react';
import PropTypes from 'prop-types';
import Modal from './Modal/Modal';
import './AlertModal.scss';

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
 *
 * @param {object} props Component properties
 * @param {boolean} props.isOpen Whether modal is currently open
 * @param {string} props.message Alert message to display
 * @param {string} props.title Alert title (default: "Alert")
 * @param {Function} props.onClose Callback when modal is closed
 * @param {string} props.type Alert type: 'info', 'warning', 'error' (default: 'info')
 *
 * @returns {JSX.Element|null} Modal component or null if closed
 */
const AlertModal = ({ isOpen, message, title = 'Alert', onClose, type = 'info' }) => {
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
    >
      <p id={messageId} className="alert-modal-message">
        {message}
      </p>
      <button type="button" onClick={onClose} className="alert-modal-close" aria-label="Close alert">
        Close
      </button>
    </Modal>
  );
};

AlertModal.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  message: PropTypes.string.isRequired,
  title: PropTypes.string,
  onClose: PropTypes.func.isRequired,
  type: PropTypes.oneOf(['info', 'success', 'warning', 'error']),
};

AlertModal.defaultProps = {
  title: 'Alert',
  type: 'info',
};

export default AlertModal;
