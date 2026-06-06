import { describe, it, expect, vi } from 'vitest';
import { validateDay, computeStepStatus, repairTargetForIssue } from '../../../domain/validation';
import { applyRepairCommand } from '../../../state/repairCommands';

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
 * Simulate executing a repairCommand the way the store would: `updateDay` shallow-merges
 * the partial update onto the day (matching `useWorkspace.updateDay`'s per-field writes,
 * each of which REPLACES the named field). Returns the resulting raw day so the matrix can
 * prove the command produces the SAME mutation the documented `repair` describes — tying
 * the executable command to the contract, not re-deriving it.
 *
 * @param {object} command - The issue's repairCommand.
 * @param {object} day - The raw day to repair.
 * @param animal
 * @returns {object} The day after the command's store write.
 */
function execDayCommand(command, day, animal) {
  const state = { day: structuredClone(day) };
  const actions = {
    updateDay: (_id, updates) => Object.assign(state.day, updates),
    updateAnimal: vi.fn(),
    rebuildConfigurationHistory: vi.fn(),
  };
  // In production the executor's `animalId` is the resolved store OWNER KEY, which agrees with the
  // resolved animal's id; pass the animal's id (not a placeholder) so the harness mirrors that.
  applyRepairCommand(command, { actions, animalId: animal?.id ?? 'a', dayId: 'd', day: state.day, animal });
  return state.day;
}

/**
 * Each row: a malformed RAW day, the merged model to validate against, the issue code it
 * must raise, the owner surface it must route to, the DOCUMENTED repair (the same mutation
 * the UI control performs), and — for the commandable shapes — the serializable
 * `repairCommand` the issue must carry, whose execution must reproduce the documented repair.
 * `command: null` marks a shape that is repairable-by-navigation only (no executable reset).
 *
 * @type {Array<{name: string, code: string, owner: string, day: object, merged: object, repair: (day: object) => object, command: object|null}>}
 */
const SCENARIOS = [
  {
    name: 'malformed day collection (tasks: {})',
    code: 'malformed_day_collection',
    owner: 'day',
    day: { tasks: {} },
    merged: baseMerged(),
    repair: (day) => ({ ...day, tasks: [] }),
    command: { type: 'resetDayCollection', field: 'tasks' },
  },
  {
    name: 'malformed day collection (keywords: scalar)',
    code: 'malformed_day_collection',
    owner: 'day',
    day: { keywords: 'kw' },
    merged: baseMerged(),
    repair: (day) => ({ ...day, keywords: [] }),
    command: { type: 'resetDayCollection', field: 'keywords' },
  },
  {
    name: 'top-level non-record deviceOverrides',
    code: 'malformed_device_override',
    owner: 'day',
    day: { deviceOverrides: 'corrupt' },
    merged: baseMerged(),
    repair: (day) => ({ ...day, deviceOverrides: {} }),
    command: { type: 'resetDeviceOverrides' },
  },
  {
    name: 'non-array geometry override',
    code: 'malformed_device_override',
    owner: 'day',
    day: { deviceOverrides: { electrode_groups: 'corrupt' } },
    merged: baseMerged(),
    repair: (day) => ({ ...day, deviceOverrides: {} }),
    command: { type: 'removeDeviceOverrideKey', key: 'electrode_groups' },
  },
  {
    name: 'scalar bad_channels container',
    code: 'malformed_bad_channel_override',
    owner: 'day',
    day: { deviceOverrides: { bad_channels: '2.9' } },
    merged: baseMerged(),
    repair: (day) => ({ ...day, deviceOverrides: {} }),
    command: { type: 'resetBadChannelOverrides' },
  },
  {
    name: 'stale bad_channels key (no resolved ntrode)',
    code: 'stale_bad_channel_override',
    owner: 'day',
    day: { deviceOverrides: { bad_channels: { 999: [0] } } },
    merged: baseMerged(),
    repair: (day) => ({ ...day, deviceOverrides: { bad_channels: {} } }),
    command: { type: 'removeBadChannelOverrideKey', key: '999' },
  },
  {
    name: 'non-array bad_channels value under a valid key',
    code: 'malformed_bad_channel_override',
    owner: 'day',
    day: { deviceOverrides: { bad_channels: { 1: '23' } } },
    merged: baseMerged(),
    repair: (day) => ({ ...day, deviceOverrides: { bad_channels: {} } }),
    command: { type: 'removeBadChannelOverrideKey', key: '1' },
  },
  {
    name: 'malformed (non-record) day session',
    code: 'malformed_day_session',
    owner: 'day',
    day: { session: 'corrupt', date: '2023-06-22' },
    merged: baseMerged(),
    repair: (day) => ({ ...day, session: { session_id: 'remy_20230622' } }),
    command: { type: 'resetDaySession' },
    animal: { id: 'remy' },
  },
  {
    name: 'shadowed array geometry override whose contents error',
    code: 'shadowed_geometry_override',
    owner: 'day',
    day: { deviceOverrides: { electrode_groups: [{ id: 0 }] } },
    merged: erroringGeometryMerged(),
    repair: (day) => ({ ...day, deviceOverrides: {} }),
    // Navigation-only: its destination (DevicesStep) renders a working removal control, and
    // keeping-vs-dropping a content-erroring (but well-shaped) override is a user judgment,
    // not an unambiguous corruption reset.
    command: null,
  },
];

