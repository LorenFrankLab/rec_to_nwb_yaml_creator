/**
 * @fileoverview The subject's age on a recording date, from its date of birth. Pure.
 *
 * Age is a per-recording fact (`day.session.age`): a day created in the app gets the age on its own
 * date, never the age another recording's file stated.
 */

const DATE_PREFIX = /^(\d{4})-(\d{2})-(\d{2})/;

/**
 * The calendar date at the start of an ISO date / timestamp, as UTC milliseconds, or null when it
 * is not a real date.
 *
 * @param value - An ISO date or timestamp.
 * @returns UTC milliseconds of that calendar date, or null.
 */
function calendarDay(value: unknown): number | null {
  const match = typeof value === 'string' ? DATE_PREFIX.exec(value) : null;
  if (!match) return null;
  const [year, month, day] = match.slice(1).map(Number);
  const time = Date.UTC(year, month - 1, day);
  const parsed = new Date(time);
  // Date.UTC rolls an impossible date over (2023-02-30 → March 2); refuse it instead.
  return parsed.getUTCFullYear() === year && parsed.getUTCMonth() === month - 1 && parsed.getUTCDate() === day
    ? time
    : null;
}

/**
 * The subject's age on a recording date as an ISO 8601 duration in days (`P163D`), counted between
 * the calendar dates of the birth and the recording.
 *
 * @param dateOfBirth - The subject's date of birth (ISO timestamp, as stored on the animal).
 * @param recordingDate - The recording date, `YYYY-MM-DD`.
 * @returns The age, or null when the date of birth is unknown or not before the recording.
 */
export function ageOnDate(dateOfBirth: unknown, recordingDate: string): string | null {
  const birth = calendarDay(dateOfBirth);
  const recorded = calendarDay(recordingDate);
  if (birth === null || recorded === null || recorded < birth) return null;
  return `P${Math.round((recorded - birth) / 86_400_000)}D`;
}
