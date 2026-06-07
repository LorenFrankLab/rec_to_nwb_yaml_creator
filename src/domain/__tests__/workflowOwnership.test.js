/**
 * Ownership descriptor (Phase 8.7 Task 1). Maps a validation issue / field path / section id
 * to the INTERNAL ownership pattern plus the user-facing vocabulary (label, cue, day-behavior
 * copy, primary action) and the edit surface. It does NOT introduce a third parallel
 * `code → meaning` table: it reuses `repairTargetForIssue` (edit surface) and
 * `workflowCategoryForIssue` / `CATEGORY_BY_CODE` (workflow category), maps each category to a
 * default ownership pattern, and applies a SPARSE per-code refinement only where ownership is
 * finer than the category default. The completeness test below is the analogue of the existing
 * `CATEGORY_BY_CODE` ↔ `SURFACE_BY_CODE` invariant: no validator code may be left unowned, and
 * the refinement may not name a stale code.
 */
import { describe, it, expect } from 'vitest';
import {
  OWNERSHIP_PATTERN,
  OWNERSHIP_PATTERN_META,
  CATEGORY_DEFAULT_PATTERN,
  PATTERN_REFINEMENT_BY_CODE,
  ownershipForIssue,
  ownershipForFieldPath,
  ownershipForSection,
} from '../workflowOwnership';
import { SURFACE_BY_CODE } from '../validation';
import { CATEGORY_BY_CODE, WORKFLOW_CATEGORY } from '../workflowCategories';

const ALL_PATTERNS = new Set(Object.values(OWNERSHIP_PATTERN));

/**
 * Every field a descriptor must carry, non-empty.
 * @param descriptor
 */
function expectWellFormedDescriptor(descriptor) {
  expect(descriptor).toBeTruthy();
  expect(ALL_PATTERNS.has(descriptor.pattern), `unknown pattern "${descriptor.pattern}"`).toBe(true);
  expect(typeof descriptor.label).toBe('string');
  expect(descriptor.label.length).toBeGreaterThan(0);
  expect(typeof descriptor.cue).toBe('string');
  expect(descriptor.cue.length).toBeGreaterThan(0);
  expect(typeof descriptor.dayBehavior).toBe('string');
  expect(descriptor.dayBehavior.length).toBeGreaterThan(0);
  expect(typeof descriptor.primaryAction).toBe('string');
  expect(descriptor.primaryAction.length).toBeGreaterThan(0);
  expect(typeof descriptor.reachesBeyondDay).toBe('boolean');
  expect(['day', 'animal', 'none']).toContain(descriptor.editSurface);
}

describe('OWNERSHIP_PATTERN_META table', () => {
  it('has complete, well-formed metadata for every pattern', () => {
    for (const pattern of Object.values(OWNERSHIP_PATTERN)) {
      const meta = OWNERSHIP_PATTERN_META[pattern];
      expect(meta, `pattern "${pattern}" missing meta`).toBeTruthy();
      expect(meta.label).toBeTruthy();
      expect(meta.cue).toBeTruthy();
      expect(meta.dayBehavior).toBeTruthy();
      expect(meta.primaryAction).toBeTruthy();
      expect(typeof meta.reachesBeyondDay).toBe('boolean');
    }
  });

  it('maps every workflow category (except export_preflight) to a default pattern', () => {
    for (const category of Object.values(WORKFLOW_CATEGORY)) {
      if (category === WORKFLOW_CATEGORY.EXPORT_PREFLIGHT) continue;
      const pattern = CATEGORY_DEFAULT_PATTERN[category];
      expect(pattern, `category "${category}" has no default pattern`).toBeTruthy();
      expect(ALL_PATTERNS.has(pattern)).toBe(true);
    }
  });
});

describe('completeness invariant — no validator code left unowned', () => {
  it('resolves every SURFACE_BY_CODE code to a well-formed descriptor', () => {
    for (const code of Object.keys(SURFACE_BY_CODE)) {
      const descriptor = ownershipForIssue({ code });
      expectWellFormedDescriptor(descriptor);
    }
  });

  it('resolves every CATEGORY_BY_CODE code to a well-formed descriptor', () => {
    for (const code of Object.keys(CATEGORY_BY_CODE)) {
      expectWellFormedDescriptor(ownershipForIssue({ code }));
    }
  });

  it('the sparse refinement names no stale code (every key exists in SURFACE_BY_CODE)', () => {
    for (const code of Object.keys(PATTERN_REFINEMENT_BY_CODE)) {
      expect(SURFACE_BY_CODE[code], `refinement code "${code}" not in SURFACE_BY_CODE`).toBeDefined();
      expect(ALL_PATTERNS.has(PATTERN_REFINEMENT_BY_CODE[code])).toBe(true);
    }
  });

  it('the edit surface always equals repairTargetForIssue (never re-decided)', async () => {
    const { repairTargetForIssue } = await import('../validation');
    for (const code of Object.keys(SURFACE_BY_CODE)) {
      expect(ownershipForIssue({ code }).editSurface).toBe(repairTargetForIssue({ code }).surface);
    }
  });
});

