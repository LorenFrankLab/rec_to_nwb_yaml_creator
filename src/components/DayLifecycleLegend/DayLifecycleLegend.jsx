/**
 * @file DayLifecycleLegend — the shared reference legend for the day-lifecycle vocabulary.
 *
 * Renders one collapsible legend (default-collapsed: "details on demand", so it never crowds the
 * primary task) explaining every {@link DAY_LIFECYCLE} status once. Reused on Animal Days and the
 * Validation Summary so the meaning of "Ready to export" vs "Validated" vs "Exported" is defined
 * in ONE place instead of re-explained per surface. Each row pairs a color swatch with the word
 * AND its description, so the status is never conveyed by color alone (WCAG 1.4.1).
 */

import PropTypes from 'prop-types';
import {
  DAY_LIFECYCLE_ORDER,
  DAY_LIFECYCLE_LABEL,
  DAY_LIFECYCLE_DESCRIPTION,
} from '../../domain/dayLifecycle';
import styles from './DayLifecycleLegend.module.css';

/**
 * @param {object} props
 * @param {string} [props.summaryText] - The collapsed-state toggle label. Defaults to a question
 *   so the affordance reads as optional help, not a required step.
 * @returns {JSX.Element}
 */
export default function DayLifecycleLegend({ summaryText = 'What do these statuses mean?' }) {
  return (
    // role="group" + aria-label give the disclosure a stable accessible name regardless of how a
    // given engine maps a bare <details>.
    <details className={styles.legend} role="group" aria-label={summaryText}>
      <summary className={styles.summary}>{summaryText}</summary>
      <dl className={styles.list}>
        {DAY_LIFECYCLE_ORDER.map((variant) => (
          <div key={variant} className={styles.item}>
            <dt className={styles.term}>
              <span className={`${styles.dot} ${styles[variant]}`} aria-hidden="true" />
              {DAY_LIFECYCLE_LABEL[variant]}
            </dt>
            <dd className={styles.description}>{DAY_LIFECYCLE_DESCRIPTION[variant]}</dd>
          </div>
        ))}
      </dl>
    </details>
  );
}

DayLifecycleLegend.propTypes = {
  summaryText: PropTypes.string,
};

DayLifecycleLegend.defaultProps = {
  summaryText: 'What do these statuses mean?',
};
