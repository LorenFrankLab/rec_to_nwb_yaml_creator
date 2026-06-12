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
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import {
  OWNERSHIP_PATTERN,
  OWNERSHIP_PATTERN_META,
  CATEGORY_DEFAULT_PATTERN,
  PATTERN_REFINEMENT_BY_CODE,
  ownershipForIssue,
  ownershipForFieldPath,
  ownershipForSection,
} from '../workflowOwnership';
import { SURFACE_BY_CODE, repairTargetForIssue } from '../validation';
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

  it('the edit surface always equals repairTargetForIssue (never re-decided)', () => {
    for (const code of Object.keys(SURFACE_BY_CODE)) {
      expect(ownershipForIssue({ code }).editSurface).toBe(repairTargetForIssue({ code }).surface);
    }
  });
});

/**
 * The table-key invariants above only prove the tables are self-consistent. This guard closes
 * the real hole: a validator code that the rules EMIT but no table lists would be silently
 * unowned (it happened — `dangling_dio_output`, `fs_gui_requires_optogenetics`,
 * `missing_opto_reference`). It scans the rule sources for both emission forms used in this
 * codebase — `code: '<literal>'` object properties and the `identityDivergences(...)` positional
 * `'divergent_*_identity'` args — and asserts every emitted app code is owned by all three
 * tables. AJV keyword codes (`required`/`pattern`/`type`, produced as `error.keyword`, never as a
 * hardcoded literal) are intentionally NOT covered here: they carry no app code and route via
 * path derivation.
 */
