/**
 * @fileoverview The executor that writes an import {@link module:state/yamlImportPlan.ImportPlan}
 * into the live workspace store. Separate from the PURE plan builder so the reconciliation
 * (pure, unit-testable) and the store writes (side-effectful) stay independently verifiable.
 *
 * It drives the existing workspace actions ONLY — it adds no new store transition:
 *   - `createAnimal` seeds version 1 from the earliest config + the resolved animal facts,
 *   - `createDay` adds each day (pinned to the latest = v1 at that point),
 *   - `createConfigurationSnapshotAndApplyForward` appends each later config version and
 *     re-pins the days that use it (atomic),
 *   - `updateDay` writes the day-owned content `createDay` does not take (tasks, files,
 *     behavioral_events, fs_gui_yamls, technical, keywords, data_acq_device_name, cameras_used).
 *
 * Conflict animals (already in the workspace) follow the caller's per-subject resolution:
 * `'add'` (default) layers the plan's days onto the existing animal, `'skip'` writes nothing,
 * `'replace'` deletes the existing animal then recreates it from the plan.
 *
 * Resilience: the store actions throw INSIDE their `setWorkspace((prev) => { throw ... })`
 * updater, which React invokes during its reducer phase — so a throw ESCAPES a synchronous
 * try/catch around the action call and crashes the render. A `try/catch` alone therefore can
 * NOT isolate a per-animal failure. The real guarantee is a SYNCHRONOUS PRE-FLIGHT
 * (`preflightAnimal`) against the CURRENT workspace snapshot BEFORE issuing any write: an
 * animal whose preconditions would make a store action throw (e.g. a duplicate day id in
 * conflict→'add', or a new-animal subjectId that already exists) is recorded in `failed` and
 * SKIPPED, never written. Because nothing mutates the store between pre-flight and the writes
 * within one call, this makes "one animal's failure never aborts the others" actually true.
 * The surrounding try/catch is kept only as a backstop.
 *
 * @module state/yamlImportApply
 */

import { generateDayId } from './workspaceUtils';

/**
 * Pre-flight a single planned animal against the CURRENT workspace snapshot (read-only),
 * returning a failure reason if issuing its writes would make a store action throw, or `null`
 * if it is safe to apply. Mirrors the throw conditions in the store actions:
 *  - new-animal (resolution `'create'`): the `subjectId` must NOT already exist as an animal
 *    (would collide with `createAnimal`); none of its planned day ids may already exist.
 *  - conflict→`'add'`: the target existing animal must exist; none of the new day ids may
 *    collide with an existing day.
 *  - conflict→`'replace'`: safe — `deleteAnimal` removes the existing animal (and its days)
 *    before any recreate, so no collision is possible.
 *
 * Defense in depth: `reservedDayIds` accumulates the day ids that earlier-passed animals in
 * the SAME `applyImportPlan` call will write. An intra-plan duplicate id (a plan that — despite
 * `planImport`'s dedup — still carries two days resolving to the same id) is failed-closed here,
 * so the executor never issues a `createDay` whose throw would escape the reducer.
 *
 * @param {import('./yamlImportPlan').ImportPlanAnimal} animalPlan
 * @param {'create'|'add'|'replace'} resolution
 * @param {object} workspace - The current workspace slice (`{ animals, days }`), read-only.
 * @param {Set<string>} reservedDayIds - Day ids already reserved by earlier-passed animals in
 *   this same call (read-only here; the caller commits the animal's ids on success).
 * @returns {(string|null)} A failure reason, or `null` when safe to apply.
 */
function preflightAnimal(animalPlan, resolution, workspace, reservedDayIds) {
  const animals = workspace?.animals ?? {};
  const days = workspace?.days ?? {};
  const { subjectId } = animalPlan;

  if (resolution === 'replace') {
    // deleteAnimal removes the existing animal + its days first, so recreate cannot collide.
    if (!animalPlan.existingAnimalId || !animals[animalPlan.existingAnimalId]) {
      return `Animal "${subjectId}" no longer exists to replace.`;
    }
    return null;
  }

  // For 'add' the target is the existing animal; for 'create' it is the new subjectId.
  const targetId = resolution === 'add' ? animalPlan.existingAnimalId : subjectId;

  if (resolution === 'add') {
    if (!targetId || !animals[targetId]) {
      return `Animal "${subjectId}" no longer exists to add days to.`;
    }
  } else if (animals[subjectId]) {
    // resolution === 'create' (new animal).
    return `Animal "${subjectId}" already exists; cannot import it as a new animal.`;
  }

  const seenInThisAnimal = new Set();
  for (const day of animalPlan.days) {
    const dayId = generateDayId(targetId, day.date);
    if (days[dayId] || reservedDayIds.has(dayId) || seenInThisAnimal.has(dayId)) {
      return resolution === 'add'
        ? `Day "${dayId}" already exists; cannot add it to animal "${targetId}".`
        : `Day "${dayId}" already exists; cannot create animal "${subjectId}".`;
    }
    seenInThisAnimal.add(dayId);
  }
  return null;
}

