/**
 * @file CalendarHeader - Month navigation header for calendar
 *
 * Displays current month/year and provides navigation controls.
 */

import styles from './CalendarDayCreator.module.css';

/**
 * Get month name from 0-indexed month number (0 = January).
 */
function getMonthName(month: number): string {
  const months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];
  return months[month];
}

interface CalendarHeaderProps {
  /** The displayed month, `month` 0-indexed (0 = January). */
  currentMonth: { year: number; month: number };
  /** Callback for previous month. */
  onPreviousMonth: () => void;
  /** Callback for next month. */
  onNextMonth: () => void;
  /** Callback for jump to today. */
  onToday: () => void;
}

/**
 * CalendarHeader - Month navigation header
 */
export function CalendarHeader({ currentMonth, onPreviousMonth, onNextMonth, onToday }: CalendarHeaderProps) {
  const { year, month } = currentMonth;
  const monthName = getMonthName(month);

  return (
    <div className={styles.header}>
      <div className={styles.nav}>
        <button
          type="button"
          onClick={onPreviousMonth}
          className={styles.btnNav}
          aria-label="Previous month"
        >
          ◀
        </button>

        {/* aria-live so a screen-reader user hears the new month when navigating prev/next/today
            (the displayed month otherwise changes silently). */}
        <div className={styles.monthYear} aria-live="polite" aria-atomic="true">
          {monthName} {year}
        </div>

        <button
          type="button"
          onClick={onNextMonth}
          className={styles.btnNav}
          aria-label="Next month"
        >
          ▶
        </button>

        <button
          type="button"
          onClick={onToday}
          className={styles.btnToday}
        >
          Today
        </button>
      </div>
    </div>
  );
}
