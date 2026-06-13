/**
 * @fileoverview Workflow-category mapping for validation/export repair summaries.
 *
 * Phase 8.6 Task 6. The Validation and Export surfaces group blocking issues by the user's
 * workflow stage — animal setup, day metadata, day-specific failed channels, existing-data
 * repair, export/preflight — so a scientist reads the same five buckets there as on the
 * Animal Workspace setup checklist. This module decides ONLY the bucket; where a repair
 * actually routes stays owned by `repairTargetForIssue` (`./validation`). Surfaces render and
 * route; they never re-guess the category.
 *
 * `CATEGORY_BY_CODE` is the analogue of `SURFACE_BY_CODE`: every app-rule code is pinned to a
 * category and locked by a table test, so a new rule code can't silently fall into the wrong
 * group. AJV schema issues (no app code) fall back to the canonical repair surface/step.
 */

import { repairTargetForIssue } from './validation';
import type { RepairableIssue } from './repairRouting';

/** The five user-facing workflow categories. */
export type WorkflowCategory =
  | 'animal_setup'
  | 'day_metadata'
  | 'failed_channels'
  | 'existing_data'
  | 'export_preflight';

/** A workflow-category bucket of issues, as returned by {@link groupIssuesByWorkflowCategory}. */
export interface WorkflowCategoryBucket {
  /** The bucket's category. */
  category: WorkflowCategory;
  /** User-facing label. */
  label: string;
  /** Issues in this bucket. */
  issues: RepairableIssue[];
}

/**
 * The five user-facing workflow categories.
 *
 * `export_preflight` is a readiness STATE (the "ready for export" stage), not a destination
 * for any issue code — no issue maps to it; the Export surface uses it for the preflight
 * section header. The other four are where blocking issues are grouped.
 */
export const WORKFLOW_CATEGORY: Readonly<Record<string, WorkflowCategory>> = Object.freeze({
  ANIMAL_SETUP: 'animal_setup',
  DAY_METADATA: 'day_metadata',
  FAILED_CHANNELS: 'failed_channels',
  EXISTING_DATA: 'existing_data',
  EXPORT_PREFLIGHT: 'export_preflight',
});

/**
 * Display order for the categories — the workflow order (setup first, export last).
 */
export const WORKFLOW_CATEGORY_ORDER: readonly WorkflowCategory[] = Object.freeze([
  WORKFLOW_CATEGORY.ANIMAL_SETUP,
  WORKFLOW_CATEGORY.DAY_METADATA,
  WORKFLOW_CATEGORY.FAILED_CHANNELS,
  WORKFLOW_CATEGORY.EXISTING_DATA,
  WORKFLOW_CATEGORY.EXPORT_PREFLIGHT,
]);

/**
 * User-facing label for each category, worded to match the setup checklist.
 */
export const WORKFLOW_CATEGORY_LABELS: Readonly<Record<string, string>> = Object.freeze({
  animal_setup: 'Animal setup',
  day_metadata: 'Day metadata',
  failed_channels: 'Day-specific failed channels',
  existing_data: 'Existing data repair',
  export_preflight: 'Export / preflight',
});

/**
 * Authoritative category for each app-rule code (mirrors `SURFACE_BY_CODE`'s coverage). The
 * mapping follows the user's mental model of WHERE the fix belongs in their workflow:
 *  - shared hardware/geometry/camera/data-acq/opto + subject identity → animal setup;
 *  - this day's session/tasks/videos/files/event references → day metadata;
 *  - day-specific failed-channel marks → failed channels;
 *  - corrupt/recovered/stale shapes that need cleanup before trust → existing-data repair.
 */
