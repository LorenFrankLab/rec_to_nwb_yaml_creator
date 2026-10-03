/**
 * @fileoverview The animal's editable setup as a mirror of its current configuration.
 *
 * `animal.devices` (electrode groups + channel maps) is what Animal Setup shows and edits, and an
 * edit is written back over the LAST configuration snapshot (`applyAnimalUpdates`). Every current
 * write keeps the two equal: setup edits mirror forward, a reconfiguration copies the new snapshot
 * into the setup, and an import mirrors its last version. The old import code left them apart: it
 * seeded the setup from the EARLIEST file and appended later versions without mirroring, so the
 * editor showed an earlier version while an edit overwrote the last one.
 *
 * {@link resyncSetupMirrors} repairs exactly that leftover: a setup that is a copy of an EARLIER
 * snapshot (so nothing in it is lost) while the last snapshot holds other geometry. A setup that
 * matches no snapshot is left alone: data saved before setup edits were mirrored (2026-06-04) can
 * hold edits that reached no snapshot. The export reads snapshots, never `animal.devices`, so no
 * export changes. Pure.
 */

import { canonicalJson } from '../utils/canonicalJson';
import { normalizeProbeConfigDevices } from '../utils/deviceNormalization';
import {
  getAnimalDevices,
  getConfigHistory,
  getProbeElectrodeGroups,
  getProbeNtrodeMaps,
} from './workspaceSelectors';

/**
 * A probe configuration's identity: everything the export emits for its electrode groups and
 * channel maps (normalized), without the day-owned failed-channel marks.
 *
 * @param devices - A probe configuration (`{ electrode_groups, ntrode_electrode_group_channel_map }`).
 * @returns A key that is equal for configurations that export identically.
 */
export function probeGeometryKey(devices: unknown): string {
  const probe = normalizeProbeConfigDevices(devices);
  return canonicalJson({
    electrode_groups: probe.electrode_groups,
    ntrode_electrode_group_channel_map: probe.ntrode_electrode_group_channel_map.map((map) => ({
      ...map,
      bad_channels: [],
    })),
  });
}

const isPlainRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value);

/**
 * Re-mirror each animal's last configuration snapshot into its editable setup where the setup is a
 * stale copy of an earlier snapshot (see the file overview).
 *
 * @param workspace - A device-normalized workspace.
 * @returns The workspace (the same object when nothing changed) and the animals re-mirrored.
 */
export function resyncSetupMirrors(workspace: Record<string, unknown>): {
  workspace: Record<string, unknown>;
  resynced: string[];
} {
  const animals = workspace.animals;
  if (!isPlainRecord(animals)) return { workspace, resynced: [] };
  const resynced: string[] = [];
  const nextAnimals: Record<string, unknown> = { ...animals };
  for (const [animalId, animal] of Object.entries(animals)) {
    if (!isPlainRecord(animal)) continue;
    const last = getConfigHistory(animal).slice(-1)[0];
    if (!last || !isPlainRecord(last.devices)) continue;
    const devices = getAnimalDevices(animal);
    const setupKey = probeGeometryKey(devices);
    const lastHasGeometry =
      getProbeElectrodeGroups(last.devices).length > 0 || getProbeNtrodeMaps(last.devices).length > 0;
    const copiesEarlierSnapshot = getConfigHistory(animal)
      .slice(0, -1)
      .some((snapshot) => probeGeometryKey(snapshot.devices) === setupKey);
    if (setupKey === probeGeometryKey(last.devices) || !lastHasGeometry || !copiesEarlierSnapshot) {
      continue;
    }
    // The reverse of the forward mirror in `applyAnimalUpdates` (which copies these two arrays
    // into the last snapshot verbatim).
    nextAnimals[animalId] = {
      ...animal,
      devices: {
        ...(isPlainRecord(animal.devices) ? animal.devices : devices),
        electrode_groups: structuredClone(getProbeElectrodeGroups(last.devices)),
        ntrode_electrode_group_channel_map: structuredClone(getProbeNtrodeMaps(last.devices)),
      },
    };
    resynced.push(animalId);
  }
  return resynced.length > 0
    ? { workspace: { ...workspace, animals: nextAnimals }, resynced }
    : { workspace, resynced };
}
