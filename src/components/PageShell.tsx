import type { ReactNode } from 'react';
import styles from './PageShell.module.css';

interface PageShellProps {
  /** id for the `<h1>`, wired to the main landmark's `aria-labelledby`. */
  headingId: string;
  heading: ReactNode;
  /**
   * The breadcrumb trail rendered after the leading "Animals" link (e.g. `› Import`). Omitted →
   * no breadcrumb (a terminal result screen).
   */
  crumb?: ReactNode;
  /** Optional introductory paragraph under the heading. */
  lede?: ReactNode;
  /** Optional accessible name for the content region (when the heading alone isn't the name). */
  regionLabel?: string;
  /** Column width cap in px (default 800). */
  maxWidth?: number;
  children: ReactNode;
}

/**
 * The shared shell for a secondary workspace page: the `main-content` landmark (skip-link target),
 * a centred width-capped column, the `Animals › …` breadcrumb, the `<h1>` and an optional lede.
 * Pages render their own content inside it.
 */
export default function PageShell({
  headingId,
  heading,
  crumb,
  lede,
  regionLabel,
  maxWidth = 800,
  children,
}: PageShellProps) {
  return (
    <main id="main-content" tabIndex={-1} role="main" aria-labelledby={headingId}>
      <section className={styles.screen} style={{ maxWidth }} aria-label={regionLabel}>
        {crumb !== undefined && (
          <nav className={styles.crumb} aria-label="Breadcrumb">
            <a href="#/workspace">Animals</a> › {crumb}
          </nav>
        )}
        <h1 id={headingId} className={styles.heading}>{heading}</h1>
        {lede !== undefined && <p className={styles.lede}>{lede}</p>}
        {children}
      </section>
    </main>
  );
}

/** The shell's lede class, for a page that renders its lede conditionally or more than once. */
export const pageShellLedeClass = styles.lede;
