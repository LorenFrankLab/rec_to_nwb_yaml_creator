import type { ReactNode } from 'react';
import styles from './EmptyState.module.css';

/** Props for {@link EmptyState}. */
export interface EmptyStateProps {
  /** A decorative glyph shown in the icon circle (hidden from assistive tech). */
  icon?: ReactNode;
  /** The zero-state heading, e.g. 'No recording days yet'. */
  title: string;
  /** The body copy explaining the state and what to do next. */
  children: ReactNode;
  /** The call-to-action row (buttons / links). Omitted when the state has no action. */
  actions?: ReactNode;
}

/**
 * EmptyState — the shared first-run / zero-state onboarding card (the empty-states.html pattern): an
 * icon, a heading, a line of guidance, and one or more CTAs. A heading (not a landmark) gives it
 * structure, so multiple empty states on a page don't proliferate `region` landmarks.
 *
 * @param props - The component props.
 * @param props.icon - A decorative glyph for the icon circle (hidden from assistive tech).
 * @param props.title - The zero-state heading.
 * @param props.children - The body copy.
 * @param props.actions - The CTA row.
 * @returns The empty-state card.
 */
export default function EmptyState({ icon, title, children, actions }: EmptyStateProps) {
  return (
    <div className={styles.empty}>
      {icon != null && (
        <div className={styles.icon} aria-hidden="true">
          {icon}
        </div>
      )}
      <h2 className={styles.title}>{title}</h2>
      <p className={styles.body}>{children}</p>
      {actions && <div className={styles.actions}>{actions}</div>}
    </div>
  );
}