describe('ownershipForIssue — pattern refinement', () => {
  it('geometry / channel-map codes are a pinned configuration version', () => {
    for (const code of [
      'channel_value_out_of_range',
      'channel_key_out_of_range',
      'missing_channels',
      'duplicate_channels',
      'duplicate_ntrode_id',
      'unknown_device_type',
      'duplicate_electrode_group_id',
      'empty_location',
    ]) {
      expect(ownershipForIssue({ code }).pattern, code).toBe(OWNERSHIP_PATTERN.CONFIGURATION_VERSION);
    }
  });

  it('camera identity AND day camera references are animal-catalog references', () => {
    for (const code of ['duplicate_camera_id', 'divergent_camera_identity', 'dangling_camera_ref', 'missing_camera']) {
      expect(ownershipForIssue({ code }).pattern, code).toBe(OWNERSHIP_PATTERN.ANIMAL_CATALOG_REFERENCE);
    }
  });

  it('task-epoch and fs_gui-epoch codes are task-epoch assignments', () => {
    for (const code of ['duplicate_task_epoch', 'divergent_task_identity', 'orphaned_fs_gui_epoch']) {
      expect(ownershipForIssue({ code }).pattern, code).toBe(OWNERSHIP_PATTERN.TASK_EPOCH_ASSIGNMENT);
    }
  });

  it('behavioral-event codes are a day-exported list', () => {
    for (const code of ['duplicate_behavioral_event_name', 'duplicate_behavioral_event_description']) {
      expect(ownershipForIssue({ code }).pattern, code).toBe(OWNERSHIP_PATTERN.DAY_EXPORTED_LIST);
    }
  });

  it('data-acq and opto setup codes are shared animal setup', () => {
    for (const code of ['divergent_data_acq_identity', 'partial_configuration', 'multiple_excitation_sources']) {
      expect(ownershipForIssue({ code }).pattern, code).toBe(OWNERSHIP_PATTERN.ANIMAL_SETUP);
    }
  });

  it('subject identity codes are shared animal setup (constant facts)', () => {
    for (const code of ['invalid_species', 'subject_id_slash', 'session_id_slash']) {
      expect(ownershipForIssue({ code }).pattern, code).toBe(OWNERSHIP_PATTERN.ANIMAL_SETUP);
    }
  });

  it('day-specific failed channels are day facts', () => {
    for (const code of ['bad_channel_out_of_range', 'multishank_bad_channels_ignored']) {
      expect(ownershipForIssue({ code }).pattern, code).toBe(OWNERSHIP_PATTERN.DAY_FACT);
    }
  });

  it('orphaned video/file references are day facts', () => {
    for (const code of ['orphaned_video', 'orphaned_file']) {
      expect(ownershipForIssue({ code }).pattern, code).toBe(OWNERSHIP_PATTERN.DAY_FACT);
    }
  });

  it('unpinned configuration routes to the configuration-version (pin) pattern', () => {
    expect(ownershipForIssue({ code: 'unpinned_configuration' }).pattern).toBe(
      OWNERSHIP_PATTERN.CONFIGURATION_VERSION
    );
  });

  it('malformed/recovered shapes route to the recovered-data repair pattern', () => {
    for (const code of [
      'malformed_device_override',
      'stale_bad_channel_override',
      'malformed_day_collection',
      'malformed_animal_collection',
      'missing_configuration_history',
      'shadowed_geometry_override',
    ]) {
      expect(ownershipForIssue({ code }).pattern, code).toBe(OWNERSHIP_PATTERN.RECOVERED_DATA);
    }
  });
});

describe('ownershipForIssue — edit surface and blast radius are orthogonal', () => {
  it('species is animal-owned (blast radius) but editable from the Day Overview surface', () => {
    const descriptor = ownershipForIssue({ code: 'invalid_species' });
    expect(descriptor.pattern).toBe(OWNERSHIP_PATTERN.ANIMAL_SETUP);
    expect(descriptor.editSurface).toBe('day');
    expect(descriptor.reachesBeyondDay).toBe(true);
  });

  it('a slash-id identity error has no in-app edit surface', () => {
    expect(ownershipForIssue({ code: 'subject_id_slash' }).editSurface).toBe('none');
  });

  it('day facts do not reach beyond the day; shared setup does', () => {
    expect(ownershipForIssue({ code: 'orphaned_video' }).reachesBeyondDay).toBe(false);
    expect(ownershipForIssue({ code: 'bad_channel_out_of_range' }).reachesBeyondDay).toBe(false);
    expect(ownershipForIssue({ code: 'divergent_data_acq_identity' }).reachesBeyondDay).toBe(true);
    expect(ownershipForIssue({ code: 'empty_location' }).reachesBeyondDay).toBe(true);
  });
});

