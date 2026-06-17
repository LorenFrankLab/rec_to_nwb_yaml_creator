/**
 * @fileoverview Bad-channel monotonicity (pure).
 *
 * Bad channels accumulate across a study: a channel that failed on an earlier recording day
 * does not heal on a later one. These pure helpers — shared by the in-context un-mark confirm
 * (the Failed channels tab / {@link BadChannelsEditor}) and the export-blocking validation rule
 * ({@link module:domain/validation}) — compute that monotonic contract from a day's own
 * effective bad-channel set and its EARLIER same-configuration siblings.
 *
 * Config-version boundary: a probe reconfiguration legitimately resets channels, so days on a
 * DIFFERENT `configurationVersion` are NEVER compared. The off-export acknowledgment store
 * (`day.state.badChannelRemovalAcks`) lets a deliberate un-mark be recorded without restoring
 * the channel; an acknowledged removal is not a regression.
 *
 * All helpers are shape-safe: corrupt/missing inputs degrade to an empty record, never throw.
 */

import { getDayBadChannelOverrides } from '../state/workspaceSelectors';

/**
 * Whether `value` is a plain object record (not null, not an array).
 *
 * @param value
 * @returns
 */
function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

/**
 * A day's off-export acknowledged bad-channel removals (`day.state.badChannelRemovalAcks`),
 * as a shape-safe `{ [ntrodeId: string]: number[] }` record. This data lives ONLY in
 * `day.state` (never read by the export merge), so an ack can clear the export block without
 * altering the exported YAML.
 *
 * @param day - The day record.
 * @returns The ack record (`{}` when absent/corrupt).
 */
export function getBadChannelRemovalAcks(day: unknown): Record<string, number[]> {
  // `isRecord(day) ? day.state : undefined` is the typed equivalent of the prior `day?.state`
  // (a non-record day yields `undefined` → `{}` either way): `day` is `unknown` here so it
  // can't be optional-chained directly, and the guard narrows it for the `.state` read.
  const state = isRecord(day) ? day.state : undefined;
  if (!isRecord(state)) return {};
  const acks = state.badChannelRemovalAcks;
  // Shape-trust: this is a tolerant reader — it guarantees the record CONTAINER, trusting the
  // per-ntrode values to be number arrays (validation owns element correctness).
  return isRecord(acks) ? (acks as Record<string, number[]>) : {};
}

/**
 * Coerce a per-ntrode value to a numeric array (shape-safe). A non-array reads as empty.
 *
 * @param value
 * @returns
 */
function asArray(value: unknown): number[] {
  return Array.isArray(value) ? value : [];
}

/**
 * The union of effective bad channels marked on EARLIER same-`configurationVersion` days,
 * keyed by ntrode id. Reads each earlier day's day-owned effective set via
 * {@link getDayBadChannelOverrides} — the same set the export merge reads. Days that are later
 * than `day`, on a different config version, or equal to `day` itself are excluded.
 *
 * @param animal - The owning animal (reserved for parity with the rule's signature;
 *   the prior set is derived from `animalDays`).
 * @param day - The day whose prior set is computed (pins `configurationVersion`/`date`).
 * @param animalDays - The animal's day records.
 * @returns `{ [ntrodeId]: sortedUniqueChannels }` — `{}` when none.
 */
export function priorBadChannels(
  animal: unknown,
  day: unknown,
  animalDays: unknown[]
): Record<string, number[]> {
  if (!isRecord(day) || !Array.isArray(animalDays)) return {};
  const version = day.configurationVersion;
  const date = day.date;
  const union: Record<string, Set<number>> = {};
  for (const other of animalDays) {
    if (!isRecord(other)) continue;
    if (other === day || other.id === day.id) continue;
    // Same config version (a reconfiguration resets channels) AND strictly earlier date.
    if (other.configurationVersion !== version) continue;
    if (!(typeof other.date === 'string' && typeof date === 'string' && other.date < date)) continue;
    const overrides = getDayBadChannelOverrides(other);
    for (const ntrodeId of Object.keys(overrides)) {
      const channels = asArray(overrides[ntrodeId]);
      if (channels.length === 0) continue;
      const set = union[ntrodeId] || new Set<number>();
      channels.forEach((ch) => set.add(ch));
      union[ntrodeId] = set;
    }
  }
  // Materialize each Set to a sorted, de-duplicated array.
  return Object.fromEntries(
    Object.entries(union).map(
      ([ntrodeId, set]): [string, number[]] => [ntrodeId, Array.from(set).sort((a, b) => a - b)]
    )
  );
}

/**
 * The per-ntrode set of channels that were bad on an EARLIER same-config day but are NOT in
 * this day's effective bad set AND have NOT been acknowledged — i.e. the unacknowledged
 * "un-failings" the export-block rule treats as monotonicity regressions. Empty record = the
 * day is monotonic (or every removal is acknowledged).
 *
 * @param animal - The owning animal.
 * @param day - The day being checked.
 * @param animalDays - The animal's day records.
 * @returns `{ [ntrodeId]: sortedRemovedChannels }` — `{}` when none.
 */
export function badChannelRegressions(
  animal: unknown,
  day: unknown,
  animalDays: unknown[]
): Record<string, number[]> {
  const prior = priorBadChannels(animal, day, animalDays);
  if (Object.keys(prior).length === 0) return {};
  const current = getDayBadChannelOverrides(day);
  const acks = getBadChannelRemovalAcks(day);
  const regressions: Record<string, number[]> = {};
  for (const ntrodeId of Object.keys(prior)) {
    const priorSet = prior[ntrodeId];
    const currentSet = new Set(asArray(current[ntrodeId]));
    const ackedSet = new Set(asArray(acks[ntrodeId]));
    const removed = priorSet.filter((ch) => !currentSet.has(ch) && !ackedSet.has(ch));
    if (removed.length > 0) regressions[ntrodeId] = removed;
  }
  return regressions;
}
