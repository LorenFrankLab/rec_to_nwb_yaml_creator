/**
 * TEST: Schema Device Type Synchronization
 *
 * Purpose: Verify device types are synchronized between web app and trodes_to_nwb
 *
 * Critical for: Device type selection in electrode groups UI
 *
 * Background: Phase 2 Bug Fix - Schema Synchronization (P0)
 * - trodes_to_nwb has 4 additional device types (128c variants)
 * - Web app needs these device types to match Python package
 * - Missing device types cause NULL probe_id in Spyglass database
 */

import { describe, it, expect } from 'vitest';
import { deviceTypes } from '../../../valueList';
import { deviceTypeMap, getShankCount } from '../../../ntrode/deviceTypes';

describe('Device Type Synchronization', () => {
  describe('Required Device Types from trodes_to_nwb', () => {
    it('should include 128c-4s8mm6cm-15um-26um-sl', () => {
      const types = deviceTypes();
      expect(types).toContain('128c-4s8mm6cm-15um-26um-sl');
    });

    it('should include 128c-4s6mm6cm-20um-40um-sl', () => {
      const types = deviceTypes();
      expect(types).toContain('128c-4s6mm6cm-20um-40um-sl');
    });

    it('should include 128c-4s4mm6cm-20um-40um-sl', () => {
      const types = deviceTypes();
      expect(types).toContain('128c-4s4mm6cm-20um-40um-sl');
    });

    it('should include 128c-4s4mm6cm-15um-26um-sl', () => {
      const types = deviceTypes();
      expect(types).toContain('128c-4s4mm6cm-15um-26um-sl');
    });

    it('should have total of 12 device types (matching trodes_to_nwb)', () => {
      const types = deviceTypes();
      expect(types).toHaveLength(12);
    });
  });

  describe('Device Type Channel Mappings', () => {
    it('128c-4s8mm6cm-15um-26um-sl should have 32 channels', () => {
      const channels = deviceTypeMap('128c-4s8mm6cm-15um-26um-sl');
      expect(channels).toHaveLength(32);
      expect(channels).toEqual([
        0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15,
        16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31
      ]);
    });

    it('128c-4s6mm6cm-20um-40um-sl should have 32 channels', () => {
      const channels = deviceTypeMap('128c-4s6mm6cm-20um-40um-sl');
      expect(channels).toHaveLength(32);
    });

    it('128c-4s4mm6cm-20um-40um-sl should have 32 channels', () => {
      const channels = deviceTypeMap('128c-4s4mm6cm-20um-40um-sl');
      expect(channels).toHaveLength(32);
    });

    it('128c-4s4mm6cm-15um-26um-sl should have 32 channels', () => {
      const channels = deviceTypeMap('128c-4s4mm6cm-15um-26um-sl');
      expect(channels).toHaveLength(32);
    });
  });

  describe('Device Type Shank Counts', () => {
    it('128c-4s8mm6cm-15um-26um-sl should have 4 shanks', () => {
      const shanks = getShankCount('128c-4s8mm6cm-15um-26um-sl');
      expect(shanks).toBe(4);
    });

    it('128c-4s6mm6cm-20um-40um-sl should have 4 shanks', () => {
      const shanks = getShankCount('128c-4s6mm6cm-20um-40um-sl');
      expect(shanks).toBe(4);
    });

    it('128c-4s4mm6cm-20um-40um-sl should have 4 shanks', () => {
      const shanks = getShankCount('128c-4s4mm6cm-20um-40um-sl');
      expect(shanks).toBe(4);
    });

    it('128c-4s4mm6cm-15um-26um-sl should have 4 shanks', () => {
      const shanks = getShankCount('128c-4s4mm6cm-15um-26um-sl');
      expect(shanks).toBe(4);
    });
  });
});
