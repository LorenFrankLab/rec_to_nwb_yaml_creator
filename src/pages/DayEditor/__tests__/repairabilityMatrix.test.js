import { describe, it, expect } from 'vitest';
import { validateDay, computeStepStatus, repairTargetForIssue } from '../validation';

/**
 * Boundary 3 — REPAIRABILITY is an invariant, tested as a matrix.
 *
 * The recurring failure across review rounds 6–8 was an export-blocking issue with no
 * reachable, truthful repair (laundered away, mis-routed to the wrong editor, or gated
 * with no control). This matrix asserts the invariant directly, once, for every
 * malformed-persisted-state shape:
 *
 *   malformed input  →  a blocking issue is raised
 *                    →  the issue carries the explicit ownership contract
 *                       (ownerSurface / focusPath) and routes to a real surface
 *                    →  applying the DOCUMENTED repair clears that issue.
 *
 * Adding a new malformed shape (or a new issue code) means adding a row here; the
 * harness then forces it to be surfaced AND repairable. The per-component tests
 * (DevicesStep / MalformedCollectionNotice / editors) assert the matching DOM control
 * renders at `focusPath`; this proves the logic round-trip.
 */

// A merged model with one resolved ntrode (for bad-channel override scenarios) and a
// complete-enough session, so the SPECIFIC code under test is the one we assert on.
const baseMerged = () => ({
  ntrode_electrode_group_channel_map: [{ ntrode_id: 1, electrode_group_id: 0, map: { 0: 0 }, bad_channels: [] }],
  electrode_groups: [],
  session: { session_id: 's', session_description: 'd' },
});

// An erroring merged for the shadowed-geometry scenario (a content-invalid electrode
// group → schema errors on an electrode_groups path).
const erroringGeometryMerged = () => ({
  electrode_groups: [{ id: 0 }],
  ntrode_electrode_group_channel_map: [],
});

/**
 * Each row: a malformed RAW day, the merged model to validate against, the issue code it
 * must raise, the owner surface it must route to, and the DOCUMENTED repair (the same
 * mutation the UI control performs) that must clear the code.
 *
 * @type {Array<{name: string, code: string, owner: string, day: object, merged: object, repair: (day: object) => object}>}
 */
const SCENARIOS = [
  {
    name: 'malformed day collection (tasks: {})',
    code: 'malformed_day_collection',
    owner: 'day',
    day: { tasks: {} },
    merged: baseMerged(),
    repair: (day) => ({ ...day, tasks: [] }),
  },
  {
    name: 'malformed day collection (keywords: scalar)',
    code: 'malformed_day_collection',
    owner: 'day',
    day: { keywords: 'kw' },
    merged: baseMerged(),
    repair: (day) => ({ ...day, keywords: [] }),
  },
  {
    name: 'top-level non-record deviceOverrides',
    code: 'malformed_device_override',
    owner: 'day',
    day: { deviceOverrides: 'corrupt' },
    merged: baseMerged(),
    repair: (day) => ({ ...day, deviceOverrides: {} }),
  },
  {
    name: 'non-array geometry override',
    code: 'malformed_device_override',
    owner: 'day',
    day: { deviceOverrides: { electrode_groups: 'corrupt' } },
    merged: baseMerged(),
    repair: (day) => ({ ...day, deviceOverrides: {} }),
  },
  {
    name: 'scalar bad_channels container',
    code: 'malformed_bad_channel_override',
    owner: 'day',
    day: { deviceOverrides: { bad_channels: '2.9' } },
    merged: baseMerged(),
    repair: (day) => ({ ...day, deviceOverrides: {} }),
  },
  {
    name: 'stale bad_channels key (no resolved ntrode)',
    code: 'stale_bad_channel_override',
    owner: 'day',
    day: { deviceOverrides: { bad_channels: { 999: [0] } } },
    merged: baseMerged(),
    repair: (day) => ({ ...day, deviceOverrides: { bad_channels: {} } }),
  },
  {
    name: 'non-array bad_channels value under a valid key',
    code: 'malformed_bad_channel_override',
    owner: 'day',
    day: { deviceOverrides: { bad_channels: { 1: '23' } } },
    merged: baseMerged(),
    repair: (day) => ({ ...day, deviceOverrides: { bad_channels: {} } }),
  },
  {
    name: 'shadowed array geometry override whose contents error',
    code: 'shadowed_geometry_override',
    owner: 'day',
    day: { deviceOverrides: { electrode_groups: [{ id: 0 }] } },
    merged: erroringGeometryMerged(),
    repair: (day) => ({ ...day, deviceOverrides: {} }),
  },
];

describe('Repairability matrix — every malformed shape is raised, owned, and clears on repair', () => {
  it.each(SCENARIOS)('$name', ({ code, owner, day, merged, repair }) => {
    // 1. A blocking issue with this code is raised.
    const issue = validateDay(day, merged).find((i) => i.code === code);
    expect(issue, `expected code "${code}" to be raised`).toBeTruthy();
    expect(issue.severity).toBe('error');

    // 2. It carries the explicit ownership contract and routes to a real surface.
    expect(issue.ownerSurface ?? issue.repairSurface, 'issue must declare an owner surface').toBe(owner);
    expect(issue.focusPath ?? issue.path, 'issue must declare a focus anchor').toBeTruthy();
    expect(repairTargetForIssue(issue).surface).toBe(owner);

    // 3. The issue blocks export.
    expect(computeStepStatus(day, merged).export).toBe('error');

    // 4. The DOCUMENTED repair clears THIS issue (the repairability invariant).
    const repaired = repair(day);
    const stillPresent = validateDay(repaired, merged).some((i) => i.code === code);
    expect(stillPresent, `repair did not clear code "${code}"`).toBe(false);
  });

  it('animal-collection corruption (cameras) completes the same repair round-trip', () => {
    // The animal code can't ride the day harness (its repair mutates the ANIMAL), but it
    // must satisfy the identical invariant: raised → owned (animal) → routes → blocks →
    // the documented repair (reset to []) clears it.
    const merged = baseMerged();
    const corruptAnimal = { cameras: 'nope' };
    const issue = validateDay({}, merged, corruptAnimal).find((i) => i.code === 'malformed_animal_collection');
    expect(issue, 'expected malformed_animal_collection to be raised').toBeTruthy();
    expect(issue.severity).toBe('error');
    expect(issue.ownerSurface).toBe('animal');
    expect(repairTargetForIssue(issue).surface).toBe('animal');
    expect(computeStepStatus({}, merged, corruptAnimal).export).toBe('error');
    const repairedAnimal = { cameras: [] };
    expect(
      validateDay({}, merged, repairedAnimal).some((i) => i.code === 'malformed_animal_collection')
    ).toBe(false);
  });

  it('covers every malformed/override code the contract produces (day + animal)', () => {
    // Guard against a new code being added without a round-trip: this set must equal the
    // codes the scenarios + the animal test exercise. Update BOTH when adding a code.
    const exercised = new Set([...SCENARIOS.map((s) => s.code), 'malformed_animal_collection']);
    expect([...exercised].sort()).toEqual(
      [
        'malformed_animal_collection',
        'malformed_bad_channel_override',
        'malformed_day_collection',
        'malformed_device_override',
        'shadowed_geometry_override',
        'stale_bad_channel_override',
      ].sort()
    );
  });
});
