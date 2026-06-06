/**
 * Workflow-category mapping (Phase 8.6 Task 6). Groups a validation issue into the
 * user-facing workflow category the Validation/Export summaries display, WITHOUT changing
 * where its repair routes (that stays `repairTargetForIssue`). The table is the analogue of
 * `SURFACE_BY_CODE`: every app-rule code is pinned to a category and tested here so a new
 * code can't silently fall through to a wrong group.
 */
import { describe, it, expect } from 'vitest';
import {
  WORKFLOW_CATEGORY,
  WORKFLOW_CATEGORY_ORDER,
  WORKFLOW_CATEGORY_LABELS,
  CATEGORY_BY_CODE,
  workflowCategoryForIssue,
  groupIssuesByWorkflowCategory,
} from '../workflowCategories';
import { SURFACE_BY_CODE } from '../validation';

describe('CATEGORY_BY_CODE table', () => {
  it('assigns every SURFACE_BY_CODE code a valid workflow category', () => {
    const valid = new Set(Object.values(WORKFLOW_CATEGORY));
    for (const code of Object.keys(SURFACE_BY_CODE)) {
      expect(CATEGORY_BY_CODE[code], `code "${code}" missing a category`).toBeDefined();
      expect(valid.has(CATEGORY_BY_CODE[code]), `code "${code}" → invalid category`).toBe(true);
    }
  });

  it('has a label and order entry for every category', () => {
    for (const category of Object.values(WORKFLOW_CATEGORY)) {
      expect(WORKFLOW_CATEGORY_LABELS[category]).toBeTruthy();
      expect(WORKFLOW_CATEGORY_ORDER).toContain(category);
    }
  });
});

describe('workflowCategoryForIssue — app-rule codes', () => {
  it('routes shared-hardware/geometry codes to animal_setup', () => {
    expect(workflowCategoryForIssue({ code: 'channel_value_out_of_range' })).toBe('animal_setup');
    expect(workflowCategoryForIssue({ code: 'empty_location' })).toBe('animal_setup');
    expect(workflowCategoryForIssue({ code: 'divergent_camera_identity' })).toBe('animal_setup');
    expect(workflowCategoryForIssue({ code: 'partial_configuration' })).toBe('animal_setup');
  });

  it('routes day-metadata codes to day_metadata', () => {
    expect(workflowCategoryForIssue({ code: 'dangling_camera_ref' })).toBe('day_metadata');
    expect(workflowCategoryForIssue({ code: 'duplicate_task_epoch' })).toBe('day_metadata');
    expect(workflowCategoryForIssue({ code: 'orphaned_video' })).toBe('day_metadata');
  });

  it('routes day-specific failed-channel codes to failed_channels', () => {
    expect(workflowCategoryForIssue({ code: 'bad_channel_out_of_range' })).toBe('failed_channels');
    expect(workflowCategoryForIssue({ code: 'multishank_bad_channels_ignored' })).toBe('failed_channels');
  });

  it('routes corrupt/recovered shapes to existing_data', () => {
    expect(workflowCategoryForIssue({ code: 'malformed_device_override' })).toBe('existing_data');
    expect(workflowCategoryForIssue({ code: 'stale_bad_channel_override' })).toBe('existing_data');
    expect(workflowCategoryForIssue({ code: 'malformed_animal_collection' })).toBe('existing_data');
    expect(workflowCategoryForIssue({ code: 'missing_configuration_history' })).toBe('existing_data');
  });
});

describe('workflowCategoryForIssue — AJV schema fallback (no app code)', () => {
  it('routes an animal-surface device schema error to animal_setup', () => {
    // No code; path routes to animal surface via repairTargetForIssue → animal_setup.
    expect(workflowCategoryForIssue({ instancePath: '/electrode_groups/0/device_type' })).toBe(
      'animal_setup'
    );
    expect(workflowCategoryForIssue({ instancePath: '/cameras/0/lens' })).toBe('animal_setup');
  });

  it('routes a day-surface session schema error to day_metadata', () => {
    expect(workflowCategoryForIssue({ instancePath: '/session_description' })).toBe('day_metadata');
    expect(workflowCategoryForIssue({ path: 'tasks[0].task_name' })).toBe('day_metadata');
  });

  it('never returns export_preflight from an issue (it is a readiness state, not an issue code)', () => {
    for (const code of Object.keys(CATEGORY_BY_CODE)) {
      expect(CATEGORY_BY_CODE[code]).not.toBe('export_preflight');
    }
  });
});

describe('groupIssuesByWorkflowCategory', () => {
  it('buckets issues by category in canonical order and drops empty buckets', () => {
    const issues = [
      { code: 'empty_location', severity: 'error', message: 'a' },
      { code: 'duplicate_task_epoch', severity: 'error', message: 'b' },
      { code: 'bad_channel_out_of_range', severity: 'warning', message: 'c' },
    ];
    const grouped = groupIssuesByWorkflowCategory(issues);
    expect(grouped.map((g) => g.category)).toEqual([
      'animal_setup',
      'day_metadata',
      'failed_channels',
    ]);
    expect(grouped[0].issues).toHaveLength(1);
    expect(grouped[0].label).toBe(WORKFLOW_CATEGORY_LABELS.animal_setup);
  });

  it('returns an empty array for no issues', () => {
    expect(groupIssuesByWorkflowCategory([])).toEqual([]);
  });
});
