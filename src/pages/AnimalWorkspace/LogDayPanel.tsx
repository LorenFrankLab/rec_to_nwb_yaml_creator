import type { ReactNode } from 'react';
import { useMemo, useState } from 'react';
import { getCurrentDate } from '../../state/workspaceUtils';
import { selectConfigurationForDate } from '../../domain/configurationSelection';
import { nearestEarlierDayId, nearestLaterDayId } from '../../domain/dayCarryPolicy';
import Button from '../../components/ui/Button';
import styles from './LogDayPanel.module.css';

interface LogDayPanelProps {
  /** The animal (its configuration history drives the setup preview). */
  animal: unknown;
  /** The workspace days map (the carry-source preview). */
  days: Record<string, unknown>;
  /** The animal id (day ids are `${animalId}-${date}`). */
  animalId: string;
  /** ISO dates of the animal's existing days (to tell "open" from "create"). */
  existingDates: string[];
  /** Whether new days start from the nearest earlier day (the carry-forward toggle). */
  carryForward: boolean;
  /** Create a day for `date` (with the carry policy) and open it; or just open an existing one. */
  onLogDate: (date: string) => void;
  options?: ReactNode;
}

/** ISO date → "Jun 22, 2023" (locale-independent month names, deterministic). */
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
export function formatShortDate(iso: string | null | undefined): string {
  if (!iso || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return String(iso ?? '');
  const [y, m, d] = iso.split('-');
  return `${MONTHS[Number(m) - 1]} ${Number(d)}, ${y}`;
}

/**
 * LogDayPanel — the routine entry point on the animal page: **Log today**, **Choose recording
 * date** (typed directly, no month paging), and a preview of what the new day will start from —
 * the nearest earlier day (never a later one) and the probe setup effective on that date — so a
 * backfill is as safe as today's entry. Creating opens the day directly.
 */
export default function LogDayPanel({
  animal,
  days,
  animalId,
  existingDates,
  carryForward,
  onLogDate,
  options,
}: LogDayPanelProps) {
  const today = getCurrentDate();
  const [date, setDate] = useState('');
  const existing = useMemo(() => new Set(existingDates), [existingDates]);
  const todayExists = existing.has(today);

  const preview = useMemo(() => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
    const setup = selectConfigurationForDate(animal, date);
    const earlierId = carryForward ? nearestEarlierDayId(animal, days, date) : null;
    const laterId = carryForward && !earlierId ? nearestLaterDayId(animal, days, date) : null;
    const earlierDate = earlierId ? String((days[earlierId] as { date?: unknown })?.date ?? '') : null;
    const laterDate = laterId ? String((days[laterId] as { date?: unknown })?.date ?? '') : null;
    return { setup, earlierDate, laterDate, exists: existing.has(date) };
  }, [animal, days, date, carryForward, existing]);

  return (
    <section className={styles.panel} aria-labelledby="log-day-heading">
      <h3 id="log-day-heading" className="visually-hidden">
        Log a recording day
      </h3>
      <div className={styles.row}>
        <Button variant="primary" onClick={() => onLogDate(today)}>
          {todayExists ? `Open today’s day (${formatShortDate(today)})` : `Log today (${formatShortDate(today)})`}
        </Button>
        <form
          className={styles.dateForm}
          onSubmit={(e) => {
            e.preventDefault();
            if (/^\d{4}-\d{2}-\d{2}$/.test(date)) onLogDate(date);
          }}
        >
          <label htmlFor="log-day-date" className={styles.dateLabel}>
            Choose recording date
          </label>
          <input
            id="log-day-date"
            type="date"
            className={styles.dateInput}
            value={date}
            max="2100-12-31"
            onChange={(e) => setDate(e.target.value)}
            aria-describedby="log-day-preview"
          />
          <Button variant="secondary" type="submit" disabled={!preview}>
            {preview?.exists ? 'Open' : 'Create & open'}
          </Button>
        </form>
      </div>
      <p id="log-day-preview" className={styles.preview} aria-live="polite">
        {preview ? (
          preview.exists ? (
            <>A day for {formatShortDate(date)} already exists — it will open.</>
          ) : (
            <>
              {formatShortDate(date)} will start{' '}
              {preview.earlierDate ? (
                <>from <strong>{formatShortDate(preview.earlierDate)}</strong> (the nearest earlier day)</>
              ) : preview.laterDate ? (
                <>blank — no earlier day exists (the nearest later day is {formatShortDate(preview.laterDate)}; you can copy from it inside the day)</>
              ) : (
                <>blank</>
              )}
              {preview.setup.version != null ? (
                <>
                  {' '}· probe setup <strong>v{preview.setup.version}</strong>
                  {preview.setup.effectiveDate ? ` (effective ${formatShortDate(preview.setup.effectiveDate)})` : ''}
                  {!preview.setup.covered && (
                    <span className={styles.warn}>
                      {' '}— that setup became effective later, so you will be asked to confirm it applies
                    </span>
                  )}
                </>
              ) : (
                <> · no probe setup yet (a behavior-only day is fine)</>
              )}
              .
            </>
          )
        ) : (
          existingDates.length === 0 ? <>Choose the recording date, even when entering metadata later.</> : null
        )}
      </p>
      <div className={styles.options}>{options}</div>
    </section>
  );
}
