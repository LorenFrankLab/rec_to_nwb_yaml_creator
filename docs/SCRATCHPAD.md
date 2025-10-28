# Development Scratchpad

**Purpose:** Notes for ongoing development work on the rec_to_nwb_yaml_creator project.

- Use this file to keep notes on ongoing development work.
- When the work is completed, clean it out from this file, so that the contents only reflect ongoing work.

**Last Updated:** October 27, 2025

---

## Current Session: M1 - Extract Pure Utilities

**Status:** M1 in progress - YAML utilities complete, moving to schemaValidator

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

### Current Work: M1 - Extract Pure Utilities

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

**Next:**

- [ ] Add shadow export test for YAML parity verification
- [ ] Integrate shadow export with Vitest baseline suite
- [ ] Document regression protocol in CLAUDE.md

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
