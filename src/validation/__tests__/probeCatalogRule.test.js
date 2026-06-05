/**
 * Probe Metadata Contract — `inconsistent_probe_catalog` validation rule.
 *
 * If an electrode group's device_type has a catalog entry that exists but is
 * INTERNALLY INCONSISTENT (gaps/dupes in its electrode ids, or a shank-count
 * mismatch), the app must BLOCK export and NAME the probe rather than silently
 * generating a converter-invalid channel map. This guards against a future
 * catalog edit that introduces an inconsistent entry.
 *
 * The catalog is mocked here so we can exercise the "known but inconsistent"
 * branch — all 12 real probes are consistent by construction. Because
 * rulesValidation reaches the catalog transitively, each test imports it
 * dynamically after `vi.resetModules()` so the mock applies through the graph.
 */

import { describe, it, expect, vi, afterEach } from 'vitest';

const INCONSISTENT = '64c-3s6mm6cm-20um-40um-sl';

// '64c-3s6mm6cm-20um-40um-sl' stays a KNOWN device (getProbeMetadata real) but is
// reported INCONSISTENT; all other probes keep their real consistency.
vi.mock('../../ntrode/probeCatalog', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    isProbeCatalogConsistent: (deviceType) =>
      deviceType === INCONSISTENT ? false : actual.isProbeCatalogConsistent(deviceType),
  };
});

afterEach(() => {
  vi.resetModules();
});

// Re-resolve rulesValidation through the mocked graph for each test.
/**
 *
 */
async function loadRulesValidation() {
  vi.resetModules();
  const mod = await import('../rulesValidation');
  return mod.rulesValidation;
}

const codes = (issues) => issues.map((i) => i.code);

describe('Probe Metadata Contract: inconsistent_probe_catalog rule', () => {
  it('blocks export and names the probe when its catalog entry is inconsistent', async () => {
    const rulesValidation = await loadRulesValidation();
    const issues = rulesValidation({
      electrode_groups: [
        {
          id: 0,
          device_type: INCONSISTENT,
          location: 'CA1',
          targeted_location: 'CA1',
        },
      ],
    });
    const issue = issues.find((i) => i.code === 'inconsistent_probe_catalog');
    expect(issue).toBeDefined();
    expect(issue.severity).toBe('error');
    expect(issue.step).toBe('devices');
    // The message must NAME the probe so the scientist knows which one is unexportable.
    expect(issue.message).toContain(INCONSISTENT);
  });

  it('does not fire for a consistent probe', async () => {
    const rulesValidation = await loadRulesValidation();
    const issues = rulesValidation({
      electrode_groups: [
        { id: 0, device_type: 'tetrode_12.5', location: 'CA1', targeted_location: 'CA1' },
      ],
    });
    expect(codes(issues)).not.toContain('inconsistent_probe_catalog');
  });

  it('does not double-report when the device_type is entirely unknown', async () => {
    const rulesValidation = await loadRulesValidation();
    // An unknown device_type is owned by the unknown_device_type rule, not this one.
    const issues = rulesValidation({
      electrode_groups: [
        { id: 0, device_type: 'made_up_probe', location: 'CA1', targeted_location: 'CA1' },
      ],
    });
    expect(codes(issues)).not.toContain('inconsistent_probe_catalog');
    expect(codes(issues)).toContain('unknown_device_type');
  });
});
