/**
 * Probe Metadata Catalog — converter-truth source for probe geometry.
 *
 * The trodes_to_nwb probe metadata is the SOURCE OF TRUTH for how a probe's
 * electrodes partition across shanks. This catalog encodes the VERIFIED per-shank
 * electrode-id partition for every supported probe (transcribed from trodes_to_nwb
 * source), so the app generates converter-valid channel maps for every probe — or
 * makes a probe explicitly unexportable if its catalog entry is inconsistent.
 *
 * CRITICAL: `map` VALUES are probe *electrode ids*, reset per electrode group, and
 * for multi-shank probes the ids are partitioned across shanks (a 4-shank 128c
 * probe is 0..31 / 32..63 / 64..95 / 96..127, NOT 0..31 four times). The 64c-3s
 * probe partitions its 64 electrodes UNEVENLY across 3 shanks (21/21/22) — the old
 * length-math assumed 20/20/20 and silently dropped electrode ids 60–63.
 *
 * @module probeCatalog
 */

/**
 * Inclusive integer range [start, end].
 * @param {number} start
 * @param {number} end
 * @returns {number[]}
 */
function range(start, end) {
  return Array.from({ length: end - start + 1 }, (_, i) => start + i);
}

/**
 * Build a catalog entry from an array of per-shank electrode-id arrays.
 * @param {string} probeType
 * @param {number[][]} shankIdArrays
 * @returns {{ probe_type: string, num_shanks: number, shanks: Array<{shank_id: number, electrodeIds: number[]}> }}
 */
function entry(probeType, shankIdArrays) {
  return {
    probe_type: probeType,
    num_shanks: shankIdArrays.length,
    shanks: shankIdArrays.map((electrodeIds, shank_id) => ({
      shank_id,
      electrodeIds,
    })),
  };
}

// The standard 4-shank 128-channel partition shared by every 128c-4s variant.
const FOUR_SHANK_128 = [range(0, 31), range(32, 63), range(64, 95), range(96, 127)];

/**
 * VERIFIED per-shank electrode-id catalog (from trodes_to_nwb source).
 * @private
 */
const PROBE_CATALOG = {
  'tetrode_12.5': entry('tetrode_12.5', [[0, 1, 2, 3]]),
  'A1x32-6mm-50-177-H32_21mm': entry('A1x32-6mm-50-177-H32_21mm', [range(0, 31)]),
  '128c-4s4mm6cm-15um-26um-sl': entry('128c-4s4mm6cm-15um-26um-sl', FOUR_SHANK_128),
  '128c-4s4mm6cm-20um-40um-sl': entry('128c-4s4mm6cm-20um-40um-sl', FOUR_SHANK_128),
  '128c-4s6mm6cm-15um-26um-sl': entry('128c-4s6mm6cm-15um-26um-sl', FOUR_SHANK_128),
  '128c-4s6mm6cm-20um-40um-sl': entry('128c-4s6mm6cm-20um-40um-sl', FOUR_SHANK_128),
  '128c-4s8mm6cm-15um-26um-sl': entry('128c-4s8mm6cm-15um-26um-sl', FOUR_SHANK_128),
  '128c-4s8mm6cm-20um-40um-sl': entry('128c-4s8mm6cm-20um-40um-sl', FOUR_SHANK_128),
  '32c-2s8mm6cm-20um-40um-dl': entry('32c-2s8mm6cm-20um-40um-dl', [range(0, 15), range(16, 31)]),
  // UNEVEN: trodes_to_nwb partitions 64 electrodes 21/21/22 across 3 shanks.
  '64c-3s6mm6cm-20um-40um-sl': entry('64c-3s6mm6cm-20um-40um-sl', [
    range(0, 20),
    range(21, 41),
    range(42, 63),
  ]),
  '64c-4s6mm6cm-20um-40um-dl': entry('64c-4s6mm6cm-20um-40um-dl', [
    range(0, 15),
    range(16, 31),
    range(32, 47),
    range(48, 63),
  ]),
  'NET-EBL-128ch-single-shank': entry('NET-EBL-128ch-single-shank', [range(0, 127)]),
};

/**
 * Returns the catalog entry for a device type, or undefined if not catalogued.
 *
 * @param {string} deviceType - Device/probe type identifier
 * @returns {{ probe_type: string, num_shanks: number, shanks: Array<{shank_id: number, electrodeIds: number[]}> }|undefined}
 */
export function getProbeMetadata(deviceType) {
  if (typeof deviceType !== 'string') return undefined;
  return PROBE_CATALOG[deviceType];
}

/**
 * Returns the probe's shanks (each with `shank_id` and its `electrodeIds`).
 * Returns a fresh array of fresh arrays so callers can't mutate the catalog.
 *
 * @param {string} deviceType - Device/probe type identifier
 * @returns {Array<{shank_id: number, electrodeIds: number[]}>} Empty array if unknown.
 */
export function getProbeShanks(deviceType) {
  const meta = getProbeMetadata(deviceType);
  if (!meta) return [];
  return meta.shanks.map((shank) => ({
    shank_id: shank.shank_id,
    electrodeIds: [...shank.electrodeIds],
  }));
}

/**
 * Returns the flat, sorted union of all of a probe's shank electrode ids.
 * For a consistent probe this is `0 … (total − 1)`.
 *
 * @param {string} deviceType - Device/probe type identifier
 * @returns {number[]} Empty array if unknown.
 */
export function getProbeElectrodeIds(deviceType) {
  const meta = getProbeMetadata(deviceType);
  if (!meta) return [];
  const ids = meta.shanks.flatMap((shank) => shank.electrodeIds);
  return [...ids].sort((a, b) => a - b);
}

/**
 * True iff the catalog entry exists AND is internally consistent:
 *  - every electrode id is a non-negative integer,
 *  - the union of all shank ids is exactly `0 … (total − 1)` (no gaps, no dupes),
 *  - the recorded `num_shanks` matches the number of shank entries.
 *
 * A probe that fails this is explicitly unexportable (validation blocks export and
 * names the probe) rather than silently generating a converter-invalid map.
 *
 * @param {string} deviceType - Device/probe type identifier
 * @returns {boolean}
 */
export function isProbeCatalogConsistent(deviceType) {
  const meta = getProbeMetadata(deviceType);
  if (!meta) return false;
  if (meta.num_shanks !== meta.shanks.length) return false;

  const allIds = meta.shanks.flatMap((shank) => shank.electrodeIds);
  if (allIds.length === 0) return false;
  if (!allIds.every((id) => Number.isInteger(id) && id >= 0)) return false;

  const unique = new Set(allIds);
  if (unique.size !== allIds.length) return false; // duplicates

  // Contiguous 0..(total-1): the converter looks up every id in this range.
  for (let i = 0; i < allIds.length; i += 1) {
    if (!unique.has(i)) return false;
  }
  return true;
}