describe('Repairability matrix — every malformed shape is raised, owned, and clears on repair', () => {
  it.each(SCENARIOS)('$name', ({ code, owner, day, merged, repair, command, animal }) => {
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

    // 5. A commandable shape carries that exact command, and EXECUTING it both reproduces
    //    the documented repair AND clears the issue (the issue→fix half of the contract).
    if (command === null) {
      expect(issue.repairCommand, `code "${code}" must be navigation-only`).toBeUndefined();
    } else {
      expect(issue.repairCommand, `code "${code}" must carry a repairCommand`).toEqual(command);
      const executed = execDayCommand(issue.repairCommand, day, animal);
      expect(executed, 'executing the command must reproduce the documented repair').toEqual(repaired);
      expect(
        validateDay(executed, merged).some((i) => i.code === code),
        `executing the command did not clear code "${code}"`
      ).toBe(false);
    }
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

    // The executable half: the issue carries resetAnimalCameras, and running it resets the
    // animal cameras to [] (clearing the issue) via the updateAnimal store action.
    expect(issue.repairCommand).toEqual({ type: 'resetAnimalCameras' });
    const updateAnimal = vi.fn();
    applyRepairCommand(issue.repairCommand, {
      actions: { updateAnimal, updateDay: vi.fn(), rebuildConfigurationHistory: vi.fn() },
      animalId: 'remy',
      dayId: 'd',
      animal: corruptAnimal,
    });
    expect(updateAnimal).toHaveBeenCalledWith('remy', { cameras: [] });
  });

  it('animal-collection corruption (data_acq_device) completes the same repair round-trip', () => {
    // The OTHER malformed_animal_collection producer: a corrupt nested devices.data_acq_device
    // must also be raised → owned (animal) → blocks → and resetDataAcqDevice CLEARS it.
    const merged = baseMerged();
    const corruptAnimal = { configurationHistory: [{ version: 1 }], devices: { data_acq_device: 'nope' } };
    const issue = validateDay({}, merged, corruptAnimal).find(
      (i) => i.code === 'malformed_animal_collection' && i.field === 'data_acq_device'
    );
    expect(issue, 'expected a data_acq_device malformed_animal_collection').toBeTruthy();
    expect(issue.ownerSurface).toBe('animal');
    expect(repairTargetForIssue(issue).surface).toBe('animal');
    expect(computeStepStatus({}, merged, corruptAnimal).export).toBe('error');

    // Documented repair clears it.
    const repairedAnimal = { configurationHistory: [{ version: 1 }], devices: { data_acq_device: [] } };
    expect(
      validateDay({}, merged, repairedAnimal).some(
        (i) => i.code === 'malformed_animal_collection' && i.field === 'data_acq_device'
      )
    ).toBe(false);

    // The executable half: resetDataAcqDevice resets it to [] via updateAnimal.
    expect(issue.repairCommand).toEqual({ type: 'resetDataAcqDevice' });
    const updateAnimal = vi.fn();
    applyRepairCommand(issue.repairCommand, {
      actions: { updateAnimal, updateDay: vi.fn(), rebuildConfigurationHistory: vi.fn() },
      animalId: 'remy',
      dayId: 'd',
      animal: corruptAnimal,
    });
    expect(updateAnimal).toHaveBeenCalledWith('remy', { data_acq_device: [] });
  });

  it('missing/empty configurationHistory completes the same repair round-trip (rebuild command)', () => {
    // A real animal (has devices) that lost its history can resolve no day; it must be
    // raised → owned (animal) → routes → blocks → and the rebuild command clears it.
    const merged = baseMerged();
    const brokenAnimal = { id: 'remy', devices: { electrode_groups: [] }, configurationHistory: [] };
    const issue = validateDay({}, merged, brokenAnimal).find((i) => i.code === 'missing_configuration_history');
    expect(issue, 'expected missing_configuration_history to be raised').toBeTruthy();
    expect(issue.severity).toBe('error');
    expect(issue.ownerSurface).toBe('animal');
    expect(repairTargetForIssue(issue).surface).toBe('animal');
    expect(computeStepStatus({}, merged, brokenAnimal).export).toBe('error');

    // Executing the rebuild command delegates to the store action; after the store rebuilds
    // a single v1 snapshot the issue is gone (proven against the real store in the
    // DayEditorStepper integration test).
    expect(issue.repairCommand).toEqual({ type: 'rebuildConfigurationHistory' });
    const rebuildConfigurationHistory = vi.fn();
    applyRepairCommand(issue.repairCommand, {
      actions: { rebuildConfigurationHistory, updateDay: vi.fn(), updateAnimal: vi.fn() },
      animalId: 'remy',
      dayId: 'd',
      animal: brokenAnimal,
    });
    expect(rebuildConfigurationHistory).toHaveBeenCalledWith('remy');
    // A rebuilt (length-1) history no longer raises the missing-history issue.
    const rebuilt = { ...brokenAnimal, configurationHistory: [{ version: 1, devices: {} }] };
    expect(
      validateDay({}, merged, rebuilt).some((i) => i.code === 'missing_configuration_history')
    ).toBe(false);
  });

  it('covers every malformed/override code the contract produces (day + animal)', () => {
    // Guard against a new code being added without a round-trip: this set must equal the
    // codes the scenarios + the animal tests exercise. Update BOTH when adding a code.
    const exercised = new Set([
      ...SCENARIOS.map((s) => s.code),
      'malformed_animal_collection',
      'missing_configuration_history',
    ]);
    expect([...exercised].sort()).toEqual(
      [
        'malformed_animal_collection',
        'malformed_bad_channel_override',
        'malformed_day_collection',
        'malformed_day_session',
        'malformed_device_override',
        'missing_configuration_history',
        'shadowed_geometry_override',
        'stale_bad_channel_override',
      ].sort()
    );
  });

  it('documents the ONE deliberate navigation-only exception (shadowed_geometry_override)', () => {
    // Every other commandable malformed shape carries a repairCommand. shadowed_geometry_override
    // is the sole intentional exception: its override is a well-shaped array whose CONTENTS err,
    // its destination (DevicesStep) renders a working removal control, and keep-vs-drop is a user
    // judgment — not an unambiguous reset. This test fails loudly if it ever silently gains or is
    // expected to carry a command, forcing the exception to stay a conscious decision.
    const navOnly = SCENARIOS.filter((s) => s.command === null).map((s) => s.code);
    expect(navOnly).toEqual(['shadowed_geometry_override']);
  });
});
