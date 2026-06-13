import { useEffect, useRef } from 'react';
import type { MouseEvent as ReactMouseEvent, ReactNode } from 'react';
import './Modal.scss';

const FOCUSABLE =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), ' +
  'textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

interface ModalProps {
  /** Whether the dialog is shown. */
  isOpen: boolean;
  /** Called for ESC / overlay / programmatic close. */
  onClose: () => void;
  /** Heading content rendered as the labelled title. */
  title: ReactNode;
  /** id wired to aria-labelledby and the heading. */
  titleId: string;
  /** Close when the backdrop is clicked (default true). */
  closeOnOverlayClick?: boolean;
  /** ARIA role (default 'dialog'). */
  role?: 'dialog' | 'alertdialog';
  /** Optional aria-describedby target id. */
  describedById?: string;
  /** Extra class on the content box. */
  className?: string;
  /** Dialog body. */
  children: ReactNode;
}

/**
 * Accessible dialog container. Owns ESC close, overlay-click close (optional),
 * body-scroll lock, focus trap, and focus return to the element that opened it.
 * Callers render their own form/content as children and pass a stable titleId.
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
}: ModalProps) => {
  const contentRef = useRef<HTMLDivElement | null>(null);
  const openerRef = useRef<HTMLElement | null>(null);

  // Capture the opener and restore focus to it on close.
  useEffect(() => {
    if (!isOpen) return undefined;
    openerRef.current = document.activeElement as HTMLElement | null;
    return () => {
      if (openerRef.current && typeof openerRef.current.focus === 'function') {
        openerRef.current.focus();
      }
    };
  }, [isOpen]);

  // ESC close + focus trap (ported from the working CameraModal implementation).
  useEffect(() => {
    if (!isOpen) return undefined;
    const handleKeydown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
        return;
      }
      if (e.key === 'Tab' && contentRef.current) {
        const focusable = contentRef.current.querySelectorAll<HTMLElement>(FOCUSABLE);
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
    const focusable = contentRef.current.querySelector<HTMLElement>(FOCUSABLE);
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

  const handleOverlayClick = (e: ReactMouseEvent<HTMLDivElement>) => {
    if (closeOnOverlayClick && (e.target as HTMLElement).classList.contains('modal-overlay')) {
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

export default Modal;
