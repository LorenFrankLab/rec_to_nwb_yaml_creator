/**
 * @file CalendarGrid - Renders calendar grid with days
 *
 * Displays a month view as six weekly rows of seven date cells, with a roving tabindex so the grid
 * is keyboard-reachable on any displayed month (even one that does not contain today) and the
 * arrow keys move focus cell-to-cell.
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import PropTypes from 'prop-types';
import { CalendarDay } from './CalendarDay';

const WEEK_LENGTH = 7;

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

  // Month-aware accessible name so the grid announces which month a screen-reader user is in (the
  // static "Calendar dates" gave no context when navigating month-to-month).
  const gridLabel = `${new Date(year, month, 1).toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
  })} calendar`;

  // The full display order (42 cells) and the displayed month's own dates, used for roving focus.
  const allDates = days.map((d) => d.date);
  const monthDates = days.filter((d) => d.isCurrentMonth).map((d) => d.date);
  // Default roving-focus target: today when it falls in the displayed month, else the first
  // SELECTABLE (non-existing) day of the month — so Tab always reaches a usable cell even when
  // today is in another month. Fall back to the first cell if every month day is an existing record.
  const firstSelectable = monthDates.find((d) => !existingDays.includes(d));
  const defaultActiveDate = monthDates.includes(today)
    ? today
    : firstSelectable ?? monthDates[0] ?? allDates[0];

  const [activeDate, setActiveDate] = useState(defaultActiveDate);
  // Set true only by an arrow-key move, so we move DOM focus to the new cell on navigation but NOT
  // on initial mount / month change (the Modal owns the initial focus there).
  const focusAfterNavRef = useRef(false);
  const activeCellRef = useRef(null);

  // Reset the roving target whenever the displayed month changes.
  useEffect(() => {
    setActiveDate(defaultActiveDate);
    focusAfterNavRef.current = false;
  }, [defaultActiveDate]);

  // After an arrow-key navigation, move DOM focus to the newly-active cell.
  useEffect(() => {
    if (focusAfterNavRef.current && activeCellRef.current) {
      activeCellRef.current.focus();
      focusAfterNavRef.current = false;
    }
  }, [activeDate]);

  const moveActiveBy = useCallback(
    (delta) => {
      const index = allDates.indexOf(activeDate);
      if (index === -1) return;
      const nextIndex = Math.min(allDates.length - 1, Math.max(0, index + delta));
      if (nextIndex === index) return;
      focusAfterNavRef.current = true;
      setActiveDate(allDates[nextIndex]);
    },
    [activeDate, allDates]
  );

  const moveActiveTo = useCallback(
    (nextIndex) => {
      const clamped = Math.min(allDates.length - 1, Math.max(0, nextIndex));
      focusAfterNavRef.current = true;
      setActiveDate(allDates[clamped]);
    },
    [allDates]
  );

  const handleGridKeyDown = useCallback(
    (event) => {
      const index = allDates.indexOf(activeDate);
      if (index === -1) return;
      switch (event.key) {
        case 'ArrowRight':
          event.preventDefault();
          moveActiveBy(1);
          break;
        case 'ArrowLeft':
          event.preventDefault();
          moveActiveBy(-1);
          break;
        case 'ArrowDown':
          event.preventDefault();
          moveActiveBy(WEEK_LENGTH);
          break;
        case 'ArrowUp':
          event.preventDefault();
          moveActiveBy(-WEEK_LENGTH);
          break;
        case 'Home': // first cell of the current week row
          event.preventDefault();
          moveActiveTo(index - (index % WEEK_LENGTH));
          break;
        case 'End': // last cell of the current week row
          event.preventDefault();
          moveActiveTo(index - (index % WEEK_LENGTH) + (WEEK_LENGTH - 1));
          break;
        default:
          break;
      }
    },
    [activeDate, allDates, moveActiveBy, moveActiveTo]
  );

  // Split the 42 cells into six weekly rows of seven, so AT grid navigation reads weeks × days.
  const weeks = [];
  for (let i = 0; i < days.length; i += WEEK_LENGTH) {
    weeks.push(days.slice(i, i + WEEK_LENGTH));
  }

  return (
    // role="grid" is a composite widget; the keydown handler drives its roving tabindex.
    // eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions
    <div
      className="calendar-grid"
      role="grid"
      aria-label={gridLabel}
      aria-multiselectable="true"
      onKeyDown={handleGridKeyDown}
    >
      {/* Week day headers — in their own rowgroup so the grid's direct children are all
          row/rowgroup (a valid WAI-ARIA grid ownership chain). */}
      <div role="rowgroup">
        <div className="calendar-weekdays" role="row">
          {weekDays.map((day) => (
            <div key={day} className="calendar-weekday" role="columnheader">
              {day}
            </div>
          ))}
        </div>
      </div>

      {/* Date cells — a rowgroup of one role="row" per week (chunks of seven). */}
      <div className="calendar-days" role="rowgroup">
        {weeks.map((week) => (
          <div key={week[0].date} className="calendar-week" role="row">
            {week.map(({ date, isCurrentMonth }) => {
              const isActive = date === activeDate;
              return (
                <CalendarDay
                  key={date}
                  date={date}
                  isCurrentMonth={isCurrentMonth}
                  isSelected={selectedDates.has(date)}
                  isExisting={existingDays.includes(date)}
                  isToday={date === today}
                  isActive={isActive}
                  onSelect={onDateSelect}
                  cellRef={isActive ? activeCellRef : undefined}
                />
              );
            })}
          </div>
        ))}
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
