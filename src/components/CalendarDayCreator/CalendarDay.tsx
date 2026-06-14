/**
 * @file CalendarDay - Individual day cell in calendar grid
 *
 * Renders a single day cell with appropriate visual state and interaction handlers.
 * Supports click and keyboard activation (Enter/Space) to toggle date selection. Arrow-key
 * navigation is handled by the parent {@link CalendarGrid} (roving tabindex), so this cell only
 * advertises whether it is the current roving target via `isActive`.
 */

import { useCallback } from 'react';
import type { Ref, MouseEvent as ReactMouseEvent, KeyboardEvent as ReactKeyboardEvent } from 'react';
import styles from './CalendarDayCreator.module.css';

interface CalendarDayProps {
  /** ISO date string (YYYY-MM-DD). */
  date: string;
  /** Is this date in the current displayed month. */
  isCurrentMonth: boolean;
  /** Is this date selected by user. */
  isSelected: boolean;
  /** Does a recording day already exist for this date. */
  isExisting: boolean;
  /** Is this date today. */
  isToday: boolean;
  /** Is this the roving-tabindex focus target (exactly one per grid). */
  isActive: boolean;
  /** Callback for date selection (toggle). Reads only `event.shiftKey` (range vs toggle). */
  onSelect: (date: string, event: { shiftKey: boolean }) => void;
  /**
   * Ref attached to this cell's button when it is the active cell, so the parent grid can move
   * DOM focus here after an arrow-key navigation.
   */
  cellRef?: Ref<HTMLButtonElement>;
}

/**
 * CalendarDay - Individual calendar day cell
 */
export function CalendarDay({
  date,
  isCurrentMonth,
  isSelected,
  isExisting,
  isToday,
  isActive,
  onSelect,
  cellRef,
}: CalendarDayProps) {
  // Extract day number from date
  const dayNumber = parseInt(date.split('-')[2], 10);

  // Determine CSS classes
  const classes = [
    styles.day,
    !isCurrentMonth && styles.dayOtherMonth,
    isSelected && styles.daySelected,
    isExisting && styles.dayExisting,
    isToday && styles.dayToday,
    isExisting && styles.dayDisabled,
  ]
    .filter(Boolean)
    .join(' ');

  /**
   * Handle click. An existing recording is not selectable — no-op (the cell stays focusable for
   * grid navigation via `aria-disabled`, but activating it does nothing).
   */
  const handleClick = useCallback(
    (event: ReactMouseEvent<HTMLButtonElement>) => {
      if (isExisting) return;
      onSelect(date, event);
    },
    [date, onSelect, isExisting]
  );

  /**
   * Handle keyboard ACTIVATION (Enter/Space). Arrow keys are intentionally NOT handled here — they
   * bubble to the grid's roving-tabindex handler.
   */
  const handleKeyDown = useCallback(
    (event: ReactKeyboardEvent<HTMLButtonElement>) => {
      if (event.key === ' ' || event.key === 'Enter') {
        event.preventDefault();
        if (isExisting) return;
        onSelect(date, event);
      }
    },
    [date, onSelect, isExisting]
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
      ref={cellRef}
      type="button"
      className={classes}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      // Existing recordings are aria-disabled rather than `disabled` so they stay focusable for
      // continuous arrow-key grid navigation (a real `disabled` cell drops out of the grid and
      // breaks Up/Down column alignment); activation is no-op'd above.
      aria-disabled={isExisting}
      role="gridcell"
      aria-selected={isSelected}
      aria-label={ariaLabel}
      // Roving tabindex: exactly one cell (the active one) is in the tab order; the rest are -1 and
      // reached via the arrow keys.
      tabIndex={isActive ? 0 : -1}
    >
      <span className={styles.dayNumber}>{dayNumber}</span>
      {isExisting && <span className={styles.dayCheckmark} aria-hidden="true">✓</span>}
    </button>
  );
}
