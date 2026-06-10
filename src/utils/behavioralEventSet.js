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
 * Set the event NAME for one hardware channel in a day's behavioral-event set.
 *
 * The DIO editor presents every hardware channel; an event exists only for a NAMED channel. So this
 * helper:
 *  - removes the channel's event when `name` is blank (empty/whitespace) — a blank channel is unused
 *    and is not exported;
 *  - updates the existing event's name in place (preserving its position and any other fields, e.g.
 *    `comments`) when the channel already has one;
 *  - appends a new `{ description, name }` when the channel is being named for the first time.
 *
 * @param {Array<{name: string, description: string}>} events - The current day events.
 * @param {string} description - The hardware channel (e.g. `"Din1"`).
 * @param {string} name - The event name; blank removes the channel.
 * @returns {Array<{name: string, description: string}>} The next day events (a new array).
 */
export function setChannelName(events, description, name) {
  const base = Array.isArray(events) ? events : [];
  const isBlank = typeof name !== 'string' || name.trim() === '';
  if (isBlank) {
    return base.filter((event) => event?.description !== description);
  }
  if (base.some((event) => event?.description === description)) {
    return base.map((event) => (event?.description === description ? { ...event, name } : event));
  }
  return [...base, { description, name }];
}