/**
 * Apply a planned import to the live store.
 *
 * @param {import('./yamlImportPlan').ImportPlan} plan - The plan from `planImport`.
 * @param {object} actions - The store's workspace actions (createAnimal, createDay,
 *   createConfigurationSnapshotAndApplyForward, updateDay, updateAnimal, deleteAnimal).
 * @param {object} [options] - Apply options.
 * @param {object} [options.workspace] - The CURRENT workspace snapshot (`{ animals, days }`),
 *   read-only. Used to PRE-FLIGHT each animal's preconditions before issuing any write, so a
 *   collision is recorded in `failed` instead of throwing out of a store action's reducer and
 *   crashing the render. Defaults to an empty workspace (no pre-flight guarantees).
 * @param {Record<string, ('add'|'skip'|'replace')>} [options.resolutions] - Per-subject
 *   overrides of `defaultResolution` for conflict animals.
 * @returns {{ createdAnimals: string[], createdDays: string[], skipped: string[], failed: Array<{ subjectId: string, reason: string }> }}
 *   Failures are RECORDED, never thrown.
 */
export function applyImportPlan(plan, actions, { workspace = { animals: {}, days: {} }, resolutions = {} } = {}) {
  const createdAnimals = [];
  const createdDays = [];
  const skipped = [];
  const failed = [];
  // Day ids reserved by earlier-passed animals in THIS call (defense in depth: lets pre-flight
  // reject an intra-plan duplicate day id even if a caller hands us a plan that wasn't deduped).
  const reservedDayIds = new Set();

  for (const animalPlan of plan.animals) {
    const { subjectId } = animalPlan;
    const resolution =
      animalPlan.conflict === 'exists'
        ? resolutions[subjectId] || animalPlan.defaultResolution
        : 'create';

    if (resolution === 'skip') {
      skipped.push(subjectId);
      continue;
    }

    // PRE-FLIGHT (synchronous, read-only): catch any precondition that would make a store
    // action throw out of its reducer. Nothing mutates the store between this check and the
    // writes below within one call, so SKIPPING here actually isolates the failure.
    const reason = preflightAnimal(animalPlan, resolution, workspace, reservedDayIds);
    if (reason !== null) {
      failed.push({ subjectId, reason });
      continue;
    }
    // Reserve this animal's day ids so a later animal in the same call can't collide with them.
    const targetId = resolution === 'add' ? animalPlan.existingAnimalId : subjectId;
    for (const day of animalPlan.days) {
      reservedDayIds.add(generateDayId(targetId, day.date));
    }

    try {
      if (resolution === 'replace') {
        // Replace: delete the existing animal (+ its days) then recreate from the plan.
        actions.deleteAnimal(animalPlan.existingAnimalId);
        applyNewAnimal(animalPlan, actions, createdAnimals, createdDays);
      } else if (resolution === 'add') {
        // Conflict → add: layer the plan's days (+ any config versions) onto the existing
        // animal without recreating it or clobbering its animal-level facts.
        applyAddToExistingAnimal(animalPlan, actions, createdDays);
      } else {
        // No conflict → create fresh.
        applyNewAnimal(animalPlan, actions, createdAnimals, createdDays);
      }
    } catch (error) {
      // Backstop only: pre-flight should already have caught any throwing precondition.
      failed.push({ subjectId, reason: error?.message ?? String(error) });
    }
  }

  return { createdAnimals, createdDays, skipped, failed };
}

/**
 * Create a brand-new animal from a per-animal plan: seed version 1 from the EARLIEST config
 * + the resolved animal facts, add every day, append the later config versions (re-pinning
 * their days), and write each day's day-owned content through `updateDay`.
 *
 * @param {import('./yamlImportPlan').ImportPlanAnimal} animalPlan
 * @param {object} actions
 * @param {string[]} createdAnimals - Accumulator (mutated).
 * @param {string[]} createdDays - Accumulator (mutated).
 */