describe('ownershipForIssue — AJV schema fallback (no app code)', () => {
  it('falls back to the category default pattern for a code-less day session error', () => {
    expect(ownershipForIssue({ instancePath: '/session_description' }).pattern).toBe(
      OWNERSHIP_PATTERN.DAY_FACT
    );
  });

  it('returns a well-formed descriptor for an unknown/empty issue', () => {
    expectWellFormedDescriptor(ownershipForIssue({}));
    expectWellFormedDescriptor(ownershipForIssue(null));
  });
});

describe('ownershipForFieldPath', () => {
  it('maps a camera identity path to an animal-catalog reference', () => {
    expect(ownershipForFieldPath('/cameras/0/lens').pattern).toBe(
      OWNERSHIP_PATTERN.ANIMAL_CATALOG_REFERENCE
    );
    expect(ownershipForFieldPath('cameras[0].meters_per_pixel').pattern).toBe(
      OWNERSHIP_PATTERN.ANIMAL_CATALOG_REFERENCE
    );
  });

  it('maps electrode/ntrode paths to a configuration version', () => {
    expect(ownershipForFieldPath('electrode_groups[0].location').pattern).toBe(
      OWNERSHIP_PATTERN.CONFIGURATION_VERSION
    );
    expect(ownershipForFieldPath('/ntrode_electrode_group_channel_map/0/map').pattern).toBe(
      OWNERSHIP_PATTERN.CONFIGURATION_VERSION
    );
  });

  it('maps task and fs_gui paths to a task-epoch assignment', () => {
    expect(ownershipForFieldPath('tasks[0].camera_id').pattern).toBe(
      OWNERSHIP_PATTERN.TASK_EPOCH_ASSIGNMENT
    );
    expect(ownershipForFieldPath('fs_gui_yamls[0].epochs').pattern).toBe(
      OWNERSHIP_PATTERN.TASK_EPOCH_ASSIGNMENT
    );
  });

  it('maps rig constants to the recording-system default → day-value pattern', () => {
    expect(ownershipForFieldPath('raw_data_to_volts').pattern).toBe(
      OWNERSHIP_PATTERN.SETUP_DEFAULT_TO_DAY
    );
    expect(ownershipForFieldPath('times_period_multiplier').pattern).toBe(
      OWNERSHIP_PATTERN.SETUP_DEFAULT_TO_DAY
    );
  });

  it('maps the header path and weight to day facts', () => {
    expect(ownershipForFieldPath('default_header_file_path').pattern).toBe(OWNERSHIP_PATTERN.DAY_FACT);
    expect(ownershipForFieldPath('subject.weight').pattern).toBe(OWNERSHIP_PATTERN.DAY_FACT);
  });

  it('maps data-acq to shared animal setup, not a catalog camera', () => {
    expect(ownershipForFieldPath('data_acq_device[0].amplifier').pattern).toBe(
      OWNERSHIP_PATTERN.ANIMAL_SETUP
    );
  });

  it('returns a well-formed descriptor for an unmapped path', () => {
    expectWellFormedDescriptor(ownershipForFieldPath('something_unmapped'));
    expectWellFormedDescriptor(ownershipForFieldPath(''));
  });
});

describe('ownershipForSection', () => {
  it('maps known section ids to their ownership pattern', () => {
    expect(ownershipForSection('cameras').pattern).toBe(OWNERSHIP_PATTERN.ANIMAL_CATALOG_REFERENCE);
    expect(ownershipForSection('data_acq_device').pattern).toBe(OWNERSHIP_PATTERN.ANIMAL_SETUP);
    expect(ownershipForSection('electrode_groups').pattern).toBe(
      OWNERSHIP_PATTERN.CONFIGURATION_VERSION
    );
    expect(ownershipForSection('behavioral_events').pattern).toBe(OWNERSHIP_PATTERN.DAY_EXPORTED_LIST);
    expect(ownershipForSection('tasks').pattern).toBe(OWNERSHIP_PATTERN.TASK_EPOCH_ASSIGNMENT);
    expect(ownershipForSection('optogenetics').pattern).toBe(OWNERSHIP_PATTERN.ANIMAL_SETUP);
  });

  it('returns a well-formed descriptor for an unknown section', () => {
    expectWellFormedDescriptor(ownershipForSection('not_a_section'));
  });
});
