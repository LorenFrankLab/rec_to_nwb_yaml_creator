import React, { useEffect, useRef } from 'react';
import PropTypes from 'prop-types';
import './Modal.scss';

const FOCUSABLE =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), ' +
  'textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Accessible dialog container. Owns ESC close, overlay-click close (optional),
 * body-scroll lock, focus trap, and focus return to the element that opened it.
 * Callers render their own form/content as children and pass a stable titleId.
 *
 * @param {object} props
 * @param {boolean} props.isOpen Whether the dialog is shown.
 * @param {Function} props.onClose Called for ESC / overlay / programmatic close.
 * @param {string} props.title Heading text rendered as the labelled title.
 * @param {string} props.titleId id wired to aria-labelledby and the heading.
 * @param {boolean} [props.closeOnOverlayClick] Close when the backdrop is clicked.
 * @param {('dialog'|'alertdialog')} [props.role] ARIA role.
 * @param {string} [props.describedById] Optional aria-describedby target id.
 * @param {string} [props.className] Extra class on the content box.
 * @param {React.ReactNode} props.children Dialog body.
 * @returns {JSX.Element|null}
 */
const Modal = ({
  isOpen,
  onClose,
  title,
  titleId,
  closeOnOverlayClick = true,
  role = 'dialog',
  describedById,
  className = '',
  children,
}) => {
  const contentRef = useRef(null);
  const openerRef = useRef(null);

  // Capture the opener and restore focus to it on close.
  useEffect(() => {
    if (!isOpen) return undefined;
    openerRef.current = document.activeElement;
    return () => {
      if (openerRef.current && typeof openerRef.current.focus === 'function') {
        openerRef.current.focus();
      }
    };
  }, [isOpen]);

  // ESC close + focus trap (ported from the working CameraModal implementation).
  useEffect(() => {
    if (!isOpen) return undefined;
    const handleKeydown = (e) => {
      if (e.key === 'Escape') {
        onClose();
        return;
      }
      if (e.key === 'Tab' && contentRef.current) {
        const focusable = contentRef.current.querySelectorAll(FOCUSABLE);
        if (focusable.length === 0) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener('keydown', handleKeydown);
    return () => document.removeEventListener('keydown', handleKeydown);
  }, [isOpen, onClose]);

  // Auto-focus the first focusable element when opened.
  useEffect(() => {
    if (!isOpen || !contentRef.current) return;
    const focusable = contentRef.current.querySelector(FOCUSABLE);
    if (focusable) focusable.focus();
  }, [isOpen]);

  // Lock body scroll while open.
  useEffect(() => {
    if (isOpen) document.body.style.overflow = 'hidden';
    else document.body.style.overflow = '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const handleOverlayClick = (e) => {
    if (closeOnOverlayClick && e.target.classList.contains('modal-overlay')) {
      onClose();
    }
  };

  return (
    <div className="modal-overlay" onClick={handleOverlayClick} role="presentation">
      <div
        ref={contentRef}
        className={`modal-content ${className}`.trim()}
        role={role}
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={describedById}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id={titleId} className="modal-title">
          {title}
        </h2>
        {children}
      </div>
    </div>
  );
};

Modal.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  title: PropTypes.node.isRequired,
  titleId: PropTypes.string.isRequired,
  closeOnOverlayClick: PropTypes.bool,
  role: PropTypes.oneOf(['dialog', 'alertdialog']),
  describedById: PropTypes.string,
  className: PropTypes.string,
  children: PropTypes.node.isRequired,
};

export default Modal;
