/**
 * Pure authoring helpers for a recording day's behavioral-event (DIO) set. The set is the flat
 * `day.behavioral_events` array of `{ name, description }`; these helpers drive the channel grid
 * without changing the exported shape:
 *
 *  - {@link nextInstanceNumber} — per-label auto-numbering when a known event name is PICKED from
 *    the suggestions (`Poke` → `Poke1`/`Poke2`/…);
 *  - {@link isStandardEventName} — whether a name is a standard label or a numbered variant (for the
 *    off-list nudge), so the picker's own output isn't flagged; and
 *  - {@link setChannelName} — name a channel (add / update-in-place / blank removes).
 *
 * Naming follows the load-bearing convention (`Label<n>`, no separator; the number is a per-label
 * instance count, never the DIO channel index). The number is chosen to avoid tripping the export
 * gates (unique name, unique description), which are enforced separately in
 * `validation/behavioralEvents.js`.
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
 * `Label<n>` convention the picker auto-generates (e.g. "Poke1" for "Poke").
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
  // Act on a SINGLE event (the first on this channel), never on "all rows with this description":
  // a corrupt duplicate-description import must not lose its hidden sibling when the visible row is
  // cleared. Each edit then surfaces the next event, so the user removes them one visible step at a
  // time rather than both at once.
  const index = base.findIndex((event) => event?.description === description);
  const isBlank = typeof name !== 'string' || name.trim() === '';
  if (index === -1) {
    return isBlank ? base : [...base, { description, name }];
  }
  if (isBlank) {
    return [...base.slice(0, index), ...base.slice(index + 1)];
  }
  return base.map((event, i) => (i === index ? { ...event, name } : event));
}
