# Development Scratchpad

**Purpose:** Notes for ongoing development work on the rec_to_nwb_yaml_creator project.

- Use this file to keep notes on ongoing development work.
- When the work is completed, clean it out from this file, so that the contents only reflect ongoing work.

**Last Updated:** October 27, 2025

---

## Current Session: M0.5 Type System Strategy Implementation

**Status:** M0.5 Complete ✅ - Ready for M1

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

### Next Actions

**Before Implementation:**

- [ ] Review and approve ANIMAL_WORKSPACE_DESIGN.md
- [ ] Answer open questions (import strategy, experiment description scope)
- [ ] Create FEATURE_FLAGS.md (flag lifecycle documentation)
- [ ] Create SCHEMA_UPGRADE_PROTOCOL.md (coordination with trodes_to_nwb)

**Ready to Start:**

- [x] M0: Repository audit (existing tests, baseline coverage) ✅ See [TEST_INFRASTRUCTURE_AUDIT.md](TEST_INFRASTRUCTURE_AUDIT.md)
  - **Summary:** 105 test files, 2,074 tests passing, Vitest 4.0.1, comprehensive coverage
  - **Key findings:** Golden baseline tests for YAML regression, integration test helpers, strong CI/CD
  - **Recommendations:** Preserve baseline tests, add shadow export in M1, monitor App.js modularization
- [x] M0: Verify existing Context store is intact and tested ✅ See [CONTEXT_STORE_VERIFICATION.md](CONTEXT_STORE_VERIFICATION.md)
  - **Summary:** StoreContext + useStore pattern, 53 passing tests, clean separation via composable hooks
  - **Key findings:** Critical data integrity logic (task epoch cleanup), memoized selectors, stable API
  - **Recommendations:** Extend model structure for animal/day hierarchy, preserve existing API, add localStorage
- [x] M0: Add feature flags (src/featureFlags.js) ✅ 41 tests passing
  - **Created:** 22 feature flags organized by milestone (M1-M11 + development)
  - **Defaults:** shadowExportStrict/Log enabled, all new features disabled
  - **Utilities:** isFeatureEnabled(), getEnabledFeatures(), overrideFlags(), restoreFlags()
  - **Testing:** Comprehensive test coverage, override/restore mechanism for testing
- [x] M0: Add schema version validation ✅ Script created, tested, and integrated
  - **Schema:** Added `version: "1.0.1"` field to nwb_schema.json
  - **Script:** Created scripts/check-schema-version.mjs (260 lines, colored output, help text)
  - **Integration:** Added to .github/workflows/test.yml, npm script `check:schema`
  - **Fix:** Configured AJV with `strict: false` to allow version metadata
- [x] M0.5: Type System Strategy ✅ JSDoc-first approach documented and configured
  - **Documentation:** Created comprehensive [types_migration.md](types_migration.md) with Phase 1 (JSDoc) and Phase 2 (optional TypeScript)
  - **Decision:** Selected **Option A** - JSDoc with 70% coverage goal, defer .ts conversion to M13+
  - **Configuration:**
    - Installed `eslint-plugin-jsdoc` (warning-level rules for new code)
    - Created `jsconfig.json` with path aliases (`@/*` → `src/*`)
    - Updated `.eslintrc.js` with JSDoc validation rules
  - **Testing:** 11 tests added (7 for documentation, 4 for configuration)
  - **Artifacts:** `docs/types_migration.md`, `jsconfig.json`, updated `.eslintrc.js`
  - **Test Results:** 2126 passing, 1 snapshot updated (schema hash changed due to version field)

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
