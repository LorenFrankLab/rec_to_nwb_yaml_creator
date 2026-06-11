/**
 * @fileoverview Shared device-override merge: the single owner of the
 * override > snapshot resolution AND the matching "can this override be honored cleanly?"
 * shape classification.
 *
 * A recording day may carry `day.deviceOverrides` that shadow its pinned configuration
 * snapshot. Two consumers read that override and MUST agree on what each shape means:
 *   - `resolveDayConfig` (state/workspaceUtils.js) — the export path: applies the override
 *     over the snapshot, failing OPEN (falling back to the snapshot) on anything malformed.
 *   - `dayOverrideIssues` (domain/validation.js) — the validator: surfaces every shape the
 *     merge cannot honor cleanly as a day-routed, repairable, export-blocking issue.
 *
 * These were previously coupled "by comment only" — two inline copies of the same predicates
 * that had to be kept in lockstep by hand. Centralizing the predicates (`classifyGeometryOverride`,
 * `classifyBadChannelsContainer`) and the resolution (`resolveEffectiveDevices`) here makes that
 * lockstep structural: whatever the merge fails open on is exactly what the validator surfaces.
 *
 * Pure and dependency-free (snapshot devices are passed in), so it carries no import-cycle or
 * layering risk and is exhaustively unit-testable.
 */

/**
 * Whether `value` is a plain object record (not null, not an array). The shared predicate the
 * merge uses to decide a bad-channels container is an `ntrode_id → list` map vs. a scalar/array.
 */
export function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

/**
 * Read `value?.[key]` for an `unknown` value without throwing — mirrors the optional-chaining
 * reads the inline merge used (a scalar/array `deviceOverrides` yields `undefined` for a missing
 * key, never an error), so the resolution stays byte-identical for a corrupt container.
 */
function readProp(value: unknown, key: string): unknown {
  if (value == null) return undefined;
  return (value as Record<string, unknown>)[key];
}

/** How the merge treats a geometry override (`electrode_groups` / ntrode map). */
export type GeometryOverrideKind = 'absent' | 'array' | 'malformed';

/**
 * Classify a geometry override value:
 *   - `absent`    — null/undefined: the merge uses the snapshot; no issue.
 *   - `array`     — a well-formed array: the merge honors it (it SHADOWS the snapshot).
 *   - `malformed` — present but not an array: the merge falls back to the snapshot, which would
 *     hide the corruption — so the validator surfaces it.
 */
export function classifyGeometryOverride(value: unknown): GeometryOverrideKind {
  if (value == null) return 'absent';
  return Array.isArray(value) ? 'array' : 'malformed';
}

/** How the merge treats the `bad_channels` container. */
export type BadChannelsContainerKind = 'absent' | 'record' | 'malformed';

/**
 * Classify a `bad_channels` container:
 *   - `absent`    — null/undefined: nothing to apply.
 *   - `record`    — an `ntrode_id → list` map (incl. empty): the merge resolves it per ntrode.
 *   - `malformed` — present but a scalar/array: the merge ignores it entirely, so the validator
 *     surfaces it.
 */
export function classifyBadChannelsContainer(value: unknown): BadChannelsContainerKind {
  if (value == null) return 'absent';
  return isPlainRecord(value) ? 'record' : 'malformed';
}

/** Input to {@link resolveEffectiveDevices}. */
export interface ResolveEffectiveDevicesInput {
  /** The raw `day.deviceOverrides` (any shape — corrupt values are tolerated). */
  deviceOverrides: unknown;
  /** The pinned snapshot's electrode groups (the fallback geometry). */
  snapshotElectrodeGroups: unknown;
  /** The pinned snapshot's ntrode channel maps (the fallback geometry). */
  snapshotNtrodes: unknown;
}

/** The geometry a day effectively resolves to, before normalization. */
export interface EffectiveDevices {
  /** The override array when well-formed, else the snapshot electrode groups. */
  electrodeGroups: unknown;
  /** The resolved ntrode rows, each with effective `bad_channels` applied (always an array). */
  ntrodes: Array<Record<string, unknown>>;
}

/**
 * Resolve a day's effective electrode geometry and per-ntrode failed channels by layering its
 * `deviceOverrides` over the pinned snapshot. The single source of the precedence rule shared by
 * the export merge and the validator:
 *   - geometry (`electrode_groups` / ntrode map): a well-formed array override SHADOWS the
 *     snapshot; anything else falls back to the snapshot;
 *   - each ntrode's `bad_channels`: taken from `deviceOverrides.bad_channels[ntrode_id]` ONLY,
 *     when that container is a record and the value is an array — otherwise `[]` (the snapshot
 *     base is NEVER read here; a corrupt value is resolved to `[]`, never smeared onto the row).
 *
 * The returned arrays are owned copies-by-spread of the rows (with a fresh `bad_channels` array),
 * matching the prior inline behavior so callers' downstream normalization is byte-identical.
 *
 * @param input - The raw overrides plus the snapshot fallbacks.
 * @param input.deviceOverrides - The raw `day.deviceOverrides` (any shape).
 * @param input.snapshotElectrodeGroups - The pinned snapshot's electrode groups (fallback).
 * @param input.snapshotNtrodes - The pinned snapshot's ntrode channel maps (fallback).
 * @returns The effective geometry the day exports against (pre-normalization).
 */
export function resolveEffectiveDevices({
  deviceOverrides,
  snapshotElectrodeGroups,
  snapshotNtrodes,
}: ResolveEffectiveDevicesInput): EffectiveDevices {
  const electrodeGroupsOverride = readProp(deviceOverrides, 'electrode_groups');
  const ntrodeOverride = readProp(deviceOverrides, 'ntrode_electrode_group_channel_map');
  const badChannels = readProp(deviceOverrides, 'bad_channels');

  const electrodeGroups =
    classifyGeometryOverride(electrodeGroupsOverride) === 'array'
      ? electrodeGroupsOverride
      : snapshotElectrodeGroups;
  const baseNtrodes =
    classifyGeometryOverride(ntrodeOverride) === 'array' ? ntrodeOverride : snapshotNtrodes;

  const badChannelsIsRecord = classifyBadChannelsContainer(badChannels) === 'record';
  const baseArray: unknown[] = Array.isArray(baseNtrodes) ? baseNtrodes : [];
  const ntrodes = baseArray.map((row) => {
    const ntrode = row as Record<string, unknown>;
    const override = badChannelsIsRecord
      ? (badChannels as Record<string, unknown>)[String(ntrode.ntrode_id)]
      : undefined;
    return { ...ntrode, bad_channels: Array.isArray(override) ? [...override] : [] };
  });

  return { electrodeGroups, ntrodes };
}
