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
 *     behavioral_events, fs_gui_yamls, technical, keywords, data_acq_device_name, cameras_used,
 *     deviceOverrides — the day-owned bad-channel marks).
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
import {
  getAnimalCameras,
  getDataAcqDevices,
  getDayAssociatedVideos,
  getDayCamerasUsed,
  getDayFsGuiYamls,
  getDayTasks,
} from './workspaceSelectors';
import type { ImportPlan, ImportPlanAnimal, ImportPlanDay } from './yamlImportPlan';

/** The current workspace snapshot read (read-only) during pre-flight. */
interface ApplyWorkspace {
  animals?: Record<string, any>;
  days?: Record<string, any>;
}

/** The store workspace actions the executor drives (loosely typed — injected from the live store). */
interface ImportActions {
  createAnimal: (subjectId: string, subject: any, metadata: any) => void;
  createDay: (animalId: string, date: string, session: any) => void;
  createConfigurationSnapshotAndApplyForward: (
    animalId: string,
    config: any,
    dayIds: string[]
  ) => void;
  updateDay: (dayId: string, updates: any) => void;
  updateAnimal: (animalId: string, updates: any) => void;
  deleteAnimal: (animalId: string) => void;
}

/** Options for {@link applyImportPlan}. */
interface ApplyImportOptions {
  /** The current workspace snapshot for pre-flight (defaults to empty — no pre-flight guarantees). */
  workspace?: ApplyWorkspace;
  /** Per-subject overrides of `defaultResolution` for conflict animals. */
  resolutions?: Record<string, 'add' | 'skip' | 'replace'>;
  /** Explicit catalog entries to merge before adding days to an existing animal. */
  catalogAdditions?: Record<string, { cameras?: unknown[]; data_acq_device?: unknown[] }>;
}

/** The outcome of {@link applyImportPlan}: created/skipped ids and recorded (never thrown) failures. */
interface ApplyImportResult {
  createdAnimals: string[];
  createdDays: string[];
  skipped: string[];
  failed: Array<{ subjectId: string; reason: string }>;
}

/**
 * Whether two catalog/reference values match exactly, without string-laundering numeric ids.
 *
 * @param a - First value.
 * @param b - Second value.
 * @returns True when the values are the same reference key.
 */
function sameRefValue(a: unknown, b: unknown): boolean {
  return Object.is(a, b);
}

/**
 * Add a non-empty decoded YAML camera id to a mutable list.
 *
 * @param refs - The list to append to.
 * @param value - The candidate camera id.
 */
function pushCameraRef(refs: unknown[], value: unknown): void {
  if (value === undefined || value === null || value === '') return;
  if (!refs.some((existing) => sameRefValue(existing, value))) refs.push(value);
}

/**
 * Camera ids a planned day will reference after it is added.
 *
 * @param day - The import-plan day.
 * @returns Referenced camera ids in first-seen order.
 */
function dayCameraRefs(day: ImportPlanDay): unknown[] {
  const refs: unknown[] = [];
  getDayCamerasUsed(day).forEach((cameraId) => pushCameraRef(refs, cameraId));
  getDayTasks(day).forEach((task) => {
    if (Array.isArray(task?.camera_id)) {
      task.camera_id.forEach((cameraId: unknown) => pushCameraRef(refs, cameraId));
    }
  });
  getDayAssociatedVideos(day).forEach((video) => pushCameraRef(refs, video?.camera_id));
  getDayFsGuiYamls(day).forEach((protocol) => pushCameraRef(refs, protocol?.camera_id));
  return refs;
}

/**
 * Validate selected catalog additions and all day refs for add-to-existing.
 *
 * @param animalPlan - The planned animal.
 * @param targetAnimal - The existing target animal.
 * @param additions - Explicit additions accepted by the user.
 * @returns A failure reason, or null when refs resolve.
 */