describe('completeness invariant — every EMITTED validator code is owned (source scan)', () => {
  const domainDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../');
  const validationDir = path.resolve(domainDir, '../validation');

  /**
   * Collect hardcoded app-rule code literals from a tree's non-test `.js`/`.ts` sources.
   * Scans BOTH extensions so the invariant survives the incremental TypeScript migration —
   * validator codes emit from `.ts` modules too (Phase 9a moved the override/data-acq producers
   * to `domain/dayOverrideValidation.ts`; `validation/taskCatalogValidation.ts` was already `.ts`).
   * @param dir
   */
  function emittedCodesIn(dir) {
    const codes = new Set();
    const files = readdirSync(dir, { recursive: true })
      .map((rel) => String(rel).split(path.sep).join('/'))
      .filter((rel) => /\.[jt]s$/.test(rel) && !rel.includes('__tests__/') && !rel.includes('__mocks__/'));
    for (const rel of files) {
      const text = readFileSync(path.join(dir, rel), 'utf8');
      // Form 1: `code: 'snake_case'` object property.
      for (const m of text.matchAll(/\bcode:\s*'([a-z][a-z_]+)'/g)) codes.add(m[1]);
      // Form 2: positional `'divergent_*_identity'` arg to the identityDivergences helper.
      for (const m of text.matchAll(/'(divergent_[a-z_]+_identity)'/g)) codes.add(m[1]);
    }
    return codes;
  }

  const emitted = new Set([...emittedCodesIn(domainDir), ...emittedCodesIn(validationDir)]);

  it('found a sane number of emitted codes (guards against a vacuous scan)', () => {
    expect(emitted.size).toBeGreaterThan(40);
  });

  it('every emitted app code is in SURFACE_BY_CODE, CATEGORY_BY_CODE, and ownership', () => {
    const unowned = [];
    for (const code of emitted) {
      if (SURFACE_BY_CODE[code] === undefined) unowned.push(`${code} (SURFACE_BY_CODE)`);
      if (CATEGORY_BY_CODE[code] === undefined) unowned.push(`${code} (CATEGORY_BY_CODE)`);
      const descriptor = ownershipForIssue({ code });
      if (!ALL_PATTERNS.has(descriptor.pattern)) unowned.push(`${code} (ownership)`);
    }
    expect(unowned, `emitted codes missing from a table:\n${unowned.join('\n')}`).toEqual([]);
  });

  it('catches the three FsGUI/opto codes the original table-only scan missed', () => {
    for (const code of ['dangling_dio_output', 'fs_gui_requires_optogenetics', 'missing_opto_reference']) {
      expect(emitted.has(code), `${code} not found by source scan`).toBe(true);
      expect(SURFACE_BY_CODE[code]).toBeDefined();
      expect(CATEGORY_BY_CODE[code]).toBeDefined();
      expectWellFormedDescriptor(ownershipForIssue({ code }));
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

  it('task-epoch, fs_gui-epoch, and FsGUI DIO/opto-gate codes are task-epoch assignments', () => {
    for (const code of [
      'duplicate_task_epoch',
      'divergent_task_identity',
      'orphaned_fs_gui_epoch',
      'dangling_dio_output',
      'fs_gui_requires_optogenetics',
    ]) {
      expect(ownershipForIssue({ code }).pattern, code).toBe(OWNERSHIP_PATTERN.TASK_EPOCH_ASSIGNMENT);
    }
  });

  it('the missing opto coordinate reference is shared animal setup', () => {
    expect(ownershipForIssue({ code: 'missing_opto_reference' }).pattern).toBe(
      OWNERSHIP_PATTERN.ANIMAL_SETUP
    );
    expect(ownershipForIssue({ code: 'missing_opto_reference' }).editSurface).toBe('animal');
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

  it('a DAY-side repair of a catalog/config issue is day-local (does not warn "touches N days")', () => {
    // Selecting a camera for this day, or pinning this day, are day-local even though the
    // PATTERN (catalog/config) is animal-owned. reachesBeyondDay must follow the repair scope.
    for (const code of ['dangling_camera_ref', 'missing_camera', 'unpinned_configuration']) {
      const descriptor = ownershipForIssue({ code });
      expect(descriptor.editSurface, code).toBe('day');
      expect(descriptor.reachesBeyondDay, code).toBe(false);
    }
  });

  it('an ANIMAL-side repair of the same catalog/config domain DOES reach beyond the day', () => {
    // Editing the catalog identity / geometry itself reaches the days that reference/pin it.
    expect(ownershipForIssue({ code: 'divergent_camera_identity' }).reachesBeyondDay).toBe(true);
    expect(ownershipForIssue({ code: 'duplicate_camera_id' }).reachesBeyondDay).toBe(true);
    expect(ownershipForIssue({ code: 'channel_value_out_of_range' }).reachesBeyondDay).toBe(true);
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

  it('maps rig constants (seeded from animal defaults) to the default → day-value pattern', () => {
    expect(ownershipForFieldPath('raw_data_to_volts').pattern).toBe(
      OWNERSHIP_PATTERN.SETUP_DEFAULT_TO_DAY
    );
    expect(ownershipForFieldPath('times_period_multiplier').pattern).toBe(
      OWNERSHIP_PATTERN.SETUP_DEFAULT_TO_DAY
    );
  });

  it('maps day.technical.units to a day fact (no animal default exists; seeded undefined)', () => {
    // Unlike the rig constants, day creation seeds `units: undefined` — there is no
    // animal.technicalDefaults.units to copy — so it is day-specific (matches shared-contracts.md).
    expect(ownershipForFieldPath('day.technical.units').pattern).toBe(OWNERSHIP_PATTERN.DAY_FACT);
    expect(ownershipForFieldPath('technical.units.analog').pattern).toBe(OWNERSHIP_PATTERN.DAY_FACT);
  });

  it('keeps an electrode-group `units` subfield with the versioned configuration (ordering guard)', () => {
    // `units` also appears on electrode_groups; `electrode` must win so the config snapshot
    // owns it, not the day-technical units. Locks the keyword-scan order.
    expect(ownershipForFieldPath('electrode_groups[0].units').pattern).toBe(
      OWNERSHIP_PATTERN.CONFIGURATION_VERSION
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

  it('resolves the state-shape paths the matrix documents (animal./day. prefixes, nested fields)', () => {
    // These are the canonical state paths in workflow-ownership-matrix.md — a future agent may
    // pass them verbatim. A leading-token lookup would mis-resolve them all to day/animal facts.
    expect(ownershipForFieldPath('day.technical.raw_data_to_volts').pattern).toBe(
      OWNERSHIP_PATTERN.SETUP_DEFAULT_TO_DAY
    );
    expect(ownershipForFieldPath('day.technical.times_period_multiplier').pattern).toBe(
      OWNERSHIP_PATTERN.SETUP_DEFAULT_TO_DAY
    );
    expect(ownershipForFieldPath('day.technical.default_header_file_path').pattern).toBe(
      OWNERSHIP_PATTERN.DAY_FACT
    );
    expect(ownershipForFieldPath('animal.cameras[0].lens').pattern).toBe(
      OWNERSHIP_PATTERN.ANIMAL_CATALOG_REFERENCE
    );
    expect(ownershipForFieldPath('day.tasks[0].camera_id').pattern).toBe(
      OWNERSHIP_PATTERN.TASK_EPOCH_ASSIGNMENT
    );
    expect(ownershipForFieldPath('day.configurationVersion').pattern).toBe(
      OWNERSHIP_PATTERN.CONFIGURATION_VERSION
    );
    expect(ownershipForFieldPath('animal.devices.data_acq_device[0].amplifier').pattern).toBe(
      OWNERSHIP_PATTERN.ANIMAL_SETUP
    );
    expect(ownershipForFieldPath('animal.subject.species').pattern).toBe(OWNERSHIP_PATTERN.ANIMAL_SETUP);
    expect(ownershipForFieldPath('day.session.weight').pattern).toBe(OWNERSHIP_PATTERN.DAY_FACT);
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
