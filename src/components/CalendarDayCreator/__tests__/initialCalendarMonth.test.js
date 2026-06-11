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

  it('rejects a format-valid but impossible day-of-month (Feb 30 / Apr 31), using the next valid date', () => {
    // The filter range-checks against the month's real length, not just the regex — so a persisted
    // 2023-02-30 / 2023-04-31 is discarded and the latest REAL date wins.
    expect(getInitialCalendarMonth(['2023-02-30', '2023-01-15'], TODAY)).toEqual({
      year: 2023,
      month: 0, // Jan 15 (next likely Jan 16, same month)
    });
    expect(getInitialCalendarMonth(['2023-04-31', '2023-03-20'], TODAY)).toEqual({
      year: 2023,
      month: 2, // Mar 20
    });
  });

  it('rejects month 00 and day 00', () => {
    expect(getInitialCalendarMonth(['2023-00-10', '2023-06-00', '2023-05-20'], TODAY)).toEqual({
      year: 2023,
      month: 4, // May 20
    });
  });

  it('accepts a real leap-day (Feb 29 in a leap year) and rolls to March as the next likely day', () => {
    // Feb 29 is the LAST day of Feb 2024, so the next likely recording day is March 1 → March (idx 2).
    expect(getInitialCalendarMonth(['2024-02-29'], TODAY)).toEqual({ year: 2024, month: 2 });
  });

  it('rejects Feb 29 in a non-leap year', () => {
    expect(getInitialCalendarMonth(['2023-02-29', '2023-01-10'], TODAY)).toEqual({
      year: 2023,
      month: 0, // Jan 10 — the impossible 2023-02-29 is discarded
    });
  });

  it('falls back to wall-clock when no entry is a valid date', () => {
    expect(getInitialCalendarMonth(['nope', '2023/04/15', '20230415'], TODAY)).toEqual({
      year: 2026,
      month: 5,
    });
  });
});
