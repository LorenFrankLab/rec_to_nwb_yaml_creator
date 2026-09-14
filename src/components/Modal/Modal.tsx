import { useRef } from 'react';
import type { MouseEvent as ReactMouseEvent, ReactNode } from 'react';
import { useDialogBehavior } from './useDialogBehavior';
import styles from './Modal.module.scss';

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
  /**
   * Optional sticky action row pinned below a scrollable body. When provided, the
   * content box becomes a header / scrollable body / pinned footer column so a tall
   * dialog's actions stay reachable without scrolling. When omitted, the dialog
   * renders exactly as a plain title + children (no body/footer wrappers).
   */
  footer?: ReactNode;
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
  footer,
  children,
}: ModalProps) => {
  const contentRef = useRef<HTMLDivElement | null>(null);

  useDialogBehavior(contentRef, { isOpen, onClose });

  if (!isOpen) return null;

  const handleOverlayClick = (e: ReactMouseEvent<HTMLDivElement>) => {
    // The content box stops propagation, so this handler only fires for clicks
    // landing directly on the backdrop — target === currentTarget identifies that
    // without depending on the (now hashed) overlay class name.
    if (closeOnOverlayClick && e.target === e.currentTarget) {
      onClose();
    }
  };

  const contentClassName = footer
    ? `${styles.content} ${styles.withFooter} ${className}`.trim()
    : `${styles.content} ${className}`.trim();

  return (
    <div
      className={styles.overlay}
      onClick={handleOverlayClick}
      role="presentation"
      data-testid="modal-overlay"
    >
      <div
        ref={contentRef}
        className={contentClassName}
        role={role}
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={describedById}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id={titleId} className={styles.title}>
          {title}
        </h2>
        {footer ? (
          <>
            <div className={styles.body} data-testid="modal-body">
              {children}
            </div>
            <div className={styles.footer} data-testid="modal-footer">
              {footer}
            </div>
          </>
        ) : (
          children
        )}
      </div>
    </div>
  );
};

export default Modal;
