/**
 * @file CalendarHeader - Month navigation header for calendar
 *
 * Displays current month/year and provides navigation controls.
 */

import PropTypes from 'prop-types';

/**
 * Get month name from 0-indexed month number
 * @param {number} month - 0-indexed month (0 = January)
 * @returns {string} Month name
 */
function getMonthName(month) {
  const months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];
  return months[month];
}

/**
 * CalendarHeader - Month navigation header
 *
 * @param {object} props
 * @param {object} props.currentMonth - { year, month }
 * @param {Function} props.onPreviousMonth - Callback for previous month
 * @param {Function} props.onNextMonth - Callback for next month
 * @param {Function} props.onToday - Callback for jump to today
 */
export function CalendarHeader({ currentMonth, onPreviousMonth, onNextMonth, onToday }) {
  const { year, month } = currentMonth;
  const monthName = getMonthName(month);

  return (
    <div className="calendar-header">
      <h2 className="calendar-title">Recording Days Calendar</h2>

      <div className="calendar-nav">
        <button
          type="button"
          onClick={onPreviousMonth}
          className="btn-nav"
          aria-label="Previous month"
        >
          ◀
        </button>

        <div className="calendar-month-year">
          {monthName} {year}
        </div>

        <button
          type="button"
          onClick={onNextMonth}
          className="btn-nav"
          aria-label="Next month"
        >
          ▶
        </button>

        <button
          type="button"
          onClick={onToday}
          className="btn-today"
        >
          Today
        </button>
      </div>
    </div>
  );
}

CalendarHeader.propTypes = {
  currentMonth: PropTypes.shape({
    year: PropTypes.number.isRequired,
    month: PropTypes.number.isRequired,
  }).isRequired,
  onPreviousMonth: PropTypes.func.isRequired,
  onNextMonth: PropTypes.func.isRequired,
  onToday: PropTypes.func.isRequired,
};