function preflightExistingAnimalCatalogRefs(
  animalPlan: ImportPlanAnimal,
  targetAnimal: unknown,
  additions: { cameras?: unknown[]; data_acq_device?: unknown[] } | undefined
): string | null {
  const existingCameras = getAnimalCameras(targetAnimal);
  const cameraIds: unknown[] = existingCameras.map((camera) => camera.id);
  const cameraNames = new Set(
    existingCameras
      .map((camera) => camera.camera_name)
      .filter((name) => name !== undefined && name !== null)
      .map((name) => String(name))
  );

  for (const camera of additions?.cameras ?? []) {
    if (!camera || typeof camera !== 'object') continue;
    const { id, camera_name: cameraName } = camera as { id?: unknown; camera_name?: unknown };
    if (cameraIds.some((existing) => sameRefValue(existing, id))) {
      return `Camera id "${String(id)}" already exists on animal "${animalPlan.existingAnimalId}".`;
    }
    if (cameraName !== undefined && cameraName !== null && cameraNames.has(String(cameraName))) {
      return `Camera "${String(cameraName)}" already exists on animal "${animalPlan.existingAnimalId}".`;
    }
    cameraIds.push(id);
    if (cameraName !== undefined && cameraName !== null) cameraNames.add(String(cameraName));
  }

  const existingDevices = getDataAcqDevices(targetAnimal);
  const deviceNames: unknown[] = existingDevices
    .map((device) => device.name)
    .filter((name) => name !== undefined && name !== null);
  for (const device of additions?.data_acq_device ?? []) {
    if (!device || typeof device !== 'object') continue;
    const name = (device as { name?: unknown }).name;
    if (deviceNames.some((existing) => sameRefValue(existing, name))) {
      return `Recording system "${String(name)}" already exists on animal "${animalPlan.existingAnimalId}".`;
    }
    deviceNames.push(name);
  }

  for (const day of animalPlan.days) {
    const missingCamera = dayCameraRefs(day).find(
      (cameraId) => !cameraIds.some((existing) => sameRefValue(existing, cameraId))
    );
    if (missingCamera !== undefined) {
      return `Imported day "${day.date}" references camera id "${String(missingCamera)}", but animal "${animalPlan.existingAnimalId}" does not have that camera.`;
    }
    const deviceName = day.data_acq_device_name;
    if (
      deviceName !== undefined &&
      !deviceNames.some((existing) => sameRefValue(existing, deviceName))
    ) {
      return `Imported day "${day.date}" references recording system "${String(deviceName)}", but animal "${animalPlan.existingAnimalId}" does not have that device.`;
    }
  }

  return null;
}

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
 * @param animalPlan - The planned animal.
 * @param resolution - The per-subject resolution (`'create'` / `'add'` / `'replace'`).
 * @param workspace - The current workspace slice (`{ animals, days }`), read-only.
 * @param reservedDayIds - Day ids already reserved by earlier-passed animals in this same call
 *   (read-only here; the caller commits the animal's ids on success).
 * @returns A failure reason, or `null` when safe to apply.
 */
function preflightAnimal(
  animalPlan: ImportPlanAnimal,
  resolution: string | null,
  workspace: ApplyWorkspace | null | undefined,
  reservedDayIds: Set<string>,
  catalogAdditions: Record<string, { cameras?: unknown[]; data_acq_device?: unknown[] }>
): string | null {
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
    const catalogFailure = preflightExistingAnimalCatalogRefs(
      animalPlan,
      animals[targetId],
      catalogAdditions[targetId]
    );
    if (catalogFailure !== null) return catalogFailure;
  } else if (animals[subjectId]) {
    // resolution === 'create' (new animal).
    return `Animal "${subjectId}" already exists; cannot import it as a new animal.`;
  }

  const seenInThisAnimal = new Set<string>();
  for (const day of animalPlan.days) {
    // `targetId` is non-null here: `replace` already returned, `add` was guarded above, and
    // `create` uses `subjectId` (a string) — so the preflight invariant guarantees it.
    const dayId = generateDayId(targetId!, day.date);
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
 * @param plan - The plan from `planImport`.
 * @param actions - The store's workspace actions (createAnimal, createDay,
 *   createConfigurationSnapshotAndApplyForward, updateDay, updateAnimal, deleteAnimal).
 * @param options - Apply options ({@link ApplyImportOptions}).
 * @param options.workspace - The CURRENT workspace snapshot used to PRE-FLIGHT each animal before
 *   any write (a collision is recorded in `failed`, never thrown out of a reducer). Defaults to an
 *   empty workspace (no pre-flight guarantees).
 * @param options.resolutions - Per-subject overrides of `defaultResolution` for conflict animals.
 * @param options.catalogAdditions - Explicit existing-animal catalog entries accepted by import
 *   repair and merged before adding days.
 * @returns The apply outcome; failures are RECORDED, never thrown.
 */
export function applyImportPlan(
  plan: ImportPlan,
  actions: ImportActions,
  {
    workspace = { animals: {}, days: {} },
    resolutions = {},
    catalogAdditions = {},
  }: ApplyImportOptions = {}
): ApplyImportResult {
  const createdAnimals: string[] = [];
  const createdDays: string[] = [];
  const skipped: string[] = [];
  const failed: Array<{ subjectId: string; reason: string }> = [];
  // Day ids reserved by earlier-passed animals in THIS call (defense in depth: lets pre-flight
  // reject an intra-plan duplicate day id even if a caller hands us a plan that wasn't deduped).
  const reservedDayIds = new Set<string>();

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
    const reason = preflightAnimal(
      animalPlan,
      resolution,
      workspace,
      reservedDayIds,
      catalogAdditions
    );
    if (reason !== null) {
      failed.push({ subjectId, reason });
      continue;
    }
    // Reserve this animal's day ids so a later animal in the same call can't collide with them.
    // `targetId` is non-null: preflight passed, so an `add` target exists and `create` uses subjectId.
    const targetId = resolution === 'add' ? animalPlan.existingAnimalId : subjectId;
    for (const day of animalPlan.days) {
      reservedDayIds.add(generateDayId(targetId!, day.date));
    }

    try {
      if (resolution === 'replace') {
        // Replace: delete the existing animal (+ its days) then recreate from the plan.
        // `existingAnimalId` is non-null here (preflight verified the animal exists to replace).
        actions.deleteAnimal(animalPlan.existingAnimalId!);
        applyNewAnimal(animalPlan, actions, createdAnimals, createdDays);
      } else if (resolution === 'add') {
        // Conflict → add: layer the plan's days (+ any config versions) onto the existing
        // animal without recreating it or clobbering its animal-level facts.
        applyAddToExistingAnimal(
          animalPlan,
          actions,
          createdDays,
          workspace,
          catalogAdditions[animalPlan.existingAnimalId!]
        );
      } else {
        // No conflict → create fresh.
        applyNewAnimal(animalPlan, actions, createdAnimals, createdDays);
      }
    } catch (error) {
      // Backstop only: pre-flight should already have caught any throwing precondition.
      failed.push({ subjectId, reason: (error as Error)?.message ?? String(error) });
    }
  }

  return { createdAnimals, createdDays, skipped, failed };
}

