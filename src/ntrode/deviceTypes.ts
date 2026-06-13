/**
 * Per-shank channel mapping helpers for a device type.
 *
 * These are now derived from the VERIFIED probe catalog (`probeCatalog`), which
 * transcribes the trodes_to_nwb probe metadata (the converter truth). `deviceTypeMap`
 * returns the FIRST shank's local electrode-id list — a single ntrode/shank's channel
 * array — and is retained for its existing consumers (legacy ntrode editor, the
 * channel-map UI grid, and validation key-count math). It is NOT the geometry source
 * of truth for multi-shank generation: the generator, validation, and UI must use
 * `getProbeShanks` so the UNEVEN 64c-3s probe (21/21/22) renders/validates correctly.
 *
 * @module deviceTypes
 */

import { getProbeMetadata, getProbeShanks } from './probeCatalog';

/**
 * Returns the FIRST shank's local electrode-id array for a device type.
 *
 * For single-shank probes this is the whole channel list (`[0..3]` for a tetrode).
 * For multi-shank probes it is shank 0's ids only — e.g. `[0..31]` for a 128c-4s
 * probe and `[0..20]` (21 ids) for the uneven 64c-3s probe. Callers that need the
 * full per-shank partition (multi-shank generation/validation/UI) must use
 * `getProbeShanks` from `probeCatalog`, not length-math on this array.
 *
 * @param deviceType
 * @returns Shank 0's electrode ids, or `[0, 1, 2, 3]` for an unknown type
 *   (preserving the legacy tetrode-shaped default).
 */
export const deviceTypeMap = (deviceType: unknown): number[] => {
  const meta = getProbeMetadata(deviceType);
  if (!meta || meta.shanks.length === 0) {
    return [0, 1, 2, 3];
  }
  return [...meta.shanks[0].electrodeIds];
};

/**
 * Returns the shank count of a device.
 *
 * Derived from the probe catalog.
 *
 * @param deviceType
 * @returns shank count, or 0 for an unknown device type
 */
export const getShankCount = (deviceType: unknown): number => {
  const shanks = getProbeShanks(deviceType);
  return shanks.length;
};
