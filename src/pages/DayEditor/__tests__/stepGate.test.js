import { describe, it, expect } from 'vitest';
import { isExportEnabled, exportBlockReason } from '../stepGate';

const allPrereqsValid = {
  overview: 'valid',
  devices: 'valid',
  epochs: 'valid',
  validation: 'valid',
};

describe('isExportEnabled', () => {
  it('returns false when the export status is error even though every prerequisite step is valid', () => {
    expect(isExportEnabled({ ...allPrereqsValid, export: 'error' })).toBe(false);
  });

  it('returns true when every prerequisite step is valid and export is valid', () => {
    expect(isExportEnabled({ ...allPrereqsValid, export: 'valid' })).toBe(true);
  });

  it('returns false when a prerequisite step is not valid (export status alone does not unlock)', () => {
    expect(
      isExportEnabled({ ...allPrereqsValid, devices: 'incomplete', export: 'valid' })
    ).toBe(false);
  });

  it('fails closed on a missing or malformed status rather than reading as enabled', () => {
    // A null/undefined/empty/partial status must never unlock export.
    expect(isExportEnabled(null)).toBe(false);
    expect(isExportEnabled(undefined)).toBe(false);
    expect(isExportEnabled({})).toBe(false);
    // All prerequisites valid but the `export` key is absent entirely.
    expect(isExportEnabled(allPrereqsValid)).toBe(false);
  });
});

describe('exportBlockReason', () => {
  it('returns null when export is enabled', () => {
    expect(exportBlockReason({ ...allPrereqsValid, export: 'valid' })).toBeNull();
  });

  it('reports validation-errors when prerequisites are complete but export is error', () => {
    expect(exportBlockReason({ ...allPrereqsValid, export: 'error' })).toBe('validation-errors');
  });

  it('reports incomplete-steps when a prerequisite step is not yet valid', () => {
    expect(
      exportBlockReason({ ...allPrereqsValid, epochs: 'incomplete', export: 'error' })
    ).toBe('incomplete-steps');
  });

  it('fails to the incomplete-steps reason on a malformed status', () => {
    expect(exportBlockReason(null)).toBe('incomplete-steps');
    expect(exportBlockReason({})).toBe('incomplete-steps');
  });
});
