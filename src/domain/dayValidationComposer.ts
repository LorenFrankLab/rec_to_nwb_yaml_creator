/**
 * @fileoverview The day-validation composer — the authoritative issue list for a day.
 *
 * {@link validateDay} folds together, in order: raw-shape issues for the persisted day AND
 * animal (Boundary 1), schema + rules over the merged model with day-overridden geometry errors
 * re-tagged to the day surface by provenance (Boundary 2), the malformed/stale/shadowing
 * `deviceOverrides` family + the data-acq / bad-channel / unpinned export blockers
 * ({@link module:domain/dayOverrideValidation}), and the task-type catalog issues — then stamps
 * every issue with the canonical ownership contract ({@link normalizeIssue}). It is the SINGLE
 * source the export gate ({@link module:domain/stepStatus}'s `computeStepStatus`) and the rendered
 * repair lists share, so a blocking issue is never gated-but-invisible. Extracted from
 * `domain/validation.js` (Phase 9a) with no behavior change.
 */

import { validate } from '../validation';
import { validateRawDay, validateRawAnimal } from '../validation/rawShape';
import {
  animalTaskCatalogIssues,
  dayTaskCatalogIssues,
} from '../validation/taskCatalogValidation';
import { dayGeometryProvenance, tagBaseOwnershipByProvenance } from './geometryProvenance';
import {
  dayOverrideIssues,
  unpinnedConfigurationIssues,
  danglingDataAcqRefIssue,
  divergentDataAcqCatalogIssue,
  badChannelUnfailIssues,
} from './dayOverrideValidation';
import { repairTargetForIssue, REPAIR_SURFACES } from './repairRouting';
import type { RepairableIssue } from './repairRouting';
import { epochVideoUndeclared } from './epochVideoValidation';
import type { ValidationModel } from '../validation/issueTypes';

/**
 * The authoritative validation issue list for a day (see the contract note above
 * {@link computeStepStatus}'s caller chain). The SINGLE source the export gate and the
 * rendered repair lists share, so a blocking issue is never gated-but-invisible.
 *
 * `day`/`mergedDay` are the permissive merged-model boundary (`Record<string, any>`): every
 * downstream producer reads them tolerantly (raw-shape guards, optional chaining) and the typed
 * guarantee of this layer is the produced `RepairableIssue[]`, not the untyped persisted input.
 *
 * @param day - The day record.
 * @param mergedDay - Merged animal + day metadata.
 * @param animal - The owning animal (optional); folds raw animal-shape issues
 *   (e.g. a non-array `cameras`) into the export gate.
 * @param animalDays - The animal's day records (optional); enables the bad-channel
 *   monotonicity export-block (cross-day comparison against earlier same-config days).
 *   Empty/omitted → no cross-day comparison (back-compat).
 * @returns All validation issues for the day (each ownership-normalized).
 */
export function validateDay(
  day: ValidationModel,
  mergedDay: ValidationModel,
  animal?: unknown,
  animalDays: unknown[] = []
): RepairableIssue[] {
  // Boundary 1: validate the RAW persisted day AND animal shape FIRST — before the merge
  // launders a corrupt collection (`tasks: {}`, `animal.cameras: "nope"`) into an empty
  // export default that the merged-model validation below would see as clean. These block
  // export on raw corruption regardless of how the merge would launder it. `animal` is
  // optional (call sites that have it pass it); without it, animal raw issues are skipped.
  const raw = validateRawDay(day);
  const rawAnimal = validateRawAnimal(animal);
  // Compute the base (schema + rules) issues once, then pass them to dayOverrideIssues
  // so it can tell an erroring array geometry override (a dead-end that needs a day-routed
  // escape) from a clean one (which must NOT be flagged).
  const base = validate(mergedDay);
  // Boundary 2: ownership by PROVENANCE, not path. A geometry error's owner depends on
  // WHERE the merged geometry came from — the animal snapshot (animal-owned, edit there)
  // or a day-level override (day-owned, the snapshot is the wrong editor). Re-tag base
  // geometry errors to the day when the day overrides that geometry, so they don't
  // dead-end on "Fix in Animal Setup".
  const taggedBase = tagBaseOwnershipByProvenance(base, dayGeometryProvenance(day));
  // Stamp every issue with the canonical ownership contract (normalizeIssue) so consumers
  // read `ownerSurface`/`step`/`focusPath` directly — never re-inferring — and an issue
  // with no resolvable owner throws loudly instead of silently routing to the Day Editor.
  return [
    ...raw,
    ...rawAnimal,
    ...taggedBase,
    ...dayOverrideIssues(day, mergedDay, base),
    ...unpinnedConfigurationIssues(day, animal),
    ...danglingDataAcqRefIssue(day, animal),
    ...divergentDataAcqCatalogIssue(animal),
    ...badChannelUnfailIssues(day, animal, animalDays),
    // Task-type catalog (Phase 8C): catalog-level task_name uniqueness is animal-owned;
    // dangling type refs / task_camera_not_used / migration reconciliations are day-owned. For an
    // inline (unmigrated) day with no taskTypes/taskInstances these are all empty — no-op. The
    // resolved-tasks rule `divergent_task_identity` (in `validate(mergedDay)`) cannot fire for
    // catalog data (the catalog dedups by name), so the two do not double-report.
    ...animalTaskCatalogIssues(animal),
    ...dayTaskCatalogIssues(animal, day),
    // Phase 4: the video-declaration readiness rule (the ONE authorized new rule). It reads the
    // RAW day's task epochs + associated videos + the OFF-EXPORT `videolessEpochs` set — never the
    // merged YAML — so it adds a day-readiness blocker without touching export (a flagged epoch's
    // row reads `Needs video`). Deliberately NOT in `validate(mergedDay)`, which is export-shaped.
    ...epochVideoUndeclared(day),
  ].map(normalizeIssue);
}

/**
 * Canonicalize a validation issue so the ownership contract is ENFORCED, not conventional.
 * The owner is resolved ONCE here (the same chain {@link repairTargetForIssue} uses) and
 * stamped explicitly: `ownerSurface` (mirrored to the legacy `repairSurface` so a consumer
 * reading either gets the same answer), a guaranteed `focusPath` (the schema `path` when no
 * explicit anchor was set), and — for a day issue — the resolved `step`. The never-read
 * `repairStep` issue field is dropped so the field generations can't drift. An issue that
 * resolves to no valid surface throws (a contract violation must be loud, never a silent
 * default-to-Day).
 *
 * @param issue - A raw validation issue.
 * @returns The issue with canonical ownership/focus fields.
 */
function normalizeIssue(issue: RepairableIssue): RepairableIssue {
  if (!issue || typeof issue !== 'object') return issue;
  const { surface, step } = repairTargetForIssue(issue);
  if (!REPAIR_SURFACES.has(surface)) {
    throw new Error(
      `normalizeIssue: unresolved ownerSurface for code="${issue.code}" path="${issue.path || issue.instancePath || ''}"`
    );
  }
  // `next` is typed as an index-signature record so the legacy `repairStep` alias can be
  // `delete`d (a declared-required key cannot be) before the result is returned as a RepairableIssue.
  const next: Record<string, unknown> = {
    ...issue,
    ownerSurface: surface,
    repairSurface: surface,
    focusPath: issue.focusPath || issue.path || issue.instancePath,
  };
  // `step` routes only the day surface (animal/none go to their own editors); stamp the
  // resolved day step so grouping/focus read one field, and drop the dead alias.
  if (surface === 'day' && step != null) next.step = step;
  delete next.repairStep;
  return next as RepairableIssue;
}