function applyNewAnimal(animalPlan, actions, createdAnimals, createdDays) {
  const { subjectId, configVersions } = animalPlan;
  const firstConfig = configVersions[0]?.devices ?? {
    electrode_groups: [],
    ntrode_electrode_group_channel_map: [],
  };

  // Seed the animal with version 1 = the earliest config, plus the resolved catalogs/facts.
  actions.createAnimal(subjectId, animalPlan.subject, {
    devices: {
      ...animalPlan.devices,
      electrode_groups: firstConfig.electrode_groups,
      ntrode_electrode_group_channel_map: firstConfig.ntrode_electrode_group_channel_map,
    },
    cameras: animalPlan.cameras,
    experimenters: animalPlan.experimenters,
    optogenetics: animalPlan.optogenetics,
  });
  createdAnimals.push(subjectId);

  // Create every day in date order. Each pins to the latest (= v1 at this point); later
  // versions are re-pinned below.
  for (const day of animalPlan.days) {
    actions.createDay(subjectId, day.date, day.session);
    createdDays.push(generateDayId(subjectId, day.date));
  }

  // Append config versions v2..K and re-pin their days atomically.
  for (let i = 1; i < configVersions.length; i += 1) {
    const cv = configVersions[i];
    const dayIds = cv.dayDates.map((d) => generateDayId(subjectId, d));
    actions.createConfigurationSnapshotAndApplyForward(
      subjectId,
      { date: cv.date, description: cv.description, devices: cv.devices },
      dayIds
    );
  }

  // Write each day's day-owned content (createDay only takes a session).
  for (const day of animalPlan.days) {
    actions.updateDay(generateDayId(subjectId, day.date), dayOwnedUpdates(day));
  }
}

/**
 * Conflict → 'add': layer a plan's days onto an EXISTING animal without recreating it.
 *
 * Behavior (kept deliberately MINIMAL and documented): the plan's days are added to the
 * existing animal id, their day-owned content is written through `updateDay`, and each
 * imported config version is appended to the existing animal's history (then its days are
 * re-pinned). The existing animal's animal-level facts (subject / experimenters / optogenetics)
 * and its catalogs (cameras / data_acq_device) are NOT clobbered — the existing animal is
 * authoritative for those.
 *
 * LIMITATION (surfaced, not hidden): the public store actions expose no synchronous read of an
 * animal's current catalogs, so this executor cannot reliably UNION the plan's cameras /
 * data_acq_device into the existing animal without risking a wholesale clobber via `updateAnimal`
 * (which replaces, not merges, those collections). It therefore does NOT touch the catalogs: an
 * added day whose `cameras_used` / `data_acq_device_name` reference an entry the existing animal
 * lacks will surface a resolution gap on export, which the import UI (a later task) is expected to
 * preview so the user can reconcile the catalogs first. This keeps 'add' safe (never destructive)
 * at the cost of not auto-merging catalogs.
 *
 * @param {import('./yamlImportPlan').ImportPlanAnimal} animalPlan
 * @param {object} actions
 * @param {string[]} createdDays - Accumulator (mutated).
 */
function applyAddToExistingAnimal(animalPlan, actions, createdDays) {
  const targetId = animalPlan.existingAnimalId;

  // Add each day (pins to the existing animal's latest version initially), then append each
  // imported config version and re-pin its days onto it.
  for (const day of animalPlan.days) {
    actions.createDay(targetId, day.date, day.session);
    createdDays.push(generateDayId(targetId, day.date));
  }
  for (const cv of animalPlan.configVersions) {
    const dayIds = cv.dayDates.map((d) => generateDayId(targetId, d));
    actions.createConfigurationSnapshotAndApplyForward(
      targetId,
      { date: cv.date, description: cv.description, devices: cv.devices },
      dayIds
    );
  }
  for (const day of animalPlan.days) {
    actions.updateDay(generateDayId(targetId, day.date), dayOwnedUpdates(day));
  }
}

/**
 * The `updateDay` payload that writes a plan day's day-owned content (everything `createDay`
 * does not accept). Exactly the keys `applyDayUpdates` allow-lists for these collections.
 *
 * @param {import('./yamlImportPlan').ImportPlanDay} day
 * @returns {object} The updateDay payload.
 */
function dayOwnedUpdates(day) {
  return {
    session: day.session,
    keywords: day.keywords,
    tasks: day.tasks,
    associated_files: day.associated_files,
    associated_video_files: day.associated_video_files,
    behavioral_events: day.behavioral_events,
    fs_gui_yamls: day.fs_gui_yamls,
    technical: day.technical,
    data_acq_device_name: day.data_acq_device_name,
    cameras_used: day.cameras_used,
  };
}
