/**
 * Pure authoring helpers for a recording day's behavioral-event (DIO) set. The set is the flat
 * `day.behavioral_events` array of `{ name, description }`; these helpers support two authoring
 * conveniences without changing the exported shape:
 *
 *  - per-label auto-numbering when a known event name is PICKED from the suggestions
 *    ({@link nextInstanceNumber}), and
 *  - bulk-applying a standard-set template into the day set ({@link mergeTemplateRows}).
 *
 * Both honour the load-bearing naming convention (`Label<n>`, no separator; the number is a
 * per-label instance count, never the DIO channel index) and the two export gates: name uniqueness
 * and description uniqueness.
 */

/**
 * Escape a string for safe interpolation into a `RegExp` source (treat metacharacters literally).
 *
 * @param {string} text - The raw string.
 * @returns {string} The escaped string.
 */
const escapeRegExp = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * The next per-label instance number for auto-numbering a picked event name.
 *
 * Returns one beyond the highest existing instance of `label` (e.g. `Poke` → 2 when `Poke1`
 * exists), so picking the same label twice yields `Poke1` then `Poke2`. Counting is per label and
 * derived ONLY from the names — never from a DIO channel index — and uses the no-separator
 * `Label<digits>` form. Using the max (not the count) keeps the result collision-free even when the
 * existing instances have a gap (`Poke1`, `Poke3` → 4, not 3).
 *
 * @param {string} label - The picked event label (e.g. `"Poke"`).
 * @param {Array<{name?: string}>} events - The current day events.
 * @returns {number} The next instance number (≥ 1).
 */
export function nextInstanceNumber(label, events) {
  const re = new RegExp(`^${escapeRegExp(label)}(\\d+)$`);
  const used = (Array.isArray(events) ? events : [])
    .map((event) => Number(re.exec(event?.name ?? '')?.[1]))
    .filter(Number.isFinite);
  return used.length ? Math.max(...used) + 1 : 1;
}

/**
 * Whether `name` is a "standard" behavioral-event name for off-list nudging: an exact
 * (case-insensitive) match to a suggested label, OR a numbered instance of one — the no-separator
 * `Label<n>` convention the picker auto-generates and the templates emit (e.g. "Poke1" for "Poke").
 * Without this, the off-list nudge would fire on the app's OWN generated names. An empty/whitespace
 * name is treated as standard here (it is gated separately as "required", not nudged as off-list).
 *
 * @param {string} name - The event name to test.
 * @param {string[]} suggestions - The standard event-name labels.
 * @returns {boolean} True when the name is a standard label or a numbered variant of one.
 */
export function isStandardEventName(name, suggestions) {
  const value = (name ?? '').trim().toLowerCase();
  if (value === '') return true;
  return (Array.isArray(suggestions) ? suggestions : []).some((suggestion) => {
    const label = String(suggestion).toLowerCase();
    return value === label || new RegExp(`^${escapeRegExp(label)}\\d+$`).test(value);
  });
}

/**
 * Merge a standard-set template's rows into a day's behavioral-event set.
 *
 * A row is added only if neither its `name` nor its `description` already appears in the set (or
 * earlier in the same batch); otherwise it is skipped. This makes applying a template idempotent
 * and structurally unable to introduce a duplicate `name` (Rule 14) or duplicate `description`
 * (Rule 17) — applying into a non-empty day, or re-applying the same template, never collides.
 *
 * @param {Array<{name: string, description: string}>} existing - The current day events.
 * @param {Array<{name: string, description: string}>} rows - The template rows to merge in.
 * @returns {{merged: Array<{name: string, description: string}>, added: Array, skipped: Array}}
 *   The resulting set plus the rows that were added vs skipped (for an inline summary).
 */
export function mergeTemplateRows(existing, rows) {
  const base = Array.isArray(existing) ? existing : [];
  const names = new Set(base.map((event) => event?.name));
  const descriptions = new Set(base.map((event) => event?.description));
  const added = [];
  const skipped = [];
  (Array.isArray(rows) ? rows : []).forEach((row) => {
    if (names.has(row.name) || descriptions.has(row.description)) {
      skipped.push(row);
      return;
    }
    added.push(row);
    names.add(row.name);
    descriptions.add(row.description);
  });
  return { merged: [...base, ...added], added, skipped };
}
