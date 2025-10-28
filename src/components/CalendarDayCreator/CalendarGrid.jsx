/**
 * @file CalendarGrid - Renders calendar grid with days
 *
 * Displays a month view calendar with days of the week and date cells.
 * Handles date selection via click/keyboard interactions.
 */

import PropTypes from 'prop-types';
import { CalendarDay } from './CalendarDay';

/**
 * Get array of dates to display in calendar grid
 * Includes padding days from previous/next months
 *
 * @param {number} year - Full year (e.g., 2025)
 * @param {number} month - 0-indexed month (0 = January)
 * @returns {object[]} Array of date objects with { date, isCurrentMonth }
 */
function getCalendarDays(year, month) {
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);

  const startDay = firstDay.getDay(); // 0 = Sunday
  const daysInMonth = lastDay.getDate();

  const days = [];

  // Add padding days from previous month
  const prevMonth = month === 0 ? 11 : month - 1;
  const prevYear = month === 0 ? year - 1 : year;
  const daysInPrevMonth = new Date(year, month, 0).getDate();

  for (let i = startDay - 1; i >= 0; i--) {
    const day = daysInPrevMonth - i;
    days.push({
      date: `${prevYear}-${String(prevMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
      isCurrentMonth: false,
    });
  }

  // Add days from current month
  for (let day = 1; day <= daysInMonth; day++) {
    days.push({
      date: `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
      isCurrentMonth: true,
    });
  }

  // Add padding days from next month
  const remainingCells = 42 - days.length; // 6 rows * 7 days
  const nextMonth = month === 11 ? 0 : month + 1;
  const nextYear = month === 11 ? year + 1 : year;

  for (let day = 1; day <= remainingCells; day++) {
    days.push({
      date: `${nextYear}-${String(nextMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
      isCurrentMonth: false,
    });
  }

  return days;
}

/**
 * CalendarGrid - Renders calendar grid with day cells
 *
 * @param {object} props
 * @param {object} props.currentMonth - { year, month }
 * @param {Set<string>} props.selectedDates - Set of selected date strings
 * @param {string[]} props.existingDays - Array of existing day dates
 * @param {Function} props.onDateSelect - Callback for date selection (toggle)
 */
export function CalendarGrid({
  currentMonth,
  selectedDates,
  existingDays,
  onDateSelect,
}) {
  const { year, month } = currentMonth;
  const days = getCalendarDays(year, month);

  // Get today's date in local timezone (not UTC)
  const now = new Date();
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

  const weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  return (
    <div className="calendar-grid" role="grid" aria-label="Calendar dates">
      {/* Week day headers */}
      <div className="calendar-weekdays" role="row">
        {weekDays.map((day) => (
          <div key={day} className="calendar-weekday" role="columnheader">
            {day}
          </div>
        ))}
      </div>

      {/* Date cells */}
      <div className="calendar-days" role="row">
        {days.map(({ date, isCurrentMonth }) => {
          const isSelected = selectedDates.has(date);
          const isExisting = existingDays.includes(date);
          const isToday = date === today;

          return (
            <CalendarDay
              key={date}
              date={date}
              isCurrentMonth={isCurrentMonth}
              isSelected={isSelected}
              isExisting={isExisting}
              isToday={isToday}
              onSelect={onDateSelect}
            />
          );
        })}
      </div>
    </div>
  );
}

CalendarGrid.propTypes = {
  currentMonth: PropTypes.shape({
    year: PropTypes.number.isRequired,
    month: PropTypes.number.isRequired,
  }).isRequired,
  selectedDates: PropTypes.instanceOf(Set).isRequired,
  existingDays: PropTypes.arrayOf(PropTypes.string).isRequired,
  onDateSelect: PropTypes.func.isRequired,
};