/**
 * Create a brand-new animal from a per-animal plan: seed version 1 from the EARLIEST config
 * + the resolved animal facts, add every day, append the later config versions (re-pinning
 * their days), and write each day's day-owned content through `updateDay`.
 *
 * @param animalPlan - The planned animal.
 * @param actions - The store workspace actions.
 * @param createdAnimals - Accumulator (mutated).
 * @param createdDays - Accumulator (mutated).
 */
function applyNewAnimal(
  animalPlan: ImportPlanAnimal,
  actions: ImportActions,
  createdAnimals: string[],
  createdDays: string[]
): void {
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
 * The executor still does NOT auto-merge full catalogs. It accepts only explicit, targeted
 * `catalogAdditions` selected by Import & Repair and preflights that every added day resolves
 * against the existing animal's catalogs plus those selected additions before issuing writes.
 *
 * @param animalPlan - The planned animal.
 * @param actions - The store workspace actions.
 * @param createdDays - Accumulator (mutated).
 * @param workspace - Current workspace snapshot used to build merged catalog arrays.
 * @param catalogAdditions - Explicit catalog entries accepted by the user.
 */
function applyAddToExistingAnimal(
  animalPlan: ImportPlanAnimal,
  actions: ImportActions,
  createdDays: string[],
  workspace: ApplyWorkspace,
  catalogAdditions: { cameras?: unknown[]; data_acq_device?: unknown[] } | undefined
): void {
  // Non-null here: `add` only runs after preflight confirmed the existing animal is present.
  const targetId = animalPlan.existingAnimalId!;
  const existingAnimal = workspace.animals?.[targetId];
  const animalUpdates: Record<string, unknown> = {};
  if ((catalogAdditions?.cameras ?? []).length > 0) {
    animalUpdates.cameras = [
      ...getAnimalCameras(existingAnimal),
      ...(catalogAdditions?.cameras ?? []).map((camera) => structuredClone(camera)),
    ];
  }
  if ((catalogAdditions?.data_acq_device ?? []).length > 0) {
    animalUpdates.data_acq_device = [
      ...getDataAcqDevices(existingAnimal),
      ...(catalogAdditions?.data_acq_device ?? []).map((device) => structuredClone(device)),
    ];
  }
  if (Object.keys(animalUpdates).length > 0) {
    actions.updateAnimal(targetId, animalUpdates);
  }

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
 * @param day - The planned import day.
 * @returns The updateDay payload.
 */
function dayOwnedUpdates(day: ImportPlanDay): Record<string, any> {
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
    // Bad channels are DAY-OWNED: write the per-ntrode override onto the day so the
    // export merge (`resolveDayConfig`, which reads the day override ONLY) preserves
    // them immediately — no reliance on the load-time base→day migration. Undefined
    // when the source carried no marks; `applyDayUpdates` ignores a falsy value.
    deviceOverrides: day.deviceOverrides,
  };
}
