import styles from './Breadcrumb.module.css';

interface BreadcrumbItem {
  label: string;
  href?: string;
}

interface BreadcrumbProps {
  /** Breadcrumb items, ordered from root to current page. */
  items: BreadcrumbItem[];
}

/**
 * Breadcrumb Navigation Component
 *
 * Shows hierarchical navigation path with clickable links.
 * Follows WAI-ARIA breadcrumb pattern for accessibility.
 *
 * @example
 * <Breadcrumb items={[
 *   { label: 'Workspace', href: '#/workspace' },
 *   { label: 'Animal: remy', href: '#/animal/remy' },
 *   { label: 'Day: 2023-06-22' }
 * ]} />
 */
export default function Breadcrumb({ items }: BreadcrumbProps) {
  if (!items || items.length === 0) return null;

  return (
    <nav aria-label="Breadcrumb" className={styles.breadcrumb}>
      <ol className={styles.list}>
        {items.map((item, index) => {
          const isLast = index === items.length - 1;

          return (
            <li key={index} className={styles.item}>
              {item.href && !isLast ? (
                <>
                  <a href={item.href} className={styles.link}>
                    {item.label}
                  </a>
                  <span
                    className={styles.separator}
                    data-testid="breadcrumb-separator"
                    aria-hidden="true"
                  >
                    ›
                  </span>
                </>
              ) : (
                <span className={styles.current} aria-current={isLast ? 'page' : undefined}>
                  {item.label}
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