export const CATEGORY_BY_CODE: Readonly<Record<string, WorkflowCategory>> = Object.freeze({
  // Shared animal hardware setup (device geometry, channel maps, probe catalog, cameras,
  // data-acq devices) and animal-level optogenetics.
  channel_value_out_of_range: WORKFLOW_CATEGORY.ANIMAL_SETUP,
  channel_key_out_of_range: WORKFLOW_CATEGORY.ANIMAL_SETUP,
  channel_partition_invalid: WORKFLOW_CATEGORY.ANIMAL_SETUP,
  channel_row_count_mismatch: WORKFLOW_CATEGORY.ANIMAL_SETUP,
  inconsistent_probe_catalog: WORKFLOW_CATEGORY.ANIMAL_SETUP,
  empty_location: WORKFLOW_CATEGORY.ANIMAL_SETUP,
  empty_targeted_location: WORKFLOW_CATEGORY.ANIMAL_SETUP,
  inconsistent_location_case: WORKFLOW_CATEGORY.ANIMAL_SETUP,
  unknown_device_type: WORKFLOW_CATEGORY.ANIMAL_SETUP,
  duplicate_electrode_group_id: WORKFLOW_CATEGORY.ANIMAL_SETUP,
  duplicate_ntrode_id: WORKFLOW_CATEGORY.ANIMAL_SETUP,
  dangling_electrode_group_ref: WORKFLOW_CATEGORY.ANIMAL_SETUP,
  duplicate_channels: WORKFLOW_CATEGORY.ANIMAL_SETUP,
  missing_channels: WORKFLOW_CATEGORY.ANIMAL_SETUP,
  duplicate_camera_id: WORKFLOW_CATEGORY.ANIMAL_SETUP,
  divergent_camera_identity: WORKFLOW_CATEGORY.ANIMAL_SETUP,
  divergent_data_acq_identity: WORKFLOW_CATEGORY.ANIMAL_SETUP,
  // Task-type catalog DEFINITION uniqueness is shared animal setup (the Task Types tab).
  duplicate_task_type_name: WORKFLOW_CATEGORY.ANIMAL_SETUP,
  partial_configuration: WORKFLOW_CATEGORY.ANIMAL_SETUP,
  multiple_excitation_sources: WORKFLOW_CATEGORY.ANIMAL_SETUP,
  // Optical-fiber / virus-injection coordinate reference is part of the animal's opto setup.
  missing_opto_reference: WORKFLOW_CATEGORY.ANIMAL_SETUP,
  // Subject identity is part of the animal's shared setup (set at animal creation; species is
  // the one editable in the Day Overview, but it still belongs to the Subject setup item).
  invalid_species: WORKFLOW_CATEGORY.ANIMAL_SETUP,
  subject_id_slash: WORKFLOW_CATEGORY.ANIMAL_SETUP,
  session_id_slash: WORKFLOW_CATEGORY.ANIMAL_SETUP,

  // This recording day's metadata (tasks, videos, files, behavioral events, camera refs).
  dangling_camera_ref: WORKFLOW_CATEGORY.DAY_METADATA,
  // The day's chosen recording system (data_acq_device_name) points at a catalog entry that no longer
  // exists — fixed in the day's setup (which system it used). Day metadata, like the camera ref.
  dangling_data_acq_ref: WORKFLOW_CATEGORY.DAY_METADATA,
  duplicate_behavioral_event_name: WORKFLOW_CATEGORY.DAY_METADATA,
  duplicate_behavioral_event_description: WORKFLOW_CATEGORY.DAY_METADATA,
  duplicate_task_epoch: WORKFLOW_CATEGORY.DAY_METADATA,
  // Task-type catalog day-side issues: a day instance referencing a missing type, a task type using
  // a camera the day did not mark used, and a migration-time definition reconciliation to review.
  dangling_task_type_ref: WORKFLOW_CATEGORY.DAY_METADATA,
  task_camera_not_used: WORKFLOW_CATEGORY.DAY_METADATA,
  task_definition_reconciled: WORKFLOW_CATEGORY.DAY_METADATA,
  orphaned_video: WORKFLOW_CATEGORY.DAY_METADATA,
  orphaned_file: WORKFLOW_CATEGORY.DAY_METADATA,
  orphaned_fs_gui_epoch: WORKFLOW_CATEGORY.DAY_METADATA,
  // Day FsGUI (opto protocol) reference rules — the fix lives in the day's epochs/FsGUI flow.
  dangling_dio_output: WORKFLOW_CATEGORY.DAY_METADATA,
  fs_gui_requires_optogenetics: WORKFLOW_CATEGORY.DAY_METADATA,
  divergent_task_identity: WORKFLOW_CATEGORY.DAY_METADATA,
  missing_camera: WORKFLOW_CATEGORY.DAY_METADATA,

  // Day-specific failed (bad) channels.
  bad_channel_out_of_range: WORKFLOW_CATEGORY.FAILED_CHANNELS,
  multishank_bad_channels_ignored: WORKFLOW_CATEGORY.FAILED_CHANNELS,
  bad_channel_unfailed_without_ack: WORKFLOW_CATEGORY.FAILED_CHANNELS,
  bad_channels_on_override_row_ignored: WORKFLOW_CATEGORY.FAILED_CHANNELS,

  // Corrupt / recovered / stale shapes that must be cleaned up before the data is trusted.
  stale_bad_channel_override: WORKFLOW_CATEGORY.EXISTING_DATA,
  malformed_bad_channel_override: WORKFLOW_CATEGORY.EXISTING_DATA,
  malformed_device_override: WORKFLOW_CATEGORY.EXISTING_DATA,
  shadowed_geometry_override: WORKFLOW_CATEGORY.EXISTING_DATA,
  malformed_day_collection: WORKFLOW_CATEGORY.EXISTING_DATA,
  malformed_day_session: WORKFLOW_CATEGORY.EXISTING_DATA,
  malformed_animal_collection: WORKFLOW_CATEGORY.EXISTING_DATA,
  missing_configuration_history: WORKFLOW_CATEGORY.EXISTING_DATA,
  // A recovered/imported day with no pinned configuration version — repaired by pinning a
  // version in the Day Devices step.
  unpinned_configuration: WORKFLOW_CATEGORY.EXISTING_DATA,
});

