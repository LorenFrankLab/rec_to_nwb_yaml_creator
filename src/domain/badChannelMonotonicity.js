/**
 * @fileoverview Bad-channel monotonicity (pure).
 *
 * Bad channels accumulate across a study: a channel that failed on an earlier recording day
 * does not heal on a later one. These pure helpers — shared by the in-context un-mark confirm
 * ({@link DevicesStep}/{@link BadChannelsEditor}) and the export-blocking validation rule
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
 * @param {*} value
 * @returns {boolean}
 */
function isRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

/**
 * A day's off-export acknowledged bad-channel removals (`day.state.badChannelRemovalAcks`),
 * as a shape-safe `{ [ntrodeId: string]: number[] }` record. This data lives ONLY in
 * `day.state` (never read by the export merge), so an ack can clear the export block without
 * altering the exported YAML.
 *
 * @param {object} day - The day record.
 * @returns {Record<string, number[]>} The ack record (`{}` when absent/corrupt).
 */
export function getBadChannelRemovalAcks(day) {
  const state = day?.state;
  if (!isRecord(state)) return {};
  const acks = state.badChannelRemovalAcks;
  return isRecord(acks) ? acks : {};
}

/**
 * Coerce a per-ntrode value to a numeric array (shape-safe). A non-array reads as empty.
 *
 * @param {*} value
 * @returns {number[]}
 */
function asArray(value) {
  return Array.isArray(value) ? value : [];
}

/**
 * The union of effective bad channels marked on EARLIER same-`configurationVersion` days,
 * keyed by ntrode id. Reads each earlier day's day-owned effective set via
 * {@link getDayBadChannelOverrides} — the same set the export merge reads. Days that are later
 * than `day`, on a different config version, or equal to `day` itself are excluded.
 *
 * @param {object} animal - The owning animal (reserved for parity with the rule's signature;
 *   the prior set is derived from `animalDays`).
 * @param {object} day - The day whose prior set is computed (pins `configurationVersion`/`date`).
 * @param {Array} animalDays - The animal's day records.
 * @returns {Record<string, number[]>} `{ [ntrodeId]: sortedUniqueChannels }` — `{}` when none.
 */
export function priorBadChannels(animal, day, animalDays) {
  if (!isRecord(day) || !Array.isArray(animalDays)) return {};
  const version = day.configurationVersion;
  const date = day.date;
  const union = {};
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
      const set = union[ntrodeId] || new Set();
      channels.forEach((ch) => set.add(ch));
      union[ntrodeId] = set;
    }
  }
  // Materialize each Set to a sorted, de-duplicated array.
  return Object.fromEntries(
    Object.entries(union).map(([ntrodeId, set]) => [ntrodeId, Array.from(set).sort((a, b) => a - b)])
  );
}

/**
 * The per-ntrode set of channels that were bad on an EARLIER same-config day but are NOT in
 * this day's effective bad set AND have NOT been acknowledged — i.e. the unacknowledged
 * "un-failings" the export-block rule treats as monotonicity regressions. Empty record = the
 * day is monotonic (or every removal is acknowledged).
 *
 * @param {object} animal - The owning animal.
 * @param {object} day - The day being checked.
 * @param {Array} animalDays - The animal's day records.
 * @returns {Record<string, number[]>} `{ [ntrodeId]: sortedRemovedChannels }` — `{}` when none.
 */
export function badChannelRegressions(animal, day, animalDays) {
  const prior = priorBadChannels(animal, day, animalDays);
  if (Object.keys(prior).length === 0) return {};
  const current = getDayBadChannelOverrides(day);
  const acks = getBadChannelRemovalAcks(day);
  const regressions = {};
  for (const ntrodeId of Object.keys(prior)) {
    const priorSet = prior[ntrodeId];
    const currentSet = new Set(asArray(current[ntrodeId]));
    const ackedSet = new Set(asArray(acks[ntrodeId]));
    const removed = priorSet.filter((ch) => !currentSet.has(ch) && !ackedSet.has(ch));
    if (removed.length > 0) regressions[ntrodeId] = removed;
  }
  return regressions;
}
