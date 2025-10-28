/**
 * @file CalendarDay - Individual day cell in calendar grid
 *
 * Renders a single day cell with appropriate visual state and interaction handlers.
 * Supports click and keyboard navigation to toggle date selection.
 */

import { useCallback } from 'react';
import PropTypes from 'prop-types';

/**
 * CalendarDay - Individual calendar day cell
 *
 * @param {object} props
 * @param {string} props.date - ISO date string (YYYY-MM-DD)
 * @param {boolean} props.isCurrentMonth - Is this date in the current displayed month
 * @param {boolean} props.isSelected - Is this date selected by user
 * @param {boolean} props.isExisting - Does a recording day already exist for this date
 * @param {boolean} props.isToday - Is this date today
 * @param {Function} props.onSelect - Callback for date selection (toggle)
 */
export function CalendarDay({
  date,
  isCurrentMonth,
  isSelected,
  isExisting,
  isToday,
  onSelect,
}) {
  // Extract day number from date
  const dayNumber = parseInt(date.split('-')[2], 10);

  // Determine CSS classes
  const classes = [
    'calendar-day',
    !isCurrentMonth && 'calendar-day--other-month',
    isSelected && 'calendar-day--selected',
    isExisting && 'calendar-day--existing',
    isToday && 'calendar-day--today',
    isExisting && 'calendar-day--disabled',
  ]
    .filter(Boolean)
    .join(' ');

  /**
   * Handle click
   */
  const handleClick = useCallback(
    (event) => {
      onSelect(date, event);
    },
    [date, onSelect]
  );

  /**
   * Handle keyboard navigation
   */
  const handleKeyDown = useCallback(
    (event) => {
      if (event.key === ' ' || event.key === 'Enter') {
        event.preventDefault();
        onSelect(date, event);
      }
    },
    [date, onSelect]
  );

  // ARIA attributes
  // Parse date as local time, not UTC
  const [year, month, day] = date.split('-').map(Number);
  const localDate = new Date(year, month - 1, day);

  const ariaLabel = [
    localDate.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }),
    isExisting && '(existing recording)',
    isToday && '(today)',
    isSelected && '(selected)',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <button
      type="button"
      className={classes}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      disabled={isExisting}
      role="gridcell"
      aria-selected={isSelected}
      aria-disabled={isExisting}
      aria-label={ariaLabel}
      tabIndex={isToday ? 0 : -1}
    >
      <span className="calendar-day-number">{dayNumber}</span>
      {isExisting && <span className="calendar-day-checkmark" aria-hidden="true">✓</span>}
    </button>
  );
}

CalendarDay.propTypes = {
  date: PropTypes.string.isRequired,
  isCurrentMonth: PropTypes.bool.isRequired,
  isSelected: PropTypes.bool.isRequired,
  isExisting: PropTypes.bool.isRequired,
  isToday: PropTypes.bool.isRequired,
  onSelect: PropTypes.func.isRequired,
};
