# Development Scratchpad

**Purpose:** Notes for ongoing development work on the rec_to_nwb_yaml_creator project.

- Use this file to keep notes on ongoing development work.
- When the work is completed, clean it out from this file, so that the contents only reflect ongoing work.

**Last Updated:** October 28, 2025

---

## Current Session: M3 - Extend Store for Workspace

**Status:** ✅ M3 COMPLETE - Workspace state management implemented, all tests passing, code review approved

### Documents Created

1. **[REFACTORING_PLAN_REVISED.md](REFACTORING_PLAN_REVISED.md)** - Revised migration plan
   - Addresses 8 critical concerns from original plan
   - Preserves existing infrastructure (Context store, Vitest, single-page app)
   - Moves shadow export validation to PR1 (from PR8)
   - Adds continuous accessibility requirements
   - Defines TypeScript strategy (JSDoc first, defer .ts conversion)

2. **[ANIMAL_WORKSPACE_DESIGN.md](ANIMAL_WORKSPACE_DESIGN.md)** - Multi-animal architecture
   - Complete data model with TypeScript interfaces
   - localStorage storage strategy (5MB capacity)
   - YAML export flow (preserves current format)
   - UI workflow (4 views: Home, Animal Workspace, Day Editor, Validation)
   - Batch operations (creation, validation, export)
   - Probe reconfiguration tracking with versioning
   - Migration path (Phase 1: single animal, Phase 2: multi-animal)

### Key Decisions

| Topic | Decision | Location |
|-------|----------|----------|
| **State Management** | Extend existing Context/hooks (no Zustand) | REFACTORING_PLAN_REVISED.md §1 |
| **Testing** | Audit existing 90+ tests, integrate shadow export | REFACTORING_PLAN_REVISED.md §4 |
| **Shadow Export** | Move to PR1 for immediate parity enforcement | REFACTORING_PLAN_REVISED.md §6 |
| **TypeScript** | JSDoc first, defer .ts conversion to PR7+ | REFACTORING_PLAN_REVISED.md §2 |
| **Routing** | Hash-based conditional rendering (no React Router) | REFACTORING_PLAN_REVISED.md §3 |
| **Storage** | localStorage (Phase 1), file system (Phase 2) | ANIMAL_WORKSPACE_DESIGN.md §4 |
| **YAML Format** | Unchanged - each day exports independent file | ANIMAL_WORKSPACE_DESIGN.md §5 |
| **Devices** | Configuration versioning for probe tracking | ANIMAL_WORKSPACE_DESIGN.md §3.2 |

### Milestone Sequence (Revised)

- **M0**: Repo Prep & Safety Rails (feature flags, schema version, test audit)
- **M0.5**: Type System Strategy (JSDoc coverage target, tsconfig)
- **M1**: Extract Pure Utilities + Shadow Export (moved from PR8)
- **M2**: UI Skeleton + Hash Routing (a11y from start)
- **M3**: Extend Existing Store (workspace state in Context)
- **M4-M12**: Continue with feature development

### Completed Milestones

- [x] **M0**: Repository audit ✅ See [TEST_INFRASTRUCTURE_AUDIT.md](TEST_INFRASTRUCTURE_AUDIT.md)
- [x] **M0**: Context store verification ✅ See [CONTEXT_STORE_VERIFICATION.md](CONTEXT_STORE_VERIFICATION.md)
- [x] **M0**: Feature flags ✅ 41 tests passing
- [x] **M0**: Schema version validation ✅ Script created and integrated
- [x] **M0.5**: Type System Strategy ✅ JSDoc-first approach configured
- [x] **M1**: Extract Pure Utilities ✅ 257 total tests (io/yaml + validation)
- [x] **M2**: UI Skeleton + Routing ✅ 2218 tests passing, accessibility verified
- [x] **M3**: Extend Store for Workspace ✅ 2277 tests passing, 57 workspace tests

### M1 Complete - Extract Pure Utilities

**Completed:**

- [x] **YAML utilities audit** ✅ Discovered existing `io/yaml.js` module
  - All YAML functions already extracted from App.js
  - `encodeYaml()` - 8 existing tests
  - `formatDeterministicFilename()` - 12 existing tests
  - `downloadYamlFile()` - 7 existing tests (including memory leak prevention)
  - **Missing:** Tests for `decodeYaml()`

- [x] **Add `decodeYaml()` test coverage** ✅ 23 new tests created
  - Created `src/__tests__/unit/io/yaml-decodeYaml.test.js`
  - Coverage: normal operation, edge cases, error handling, round-trip, scientific metadata
  - All tests passing

- [x] **Remove deprecated file** ✅ Cleaned up legacy code
  - Removed `src/utils/yamlExport.js` (no longer used)
  - Updated test documentation to reference `io/yaml.js`
  - **Test Results:** 2149 tests passing (up from 2126, +23 new tests)

- [x] **Validation utilities audit** ✅ Discovered existing pure utilities
  - Schema validation already extracted to `src/validation/` module
  - `schemaValidation()` - JSON schema validation with AJV
  - `rulesValidation()` - Business logic validation
  - `validate()` - Unified validation API
  - Pure utilities with **189 tests across 6 test files**
  - No React dependencies in core validation logic

