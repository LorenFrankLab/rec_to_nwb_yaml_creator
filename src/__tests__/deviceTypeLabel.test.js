/**
 * @file Tests for deviceTypeLabel — recognition-friendly summaries for the opaque probe IDs
 * (Phase 8A-2). The displayed label must read like hardware ("128-ch, 4-shank, 8 mm (20/40 µm)")
 * while the option VALUE stays the exact probe ID (it keys into trodes_to_nwb probe-metadata
 * filenames, so it must never change).
 */

import { describe, it, expect } from 'vitest';
import { deviceTypes, deviceTypeLabel } from '../valueList';

describe('deviceTypeLabel', () => {
  it('produces a human label DIFFERENT from the opaque value for every supported device type', () => {
    for (const id of deviceTypes()) {
      const label = deviceTypeLabel(id);
      expect(typeof label).toBe('string');
      expect(label.length).toBeGreaterThan(0);
      // The whole point is recognition: the label must not be the raw opaque id.
      expect(label).not.toBe(id);
    }
  });

  it('summarizes a SpikeGadgets-style id as channels / shanks / length / spacing', () => {
    expect(deviceTypeLabel('128c-4s8mm6cm-20um-40um-sl')).toBe('128-ch, 4-shank, 8 mm (20/40 µm)');
    expect(deviceTypeLabel('128c-4s6mm6cm-15um-26um-sl')).toBe('128-ch, 4-shank, 6 mm (15/26 µm)');
    expect(deviceTypeLabel('32c-2s8mm6cm-20um-40um-dl')).toBe('32-ch, 2-shank, 8 mm (20/40 µm)');
    expect(deviceTypeLabel('64c-3s6mm6cm-20um-40um-sl')).toBe('64-ch, 3-shank, 6 mm (20/40 µm)');
  });

  it('gives the irregular IDs explicit readable labels', () => {
    expect(deviceTypeLabel('tetrode_12.5')).toMatch(/tetrode/i);
    expect(deviceTypeLabel('A1x32-6mm-50-177-H32_21mm')).toMatch(/32-ch/);
    expect(deviceTypeLabel('NET-EBL-128ch-single-shank')).toMatch(/128-ch/);
    expect(deviceTypeLabel('NET-EBL-128ch-single-shank')).toMatch(/1-shank|single/i);
  });

  it('distinguishes the 8 mm 128-channel variants by length AND spacing', () => {
    // These differ only by length/spacing in the id, so the labels must too (else they collide).
    const a = deviceTypeLabel('128c-4s8mm6cm-20um-40um-sl');
    const b = deviceTypeLabel('128c-4s8mm6cm-15um-26um-sl');
    expect(a).not.toBe(b);
  });

  it('falls back to the raw id for an unknown device type (never hides it)', () => {
    expect(deviceTypeLabel('some-future-probe-id')).toBe('some-future-probe-id');
  });

  it('tolerates a non-string input without throwing', () => {
    expect(() => deviceTypeLabel(undefined)).not.toThrow();
    expect(() => deviceTypeLabel(null)).not.toThrow();
    expect(deviceTypeLabel(42)).toBe('42');
  });
});
