/**
 * Rig-constant resolution — the EFFECTIVE per-day recording-system values (`raw_data_to_volts`,
 * `times_period_multiplier`) and how they relate to the animal's CURRENT recording-system default.
 *
 * Extracted from the Day Editor's technical section so the per-animal effective-setup-for-this-day
 * review (Phase 3-5, Task 3.3a) reads the SAME values the Day Editor shows — one derivation. Phase
 * 8.7 Task 4: a day keeps the value copied at creation, so if the default later changed the day
 * legitimately differs — say so honestly, never silently relabel it as "using default".
 *
 * @module domain/rigConstants
 */

/** Fallback rig-constant values (match `createDayRecord`'s seeding fallbacks, not the schema
 *  `default` of 0.0 — these are the app's seeded values). */
export const RIG_FALLBACK = { raw_data_to_volts: 0.195, times_period_multiplier: 1.5 };

/**
 * Resolve a rig constant's EFFECTIVE day value (what export reads) and how it relates to the
 * CURRENT recording-system default.
 *
 * Returns one of three statuses. `'unset'` (defense-in-depth): `createDayRecord` always seeds these,
 * so an absent day value only arises from corrupt/migrated persisted state — and the export reads
 * `day.technical[field]` directly with NO empty-omit guard, so an undefined value fails the schema's
 * required check. Surface that honestly rather than falsely reassuring "using default".
 *
 * @param {object} technical - The day's `technical` block.
 * @param {object} defaults - The animal's `technicalDefaults`.
 * @param {string} field - `'raw_data_to_volts'` | `'times_period_multiplier'`.
 * @returns {{ display: (number|string), status: 'default'|'differs'|'unset', currentDefault: number }}
 */
export function resolveRigConstant(technical, defaults, field) {
  const dayVal = technical?.[field];
  const currentDefault =
    typeof defaults?.[field] === 'number' ? defaults[field] : RIG_FALLBACK[field];
  const hasDay = typeof dayVal === 'number';
  const status = !hasDay ? 'unset' : dayVal === currentDefault ? 'default' : 'differs';
  return { display: hasDay ? dayVal : '—', status, currentDefault };
}
