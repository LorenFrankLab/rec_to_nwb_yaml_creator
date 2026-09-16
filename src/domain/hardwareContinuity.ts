import type { ConfigurationSnapshot } from '../state/workspaceTypes';
import { getProbeElectrodeGroups, getProbeNtrodeMaps } from '../state/workspaceSelectors';

/** Physical identity excludes anatomy and recorded failures; includes acquisition wiring. */
export function hardwareIdentity(devices: unknown): string {
  return JSON.stringify({
    groups: getProbeElectrodeGroups(devices).map((group) => [group.id, group.device_type]),
    maps: getProbeNtrodeMaps(devices).map((map) => [map.ntrode_id, map.electrode_group_id, Object.entries(map.map).sort(([a], [b]) => Number(a) - Number(b))]),
  });
}

/** Follow only explicit same-hardware links; stop at replacements, broken links, or a cycle. */
export function continuesHardware(history: ConfigurationSnapshot[], target: number, source: number): boolean {
  const visited = new Set<number>();
  while (target !== source) {
    if (visited.has(target)) return false;
    visited.add(target);
    const version = target;
    const snapshot = history.find((entry) => entry.version === version);
    const previous = history.find((entry) => entry.version === snapshot?.continuesHardwareFromVersion);
    if (!snapshot || !previous || hardwareIdentity(snapshot.devices) !== hardwareIdentity(previous.devices)) return false;
    target = previous.version;
  }
  return true;
}
