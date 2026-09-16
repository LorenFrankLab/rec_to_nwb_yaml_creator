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

import type { TechnicalParameters, TechnicalDefaults } from '../state/workspaceTypes';
import type { RepairableIssue } from './repairRouting';

/** The rig-constant fields this module resolves. */
export type RigField = 'raw_data_to_volts' | 'times_period_multiplier';

/** Fallback rig-constant values (match `createDayRecord`'s seeding fallbacks, not the schema
 *  `default` of 0.0 — these are the app's seeded values). */
export const RIG_FALLBACK: Record<RigField, number> = {
  raw_data_to_volts: 1.95e-7,
  times_period_multiplier: 1.5,
};

/** Flag the former app default without silently rescaling imported scientific data. */
export function suspiciousVoltageIssues(model: { raw_data_to_volts?: unknown }): RepairableIssue[] {
  return model.raw_data_to_volts === 0.195 ? [{
    code: 'voltage_units_review', severity: 'warning', repairSurface: 'day', step: 'devices',
    path: 'raw_data_to_volts', focusPath: 'technical.raw_data_to_volts',
    actionLabel: 'Review voltage units',
    message: 'Voltage conversion is 0.195 V/count, the former app default. If the intended scale is 0.195 µV/count, use 1.95e-7 V/count. Verify the recording header: metadata is the fallback when rawScalingToUv is absent.',
  }] : [];
}

/**
 * Resolve a rig constant's EFFECTIVE day value (what export reads) and how it relates to the
 * CURRENT recording-system default.
 *
 * Returns one of three statuses. `'unset'` (defense-in-depth): `createDayRecord` always seeds these,
 * so an absent day value only arises from corrupt/migrated persisted state — and the export reads
 * `day.technical[field]` directly with NO empty-omit guard, so an undefined value fails the schema's
 * required check. Surface that honestly rather than falsely reassuring "using default".
 *
 * @param technical - The day's `technical` block.
 * @param defaults - The animal's `technicalDefaults`.
 * @param field - `'raw_data_to_volts'` | `'times_period_multiplier'`.
 * @returns The effective day value (`display`), its relation to the current default (`status`),
 *   and that `currentDefault`.
 */
export function resolveRigConstant(
  technical: Partial<TechnicalParameters> | null | undefined,
  defaults: Partial<TechnicalDefaults> | null | undefined,
  field: RigField
): { display: number | string; status: 'default' | 'differs' | 'unset'; currentDefault: number } {
  const dayVal = technical?.[field];
  const defaultVal = defaults?.[field];
  const currentDefault = typeof defaultVal === 'number' ? defaultVal : RIG_FALLBACK[field];
  const hasDay = typeof dayVal === 'number';
  const status = !hasDay ? 'unset' : dayVal === currentDefault ? 'default' : 'differs';
  return { display: typeof dayVal === 'number' ? dayVal : '—', status, currentDefault };
}
