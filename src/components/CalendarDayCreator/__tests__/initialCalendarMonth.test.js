/**
 * @file Tests for getInitialCalendarMonth — the timeline-aware initial month for the
 * Add Recording Days calendar (Phase 8A-1).
 *
 * The calendar must follow the animal's recording timeline: when the animal already has
 * recording days, it opens near the latest one (or the next likely recording day if that
 * crosses into the following month), NOT wall-clock today. With no existing days it falls
 * back to the supplied wall-clock month.
 */

import { describe, it, expect } from 'vitest';
import { getInitialCalendarMonth } from '../CalendarDayCreator';

// A wall-clock "today" far from the seeded recording dates, so a regression that reverts to
// today (instead of the timeline) is unambiguous.
const TODAY = new Date(2026, 5, 11); // 2026-06-11 (month is 0-indexed: 5 = June)

describe('getInitialCalendarMonth', () => {
  it('falls back to the wall-clock month when there are no existing days', () => {
    expect(getInitialCalendarMonth([], TODAY)).toEqual({ year: 2026, month: 5 });
  });

  it('falls back to the wall-clock month when existingDays is undefined', () => {
    expect(getInitialCalendarMonth(undefined, TODAY)).toEqual({ year: 2026, month: 5 });
  });

  it('opens on the latest existing recording-day month (0-indexed), not wall-clock today', () => {
    // Latest day is mid-month (2023-06-22) → the next likely day (2023-06-23) is the same
    // month, so the calendar opens on June 2023 (month index 5), far from 2026.
    expect(getInitialCalendarMonth(['2023-06-10', '2023-06-22', '2023-06-15'], TODAY)).toEqual({
      year: 2023,
      month: 5,
    });
  });

  it('rolls to the following month when the next likely recording day crosses the month boundary', () => {
    // Latest existing day is the last day of June → the next likely recording day is July 1,
    // so the calendar opens on July 2023 (month index 6) where the user will click next.
    expect(getInitialCalendarMonth(['2023-06-28', '2023-06-30'], TODAY)).toEqual({
      year: 2023,
      month: 6,
    });
  });

  it('rolls into the next year when the latest existing day is Dec 31', () => {
    expect(getInitialCalendarMonth(['2023-12-31'], TODAY)).toEqual({ year: 2024, month: 0 });
  });

  it('uses the chronological maximum, independent of array order', () => {
    expect(getInitialCalendarMonth(['2023-08-05', '2023-03-01', '2023-11-09'], TODAY)).toEqual({
      year: 2023,
      month: 10, // November (next likely day Nov 10, same month)
    });
  });

  it('ignores malformed entries and uses the latest valid YYYY-MM-DD', () => {
    expect(
      getInitialCalendarMonth(['not-a-date', '2023-04-15', '', null, '2023-13-99'], TODAY)
    ).toEqual({ year: 2023, month: 3 });
  });

  it('falls back to wall-clock when no entry is a valid date', () => {
    expect(getInitialCalendarMonth(['nope', '2023/04/15', '20230415'], TODAY)).toEqual({
      year: 2026,
      month: 5,
    });
  });
});
