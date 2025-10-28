import PropTypes from 'prop-types';
import './Breadcrumb.css';

/**
 * Breadcrumb Navigation Component
 *
 * Shows hierarchical navigation path with clickable links.
 * Follows WAI-ARIA breadcrumb pattern for accessibility.
 *
 * @param {object} props
 * @param {Array<{label: string, href?: string}>} props.items - Breadcrumb items
 * @returns {JSX.Element}
 *
 * @example
 * <Breadcrumb items={[
 *   { label: 'Home', href: '#/' },
 *   { label: 'Animal: remy', href: '#/animal/remy' },
 *   { label: 'Day: 2023-06-22' }
 * ]} />
 */
export default function Breadcrumb({ items }) {
  if (!items || items.length === 0) return null;

  return (
    <nav aria-label="Breadcrumb" className="breadcrumb">
      <ol className="breadcrumb-list">
        {items.map((item, index) => {
          const isLast = index === items.length - 1;

          return (
            <li key={index} className="breadcrumb-item">
              {item.href && !isLast ? (
                <>
                  <a href={item.href} className="breadcrumb-link">
                    {item.label}
                  </a>
                  <span className="breadcrumb-separator" aria-hidden="true">
                    ›
                  </span>
                </>
              ) : (
                <span className="breadcrumb-current" aria-current={isLast ? 'page' : undefined}>
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

Breadcrumb.propTypes = {
  items: PropTypes.arrayOf(
    PropTypes.shape({
      label: PropTypes.string.isRequired,
      href: PropTypes.string,
    })
  ).isRequired,
};
