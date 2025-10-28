import { describe, it, expect } from 'vitest';
import {
  getDeviceTypes,
  getChannelCount,
  getShankCount,
  validateDeviceType,
} from '../deviceTypeUtils';

describe('Device Type Utilities', () => {
  describe('getDeviceTypes()', () => {
    it('returns an array of available probe types', () => {
      const types = getDeviceTypes();
      expect(Array.isArray(types)).toBe(true);
      expect(types.length).toBeGreaterThan(0);
    });

    it('includes all 12 device types', () => {
      const types = getDeviceTypes();
      expect(types).toContain('tetrode_12.5');
      expect(types).toContain('A1x32-6mm-50-177-H32_21mm');
      expect(types).toContain('128c-4s8mm6cm-20um-40um-sl');
      expect(types).toContain('128c-4s6mm6cm-15um-26um-sl');
      expect(types).toContain('128c-4s8mm6cm-15um-26um-sl');
      expect(types).toContain('128c-4s6mm6cm-20um-40um-sl');
      expect(types).toContain('128c-4s4mm6cm-20um-40um-sl');
      expect(types).toContain('128c-4s4mm6cm-15um-26um-sl');
      expect(types).toContain('32c-2s8mm6cm-20um-40um-dl');
      expect(types).toContain('64c-4s6mm6cm-20um-40um-dl');
      expect(types).toContain('64c-3s6mm6cm-20um-40um-sl');
      expect(types).toContain('NET-EBL-128ch-single-shank');
    });
  });

  describe('getChannelCount()', () => {
    it('returns 4 channels for tetrode_12.5', () => {
      expect(getChannelCount('tetrode_12.5')).toBe(4);
    });

    it('returns 32 channels for A1x32-6mm-50-177-H32_21mm', () => {
      expect(getChannelCount('A1x32-6mm-50-177-H32_21mm')).toBe(32);
    });

    it('returns 128 channels for 128c-4s8mm6cm-20um-40um-sl', () => {
      expect(getChannelCount('128c-4s8mm6cm-20um-40um-sl')).toBe(128);
    });

    it('returns 128 channels for 128c-4s6mm6cm-15um-26um-sl', () => {
      expect(getChannelCount('128c-4s6mm6cm-15um-26um-sl')).toBe(128);
    });

    it('returns 128 channels for 128c-4s8mm6cm-15um-26um-sl', () => {
      expect(getChannelCount('128c-4s8mm6cm-15um-26um-sl')).toBe(128);
    });

    it('returns 128 channels for 128c-4s6mm6cm-20um-40um-sl', () => {
      expect(getChannelCount('128c-4s6mm6cm-20um-40um-sl')).toBe(128);
    });

    it('returns 128 channels for 128c-4s4mm6cm-20um-40um-sl', () => {
      expect(getChannelCount('128c-4s4mm6cm-20um-40um-sl')).toBe(128);
    });

    it('returns 128 channels for 128c-4s4mm6cm-15um-26um-sl', () => {
      expect(getChannelCount('128c-4s4mm6cm-15um-26um-sl')).toBe(128);
    });

    it('returns 32 channels for 32c-2s8mm6cm-20um-40um-dl', () => {
      expect(getChannelCount('32c-2s8mm6cm-20um-40um-dl')).toBe(32);
    });

    it('returns 64 channels for 64c-4s6mm6cm-20um-40um-dl', () => {
      expect(getChannelCount('64c-4s6mm6cm-20um-40um-dl')).toBe(64);
    });

    it('returns 64 channels for 64c-3s6mm6cm-20um-40um-sl', () => {
      expect(getChannelCount('64c-3s6mm6cm-20um-40um-sl')).toBe(64);
    });

    it('returns 128 channels for NET-EBL-128ch-single-shank', () => {
      expect(getChannelCount('NET-EBL-128ch-single-shank')).toBe(128);
    });

    it('returns 0 for unknown device type', () => {
      expect(getChannelCount('unknown_device')).toBe(0);
    });

    it('returns 0 for null or undefined', () => {
      expect(getChannelCount(null)).toBe(0);
      expect(getChannelCount(undefined)).toBe(0);
    });
  });

  describe('getShankCount()', () => {
    it('returns 1 shank for tetrode_12.5', () => {
      expect(getShankCount('tetrode_12.5')).toBe(1);
    });

    it('returns 1 shank for A1x32-6mm-50-177-H32_21mm', () => {
      expect(getShankCount('A1x32-6mm-50-177-H32_21mm')).toBe(1);
    });

    it('returns 4 shanks for 128c-4s8mm6cm-20um-40um-sl', () => {
      expect(getShankCount('128c-4s8mm6cm-20um-40um-sl')).toBe(4);
    });

    it('returns 4 shanks for 128c-4s6mm6cm-15um-26um-sl', () => {
      expect(getShankCount('128c-4s6mm6cm-15um-26um-sl')).toBe(4);
    });

    it('returns 4 shanks for 128c-4s8mm6cm-15um-26um-sl', () => {
      expect(getShankCount('128c-4s8mm6cm-15um-26um-sl')).toBe(4);
    });

    it('returns 4 shanks for 128c-4s6mm6cm-20um-40um-sl', () => {
      expect(getShankCount('128c-4s6mm6cm-20um-40um-sl')).toBe(4);
    });

    it('returns 4 shanks for 128c-4s4mm6cm-20um-40um-sl', () => {
      expect(getShankCount('128c-4s4mm6cm-20um-40um-sl')).toBe(4);
    });

    it('returns 4 shanks for 128c-4s4mm6cm-15um-26um-sl', () => {
      expect(getShankCount('128c-4s4mm6cm-15um-26um-sl')).toBe(4);
    });

    it('returns 2 shanks for 32c-2s8mm6cm-20um-40um-dl', () => {
      expect(getShankCount('32c-2s8mm6cm-20um-40um-dl')).toBe(2);
    });

    it('returns 4 shanks for 64c-4s6mm6cm-20um-40um-dl', () => {
      expect(getShankCount('64c-4s6mm6cm-20um-40um-dl')).toBe(4);
    });

    it('returns 3 shanks for 64c-3s6mm6cm-20um-40um-sl', () => {
      expect(getShankCount('64c-3s6mm6cm-20um-40um-sl')).toBe(3);
    });

    it('returns 1 shank for NET-EBL-128ch-single-shank', () => {
      expect(getShankCount('NET-EBL-128ch-single-shank')).toBe(1);
    });

    it('returns 0 for unknown device type', () => {
      expect(getShankCount('unknown_device')).toBe(0);
    });

    it('returns 0 for null or undefined', () => {
      expect(getShankCount(null)).toBe(0);
      expect(getShankCount(undefined)).toBe(0);
    });
  });

  describe('validateDeviceType()', () => {
    it('returns true for valid device types', () => {
      expect(validateDeviceType('tetrode_12.5')).toBe(true);
      expect(validateDeviceType('A1x32-6mm-50-177-H32_21mm')).toBe(true);
      expect(validateDeviceType('128c-4s8mm6cm-20um-40um-sl')).toBe(true);
      expect(validateDeviceType('32c-2s8mm6cm-20um-40um-dl')).toBe(true);
      expect(validateDeviceType('NET-EBL-128ch-single-shank')).toBe(true);
    });

    it('returns false for invalid device types', () => {
      expect(validateDeviceType('unknown_device')).toBe(false);
      expect(validateDeviceType('tetrode')).toBe(false);
      expect(validateDeviceType('')).toBe(false);
    });

    it('returns false for null or undefined', () => {
      expect(validateDeviceType(null)).toBe(false);
      expect(validateDeviceType(undefined)).toBe(false);
    });

    it('returns false for non-string types', () => {
      expect(validateDeviceType(123)).toBe(false);
      expect(validateDeviceType({})).toBe(false);
      expect(validateDeviceType([])).toBe(false);
    });
  });
});
