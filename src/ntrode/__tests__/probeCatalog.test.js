/**
 * Probe Metadata Contract — catalog tests
 *
 * The trodes_to_nwb probe metadata is the SOURCE OF TRUTH for probe geometry.
 * This catalog encodes the VERIFIED per-shank electrode-id partition for every
 * supported probe (from trodes_to_nwb source), including the UNEVEN 64c-3s probe
 * (21/21/22) that the old length-math silently mis-partitioned.
 */

import { describe, it, expect } from 'vitest';
import {
  getProbeMetadata,
  getProbeElectrodeIds,
  getProbeShanks,
  isProbeCatalogConsistent,
} from '../probeCatalog';

// The VERIFIED per-shank electrode-id catalog (from the task spec / trodes_to_nwb).
const EXPECTED = {
  'tetrode_12.5': [[0, 1, 2, 3]],
  'A1x32-6mm-50-177-H32_21mm': [range(0, 31)],
  '128c-4s4mm6cm-15um-26um-sl': [range(0, 31), range(32, 63), range(64, 95), range(96, 127)],
  '128c-4s4mm6cm-20um-40um-sl': [range(0, 31), range(32, 63), range(64, 95), range(96, 127)],
  '128c-4s6mm6cm-15um-26um-sl': [range(0, 31), range(32, 63), range(64, 95), range(96, 127)],
  '128c-4s6mm6cm-20um-40um-sl': [range(0, 31), range(32, 63), range(64, 95), range(96, 127)],
  '128c-4s8mm6cm-15um-26um-sl': [range(0, 31), range(32, 63), range(64, 95), range(96, 127)],
  '128c-4s8mm6cm-20um-40um-sl': [range(0, 31), range(32, 63), range(64, 95), range(96, 127)],
  '32c-2s8mm6cm-20um-40um-dl': [range(0, 15), range(16, 31)],
  '64c-3s6mm6cm-20um-40um-sl': [range(0, 20), range(21, 41), range(42, 63)], // UNEVEN 21/21/22
  '64c-4s6mm6cm-20um-40um-dl': [range(0, 15), range(16, 31), range(32, 47), range(48, 63)],
  'NET-EBL-128ch-single-shank': [range(0, 127)],
};

/**
 *
 * @param start
 * @param end
 */
function range(start, end) {
  return Array.from({ length: end - start + 1 }, (_, i) => start + i);
}

describe('probeCatalog', () => {
  describe('getProbeShanks() — verified per-shank partitions', () => {
    Object.entries(EXPECTED).forEach(([deviceType, shankIds]) => {
      it(`${deviceType} partitions electrode ids exactly per shank`, () => {
        const shanks = getProbeShanks(deviceType);
        expect(shanks).toHaveLength(shankIds.length);
        shanks.forEach((shank, i) => {
          expect(shank.electrodeIds).toEqual(shankIds[i]);
          expect(shank.shank_id).toBe(i);
        });
      });
    });

    it('64c-3s6mm6cm-20um-40um-sl is UNEVEN: 21/21/22 (not 20/20/20)', () => {
      const shanks = getProbeShanks('64c-3s6mm6cm-20um-40um-sl');
      expect(shanks.map((s) => s.electrodeIds.length)).toEqual([21, 21, 22]);
      expect(shanks[0].electrodeIds[0]).toBe(0);
      expect(shanks[2].electrodeIds[shanks[2].electrodeIds.length - 1]).toBe(63);
    });

    it('returns an empty array for an unknown device type', () => {
      expect(getProbeShanks('unknown_device')).toEqual([]);
    });
  });

  describe('getProbeMetadata()', () => {
    it('returns probe_type, num_shanks and shanks for a known probe', () => {
      const meta = getProbeMetadata('64c-3s6mm6cm-20um-40um-sl');
      expect(meta.probe_type).toBe('64c-3s6mm6cm-20um-40um-sl');
      expect(meta.num_shanks).toBe(3);
      expect(meta.shanks).toHaveLength(3);
    });

    it('returns undefined for an unknown probe', () => {
      expect(getProbeMetadata('unknown_device')).toBeUndefined();
      expect(getProbeMetadata(null)).toBeUndefined();
    });
  });

  describe('getProbeElectrodeIds() — flat sorted union', () => {
    Object.keys(EXPECTED).forEach((deviceType) => {
      it(`${deviceType} flat ids are exactly 0..(total-1)`, () => {
        const ids = getProbeElectrodeIds(deviceType);
        const total = EXPECTED[deviceType].reduce((n, s) => n + s.length, 0);
        expect(ids).toEqual(range(0, total - 1));
      });
    });

    it('64c-3s flat union is exactly 0..63 (64 ids)', () => {
      expect(getProbeElectrodeIds('64c-3s6mm6cm-20um-40um-sl')).toEqual(range(0, 63));
    });

    it('returns an empty array for an unknown device type', () => {
      expect(getProbeElectrodeIds('unknown_device')).toEqual([]);
    });
  });

  describe('isProbeCatalogConsistent()', () => {
    Object.keys(EXPECTED).forEach((deviceType) => {
      it(`${deviceType} is consistent (contiguous 0..n-1, shank count matches)`, () => {
        expect(isProbeCatalogConsistent(deviceType)).toBe(true);
      });
    });

    it('is false for an unknown / missing device type', () => {
      expect(isProbeCatalogConsistent('unknown_device')).toBe(false);
      expect(isProbeCatalogConsistent(undefined)).toBe(false);
      expect(isProbeCatalogConsistent(null)).toBe(false);
    });
  });
});
