/**
 * @file CalendarDayCreator - Container component for calendar-based day creation
 *
 * Provides interactive calendar UI for creating multiple recording days at once.
 * Click individual dates to toggle selection, use Shift+Click for range selection.
 */

import { useState, useCallback, useId } from 'react';
import Modal from '../Modal/Modal';
import { CalendarGrid } from './CalendarGrid';
import { CalendarHeader } from './CalendarHeader';
import { CalendarLegend } from './CalendarLegend';
import './CalendarDayCreator.css';

/** A calendar date split into 1-indexed components (`month` 1 = January, `day` 1-based). */
interface DateParts {
  year: number;
  month: number;
  day: number;
}

/**
 * Get date range between two dates (inclusive). Handles DST transitions correctly by working with
 * date components directly. Both args are ISO date strings (`YYYY-MM-DD`).
 */
function getDateRange(startDate: string, endDate: string): string[] {
  const dates: string[] = [];

  // Parse date strings to components (avoids DST issues)
  const parseDate = (dateStr: string): DateParts => {
    const [year, month, day] = dateStr.split('-').map(Number);
    return { year, month, day };
  };

  // Convert date components to comparable value
  const toComparable = ({ year, month, day }: DateParts) => year * 10000 + month * 100 + day;

  // Add one day to date components
  const addDay = ({ year, month, day }: DateParts): DateParts => {
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
  const formatDate = ({ year, month, day }: DateParts) =>
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
 * The month the calendar should open on, following the animal's recording timeline.
 *
 * Recording days are inherently chronological, so when the animal already has days the
 * scientist's next action is almost always "add the next recording day" — not "find today's
 * date in a month years away from the experiment." So the calendar opens on the month of the
 * **next likely recording day** = the latest existing day + 1 day:
 *   - latest day mid-month → that same month (the next day is in it);
 *   - latest day is the last day of its month → the following month (where the next day falls).
 * With no existing days there is no timeline to follow, so it falls back to the wall-clock
 * month. ("Today" remains an explicit jump in the header for either case.)
 *
 * Pure (the wall-clock `fallbackDate` is injected) so it is unit-testable without mocking the
 * clock. Tolerates a malformed `existingDays` and rejects non-real calendar dates (e.g. a
 * persisted `2023-13-99`) rather than opening on an impossible month. Returns `{ year, month }`
 * with `month` 0-indexed (0 = January).
 */
export function getInitialCalendarMonth(
  existingDays: string[],
  fallbackDate: Date
): { year: number; month: number } {
  const fallback = { year: fallbackDate.getFullYear(), month: fallbackDate.getMonth() };

  const list = Array.isArray(existingDays) ? existingDays : [];
  // Keep only real calendar dates in canonical YYYY-MM-DD form (which sorts chronologically as
  // a plain string). A bad import can leave a format-valid but impossible date (month 13), so
  // range-check against the month's real length, not just the regex.
  const valid = list.filter((d) => {
    if (typeof d !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(d)) return false;
    const [, month, day] = d.split('-').map(Number);
    if (month < 1 || month > 12) return false;
    const daysInMonth = new Date(Number(d.slice(0, 4)), month, 0).getDate();
    return day >= 1 && day <= daysInMonth;
  });
  if (valid.length === 0) return fallback;

  const latest = valid.reduce((a, b) => (a > b ? a : b));
  const [year, month, day] = latest.split('-').map(Number); // month/day are 1-indexed here
  const daysInMonth = new Date(year, month, 0).getDate();

  // Show the month of the next likely recording day (latest + 1 day).
  if (day < daysInMonth) return { year, month: month - 1 }; // same month (to 0-indexed)
  if (month < 12) return { year, month }; // next month (1-indexed month === next month 0-indexed)
  return { year: year + 1, month: 0 }; // Dec 31 → January next year
}

interface CalendarDayCreatorProps {
  /** Current animal ID. */
  animalId: string;
  /** Array of existing day dates (`YYYY-MM-DD`). */
  existingDays?: string[];
  /** Callback when days are created (the selected dates, sorted). */
  onCreateDays: (dates: string[]) => void | Promise<void>;
  /** Callback to close the calendar. */
  onClose?: () => void;
}

/**
 * CalendarDayCreator - Interactive calendar for creating recording days
 */
export function CalendarDayCreator({ animalId, existingDays = [], onCreateDays, onClose }: CalendarDayCreatorProps) {
  // Stable id wiring the shared Modal's title to aria-labelledby.
  const titleId = useId();

  // Current displayed month — timeline-aware: open near the animal's latest recording day (the
  // next likely recording date) when days exist, else the wall-clock month. Computed once at
  // mount via a lazy initializer (the component remounts each time the calendar is opened, so
  // `existingDays` is fresh). "Today" stays an explicit jump in the header.
  const [currentMonth, setCurrentMonth] = useState(() =>
    getInitialCalendarMonth(existingDays, new Date())
  );

  // Selected dates (Set for O(1) lookup)
  const [selectedDates, setSelectedDates] = useState<Set<string>>(new Set());
  // Inline error shown if day creation fails (replaces a blocking alert()).
  const [createError, setCreateError] = useState<string | null>(null);

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
    (date: string, event: { shiftKey: boolean }) => {
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
      setCreateError(null);
      // Call parent callback with all dates
      await onCreateDays(dates);

      // Success: clear selection and close
      setSelectedDates(new Set());
      if (onClose) onClose();
    } catch (error) {
      console.error('Failed to create days:', error);
      setCreateError(`Failed to create days: ${(error as Error).message}`);
    }
  }, [selectedDates, onCreateDays, onClose]);

  return (
    <Modal
      isOpen
      onClose={() => onClose && onClose()}
      title="Recording Days Calendar"
      titleId={titleId}
      className="calendar-day-creator"
    >
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

      {createError && (
        <div className="calendar-create-error" role="alert">
          {createError}
        </div>
      )}

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
    </Modal>
  );
}