- [x] **Shadow export testing audit** ✅ Discovered existing golden baseline tests
  - Golden YAML baseline tests already exist: `__tests__/baselines/golden-yaml.baseline.test.js`
  - **18 tests** verifying byte-for-byte YAML export equality
  - Tests 4 fixture files: sample, minimal, realistic, probe-reconfig
  - Round-trip consistency, format stability, edge cases
  - Integrated with Vitest and CI pipeline
  - Feature flags exist: `shadowExportStrict`, `shadowExportLog`

- [x] **Document regression protocol** ✅ Comprehensive documentation added to CLAUDE.md
  - Golden baseline test explanation
  - Regeneration protocol (when/how to update fixtures)
  - Test coverage summary (2149 tests across 109 files)
  - CI/CD integration details
  - Safety guidelines for preventing data corruption

## M1 Complete Summary

**All 5 tasks complete:**

1. ✅ Extract YAML utilities (io/yaml.js) - 50 tests
2. ✅ Create schema validator (validation/) - 189 tests
3. ✅ Add shadow export test (golden baselines) - 18 tests
4. ✅ Integrate with Vitest - Running in CI
5. ✅ Document regression protocol - Added to CLAUDE.md

**Total test coverage:** 2149 tests passing across 109 test files

**Outcome:** Infrastructure was already in place from earlier refactoring. This session focused on:

- Adding missing test coverage (decodeYaml: +23 tests)
- Auditing and documenting existing infrastructure
- Creating comprehensive regression prevention documentation

## M2 Complete Summary

**All 5 tasks complete:**

1. ✅ AppLayout wrapper - Hash-based routing (35 tests)
2. ✅ Conditional rendering - 4 view stubs + LegacyFormView
3. ✅ Hash-based navigation - useHashRouter hook
4. ✅ ARIA landmarks - All views provide proper landmarks
5. ✅ Accessibility tests - aria-landmarks.test.jsx (10 tests)

**Total test coverage:** 2218 tests passing across 109 test files (2 failing tests in ElectrodeGroupFields, unrelated to M2)

**Outcome:** Infrastructure in place for future milestones. All DoD items met:

- ✅ Legacy app works at #/
- ✅ New sections load via hash (#/home, #/workspace, #/day/:id, #/validation)
- ✅ ARIA landmarks verified in all views

## M3 Complete Summary

**All 4 tasks complete:**

1. ✅ Add animal/day abstractions to store.js - Workspace state with CRUD actions (57 tests)
2. ✅ Maintain compatibility - 100% backward compatible, all 2277 tests passing
3. ✅ Write unit tests - 57 workspace tests across 3 files
4. ✅ Add docs/animal_hierarchy.md - Complete documentation (495 lines)

**Total test coverage:** 2277 tests passing across 114 test files (1 skipped)

**Code Review:** ✅ Approved by code-reviewer agent (4.8/5.0 rating)

**Key Accomplishments:**

- **Workspace State Management:** Added `animals`, `days`, `settings` to store
- **CRUD Actions:** Full suite of actions for animal/day management
- **Configuration History:** Probe version tracking with snapshots
- **Type Definitions:** 24 JSDoc types in workspaceTypes.js (430 lines)
- **Pure Utilities:** mergeDayMetadata and helpers in workspaceUtils.js (172 lines)
- **Performance Fixes:** Model memoization fixed 20 test regressions
- **Closure Safety:** formDataRef pattern fixed stale closures in event handlers
- **Test Coverage:** 57 workspace tests covering all actions and merge logic

**Issues Fixed:**

1. ✅ Model memoization - Prevented excessive re-renders (fixed 20/22 test failures)
2. ✅ Stale closure bug - formDataRef pattern ensures handlers access latest state (fixed 1/2 test failures)
3. ✅ Test assertion mismatch - Updated ElectrodeGroupFields test for new label format (fixed 1/2 test failures)

**Technical Debt:**

- ⚠️ formDataRef pattern is workaround for tests accessing fiber internals
- 📝 TODO: Refactor tests in M4 to avoid accessing React fiber.memoizedProps
- 📝 TODO: Add workspace size monitoring in M4 (localStorage limit)

**Next Milestone:** M4 - Animal Workspace MVP (persistence, UI)

### Open Questions

From ANIMAL_WORKSPACE_DESIGN.md:

1. **Import existing YAMLs**: Batch import from directory (defer to Phase 2)
2. **Experiment description**: Animal-level with day override (recommended)
3. **Weight tracking**: Animal default with day override (recommended)
4. **Camera IDs**: Animal-level with day override (recommended)

### Reference Links

- Original plan: [COMPREHENSIVE_REFACTORING_PLAN.md](COMPREHENSIVE_REFACTORING_PLAN.md)
- Task breakdown: [TASKS.md](TASKS.md)
- Implementation guide: [CLAUDE.md](../CLAUDE.md)
- Testing patterns: [TESTING_PATTERNS.md](TESTING_PATTERNS.md)

---