/**
 * The workflow category for a validation issue. Prefers the pinned app-rule code; otherwise
 * (AJV schema issues, which carry no app code) derives from the canonical repair target:
 * an animal/none surface is animal setup, a day surface is day metadata. Day-owned device and
 * override codes already carry an app code, so the day fallback only ever sees session/task
 * schema errors — hence day_metadata is the safe default there.
 *
 * @param issue
 * @returns One of the WORKFLOW_CATEGORY values (never `export_preflight`).
 */
export function workflowCategoryForIssue(issue: RepairableIssue): WorkflowCategory {
  const byCode = CATEGORY_BY_CODE[issue?.code as string];
  if (byCode) return byCode;

  const { surface } = repairTargetForIssue(issue);
  if (surface === 'animal' || surface === 'none') return WORKFLOW_CATEGORY.ANIMAL_SETUP;
  return WORKFLOW_CATEGORY.DAY_METADATA;
}

/**
 * Group issues into ordered category buckets (empty buckets dropped). Each bucket is
 * `{ category, label, issues }`, in `WORKFLOW_CATEGORY_ORDER`.
 *
 * @param issues - Validation issues.
 * @returns
 */
export function groupIssuesByWorkflowCategory(issues: RepairableIssue[]): WorkflowCategoryBucket[] {
  const byCategory = new Map<WorkflowCategory, RepairableIssue[]>();
  for (const issue of Array.isArray(issues) ? issues : []) {
    const category = workflowCategoryForIssue(issue);
    if (!byCategory.has(category)) byCategory.set(category, []);
    // The `has`/`set` immediately above guarantees the bucket exists.
    byCategory.get(category)!.push(issue);
  }
  return WORKFLOW_CATEGORY_ORDER.filter((category) => byCategory.has(category)).map((category) => ({
    category,
    label: WORKFLOW_CATEGORY_LABELS[category],
    issues: byCategory.get(category)!,
  }));
}
