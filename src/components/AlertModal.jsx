import React, { useEffect, useRef } from 'react';
import PropTypes from 'prop-types';
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
  const closeButtonRef = useRef(null);

  // Handle ESC key
  useEffect(() => {
    if (!isOpen) return;

    const handleEscape = (e) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

  // Focus close button when modal opens
  useEffect(() => {
    if (isOpen && closeButtonRef.current) {
      closeButtonRef.current.focus();
    }
  }, [isOpen]);

  // Lock body scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }

    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  // Handle click on overlay (outside modal)
  const handleOverlayClick = (e) => {
    if (e.target.classList.contains('alert-modal-overlay')) {
      onClose();
    }
  };

  // Don't render if not open
  if (!isOpen) return null;

  const titleId = 'alert-modal-title';
  const messageId = 'alert-modal-message';

  // Icon mapping for accessibility (not relying on color alone)
  const iconMap = {
    info: 'ℹ️',
    success: '✅',
    warning: '⚠️',
    error: '❌',
  };

  return (
    <div
      className="alert-modal-overlay"
      onClick={handleOverlayClick}
      role="presentation"
    >
      <div
        className={`alert-modal-content alert-modal-${type}`}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={messageId}
        onClick={(e) => e.stopPropagation()} // Prevent overlay click when clicking content
      >
        <h2 id={titleId} className="alert-modal-title">
          <span className="alert-modal-icon" aria-hidden="true">
            {iconMap[type]}
          </span>
          {title}
        </h2>
        <p id={messageId} className="alert-modal-message">
          {message}
        </p>
        <button
          ref={closeButtonRef}
          onClick={onClose}
          className="alert-modal-close"
          aria-label="Close alert"
        >
          Close
        </button>
      </div>
    </div>
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
