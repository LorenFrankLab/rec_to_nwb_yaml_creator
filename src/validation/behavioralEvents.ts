/**
 * @fileoverview Shared behavioral-event description collision detection (Phase 8.7 Task 6 review fix).
 *
 * trodes_to_nwb (`convert_dios`) keys DIO channels by `behavioral_events[].description` and raises a
 * `ValueError` on a duplicate. The export-blocking `duplicate_behavioral_event_description` rule and
 * the inline day-event gate must agree on what "the same description" means, so both use this one
 * helper. Descriptions are compared as RAW strings (no trim) — exactly as the converter keys them, so
 * `"x"` and `"x "` are DIFFERENT (not a collision) and a whitespace-only `"  "` IS a real value.
 */

/**
 * The set of descriptions used by more than one behavioral event. Raw-string compare; skips only an
 * absent description (undefined/null/'' — a blank description is not a collision). Shape-tolerant.
 *
 * @param events - Behavioral events (the exported day list).
 * @returns Descriptions appearing on ≥2 events.
 */
export function duplicateBehavioralEventDescriptions(events: unknown): Set<string> {
  const counts = new Map<string, number>();
  (Array.isArray(events) ? events : []).forEach((event) => {
    const desc = event?.description;
    if (desc === undefined || desc === null || desc === '') return;
    counts.set(desc, (counts.get(desc) || 0) + 1);
  });
  return new Set([...counts.entries()].filter(([, count]) => count > 1).map(([desc]) => desc));
}

/**
 * The set of NAMES used by more than one behavioral event (the `dio_event_name` collision that
 * violates Spyglass's `DIOEvents` primary key and trodes_to_nwb). Raw-string compare; skips a blank
 * name (empty/whitespace-only) — a blank channel is unused and excluded from export, so it is not a
 * collision. Shared by the inline grid gate and the export rule (Rule 14) so they can never diverge.
 *
 * @param events - Behavioral events (the exported day list).
 * @returns Names appearing on ≥2 events.
 */
export function duplicateBehavioralEventNames(events: unknown): Set<string> {
  const counts = new Map<string, number>();
  (Array.isArray(events) ? events : []).forEach((event) => {
    const name = event?.name;
    if (typeof name !== 'string' || name.trim() === '') return;
    counts.set(name, (counts.get(name) || 0) + 1);
  });
  return new Set([...counts.entries()].filter(([, count]) => count > 1).map(([name]) => name));
}
