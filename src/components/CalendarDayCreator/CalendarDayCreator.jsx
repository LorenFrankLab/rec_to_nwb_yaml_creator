/**
 * @file CalendarDayCreator - Container component for calendar-based day creation
 *
 * Provides interactive calendar UI for creating multiple recording days at once.
 * Click individual dates to toggle selection, use Shift+Click for range selection.
 *
 * @see docs/CALENDAR_DAY_CREATION_DESIGN.md for full design
 */

import { useState, useCallback } from 'react';
import PropTypes from 'prop-types';
import { CalendarGrid } from './CalendarGrid';
import { CalendarHeader } from './CalendarHeader';
import { CalendarLegend } from './CalendarLegend';
import './CalendarDayCreator.css';

/**
 * Get date range between two dates (inclusive)
 * Handles DST transitions correctly by working with date components directly
 *
 * @param {string} startDate - ISO date string (YYYY-MM-DD)
 * @param {string} endDate - ISO date string (YYYY-MM-DD)
 * @returns {string[]} Array of ISO date strings
 */
function getDateRange(startDate, endDate) {
  const dates = [];

  // Parse date strings to components (avoids DST issues)
  const parseDate = (dateStr) => {
    const [year, month, day] = dateStr.split('-').map(Number);
    return { year, month, day };
  };

  // Convert date components to comparable value
  const toComparable = ({ year, month, day }) => year * 10000 + month * 100 + day;

  // Add one day to date components
  const addDay = ({ year, month, day }) => {
    // Get days in current month
    const daysInMonth = new Date(year, month, 0).getDate();

    if (day < daysInMonth) {
      return { year, month, day: day + 1 };
    } else if (month < 12) {
      return { year, month: month + 1, day: 1 };
    } else {
      return { year: year + 1, month: 1, day: 1 };
    }
  };

  // Format date components to ISO string
  const formatDate = ({ year, month, day }) =>
    `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

  let start = parseDate(startDate);
  let end = parseDate(endDate);

  // Ensure start <= end
  if (toComparable(start) > toComparable(end)) {
    [start, end] = [end, start];
  }

  let current = start;
  while (toComparable(current) <= toComparable(end)) {
    dates.push(formatDate(current));
    current = addDay(current);
  }

  return dates;
}

/**
 * CalendarDayCreator - Interactive calendar for creating recording days
 *
 * @param {object} props
 * @param {string} props.animalId - Current animal ID
 * @param {string[]} props.existingDays - Array of existing day dates (YYYY-MM-DD)
 * @param {Function} props.onCreateDays - Callback when days are created
 * @param {Function} props.onClose - Callback to close calendar
 */
export function CalendarDayCreator({ animalId, existingDays = [], onCreateDays, onClose }) {
  // Current displayed month
  const today = new Date();
  const [currentMonth, setCurrentMonth] = useState({
    year: today.getFullYear(),
    month: today.getMonth(), // 0-indexed (0 = January)
  });

  // Selected dates (Set for O(1) lookup)
  const [selectedDates, setSelectedDates] = useState(new Set());

  /**
   * Navigate to previous month
   */
  const handlePreviousMonth = useCallback(() => {
    setCurrentMonth((prev) => {
      const newMonth = prev.month - 1;
      if (newMonth < 0) {
        return { year: prev.year - 1, month: 11 };
      }
      return { year: prev.year, month: newMonth };
    });
  }, []);

  /**
   * Navigate to next month
   */
  const handleNextMonth = useCallback(() => {
    setCurrentMonth((prev) => {
      const newMonth = prev.month + 1;
      if (newMonth > 11) {
        return { year: prev.year + 1, month: 0 };
      }
      return { year: prev.year, month: newMonth };
    });
  }, []);

  /**
   * Jump to current month
   */
  const handleToday = useCallback(() => {
    const now = new Date();
    setCurrentMonth({
      year: now.getFullYear(),
      month: now.getMonth(),
    });
  }, []);

  /**
   * Handle date selection
   * - Plain click: Toggle date (add/remove from selection)
   * - Shift+Click: Select range from first selected to clicked date
   */
  const handleDateSelect = useCallback(
    (date, event) => {
      // Prevent selection of existing days
      if (existingDays.includes(date)) return;

      if (event.shiftKey && selectedDates.size > 0) {
        // Range selection: select all dates between first and clicked
        const sortedDates = Array.from(selectedDates).sort();
        const start = sortedDates[0];
        const range = getDateRange(start, date);
        const validDates = range.filter((d) => !existingDays.includes(d));
        setSelectedDates(new Set(validDates));
      } else {
        // Default behavior: Toggle individual date (add or remove)
        const newSelection = new Set(selectedDates);
        if (newSelection.has(date)) {
          newSelection.delete(date);
        } else {
          newSelection.add(date);
        }
        setSelectedDates(newSelection);
      }
    },
    [existingDays, selectedDates]
  );

  /**
   * Clear all selected dates
   */
  const handleClearSelection = useCallback(() => {
    setSelectedDates(new Set());
  }, []);

  /**
   * Create all selected days
   */
  const handleCreateDays = useCallback(async () => {
    if (selectedDates.size === 0) return;

    const dates = Array.from(selectedDates).sort();

    try {
      // Call parent callback with all dates
      await onCreateDays(dates);

      // Success: clear selection and close
      setSelectedDates(new Set());
      if (onClose) onClose();
    } catch (error) {
      console.error('Failed to create days:', error);
      alert(`Failed to create days: ${error.message}`);
    }
  }, [selectedDates, onCreateDays, onClose]);

  return (
    <div className="calendar-day-creator" role="dialog" aria-label="Recording days calendar">
      <CalendarHeader
        currentMonth={currentMonth}
        onPreviousMonth={handlePreviousMonth}
        onNextMonth={handleNextMonth}
        onToday={handleToday}
      />

      <CalendarGrid
        currentMonth={currentMonth}
        selectedDates={selectedDates}
        existingDays={existingDays}
        onDateSelect={handleDateSelect}
      />

      <CalendarLegend />

      <div className="calendar-actions">
        <button
          type="button"
          onClick={handleClearSelection}
          disabled={selectedDates.size === 0}
          className="btn-secondary"
        >
          Clear Selection
        </button>

        <button
          type="button"
          onClick={handleCreateDays}
          disabled={selectedDates.size === 0}
          className="btn-primary"
          aria-label={`Create ${selectedDates.size} recording day${selectedDates.size === 1 ? '' : 's'}`}
        >
          Create {selectedDates.size} {selectedDates.size === 1 ? 'Day' : 'Days'}
        </button>

        {onClose && (
          <button type="button" onClick={onClose} className="btn-close" aria-label="Close calendar">
            ✕
          </button>
        )}
      </div>
    </div>
  );
}

CalendarDayCreator.propTypes = {
  animalId: PropTypes.string.isRequired,
  existingDays: PropTypes.arrayOf(PropTypes.string),
  onCreateDays: PropTypes.func.isRequired,
  onClose: PropTypes.func,
};

CalendarDayCreator.defaultProps = {
  existingDays: [],
  onClose: undefined,
};
