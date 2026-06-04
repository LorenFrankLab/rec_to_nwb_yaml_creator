/**
 * @fileoverview Pure utilities for diffing probe configurations and reconciling
 * which days use each configuration snapshot.
 *
 * These functions never touch the store. They diff/derive from plain
 * {@link import('./workspaceTypes').ProbeConfiguration} and day data so the
 * reconfiguration wizard can render a deterministic, structured view of what
 * changed between two configurations.
 *
 * @module state/configDiff
 */

import { resolveDayConfig } from './workspaceUtils';

// Re-export so wizard/UI code has a single import surface for config resolution.
export { resolveDayConfig };

/**
 * Order-independent structural stringify (object keys sorted; array order kept).
 * Used for deep equality of scalar/`map` fields without depending on key order.
 *
 * @param {*} value - Any JSON-serializable value.
 * @returns {string}
 */
function stableStringify(value) {
  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(',')}]`;
  }
  if (value && typeof value === 'object') {
    return `{${Object.keys(value)
      .sort()
      .map((k) => `${JSON.stringify(k)}:${stableStringify(value[k])}`)
      .join(',')}}`;
  }
  return JSON.stringify(value) ?? 'null';
}

const deepEqual = (a, b) => stableStringify(a) === stableStringify(b);

/**
 * Set-wise equality (ignores order and duplicates). Used for `bad_channels`.
 *
 * @param {Array} [a] - First list.
 * @param {Array} [b] - Second list.
 * @returns {boolean}
 */
function setEqual(a = [], b = []) {
  const sa = new Set(a);
  const sb = new Set(b);
  if (sa.size !== sb.size) return false;
  for (const x of sa) {
    if (!sb.has(x)) return false;
  }
  return true;
}

const byId = (a, b) => a.id - b.id;
const byNtrodeId = (a, b) => a.ntrode_id - b.ntrode_id;

/**
 * Diff two probe configurations into a structured, serializable, deterministic
 * result. Electrode groups are matched by `id`, ntrodes by `ntrode_id`; matching is
 * order-independent and all output arrays are sorted (by id / ntrode_id) so the
 * diff renders the same regardless of input order.
 *
 * `hasChanges` is always derived: true iff any add/remove/changed array is non-empty.
 *
 * @param {import('./workspaceTypes').ProbeConfiguration} prevConfig - Earlier config.
 * @param {import('./workspaceTypes').ProbeConfiguration} nextConfig - Later config.
 * @returns {import('./workspaceTypes').ProbeConfigDiff} The structured, sorted diff.
 */
export function diffProbeConfigs(prevConfig, nextConfig) {
  const prevGroups = prevConfig?.electrode_groups || [];
  const nextGroups = nextConfig?.electrode_groups || [];
  const prevNtrodes = prevConfig?.ntrode_electrode_group_channel_map || [];
  const nextNtrodes = nextConfig?.ntrode_electrode_group_channel_map || [];

  const prevGroupById = new Map(prevGroups.map((g) => [g.id, g]));
  const nextGroupById = new Map(nextGroups.map((g) => [g.id, g]));

  const groupsAdded = nextGroups.filter((g) => !prevGroupById.has(g.id)).sort(byId);
  const groupsRemoved = prevGroups.filter((g) => !nextGroupById.has(g.id)).sort(byId);
  const groupsChanged = [];
  for (const before of prevGroups) {
    const after = nextGroupById.get(before.id);
    if (!after) continue;
    const fields = [...new Set([...Object.keys(before), ...Object.keys(after)])]
      .filter((k) => !deepEqual(before[k], after[k]))
      .sort();
    if (fields.length > 0) {
      groupsChanged.push({ id: before.id, fields, before, after });
    }
  }
  groupsChanged.sort(byId);

  const prevNtrodeById = new Map(prevNtrodes.map((n) => [n.ntrode_id, n]));
  const nextNtrodeById = new Map(nextNtrodes.map((n) => [n.ntrode_id, n]));

  const ntrodesAdded = nextNtrodes.filter((n) => !prevNtrodeById.has(n.ntrode_id)).sort(byNtrodeId);
  const ntrodesRemoved = prevNtrodes.filter((n) => !nextNtrodeById.has(n.ntrode_id)).sort(byNtrodeId);
  const ntrodesChanged = [];
  for (const before of prevNtrodes) {
    const after = nextNtrodeById.get(before.ntrode_id);
    if (!after) continue;
    const mapChanged = !deepEqual(before.map, after.map);
    const badChannelsChanged = !setEqual(before.bad_channels, after.bad_channels);
    if (mapChanged || badChannelsChanged) {
      ntrodesChanged.push({
        ntrode_id: before.ntrode_id,
        electrode_group_id: after.electrode_group_id,
        mapChanged,
        badChannelsChanged,
        before,
        after,
      });
    }
  }
  ntrodesChanged.sort(byNtrodeId);

  const hasChanges =
    groupsAdded.length > 0 ||
    groupsRemoved.length > 0 ||
    groupsChanged.length > 0 ||
    ntrodesAdded.length > 0 ||
    ntrodesRemoved.length > 0 ||
    ntrodesChanged.length > 0;

  return {
    electrodeGroups: { added: groupsAdded, removed: groupsRemoved, changed: groupsChanged },
    channelMaps: { added: ntrodesAdded, removed: ntrodesRemoved, changed: ntrodesChanged },
    hasChanges,
  };
}

/**
 * Derive, purely from the days' current `configurationVersion`, which day ids use
 * each configuration snapshot. This is the authoritative usage view for the UI —
 * it ignores any stale stored `appliedToDays` lists.
 *
 * @param {import('./workspaceTypes').Animal} animal - Animal with `configurationHistory` + `days`.
 * @param {Record<string, import('./workspaceTypes').Day>} daysById - Workspace day lookup.
 * @returns {Record<number, string[]>} Map of snapshot version → day ids using it.
 */
export function reconcileAppliedToDays(animal, daysById) {
  const byVersion = {};
  for (const snapshot of animal.configurationHistory || []) {
    byVersion[snapshot.version] = [];
  }
  for (const dayId of animal.days || []) {
    const day = daysById?.[dayId];
    if (!day) continue;
    const version = day.configurationVersion;
    if (!byVersion[version]) byVersion[version] = [];
    byVersion[version].push(dayId);
  }
  return byVersion;
}
