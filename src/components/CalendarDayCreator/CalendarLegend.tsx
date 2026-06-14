/**
 * @file CalendarLegend - Visual legend for calendar states
 *
 * Shows color-coded legend explaining calendar day states.
 */

import styles from './CalendarDayCreator.module.css';

/**
 * CalendarLegend - Visual legend component
 */
export function CalendarLegend() {
  return (
    <div className={styles.legend} role="region" aria-label="Calendar legend">
      <div className={styles.legendTitle}>Legend:</div>
      <div className={styles.legendItems}>
        <div className={styles.legendItem}>
          <span className={`${styles.legendIndicator} ${styles.legendIndicatorExisting}`} aria-hidden="true">✓</span>
          <span className={styles.legendLabel}>Existing recording</span>
        </div>
        <div className={styles.legendItem}>
          <span className={`${styles.legendIndicator} ${styles.legendIndicatorSelected}`} aria-hidden="true"></span>
          <span className={styles.legendLabel}>Selected</span>
        </div>
        <div className={styles.legendItem}>
          <span className={`${styles.legendIndicator} ${styles.legendIndicatorToday}`} aria-hidden="true"></span>
          <span className={styles.legendLabel}>Today</span>
        </div>
        <div className={styles.legendItem}>
          <span className={`${styles.legendIndicator} ${styles.legendIndicatorAvailable}`} aria-hidden="true"></span>
          <span className={styles.legendLabel}>Available</span>
        </div>
      </div>
    </div>
  );
}
